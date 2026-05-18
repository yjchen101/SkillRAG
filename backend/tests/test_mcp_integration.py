from __future__ import annotations

import asyncio
import json
import os
import tempfile
import unittest
from pathlib import Path

from pydantic import BaseModel

from api.chat import _build_full_prompt
from mcp_integration.manager import MCPManager
from mcp_integration.tool_provider import MCPToolProvider
from tools import get_all_tools


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


class SearchTool(DummyTool):
    args_schema = {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search query"},
            "perPage": {"type": "number", "description": "Page size"},
        },
        "required": ["query"],
        "additionalProperties": False,
    }

    def get_input_schema(self):
        class SearchSchema(BaseModel):
            query: str
            perPage: int

        return SearchSchema

    async def ainvoke(self, args):
        if isinstance(args, dict) and args.get("query") == "user:@me" and args.get("perPage") == 100:
            return {"ok": True}
        raise RuntimeError(f"unexpected args: {args}")


class SearchInputLike:
    def __init__(self, root: dict[str, object], query: str, perPage: int, page: int) -> None:
        self.root = root
        self.query = query
        self.perPage = perPage
        self.page = page

    def model_dump(self, exclude_none: bool = True) -> dict[str, object]:
        return {
            "root": self.root,
            "query": self.query,
            "perPage": self.perPage,
            "page": self.page,
        }


class SlowTool(DummyTool):
    async def ainvoke(self, args):
        await asyncio.sleep(0.2)
        return "done"


class DummyClosableClient:
    def __init__(self) -> None:
        self.closed = False

    async def aclose(self) -> None:
        self.closed = True


