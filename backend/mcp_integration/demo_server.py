from __future__ import annotations

from mcp.server.fastmcp import FastMCP

server = FastMCP("skillrag-demo")


@server.tool()
def echo(text: str) -> str:
    """Return input text as-is."""
    return text


@server.tool()
def add(a: float, b: float) -> float:
    """Add two numbers."""
    return a + b


@server.tool()
def health() -> str:
    """Health-check tool for MCP wiring tests."""
    return "ok"


if __name__ == "__main__":
    server.run(transport="stdio")
