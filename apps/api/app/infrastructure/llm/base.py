from abc import ABC, abstractmethod
from threading import Lock

# Approximate cost rates per 1M tokens (USD) — update as pricing changes
_COST_PER_1M = {
    "gemini-2.5-flash":        {"input": 0.075, "output": 0.30},
    "llama-3.3-70b-versatile": {"input": 0.59,  "output": 0.79},
}


def _calc_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    rates = _COST_PER_1M.get(model, {"input": 0.0, "output": 0.0})
    return round(
        (prompt_tokens  / 1_000_000) * rates["input"] +
        (completion_tokens / 1_000_000) * rates["output"],
        6,
    )


class BaseLLMProvider(ABC):
    """Abstract base for all LLM providers.
    Agents always depend on this interface — never on a concrete provider.
    """

    def __init__(self) -> None:
        self._usage_records: list[dict] = []
        self._lock = Lock()
        self.provider_name = self.__class__.__name__.removesuffix("Provider").lower()
        self.model = "unknown"

    def record_usage(self, model: str, prompt_tokens: int, completion_tokens: int) -> None:
        """Called by concrete providers after every LLM call."""
        record = {
            "provider": self.provider_name,
            "model": model,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "cost_usd": _calc_cost(model, prompt_tokens, completion_tokens),
        }
        with self._lock:
            self._usage_records.append(record)

    def drain_usage(self) -> list[dict]:
        """Return all accumulated usage records and clear the buffer."""
        with self._lock:
            records = self._usage_records.copy()
            self._usage_records.clear()
        return records

    @abstractmethod
    async def complete(self, prompt: str, system_prompt: str | None = None) -> str:
        """Send a prompt to the LLM and return the text response."""

    @abstractmethod
    async def complete_json(self, prompt: str, system_prompt: str | None = None) -> dict:
        """Send a prompt and return a parsed JSON response."""
