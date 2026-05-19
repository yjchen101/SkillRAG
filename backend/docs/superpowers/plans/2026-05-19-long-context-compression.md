# Long Context Compression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add post-turn automatic long-context compression that preserves recent raw turns, rewrites one fresh structured summary, fixes token accounting, and exposes compression events to the frontend.

**Architecture:** Introduce a shared prompt-budget estimator and a dedicated `ContextCompressor` so compression policy stays out of `SessionManager` and `api/chat.py`. After each turn is persisted, `api/chat.py` asks the compressor whether the saved session exceeds budget, emits a `compression` SSE event when needed, and keeps `done` as the final event. The frontend stores and renders compression history from session data plus live SSE updates.

**Tech Stack:** FastAPI, LangChain/OpenAI-compatible chat model wrappers, `unittest`, `tiktoken`, Next.js 14, React, TypeScript

---

## File Map

### Create

- `graph/prompt_budget.py`
  Centralized prompt-token estimation for session records and future-turn context.
- `graph/context_compressor.py`
  Compression policy, message window planning, summary regeneration, and result payload shaping.
- `tests/test_prompt_budget.py`
  Unit tests for token estimation and `compressed_context` accounting.
- `tests/test_context_compressor.py`
  Unit tests for post-turn compression behavior, archive writes, and failure safety.
- `tests/test_chat_post_turn_compression.py`
  Integration-style tests for `api/chat.py` post-turn hooks and SSE ordering.
- `../frontend/src/components/chat/CompressionCard.tsx`
  UI card that renders compression events and the structured summary.

### Modify

- `config.py`
  Add compression-related settings fields and defaults.
- `graph/agent.py`
  Expose structured compression summarization and wire a compressor instance into `AgentManager`.
- `graph/session_manager.py`
  Extend session schema with compression metadata and add a safe rewrite API.
- `api/tokens.py`
  Switch token counting to shared prompt-budget logic.
- `api/compress.py`
  Delegate manual compression to the shared compressor path instead of the legacy append flow.
- `api/chat.py`
  Run post-turn compression after persistence, reorder final SSE events, and log compression events.
- `../frontend/src/lib/api.ts`
  Add compression event/session types.
- `../frontend/src/lib/store.tsx`
  Store compression history from session history and live SSE events.
- `../frontend/src/components/chat/ChatPanel.tsx`
  Render the compression card in the conversation panel.

## Task 1: Shared Prompt Budget Estimator

**Files:**
- Create: `graph/prompt_budget.py`
- Create: `tests/test_prompt_budget.py`
- Modify: `config.py`
- Modify: `api/tokens.py`

- [ ] **Step 1: Write the failing prompt-budget tests**

```python
import tempfile
import unittest
from pathlib import Path

from graph.prompt_budget import estimate_session_prompt_tokens


class PromptBudgetTests(unittest.TestCase):
    def test_counts_system_summary_messages_and_payloads(self):
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = Path(tmp)
            (base_dir / "workspace").mkdir(parents=True)
            (base_dir / "workspace" / "SOUL.md").write_text("soul", encoding="utf-8")
            (base_dir / "workspace" / "IDENTITY.md").write_text("identity", encoding="utf-8")
            (base_dir / "workspace" / "USER.md").write_text("user", encoding="utf-8")
            (base_dir / "workspace" / "AGENTS.md").write_text("agents", encoding="utf-8")
            (base_dir / "memory").mkdir(parents=True)
            (base_dir / "memory" / "MEMORY.md").write_text("memory", encoding="utf-8")
            record = {
                "compressed_context": "Current goal: keep context small",
                "messages": [
                    {
                        "role": "user",
                        "content": "show me the status",
                    },
                    {
                        "role": "assistant",
                        "content": "done",
                        "tool_calls": [{"tool": "echo", "input": "{\"value\":\"ok\"}", "output": "ok"}],
                        "retrieval_steps": [{"title": "检索结果", "message": "matched"}],
                    },
                ],
            }

            breakdown = estimate_session_prompt_tokens(
                base_dir=base_dir,
                rag_mode=False,
                record=record,
                current_message="what next?",
            )

        self.assertGreater(breakdown.system_tokens, 0)
        self.assertGreater(breakdown.compressed_context_tokens, 0)
        self.assertGreater(breakdown.message_tokens, 0)
        self.assertGreater(breakdown.current_message_tokens, 0)
        self.assertEqual(
            breakdown.total_tokens,
            breakdown.system_tokens
            + breakdown.compressed_context_tokens
            + breakdown.message_tokens
            + breakdown.current_message_tokens,
        )

    def test_ignores_missing_summary_and_empty_payload_lists(self):
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = Path(tmp)
            (base_dir / "workspace").mkdir(parents=True)
            for name in ("SOUL.md", "IDENTITY.md", "USER.md", "AGENTS.md"):
                (base_dir / "workspace" / name).write_text(name, encoding="utf-8")
            (base_dir / "memory").mkdir(parents=True)
            (base_dir / "memory" / "MEMORY.md").write_text("memory", encoding="utf-8")
            record = {
                "messages": [{"role": "assistant", "content": "plain answer", "tool_calls": [], "retrieval_steps": []}],
            }

            breakdown = estimate_session_prompt_tokens(base_dir=base_dir, rag_mode=False, record=record)

        self.assertEqual(breakdown.compressed_context_tokens, 0)
        self.assertGreater(breakdown.message_tokens, 0)
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `uv run python -m unittest tests.test_prompt_budget -v`

Expected: `FAIL` with `ModuleNotFoundError: No module named 'graph.prompt_budget'`

- [ ] **Step 3: Write the minimal estimator and wire configuration**

```python
# graph/prompt_budget.py
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import tiktoken

