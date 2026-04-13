from abc import ABC, abstractmethod

class BaseLLMProvider(ABC):
    """Abstract base class for all LLM providers.
    Every provider must implement the complete method.
    Agents never import a specific provider — always use this interface.
    """

    @abstractmethod
    async def complete(self, prompt: str, system_prompt: str = None) -> str:
        """Send a prompt to the LLM and return the text response."""
        pass

    @abstractmethod
    async def complete_json(self, prompt: str, system_prompt: str = None) -> dict:
        """Send a prompt and return a parsed JSON response."""
        pass