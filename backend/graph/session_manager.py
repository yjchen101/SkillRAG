from __future__ import annotations

import json
import os
import time
import uuid
from pathlib import Path
from typing import Any


class SessionManager:
    def __init__(self, base_dir: Path) -> None:
        self.base_dir = base_dir
        self.sessions_dir = base_dir / "sessions"
        self.archive_dir = self.sessions_dir / "archive"
        self.sessions_dir.mkdir(parents=True, exist_ok=True)
        self.archive_dir.mkdir(parents=True, exist_ok=True)

    def _session_path(self, session_id: str) -> Path:
        return self.sessions_dir / f"{session_id}.json"

    def _archive_path(self, session_id: str, archived_at: float) -> Path:
        return self.archive_dir / f"{session_id}_{int(archived_at)}_{uuid.uuid4().hex[:8]}.json"

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

    def _write_session(self, record: dict[str, Any]) -> None:
        session_id = str(record["id"])
        record["updated_at"] = time.time()
        target_path = self._session_path(session_id)
        temp_path = target_path.with_name(f"{target_path.name}.{uuid.uuid4().hex}.tmp")
        temp_path.write_text(
            json.dumps(record, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        os.replace(temp_path, target_path)

    def create_session(self, title: str = "新会话") -> dict[str, Any]:
        session_id = uuid.uuid4().hex
        record = self._default_record(session_id, title=title)
        self._write_session(record)
        return record

    def list_sessions(self) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        for path in self.sessions_dir.glob("*.json"):
            if path.parent == self.archive_dir:
                continue
            try:
                record = json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                continue
            records.append(
                {
                    "id": record.get("id", path.stem),
                    "title": record.get("title", "新会话"),
                    "created_at": record.get("created_at"),
                    "updated_at": record.get("updated_at"),
                    "message_count": len(record.get("messages", [])),
                }
            )
        return sorted(records, key=lambda item: item.get("updated_at") or 0, reverse=True)

    def load_session_record(self, session_id: str) -> dict[str, Any]:
        return self._read_session_file(session_id)

    def load_session(self, session_id: str) -> list[dict[str, Any]]:
        return self._read_session_file(session_id)["messages"]

    def load_session_for_agent(self, session_id: str) -> list[dict[str, Any]]:
        record = self._read_session_file(session_id)
        merged: list[dict[str, Any]] = []

        compressed_context = record.get("compressed_context", "").strip()
        if compressed_context:
            merged.append(
                {
                    "role": "assistant",
                    "content": f"[以下是之前对话的摘要]\n{compressed_context}",
                }
            )

        for message in record.get("messages", []):
            role = message.get("role", "")
            content = str(message.get("content", "") or "")
            reasoning_content = str(message.get("reasoning_content", "") or "").strip()
            payload: dict[str, Any] = {"role": role, "content": content}
            if role == "assistant" and reasoning_content:
                payload["reasoning_content"] = reasoning_content
            if role == "assistant" and isinstance(message.get("tool_calls"), list):
                payload["tool_calls"] = message.get("tool_calls", [])
            merged.append(payload)

        return [item for item in merged if item["role"] in {"user", "assistant"}]

    def save_message(
        self,
        session_id: str,
        role: str,
        content: str,
        tool_calls: list[dict[str, Any]] | None = None,
        retrieval_steps: list[dict[str, Any]] | None = None,
        reasoning_content: str | None = None,
    ) -> dict[str, Any]:
        record = self._read_session_file(session_id)
        message: dict[str, Any] = {"role": role, "content": content}
        if tool_calls:
            message["tool_calls"] = tool_calls
        if retrieval_steps:
            message["retrieval_steps"] = retrieval_steps
        if role == "assistant" and reasoning_content and reasoning_content.strip():
            message["reasoning_content"] = reasoning_content.strip()
        record["messages"].append(message)
        self._write_session(record)
        return message

    def get_history(self, session_id: str) -> dict[str, Any]:
        return self._read_session_file(session_id)

    def rename_session(self, session_id: str, title: str) -> dict[str, Any]:
        record = self._read_session_file(session_id)
        record["title"] = title.strip() or "新会话"
        self._write_session(record)
        return record

    def set_title(self, session_id: str, title: str) -> dict[str, Any]:
        return self.rename_session(session_id, title)

    def delete_session(self, session_id: str) -> None:
        path = self._session_path(session_id)
        if path.exists():
            path.unlink()

    def apply_compression(
        self,
        session_id: str,
        fresh_summary: str,
        kept_messages: list[dict[str, Any]],
        archived_messages: list[dict[str, Any]],
        compression_state: dict[str, Any] | None = None,
        compression_event: dict[str, Any] | None = None,
    ) -> dict[str, int]:
        record = self._read_session_file(session_id)
        current_messages = list(record.get("messages", []))
        rewritten_messages = list(archived_messages) + list(kept_messages)
        if rewritten_messages != current_messages:
            raise ValueError(
                "archived_messages and kept_messages must exactly rewrite the current session messages"
            )

        archived_at = time.time()
        archive_path = self._archive_path(session_id, archived_at)
        archive_payload = {
            "session_id": session_id,
            "archived_at": archived_at,
            "messages": archived_messages,
        }
        archive_path.write_text(
            json.dumps(archive_payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        record["compressed_context"] = fresh_summary.strip()
        record["messages"] = list(kept_messages)
        record["compression_state"] = dict(compression_state or {})
        events = list(record.get("compression_events", []))
        if compression_event:
            events.append(dict(compression_event))
        record["compression_events"] = events
        try:
            self._write_session(record)
        except Exception:
            if archive_path.exists():
                archive_path.unlink()
            raise
        return {
            "archived_count": len(archived_messages),
            "remaining_count": len(kept_messages),
        }

    def compress_history(self, session_id: str, summary: str, n_messages: int) -> dict[str, int]:
        record = self._read_session_file(session_id)
        messages = record.get("messages", [])
        archived = messages[:n_messages]
        remaining = messages[n_messages:]

        existing_summary = record.get("compressed_context", "").strip()
        if existing_summary:
            fresh_summary = f"{existing_summary}\n---\n{summary.strip()}"
        else:
            fresh_summary = summary.strip()

        return self.apply_compression(
            session_id=session_id,
            fresh_summary=fresh_summary,
            kept_messages=remaining,
            archived_messages=archived,
            compression_state=dict(record.get("compression_state", {})),
            compression_event=None,
        )

    def get_compressed_context(self, session_id: str) -> str:
        return self._read_session_file(session_id).get("compressed_context", "")
