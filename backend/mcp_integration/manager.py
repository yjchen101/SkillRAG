from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

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


class MCPManager:
    def __init__(self) -> None:
        self._started = False
        self._tools: list[Any] = []
        self._metadata: dict[str, dict[str, Any]] = {}
        self._raw_clients: list[Any] = []

    async def startup(self) -> None:
        settings = get_settings()
        if self._raw_clients:
            await self.shutdown()
        self._tools = []
        self._metadata = {}
        self._raw_clients = []

        if not settings.mcp_enabled:
            return

        server_configs = self._load_server_configs(settings.mcp_config_path)
        provider = MCPToolProvider(
            timeout_seconds=settings.mcp_tool_timeout_seconds,
            retry_times=settings.mcp_retry_times,
        )

        for server in server_configs:
            if not server.enabled:
                continue
            try:
                source_tools = await self._load_server_tools(server)
                for source_tool in source_tools:
                    adapted_tool = provider.adapt(server.name, source_tool)
                    self._tools.append(adapted_tool)
                    self._metadata[adapted_tool.name] = {
                        "provider": "mcp",
                        "server": server.name,
                        "source_tool": str(getattr(source_tool, "name", "tool")),
                        "retry_times": settings.mcp_retry_times,
                        "timeout_seconds": settings.mcp_tool_timeout_seconds,
                    }
            except Exception as exc:  # pragma: no cover - runtime/environment dependent
                logger.warning("MCP server unavailable: %s (%s)", server.name, exc)

        self._started = True

    async def shutdown(self) -> None:
        for client in self._raw_clients:
            await self._close_client(client)
        self._tools = []
        self._metadata = {}
        self._raw_clients = []
        self._started = False

    def get_tools(self) -> list[Any]:
        return list(self._tools)

    def get_tool_metadata(self) -> dict[str, dict[str, Any]]:
        return dict(self._metadata)

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
