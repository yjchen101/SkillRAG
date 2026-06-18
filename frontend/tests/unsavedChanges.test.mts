import assert from "node:assert/strict";
import test from "node:test";

import { getBeforeUnloadMessage, shouldWarnBeforeUnload } from "../src/lib/unsavedChanges.ts";

test("shouldWarnBeforeUnload warns only when there are dirty edits", () => {
  assert.equal(shouldWarnBeforeUnload(true), true);
  assert.equal(shouldWarnBeforeUnload(false), false);
});

test("getBeforeUnloadMessage explains unsaved Inspector edits", () => {
  assert.equal(
    getBeforeUnloadMessage("memory/MEMORY.md"),
    "memory/MEMORY.md 还有未保存修改，离开页面会丢失这些内容。"
  );
});
