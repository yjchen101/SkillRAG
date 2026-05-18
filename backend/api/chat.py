from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from api.chat_logger import ChatPromptLogger
from config import get_settings, runtime_config
from graph.agent import agent_manager
from graph.prompt_builder import build_system_prompt

router = APIRouter()


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    session_id: str
    stream: bool = True


def _sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _new_segment() -> dict[str, Any]:
    return {"content": "", "tool_calls": [], "retrieval_steps": [], "reasoning_content": ""}


def _build_full_prompt(
    base_dir: Any,
    rag_mode: bool,
    history: list[dict[str, Any]],
    message: str,
    tools: list[Any] | None = None,
    mcp_tool_summaries: list[dict[str, str]] | None = None,
) -> str:
    system = build_system_prompt(base_dir, rag_mode)
    lines = [f"system:\n{system}"]

    if tools:
        lines.append("\n--- tools ---")
        for tool in tools:
            schema_type = tool.get_input_schema()
            if hasattr(schema_type, "model_json_schema") and callable(getattr(schema_type, "model_json_schema")):
                schema = schema_type.model_json_schema()
            else:
                schema = schema_type.schema()
            lines.append(
                json.dumps(
                    {
                        "name": tool.name,
                        "description": tool.description,
                        "parameters": schema,
                    },
                    indent=2,
                    ensure_ascii=False,
                )
            )

    if mcp_tool_summaries:
        lines.append("\n--- mcp catalog ---")
        for item in mcp_tool_summaries:
            lines.append(json.dumps(item, indent=2, ensure_ascii=False))

    if history:
        lines.append("\n--- history ---")
        for msg in history:
            role = msg.get("role", "unknown")
            content = str(msg.get("content", ""))
            lines.append(f"{role}: {content}")

    lines.append(f"\n--- current ---\nuser: {message}")
    return "\n".join(lines)


@router.post("/chat")
async def chat(payload: ChatRequest):
    session_manager = agent_manager.session_manager
    if session_manager is None:
        raise HTTPException(status_code=503, detail="Agent manager is not initialized")

    history_record = session_manager.load_session_record(payload.session_id)
    history = session_manager.load_session_for_agent(payload.session_id)
    is_first_user_message = not any(
        message.get("role") == "user"
        for message in history_record.get("messages", [])
    )

    prompt_logger = ChatPromptLogger(payload.session_id)
    include_reasoning_content = get_settings().llm_provider == "deepseek"

    if agent_manager.base_dir is not None:
        full_prompt = _build_full_prompt(
            agent_manager.base_dir,
            runtime_config.get_rag_mode(),
            history,
            payload.message,
            tools=agent_manager.tools,
            mcp_tool_summaries=agent_manager.get_mcp_tool_summaries(),
        )
        prompt_logger.log_prompt(full_prompt)

    async def event_generator():
        segments: list[dict[str, Any]] = []
        current_segment = _new_segment()
        conversation_saved = False

        def persist_segments(fallback_content: str | None = None) -> None:
            nonlocal current_segment, conversation_saved
            if conversation_saved:
                return

            if fallback_content:
                if current_segment["content"].strip():
                    current_segment["content"] = (
                        f"{current_segment['content'].rstrip()}\n\n{fallback_content}"
                    )
                else:
                    current_segment["content"] = fallback_content

            if (
                current_segment["content"].strip()
                or current_segment["tool_calls"]
                or current_segment["retrieval_steps"]
            ):
                segments.append(current_segment)
                current_segment = _new_segment()

            session_manager.save_message(payload.session_id, "user", payload.message)
            for segment in segments:
                session_manager.save_message(
                    payload.session_id,
                    "assistant",
                    segment["content"],
                    tool_calls=segment["tool_calls"] or None,
                    retrieval_steps=segment["retrieval_steps"] or None,
                    reasoning_content=(
                        segment["reasoning_content"] if include_reasoning_content else None
                    ),
                )

            conversation_saved = True

        try:
            async for event in agent_manager.astream(payload.message, history):
                event_type = event["type"]

                if event_type == "token":
                    current_segment["content"] += event.get("content", "")
                elif event_type == "tool_start":
                    event_reasoning = str(event.get("reasoning_content", "") or "")
                    if include_reasoning_content and event_reasoning and not current_segment["reasoning_content"]:
                        current_segment["reasoning_content"] = event_reasoning
                    current_segment["tool_calls"].append(
                        {
                            "id": event.get("tool_call_id", ""),
                            "tool": event.get("tool", "tool"),
                            "input": event.get("input", ""),
                            "output": "",
                        }
                    )
                elif event_type == "tool_end":
                    if current_segment["tool_calls"]:
                        current_segment["tool_calls"][-1]["output"] = event.get("output", "")
                elif event_type == "retrieval":
                    current_segment["retrieval_steps"].append(
                        {
                            "kind": event.get("kind", "knowledge"),
                            "stage": event.get("stage", "unknown"),
                            "title": event.get("title", "检索结果"),
                            "message": event.get("message", ""),
                            "results": event.get("results", []),
                        }
                    )
                elif event_type == "new_response":
                    if (
                        current_segment["content"].strip()
                        or current_segment["tool_calls"]
                        or current_segment["retrieval_steps"]
                    ):
                        segments.append(current_segment)
                    current_segment = _new_segment()
                elif event_type == "done":
                    if not current_segment["content"].strip() and event.get("content"):
                        current_segment["content"] = event["content"]
                    if include_reasoning_content and event.get("reasoning_content"):
                        current_segment["reasoning_content"] = str(event["reasoning_content"])
                    persist_segments()

                data = {key: value for key, value in event.items() if key != "type"}
                if not include_reasoning_content:
                    data.pop("reasoning_content", None)
                prompt_logger.log_event(event_type, data)
                yield _sse(event_type, data)

                if event_type == "done" and is_first_user_message:
                    title = await agent_manager.generate_title(payload.message)
                    session_manager.set_title(payload.session_id, title)
                    title_data = {"session_id": payload.session_id, "title": title}
                    prompt_logger.log_event("title", title_data)
                    yield _sse("title", title_data)
        except Exception as exc:
            persist_segments(fallback_content=f"请求失败: {str(exc) or 'unknown error'}")
            prompt_logger.log_error(str(exc) or "unknown error")
            yield _sse("error", {"error": str(exc)})
        else:
            prompt_logger.log_done()

    if payload.stream:
        return StreamingResponse(event_generator(), media_type="text/event-stream")

    final_text = ""
    async for raw_event in event_generator():
        if raw_event.startswith("event: done"):
            final_text = raw_event
    return JSONResponse({"content": final_text})
