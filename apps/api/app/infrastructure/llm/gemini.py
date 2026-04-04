from google import genai
from google.genai import types
import json
import os

from app.infrastructure.llm.base import BaseLLMProvider


class GeminiProvider(BaseLLMProvider):
    """Gemini LLM provider using the google-genai SDK."""

    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not set in environment variables.")
        self.client = genai.Client(api_key=api_key)
        self.model = "gemini-2.5-flash"

    async def complete(self, prompt: str, system_prompt: str = None) -> str:
        """Send a prompt to Gemini and return text response."""
        contents = []

        if system_prompt:
            contents.append(
                types.Content(
                    role="user",
                    parts=[types.Part(text=f"{system_prompt}\n\n{prompt}")]
                )
            )
        else:
            contents.append(
                types.Content(
                    role="user",
                    parts=[types.Part(text=prompt)]
                )
            )

        response = self.client.models.generate_content(
            model=self.model,
            contents=contents,
        )
        return response.text

    async def complete_json(self, prompt: str, system_prompt: str = None) -> dict:
        """Send a prompt to Gemini and return parsed JSON response."""
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