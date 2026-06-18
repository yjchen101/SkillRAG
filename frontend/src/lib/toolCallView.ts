import type { ToolCall } from "@/lib/api";

export type ToolCallSummary = {
  totalCalls: number;
  finishedCalls: number;
  runningCalls: number;
  toolNames: string[];
};

export function summarizeToolCalls(toolCalls: ToolCall[]): ToolCallSummary {
  const finishedCalls = toolCalls.filter((toolCall) => toolCall.output.trim()).length;

  return {
    totalCalls: toolCalls.length,
    finishedCalls,
    runningCalls: toolCalls.length - finishedCalls,
    toolNames: Array.from(new Set(toolCalls.map((toolCall) => toolCall.tool)))
  };
}
