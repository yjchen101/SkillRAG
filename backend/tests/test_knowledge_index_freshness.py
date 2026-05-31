from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from knowledge_retrieval.indexer import KnowledgeIndexer


class KnowledgeIndexFreshnessTests(unittest.TestCase):
    def test_status_reports_fresh_after_rebuild(self):
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = Path(tmp)
            knowledge_dir = base_dir / "knowledge"
            knowledge_dir.mkdir()
            (knowledge_dir / "note.md").write_text("# Note\n\nIndexed content", encoding="utf-8")
            indexer = KnowledgeIndexer()
            indexer.configure(base_dir)

            with patch.object(indexer, "_build_vector_index"):
                indexer.rebuild_index()

            status = indexer.status()

        self.assertFalse(status.needs_rebuild)
        self.assertEqual(status.stale_files, 0)
        self.assertEqual(status.indexed_files, 1)
        self.assertIsNotNone(status.latest_source_mtime)

    def test_status_reports_newer_source_file_as_stale(self):
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = Path(tmp)
            knowledge_dir = base_dir / "knowledge"
            knowledge_dir.mkdir()
            note_path = knowledge_dir / "note.md"
            note_path.write_text("# Note\n\nIndexed content", encoding="utf-8")
            indexer = KnowledgeIndexer()
            indexer.configure(base_dir)

            with patch.object(indexer, "_build_vector_index"):
                indexer.rebuild_index()

            assert indexer._last_built_at is not None
            os.utime(note_path, (indexer._last_built_at + 10, indexer._last_built_at + 10))

            status = indexer.status()

        self.assertTrue(status.needs_rebuild)
        self.assertEqual(status.stale_files, 1)

    def test_status_reports_new_source_file_as_stale(self):
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = Path(tmp)
            knowledge_dir = base_dir / "knowledge"
            knowledge_dir.mkdir()
            (knowledge_dir / "note.md").write_text("# Note\n\nIndexed content", encoding="utf-8")
            indexer = KnowledgeIndexer()
            indexer.configure(base_dir)

            with patch.object(indexer, "_build_vector_index"):
                indexer.rebuild_index()

            (knowledge_dir / "new-note.md").write_text("# New\n\nFresh content", encoding="utf-8")

            status = indexer.status()

        self.assertTrue(status.needs_rebuild)
        self.assertEqual(status.stale_files, 1)


if __name__ == "__main__":
    unittest.main()
