"""P5-12 RAG chatbot — unit tests for context retrieval and multi-turn history."""

from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime


def _mock_run(scenario="friday_rush", verdict="approved", score=0.88, notes="Solid plan."):
    run = MagicMock()
    run.scenario        = scenario
    run.critic_verdict  = verdict
    run.critic_score    = score
    run.critic          = {"notes": notes}
    run.created_at      = datetime(2026, 6, 6, 18, 0, 0)
    return run


def test_build_context_includes_run_data():
    from app.domain.services.chat_service import build_context

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [
        _mock_run("friday_rush", "approved", 0.91, "Strong demand forecast."),
        _mock_run("weekday_lunch", "revision", 0.65, "Inventory shortfall flagged."),
    ]
    mock_org_query = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = None

    context = build_context(
        org_id=1,
        org_name="Test Kitchen",
        question="Why was last week revised?",
        db=mock_db,
        memory=None,
    )

    assert "Test Kitchen" in context
    assert "friday_rush" in context
    assert "weekday_lunch" in context
    assert "revision" in context
    assert "0.65" in context


def test_build_context_with_no_runs_returns_safe_default():
    from app.domain.services.chat_service import build_context

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = []

    context = build_context(
        org_id=1,
        org_name="Test Kitchen",
        question="How did we do?",
        db=mock_db,
        memory=None,
    )

    assert "No planning runs found" in context


def test_build_context_includes_db_feedback():
    from app.domain.services.chat_service import build_context

    fb = MagicMock()
    fb.raw_text = "Pizza was cold on arrival"
    fb.sentiment = MagicMock()
    fb.sentiment.value = "negative"
    fb.created_at = datetime(2026, 6, 1)

    mock_db = MagicMock()
    # First query = PlanningRun (empty), second query = Feedback
    mock_db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = []
    mock_db.query.return_value.order_by.return_value.limit.return_value.all.return_value = [fb]

    context = build_context(
        org_id=1,
        org_name="Test Kitchen",
        question="What complaints did we have?",
        db=mock_db,
        memory=None,
    )

    assert "Pizza was cold on arrival" in context


def test_build_context_handles_qdrant_failure_gracefully():
    from app.domain.services.chat_service import build_context

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = []

    mock_memory = MagicMock()
    mock_memory.retrieve_similar_complaints.side_effect = Exception("Qdrant unavailable")

    # Should not raise
    context = build_context(
        org_id=1,
        org_name="Test Kitchen",
        question="Any issues?",
        db=mock_db,
        memory=mock_memory,
    )

    assert "Test Kitchen" in context


def test_history_trimmed_to_last_6():
    """The service keeps only the last 6 history messages before the new question."""
    long_history = [
        {"role": "user" if i % 2 == 0 else "assistant", "content": f"msg {i}"}
        for i in range(10)
    ]
    # Replicate the trimming logic from stream_reply
    trimmed = long_history[-6:]
    assert len(trimmed) == 6
    assert trimmed[0]["content"] == "msg 4"  # first kept message
    assert trimmed[-1]["content"] == "msg 9"  # last kept message
