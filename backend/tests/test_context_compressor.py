from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from graph.context_compressor import CompressionResult, ContextCompressor
from graph.session_manager import SessionManager


def structured_summary(
    current_goal: str,
    confirmed_facts: str,
    key_decisions: str,
    completed_work: str,
    open_issues: str,
    next_steps: str,
) -> str:
    return "\n".join(
        (
            "## Current goal",
            current_goal,
            "## Confirmed facts",
            confirmed_facts,
            "## Key decisions",
            key_decisions,
            "## Completed work",
            completed_work,
            "## Open issues",
            open_issues,
            "## Next steps",
            next_steps,
        )
    )


class ContextCompressionPersistenceTests(unittest.TestCase):
    def test_default_session_record_includes_compression_metadata(self):
        with tempfile.TemporaryDirectory() as tmp:
            manager = SessionManager(Path(tmp))

            record = manager.create_session(title="Compression Test")
            saved = manager.load_session_record(record["id"])

        self.assertEqual(saved["compressed_context"], "")
        self.assertEqual(saved["compression_state"], {})
        self.assertEqual(saved["compression_events"], [])

    def test_load_session_record_fills_compression_defaults_for_legacy_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = Path(tmp)
            manager = SessionManager(base_dir)
            session_id = "legacy-session"
            legacy_path = base_dir / "sessions" / f"{session_id}.json"
            legacy_path.write_text(
                json.dumps(
                    {
                        "id": session_id,
                        "title": "Legacy Session",
                        "created_at": 100.0,
                        "updated_at": 100.0,
                        "messages": [{"role": "user", "content": "hello"}],
                    },
                    ensure_ascii=False,
                    indent=2,
                ),
                encoding="utf-8",
            )

            saved = manager.load_session_record(session_id)

        self.assertEqual(saved["compressed_context"], "")
        self.assertEqual(saved["compression_state"], {})
        self.assertEqual(saved["compression_events"], [])
        self.assertEqual(saved["messages"], [{"role": "user", "content": "hello"}])

    def test_apply_compression_rewrites_session_and_writes_archive(self):
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = Path(tmp)
            manager = SessionManager(base_dir)
            session = manager.create_session(title="Compression Flow")
            session_id = session["id"]

            manager.save_message(session_id, "user", "first question")
            manager.save_message(session_id, "assistant", "first answer")
            manager.save_message(session_id, "user", "latest question")

            kept_messages = [{"role": "user", "content": "latest question"}]
            compression_state = {
                "kind": "structured_summary_v1",
                "source_message_count": 2,
                "trigger": "manual_test",
            }
            compression_event = {
                "type": "compression_applied",
                "archived_count": 2,
                "kept_count": 1,
            }

            result = manager.apply_compression(
                session_id=session_id,
                fresh_summary="fresh summary",
                kept_messages=kept_messages,
                archived_messages=[
                    {"role": "user", "content": "first question"},
                    {"role": "assistant", "content": "first answer"},
                ],
                compression_state=compression_state,
                compression_event=compression_event,
            )

            saved = manager.load_session_record(session_id)
            archive_files = sorted((base_dir / "sessions" / "archive").glob(f"{session_id}_*.json"))
            archive_payload = json.loads(archive_files[0].read_text(encoding="utf-8"))

        self.assertEqual(result["archived_count"], 2)
        self.assertEqual(result["remaining_count"], 1)
        self.assertEqual(saved["compressed_context"], "fresh summary")
        self.assertEqual(saved["messages"], kept_messages)
        self.assertEqual(saved["compression_state"], compression_state)
        self.assertEqual(saved["compression_events"], [compression_event])
        self.assertEqual(len(archive_files), 1)
        self.assertEqual(archive_payload["session_id"], session_id)
        self.assertEqual(
            archive_payload["messages"],
            [
                {"role": "user", "content": "first question"},
                {"role": "assistant", "content": "first answer"},
            ],
        )

    def test_apply_compression_rejects_mismatched_message_rewrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = Path(tmp)
            manager = SessionManager(base_dir)
            session = manager.create_session(title="Mismatch Guard")
            session_id = session["id"]

            manager.save_message(session_id, "user", "first question")
            manager.save_message(session_id, "assistant", "first answer")

            with self.assertRaises(ValueError):
                manager.apply_compression(
                    session_id=session_id,
                    fresh_summary="fresh summary",
                    kept_messages=[{"role": "user", "content": "first question"}],
                    archived_messages=[{"role": "assistant", "content": "first answer"}],
                )

            archive_files = list((base_dir / "sessions" / "archive").glob(f"{session_id}_*.json"))
            saved = manager.load_session_record(session_id)

        self.assertEqual(archive_files, [])
        self.assertEqual(
            saved["messages"],
            [
                {"role": "user", "content": "first question"},
                {"role": "assistant", "content": "first answer"},
            ],
        )

    def test_apply_compression_skips_empty_compression_event(self):
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = Path(tmp)
            manager = SessionManager(base_dir)
            session = manager.create_session(title="No Event")
            session_id = session["id"]

            manager.save_message(session_id, "user", "first question")

            manager.apply_compression(
                session_id=session_id,
                fresh_summary="fresh summary",
                kept_messages=[],
                archived_messages=[{"role": "user", "content": "first question"}],
                compression_event=None,
            )

            saved = manager.load_session_record(session_id)

        self.assertEqual(saved["compression_events"], [])

    def test_apply_compression_skips_empty_dict_compression_event(self):
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = Path(tmp)
            manager = SessionManager(base_dir)
            session = manager.create_session(title="Empty Event Dict")
            session_id = session["id"]

            manager.save_message(session_id, "user", "first question")

            manager.apply_compression(
                session_id=session_id,
                fresh_summary="fresh summary",
                kept_messages=[],
                archived_messages=[{"role": "user", "content": "first question"}],
                compression_event={},
            )

            saved = manager.load_session_record(session_id)

        self.assertEqual(saved["compression_events"], [])

    def test_apply_compression_uses_unique_archive_filenames_for_same_second(self):
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = Path(tmp)
            manager = SessionManager(base_dir)
            session = manager.create_session(title="Archive Collision")
            session_id = session["id"]

            manager.save_message(session_id, "user", "question 1")
            manager.save_message(session_id, "assistant", "answer 1")

            with patch("graph.session_manager.time.time", return_value=12345.0):
                manager.apply_compression(
                    session_id=session_id,
                    fresh_summary="summary 1",
                    kept_messages=[{"role": "assistant", "content": "answer 1"}],
                    archived_messages=[{"role": "user", "content": "question 1"}],
                )

            manager.save_message(session_id, "user", "question 2")

            with patch("graph.session_manager.time.time", return_value=12345.0):
                manager.apply_compression(
                    session_id=session_id,
                    fresh_summary="summary 2",
                    kept_messages=[{"role": "user", "content": "question 2"}],
                    archived_messages=[{"role": "assistant", "content": "answer 1"}],
                )

            archive_files = sorted((base_dir / "sessions" / "archive").glob(f"{session_id}_*.json"))
            archive_payloads = [json.loads(path.read_text(encoding="utf-8")) for path in archive_files]

        self.assertEqual(len(archive_files), 2)
        self.assertNotEqual(archive_files[0].name, archive_files[1].name)
        archived_message_sets = {
            tuple((message["role"], message["content"]) for message in payload["messages"])
            for payload in archive_payloads
        }
        self.assertEqual(
            archived_message_sets,
            {
                (("user", "question 1"),),
                (("assistant", "answer 1"),),
            },
        )

    def test_compress_history_reuses_safe_persistence_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = Path(tmp)
            manager = SessionManager(base_dir)
            session = manager.create_session(title="Legacy Compression")
            session_id = session["id"]

            manager.save_message(session_id, "user", "question 1")
            manager.save_message(session_id, "assistant", "answer 1")
            manager.save_message(session_id, "user", "question 2")
            manager.save_message(session_id, "assistant", "answer 2")

            with patch.object(manager, "_write_session", side_effect=RuntimeError("session write failed")):
                with self.assertRaises(RuntimeError):
                    manager.compress_history(session_id, "legacy summary", 2)

            archive_files = list((base_dir / "sessions" / "archive").glob(f"{session_id}_*.json"))
            saved = manager.load_session_record(session_id)

        self.assertEqual(archive_files, [])
        self.assertEqual(saved["compressed_context"], "")
        self.assertEqual(saved["compression_state"], {})
        self.assertEqual(saved["compression_events"], [])
        self.assertEqual(
            saved["messages"],
            [
                {"role": "user", "content": "question 1"},
                {"role": "assistant", "content": "answer 1"},
                {"role": "user", "content": "question 2"},
                {"role": "assistant", "content": "answer 2"},
            ],
        )

    def test_apply_compression_removes_archive_when_session_write_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = Path(tmp)
            manager = SessionManager(base_dir)
            session = manager.create_session(title="Write Failure")
            session_id = session["id"]

            manager.save_message(session_id, "user", "first question")

            with patch.object(manager, "_write_session", side_effect=RuntimeError("session write failed")):
                with self.assertRaises(RuntimeError):
                    manager.apply_compression(
                        session_id=session_id,
                        fresh_summary="fresh summary",
                        kept_messages=[],
                        archived_messages=[{"role": "user", "content": "first question"}],
                    )

            archive_files = list((base_dir / "sessions" / "archive").glob(f"{session_id}_*.json"))
            saved = manager.load_session_record(session_id)

        self.assertEqual(len(archive_files), 0)
        self.assertEqual(saved["messages"], [{"role": "user", "content": "first question"}])


