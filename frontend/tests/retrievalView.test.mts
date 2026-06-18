import assert from "node:assert/strict";
import test from "node:test";

import { summarizeRetrievalSteps } from "../src/lib/retrievalView.ts";

test("summarizeRetrievalSteps counts stages and evidence", () => {
  const summary = summarizeRetrievalSteps([
    {
      kind: "memory",
      stage: "memory",
      title: "Memory hit",
      message: "",
      results: [
        {
          source_path: "memory/MEMORY.md",
          source_type: "markdown",
          locator: "",
          snippet: "one",
          channel: "memory",
          score: 0.8,
          parent_id: null
        }
      ]
    },
    {
      kind: "knowledge",
      stage: "fallback",
      title: "Hybrid fallback",
      message: "",
      results: [
        {
          source_path: "knowledge/a.md",
          source_type: "markdown",
          locator: "",
          snippet: "two",
          channel: "vector",
          score: 0.6,
          parent_id: null
        },
        {
          source_path: "knowledge/b.md",
          source_type: "markdown",
          locator: "",
          snippet: "three",
          channel: "bm25",
          score: null,
          parent_id: null
        }
      ]
    }
  ]);

  assert.deepEqual(summary, {
    totalSteps: 2,
    totalResults: 3,
    latestTitle: "Hybrid fallback",
    stageCounts: [
      ["memory", 1],
      ["fallback", 1]
    ],
    usedFallback: true
  });
});

test("summarizeRetrievalSteps returns an empty summary for no steps", () => {
  assert.deepEqual(summarizeRetrievalSteps([]), {
    totalSteps: 0,
    totalResults: 0,
    latestTitle: "",
    stageCounts: [],
    usedFallback: false
  });
});
