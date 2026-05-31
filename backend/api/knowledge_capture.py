from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from graph.agent import agent_manager
from graph.session_manager import SessionManager

router = APIRouter()


class CaptureKnowledgeRequest(BaseModel):
    session_id: str = Field(..., min_length=1)
    message_index: int = Field(..., ge=0)
    title: str | None = Field(default=None, max_length=120)


class CaptureKnowledgeResponse(BaseModel):
    ok: bool
    path: str
    title: str


def _json_quote(value: Any) -> str:
    return json.dumps(str(value), ensure_ascii=False)


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "knowledge-capture"


def _derive_title(message: dict[str, Any], session_title: str) -> str:
    content = str(message.get("content", "")).strip()
    first_line = next((line.strip("# ").strip() for line in content.splitlines() if line.strip()), "")
    return first_line[:80] or session_title.strip() or "Knowledge Capture"


def _iter_evidence(message: dict[str, Any]) -> list[dict[str, Any]]:
    evidence: list[dict[str, Any]] = []
    for step in message.get("retrieval_steps") or []:
        if not isinstance(step, dict):
            continue
        for item in step.get("results") or []:
            if isinstance(item, dict):
                evidence.append(item)
    return evidence


def build_knowledge_markdown(
    *,
    record: dict[str, Any],
    message: dict[str, Any],
    message_index: int,
    title: str,
    captured_at: datetime,
) -> str:
    evidence = _iter_evidence(message)
    session_id = str(record.get("id", ""))
    session_title = str(record.get("title", "新会话"))
    captured_iso = captured_at.isoformat()

    lines = [
        "---",
        f"title: {_json_quote(title)}",
        'source: "chat"',
        f"source_session_id: {_json_quote(session_id)}",
        f"source_session_title: {_json_quote(session_title)}",
        f"source_message_index: {message_index}",
        f"captured_at: {_json_quote(captured_iso)}",
        f"evidence_count: {len(evidence)}",
        "---",
        "",
        f"# {title}",
        "",
        "## Source",
        "",
        f"- Session: `{session_id}`",
        f"- Session title: {session_title}",
        f"- Message index: `{message_index}`",
        f"- Captured at: `{captured_iso}`",
        "",
        "## Answer",
        "",
        str(message.get("content", "")).strip(),
        "",
    ]

    lines.extend(["## Retrieval Evidence", ""])
    if evidence:
        for index, item in enumerate(evidence, start=1):
            score = item.get("score")
            score_text = f", score {score}" if isinstance(score, (int, float)) else ""
            source_path = str(item.get("source_path", "unknown source"))
            channel = str(item.get("channel", "unknown"))
            locator = str(item.get("locator", "")).strip()
            snippet = str(item.get("snippet", "")).strip()
            lines.append(f"{index}. `{source_path}` ({channel}{score_text})")
            if locator:
                lines.append(f"   - Locator: `{locator}`")
            if snippet:
                lines.append(f"   - Snippet: {snippet}")
    else:
        lines.append("No retrieval evidence was attached to this message.")
    lines.append("")

    tool_calls = [item for item in message.get("tool_calls") or [] if isinstance(item, dict)]
    lines.extend(["## Tool Calls", ""])
    if tool_calls:
        for index, item in enumerate(tool_calls, start=1):
            lines.append(f"{index}. `{item.get('tool', 'tool')}`")
            input_text = str(item.get("input", "")).strip()
            output_text = str(item.get("output", "")).strip()
            if input_text:
                lines.append(f"   - Input: `{input_text}`")
            if output_text:
                lines.append(f"   - Output: {output_text[:500]}")
    else:
        lines.append("No tool calls were attached to this message.")
    lines.append("")

    return "\n".join(lines)


def _unique_capture_path(captures_dir: Path, captured_at: datetime, title: str) -> Path:
    stamp = captured_at.strftime("%Y%m%d-%H%M%S")
    slug = _slugify(title)
    candidate = captures_dir / f"{stamp}-{slug}.md"
    counter = 2
    while candidate.exists():
        candidate = captures_dir / f"{stamp}-{slug}-{counter}.md"
        counter += 1
    return candidate


def capture_assistant_message(
    *,
    session_manager: SessionManager,
    base_dir: Path,
    session_id: str,
    message_index: int,
    title: str | None = None,
    captured_at: datetime | None = None,
) -> dict[str, str]:
    record = session_manager.load_session_record(session_id)
    messages = record.get("messages") or []
    if message_index >= len(messages):
        raise ValueError("Message index is out of range")

    message = messages[message_index]
    if not isinstance(message, dict) or message.get("role") != "assistant":
        raise ValueError("Only assistant messages can be captured as knowledge")

    content = str(message.get("content", "")).strip()
    if not content:
        raise ValueError("Assistant message content is empty")

    final_title = (title or "").strip() or _derive_title(message, str(record.get("title", "")))
    now = captured_at or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    captures_dir = base_dir / "knowledge" / "chat-captures"
    captures_dir.mkdir(parents=True, exist_ok=True)
    target_path = _unique_capture_path(captures_dir, now, final_title)
    markdown = build_knowledge_markdown(
        record=record,
        message=message,
        message_index=message_index,
        title=final_title,
        captured_at=now,
    )
    target_path.write_text(markdown, encoding="utf-8")

    relative_path = target_path.relative_to(base_dir).as_posix()
    return {"path": relative_path, "title": final_title}


@router.post("/knowledge/captures")
async def capture_knowledge(payload: CaptureKnowledgeRequest) -> CaptureKnowledgeResponse:
    session_manager = agent_manager.session_manager
    if session_manager is None or agent_manager.base_dir is None:
        raise HTTPException(status_code=503, detail="Agent manager is not initialized")

    try:
        result = capture_assistant_message(
            session_manager=session_manager,
            base_dir=agent_manager.base_dir,
            session_id=payload.session_id,
            message_index=payload.message_index,
            title=payload.title,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return CaptureKnowledgeResponse(ok=True, **result)