class ContextCompressorTests(unittest.IsolatedAsyncioTestCase):
    def _create_base_dir(self, tmp: str) -> Path:
        base_dir = Path(tmp)
        workspace_dir = base_dir / "workspace"
        workspace_dir.mkdir(parents=True)
        for name, content in (
            ("SOUL.md", "soul"),
            ("IDENTITY.md", "identity"),
            ("USER.md", "user"),
            ("AGENTS.md", "agents"),
        ):
            (workspace_dir / name).write_text(content, encoding="utf-8")
        return base_dir

    async def test_compress_if_needed_keeps_recent_turns_and_writes_fresh_summary(self):
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = self._create_base_dir(tmp)
            manager = SessionManager(base_dir)
            session = manager.create_session("Auto Compression")
            session_id = str(session["id"])

            manager.save_message(session_id, "user", "turn 1 user")
            manager.save_message(
                session_id,
                "assistant",
                "turn 1 assistant",
                reasoning_content="turn 1 reasoning",
            )
            manager.save_message(session_id, "user", "turn 2 user")
            manager.save_message(
                session_id,
                "assistant",
                "turn 2 assistant",
                tool_calls=[{"id": "call-2", "type": "tool"}],
            )
            manager.save_message(session_id, "user", "turn 3 user")
            manager.save_message(session_id, "assistant", "turn 3 assistant")

            seen_inputs: list[tuple[str, list[dict[str, str]]]] = []

            async def summarizer(previous_summary: str, archived_messages: list[dict[str, str]]) -> str:
                seen_inputs.append((previous_summary, archived_messages))
                return structured_summary(
                    "fresh summary",
                    "confirmed facts",
                    "key decisions",
                    "completed work",
                    "open issues",
                    "next steps",
                )

            compressor = ContextCompressor(
                session_manager=manager,
                base_dir=base_dir,
                rag_mode_getter=lambda: False,
                target_budget_tokens=1,
                keep_recent_turns=2,
                summary_max_chars=1_200,
                summarizer=summarizer,
            )

            saved_before = manager.load_session_record(session_id)
            saved_before["compressed_context"] = "old summary"
            manager._write_session(saved_before)

            result = await compressor.compress_if_needed(session_id)
            saved = manager.load_session_record(session_id)

        self.assertIsInstance(result, CompressionResult)
        assert result is not None
        self.assertEqual(result.reason, "prompt_tokens_exceeded")
        self.assertFalse(result.degraded)
        self.assertEqual(
            result.summary,
            structured_summary(
                "fresh summary",
                "confirmed facts",
                "key decisions",
                "completed work",
                "open issues",
                "next steps",
            ),
        )
        self.assertEqual(result.compressed_message_count, 2)
        self.assertEqual(result.kept_recent_turn_count, 2)
        self.assertEqual(len(seen_inputs), 1)
        self.assertEqual(seen_inputs[0][0], "old summary")
        self.assertEqual(
            seen_inputs[0][1],
            [
                {"role": "user", "content": "turn 1 user"},
                {
                    "role": "assistant",
                    "content": "turn 1 assistant",
                    "reasoning_content": "turn 1 reasoning",
                },
            ],
        )
        self.assertEqual(
            saved["compressed_context"],
            structured_summary(
                "fresh summary",
                "confirmed facts",
                "key decisions",
                "completed work",
                "open issues",
                "next steps",
            ),
        )
        self.assertEqual(
            saved["messages"],
            [
                {"role": "user", "content": "turn 2 user"},
                {
                    "role": "assistant",
                    "content": "turn 2 assistant",
                    "tool_calls": [{"id": "call-2", "type": "tool"}],
                },
                {"role": "user", "content": "turn 3 user"},
                {"role": "assistant", "content": "turn 3 assistant"},
            ],
        )
        self.assertEqual(saved["compression_state"]["trigger_reason"], "prompt_tokens_exceeded")
        self.assertEqual(saved["compression_state"]["kept_recent_turn_count"], 2)
        self.assertEqual(saved["compression_state"]["compressed_message_count"], 2)
        self.assertFalse(saved["compression_state"]["degraded"])
        self.assertEqual(saved["compression_events"][-1]["reason"], "prompt_tokens_exceeded")
        self.assertFalse(saved["compression_events"][-1]["degraded"])

    async def test_compress_if_needed_summary_failure_leaves_session_unchanged(self):
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = self._create_base_dir(tmp)
            manager = SessionManager(base_dir)
            session = manager.create_session("Auto Failure")
            session_id = str(session["id"])

            manager.save_message(session_id, "user", "turn 1 user")
            manager.save_message(session_id, "assistant", "turn 1 assistant")
            manager.save_message(session_id, "user", "turn 2 user")
            manager.save_message(session_id, "assistant", "turn 2 assistant")

            before = manager.load_session_record(session_id)
            compressor = ContextCompressor(
                session_manager=manager,
                base_dir=base_dir,
                rag_mode_getter=lambda: False,
                target_budget_tokens=1,
                keep_recent_turns=1,
                summary_max_chars=1_200,
                summarizer=AsyncMock(side_effect=RuntimeError("summary failed")),
            )

            result = await compressor.compress_if_needed(session_id)
            after = manager.load_session_record(session_id)

        self.assertIsNone(result)
        self.assertEqual(after, before)

    async def test_force_compress_returns_manual_reason_and_result_shape(self):
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = self._create_base_dir(tmp)
            manager = SessionManager(base_dir)
            session = manager.create_session("Manual Compression")
            session_id = str(session["id"])

            manager.save_message(session_id, "user", "turn 1 user")
            manager.save_message(session_id, "assistant", "turn 1 assistant")
            manager.save_message(session_id, "user", "turn 2 user")
            manager.save_message(session_id, "assistant", "turn 2 assistant")

            compressor = ContextCompressor(
                session_manager=manager,
                base_dir=base_dir,
                rag_mode_getter=lambda: False,
                target_budget_tokens=999_999,
                keep_recent_turns=1,
                summary_max_chars=1_200,
                summarizer=AsyncMock(
                    return_value=structured_summary(
                        "manual summary",
                        "confirmed facts",
                        "key decisions",
                        "completed work",
                        "open issues",
                        "next steps",
                    )
                ),
            )

            result = await compressor.force_compress(session_id=session_id, reason="manual_request")
            saved = manager.load_session_record(session_id)

        self.assertIsInstance(result, CompressionResult)
        self.assertEqual(result.reason, "manual_request")
        self.assertFalse(result.degraded)
        self.assertEqual(
            result.summary,
            structured_summary(
                "manual summary",
                "confirmed facts",
                "key decisions",
                "completed work",
                "open issues",
                "next steps",
            ),
        )
        self.assertEqual(result.compressed_message_count, 2)
        self.assertEqual(result.kept_recent_turn_count, 1)
        self.assertEqual(saved["compression_state"]["trigger_reason"], "manual_request")
        self.assertFalse(saved["compression_state"]["degraded"])
        self.assertEqual(saved["compression_events"][-1]["reason"], "manual_request")
        self.assertFalse(saved["compression_events"][-1]["degraded"])
        self.assertEqual(
            result.to_dict(),
            {
                "session_id": session_id,
                "reason": "manual_request",
                "summary": structured_summary(
                    "manual summary",
                    "confirmed facts",
                    "key decisions",
                    "completed work",
                    "open issues",
                    "next steps",
                ),
                "pre_compress_tokens": result.pre_compress_tokens,
                "post_compress_tokens": result.post_compress_tokens,
                "target_budget_tokens": 999_999,
                "compressed_message_count": 2,
                "kept_recent_turn_count": 1,
                "degraded": False,
            },
        )

    async def test_force_compress_falls_back_for_short_session_without_full_window(self):
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = self._create_base_dir(tmp)
            manager = SessionManager(base_dir)
            session = manager.create_session("Short Session")
            session_id = str(session["id"])

            manager.save_message(session_id, "user", "one question")
            manager.save_message(
                session_id,
                "assistant",
                "one answer",
                reasoning_content="hidden chain of thought",
                tool_calls=[{"id": "call-short", "type": "tool"}],
            )

            compressor = ContextCompressor(
                session_manager=manager,
                base_dir=base_dir,
                rag_mode_getter=lambda: False,
                target_budget_tokens=999_999,
                keep_recent_turns=2,
                summary_max_chars=1_200,
                summarizer=AsyncMock(
                    return_value=structured_summary(
                        "short session summary",
                        "confirmed facts",
                        "key decisions",
                        "completed work",
                        "open issues",
                        "next steps",
                    )
                ),
            )

            result = await compressor.force_compress(session_id=session_id, reason="manual_request")
            saved = manager.load_session_record(session_id)
            archive_files = sorted((base_dir / "sessions" / "archive").glob(f"{session_id}_*.json"))
            archive_payload = json.loads(archive_files[0].read_text(encoding="utf-8"))

        self.assertEqual(result.compressed_message_count, 2)
        self.assertEqual(result.kept_recent_turn_count, 0)
        self.assertEqual(saved["messages"], [])
        self.assertEqual(saved["compression_state"]["compressed_message_count"], 2)
        self.assertEqual(saved["compression_state"]["kept_recent_turn_count"], 0)
        self.assertEqual(
            archive_payload["messages"],
            [
                {"role": "user", "content": "one question"},
                {
                    "role": "assistant",
                    "content": "one answer",
                    "reasoning_content": "hidden chain of thought",
                    "tool_calls": [{"id": "call-short", "type": "tool"}],
                },
            ],
        )

    async def test_compress_if_needed_keeps_incomplete_user_tail_as_recent_turn(self):
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = self._create_base_dir(tmp)
            manager = SessionManager(base_dir)
            session = manager.create_session("Incomplete Tail")
            session_id = str(session["id"])

            manager.save_message(session_id, "user", "turn 1 user")
            manager.save_message(session_id, "assistant", "turn 1 assistant")
            manager.save_message(session_id, "user", "turn 2 user")

            compressor = ContextCompressor(
                session_manager=manager,
                base_dir=base_dir,
                rag_mode_getter=lambda: False,
                target_budget_tokens=1,
                keep_recent_turns=1,
                summary_max_chars=1_200,
                summarizer=AsyncMock(
                    return_value=structured_summary(
                        "incomplete tail summary",
                        "confirmed facts",
                        "key decisions",
                        "completed work",
                        "open issues",
                        "next steps",
                    )
                ),
            )

            result = await compressor.compress_if_needed(session_id)
            saved = manager.load_session_record(session_id)

        self.assertIsInstance(result, CompressionResult)
        assert result is not None
        self.assertEqual(result.compressed_message_count, 2)
        self.assertEqual(result.kept_recent_turn_count, 1)
        self.assertEqual(
            saved["messages"],
            [{"role": "user", "content": "turn 2 user"}],
        )

    async def test_compress_if_needed_keeps_multi_message_assistant_turn_together(self):
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = self._create_base_dir(tmp)
            manager = SessionManager(base_dir)
            session = manager.create_session("Multi Assistant Turn")
            session_id = str(session["id"])

            manager.save_message(session_id, "user", "turn 1 user")
            manager.save_message(
                session_id,
                "assistant",
                "turn 1 assistant A",
                reasoning_content="turn 1 reasoning",
            )
            manager.save_message(
                session_id,
                "assistant",
                "turn 1 assistant B",
                tool_calls=[{"id": "call-1b", "type": "tool"}],
            )
            manager.save_message(session_id, "user", "turn 2 user")
            manager.save_message(
                session_id,
                "assistant",
                "turn 2 assistant A",
                reasoning_content="turn 2 reasoning",
            )
            manager.save_message(
                session_id,
                "assistant",
                "turn 2 assistant B",
                tool_calls=[{"id": "call-2b", "type": "tool"}],
            )

            compressor = ContextCompressor(
                session_manager=manager,
                base_dir=base_dir,
                rag_mode_getter=lambda: False,
                target_budget_tokens=1,
                keep_recent_turns=1,
                summary_max_chars=1_200,
                summarizer=AsyncMock(
                    return_value=structured_summary(
                        "multi assistant summary",
                        "confirmed facts",
                        "key decisions",
                        "completed work",
                        "open issues",
                        "next steps",
                    )
                ),
            )

            result = await compressor.compress_if_needed(session_id)
            saved = manager.load_session_record(session_id)

        self.assertIsInstance(result, CompressionResult)
        assert result is not None
        self.assertEqual(result.compressed_message_count, 3)
        self.assertEqual(result.kept_recent_turn_count, 1)
        self.assertEqual(
            saved["messages"],
            [
                {"role": "user", "content": "turn 2 user"},
                {
                    "role": "assistant",
                    "content": "turn 2 assistant A",
                    "reasoning_content": "turn 2 reasoning",
                },
                {
                    "role": "assistant",
                    "content": "turn 2 assistant B",
                    "tool_calls": [{"id": "call-2b", "type": "tool"}],
                },
            ],
        )

    async def test_force_compress_repairs_partial_summary_and_marks_degraded(self):
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = self._create_base_dir(tmp)
            manager = SessionManager(base_dir)
            session = manager.create_session("Partial Repair")
            session_id = str(session["id"])

            manager.save_message(session_id, "user", "turn 1 user")
            manager.save_message(session_id, "assistant", "turn 1 assistant")
            manager.save_message(session_id, "user", "turn 2 user")
            manager.save_message(session_id, "assistant", "turn 2 assistant")

            saved_before = manager.load_session_record(session_id)
            saved_before["compressed_context"] = structured_summary(
                "old goal",
                "old facts",
                "old decisions",
                "old work",
                "old issues",
                "old steps",
            )
            manager._write_session(saved_before)

            compressor = ContextCompressor(
                session_manager=manager,
                base_dir=base_dir,
                rag_mode_getter=lambda: False,
                target_budget_tokens=999_999,
                keep_recent_turns=1,
                summary_max_chars=1_200,
                summarizer=AsyncMock(return_value="## Current goal\nupdated goal"),
            )

            result = await compressor.force_compress(session_id=session_id, reason="manual_request")
            saved = manager.load_session_record(session_id)

        self.assertTrue(result.degraded)
        self.assertTrue(saved["compression_state"]["degraded"])
        self.assertTrue(saved["compression_events"][-1]["degraded"])
        self.assertIn("updated goal", saved["compressed_context"])
        self.assertIn("## Confirmed facts", saved["compressed_context"])

    async def test_force_compress_repairs_empty_summary_and_marks_degraded(self):
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = self._create_base_dir(tmp)
            manager = SessionManager(base_dir)
            session = manager.create_session("Empty Repair")
            session_id = str(session["id"])

            manager.save_message(session_id, "user", "turn 1 user")
            manager.save_message(session_id, "assistant", "turn 1 assistant")
            manager.save_message(session_id, "user", "turn 2 user")

            compressor = ContextCompressor(
                session_manager=manager,
                base_dir=base_dir,
                rag_mode_getter=lambda: False,
                target_budget_tokens=999_999,
                keep_recent_turns=1,
                summary_max_chars=1_200,
                summarizer=AsyncMock(return_value=""),
            )

            result = await compressor.force_compress(session_id=session_id, reason="manual_request")
            saved = manager.load_session_record(session_id)

        self.assertTrue(result.degraded)
        self.assertTrue(saved["compression_state"]["degraded"])
        self.assertTrue(saved["compression_events"][-1]["degraded"])
        self.assertEqual(result.kept_recent_turn_count, 0)
        self.assertEqual(saved["messages"], [])
        self.assertIn("## Current goal", saved["compressed_context"])
        self.assertIn("turn 2 user", saved["compressed_context"])


if __name__ == "__main__":
    unittest.main()