from graph.prompt_builder import build_system_prompt

ENCODER = tiktoken.get_encoding("cl100k_base")


@dataclass(frozen=True)
class PromptTokenBreakdown:
    system_tokens: int
    compressed_context_tokens: int
    message_tokens: int
    current_message_tokens: int

    @property
    def total_tokens(self) -> int:
        return (
            self.system_tokens
            + self.compressed_context_tokens
            + self.message_tokens
            + self.current_message_tokens
        )


def count_text_tokens(text: str) -> int:
    return len(ENCODER.encode(text or ""))


def estimate_session_prompt_tokens(
    *,
    base_dir: Path,
    rag_mode: bool,
    record: dict[str, Any],
    current_message: str = "",
) -> PromptTokenBreakdown:
    system_prompt = build_system_prompt(base_dir, rag_mode)
    compressed_context = str(record.get("compressed_context", "") or "").strip()
    message_parts: list[str] = []
    for item in record.get("messages", []):
        message_parts.append(str(item.get("content", "")))
        for tool_call in item.get("tool_calls", []) or []:
            message_parts.append(str(tool_call))
        for retrieval_step in item.get("retrieval_steps", []) or []:
            message_parts.append(str(retrieval_step))
    return PromptTokenBreakdown(
        system_tokens=count_text_tokens(system_prompt),
        compressed_context_tokens=count_text_tokens(compressed_context),
        message_tokens=count_text_tokens("\n".join(message_parts)),
        current_message_tokens=count_text_tokens(current_message),
    )
```

```python
# config.py
@dataclass(frozen=True)
class Settings:
    backend_dir: Path
    project_root: Path
    llm_provider: str
    llm_model: str
    llm_api_key: str | None
    llm_base_url: str
    embedding_provider: str
    embedding_model: str
    embedding_api_key: str | None
    embedding_base_url: str
    compression_enabled: bool = True
    compression_target_budget_tokens: int = 24000
    compression_keep_recent_turns: int = 3
    compression_summary_max_chars: int = 1200


return Settings(
    backend_dir=backend_dir,
    project_root=project_root,
    llm_provider=llm_provider,
    llm_model=_resolve_llm_model(llm_provider),
    llm_api_key=_resolve_llm_api_key(llm_provider),
    llm_base_url=_resolve_llm_base_url(llm_provider),
    embedding_provider=embedding_provider,
    embedding_model=_resolve_embedding_model(embedding_provider),
    embedding_api_key=_resolve_embedding_api_key(embedding_provider),
    embedding_base_url=_resolve_embedding_base_url(embedding_provider),
    compression_enabled=_parse_bool(_first_config_value("COMPRESSION_ENABLED"), True),
    compression_target_budget_tokens=_parse_int(
        _first_config_value("COMPRESSION_TARGET_BUDGET_TOKENS"),
        24000,
    ),
    compression_keep_recent_turns=_parse_int(
        _first_config_value("COMPRESSION_KEEP_RECENT_TURNS"),
        3,
    ),
    compression_summary_max_chars=_parse_int(
        _first_config_value("COMPRESSION_SUMMARY_MAX_CHARS"),
        1200,
    ),
)
```

```python
# api/tokens.py
from graph.prompt_budget import estimate_session_prompt_tokens


@router.get("/tokens/session/{session_id}")
async def session_tokens(session_id: str) -> dict[str, int]:
    session_manager = agent_manager.session_manager
    if session_manager is None or agent_manager.base_dir is None:
        raise HTTPException(status_code=503, detail="Agent manager is not initialized")
    record = session_manager.get_history(session_id)
    breakdown = estimate_session_prompt_tokens(
        base_dir=agent_manager.base_dir,
        rag_mode=runtime_config.get_rag_mode(),
        record=record,
    )
    return {
        "system_tokens": breakdown.system_tokens,
        "compressed_context_tokens": breakdown.compressed_context_tokens,
        "message_tokens": breakdown.message_tokens,
        "total_tokens": breakdown.total_tokens,
    }
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `uv run python -m unittest tests.test_prompt_budget -v`

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add config.py api/tokens.py graph/prompt_budget.py tests/test_prompt_budget.py
git commit -m "feat: add shared prompt budget estimator"
```

## Task 2: Session Compression Persistence

**Files:**
- Modify: `graph/session_manager.py`
- Create: `tests/test_context_compressor.py`

- [ ] **Step 1: Write the failing session rewrite tests**

```python
import json
import tempfile
import unittest
from pathlib import Path

