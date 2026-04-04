import pytest
import asyncio
import sys
import os

# Load env variables
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.infrastructure.llm.gemini import GeminiProvider


@pytest.mark.asyncio
async def test_gemini_complete():
    """Test basic text completion."""
    provider = GeminiProvider()
    response = await provider.complete(
        prompt="In one sentence, what is a pizza?",
        system_prompt="You are a helpful assistant."
    )
    print(f"\nGemini response: {response}")
    assert response is not None
    assert len(response) > 0


@pytest.mark.asyncio
async def test_gemini_complete_json():
    """Test JSON completion."""
    provider = GeminiProvider()
    response = await provider.complete_json(
        prompt="Give me a recommendation to reduce food waste in a restaurant.",
        system_prompt="You are a restaurant operations manager."
    )
    print(f"\nJSON response: {response}")
    assert isinstance(response, dict)
    assert "recommendation" in response or len(response) > 0