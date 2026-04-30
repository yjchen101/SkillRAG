from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

STORAGE_DIR = Path(__file__).resolve().parent.parent / "storage" / "chat_logs"


class ChatPromptLogger:
    """Logs the full prompt sent to the LLM and every response event.

    Writes to storage/chat_logs/YYYY-MM-DD/<session_id>.jsonl with one JSON
    line per event. Each line has a `kind` field to distinguish the type:

      kind="prompt"   — the full prompt sent to the LLM
      kind="event"    — a streaming response event (token, tool_start, etc.)
      kind="error"    — an error that occurred during streaming
      kind="done"     — interaction completed successfully
    """

    def __init__(self, session_id: str) -> None:
        self.session_id = session_id
        today = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d")
        log_dir = STORAGE_DIR / today
        log_dir.mkdir(parents=True, exist_ok=True)
        self._path = log_dir / f"{session_id}.jsonl"

    def log_prompt(self, full_prompt: str) -> None:
        self._write("prompt", {"full_prompt": full_prompt})

    def log_event(self, event_type: str, data: dict[str, Any]) -> None:
        self._write("event", {"type": event_type, **data})

    def log_error(self, error: str) -> None:
        self._write("error", {"error": error})

    def log_done(self, extra: dict[str, Any] | None = None) -> None:
        self._write("done", extra or {})

    def _write(self, kind: str, payload: dict[str, Any]) -> None:
        line = {
            "timestamp": datetime.now(timezone.utc).astimezone().isoformat(),
            "session_id": self.session_id,
            "kind": kind,
            "payload": payload,
        }
        with open(self._path, "a", encoding="utf-8") as f:
            f.write(json.dumps(line, ensure_ascii=False) + "\n")
