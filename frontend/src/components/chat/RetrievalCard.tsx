"use client";

import { Database, FileSearch, Layers3, Search, Sparkles, type LucideIcon } from "lucide-react";
import { useState } from "react";

import type { RetrievalStep } from "@/lib/api";
import {
  getEvidenceChannelLabel,
  getRetrievalStageLabel,
  summarizeRetrievalSteps
} from "@/lib/retrievalView";

const STEP_META: Record<
  string,
  {
    icon: LucideIcon;
    border: string;
    badge: string;
  }
> = {
  memory: {
    icon: Database,
    border: "border-[rgba(15,139,141,0.16)] bg-[rgba(15,139,141,0.06)]",
    badge: "bg-[rgba(15,139,141,0.12)] text-ocean"
  },
  skill: {
    icon: Search,
    border: "border-[rgba(13,37,48,0.1)] bg-[rgba(13,37,48,0.04)]",
    badge: "bg-[rgba(13,37,48,0.08)] text-[var(--color-ink)]"
  },
  fallback: {
    icon: Sparkles,
    border: "border-[rgba(212,106,74,0.18)] bg-[rgba(212,106,74,0.08)]",
    badge: "bg-[rgba(212,106,74,0.12)] text-[var(--color-ember)]"
  },
  vector: {
    icon: Database,
    border: "border-[rgba(15,139,141,0.16)] bg-[rgba(15,139,141,0.06)]",
    badge: "bg-[rgba(15,139,141,0.12)] text-ocean"
  },
  bm25: {
    icon: FileSearch,
    border: "border-[rgba(13,37,48,0.1)] bg-[rgba(13,37,48,0.04)]",
    badge: "bg-[rgba(13,37,48,0.08)] text-[var(--color-ink)]"
  },
  fused: {
    icon: Layers3,
    border: "border-[rgba(15,139,141,0.16)] bg-[rgba(15,139,141,0.06)]",
    badge: "bg-[rgba(15,139,141,0.12)] text-ocean"
  }
};

export function RetrievalCard({ steps }: { steps: RetrievalStep[] }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!steps.length) {
    return null;
  }

  const summary = summarizeRetrievalSteps(steps);

  return (
    <details
      className="mb-4 rounded-3xl border border-[rgba(15,139,141,0.18)] bg-[rgba(15,139,141,0.08)] p-4"
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      open={isOpen}
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 text-sm font-medium text-ocean">
        <Database className="mt-0.5 shrink-0" size={16} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span>检索轨迹</span>
            <span className="rounded-full bg-white/70 px-2 py-1 text-[11px] font-normal text-[var(--color-ink-soft)]">
              {summary.totalSteps} 步
            </span>
            <span className="rounded-full bg-white/70 px-2 py-1 text-[11px] font-normal text-[var(--color-ink-soft)]">
              {summary.totalResults} 条证据
            </span>
            {summary.usedFallback && (
              <span className="rounded-full bg-[rgba(212,106,74,0.12)] px-2 py-1 text-[11px] font-normal text-[var(--color-ember)]">
                已 fallback
              </span>
            )}
            {summary.emptySteps > 0 && (
              <span className="rounded-full bg-white/70 px-2 py-1 text-[11px] font-normal text-[var(--color-ink-soft)]">
                {summary.emptySteps} 步无证据
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-normal text-[var(--color-ink-soft)]">
            {summary.stageCounts.map(([stage, count]) => {
              const meta = STEP_META[stage] ?? STEP_META.skill;
              return (
                <span className={`rounded-full px-2 py-0.5 ${meta.badge}`} key={stage}>
                  {getRetrievalStageLabel(stage)} x {count}
                </span>
              );
            })}
            {summary.latestTitle && <span className="min-w-0 truncate">{summary.latestTitle}</span>}
          </div>
        </div>
        <span className="shrink-0 text-xs font-normal text-[var(--color-ink-soft)]">
          {isOpen ? "收起" : "展开"}
        </span>
      </summary>

      <div className="mt-3 space-y-3">
        {steps.map((step, index) => {
          const meta = STEP_META[step.stage] ?? STEP_META.skill;
          const Icon = meta.icon;

          return (
            <section
              className={`rounded-2xl border p-3 ${meta.border}`}
              key={`${step.kind}-${step.stage}-${index}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${meta.badge}`}>
                      {getRetrievalStageLabel(step.stage)}
                    </span>
                    <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
                      <Icon className="shrink-0" size={14} />
                      <span className="truncate">{step.title}</span>
                    </div>
                  </div>
                  {step.message ? (
                    <p className="mt-2 text-sm leading-6 text-[var(--color-ink-soft)]">
                      {step.message}
                    </p>
                  ) : null}
                </div>
                {step.results.length ? (
                  <span className="shrink-0 rounded-full bg-white/70 px-2 py-1 text-[11px] text-[var(--color-ink-soft)]">
                    {step.results.length} 条
                  </span>
                ) : null}
              </div>

              {!!step.results.length && (
                <div className="mt-3 space-y-2">
                  {step.results.map((item, resultIndex) => (
                    <div
                      className="rounded-2xl bg-white/70 p-3"
                      key={`${item.channel}-${item.source_path}-${item.locator}-${resultIndex}`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs text-[var(--color-ink-soft)]">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 rounded-full bg-[rgba(13,37,48,0.08)] px-2 py-0.5 text-[11px] text-[var(--color-ink)]">
                            {getEvidenceChannelLabel(item.channel)}
                          </span>
                          <span className="truncate">{item.source_path}</span>
                        </div>
                        {typeof item.score === "number" ? (
                          <span className="shrink-0">{item.score.toFixed(3)}</span>
                        ) : null}
                      </div>
                      {item.locator ? (
                        <div className="mb-2 text-xs text-[var(--color-ink-soft)]">{item.locator}</div>
                      ) : null}
                      <p className="text-sm leading-6 text-[var(--color-ink)]">{item.snippet}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </details>
  );
}