from graph.session_manager import SessionManager


class SessionCompressionPersistenceTests(unittest.TestCase):
    def test_default_record_includes_compression_metadata(self):
        with tempfile.TemporaryDirectory() as tmp:
            manager = SessionManager(Path(tmp))
            record = manager.create_session("demo")

        self.assertEqual(record["compressed_context"], "")
        self.assertEqual(record["compression_state"], {})
        self.assertEqual(record["compression_events"], [])

    def test_apply_compression_rewrites_summary_and_archives_messages(self):
        with tempfile.TemporaryDirectory() as tmp:
            manager = SessionManager(Path(tmp))
            record = manager.create_session("demo")
            session_id = str(record["id"])
            for role, content in [
                ("user", "goal"),
                ("assistant", "answer"),
                ("user", "follow up"),
                ("assistant", "details"),
            ]:
                manager.save_message(session_id, role, content)

            manager.apply_compression(
                session_id=session_id,
                summary="## Current goal\nkeep context",
                kept_messages=[{"role": "user", "content": "follow up"}, {"role": "assistant", "content": "details"}],
                archived_messages=[{"role": "user", "content": "goal"}, {"role": "assistant", "content": "answer"}],
                compression_state={"trigger_reason": "prompt_tokens_exceeded", "compressed_message_count": 2},
                compression_event={"reason": "prompt_tokens_exceeded", "summary": "## Current goal\nkeep context"},
            )

            saved = manager.get_history(session_id)
            archives = list((Path(tmp) / "sessions" / "archive").glob(f"{session_id}_*.json"))

        self.assertEqual(saved["compressed_context"], "## Current goal\nkeep context")
        self.assertEqual(len(saved["messages"]), 2)
        self.assertEqual(saved["compression_state"]["compressed_message_count"], 2)
        self.assertEqual(len(saved["compression_events"]), 1)
        self.assertEqual(len(archives), 1)
        archive_payload = json.loads(archives[0].read_text(encoding="utf-8"))
        self.assertEqual(len(archive_payload["messages"]), 2)
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `uv run python -m unittest tests.test_context_compressor.SessionCompressionPersistenceTests -v`

Expected: `FAIL` with `KeyError: 'compression_state'` and `AttributeError: 'SessionManager' object has no attribute 'apply_compression'`

- [ ] **Step 3: Implement safe session rewrite support**

```python
# graph/session_manager.py
def _default_record(self, session_id: str, title: str = "新会话") -> dict[str, Any]:
    now = time.time()
    return {
        "id": session_id,
        "title": title,
        "created_at": now,
        "updated_at": now,
        "compressed_context": "",
        "compression_state": {},
        "compression_events": [],
        "messages": [],
    }


def _read_session_file(self, session_id: str) -> dict[str, Any]:
    path = self._session_path(session_id)
    if not path.exists():
        record = self._default_record(session_id)
        self._write_session(record)
        return record
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, list):
        record = self._default_record(session_id)
        record["messages"] = raw
        self._write_session(record)
        return record
    raw.setdefault("id", session_id)
    raw.setdefault("title", "新会话")
    raw.setdefault("created_at", time.time())
    raw.setdefault("updated_at", raw["created_at"])
    raw.setdefault("compressed_context", "")
    raw.setdefault("compression_state", {})
    raw.setdefault("compression_events", [])
    raw.setdefault("messages", [])
    return raw


def apply_compression(
    self,
    *,
    session_id: str,
    summary: str,
    kept_messages: list[dict[str, Any]],
    archived_messages: list[dict[str, Any]],
    compression_state: dict[str, Any],
    compression_event: dict[str, Any],
) -> dict[str, Any]:
    record = self._read_session_file(session_id)
    archive_path = self.archive_dir / f"{session_id}_{int(time.time())}.json"
    archive_path.write_text(
        json.dumps(
            {
                "session_id": session_id,
                "archived_at": time.time(),
                "messages": archived_messages,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    record["compressed_context"] = summary.strip()
    record["messages"] = kept_messages
    record["compression_state"] = dict(compression_state)
    record.setdefault("compression_events", []).append(dict(compression_event))
    self._write_session(record)
    return record
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `uv run python -m unittest tests.test_context_compressor.SessionCompressionPersistenceTests -v`

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add graph/session_manager.py tests/test_context_compressor.py
git commit -m "feat: persist compression metadata in sessions"
```

