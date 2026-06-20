import assert from "node:assert/strict";
import test from "node:test";

import {
  canCopyMessage,
  getCopyMessageLabel,
  shouldResetCaptureState,
  shouldResetCopyState
} from "../src/lib/messageActions.ts";

test("canCopyMessage rejects empty and whitespace-only messages", () => {
  assert.equal(canCopyMessage(""), false);
  assert.equal(canCopyMessage("   \n\t"), false);
});

test("canCopyMessage accepts visible message content", () => {
  assert.equal(canCopyMessage("hello"), true);
  assert.equal(canCopyMessage("  hello  "), true);
});

test("getCopyMessageLabel maps copy states to user-facing labels", () => {
  assert.equal(getCopyMessageLabel("idle"), "复制");
  assert.equal(getCopyMessageLabel("copying"), "复制中");
  assert.equal(getCopyMessageLabel("copied"), "已复制");
  assert.equal(getCopyMessageLabel("error"), "复制失败");
});

test("shouldResetCopyState resets only terminal feedback states", () => {
  assert.equal(shouldResetCopyState("idle"), false);
  assert.equal(shouldResetCopyState("copying"), false);
  assert.equal(shouldResetCopyState("copied"), true);
  assert.equal(shouldResetCopyState("error"), true);
});

test("shouldResetCaptureState resets failed capture feedback only", () => {
  assert.equal(shouldResetCaptureState("idle"), false);
  assert.equal(shouldResetCaptureState("saving"), false);
  assert.equal(shouldResetCaptureState("saved"), false);
  assert.equal(shouldResetCaptureState("error"), true);
});
