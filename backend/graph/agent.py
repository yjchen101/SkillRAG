from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any

from langchain.agents import create_agent
from langchain_core.messages.utils import convert_to_messages
from langchain_openai import ChatOpenAI

try:
    from langchain_deepseek import ChatDeepSeek
except ImportError:  # pragma: no cover - optional dependency at runtime
    ChatDeepSeek = None

from config import get_settings, runtime_config
from graph.memory_indexer import memory_indexer
from graph.prompt_builder import build_system_prompt
from graph.session_manager import SessionManager
from knowledge_retrieval import knowledge_orchestrator
from tools import get_all_tools

KNOWLEDGE_SKILL_PATTERNS = (
    re.compile(r"知识库"),
    re.compile(r"\bknowledge\b", re.IGNORECASE),
    re.compile(r"根据.+?(知识库|文档|资料)"),
    re.compile(r"(查|检索).+?(文档|资料|报告|白皮书)"),
    re.compile(r"\.(pdf|xlsx|xls|json)\b", re.IGNORECASE),
)

logger = logging.getLogger(__name__)


def _stringify_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(str(block.get("text", "")))
        return "".join(parts)
    return str(content or "")


def _extract_reasoning_content(message: Any) -> str:
    direct = getattr(message, "reasoning_content", None)
    if isinstance(direct, str) and direct.strip():
        return direct.strip()

    additional_kwargs = getattr(message, "additional_kwargs", None)
    if isinstance(additional_kwargs, dict):
        raw = additional_kwargs.get("reasoning_content")
        if isinstance(raw, str) and raw.strip():
            return raw.strip()

    response_metadata = getattr(message, "response_metadata", None)
    if isinstance(response_metadata, dict):
        raw = response_metadata.get("reasoning_content")
        if isinstance(raw, str) and raw.strip():
            return raw.strip()

    return ""


