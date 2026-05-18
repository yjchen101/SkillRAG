from __future__ import annotations

import asyncio
import json
import tempfile
import unittest
from pathlib import Path

from pydantic import BaseModel

from mcp_integration.manager import MCPManager
from mcp_integration.tool_provider import MCPToolProvider


class DummySchema(BaseModel):
    value: str


class TextSchema(BaseModel):
    text: str


class DummyTool:
    name = "echo"
    description = "echo tool"

    def get_input_schema(self):
        return DummySchema

    async def ainvoke(self, args):
        return args.get("value", "")


class FailingTool(DummyTool):
    async def ainvoke(self, args):
        raise RuntimeError("boom")


class RootWrappedTool(DummyTool):
    def get_input_schema(self):
        return TextSchema

    async def ainvoke(self, args):
        if isinstance(args, dict) and "text" in args:
            return str(args["text"])
        raise RuntimeError(f"unexpected args: {args}")


class SlowTool(DummyTool):
    async def ainvoke(self, args):
        await asyncio.sleep(0.2)
        return "done"


class DummyClosableClient:
    def __init__(self) -> None:
        self.closed = False

    async def aclose(self) -> None:
        self.closed = True


class MCPIntegrationTests(unittest.IsolatedAsyncioTestCase):
    def test_load_server_configs(self):
        manager = MCPManager()
        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "mcp_servers.json"
            config_path.write_text(
                json.dumps(
                    {
                        "servers": [
                            {
                                "name": "s1",
                                "transport": "stdio",
                                "enabled": True,
                                "command": "uvx",
                                "args": ["demo"],
                            },
                            {
                                "name": "s2",
                                "transport": "http",
                                "enabled": False,
                                "url": "https://example.com/mcp",
                            },
                        ]
                    }
                ),
                encoding="utf-8",
            )
            servers = manager._load_server_configs(config_path)

        self.assertEqual(len(servers), 2)
        self.assertEqual(servers[0].name, "s1")
        self.assertEqual(servers[1].transport, "http")

    async def test_tool_provider_prefix_and_success(self):
        provider = MCPToolProvider(timeout_seconds=20, retry_times=1)
        wrapped = provider.adapt("my_server", DummyTool())
        self.assertEqual(wrapped.name, "mcp_my_server_echo")
        result = await wrapped.ainvoke({"value": "ok"})
        self.assertEqual(result, "ok")

    async def test_tool_provider_degrade_after_retries(self):
        provider = MCPToolProvider(timeout_seconds=20, retry_times=1)
        wrapped = provider.adapt("my_server", FailingTool())
        result = await wrapped.ainvoke({"value": "x"})
        self.assertIn("MCP tool degraded", result)
        self.assertIn("retries=1", result)

    async def test_tool_provider_unwraps_root_payload(self):
        provider = MCPToolProvider(timeout_seconds=20, retry_times=1)
        wrapped = provider.adapt("demo_stdio", RootWrappedTool())
        result = await wrapped.ainvoke({"root": {"root": {"text": "hello"}}})
        self.assertEqual(result, "hello")

    async def test_tool_provider_timeout_is_enforced(self):
        provider = MCPToolProvider(timeout_seconds=0.01, retry_times=0)
        wrapped = provider.adapt("my_server", SlowTool())
        result = await wrapped.ainvoke({"value": "x"})
        self.assertIn("MCP tool degraded", result)
        self.assertIn("TimeoutError", result)

    async def test_shutdown_closes_clients(self):
        manager = MCPManager()
        c1 = DummyClosableClient()
        c2 = DummyClosableClient()
        manager._raw_clients = [c1, c2]
        await manager.shutdown()
        self.assertTrue(c1.closed)
        self.assertTrue(c2.closed)


if __name__ == "__main__":
    unittest.main()
