import assert from "node:assert/strict";
import test from "node:test";

import { getRagModeToggleLabel, getRagModeToggleTitle } from "../src/lib/ragModeView.ts";

test("getRagModeToggleTitle explains the next RAG mode", () => {
  assert.equal(getRagModeToggleTitle(true), "关闭知识检索：仅使用普通对话");
  assert.equal(getRagModeToggleTitle(false), "开启知识检索：优先使用本地知识");
});

test("getRagModeToggleLabel shows the current knowledge retrieval state", () => {
  assert.equal(getRagModeToggleLabel(true), "知识检索已开");
  assert.equal(getRagModeToggleLabel(false), "知识检索已关");
});
