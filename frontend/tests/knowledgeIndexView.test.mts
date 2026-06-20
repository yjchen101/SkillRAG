import assert from "node:assert/strict";
import test from "node:test";

import type { KnowledgeIndexStatus } from "../src/lib/api.ts";
import {
  getKnowledgeBackendLabel,
  getKnowledgeIndexView
} from "../src/lib/knowledgeIndexView.ts";

function makeStatus(overrides: Partial<KnowledgeIndexStatus>): KnowledgeIndexStatus {
  return {
    ready: false,
    building: false,
    last_built_at: null,
    indexed_files: 0,
    needs_rebuild: false,
    stale_files: 0,
    latest_source_mtime: null,
    vector_ready: false,
    bm25_ready: false,
    ...overrides
  };
}

test("getKnowledgeIndexView shows a neutral building state", () => {
  const view = getKnowledgeIndexView(makeStatus({ building: true, vector_ready: true }));

  assert.equal(view.label, "索引重建中");
  assert.equal(view.hint, "知识索引构建中 · 仅 Vector 就绪");
  assert.match(view.hintClassName, /text-ocean/);
});

test("getKnowledgeIndexView warns when files need indexing", () => {
  const view = getKnowledgeIndexView(
    makeStatus({ needs_rebuild: true, stale_files: 3, bm25_ready: true })
  );

  assert.equal(view.label, "重建索引");
  assert.equal(view.hint, "3 个知识文件待索引 · 仅 BM25 就绪");
  assert.match(view.hintClassName, /color-ember/);
});

test("getKnowledgeIndexView shows ready indexes as healthy", () => {
  const view = getKnowledgeIndexView(
    makeStatus({ ready: true, indexed_files: 12, vector_ready: true, bm25_ready: true })
  );

  assert.equal(view.label, "重建索引");
  assert.equal(view.hint, "知识索引已就绪 · 12 个文件 · Vector/BM25 已就绪");
  assert.match(view.hintClassName, /text-ocean/);
});

test("getKnowledgeIndexView warns when status is unavailable", () => {
  const view = getKnowledgeIndexView(null);

  assert.equal(view.label, "重建索引");
  assert.equal(view.hint, "知识索引未就绪 · Vector/BM25 未就绪");
  assert.match(view.hintClassName, /color-ember/);
});

test("getKnowledgeBackendLabel summarizes backend readiness", () => {
  assert.equal(getKnowledgeBackendLabel(null), "Vector/BM25 未就绪");
  assert.equal(getKnowledgeBackendLabel(makeStatus({ vector_ready: true })), "仅 Vector 就绪");
  assert.equal(getKnowledgeBackendLabel(makeStatus({ bm25_ready: true })), "仅 BM25 就绪");
  assert.equal(
    getKnowledgeBackendLabel(makeStatus({ vector_ready: true, bm25_ready: true })),
    "Vector/BM25 已就绪"
  );
});
