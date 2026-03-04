"""
Tests for LLMs/utils/api_utils.py functions.

Tests the track_api_call() function's retry logic and response handling
using mocked async API calls.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'LLMs'))


@pytest.mark.asyncio
class TestTrackApiCall:
    """Test the track_api_call() function."""

    async def test_track_api_call_success(self):
        """Successful API call should return status=1 with timing and cost info."""
        from utils.api_utils import track_api_call

        # Create a mock API call that succeeds
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content='Response text'))]
        mock_response.usage = MagicMock(
            prompt_tokens=10,
            completion_tokens=20,
            total_tokens=30
        )

        async def mock_api_call():
            return mock_response

        def mock_response_extractor(resp):
            return 'Response text'

        def mock_token_extractor(resp):
            return {
                'prompt_tokens': 10,
                'completion_tokens': 20,
                'total_tokens': 30
            }

        # Mock the tokencost functions
        with patch('utils.api_utils.calculate_prompt_cost', return_value=0.001):
            with patch('utils.api_utils.calculate_completion_cost', return_value=0.002):
                result = await track_api_call(
                    api_call_func=mock_api_call,
                    model_name='gpt-4o-mini',
                    prompt_content='Test prompt',
                    response_extractor=mock_response_extractor,
                    token_extractor=mock_token_extractor,
                    agent_type='generator',
                    round_id=None
                )

        assert result['status'] == 1
        assert 'latency_ms' in result
        assert 'api_cost' in result
        assert 'token_usage' in result
        assert result['token_usage']['total_tokens'] == 30

    async def test_track_api_call_retries_on_failure(self):
        """API call should retry on failure."""
        from utils.api_utils import track_api_call

        call_count = 0

        async def mock_api_call():
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise ValueError("First call fails")
            # Second call succeeds
            mock_response = MagicMock()
            mock_response.choices = [MagicMock(message=MagicMock(content='Success'))]
            mock_response.usage = MagicMock(
                prompt_tokens=10,
                completion_tokens=20,
                total_tokens=30
            )
            return mock_response

        def mock_response_extractor(resp):
            return 'Success'

        def mock_token_extractor(resp):
            return {'prompt_tokens': 10, 'completion_tokens': 20, 'total_tokens': 30}

        # Mock the tokencost functions
        with patch('utils.api_utils.calculate_prompt_cost', return_value=0.001):
            with patch('utils.api_utils.calculate_completion_cost', return_value=0.002):
                result = await track_api_call(
                    api_call_func=mock_api_call,
                    model_name='gpt-4o-mini',
                    prompt_content='Test',
                    response_extractor=mock_response_extractor,
                    token_extractor=mock_token_extractor,
                    agent_type='detector',
                    max_retries=3
                )

        # Should have retried and succeeded
        assert call_count == 2
        assert result['status'] == 1

    async def test_track_api_call_exhausts_retries(self):
        """All retries exhausted should return status=0."""
        from utils.api_utils import track_api_call

        async def mock_api_call():
            raise ValueError("Always fails")

        def mock_response_extractor(resp):
            return 'N/A'

        def mock_token_extractor(resp):
            return {'prompt_tokens': 0, 'completion_tokens': 0, 'total_tokens': 0}

        result = await track_api_call(
            api_call_func=mock_api_call,
            model_name='test-model',
            prompt_content='Test',
            response_extractor=mock_response_extractor,
            token_extractor=mock_token_extractor,
            agent_type='generator',
            max_retries=2
        )

        assert result['status'] == 0
        assert 'error' in result

    async def test_track_api_call_max_retries_1(self):
        """max_retries=1 means no retries, just try once."""
        from utils.api_utils import track_api_call

        call_count = 0

        async def mock_api_call():
            nonlocal call_count
            call_count += 1
            raise ValueError("Fails")

        def mock_response_extractor(resp):
            return 'N/A'

        def mock_token_extractor(resp):
            return {'prompt_tokens': 0, 'completion_tokens': 0, 'total_tokens': 0}

        result = await track_api_call(
            api_call_func=mock_api_call,
            model_name='test-model',
            prompt_content='Test',
            response_extractor=mock_response_extractor,
            token_extractor=mock_token_extractor,
            agent_type='generator',
            max_retries=1
        )

        # Should only have called once (no retries)
        assert call_count == 1
        assert result['status'] == 0

    async def test_track_api_call_no_round_id(self):
        """With round_id=None, save_api_call should not be called."""
        from utils.api_utils import track_api_call

        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content='Text'))]
        mock_response.usage = MagicMock(
            prompt_tokens=10,
            completion_tokens=20,
            total_tokens=30
        )

        async def mock_api_call():
            return mock_response

        def mock_response_extractor(resp):
            return 'Text'

        def mock_token_extractor(resp):
            return {'prompt_tokens': 10, 'completion_tokens': 20, 'total_tokens': 30}

        # Mock db_utils.save_api_call to verify it's not called
        with patch('utils.db_utils.save_api_call') as mock_save:
            with patch('utils.api_utils.calculate_prompt_cost', return_value=0.001):
                with patch('utils.api_utils.calculate_completion_cost', return_value=0.002):
                    result = await track_api_call(
                        api_call_func=mock_api_call,
                        model_name='gpt-4o-mini',
                        prompt_content='Test',
                        response_extractor=mock_response_extractor,
                        token_extractor=mock_token_extractor,
                        agent_type='generator',
                        round_id=None
                    )

            # save_api_call should not have been called
            mock_save.assert_not_called()
            assert result['status'] == 1

    async def test_track_api_call_with_round_id(self):
        """With round_id, save_api_call should be called."""
        from utils.api_utils import track_api_call

        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content='Text'))]
        mock_response.usage = MagicMock(
            prompt_tokens=10,
            completion_tokens=20,
            total_tokens=30
        )

        async def mock_api_call():
            return mock_response

        def mock_response_extractor(resp):
            return 'Text'

        def mock_token_extractor(resp):
            return {'prompt_tokens': 10, 'completion_tokens': 20, 'total_tokens': 30}

        # Mock db_utils.save_api_call and tokencost functions
        with patch('utils.db_utils.save_api_call') as mock_save:
            with patch('utils.api_utils.calculate_prompt_cost', return_value=0.001):
                with patch('utils.api_utils.calculate_completion_cost', return_value=0.002):
                    result = await track_api_call(
                        api_call_func=mock_api_call,
                        model_name='gpt-4o-mini',
                        prompt_content='Test prompt',
                        response_extractor=mock_response_extractor,
                        token_extractor=mock_token_extractor,
                        agent_type='generator',
                        round_id=42
                    )

            # save_api_call should have been called with correct args
            mock_save.assert_called_once()
            call_kwargs = mock_save.call_args[1]
            assert call_kwargs['round_id'] == 42
            assert call_kwargs['agent_type'] == 'generator'
            assert call_kwargs['model_name'] == 'gpt-4o-mini'
            assert result['status'] == 1


# Pytest fixture to handle asyncio
@pytest.fixture
def event_loop():
    """Create an event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()
