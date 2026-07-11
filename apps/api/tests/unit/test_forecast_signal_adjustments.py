"""Unit tests for ForecastService._apply_signal_adjustments (P6-A21).

This is the fix for "scenario selection only changes labels, not the actual
forecast math" -- Prophet's raw predicted_orders is purely historical and
can't know about a forward-looking one-off signal (a holiday, a rain
forecast). These tests confirm the multiplier applies correctly and stays
transparent (pre-adjustment value + multiplier + reasons all preserved).
"""

from unittest.mock import MagicMock

from app.domain.services.forecast_service import ForecastService, _HOLIDAY_DEMAND_MULTIPLIER


def _service() -> ForecastService:
    return ForecastService(db=MagicMock(), llm=MagicMock())


def _base_forecast() -> dict:
    return {"predicted_orders": 100.0, "predicted_peak_orders": 60.0, "method": "prophet"}


def test_no_signals_returns_forecast_unchanged():
    service = _service()
    forecast = service._apply_signal_adjustments(_base_forecast())
    assert forecast["predicted_orders"] == 100.0
    assert "adjustment_multiplier" not in forecast
    assert "predicted_orders_pre_adjustment" not in forecast


def test_holiday_applies_documented_multiplier():
    service = _service()
    forecast = service._apply_signal_adjustments(
        _base_forecast(), is_holiday=True, holiday_name="Diwali",
    )
    assert forecast["predicted_orders_pre_adjustment"] == 100.0
    assert forecast["predicted_orders"] == round(100.0 * _HOLIDAY_DEMAND_MULTIPLIER, 1)
    assert forecast["adjustment_multiplier"] == _HOLIDAY_DEMAND_MULTIPLIER
    assert any("Diwali" in r for r in forecast["adjustment_reasons"])


def test_weather_applies_its_own_multiplier():
    service = _service()
    weather_signal = {"condition": "heavy_rain", "demand_multiplier": 1.10}
    forecast = service._apply_signal_adjustments(_base_forecast(), weather_signal=weather_signal)
    assert forecast["predicted_orders_pre_adjustment"] == 100.0
    assert forecast["predicted_orders"] == round(100.0 * 1.10, 1)
    assert forecast["adjustment_multiplier"] == 1.10
    assert any("heavy_rain" in r for r in forecast["adjustment_reasons"])


def test_holiday_and_weather_multipliers_stack():
    service = _service()
    weather_signal = {"condition": "light_rain", "demand_multiplier": 1.05}
    forecast = service._apply_signal_adjustments(
        _base_forecast(), weather_signal=weather_signal, is_holiday=True, holiday_name="Holi",
    )
    expected_multiplier = round(_HOLIDAY_DEMAND_MULTIPLIER * 1.05, 3)
    assert forecast["adjustment_multiplier"] == expected_multiplier
    assert forecast["predicted_orders"] == round(100.0 * expected_multiplier, 1)
    assert len(forecast["adjustment_reasons"]) == 2


def test_weather_multiplier_of_exactly_one_is_not_treated_as_a_signal():
    """Clear weather (demand_multiplier=1.0) shouldn't show up as a reason or
    trigger the pre_adjustment fields if it's the only signal present."""
    service = _service()
    weather_signal = {"condition": "clear", "demand_multiplier": 1.0}
    forecast = service._apply_signal_adjustments(_base_forecast(), weather_signal=weather_signal)
    assert "adjustment_multiplier" not in forecast
    assert forecast["predicted_orders"] == 100.0


def test_peak_orders_adjusted_by_the_same_multiplier():
    service = _service()
    forecast = service._apply_signal_adjustments(_base_forecast(), is_holiday=True, holiday_name="Eid")
    assert forecast["predicted_peak_orders_pre_adjustment"] == 60.0
    assert forecast["predicted_peak_orders"] == round(60.0 * _HOLIDAY_DEMAND_MULTIPLIER, 1)


def test_missing_predicted_orders_defaults_to_zero_without_raising():
    service = _service()
    forecast = service._apply_signal_adjustments({}, is_holiday=True, holiday_name="Christmas")
    assert forecast["predicted_orders"] == 0.0
