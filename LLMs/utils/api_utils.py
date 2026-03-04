"""
API utilities for LLM services.

Provides generalized functions for API call tracking, cost calculation, and logging.

Usage Example:
--------------
For any agent using async API calls:

    from utils.api_utils import track_api_call, extract_openai_response, extract_openai_tokens

    # Define your API call
    async def make_api_call():
        return await self.entity.client.chat.completions.create(...)

    # Track the call with automatic timing, cost calculation, and DB logging
    api_result = await track_api_call(
        api_call_func=make_api_call,
        model_name=self.entity.model,
        prompt_content=prompt,
        response_extractor=extract_openai_response,
        token_extractor=extract_openai_tokens,
        agent_type="generator",
        round_id=round_id  # Optional, for database logging
    )

    # Use the standardized result
    if api_result["status"] == 1:
        response_text = api_result["response"]
        cost = api_result["api_cost"]
        tokens = api_result["token_usage"]
        # ... handle success
    else:
        error = api_result["error"]
        # ... handle error

This utility handles:
- Timing the API call (in seconds and milliseconds)
- Extracting tokens from provider-specific response formats
- Calculating costs using tokencost library
- Automatically logging to database if round_id provided
- Standardizing the response format across all agents
"""

import asyncio
import time
from typing import Dict, Any, Optional, Callable, Awaitable
from tokencost import calculate_prompt_cost, calculate_completion_cost


async def track_api_call(
    api_call_func: Callable[..., Awaitable[Any]],
    model_name: str,
    prompt_content: Any,
    response_extractor: Callable[[Any], str],
    token_extractor: Callable[[Any], Dict[str, int]],
    agent_type: str,
    round_id: Optional[int] = None,
    max_retries: int = 3
) -> Dict[str, Any]:
    """
    Generic wrapper for tracking API calls with timing, cost calculation, and logging.

    Includes exponential backoff retry logic for transient failures.

    Args:
        api_call_func: Async function that makes the API call
        model_name: Name of the model being used
        prompt_content: Content used for prompt cost calculation (string or messages)
        response_extractor: Function to extract text response from API response
        token_extractor: Function to extract token usage dict from API response
        agent_type: Type of agent (generator, detector)
        round_id: Optional round ID for database logging
        max_retries: Number of retry attempts (default: 3)

    Returns:
        dict: Standardized result with status, timing, cost, tokens, and response
    """
    from .db_utils import save_api_call

    last_error = None
    for attempt in range(max_retries):
        try:
            # Time the API call
            start_time = time.perf_counter()
            response = await api_call_func()
            end_time = time.perf_counter()

            # Calculate timing
            total_time = end_time - start_time
            latency_ms = int(total_time * 1000)

            # Extract response text and tokens
            response_text = response_extractor(response)
            token_usage = token_extractor(response)

            # Calculate costs using tokencost
            prompt_cost = calculate_prompt_cost(prompt_content, model_name)
            completion_cost = calculate_completion_cost(response_text, model_name)
            total_api_cost = prompt_cost + completion_cost

            # Log to database if round_id provided
            if round_id is not None:
                save_api_call(
                    round_id=round_id,
                    agent_type=agent_type,
                    model_name=model_name,
                    token_used=token_usage["total_tokens"],
                    cost=total_api_cost,
                    latency_ms=latency_ms,
                    email_id=None
                )

            return {
                "status": 1,
                "inference_time_seconds": total_time,
                "latency_ms": latency_ms,
                "api_cost": total_api_cost,
                "token_usage": token_usage,
                "response": response_text,
                "raw_response": response
            }

        except Exception as e:
            last_error = e
            # Retry with exponential backoff if not the last attempt
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # 1s, 2s, 4s
                await asyncio.sleep(wait_time)

    # All retries exhausted
    return {
        "status": 0,
        "error": str(last_error)
    }


def extract_openai_response(response: Any) -> str:
    """Extract text response from OpenAI API response."""
    return response.choices[0].message.content


def extract_openai_tokens(response: Any) -> Dict[str, int]:
    """Extract token usage from OpenAI API response."""
    return {
        "prompt_tokens": response.usage.prompt_tokens,
        "completion_tokens": response.usage.completion_tokens,
        "total_tokens": response.usage.total_tokens
    }


def extract_anthropic_response(response: Any) -> str:
    """Extract text response from Anthropic API response."""
    return response.content[0].text


def extract_anthropic_tokens(response: Any) -> Dict[str, int]:
    """Extract token usage from Anthropic API response."""
    return {
        "prompt_tokens": response.usage.input_tokens,
        "completion_tokens": response.usage.output_tokens,
        "total_tokens": response.usage.input_tokens + response.usage.output_tokens
    }
