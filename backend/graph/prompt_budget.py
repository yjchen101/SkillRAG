from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import tiktoken

ENCODER = tiktoken.get_encoding("cl100k_base")


@dataclass(frozen=True)
class PersistedPromptBudgetEstimate:
    """Approximate token usage from persisted session fields, not wire-format prompt accounting."""

    system_tokens: int
    compressed_context_tokens: int
    message_tokens: int
    current_message_tokens: int
    total_tokens: int


def serialize_persisted_payload(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, (dict, list, tuple, bool, int, float)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return str(value)


def count_text_tokens(text: Any) -> int:
    return len(ENCODER.encode(serialize_persisted_payload(text)))


def _count_message_tokens(message: dict[str, Any] | None) -> int:
    if not message:
        return 0

    total = count_text_tokens(message.get("content", ""))
    for tool_call in message.get("tool_calls") or []:
        total += count_text_tokens(tool_call)
    for retrieval_step in message.get("retrieval_steps") or []:
        total += count_text_tokens(retrieval_step)
    return total


def estimate_persisted_prompt_budget(
    *,
    system_prompt: str,
    record: dict[str, Any],
    current_message: dict[str, Any] | None = None,
) -> PersistedPromptBudgetEstimate:
    """Estimate prompt tokens from persisted session content only."""

    compressed_context_tokens = count_text_tokens(record.get("compressed_context", ""))
    message_tokens = 0
    for message in record.get("messages") or []:
        message_tokens += _count_message_tokens(message)

    current_message_tokens = _count_message_tokens(current_message)
    system_tokens = count_text_tokens(system_prompt)
    total_tokens = system_tokens + compressed_context_tokens + message_tokens + current_message_tokens
    return PersistedPromptBudgetEstimate(
        system_tokens=system_tokens,
        compressed_context_tokens=compressed_context_tokens,
        message_tokens=message_tokens,
        current_message_tokens=current_message_tokens,
        total_tokens=total_tokens,
    )
