from __future__ import annotations

import unittest
from unittest.mock import AsyncMock

from api.chat import _collect_post_turn_events


class ChatPostTurnCompressionTests(unittest.IsolatedAsyncioTestCase):
    async def test_collects_title_then_compression_then_done(self):
        title_mock = AsyncMock(return_value="压缩测试")
        compression_mock = AsyncMock(
            return_value={
                "session_id": "s1",
                "reason": "prompt_tokens_exceeded",
                "summary": "## Current goal\nkeep context",
                "pre_compress_tokens": 26_000,
                "post_compress_tokens": 18_000,
                "target_budget_tokens": 24_000,
                "compressed_message_count": 4,
                "kept_recent_turn_count": 2,
                "degraded": False,
            }
        )
        seen_titles: list[tuple[str, str]] = []

        events = await _collect_post_turn_events(
            session_id="s1",
            request_message="hello",
            done_payload={"content": "final answer"},
            is_first_user_message=True,
            generate_title=title_mock,
            set_title=lambda session_id, title: seen_titles.append((session_id, title)),
            maybe_compress=compression_mock,
        )

        self.assertEqual([event["type"] for event in events], ["title", "compression", "done"])
        self.assertEqual(events[-1]["content"], "final answer")
        self.assertEqual(seen_titles, [("s1", "压缩测试")])

    async def test_done_is_still_last_when_no_compression_happens(self):
        events = await _collect_post_turn_events(
            session_id="s2",
            request_message="hello",
            done_payload={"content": "final answer"},
            is_first_user_message=False,
            generate_title=AsyncMock(),
            set_title=lambda *_args, **_kwargs: None,
            maybe_compress=AsyncMock(return_value=None),
        )

        self.assertEqual([event["type"] for event in events], ["done"])


if __name__ == "__main__":
    unittest.main()