## Task 3: Context Compressor and Manual Compression Endpoint

**Files:**
- Create: `graph/context_compressor.py`
- Modify: `graph/agent.py`
- Modify: `api/compress.py`
- Modify: `tests/test_context_compressor.py`

- [ ] **Step 1: Add failing compressor behavior tests**

```python
from unittest.mock import AsyncMock

from graph.context_compressor import ContextCompressor
from graph.session_manager import SessionManager


class ContextCompressorTests(unittest.IsolatedAsyncioTestCase):
    async def test_compress_if_needed_keeps_recent_turns_and_rebuilds_summary(self):
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = Path(tmp)
            (base_dir / "workspace").mkdir(parents=True)
            for name in ("SOUL.md", "IDENTITY.md", "USER.md", "AGENTS.md"):
                (base_dir / "workspace" / name).write_text(name, encoding="utf-8")
            (base_dir / "memory").mkdir(parents=True)
            (base_dir / "memory" / "MEMORY.md").write_text("memory", encoding="utf-8")
            manager = SessionManager(base_dir)
            session = manager.create_session("demo")
            session_id = str(session["id"])
            manager.save_message(session_id, "user", "turn 1")
            manager.save_message(session_id, "assistant", "turn 1 answer")
            manager.save_message(session_id, "user", "turn 2")
            manager.save_message(session_id, "assistant", "turn 2 answer")
            manager.save_message(session_id, "user", "turn 3")
            manager.save_message(session_id, "assistant", "turn 3 answer")

            compressor = ContextCompressor(
                session_manager=manager,
                base_dir=base_dir,
                rag_mode_getter=lambda: False,
                target_budget_tokens=1,
                keep_recent_turns=2,
                summary_max_chars=1200,
                summarizer=AsyncMock(return_value="## Current goal\nkeep the thread moving"),
            )

            result = await compressor.compress_if_needed(session_id)
            saved = manager.get_history(session_id)

        self.assertIsNotNone(result)
        self.assertEqual(saved["compressed_context"], "## Current goal\nkeep the thread moving")
        self.assertEqual(len(saved["messages"]), 4)
        self.assertEqual(saved["compression_state"]["kept_recent_turn_count"], 2)
        self.assertEqual(saved["compression_state"]["compressed_message_count"], 2)

    async def test_summary_failure_keeps_session_unchanged(self):
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = Path(tmp)
            (base_dir / "workspace").mkdir(parents=True)
            for name in ("SOUL.md", "IDENTITY.md", "USER.md", "AGENTS.md"):
                (base_dir / "workspace" / name).write_text(name, encoding="utf-8")
            (base_dir / "memory").mkdir(parents=True)
            (base_dir / "memory" / "MEMORY.md").write_text("memory", encoding="utf-8")
            manager = SessionManager(base_dir)
            session = manager.create_session("demo")
            session_id = str(session["id"])
            manager.save_message(session_id, "user", "turn 1")
            manager.save_message(session_id, "assistant", "turn 1 answer")
            manager.save_message(session_id, "user", "turn 2")
            manager.save_message(session_id, "assistant", "turn 2 answer")

            before = manager.get_history(session_id)
            compressor = ContextCompressor(
                session_manager=manager,
                base_dir=base_dir,
                rag_mode_getter=lambda: False,
                target_budget_tokens=1,
                keep_recent_turns=1,
                summary_max_chars=1200,
                summarizer=AsyncMock(side_effect=RuntimeError("llm unavailable")),
            )

            result = await compressor.compress_if_needed(session_id)
            after = manager.get_history(session_id)

        self.assertIsNone(result)
        self.assertEqual(before["messages"], after["messages"])
        self.assertEqual(before["compressed_context"], after["compressed_context"])
        self.assertEqual(after["compression_events"][-1]["degraded"], True)
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `uv run python -m unittest tests.test_context_compressor.ContextCompressorTests -v`

Expected: `FAIL` with `ModuleNotFoundError: No module named 'graph.context_compressor'`

- [ ] **Step 3: Implement the compressor and route the manual endpoint through it**

```python
# graph/context_compressor.py
from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Awaitable, Callable

from graph.prompt_budget import estimate_session_prompt_tokens


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


