import type { ToolCall } from "@/lib/api";

export type ToolCallSummary = {
  totalCalls: number;
  finishedCalls: number;
  runningCalls: number;
  toolNames: string[];
};

export const TOOL_BLOCK_PREVIEW_LIMIT = 640;

export function summarizeToolCalls(toolCalls: ToolCall[]): ToolCallSummary {
  const finishedCalls = toolCalls.filter((toolCall) => toolCall.output.trim()).length;

  return {
    totalCalls: toolCalls.length,
    finishedCalls,
    runningCalls: toolCalls.length - finishedCalls,
    toolNames: Array.from(new Set(toolCalls.map((toolCall) => toolCall.tool)))
  };
}

export function getToolBlockPreview(value: string, limit = TOOL_BLOCK_PREVIEW_LIMIT) {
  if (value.length <= limit) {
    return {
      text: value,
      isTruncated: false
    };
  }

  return {
    text: `${value.slice(0, limit)}...`,
    isTruncated: true
  };
}

export function getToolNamesLabel(toolNames: string[]) {
  return toolNames.length ? toolNames.join(" -> ") : "等待工具名称";
}

export function formatToolBlockValue(value: string, kind: "input" | "output") {
  const text = value.trim();
  if (!text) {
    return kind === "input" ? "暂无输入" : "等待输出";
  }

  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
