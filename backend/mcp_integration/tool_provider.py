from __future__ import annotations

import asyncio
import json
from typing import Any

from langchain_core.callbacks.manager import AsyncCallbackManagerForToolRun, CallbackManagerForToolRun
from langchain_core.tools import BaseTool
from langchain_core.tools.base import ArgsSchema
from pydantic import BaseModel, ConfigDict, Field, PrivateAttr, SkipValidation, ValidationError


class MCPDelegatingTool(BaseTool):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    name: str
    description: str
    args_schema: SkipValidation[ArgsSchema] = Field(..., description="The raw MCP input schema.")
    _source_tool: BaseTool = PrivateAttr()
    _server_name: str = PrivateAttr()
    _source_name: str = PrivateAttr()
    _retry_times: int = PrivateAttr()
    _timeout_seconds: float = PrivateAttr()

    def __init__(
        self,
        *,
        name: str,
        description: str,
        args_schema: ArgsSchema,
        source_tool: BaseTool,
        server_name: str,
        source_name: str,
        retry_times: int,
        timeout_seconds: int,
    ) -> None:
        super().__init__(name=name, description=description, args_schema=args_schema)
        self._source_tool = source_tool
        self._server_name = server_name
        self._source_name = source_name
        self._retry_times = max(0, retry_times)
        self._timeout_seconds = max(0.001, float(timeout_seconds))

    async def _execute(self, raw_input: Any) -> Any:
        retries = self._retry_times
        last_error = ""

        def _normalize_payload(payload: Any) -> Any:
            if isinstance(payload, BaseModel):
                payload = payload.model_dump(exclude_none=True)
            elif hasattr(payload, "model_dump") and callable(getattr(payload, "model_dump")):
                payload = payload.model_dump(exclude_none=True)

            # Strip framework metadata wrapper: {"root": {"id": "...", "name": "..."}, ...args}
            if isinstance(payload, dict) and "root" in payload and len(payload) > 1:
                root_obj = payload.get("root")
                if isinstance(root_obj, dict) and {"id", "name"}.issubset(root_obj.keys()):
                    payload = {key: value for key, value in payload.items() if key != "root"}

            # Unwrap nested root payloads: {"root": {...}} or {"root": {"root": {...}}}
            current = payload
            while isinstance(current, dict) and set(current.keys()) == {"root"}:
                current = current["root"]

            # Some callers pass root as a JSON string; decode it if possible.
            if isinstance(current, str):
                raw = current.strip()
                if raw.startswith("{") and raw.endswith("}"):
                    try:
                        decoded = json.loads(raw)
                        if isinstance(decoded, dict):
                            current = decoded
                    except json.JSONDecodeError:
                        pass

            # Compatibility path: {"root": "mqsim"} for tools expecting query-like JSON args.
            if isinstance(current, str):
                schema_fields = _schema_fields(self.args_schema)
                if "query" in schema_fields:
                    current = {"query": current}
            elif isinstance(current, dict):
                schema_fields = _schema_fields(self.args_schema)
                root_value = current.get("root")
                if isinstance(root_value, str) and "query" in schema_fields and "query" not in current:
                    current = {key: value for key, value in current.items() if key != "root"}
                    current["query"] = root_value

            # Some wrappers place business args under "args".
            if isinstance(current, dict):
                args_obj = current.get("args")
                if isinstance(args_obj, dict):
                    merged = dict(args_obj)
                    for key, value in current.items():
                        if key not in {"args", "root"} and key not in merged:
                            merged[key] = value
                    current = merged

            # Enforce MCP tool input schema before forwarding.
            if isinstance(current, dict):
                if isinstance(self.args_schema, type) and issubclass(self.args_schema, BaseModel):
                    try:
                        validated = self.args_schema.model_validate(current)
                    except ValidationError:
                        return current
                    current = validated.model_dump(exclude_none=True)
            return current

        payload = _normalize_payload(raw_input)
        if isinstance(payload, dict) and {"id", "name"}.issubset(payload.keys()) and "query" not in payload:
            return (
                "MCP tool degraded: missing required business arguments. "
                "Expected JSON args like {\"query\":\"user:@me\",\"perPage\":100}, "
                f"but received metadata-like payload: {payload}"
            )
        for attempt in range(retries + 1):
            try:
                result = await asyncio.wait_for(
                    self._source_tool.ainvoke(payload),
                    timeout=self._timeout_seconds,
                )
                return result
            except Exception as exc:  # pragma: no cover - runtime dependent
                last_error = str(exc) or exc.__class__.__name__
                if attempt >= retries:
                    break

        return (
            "MCP tool degraded: call failed after retries. "
            f"server={self._server_name} tool={self._source_name} retries={retries} reason={last_error}"
        )

    def _parse_input(self, tool_input: Any, tool_call_id: str | None = None) -> Any:
        current = tool_input
        while isinstance(current, dict) and set(current.keys()) == {"root"}:
            current = current["root"]
        return super()._parse_input(current, tool_call_id)

    def _to_args_and_kwargs(self, tool_input: Any, tool_call_id: str | None) -> tuple[tuple[Any], dict[str, Any]]:
        # Avoid a second schema coercion layer that can wrap payloads into provider-specific
        # objects (e.g. search_repositories_input) and drop direct field access.
        return (tool_input,), {}

    def _run(
        self,
        run_manager: CallbackManagerForToolRun | None = None,
        **kwargs: Any,
    ) -> str:
        raise RuntimeError("MCP delegating tool supports async execution only")

    async def _arun(
        self,
        *args: Any,
        run_manager: AsyncCallbackManagerForToolRun | None = None,
        **kwargs: Any,
    ) -> str:
        raw_input: Any
        if args:
            raw_input = args[0]
        else:
            raw_input = kwargs
        return await self._execute(raw_input)


class MCPToolProvider:
    def __init__(self, timeout_seconds: int, retry_times: int) -> None:
        self.timeout_seconds = timeout_seconds
        self.retry_times = max(0, retry_times)

    @staticmethod
    def format_name(server_name: str, source_name: str) -> str:
        return f"mcp_{server_name}_{source_name}".replace("-", "_")

    def adapt(self, server_name: str, source_tool: BaseTool) -> BaseTool:
        source_name = str(getattr(source_tool, "name", "tool"))
        prefixed_name = self.format_name(server_name, source_name)
        description = str(getattr(source_tool, "description", ""))
        raw_args_schema = getattr(source_tool, "args_schema", None) or source_tool.get_input_schema()
        return MCPDelegatingTool(
            name=prefixed_name,
            description=description,
            args_schema=raw_args_schema,
            source_tool=source_tool,
            server_name=server_name,
            source_name=source_name,
            retry_times=self.retry_times,
            timeout_seconds=self.timeout_seconds,
        )


def _schema_fields(schema: ArgsSchema) -> dict[str, Any]:
    if isinstance(schema, dict):
        properties = schema.get("properties", {})
        return properties if isinstance(properties, dict) else {}
    return getattr(schema, "model_fields", {}) or {}
