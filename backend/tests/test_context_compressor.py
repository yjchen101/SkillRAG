from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from graph.session_manager import SessionManager


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


if __name__ == "__main__":
    unittest.main()
