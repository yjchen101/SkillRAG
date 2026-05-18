from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from langchain_core.tools import BaseTool
from pydantic import BaseModel, ConfigDict, Field

from config import get_settings
from mcp_integration.tool_provider import MCPToolProvider

logger = logging.getLogger(__name__)
ENV_VAR_PATTERN = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")


@dataclass
class MCPServerConfig:
    name: str
    transport: str
    enabled: bool
    command: str | None = None
    args: list[str] | None = None
    env: dict[str, str] | None = None
    url: str | None = None
    headers: dict[str, str] | None = None


class ToolSearchInput(BaseModel):
    name: str = Field(..., description="Exact exposed MCP tool name")


class ToolSearchTool(BaseTool):
    name: str = "tool_search"
    description: str = "Resolve an exact MCP tool name and return its full input schema."
    args_schema: type[BaseModel] = ToolSearchInput
    model_config = ConfigDict(arbitrary_types_allowed=True)

    def __init__(self, manager: "MCPManager") -> None:
        super().__init__()
        self._manager = manager

    def _run(self, name: str, run_manager=None) -> dict[str, Any]:
        return self._manager.search_tool(name)

    async def _arun(self, name: str, run_manager=None) -> dict[str, Any]:
        return self._run(name, run_manager)


class MCPManager:
    def __init__(self) -> None:
        self._started = False
        self._catalog: dict[str, dict[str, Any]] = {}
        self._raw_clients: list[Any] = []
        self._tool_provider: MCPToolProvider | None = None

    async def startup(self) -> None:
        settings = get_settings()
        if self._raw_clients:
            await self.shutdown()
        self._catalog = {}
        self._raw_clients = []
        self._tool_provider = MCPToolProvider(
            timeout_seconds=settings.mcp_tool_timeout_seconds,
            retry_times=settings.mcp_retry_times,
        )

        if not settings.mcp_enabled:
            return

        server_configs = self._load_server_configs(settings.mcp_config_path)

        for server in server_configs:
            if not server.enabled:
                continue
            try:
                source_tools = await self._load_server_tools(server)
                for source_tool in source_tools:
                    source_name = str(getattr(source_tool, "name", "tool"))
                    exposed_name = self._tool_provider.format_name(server.name, source_name)
                    raw_schema = self._extract_raw_input_schema(source_tool)
                    self._catalog[exposed_name] = {
                        "name": exposed_name,
                        "description": str(getattr(source_tool, "description", "")),
                        "provider": "mcp",
                        "server": server.name,
                        "source_tool": source_name,
                        "input_schema": raw_schema,
                        "source_tool_obj": source_tool,
                        "retry_times": settings.mcp_retry_times,
                        "timeout_seconds": settings.mcp_tool_timeout_seconds,
                    }
            except Exception as exc:  # pragma: no cover - runtime/environment dependent
                logger.warning("MCP server unavailable: %s (%s)", server.name, exc)

        self._started = True

    async def shutdown(self) -> None:
        for client in self._raw_clients:
            await self._close_client(client)
        self._catalog = {}
        self._raw_clients = []
        self._tool_provider = None
        self._started = False

    def get_tools(self) -> list[Any]:
        return [self.get_tool_search_tool()]

    def get_tool(self, name: str) -> BaseTool | None:
        entry = self._catalog.get(name)
        if entry is None:
            return None
        return self.adapt_tool(name)

    def get_tool_metadata(self) -> dict[str, dict[str, Any]]:
        return {
            name: {
                key: value
                for key, value in entry.items()
                if key not in {"source_tool_obj"}
            }
            for name, entry in self._catalog.items()
        }

    def get_tool_summaries(self) -> list[dict[str, str]]:
        return [
            {"name": entry["name"], "description": entry["description"]}
            for entry in self._catalog.values()
        ]

    def get_tool_search_tool(self) -> BaseTool:
        return ToolSearchTool(self)

    def search_tool(self, name: str) -> dict[str, Any]:
        entry = self._catalog.get(name)
        if entry is None:
            return {
                "found": False,
                "error": f"Unknown MCP tool: {name}",
            }
        return {
            "found": True,
            "tool_name": entry["name"],
            "description": entry["description"],
            "input_schema": entry["input_schema"],
            "server": entry["server"],
            "source_tool": entry["source_tool"],
        }

    def adapt_tool(self, name: str) -> BaseTool:
        entry = self._catalog.get(name)
        if entry is None:
            raise KeyError(name)
        if self._tool_provider is None:
            settings = get_settings()
            self._tool_provider = MCPToolProvider(
                timeout_seconds=settings.mcp_tool_timeout_seconds,
                retry_times=settings.mcp_retry_times,
            )
        return self._tool_provider.adapt(entry["server"], entry["source_tool_obj"])

    def get_tool_metadata_for(self, name: str) -> dict[str, Any]:
        entry = self._catalog.get(name)
        if entry is None:
            return {}
        return {
            "provider": "mcp",
            "server": entry["server"],
            "source_tool": entry["source_tool"],
            "retry_times": entry["retry_times"],
            "timeout_seconds": entry["timeout_seconds"],
        }

    def _load_server_configs(self, config_path: Path | None) -> list[MCPServerConfig]:
        if config_path is None or not config_path.exists():
            return []

        payload = self._expand_env_placeholders(json.loads(config_path.read_text(encoding="utf-8")))
        servers = payload.get("servers", [])
        if not isinstance(servers, list):
            raise ValueError("mcp_servers.json: servers must be a list")

        parsed: list[MCPServerConfig] = []
        for raw in servers:
            if not isinstance(raw, dict):
                continue
            name = str(raw.get("name", "")).strip()
            transport = str(raw.get("transport", "")).strip().lower()
            enabled = bool(raw.get("enabled", True))
            if not name:
                raise ValueError("mcp server missing name")
            if transport not in {"stdio", "sse", "http"}:
                raise ValueError(f"mcp server {name}: unsupported transport {transport}")
            parsed.append(
                MCPServerConfig(
                    name=name,
                    transport=transport,
                    enabled=enabled,
                    command=raw.get("command"),
                    args=raw.get("args"),
                    env=raw.get("env"),
                    url=raw.get("url"),
                    headers=raw.get("headers"),
                )
            )
        return parsed

    def _extract_raw_input_schema(self, source_tool: Any) -> dict[str, Any]:
        schema = getattr(source_tool, "args_schema", None)
        if schema is None:
            schema = getattr(source_tool, "inputSchema", None)
        if isinstance(schema, dict):
            return schema
        if schema is None:
            schema = source_tool.get_input_schema()
        if hasattr(schema, "model_json_schema") and callable(getattr(schema, "model_json_schema")):
            return schema.model_json_schema()
        if hasattr(schema, "schema") and callable(getattr(schema, "schema")):
            return schema.schema()
        return {}

    def _expand_env_placeholders(self, value: Any) -> Any:
        if isinstance(value, dict):
            return {key: self._expand_env_placeholders(item) for key, item in value.items()}
        if isinstance(value, list):
            return [self._expand_env_placeholders(item) for item in value]
        if not isinstance(value, str):
            return value

        def replace(match: re.Match[str]) -> str:
            env_name = match.group(1)
            env_value = os.environ.get(env_name)
            if env_value is None:
                raise ValueError(f"mcp config references missing environment variable: {env_name}")
            return env_value

        return ENV_VAR_PATTERN.sub(replace, value)

    async def _load_server_tools(self, server: MCPServerConfig) -> list[Any]:
        try:
            from langchain_mcp_adapters.client import MultiServerMCPClient
        except ImportError as exc:
            raise RuntimeError("langchain-mcp-adapters is not installed") from exc

        if server.transport == "stdio":
            if not server.command:
                raise ValueError(f"mcp server {server.name}: stdio requires command")
            server_spec = {
                server.name: {
                    "transport": "stdio",
                    "command": server.command,
                    "args": server.args or [],
                    "env": server.env or {},
                }
            }
        else:
            if not server.url:
                raise ValueError(f"mcp server {server.name}: {server.transport} requires url")
            server_spec = {
                server.name: {
                    "transport": server.transport,
                    "url": server.url,
                    "headers": server.headers or {},
                }
            }

        client = MultiServerMCPClient(server_spec)
        self._raw_clients.append(client)
        tools = await client.get_tools()
        return list(tools)

    async def _close_client(self, client: Any) -> None:
        close_fn = getattr(client, "aclose", None)
        if callable(close_fn):
            try:
                await close_fn()
            except Exception as exc:  # pragma: no cover - runtime dependent
                logger.warning("MCP client aclose failed: %s", exc)
            return

        close_fn = getattr(client, "close", None)
        if callable(close_fn):
            try:
                result = close_fn()
                if hasattr(result, "__await__"):
                    await result
            except Exception as exc:  # pragma: no cover - runtime dependent
                logger.warning("MCP client close failed: %s", exc)
            return

        close_fn = getattr(client, "shutdown", None)
        if callable(close_fn):
            try:
                result = close_fn()
                if hasattr(result, "__await__"):
                    await result
            except Exception as exc:  # pragma: no cover - runtime dependent
                logger.warning("MCP client shutdown failed: %s", exc)


mcp_manager = MCPManager()
