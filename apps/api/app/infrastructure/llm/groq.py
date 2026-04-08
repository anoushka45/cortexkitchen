import json
import os

from app.infrastructure.llm.base import BaseLLMProvider


class GroqProvider(BaseLLMProvider):
    """
    Groq LLM provider using the groq SDK.
    Free tier — much higher rate limits than Gemini free tier.

    Get your key at: https://console.groq.com
    Set GROQ_API_KEY in your .env file.
    """

    def __init__(self):
        from groq import Groq

        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY is not set in environment variables.")

        self.client = Groq(api_key=api_key)
        self.model = "llama-3.3-70b-versatile"  # best free model on Groq for reasoning

    async def complete(self, prompt: str, system_prompt: str = None) -> str:
        """Send a prompt to Groq and return text response."""
        messages = []

        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        messages.append({"role": "user", "content": prompt})

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
        )
        return response.choices[0].message.content

    async def complete_json(self, prompt: str, system_prompt: str = None) -> dict:
        """Send a prompt to Groq and return parsed JSON response."""
        json_system = "You must respond with valid JSON only. No explanation, no markdown, no backticks."
        combined_system = f"{json_system}\n{system_prompt}" if system_prompt else json_system

        raw = await self.complete(prompt, system_prompt=combined_system)

        # Strip markdown code fences if present
        clean = raw.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        clean = clean.strip()

        return json.loads(clean)