import assert from "node:assert/strict";
import test from "node:test";

import {
  TOOL_BLOCK_PREVIEW_LIMIT,
  formatToolBlockValue,
  getToolNamesLabel,
  getToolBlockPreview,
  summarizeToolCalls
} from "../src/lib/toolCallView.ts";

test("summarizeToolCalls counts finished and running calls", () => {
  assert.deepEqual(
    summarizeToolCalls([
      { tool: "read_file", input: "{}", output: "done" },
      { tool: "terminal", input: "{}", output: "" },
      { tool: "read_file", input: "{}", output: "done again" }
    ]),
    {
      totalCalls: 3,
      finishedCalls: 2,
      runningCalls: 1,
      toolNames: ["read_file", "terminal"]
    }
  );
});

test("getToolBlockPreview leaves short tool content intact", () => {
  assert.deepEqual(getToolBlockPreview("short output"), {
    text: "short output",
    isTruncated: false
  });
});

test("getToolBlockPreview truncates long tool content", () => {
  const value = "x".repeat(TOOL_BLOCK_PREVIEW_LIMIT + 5);

  assert.deepEqual(getToolBlockPreview(value), {
    text: `${"x".repeat(TOOL_BLOCK_PREVIEW_LIMIT)}...`,
    isTruncated: true
  });
});

test("formatToolBlockValue explains empty tool input and output", () => {
  assert.equal(formatToolBlockValue("", "input"), "暂无输入");
  assert.equal(formatToolBlockValue("  ", "output"), "等待输出");
});

test("getToolNamesLabel explains empty and populated tool names", () => {
  assert.equal(getToolNamesLabel([]), "等待工具名称");
  assert.equal(getToolNamesLabel(["read_file", "terminal"]), "read_file、terminal");
});