class AgentManager:
    def __init__(self) -> None:
        self.base_dir: Path | None = None
        self.session_manager: SessionManager | None = None
        self.tools = []
        self.tool_metadata: dict[str, dict[str, Any]] = {}

    def initialize(
        self,
        base_dir: Path,
        *,
        mcp_tools: list[Any] | None = None,
        mcp_tool_metadata: dict[str, dict[str, Any]] | None = None,
    ) -> None:
        self.base_dir = base_dir
        self.session_manager = SessionManager(base_dir)
        self.tools = get_all_tools(base_dir, mcp_tools=mcp_tools)
        self.tool_metadata = dict(mcp_tool_metadata or {})
        knowledge_orchestrator.configure(base_dir, self._build_chat_model)

    def _build_chat_model(self):
        settings = get_settings()

        if settings.llm_provider == "deepseek":
            if ChatDeepSeek is None:
                raise RuntimeError("langchain-deepseek is not installed")
            if not settings.llm_api_key:
                raise RuntimeError("Missing API key for provider deepseek")
            return PatchedChatDeepSeek(
                model=settings.llm_model,
                api_key=settings.llm_api_key,
                base_url=settings.llm_base_url,
                temperature=0,
            )

        if not settings.llm_api_key:
            raise RuntimeError(f"Missing API key for provider {settings.llm_provider}")

        return ChatOpenAI(
            model=settings.llm_model,
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
            temperature=0,
        )

    def _build_agent(
        self,
        extra_instructions: list[str] | None = None,
        tools_override: list[Any] | None = None,
    ):
        if self.base_dir is None:
            raise RuntimeError("AgentManager is not initialized")

        system_prompt = build_system_prompt(self.base_dir, runtime_config.get_rag_mode())
        if extra_instructions:
            system_prompt = f"{system_prompt}\n\n" + "\n\n".join(extra_instructions)
        return create_agent(
            model=self._build_chat_model(),
            tools=self.tools if tools_override is None else tools_override,
            system_prompt=system_prompt,
        )

    def _is_knowledge_query(self, message: str) -> bool:
        return any(pattern.search(message) for pattern in KNOWLEDGE_SKILL_PATTERNS)

    def _build_messages(
        self,
        history: list[dict[str, Any]],
        include_tool_messages: bool = True,
        include_reasoning_content: bool = False,
    ) -> list[dict[str, Any]]:
        messages: list[dict[str, Any]] = []
        for item in history:
            role = item.get("role")
            if role not in {"user", "assistant"}:
                continue
            message: dict[str, Any] = {"role": role, "content": str(item.get("content", ""))}
            normalized_call_ids: list[str] = []
            reasoning_content = str(item.get("reasoning_content", "") or "").strip()
            if role == "assistant" and include_reasoning_content and reasoning_content:
                message["reasoning_content"] = reasoning_content
            tool_calls = item.get("tool_calls")
            if role == "assistant" and isinstance(tool_calls, list) and tool_calls:
                normalized_tool_calls: list[dict[str, Any]] = []
                assistant_index = len(messages)
                for idx, tool_call in enumerate(tool_calls):
                    call_id = str(tool_call.get("id") or f"call_{assistant_index}_{idx}")
                    tool_name = str(tool_call.get("tool", "tool"))
                    tool_input = tool_call.get("input", "")
                    if not isinstance(tool_input, str):
                        tool_input = json.dumps(tool_input, ensure_ascii=False)
                    normalized_tool_calls.append(
                        {
                            "id": call_id,
                            "type": "function",
                            "function": {"name": tool_name, "arguments": str(tool_input)},
                        }
                    )
                    normalized_call_ids.append(call_id)
                message["tool_calls"] = normalized_tool_calls
            messages.append(message)
            if include_tool_messages and role == "assistant" and isinstance(tool_calls, list):
                for idx, tool_call in enumerate(tool_calls):
                    call_id = (
                        normalized_call_ids[idx]
                        if idx < len(normalized_call_ids)
                        else str(tool_call.get("id") or f"call_{len(messages) - 1}_{idx}")
                    )
                    tool_output = str(tool_call.get("output", "") or "")
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": call_id,
                            "content": tool_output,
                        }
                    )
        return messages

    def _format_retrieval_context(self, results: list[dict[str, Any]]) -> str:
        lines = ["[RAG retrieved memory context]"]
        for idx, item in enumerate(results, start=1):
            text = str(item.get("text", "")).strip()
            source = str(item.get("source", "memory/MEMORY.md"))
            lines.append(f"{idx}. Source: {source}\n{text}")
        return "\n\n".join(lines)

    def _format_memory_retrieval_step(self, results: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "kind": "memory",
            "stage": "memory",
            "title": f"Memory 检索到 {len(results)} 条片段",
            "message": "已将 Memory 召回结果注入当前请求上下文。",
            "results": [
                {
                    "source_path": str(item.get("source", "memory/MEMORY.md")),
                    "source_type": "memory",
                    "locator": "memory",
                    "snippet": str(item.get("text", "")).strip(),
                    "channel": "memory",
                    "score": float(item.get("score", 0.0) or 0.0),
                    "parent_id": None,
                }
                for item in results
            ],
        }

    def _format_knowledge_context(self, retrieval_result) -> str:
        lines = ["[Knowledge retrieval evidence]"]
        lines.append(f"Status: {retrieval_result.status}")
        if retrieval_result.reason:
            lines.append(f"Reason: {retrieval_result.reason}")
        if retrieval_result.fallback_used:
            lines.append("Fallback: skill evidence was insufficient, so vector/BM25 retrieval was used.")
        if not retrieval_result.evidences:
            lines.append("No direct evidence was found.")
            return "\n".join(lines)

        for index, evidence in enumerate(retrieval_result.evidences, start=1):
            lines.append(
                f"{index}. [{evidence.channel}] {evidence.source_path} ({evidence.locator})\n{evidence.snippet}"
            )
        return "\n\n".join(lines)

    def _knowledge_answer_instructions(self, retrieval_result) -> list[str]:
        instructions = [
            "This is a knowledge-base question.",
            "Use only the provided knowledge retrieval evidence to answer.",
            "Do not perform additional knowledge-base inspection with tools.",
            "If the evidence is incomplete, explicitly say the current knowledge base only supports a partial answer or no direct answer.",
            "Do not fabricate facts.",
            "When evidence is insufficient, suggest narrowing the scope by directory, file, keyword, field name, or time range.",
            "Cite the file paths you relied on.",
        ]
        if retrieval_result.reason:
            instructions.append(f"Current retrieval note: {retrieval_result.reason}")
        return instructions

    async def _astream_model_answer(
        self,
        messages: list[dict[str, str]],
        extra_instructions: list[str] | None = None,
        include_reasoning_content: bool = False,
    ):
        if self.base_dir is None:
            raise RuntimeError("AgentManager is not initialized")

        system_prompt = build_system_prompt(self.base_dir, runtime_config.get_rag_mode())
        if extra_instructions:
            system_prompt = f"{system_prompt}\n\n" + "\n\n".join(extra_instructions)

        model_messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
        model_messages.extend(messages)

        final_content_parts: list[str] = []
        final_reasoning_parts: list[str] = []
        async for chunk in self._build_chat_model().astream(model_messages):
            text = _stringify_content(getattr(chunk, "content", ""))
            if text:
                final_content_parts.append(text)
                yield {"type": "token", "content": text}
            reasoning_text = _extract_reasoning_content(chunk)
            if include_reasoning_content and reasoning_text:
                final_reasoning_parts.append(reasoning_text)

        done_event: dict[str, Any] = {"type": "done", "content": "".join(final_content_parts).strip()}
        reasoning_content = "\n\n".join(part for part in final_reasoning_parts if part).strip()
        if include_reasoning_content and reasoning_content:
            done_event["reasoning_content"] = reasoning_content
        yield done_event

    async def astream(
        self,
        message: str,
        history: list[dict[str, Any]],
    ):
        if self.base_dir is None:
            raise RuntimeError("AgentManager is not initialized")
        include_reasoning_content = get_settings().llm_provider == "deepseek"

        rag_mode = runtime_config.get_rag_mode()
        augmented_history = list(history)
        if rag_mode:
            retrievals = memory_indexer.retrieve(message, top_k=3)
            if retrievals:
                yield {"type": "retrieval", **self._format_memory_retrieval_step(retrievals)}
            if retrievals:
                augmented_history.append(
                    {
                        "role": "assistant",
                        "content": self._format_retrieval_context(retrievals),
                    }
                )

        if self._is_knowledge_query(message):
            knowledge_result = None
            async for event in knowledge_orchestrator.astream(message):
                if event.get("type") == "orchestrated_result":
                    knowledge_result = event["result"]
                    continue
                yield event

            if knowledge_result is not None:
                for step in knowledge_result.steps:
                    yield {"type": "retrieval", **step.to_dict()}
                augmented_history.append(
                    {
                        "role": "assistant",
                        "content": self._format_knowledge_context(knowledge_result),
                    }
                )

            messages = self._build_messages(
                augmented_history,
                include_tool_messages=False,
                include_reasoning_content=include_reasoning_content,
            )
            messages.append({"role": "user", "content": message})

            async for event in self._astream_model_answer(
                messages,
                extra_instructions=self._knowledge_answer_instructions(knowledge_result) if knowledge_result else None,
                include_reasoning_content=include_reasoning_content,
            ):
                yield event
            return

        agent = self._build_agent()
        messages = self._build_messages(
            augmented_history,
            include_tool_messages=True,
            include_reasoning_content=include_reasoning_content,
        )
        messages.append({"role": "user", "content": message})

        final_content_parts: list[str] = []
        last_ai_message = ""
        last_ai_reasoning = ""
        reasoning_parts: list[str] = []
        pending_tools: dict[str, dict[str, str]] = {}

        async for mode, payload in agent.astream(
            {"messages": messages},
            stream_mode=["messages", "updates"],
        ):
            if mode == "messages":
                chunk, metadata = payload
                chunk_text_preview = _stringify_content(getattr(chunk, "content", ""))[:200]
                logger.debug(
                    "[agent.stream.messages] node=%s chunk_type=%s content_preview=%r",
                    metadata.get("langgraph_node"),
                    type(chunk).__name__,
                    chunk_text_preview,
                )
                if metadata.get("langgraph_node") != "model":
                    continue
                text = _stringify_content(getattr(chunk, "content", ""))
                if text:
                    final_content_parts.append(text)
                    yield {"type": "token", "content": text}
                chunk_reasoning = _extract_reasoning_content(chunk)
                if include_reasoning_content and chunk_reasoning:
                    reasoning_parts.append(chunk_reasoning)
                continue

            if mode != "updates":
                continue

            for update in payload.values():
                for agent_message in update.get("messages", []):
                    message_type = getattr(agent_message, "type", "")
                    tool_calls = getattr(agent_message, "tool_calls", []) or []
                    content_preview = _stringify_content(getattr(agent_message, "content", ""))[:200]
                    logger.debug(
                        "[agent.stream.updates] message_type=%s has_tool_calls=%s tool_calls_count=%s tool_call_id=%s name=%s content_preview=%r",
                        message_type,
                        bool(tool_calls),
                        len(tool_calls),
                        getattr(agent_message, "tool_call_id", ""),
                        getattr(agent_message, "name", ""),
                        content_preview,
                    )

                    if message_type == "ai" and not tool_calls:
                        candidate = _stringify_content(getattr(agent_message, "content", ""))
                        if candidate:
                            last_ai_message = candidate
                        candidate_reasoning = _extract_reasoning_content(agent_message)
                        if include_reasoning_content and candidate_reasoning:
                            last_ai_reasoning = candidate_reasoning
                    elif message_type == "ai" and tool_calls:
                        candidate_reasoning = _extract_reasoning_content(agent_message)
                        if include_reasoning_content and candidate_reasoning:
                            last_ai_reasoning = candidate_reasoning
                            reasoning_parts.append(candidate_reasoning)

                    if tool_calls:
                        for tool_call in tool_calls:
                            call_id = str(tool_call.get("id") or tool_call.get("name"))
                            tool_name = str(tool_call.get("name", "tool"))
                            tool_args = tool_call.get("args", "")
                            if not isinstance(tool_args, str):
                                tool_args = json.dumps(tool_args, ensure_ascii=False)
                            pending_tools[call_id] = {
                                "id": call_id,
                                "tool": tool_name,
                                "input": str(tool_args),
                            }
                            event_payload: dict[str, Any] = {
                                "type": "tool_start",
                                "tool_call_id": call_id,
                                "tool": tool_name,
                                "input": str(tool_args),
                            }
                            tool_meta = self.tool_metadata.get(tool_name, {})
                            if tool_meta.get("provider") == "mcp":
                                event_payload["mcp"] = {
                                    "server": tool_meta.get("server", ""),
                                    "tool": tool_meta.get("source_tool", ""),
                                    "retry_times": tool_meta.get("retry_times", 0),
                                }
                            if include_reasoning_content and last_ai_reasoning:
                                event_payload["reasoning_content"] = last_ai_reasoning
                            yield event_payload

                    if message_type == "tool":
                        tool_call_id = str(getattr(agent_message, "tool_call_id", ""))
                        pending = pending_tools.pop(
                            tool_call_id,
                            {"tool": getattr(agent_message, "name", "tool"), "input": ""},
                        )
                        output = _stringify_content(getattr(agent_message, "content", ""))
                        event_payload = {
                            "type": "tool_end",
                            "tool_call_id": tool_call_id,
                            "tool": pending["tool"],
                            "output": output,
                        }
                        tool_meta = self.tool_metadata.get(str(pending.get("tool", "")), {})
                        if tool_meta.get("provider") == "mcp":
                            degraded = output.startswith("MCP tool degraded:")
                            event_payload["mcp"] = {
                                "server": tool_meta.get("server", ""),
                                "tool": tool_meta.get("source_tool", ""),
                                "retry_times": tool_meta.get("retry_times", 0),
                                "degraded": degraded,
                                "degrade_reason": (
                                    "call failed after retries"
                                    if degraded
                                    else ""
                                ),
                            }
                        yield event_payload
                        yield {"type": "new_response"}

        final_content = "".join(final_content_parts).strip() or last_ai_message.strip()
        final_reasoning = "\n\n".join(part for part in reasoning_parts if part).strip() or last_ai_reasoning.strip()
        done_event: dict[str, Any] = {"type": "done", "content": final_content}
        if include_reasoning_content and final_reasoning:
            done_event["reasoning_content"] = final_reasoning
        yield done_event

    async def generate_title(self, first_user_message: str) -> str:
        prompt = (
            "请根据用户的第一条消息生成一个中文会话标题。"
            "要求不超过 10 个汉字，不要带引号，不要解释。"
        )
        try:
            response = await self._build_chat_model().ainvoke(
                [
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": first_user_message},
                ]
            )
            title = _stringify_content(getattr(response, "content", "")).strip()
            return title[:10] or "新会话"
        except Exception:
            return (first_user_message.strip() or "新会话")[:10]

    async def summarize_history(self, messages: list[dict[str, Any]]) -> str:
        prompt = (
            "请将以下对话压缩成中文摘要，控制在 500 字以内。"
            "重点保留用户目标、已完成步骤、重要结论和未解决事项。"
        )
        lines: list[str] = []
        for item in messages:
            role = item.get("role", "assistant")
            content = str(item.get("content", "") or "")
            if content:
                lines.append(f"{role}: {content}")
        transcript = "\n".join(lines)

        try:
            response = await self._build_chat_model().ainvoke(
                [
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": transcript},
                ]
            )
            summary = _stringify_content(getattr(response, "content", "")).strip()
            return summary[:500]
        except Exception:
            return transcript[:500]


agent_manager = AgentManager()


class PatchedChatDeepSeek(ChatDeepSeek):
    """Ensure DeepSeek thinking-mode reasoning_content is forwarded on assistant turns."""

    def _get_request_payload(self, input_, *, stop=None, **kwargs):  # type: ignore[override]
        payload = super()._get_request_payload(input_, stop=stop, **kwargs)
        try:
            lc_messages = convert_to_messages(input_)
        except Exception:
            return payload

        for payload_message, lc_message in zip(payload.get("messages", []), lc_messages):
            if payload_message.get("role") != "assistant":
                continue
            reasoning = ""
            additional_kwargs = getattr(lc_message, "additional_kwargs", None)
            if isinstance(additional_kwargs, dict):
                raw = additional_kwargs.get("reasoning_content")
                if isinstance(raw, str):
                    reasoning = raw
            if not reasoning:
                response_metadata = getattr(lc_message, "response_metadata", None)
                if isinstance(response_metadata, dict):
                    raw = response_metadata.get("reasoning_content")
                    if isinstance(raw, str):
                        reasoning = raw
            if reasoning.strip():
                payload_message["reasoning_content"] = reasoning.strip()
        return payload
