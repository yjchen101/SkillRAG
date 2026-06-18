import type { RetrievalStep } from "@/lib/api";

export type RetrievalSummary = {
  totalSteps: number;
  totalResults: number;
  latestTitle: string;
  stageCounts: Array<[string, number]>;
  usedFallback: boolean;
};

export function summarizeRetrievalSteps(steps: RetrievalStep[]): RetrievalSummary {
  const stageCounts = new Map<string, number>();
  let totalResults = 0;
  let latestTitle = "";
  let usedFallback = false;

  for (const step of steps) {
    stageCounts.set(step.stage, (stageCounts.get(step.stage) ?? 0) + 1);
    totalResults += step.results.length;
    latestTitle = step.title;
    if (step.stage === "fallback") {
      usedFallback = true;
    }
  }

  return {
    totalSteps: steps.length,
    totalResults,
    latestTitle,
    stageCounts: Array.from(stageCounts.entries()),
    usedFallback
  };
}