class StartupTrackingManager(MCPManager):
    def __init__(self) -> None:
        super().__init__()
        self.created_clients: list[DummyClosableClient] = []
        self.startup_calls = 0

    def _load_server_configs(self, config_path: Path | None):
        return [type("Server", (), {"name": "demo", "enabled": True})()]

    async def _load_server_tools(self, server):
        self.startup_calls += 1
        client = DummyClosableClient()
        self.created_clients.append(client)
        self._raw_clients.append(client)
        return [DummyTool()]


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

    def test_load_server_configs_expands_env_placeholders(self):
        manager = MCPManager()
        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "mcp_servers.json"
            previous = os.environ.get("TEST_MCP_TOKEN")
            os.environ["TEST_MCP_TOKEN"] = "secret-token"
            try:
                config_path.write_text(
                    json.dumps(
                        {
                            "servers": [
                                {
                                    "name": "github",
                                    "transport": "stdio",
                                    "enabled": True,
                                    "command": "npx",
                                    "args": ["-y", "@modelcontextprotocol/server-github"],
                                    "env": {"GITHUB_PERSONAL_ACCESS_TOKEN": "${TEST_MCP_TOKEN}"},
                                }
                            ]
                        }
                    ),
                    encoding="utf-8",
                )
                servers = manager._load_server_configs(config_path)
            finally:
                if previous is None:
                    os.environ.pop("TEST_MCP_TOKEN", None)
                else:
                    os.environ["TEST_MCP_TOKEN"] = previous

        self.assertEqual(servers[0].env, {"GITHUB_PERSONAL_ACCESS_TOKEN": "secret-token"})

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

    async def test_tool_provider_strips_root_metadata_wrapper(self):
        provider = MCPToolProvider(timeout_seconds=20, retry_times=1)
        wrapped = provider.adapt("github", SearchTool())
        result = await wrapped.ainvoke(
            {"root": {"id": "search-repos", "name": "search_repositories"}, "query": "user:@me", "perPage": 100}
        )
        self.assertEqual(result, {"ok": True})

    async def test_tool_provider_accepts_model_like_input(self):
        provider = MCPToolProvider(timeout_seconds=20, retry_times=1)
        wrapped = provider.adapt("github", SearchTool())
        result = await wrapped.ainvoke(
            SearchInputLike(
                root={"id": "search-mqsim", "name": "search_repositories"},
                query="user:@me",
                perPage=100,
                page=1,
            )
        )
        self.assertEqual(result, {"ok": True})

    async def test_tool_provider_extracts_args_container(self):
        provider = MCPToolProvider(timeout_seconds=20, retry_times=1)
        wrapped = provider.adapt("github", SearchTool())
        result = await wrapped.ainvoke(
            {"root": {"id": "search-repos", "name": "search_repositories"}, "args": {"query": "user:@me", "perPage": 100}, "page": 1}
        )
        self.assertEqual(result, {"ok": True})

    async def test_tool_provider_maps_root_string_to_query(self):
        provider = MCPToolProvider(timeout_seconds=20, retry_times=1)
        wrapped = provider.adapt("github", SearchTool())
        result = await wrapped.ainvoke({"root": "user:@me", "perPage": 100})
        self.assertEqual(result, {"ok": True})

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

    async def test_startup_closes_existing_clients_before_reinit(self):
        manager = StartupTrackingManager()
        await manager.startup()
        first_client = manager.created_clients[0]

        await manager.startup()

        self.assertTrue(first_client.closed)
        self.assertEqual(manager.startup_calls, 2)

    async def test_startup_builds_catalog_without_eager_tool_registration(self):
        manager = StartupTrackingManager()
        await manager.startup()

        self.assertEqual([tool.name for tool in manager.get_tools()], ["tool_search"])
        self.assertEqual(manager.get_tool_summaries(), [{"name": "mcp_demo_echo", "description": "echo tool"}])

    async def test_tool_search_exact_lookup_returns_schema(self):
        manager = StartupTrackingManager()
        await manager.startup()
        tool_search = get_all_tools(Path("."), mcp_manager=manager)[-1]

        result = await tool_search.ainvoke({"name": "mcp_demo_echo"})

        self.assertTrue(result["found"])
        self.assertEqual(result["tool_name"], "mcp_demo_echo")
        self.assertEqual(result["server"], "demo")
        self.assertEqual(result["source_tool"], "echo")
        self.assertIn("properties", result["input_schema"])
        self.assertNotIn("$defs", result["input_schema"])
        self.assertIn("value", result["input_schema"]["properties"])
        self.assertNotIn("ToolCall", json.dumps(result["input_schema"]))

    async def test_tool_search_unknown_name_returns_structured_error(self):
        manager = StartupTrackingManager()
        await manager.startup()
        tool_search = get_all_tools(Path("."), mcp_manager=manager)[-1]

        result = await tool_search.ainvoke({"name": "mcp_missing"})

        self.assertFalse(result["found"])
        self.assertIn("error", result)

    async def test_tool_search_prefers_raw_dict_args_schema(self):
        manager = MCPManager()
        manager._tool_provider = MCPToolProvider(timeout_seconds=20, retry_times=1)
        search_tool = SearchTool()
        manager._catalog["mcp_github_search_repositories"] = {
            "name": "mcp_github_search_repositories",
            "description": "Search for GitHub repositories",
            "provider": "mcp",
            "server": "github",
            "source_tool": "search_repositories",
            "input_schema": manager._extract_raw_input_schema(search_tool),
            "source_tool_obj": search_tool,
            "retry_times": 1,
            "timeout_seconds": 20,
        }

        result = manager.search_tool("mcp_github_search_repositories")

        self.assertTrue(result["found"])
        self.assertEqual(result["input_schema"]["type"], "object")
        self.assertIn("query", result["input_schema"]["properties"])
        self.assertNotIn("$defs", result["input_schema"])
        self.assertNotIn("ToolCall", json.dumps(result["input_schema"]))

    async def test_lazy_adaptation_returns_single_tool(self):
        manager = StartupTrackingManager()
        await manager.startup()

        tool = manager.adapt_tool("mcp_demo_echo")

        self.assertEqual(tool.name, "mcp_demo_echo")
        self.assertEqual(await tool.ainvoke({"value": "ok"}), "ok")

    async def test_prompt_log_includes_mcp_catalog_separately(self):
        manager = StartupTrackingManager()
        await manager.startup()

        prompt = _build_full_prompt(
            base_dir=Path("."),
            rag_mode=False,
            history=[],
            message="test",
            tools=get_all_tools(Path("."), mcp_manager=manager),
            mcp_tool_summaries=manager.get_tool_summaries(),
        )

        self.assertIn("--- mcp catalog ---", prompt)
        self.assertIn('"name": "mcp_demo_echo"', prompt)
        self.assertIn('"description": "echo tool"', prompt)


if __name__ == "__main__":
    unittest.main()
