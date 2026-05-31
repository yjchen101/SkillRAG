from __future__ import annotations

import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from api.knowledge_capture import capture_assistant_message
from graph.session_manager import SessionManager


class KnowledgeCaptureTests(unittest.TestCase):
    def test_capture_assistant_message_writes_auditable_markdown(self):
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = Path(tmp)
            manager = SessionManager(base_dir)
            session = manager.create_session(title="知识沉淀测试")
            session_id = session["id"]
            manager.save_message(session_id, "user", "总结这份资料")
            manager.save_message(
                session_id,
                "assistant",
                "这是可以沉淀的回答。",
                tool_calls=[
                    {
                        "tool": "read_file",
                        "input": "knowledge/report.md",
                        "output": "loaded report",
                    }
                ],
                retrieval_steps=[
                    {
                        "kind": "knowledge",
                        "stage": "fused",
                        "title": "融合检索",
                        "message": "找到 1 条证据",
                        "results": [
                            {
                                "source_path": "knowledge/report.md",
                                "source_type": "markdown",
                                "locator": "L10-L14",
                                "snippet": "原始证据片段",
                                "channel": "fused",
                                "score": 0.42,
                                "parent_id": None,
                            }
                        ],
                    }
                ],
            )

            result = capture_assistant_message(
                session_manager=manager,
                base_dir=base_dir,
                session_id=session_id,
                message_index=1,
                title="可复用知识",
                captured_at=datetime(2026, 5, 31, 12, 0, tzinfo=timezone.utc),
            )

            output_path = base_dir / result["path"]
            output_exists = output_path.exists()
            content = output_path.read_text(encoding="utf-8")

        self.assertEqual(result["title"], "可复用知识")
        self.assertEqual(result["path"], "knowledge/chat-captures/20260531-120000-knowledge-capture.md")
        self.assertTrue(output_exists)
        self.assertIn('title: "可复用知识"', content)
        self.assertIn(f'source_session_id: "{session_id}"', content)
        self.assertIn("source_message_index: 1", content)
        self.assertIn("evidence_count: 1", content)
        self.assertIn("## Answer", content)
        self.assertIn("这是可以沉淀的回答。", content)
        self.assertIn("knowledge/report.md", content)
        self.assertIn("原始证据片段", content)
        self.assertIn("read_file", content)

    def test_capture_rejects_user_messages(self):
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = Path(tmp)
            manager = SessionManager(base_dir)
            session = manager.create_session(title="知识沉淀测试")
            session_id = session["id"]
            manager.save_message(session_id, "user", "不要沉淀用户消息")

            with self.assertRaises(ValueError):
                capture_assistant_message(
                    session_manager=manager,
                    base_dir=base_dir,
                    session_id=session_id,
                    message_index=0,
                    captured_at=datetime(2026, 5, 31, 12, 0, tzinfo=timezone.utc),
                )


if __name__ == "__main__":
    unittest.main()
