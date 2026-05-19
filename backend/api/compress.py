from __future__ import annotations

from fastapi import APIRouter, HTTPException

from graph.agent import agent_manager

router = APIRouter()


@router.post("/sessions/{session_id}/compress")
async def compress_session(session_id: str) -> dict[str, int | str | bool]:
    compressor = agent_manager.context_compressor
    if compressor is None:
        raise HTTPException(status_code=503, detail="Context compressor is not initialized")

    try:
        result = await compressor.force_compress(session_id=session_id, reason="manual_request")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to compress session") from exc

    return result.to_dict()