class ContextCompressor:
    def __init__(
        self,
        *,
        session_manager,
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

    async def compress_if_needed(self, session_id: str, reason: str = "prompt_tokens_exceeded") -> CompressionResult | None:
        record = self.session_manager.get_history(session_id)
        pre = estimate_session_prompt_tokens(
            base_dir=self.base_dir,
            rag_mode=self.rag_mode_getter(),
            record=record,
        )
        if pre.total_tokens <= self.target_budget_tokens:
            return None
        return await self.force_compress(session_id=session_id, reason=reason)

    async def force_compress(self, session_id: str, reason: str = "manual_request") -> CompressionResult:
        record = self.session_manager.get_history(session_id)
        pre = estimate_session_prompt_tokens(
            base_dir=self.base_dir,
            rag_mode=self.rag_mode_getter(),
            record=record,
        )
        archived_messages, kept_messages = self._split_messages(record.get("messages", []))
        summary = await self.summarizer(str(record.get("compressed_context", "") or "").strip(), archived_messages)
        summary = summary.strip()[: self.summary_max_chars]
        updated_record = {
            **record,
            "compressed_context": summary,
            "messages": kept_messages,
        }
        post = estimate_session_prompt_tokens(
            base_dir=self.base_dir,
            rag_mode=self.rag_mode_getter(),
            record=updated_record,
        )
        event = {
            "timestamp": time.time(),
            "reason": reason,
            "summary": summary,
            "pre_compress_tokens": pre.total_tokens,
            "post_compress_tokens": post.total_tokens,
            "target_budget_tokens": self.target_budget_tokens,
            "compressed_message_count": len(archived_messages),
            "kept_recent_turn_count": self.keep_recent_turns,
            "degraded": False,
        }
        self.session_manager.apply_compression(
            session_id=session_id,
            summary=summary,
            kept_messages=kept_messages,
            archived_messages=archived_messages,
            compression_state={
                "version": 1,
                "updated_at": event["timestamp"],
                "trigger_reason": reason,
                "pre_compress_tokens": pre.total_tokens,
                "post_compress_tokens": post.total_tokens,
                "target_budget_tokens": self.target_budget_tokens,
                "kept_recent_turn_count": self.keep_recent_turns,
                "compressed_message_count": len(archived_messages),
            },
            compression_event=event,
        )
        return CompressionResult(session_id=session_id, reason=reason, summary=summary, pre_compress_tokens=pre.total_tokens, post_compress_tokens=post.total_tokens, target_budget_tokens=self.target_budget_tokens, compressed_message_count=len(archived_messages), kept_recent_turn_count=self.keep_recent_turns)
```

```python
# graph/agent.py
class AgentManager:
    def initialize(self, base_dir: Path) -> None:
        self.base_dir = base_dir
        self.session_manager = SessionManager(base_dir)
        self.tools = get_all_tools(base_dir, mcp_manager=mcp_manager)
        self.tool_metadata = dict(mcp_manager.get_tool_metadata())
        knowledge_orchestrator.configure(base_dir, self._build_chat_model)
        settings = get_settings()
        self.context_compressor = ContextCompressor(
            session_manager=self.session_manager,
            base_dir=base_dir,
            rag_mode_getter=runtime_config.get_rag_mode,
            target_budget_tokens=settings.compression_target_budget_tokens,
            keep_recent_turns=settings.compression_keep_recent_turns,
            summary_max_chars=settings.compression_summary_max_chars,
            summarizer=self.summarize_for_compression,
        )

    async def summarize_for_compression(self, previous_summary: str, messages: list[dict[str, Any]]) -> str:
        prompt = (
            "请把旧摘要和新增对话整理成结构化中文摘要。"
            "必须包含：Current goal、Confirmed facts、Key decisions、Completed work、Open issues、Next steps。"
        )
        transcript = []
        if previous_summary.strip():
            transcript.append(f"previous_summary:\n{previous_summary.strip()}")
        for item in messages:
            transcript.append(f"{item.get('role', 'assistant')}: {str(item.get('content', '') or '')}")
        response = await self._build_chat_model().ainvoke(
            [{"role": "system", "content": prompt}, {"role": "user", "content": "\n".join(transcript)}]
        )
        return _stringify_content(getattr(response, "content", "")).strip()
```

```python
# api/compress.py
@router.post("/sessions/{session_id}/compress")
async def compress_session(session_id: str) -> dict[str, int | str]:
    if agent_manager.context_compressor is None:
        raise HTTPException(status_code=503, detail="Context compressor is not initialized")
    result = await agent_manager.context_compressor.force_compress(session_id=session_id, reason="manual_request")
    return {
        "compressed_message_count": result.compressed_message_count,
        "post_compress_tokens": result.post_compress_tokens,
        "reason": result.reason,
    }
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `uv run python -m unittest tests.test_context_compressor -v`

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add api/compress.py graph/agent.py graph/context_compressor.py tests/test_context_compressor.py
git commit -m "feat: add shared context compressor"
```

## Task 4: Post-Turn Chat Hook and Final SSE Ordering

**Files:**
- Modify: `api/chat.py`
- Create: `tests/test_chat_post_turn_compression.py`

- [ ] **Step 1: Write the failing post-turn chat tests**

```python
import unittest
from unittest.mock import AsyncMock, patch

from api.chat import _collect_post_turn_events


class ChatPostTurnCompressionTests(unittest.IsolatedAsyncioTestCase):
    async def test_collects_title_then_compression_then_done(self):
        title_mock = AsyncMock(return_value="压缩测试")
        compression_mock = AsyncMock(
            return_value={
                "session_id": "s1",
                "reason": "prompt_tokens_exceeded",
                "summary": "## Current goal\nkeep context",
                "pre_compress_tokens": 26000,
                "post_compress_tokens": 18000,
                "target_budget_tokens": 24000,
                "compressed_message_count": 4,
                "kept_recent_turn_count": 2,
                "degraded": False,
            }
        )

        events = await _collect_post_turn_events(
            session_id="s1",
            request_message="hello",
            done_payload={"content": "final answer"},
            is_first_user_message=True,
            generate_title=title_mock,
            set_title=lambda *_args, **_kwargs: None,
            maybe_compress=compression_mock,
        )

        self.assertEqual([event["type"] for event in events], ["title", "compression", "done"])
        self.assertEqual(events[-1]["content"], "final answer")

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
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `uv run python -m unittest tests.test_chat_post_turn_compression -v`

Expected: `FAIL` with `ImportError: cannot import name '_collect_post_turn_events'`

- [ ] **Step 3: Implement post-turn compression hooks in `api/chat.py`**

```python
# api/chat.py
async def _collect_post_turn_events(
    *,
    session_id: str,
    request_message: str,
    done_payload: dict[str, Any],
    is_first_user_message: bool,
    generate_title,
    set_title,
    maybe_compress,
) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    if is_first_user_message:
        title = await generate_title(request_message)
        set_title(session_id, title)
        events.append({"type": "title", "session_id": session_id, "title": title})
    compression = await maybe_compress(session_id)
    if compression:
        events.append({"type": "compression", **compression})
    events.append({"type": "done", **done_payload})
    return events
```

```python
# inside event_generator()
elif event_type == "done":
    if not current_segment["content"].strip() and event.get("content"):
        current_segment["content"] = event["content"]
    if include_reasoning_content and event.get("reasoning_content"):
        current_segment["reasoning_content"] = str(event["reasoning_content"])
    persist_segments()
    done_payload = {key: value for key, value in event.items() if key != "type"}
    queued_events = await _collect_post_turn_events(
        session_id=payload.session_id,
        request_message=payload.message,
        done_payload=done_payload,
        is_first_user_message=is_first_user_message,
        generate_title=agent_manager.generate_title,
        set_title=session_manager.set_title,
        maybe_compress=agent_manager.maybe_compress_session_after_turn,
    )
    for queued_event in queued_events:
        queued_type = queued_event["type"]
        queued_data = {key: value for key, value in queued_event.items() if key != "type"}
        prompt_logger.log_event(queued_type, queued_data)
        yield _sse(queued_type, queued_data)
    return
```

```python
# graph/agent.py
async def maybe_compress_session_after_turn(self, session_id: str) -> dict[str, Any] | None:
    settings = get_settings()
    if not settings.compression_enabled or self.context_compressor is None:
        return None
    result = await self.context_compressor.compress_if_needed(session_id)
    if result is None:
        return None
    return {
        "session_id": result.session_id,
        "reason": result.reason,
        "summary": result.summary,
        "pre_compress_tokens": result.pre_compress_tokens,
        "post_compress_tokens": result.post_compress_tokens,
        "target_budget_tokens": result.target_budget_tokens,
        "compressed_message_count": result.compressed_message_count,
        "kept_recent_turn_count": result.kept_recent_turn_count,
        "degraded": result.degraded,
    }
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `uv run python -m unittest tests.test_chat_post_turn_compression -v`

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add api/chat.py graph/agent.py tests/test_chat_post_turn_compression.py
git commit -m "feat: trigger compression after chat turns"
```

## Task 5: Frontend Compression Visibility

**Files:**
- Create: `../frontend/src/components/chat/CompressionCard.tsx`
- Modify: `../frontend/src/lib/api.ts`
- Modify: `../frontend/src/lib/store.tsx`
- Modify: `../frontend/src/components/chat/ChatPanel.tsx`

- [ ] **Step 1: Add the failing type-first UI wiring**

```ts
// ../frontend/src/lib/api.ts
export type CompressionEvent = {
  timestamp: number;
  reason: string;
  summary: string;
  pre_compress_tokens: number;
  post_compress_tokens: number;
  target_budget_tokens: number;
  compressed_message_count: number;
  kept_recent_turn_count: number;
  degraded: boolean;
};

export type SessionHistory = {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  compressed_context?: string;
  compression_events?: CompressionEvent[];
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    tool_calls?: ToolCall[];
    retrieval_steps?: RetrievalStep[];
  }>;
};
```

```tsx
// ../frontend/src/lib/store.tsx
type AppStore = {
  sessions: SessionSummary[];
  currentSessionId: string | null;
  messages: Message[];
  isStreaming: boolean;
  ragMode: boolean;
  skills: Array<{ name: string; description: string; path: string }>;
  editableFiles: string[];
  inspectorPath: string;
  inspectorContent: string;
  inspectorDirty: boolean;
  sidebarWidth: number;
  inspectorWidth: number;
  tokenStats: TokenStats | null;
  knowledgeIndexStatus: KnowledgeIndexStatus | null;
  compressionEvents: CompressionEvent[];
  createNewSession: () => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  sendMessage: (value: string) => Promise<void>;
  toggleRagMode: () => Promise<void>;
  renameCurrentSession: (title: string) => Promise<void>;
  removeSession: (sessionId: string) => Promise<void>;
  loadInspectorFile: (path: string) => Promise<void>;
  updateInspectorContent: (value: string) => void;
  saveInspector: () => Promise<void>;
  compressCurrentSession: () => Promise<void>;
  rebuildKnowledgeIndex: () => Promise<void>;
  setSidebarWidth: (width: number) => void;
  setInspectorWidth: (width: number) => void;
};

const [compressionEvents, setCompressionEvents] = useState<CompressionEvent[]>([]);
```

```tsx
// ../frontend/src/components/chat/ChatPanel.tsx
const { messages, sendMessage, isStreaming, tokenStats, compressionEvents } = useAppStore();
<CompressionCard events={compressionEvents} />
```

- [ ] **Step 2: Run the frontend build and verify it fails**

Run from `../frontend`: `npm run build`

Expected: `Failed to compile` with missing import/component/state errors for `CompressionEvent` or `CompressionCard`

- [ ] **Step 3: Implement compression event storage and rendering**

```ts
// ../frontend/src/lib/store.tsx
import type { CompressionEvent, KnowledgeIndexStatus, RetrievalStep, SessionSummary, ToolCall } from "@/lib/api";

function normalizeCompressionEvent(value: unknown): CompressionEvent | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const item = value as Record<string, unknown>;
  return {
    timestamp: Number(item.timestamp ?? 0),
    reason: String(item.reason ?? ""),
    summary: String(item.summary ?? ""),
    pre_compress_tokens: Number(item.pre_compress_tokens ?? 0),
    post_compress_tokens: Number(item.post_compress_tokens ?? 0),
    target_budget_tokens: Number(item.target_budget_tokens ?? 0),
    compressed_message_count: Number(item.compressed_message_count ?? 0),
    kept_recent_turn_count: Number(item.kept_recent_turn_count ?? 0),
    degraded: Boolean(item.degraded ?? false),
  };
}

async function refreshSessionDetails(sessionId: string) {
  const [history, tokens] = await Promise.all([getSessionHistory(sessionId), getSessionTokens(sessionId)]);
  setMessages(toUiMessages(history.messages));
  setCompressionEvents(
    (history.compression_events ?? [])
      .map((event) => normalizeCompressionEvent(event))
      .filter((event): event is CompressionEvent => event !== null)
      .reverse()
  );
  setTokenStats(tokens);
}

if (event === "compression") {
  const compressionEvent = normalizeCompressionEvent(data);
  if (compressionEvent) {
    setCompressionEvents((prev) => [compressionEvent, ...prev]);
  }
  return;
}
```

```tsx
// ../frontend/src/components/chat/CompressionCard.tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { CompressionEvent } from "@/lib/api";

export function CompressionCard({ events }: { events: CompressionEvent[] }) {
  if (!events.length) {
    return null;
  }
  return (
    <section className="rounded-[28px] border border-[var(--color-line)] bg-white/70 p-4">
      <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-ink-soft)]">
        Compression
      </p>
      {events.map((event) => (
        <article className="mt-3 rounded-[20px] bg-[rgba(16,61,80,0.05)] p-4" key={event.timestamp}>
          <div className="mono text-xs text-[var(--color-ink-soft)]">
            {event.pre_compress_tokens} → {event.post_compress_tokens} / target {event.target_budget_tokens}
          </div>
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
            reason={event.reason} compressed={event.compressed_message_count} kept_recent_turns={event.kept_recent_turn_count}
          </p>
          <div className="markdown mt-3 text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{event.summary}</ReactMarkdown>
          </div>
        </article>
      ))}
    </section>
  );
}
```

- [ ] **Step 4: Run the frontend verification**

Run from `../frontend`: `npm run lint`

Expected: `✔ No ESLint warnings or errors`

Run from `../frontend`: `npm run build`

Expected: `Compiled successfully`

- [ ] **Step 5: Commit**

```bash
git add ../frontend/src/lib/api.ts ../frontend/src/lib/store.tsx ../frontend/src/components/chat/CompressionCard.tsx ../frontend/src/components/chat/ChatPanel.tsx
git commit -m "feat: show compression history in chat ui"
```

## Task 6: Final Regression Sweep

**Files:**
- Modify: `tests/test_context_compressor.py`
- Modify: `tests/test_chat_post_turn_compression.py`

- [ ] **Step 1: Add the final regression assertions**

```python
class ContextCompressorTests(unittest.IsolatedAsyncioTestCase):
    async def test_force_compress_uses_manual_reason(self):
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = Path(tmp)
            (base_dir / "workspace").mkdir(parents=True)
            for name in ("SOUL.md", "IDENTITY.md", "USER.md", "AGENTS.md"):
                (base_dir / "workspace" / name).write_text(name, encoding="utf-8")
            (base_dir / "memory").mkdir(parents=True)
            (base_dir / "memory" / "MEMORY.md").write_text("memory", encoding="utf-8")
            manager = SessionManager(base_dir)
            session = manager.create_session("manual")
            session_id = str(session["id"])
            manager.save_message(session_id, "user", "first")
            manager.save_message(session_id, "assistant", "first answer")
            manager.save_message(session_id, "user", "second")
            manager.save_message(session_id, "assistant", "second answer")
            compressor = ContextCompressor(
                session_manager=manager,
                base_dir=base_dir,
                rag_mode_getter=lambda: False,
                target_budget_tokens=1,
                keep_recent_turns=1,
                summary_max_chars=1200,
                summarizer=AsyncMock(return_value="## Current goal\nmanual summary"),
            )
        result = await compressor.force_compress(session_id=session_id, reason="manual_request")
        saved = manager.get_history(session_id)
        self.assertEqual(result.reason, "manual_request")
        self.assertEqual(saved["compression_state"]["trigger_reason"], "manual_request")


class ChatPostTurnCompressionTests(unittest.IsolatedAsyncioTestCase):
    async def test_compression_payload_survives_done_reordering(self):
        events = await _collect_post_turn_events(
            session_id="s1",
            request_message="hello",
            done_payload={"content": "answer"},
            is_first_user_message=False,
            generate_title=AsyncMock(),
            set_title=lambda *_args, **_kwargs: None,
            maybe_compress=AsyncMock(
                return_value={
                    "session_id": "s1",
                    "reason": "prompt_tokens_exceeded",
                    "summary": "## Current goal\nkeep context",
                    "pre_compress_tokens": 10,
                    "post_compress_tokens": 5,
                    "target_budget_tokens": 8,
                    "compressed_message_count": 2,
                    "kept_recent_turn_count": 1,
                    "degraded": False,
                }
            ),
        )
        self.assertEqual(events[0]["type"], "compression")
        self.assertEqual(events[1]["type"], "done")
```

- [ ] **Step 2: Run the backend regression suite**

Run: `uv run python -m unittest tests.test_prompt_budget tests.test_context_compressor tests.test_chat_post_turn_compression -v`

Expected: `OK`

- [ ] **Step 3: Run the manual API sanity checks**

Run: `uv run uvicorn app:app --host 127.0.0.1 --port 8004 --reload`

Expected: server starts without import errors

Run in another shell:

```bash
curl -N -X POST http://127.0.0.1:8004/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"请连续回答并保留上下文","session_id":"<existing-session-id>","stream":true}'
```

Expected: SSE stream includes `event: compression` before the final `event: done` once the session exceeds budget

- [ ] **Step 4: Run the frontend sanity check against the backend**

Run from `../frontend`: `npm run dev`

Expected: chat panel shows a `Compression` card after a compressed turn and preserves it after refresh because `compression_events` comes from `/api/sessions/{session_id}/history`

- [ ] **Step 5: Commit**

```bash
git add tests/test_context_compressor.py tests/test_chat_post_turn_compression.py
git commit -m "test: cover long-context compression regressions"
```

## Self-Review

### Spec Coverage

- Automatic post-turn trigger: Task 4
- Structured summary regeneration: Task 3
- Shared token accounting including `compressed_context`: Task 1
- Session metadata and audit trail: Task 2
- Manual endpoint reusing shared compression path: Task 3
- Visible frontend rendering plus persisted history: Task 5
- Failure safety and regression checks: Tasks 3 and 6

### Placeholder Scan

- No `TODO`/`TBD` placeholders remain.
- Every task has exact files, commands, and concrete code snippets.

### Type Consistency

- Shared type names are fixed across tasks:
  - `PromptTokenBreakdown`
  - `ContextCompressor`
  - `CompressionResult`
  - `CompressionEvent`
- Session record keys are consistent across tasks:
  - `compressed_context`
  - `compression_state`
  - `compression_events`
