"""ComplianceAlertsService — P6-A23.

Scrapes FSSAI's public notifications page (Gazette Notification category --
finalized regulations, not drafts/comments-under-review) for recent
regulatory notices relevant to Indian restaurants. Public government
regulatory data -- no ToS tension of any kind, the cleanest source of the
four live-intelligence signals on that front.

Confirmed live: this page has no RSS feed and is plain server-side-rendered
HTML (a <select> category filter + form GET/POST reload, not JS/AJAX-driven
-- the whole notice list is present in the raw HTML), so a lightweight
BeautifulSoup parser is sufficient without a headless browser.

Explicit fail-open contract given HTML scraping is inherently more fragile
than RSS -- any FSSAI site redesign breaks the parser -- must degrade to
None cleanly, never raise, never block the other three live-intelligence
signals (weather, industry trends, anonymised Swiggy area signals).
"""

import re
from datetime import date
from typing import Optional

import httpx
import structlog
from bs4 import BeautifulSoup

log = structlog.get_logger()

_TIMEOUT = 10.0
_URL = "https://fssai.gov.in/notifications.php"
_GAZETTE_CATEGORY = "5"  # "Gazette Notification" -- finalized regulations
_MAX_NOTICES = 5

# "<bullet char(s)> Title text [Uploaded on : DD-MM-YYYY]" -- the bullet is an
# HTML entity (BeautifulSoup decodes it to a real unicode char), stripped via
# a broad non-alphanumeric prefix rather than hardcoding the exact character.
_NOTICE_RE = re.compile(r"[^A-Za-z0-9]*(?P<title>.+?)\s*\[Uploaded on\s*:\s*(?P<date>[\d-]+)\]")


class ComplianceAlertsService:
    """Live FSSAI regulatory notice digest. get_alerts() is the only public method."""

    async def get_alerts(self) -> Optional[dict]:
        try:
            return await self._get_alerts()
        except Exception as exc:
            log.warning("compliance_alerts_service_error", error=str(exc))
            return None

    async def _get_alerts(self) -> Optional[dict]:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                _URL,
                params={"notification": _GAZETTE_CATEGORY},
                headers={"User-Agent": "Mozilla/5.0"},
            )
            resp.raise_for_status()

        notices = self._parse_notices(resp.text)
        if not notices:
            return None

        return {
            "notices": notices,
            "notice_count": len(notices),
            "prompt_text": self._build_prompt(notices),
            "fetched_at": date.today().isoformat(),
        }

    def _parse_notices(self, html: str) -> list[dict]:
        soup = BeautifulSoup(html, "html.parser")
        notices = []
        for group in soup.select("div.grouptr12")[:_MAX_NOTICES]:
            strong = group.find("strong")
            if not strong:
                continue
            match = _NOTICE_RE.match(strong.get_text(" ", strip=True))
            if not match:
                continue
            link = group.find("a", href=True)
            notices.append({
                "title":       match.group("title").strip(),
                "uploaded_on": match.group("date").strip(),
                "url":         link["href"] if link else "",
            })
        return notices

    def _build_prompt(self, notices: list[dict]) -> str:
        lines = ["## Regulatory Alerts (FSSAI)"]
        for n in notices:
            lines.append(f"- {n['title']} (uploaded {n['uploaded_on']})")
        return "\n".join(lines)
