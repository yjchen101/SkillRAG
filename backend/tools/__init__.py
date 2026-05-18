from __future__ import annotations

from pathlib import Path
from typing import Any

from langchain_core.tools import BaseTool

from mcp_integration.manager import MCPManager
from tools.fetch_url_tool import FetchURLTool
from tools.python_repl_tool import PythonReplTool
from tools.read_file_tool import ReadFileTool
from tools.terminal_tool import TerminalTool


def get_all_tools(
    base_dir: Path,
    mcp_tools: list[BaseTool] | None = None,
    mcp_manager: MCPManager | None = None,
) -> list[BaseTool]:
    tools: list[BaseTool] = [
        TerminalTool(root_dir=base_dir),
        PythonReplTool(root_dir=base_dir),
        FetchURLTool(),
        ReadFileTool(root_dir=base_dir),
    ]
    if mcp_manager is not None:
        tools.append(mcp_manager.get_tool_search_tool())
    if mcp_tools:
        tools.extend(mcp_tools)
    return tools
