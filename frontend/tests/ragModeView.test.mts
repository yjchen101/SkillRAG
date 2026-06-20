import assert from "node:assert/strict";
import test from "node:test";

import { getRagModeToggleTitle } from "../src/lib/ragModeView.ts";

test("getRagModeToggleTitle explains the next RAG mode", () => {
  assert.equal(getRagModeToggleTitle(true), "关闭 RAG：仅使用普通对话");
  assert.equal(getRagModeToggleTitle(false), "开启 RAG：优先使用知识检索");
});
