from __future__ import annotations

import logging
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Awaitable, Callable

from graph.prompt_budget import (
    PersistedPromptBudgetEstimate,
    estimate_persisted_prompt_budget,
)
from graph.prompt_builder import build_system_prompt

logger = logging.getLogger(__name__)

REQUIRED_SUMMARY_SECTIONS = (
    "Current goal",
    "Confirmed facts",
    "Key decisions",
    "Completed work",
    "Open issues",
    "Next steps",
)


@dataclass(frozen=True)
class CompressionResult:
    session_id: str
    reason: str
    summary: str
    pre_compress_tokens: int
    post_compress_tokens: int
    target_budget_tokens: int
    compressed_message_count: int
    kept_recent_turn_count: int
    degraded: bool = False

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class CompressionPlan:
    archived_messages: list[dict[str, Any]]
    kept_messages: list[dict[str, Any]]
    kept_recent_turn_count: int


class ContextCompressor:
    def __init__(
        self,
        *,
        session_manager: Any,
        base_dir: Path,
        rag_mode_getter: Callable[[], bool],
        target_budget_tokens: int,
        keep_recent_turns: int,
        summary_max_chars: int,
        summarizer: Callable[[str, list[dict[str, Any]]], Awaitable[str]],
    ) -> None:
        self.session_manager = session_manager
        self.base_dir = base_dir
        self.rag_mode_getter = rag_mode_getter
        self.target_budget_tokens = target_budget_tokens
        self.keep_recent_turns = keep_recent_turns
        self.summary_max_chars = summary_max_chars
        self.summarizer = summarizer

    async def compress_if_needed(
        self,
        session_id: str,
        reason: str = "prompt_tokens_exceeded",
    ) -> CompressionResult | None:
        record = self.session_manager.get_history(session_id)
        pre_estimate = self._estimate_budget(record)
        if pre_estimate.total_tokens <= self.target_budget_tokens:
            return None

        try:
            return await self.force_compress(session_id=session_id, reason=reason)
        except Exception:
            logger.exception("Automatic compression failed for session %s", session_id)
            return None

    async def force_compress(
        self,
        session_id: str,
        reason: str = "manual_request",
    ) -> CompressionResult:
        record = self.session_manager.get_history(session_id)
        messages = list(record.get("messages", []))
        pre_estimate = self._estimate_budget(record)
        plan = self._plan_for_reason(messages, reason)
        if not plan.archived_messages:
            raise ValueError("No eligible message window available for compression")

        previous_summary = str(record.get("compressed_context", "") or "").strip()
        summary = await self.summarizer(previous_summary, plan.archived_messages)
        fresh_summary, degraded = self._normalize_summary(
            summary,
            previous_summary,
            plan.archived_messages,
        )

        updated_record = dict(record)
        updated_record["compressed_context"] = fresh_summary
        updated_record["messages"] = list(plan.kept_messages)
        post_estimate = self._estimate_budget(updated_record)

        applied_at = time.time()
        self.session_manager.apply_compression(
            session_id=session_id,
            fresh_summary=fresh_summary,
            kept_messages=plan.kept_messages,
            archived_messages=plan.archived_messages,
            compression_state={
                "version": 1,
                "updated_at": applied_at,
                "trigger_reason": reason,
                "pre_compress_tokens": pre_estimate.total_tokens,
                "post_compress_tokens": post_estimate.total_tokens,
                "target_budget_tokens": self.target_budget_tokens,
                "kept_recent_turn_count": plan.kept_recent_turn_count,
                "compressed_message_count": len(plan.archived_messages),
                "degraded": degraded,
            },
            compression_event={
                "timestamp": applied_at,
                "reason": reason,
                "summary": fresh_summary,
                "pre_compress_tokens": pre_estimate.total_tokens,
                "post_compress_tokens": post_estimate.total_tokens,
                "target_budget_tokens": self.target_budget_tokens,
                "compressed_message_count": len(plan.archived_messages),
                "kept_recent_turn_count": plan.kept_recent_turn_count,
                "degraded": degraded,
            },
        )

        return CompressionResult(
            session_id=session_id,
            reason=reason,
            summary=fresh_summary,
            pre_compress_tokens=pre_estimate.total_tokens,
            post_compress_tokens=post_estimate.total_tokens,
            target_budget_tokens=self.target_budget_tokens,
            compressed_message_count=len(plan.archived_messages),
            kept_recent_turn_count=plan.kept_recent_turn_count,
            degraded=degraded,
        )

    def _estimate_budget(self, record: dict[str, Any]) -> PersistedPromptBudgetEstimate:
        system_prompt = build_system_prompt(self.base_dir, self.rag_mode_getter())
        return estimate_persisted_prompt_budget(system_prompt=system_prompt, record=record)

    def _plan_for_reason(self, messages: list[dict[str, Any]], reason: str) -> CompressionPlan:
        automatic_plan = self._plan_compression(messages)
        if reason != "manual_request":
            return automatic_plan
        if not messages:
            return automatic_plan
        if not automatic_plan.archived_messages or self._has_incomplete_tail(messages):
            return CompressionPlan(
                archived_messages=list(messages),
                kept_messages=[],
                kept_recent_turn_count=0,
            )
        return automatic_plan

    def _plan_compression(self, messages: list[dict[str, Any]]) -> CompressionPlan:
        turns = self._group_turns(messages)
        if not turns:
            return CompressionPlan(archived_messages=[], kept_messages=[], kept_recent_turn_count=0)

        kept_turn_count = min(self.keep_recent_turns, len(turns))
        if kept_turn_count <= 0:
            return CompressionPlan(
                archived_messages=list(messages),
                kept_messages=[],
                kept_recent_turn_count=0,
            )
        if kept_turn_count >= len(turns):
            return CompressionPlan(
                archived_messages=[],
                kept_messages=list(messages),
                kept_recent_turn_count=kept_turn_count,
            )

        split_turn_index = len(turns) - kept_turn_count
        split_index = sum(len(turn) for turn in turns[:split_turn_index])
        return CompressionPlan(
            archived_messages=list(messages[:split_index]),
            kept_messages=list(messages[split_index:]),
            kept_recent_turn_count=kept_turn_count,
        )

    def _group_turns(self, messages: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
        turns: list[list[dict[str, Any]]] = []
        current_turn: list[dict[str, Any]] = []

        for message in messages:
            role = str(message.get("role", ""))
            if role == "user":
                if current_turn:
                    turns.append(current_turn)
                current_turn = [message]
                continue
            if not current_turn:
                current_turn = [message]
                continue
            current_turn.append(message)

        if current_turn:
            turns.append(current_turn)
        return turns

    def _has_incomplete_tail(self, messages: list[dict[str, Any]]) -> bool:
        turns = self._group_turns(messages)
        if not turns:
            return False
        return str(turns[-1][-1].get("role", "")) == "user"

    def _normalize_summary(
        self,
        summary: str,
        previous_summary: str,
        archived_messages: list[dict[str, Any]],
    ) -> tuple[str, bool]:
        previous_sections = self._parse_sections(previous_summary)
        summary_sections = self._parse_sections(summary)
        degraded = False
        normalized_lines: list[str] = []

        for title in REQUIRED_SUMMARY_SECTIONS:
            content = summary_sections.get(title, "").strip()
            if not content:
                degraded = True
                content = previous_sections.get(title, "").strip()
            if not content:
                degraded = True
                content = self._default_section_content(title, archived_messages)
            normalized_lines.extend((f"## {title}", content))

        normalized_summary = "\n".join(normalized_lines).strip()
        return normalized_summary[: self.summary_max_chars], degraded

    def _parse_sections(self, text: str) -> dict[str, str]:
        sections: dict[str, list[str]] = {}
        current_title = ""

        for raw_line in text.splitlines():
            line = raw_line.rstrip()
            if line.startswith("## "):
                candidate = line[3:].strip()
                if candidate in REQUIRED_SUMMARY_SECTIONS:
                    current_title = candidate
                    sections.setdefault(candidate, [])
                    continue
            if current_title:
                sections[current_title].append(line)

        return {
            title: "\n".join(lines).strip()
            for title, lines in sections.items()
        }

    def _default_section_content(
        self,
        title: str,
        archived_messages: list[dict[str, Any]],
    ) -> str:
        transcript = self._archived_transcript(archived_messages)
        if title in {"Current goal", "Open issues"}:
            return transcript or "Not provided."
        return "Not provided."

    def _archived_transcript(self, archived_messages: list[dict[str, Any]]) -> str:
        lines: list[str] = []
        for item in archived_messages:
            role = str(item.get("role", "assistant"))
            content = str(item.get("content", "") or "").strip()
            if content:
                lines.append(f"{role}: {content}")
        return "\n".join(lines)
