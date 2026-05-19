from __future__ import annotations

import unittest

from graph.prompt_budget import (
    PersistedPromptBudgetEstimate,
    count_text_tokens,
    estimate_persisted_prompt_budget,
    serialize_persisted_payload,
)


class PromptBudgetTests(unittest.TestCase):
    def test_estimator_counts_compressed_context(self):
        system_prompt = "system instructions"
        compressed_context = "compressed summary"
        record = {
            "compressed_context": compressed_context,
            "messages": [{"role": "user", "content": "hello"}],
        }

        result = estimate_persisted_prompt_budget(system_prompt=system_prompt, record=record)

        self.assertIsInstance(result, PersistedPromptBudgetEstimate)
        self.assertEqual(result.system_tokens, count_text_tokens(system_prompt))
        self.assertEqual(result.compressed_context_tokens, count_text_tokens(compressed_context))
        self.assertEqual(result.message_tokens, count_text_tokens("hello"))
        self.assertEqual(
            result.total_tokens,
            result.system_tokens + result.compressed_context_tokens + result.message_tokens,
        )

    def test_estimator_handles_empty_payload_lists(self):
        system_prompt = "system"
        record = {
            "compressed_context": "",
            "messages": [
                {
                    "role": "assistant",
                    "content": "answer",
                    "tool_calls": [],
                    "retrieval_steps": [],
                }
            ],
        }

        result = estimate_persisted_prompt_budget(
            system_prompt=system_prompt,
            record=record,
            current_message={"content": ""},
        )

        self.assertEqual(result.compressed_context_tokens, 0)
        self.assertEqual(result.message_tokens, count_text_tokens("answer"))
        self.assertEqual(result.current_message_tokens, 0)
        self.assertEqual(result.total_tokens, result.system_tokens + result.message_tokens)

    def test_estimator_counts_tool_calls_retrieval_steps_and_current_message(self):
        tool_call = {
            "name": "tool",
            "arguments": {"b": [2, 1], "a": True},
        }
        retrieval_step = {
            "status": "ok",
            "scores": [0.2, 0.1],
        }
        current_message = {
            "content": {"query": "latest status", "turn": 3},
            "tool_calls": [{"id": 7, "name": "lookup"}],
            "retrieval_steps": [{"kind": "memory", "rank": 1}],
        }
        record = {
            "compressed_context": "",
            "messages": [
                {
                    "content": "answer",
                    "tool_calls": [tool_call],
                    "retrieval_steps": [retrieval_step],
                }
            ],
        }

        result = estimate_persisted_prompt_budget(
            system_prompt="system",
            record=record,
            current_message=current_message,
        )

        expected_message_tokens = (
            count_text_tokens("answer")
            + count_text_tokens(serialize_persisted_payload(tool_call))
            + count_text_tokens(serialize_persisted_payload(retrieval_step))
        )
        expected_current_message_tokens = (
            count_text_tokens(serialize_persisted_payload(current_message["content"]))
            + count_text_tokens(serialize_persisted_payload(current_message["tool_calls"][0]))
            + count_text_tokens(serialize_persisted_payload(current_message["retrieval_steps"][0]))
        )
        self.assertEqual(result.message_tokens, expected_message_tokens)
        self.assertEqual(result.current_message_tokens, expected_current_message_tokens)
        self.assertEqual(
            result.total_tokens,
            result.system_tokens + result.message_tokens + result.current_message_tokens,
        )

    def test_estimator_handles_missing_messages_and_non_string_values(self):
        record = {
            "compressed_context": 123,
        }

        result = estimate_persisted_prompt_budget(
            system_prompt="system",
            record=record,
            current_message={"content": ["x", {"a": 1}]},
        )

        self.assertEqual(result.message_tokens, 0)
        self.assertEqual(result.compressed_context_tokens, count_text_tokens("123"))
        self.assertEqual(
            result.current_message_tokens,
            count_text_tokens(serialize_persisted_payload(["x", {"a": 1}])),
        )

    def test_payload_serialization_is_deterministic_for_nested_values(self):
        payload = {"z": 1, "a": {"d": 4, "c": [3, 2]}, "b": False}

        self.assertEqual(
            serialize_persisted_payload(payload),
            '{"a":{"c":[3,2],"d":4},"b":false,"z":1}',
        )


if __name__ == "__main__":
    unittest.main()
