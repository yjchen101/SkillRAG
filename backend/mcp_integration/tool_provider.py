from __future__ import annotations

import asyncio
from typing import Any, Type

from langchain_core.callbacks.manager import AsyncCallbackManagerForToolRun, CallbackManagerForToolRun
from langchain_core.tools import BaseTool
from pydantic import BaseModel, ConfigDict, PrivateAttr


class MCPDelegatingTool(BaseTool):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    name: str
    description: str
    args_schema: Type[BaseModel]
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
        args_schema: Type[BaseModel],
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

        def _unwrap_root(payload: Any) -> Any:
            current = payload
            while isinstance(current, dict) and set(current.keys()) == {"root"}:
                current = current["root"]
            return current

        payload = _unwrap_root(raw_input)
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
        return tool_input

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

    def adapt(self, server_name: str, source_tool: BaseTool) -> BaseTool:
        source_name = str(getattr(source_tool, "name", "tool"))
        prefixed_name = f"mcp_{server_name}_{source_name}".replace("-", "_")
        description = str(getattr(source_tool, "description", ""))
        return MCPDelegatingTool(
            name=prefixed_name,
            description=description,
            args_schema=source_tool.get_input_schema(),
            source_tool=source_tool,
            server_name=server_name,
            source_name=source_name,
            retry_times=self.retry_times,
            timeout_seconds=self.timeout_seconds,
        )
