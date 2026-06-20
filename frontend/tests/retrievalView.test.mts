import assert from "node:assert/strict";
import test from "node:test";

import { getEvidenceChannelLabel, summarizeRetrievalSteps } from "../src/lib/retrievalView.ts";

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
    emptySteps: 0,
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
    emptySteps: 0,
    latestTitle: "",
    stageCounts: [],
    usedFallback: false
  });
});

test("summarizeRetrievalSteps counts steps without evidence", () => {
  const summary = summarizeRetrievalSteps([
    {
      kind: "knowledge",
      stage: "skill",
      title: "Skill check",
      message: "No direct evidence",
      results: []
    },
    {
      kind: "knowledge",
      stage: "vector",
      title: "Vector hit",
      message: "",
      results: [
        {
          source_path: "knowledge/a.md",
          source_type: "markdown",
          locator: "",
          snippet: "one",
          channel: "vector",
          score: 0.7,
          parent_id: null
        }
      ]
    }
  ]);

  assert.equal(summary.emptySteps, 1);
  assert.equal(summary.totalResults, 1);
});

test("getEvidenceChannelLabel maps evidence channels to Chinese labels", () => {
  assert.equal(getEvidenceChannelLabel("memory"), "Memory");
  assert.equal(getEvidenceChannelLabel("skill"), "Skill");
  assert.equal(getEvidenceChannelLabel("vector"), "向量");
  assert.equal(getEvidenceChannelLabel("bm25"), "BM25");
  assert.equal(getEvidenceChannelLabel("fused"), "融合");
  assert.equal(getEvidenceChannelLabel("unknown"), "其他证据");
});
