"""Unit tests for ComplianceAlertsService (P6-A23).

All FSSAI HTTP calls are mocked -- no live network needed.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.infrastructure.external.compliance_alerts_service import ComplianceAlertsService

_SAMPLE_HTML = """
<div class="row">
  <div class="col-md-12 col-xs-12 content-area">
    <div class="jobmonth12"><p><b>June 2026</b></p></div>
    <div class="grouptr12">
      <p><strong>&#9830; Gazette Notification regarding Vegan Foods labelling &nbsp;[Uploaded on : 30-06-2026]</strong></p>
      <ul><li><a href="https://fssai.gov.in/upload/notifications/2026/06/vegan_final.pdf" target="_blank">Download</a></li></ul>
    </div>
    <div class="grouptr12">
      <p><strong>&#9830; Gazette Notification on Contaminants and Toxins &nbsp;[Uploaded on : 24-06-2026]</strong></p>
      <ul><li><a href="https://fssai.gov.in/upload/notifications/2026/06/contaminants.pdf" target="_blank">Download</a></li></ul>
    </div>
  </div>
</div>
"""

_EMPTY_HTML = """
<div class="row">
  <div class="col-md-12 col-xs-12 content-area">
    No records found
  </div>
</div>
"""


def _mock_client(html: str, raise_error: bool = False):
    mock_response = MagicMock()
    if raise_error:
        mock_response.raise_for_status.side_effect = Exception("HTTP error")
    else:
        mock_response.raise_for_status.return_value = None
        mock_response.text = html

    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    return patch(
        "app.infrastructure.external.compliance_alerts_service.httpx.AsyncClient",
        return_value=mock_client,
    )


@pytest.mark.asyncio
async def test_parses_real_notice_structure():
    with _mock_client(_SAMPLE_HTML):
        result = await ComplianceAlertsService().get_alerts()

    assert result is not None
    assert result["notice_count"] == 2
    assert result["notices"][0]["title"] == "Gazette Notification regarding Vegan Foods labelling"
    assert result["notices"][0]["uploaded_on"] == "30-06-2026"
    assert result["notices"][0]["url"].endswith("vegan_final.pdf")


@pytest.mark.asyncio
async def test_no_records_found_returns_none():
    with _mock_client(_EMPTY_HTML):
        result = await ComplianceAlertsService().get_alerts()

    assert result is None


@pytest.mark.asyncio
async def test_http_error_returns_none_not_raise():
    with _mock_client("", raise_error=True):
        result = await ComplianceAlertsService().get_alerts()

    assert result is None


@pytest.mark.asyncio
async def test_unexpected_page_structure_returns_none_not_raise():
    """Simulates an FSSAI site redesign -- no .grouptr12 divs at all."""
    with _mock_client("<html><body><h1>New site design</h1></body></html>"):
        result = await ComplianceAlertsService().get_alerts()

    assert result is None


@pytest.mark.asyncio
async def test_malformed_notice_text_is_skipped_not_crashed():
    """A group missing the "[Uploaded on : ...]" suffix shouldn't crash parsing --
    it's just skipped, and any well-formed siblings still come through."""
    html = """
    <div class="grouptr12"><p><strong>A notice with no date suffix</strong></p></div>
    <div class="grouptr12">
      <p><strong>&#9830; Well-formed notice &nbsp;[Uploaded on : 01-01-2026]</strong></p>
      <ul><li><a href="https://fssai.gov.in/x.pdf">Download</a></li></ul>
    </div>
    """
    with _mock_client(html):
        result = await ComplianceAlertsService().get_alerts()

    assert result is not None
    assert result["notice_count"] == 1
    assert result["notices"][0]["title"] == "Well-formed notice"


@pytest.mark.asyncio
async def test_exception_returns_none_never_raises():
    with patch(
        "app.infrastructure.external.compliance_alerts_service.httpx.AsyncClient",
        side_effect=RuntimeError("network down"),
    ):
        result = await ComplianceAlertsService().get_alerts()

    assert result is None
