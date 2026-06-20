import assert from "node:assert/strict";
import test from "node:test";

import { getSessionSearchEmptyMessage } from "../src/lib/sessionSearch.ts";

test("getSessionSearchEmptyMessage shows a generic empty state without query", () => {
  assert.equal(getSessionSearchEmptyMessage(""), "没有匹配的会话");
  assert.equal(getSessionSearchEmptyMessage("   "), "没有匹配的会话");
});

test("getSessionSearchEmptyMessage includes the trimmed query", () => {
  assert.equal(getSessionSearchEmptyMessage("  report  "), "没有匹配「report」的会话");
});
