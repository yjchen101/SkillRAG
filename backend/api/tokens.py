from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from config import runtime_config
from graph.agent import agent_manager
from graph.prompt_budget import count_text_tokens, estimate_persisted_prompt_budget
from graph.prompt_builder import build_system_prompt

router = APIRouter()


class FileTokensRequest(BaseModel):
    paths: list[str] = Field(default_factory=list)


@router.get("/tokens/session/{session_id}")
async def session_tokens(session_id: str) -> dict[str, int]:
    session_manager = agent_manager.session_manager
    if session_manager is None or agent_manager.base_dir is None:
        raise HTTPException(status_code=503, detail="Agent manager is not initialized")

    record = session_manager.get_history(session_id)
    system_prompt = build_system_prompt(agent_manager.base_dir, runtime_config.get_rag_mode())
    budget = estimate_persisted_prompt_budget(system_prompt=system_prompt, record=record)
    return {
        "system_tokens": budget.system_tokens,
        "compressed_context_tokens": budget.compressed_context_tokens,
        "message_tokens": budget.message_tokens,
        "total_tokens": budget.total_tokens,
    }


@router.post("/tokens/files")
async def file_tokens(payload: FileTokensRequest) -> dict[str, Any]:
    if agent_manager.base_dir is None:
        raise HTTPException(status_code=503, detail="Agent manager is not initialized")

    files: list[dict[str, Any]] = []
    total = 0
    for relative_path in payload.paths:
        path = (agent_manager.base_dir / relative_path).resolve()
        if not path.exists() or path.is_dir():
            continue
        count = count_text_tokens(path.read_text(encoding="utf-8"))
        total += count
        files.append({"path": relative_path, "tokens": count})

    return {"files": files, "total_tokens": total}
