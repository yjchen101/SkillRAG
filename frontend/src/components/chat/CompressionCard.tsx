"use client";

import { Archive, Gauge, TriangleAlert } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { CompressionEvent } from "@/lib/api";
import {
  getCompressedMessageCountLabel,
  getCompressionBudgetTargetLabel,
  getCompressionBudgetTitle,
  getCompressionEventCountLabel,
  getCompressionRepairLabel,
  getCompressionReasonLabel,
  getCompressionTimestampLabel,
  getCompressionWindowTitle,
  getCompressionSavingsLabel
} from "@/lib/compressionView";

export function CompressionCard({ events }: { events: CompressionEvent[] }) {
  if (!events.length) {
    return null;
  }

  const countLabel = getCompressionEventCountLabel(events.length);

  return (
    <section className="mb-4 rounded-[28px] border border-[rgba(15,139,141,0.18)] bg-[rgba(15,139,141,0.08)] p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--color-ocean)]">
        <div className="flex items-center gap-2">
          <Archive size={16} />
          Compression
        </div>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-normal text-[var(--color-ink-soft)]">
          {countLabel}
        </span>
      </div>

      <div className="mt-3 space-y-3">
        {events.map((event, index) => (
          <article
            className="rounded-[24px] border border-[rgba(13,37,48,0.08)] bg-white/70 p-4"
            key={`${event.timestamp}-${event.reason}-${index}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[rgba(15,139,141,0.12)] px-2 py-1 text-[11px] font-medium text-[var(--color-ocean)]">
                {getCompressionReasonLabel(event.reason)}
              </span>
              {event.degraded ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(212,106,74,0.12)] px-2 py-1 text-[11px] font-medium text-[var(--color-ember)]">
                  <TriangleAlert size={12} />
                  {getCompressionRepairLabel()}
                </span>
              ) : null}
              <span className="mono text-xs text-[var(--color-ink-soft)]">
                {getCompressionTimestampLabel(event.timestamp)}
              </span>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-[rgba(13,37,48,0.05)] p-3">
                <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
                  <Gauge size={12} />
                  {getCompressionBudgetTitle()}
                </div>
                <div className="mono text-sm text-[var(--color-ink)]">
                  {event.pre_compress_tokens} → {event.post_compress_tokens}
                </div>
                <div className="mt-1 text-xs text-[var(--color-ink-soft)]">
                  {getCompressionBudgetTargetLabel(event.target_budget_tokens)} ·{" "}
                  {getCompressionSavingsLabel({
                    preCompressTokens: event.pre_compress_tokens,
                    postCompressTokens: event.post_compress_tokens
                  })}
                </div>
              </div>

              <div className="rounded-2xl bg-[rgba(13,37,48,0.05)] p-3">
                <div className="mb-1 text-xs uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
                  {getCompressionWindowTitle()}
                </div>
                <div className="text-sm text-[var(--color-ink)]">
                  {getCompressedMessageCountLabel(event.compressed_message_count)}
                </div>
                <div className="mt-1 text-xs text-[var(--color-ink-soft)]">
                  kept {event.kept_recent_turn_count} recent turns
                </div>
              </div>
            </div>

            <div className="markdown mt-4 rounded-2xl bg-[rgba(255,252,246,0.78)] p-4 text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{event.summary}</ReactMarkdown>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
