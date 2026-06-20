import type { RetrievalStep } from "@/lib/api";

const EVIDENCE_CHANNEL_LABELS: Record<string, string> = {
  memory: "记忆证据",
  skill: "技能证据",
  vector: "向量检索",
  bm25: "BM25 关键词检索",
  fused: "融合排序"
};

export type RetrievalSummary = {
  totalSteps: number;
  totalResults: number;
  emptySteps: number;
  latestTitle: string;
  stageCounts: Array<[string, number]>;
  usedFallback: boolean;
};

export function getEvidenceChannelLabel(channel: string) {
  return EVIDENCE_CHANNEL_LABELS[channel] ?? "其他证据";
}

export function summarizeRetrievalSteps(steps: RetrievalStep[]): RetrievalSummary {
  const stageCounts = new Map<string, number>();
  let totalResults = 0;
  let emptySteps = 0;
  let latestTitle = "";
  let usedFallback = false;

  for (const step of steps) {
    stageCounts.set(step.stage, (stageCounts.get(step.stage) ?? 0) + 1);
    totalResults += step.results.length;
    if (!step.results.length) {
      emptySteps += 1;
    }
    latestTitle = step.title;
    if (step.stage === "fallback") {
      usedFallback = true;
    }
  }

  return {
    totalSteps: steps.length,
    totalResults,
    emptySteps,
    latestTitle,
    stageCounts: Array.from(stageCounts.entries()),
    usedFallback
  };
}
