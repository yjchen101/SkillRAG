"use client";

import { TerminalSquare } from "lucide-react";
import { useEffect, useState } from "react";

import type { ToolCall } from "@/lib/api";
import {
  formatToolBlockValue,
  getToolBlockPreview,
  summarizeToolCalls
} from "@/lib/toolCallView";

function ToolBlock({
  kind,
  label,
  value
}: {
  kind: "input" | "output";
  label: string;
  value: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const formattedValue = formatToolBlockValue(value, kind);
  const preview = getToolBlockPreview(formattedValue);
  const displayValue = preview.isTruncated && !isExpanded ? preview.text : formattedValue;

  return (
    <div className="rounded-2xl bg-[rgba(13,37,48,0.06)] p-3">
      <div className="mb-1 flex items-center justify-between gap-2 font-medium text-[var(--color-ink-soft)]">
        <span>{label}</span>
        {preview.isTruncated && (
          <button
            className="rounded-full bg-white/65 px-2 py-1 text-[11px] text-[var(--color-ink-soft)] transition hover:text-[var(--color-ink)]"
            onClick={() => setIsExpanded((current) => !current)}
            type="button"
          >
            {isExpanded ? "收起" : "展开全部"}
          </button>
        )}
      </div>
      <pre className="mono whitespace-pre-wrap">{displayValue}</pre>
    </div>
  );
}

export function ThoughtChain({ toolCalls }: { toolCalls: ToolCall[] }) {
  const activeTool = [...toolCalls].reverse().find((toolCall) => !toolCall.output.trim()) ?? null;
  const summary = summarizeToolCalls(toolCalls);
  const [isOpen, setIsOpen] = useState(Boolean(activeTool));

  useEffect(() => {
    if (activeTool) {
      setIsOpen(true);
    }
  }, [activeTool, toolCalls.length]);

  if (!toolCalls.length) {
    return null;
  }

  return (
    <details
      className="mb-4 rounded-3xl border border-[rgba(212,106,74,0.18)] bg-[rgba(212,106,74,0.08)] p-4"
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      open={isOpen}
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 text-sm font-medium text-[var(--color-ember)]">
        <TerminalSquare className="mt-0.5 shrink-0" size={16} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span>{activeTool ? `正在调用 ${activeTool.tool}` : "工具调用"}</span>
            <span className="rounded-full bg-white/70 px-2 py-1 text-[11px] font-normal text-[var(--color-ink-soft)]">
              {summary.totalCalls} 次
            </span>
            <span className="rounded-full bg-[rgba(15,139,141,0.12)] px-2 py-1 text-[11px] font-normal text-ocean">
              {summary.finishedCalls} 已完成
            </span>
            {summary.runningCalls > 0 && (
              <span className="rounded-full bg-[rgba(212,106,74,0.12)] px-2 py-1 text-[11px] font-normal text-[var(--color-ember)]">
                {summary.runningCalls} 运行中
              </span>
            )}
          </div>
          <div className="truncate text-xs font-normal text-[var(--color-ink-soft)]">
            {summary.toolNames.join(" -> ")}
          </div>
        </div>
        <span className="shrink-0 text-xs font-normal text-[var(--color-ink-soft)]">
          {isOpen ? "收起" : "展开"}
        </span>
      </summary>

      <div className="mt-3 space-y-3">
        {toolCalls.map((toolCall, index) => {
          const isFinished = Boolean(toolCall.output.trim());

          return (
            <div className="rounded-2xl bg-white/70 p-3" key={`${toolCall.tool}-${index}`}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm font-medium">
                <span>{toolCall.tool}</span>
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                    isFinished
                      ? "bg-[rgba(15,139,141,0.12)] text-[var(--color-ocean)]"
                      : "bg-[rgba(212,106,74,0.12)] text-[var(--color-ember)]"
                  }`}
                >
                  {isFinished ? "已完成" : "运行中"}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <ToolBlock kind="input" label="输入" value={toolCall.input} />
                <ToolBlock kind="output" label="输出" value={toolCall.output} />
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
