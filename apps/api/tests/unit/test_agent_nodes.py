"""
Unit tests for individual agent nodes — P1-11 acceptance criteria.

Covers:
- demand_forecast_node  (simulation mode + production path + error handling)
- reservation_node      (date parsing + production path + error handling)
- complaint_intelligence_node (RAG enrichment + no-memory path + error handling)
- menu_intelligence_node (top items + promo candidates + error handling)
- inventory_node        (Phase 1 stub behaviour)
- critic_node           (override + no-bundle guard + error handling + debug tracing)

All tests are pure unit tests — DB, LLM, and Qdrant are fully mocked.

Run with:
    cd apps/api && pytest tests/unit/test_agent_nodes.py -v
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ── demand_forecast_node ──────────────────────────────────────────────────────

class TestDemandForecastNode:

    @pytest.mark.asyncio
    async def test_simulation_mode_returns_deterministic_output(self, sim_state, mock_db, mock_llm):
        from app.orchestration.nodes.demand_forecast import demand_forecast_node

        result = await demand_forecast_node(sim_state, db=mock_db, llm=mock_llm)

        output = result["forecast_output"]
        assert output["service"] == "forecast"
        assert "predicted_covers" in output["data"]
        assert output["data"]["confidence"] == 0.87
        mock_llm.complete_json.assert_not_called()

    @pytest.mark.asyncio
    async def test_simulation_mode_uses_target_date(self, sim_state, mock_db, mock_llm):
        from app.orchestration.nodes.demand_forecast import demand_forecast_node

        result = await demand_forecast_node(sim_state, db=mock_db, llm=mock_llm)
        assert result["forecast_output"]["target_date"] == "2026-04-11"

    @pytest.mark.asyncio
    async def test_short_circuits_on_error(self, errored_state, mock_db, mock_llm):
        from app.orchestration.nodes.demand_forecast import demand_forecast_node

        result = await demand_forecast_node(errored_state, db=mock_db, llm=mock_llm)
        assert result["forecast_output"] is None
        assert result["error"] == "Upstream failure"

    @pytest.mark.asyncio
    async def test_production_mode_calls_forecast_service(self, base_state, mock_db, mock_llm):
        from app.orchestration.nodes.demand_forecast import demand_forecast_node

        mock_service_result = {
            "service": "forecast",
            "data": {"predicted_orders": 110},
            "recommendation": {"recommendation": "Prep for 110", "priority": "high", "reasoning": "", "risks": []},
        }

        with patch(
            "app.orchestration.nodes.demand_forecast.ForecastService"
        ) as MockService:
            MockService.return_value.analyse_and_recommend = AsyncMock(return_value=mock_service_result)
            result = await demand_forecast_node(base_state, db=mock_db, llm=mock_llm)

        assert result["forecast_output"]["data"]["predicted_orders"] == 110

    @pytest.mark.asyncio
    async def test_service_exception_captured_in_output(self, base_state, mock_db, mock_llm):
        from app.orchestration.nodes.demand_forecast import demand_forecast_node

        with patch("app.orchestration.nodes.demand_forecast.ForecastService") as MockService:
            MockService.return_value.analyse_and_recommend = AsyncMock(side_effect=Exception("DB timeout"))
            result = await demand_forecast_node(base_state, db=mock_db, llm=mock_llm)

        output = result["forecast_output"]
        assert output["service"] == "forecast"
        assert "DB timeout" in output["error"]
        assert output["data"] is None
        assert result["error"] is None  # state-level error not set — node catches it

    @pytest.mark.asyncio
    async def test_debug_trace_appended(self, mock_db, mock_llm):
        from app.orchestration.nodes.demand_forecast import demand_forecast_node
        from app.orchestration.state import make_initial_state

        state = make_initial_state(
            "friday_rush", simulation_mode=True, debug=True
        )
        state["execution_trace"] = []

        result = await demand_forecast_node(state, db=mock_db, llm=mock_llm)
        assert "demand_forecast" in result["execution_trace"]


# ── reservation_node ──────────────────────────────────────────────────────────

class TestReservationNode:

    @pytest.mark.asyncio
    async def test_short_circuits_on_error(self, errored_state, mock_db, mock_llm):
        from app.orchestration.nodes.reservation import reservation_node

        result = await reservation_node(errored_state, db=mock_db, llm=mock_llm)
        assert result["reservation_output"] is None

    @pytest.mark.asyncio
    async def test_calls_service_with_parsed_date(self, base_state, mock_db, mock_llm):
        from app.orchestration.nodes.reservation import reservation_node

        mock_result = {
            "service": "reservation",
            "data": {"total_guests": 60, "capacity": 70},
            "recommendation": {"recommendation": "All good", "priority": "low", "reasoning": "", "risks": []},
        }

        with patch("app.orchestration.nodes.reservation.ReservationService") as MockService:
            MockService.return_value.analyse_and_recommend = AsyncMock(return_value=mock_result)
            result = await reservation_node(base_state, db=mock_db, llm=mock_llm)

            call_kwargs = MockService.return_value.analyse_and_recommend.call_args.kwargs
            assert "target_date" in call_kwargs
            assert call_kwargs["target_date"].isoformat().startswith("2026-04-11")

        assert result["reservation_output"]["service"] == "reservation"

    @pytest.mark.asyncio
    async def test_exception_captured_gracefully(self, base_state, mock_db, mock_llm):
        from app.orchestration.nodes.reservation import reservation_node

        with patch("app.orchestration.nodes.reservation.ReservationService") as MockService:
            MockService.return_value.analyse_and_recommend = AsyncMock(
                side_effect=Exception("Connection refused")
            )
            result = await reservation_node(base_state, db=mock_db, llm=mock_llm)

        output = result["reservation_output"]
        assert output["service"] == "reservation"
        assert "Connection refused" in output["error"]
        assert output["data"] is None

    @pytest.mark.asyncio
    async def test_none_target_date_falls_back_gracefully(self, mock_db, mock_llm):
        from app.orchestration.nodes.reservation import reservation_node
        from app.orchestration.state import make_initial_state

        state = make_initial_state("friday_rush", target_date=None, simulation_mode=False)

        mock_result = {
            "service": "reservation",
            "data": {"total_guests": 50, "capacity": 70},
            "recommendation": {"recommendation": "OK", "priority": "low", "reasoning": "", "risks": []},
        }

        with patch("app.orchestration.nodes.reservation.ReservationService") as MockService:
            MockService.return_value.analyse_and_recommend = AsyncMock(return_value=mock_result)
            result = await reservation_node(state, db=mock_db, llm=mock_llm)

        assert result["reservation_output"]["service"] == "reservation"


# ── complaint_intelligence_node ───────────────────────────────────────────────

class TestComplaintIntelligenceNode:

    @pytest.mark.asyncio
    async def test_short_circuits_on_error(self, errored_state, mock_db, mock_llm):
        from app.orchestration.nodes.complaint_intelligence import complaint_intelligence_node

        result = await complaint_intelligence_node(errored_state, db=mock_db, llm=mock_llm)
        assert result["complaint_output"] is None

    @pytest.mark.asyncio
    async def test_rag_context_added_when_memory_provided(
        self, base_state, mock_db, mock_llm, mock_memory
    ):
        from app.orchestration.nodes.complaint_intelligence import complaint_intelligence_node

        mock_service_result = {
            "service": "complaint",
            "data": {
                "total_feedback": 20,
                "sentiment_breakdown": {},
                "unique_complaints": ["cold pizza"],
            },
            "recommendation": {"recommendation": "Fix cold pizza", "priority": "high", "reasoning": "", "risks": []},
        }

        with patch("app.orchestration.nodes.complaint_intelligence.ComplaintService") as MockService:
            MockService.return_value.analyse_and_recommend = AsyncMock(return_value=mock_service_result)
            result = await complaint_intelligence_node(
                base_state, db=mock_db, llm=mock_llm, memory=mock_memory
            )

        output = result["complaint_output"]
        assert output["rag_context"]["similar_complaints"] != []
        assert output["rag_context"]["relevant_sops"] != []
        mock_memory.retrieve_similar_complaints.assert_called_once_with(query="cold pizza", top_k=3)
        mock_memory.retrieve_relevant_sops.assert_called_once_with(query="cold pizza", top_k=2)

    @pytest.mark.asyncio
    async def test_rag_context_empty_when_no_memory(self, base_state, mock_db, mock_llm):
        from app.orchestration.nodes.complaint_intelligence import complaint_intelligence_node

        mock_service_result = {
            "service": "complaint",
            "data": {"total_feedback": 10, "sentiment_breakdown": {}, "unique_complaints": ["noise"]},
            "recommendation": {"recommendation": "Address noise", "priority": "low", "reasoning": "", "risks": []},
        }

        with patch("app.orchestration.nodes.complaint_intelligence.ComplaintService") as MockService:
            MockService.return_value.analyse_and_recommend = AsyncMock(return_value=mock_service_result)
            result = await complaint_intelligence_node(
                base_state, db=mock_db, llm=mock_llm, memory=None
            )

        rag = result["complaint_output"]["rag_context"]
        assert rag["similar_complaints"] == []
        assert rag["relevant_sops"] == []

    @pytest.mark.asyncio
    async def test_exception_sets_error_in_output(self, base_state, mock_db, mock_llm):
        from app.orchestration.nodes.complaint_intelligence import complaint_intelligence_node

        with patch("app.orchestration.nodes.complaint_intelligence.ComplaintService") as MockService:
            MockService.return_value.analyse_and_recommend = AsyncMock(
                side_effect=Exception("Qdrant unreachable")
            )
            result = await complaint_intelligence_node(base_state, db=mock_db, llm=mock_llm)

        output = result["complaint_output"]
        assert output["service"] == "complaint"
        assert "Qdrant unreachable" in output["error"]
        assert output["rag_context"] == {}


# ── menu_intelligence_node ────────────────────────────────────────────────────

class TestMenuIntelligenceNode:

    @pytest.mark.asyncio
    async def test_short_circuits_on_error(self, errored_state, mock_db, mock_llm):
        from app.orchestration.nodes.menu_intelligence import menu_intelligence_node

        result = await menu_intelligence_node(errored_state, db=mock_db, llm=mock_llm)
        assert result["menu_output"] is None

    @pytest.mark.asyncio
    async def test_returns_structured_menu_recommendation(self, base_state, mock_db, mock_llm):
        from app.orchestration.nodes.menu_intelligence import menu_intelligence_node

        mock_result = {
            "service": "menu",
            "data": {"top_items": [{"item": "Margherita", "total_ordered": 80}]},
            "recommendation": {
                "highlight_items": ["Margherita"],
                "promo_candidates": ["Garlic Bread"],
                "reasoning": "Lean into high-volume, low-risk items.",
            },
        }

        with patch("app.orchestration.nodes.menu_intelligence.MenuService") as MockService:
            MockService.return_value.analyse_and_recommend = AsyncMock(return_value=mock_result)
            result = await menu_intelligence_node(base_state, db=mock_db, llm=mock_llm)

        output = result["menu_output"]
        assert output["service"] == "menu"
        assert output["recommendation"]["highlight_items"] == ["Margherita"]
        assert output["recommendation"]["promo_candidates"] == ["Garlic Bread"]

    @pytest.mark.asyncio
    async def test_passes_context_to_menu_service(self, base_state, mock_db, mock_llm):
        from app.orchestration.nodes.menu_intelligence import menu_intelligence_node

        state = {
            **base_state,
            "forecast_output": {"data": {"predicted_orders": 120}},
            "complaint_output": {"data": {"unique_complaints": ["cold pizza"]}},
            "inventory_output": {"data": {"shortage_alerts": [{"ingredient": "Mozzarella"}]}},
        }

        with patch("app.orchestration.nodes.menu_intelligence.MenuService") as MockService:
            mock_service = MockService.return_value
            mock_service.analyse_and_recommend = AsyncMock(
                return_value={"service": "menu", "data": {}, "recommendation": {}}
            )
            await menu_intelligence_node(state, db=mock_db, llm=mock_llm)

        mock_service.analyse_and_recommend.assert_called_once_with(
            forecast_data={"predicted_orders": 120},
            complaint_data={"unique_complaints": ["cold pizza"]},
            inventory_data={"shortage_alerts": [{"ingredient": "Mozzarella"}]},
        )

    @pytest.mark.asyncio
    async def test_exception_captured_gracefully(self, base_state, mock_db, mock_llm):
        from app.orchestration.nodes.menu_intelligence import menu_intelligence_node

        with patch("app.orchestration.nodes.menu_intelligence.MenuService") as MockService:
            MockService.return_value.analyse_and_recommend = AsyncMock(
                side_effect=Exception("Forecast query failed")
            )
            result = await menu_intelligence_node(base_state, db=mock_db, llm=mock_llm)

        output = result["menu_output"]
        assert output["service"] == "menu"
        assert "Forecast query failed" in output["error"]


# ── inventory_node ────────────────────────────────────────────────────────────

class TestInventoryNode:

    @pytest.mark.asyncio
    async def test_short_circuits_on_error(self, errored_state, mock_db, mock_llm):
        from app.orchestration.nodes.inventory import inventory_node

        result = await inventory_node(errored_state, db=mock_db, llm=mock_llm)
        assert result["inventory_output"] is None

    @pytest.mark.asyncio
    async def test_returns_stub_output(self, base_state, mock_db, mock_llm):
        from app.orchestration.nodes.inventory import inventory_node

        result = await inventory_node(base_state, db=mock_db, llm=mock_llm)

        output = result["inventory_output"]
        assert output["service"] == "inventory"
        assert output["data"]["shortage_alerts"] == []
        assert output["data"]["overstock_alerts"] == []
        assert "recommendation" in output

    @pytest.mark.asyncio
    async def test_llm_called_in_production_mode(self, base_state, mock_db, mock_llm):
        """Phase 2: In production mode, inventory node calls LLM for recommendations."""
        from app.orchestration.nodes.inventory import inventory_node
        
        mock_db.query.return_value.all.return_value = []
        
        await inventory_node(base_state, db=mock_db, llm=mock_llm)
        mock_llm.complete_json.assert_called()

    @pytest.mark.asyncio
    async def test_db_called_in_production_mode(self, base_state, mock_db, mock_llm):
        """Phase 2: In production mode, inventory node calls DB to query inventory."""
        from app.orchestration.nodes.inventory import inventory_node
        
        mock_db.query.return_value.all.return_value = []
        
        await inventory_node(base_state, db=mock_db, llm=mock_llm)
        mock_db.query.assert_called()


# ── critic_node ───────────────────────────────────────────────────────────────

class TestCriticNode:

    @pytest.mark.asyncio
    async def test_short_circuits_on_error(self, errored_state, mock_db, mock_llm):
        from app.orchestration.nodes.critic import critic_node

        result = await critic_node(errored_state, db=mock_db, llm=mock_llm)
        assert result["critic_output"] is None
        assert result["error"] == "Upstream failure"

    @pytest.mark.asyncio
    async def test_rejects_when_no_bundle(self, base_state, mock_db, mock_llm):
        from app.orchestration.nodes.critic import critic_node

        # aggregated_recommendation is None by default
        result = await critic_node(base_state, db=mock_db, llm=mock_llm)

        output = result["critic_output"]
        assert output["verdict"] == "rejected"
        assert output["score"] == 0.0
        assert "No aggregated recommendation" in output["notes"]

    @pytest.mark.asyncio
    async def test_override_approved(self, base_state, mock_db, mock_llm):
        from app.orchestration.nodes.critic import critic_node

        state = {
            **base_state,
            "aggregated_recommendation": {"scenario": "friday_rush"},
            "force_critic_decision": "approved",
        }
        result = await critic_node(state, db=mock_db, llm=mock_llm)

        output = result["critic_output"]
        assert output["verdict"] == "approved"
        assert output["score"] == 1.0
        mock_llm.complete_json.assert_not_called()

    @pytest.mark.asyncio
    async def test_override_rejected(self, base_state, mock_db, mock_llm):
        from app.orchestration.nodes.critic import critic_node

        state = {
            **base_state,
            "aggregated_recommendation": {"scenario": "friday_rush"},
            "force_critic_decision": "rejected",
        }
        result = await critic_node(state, db=mock_db, llm=mock_llm)

        output = result["critic_output"]
        assert output["verdict"] == "rejected"
        assert output["score"] == 0.0

    @pytest.mark.asyncio
    async def test_calls_critic_service_when_bundle_present(
        self, base_state, mock_db, mock_llm
    ):
        from app.orchestration.nodes.critic import critic_node

        state = {
            **base_state,
            "aggregated_recommendation": {
                "scenario": "friday_rush",
                "summary_for_critic": "Peak Friday, 120 predicted orders.",
                "agents": {},
            },
        }

        mock_result = {
            "verdict": "approved",
            "score": 0.88,
            "notes": "Operationally sound.",
            "decision_log_id": 7,
        }

        with patch("app.orchestration.nodes.critic.CriticService") as MockService:
            MockService.return_value.evaluate_and_log = AsyncMock(return_value=mock_result)
            result = await critic_node(state, db=mock_db, llm=mock_llm)

        output = result["critic_output"]
        assert output["verdict"] == "approved"
        assert output["score"] == 0.88
        assert output["decision_log_id"] == 7

    @pytest.mark.asyncio
    async def test_exception_returns_revision_verdict(self, base_state, mock_db, mock_llm):
        from app.orchestration.nodes.critic import critic_node

        state = {
            **base_state,
            "aggregated_recommendation": {"scenario": "friday_rush", "agents": {}},
        }

        with patch("app.orchestration.nodes.critic.CriticService") as MockService:
            MockService.return_value.evaluate_and_log = AsyncMock(
                side_effect=Exception("LLM rate limit")
            )
            result = await critic_node(state, db=mock_db, llm=mock_llm)

        output = result["critic_output"]
        assert output["verdict"] == "revision"
        assert "LLM rate limit" in output["notes"]
        # State-level error is NOT set — node contains the exception
        assert result.get("error") is None

    @pytest.mark.asyncio
    async def test_debug_trace_appended(self, mock_db, mock_llm):
        from app.orchestration.nodes.critic import critic_node
        from app.orchestration.state import make_initial_state

        state = make_initial_state("friday_rush", simulation_mode=False, debug=True)
        state["execution_trace"] = []
        state["aggregated_recommendation"] = {
            "scenario": "friday_rush",
            "summary_for_critic": "test",
            "agents": {},
        }

        with patch("app.orchestration.nodes.critic.CriticService") as MockService:
            MockService.return_value.evaluate_and_log = AsyncMock(return_value={
                "verdict": "approved", "score": 0.9, "notes": "", "decision_log_id": 1
            })
            result = await critic_node(state, db=mock_db, llm=mock_llm)

        assert "critic" in result["execution_trace"]
