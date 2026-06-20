import assert from "node:assert/strict";
import test from "node:test";

import { getRagModeToggleTitle } from "../src/lib/ragModeView.ts";

test("getRagModeToggleTitle explains the next RAG mode", () => {
  assert.equal(getRagModeToggleTitle(true), "关闭知识检索：仅使用普通对话");
  assert.equal(getRagModeToggleTitle(false), "开启知识检索：优先使用本地知识");
});
