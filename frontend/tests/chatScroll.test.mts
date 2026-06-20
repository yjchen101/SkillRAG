import assert from "node:assert/strict";
import test from "node:test";

import {
  getScrollToLatestTitle,
  isNearScrollBottom,
  shouldAutoScrollChat
} from "../src/lib/chatScroll.ts";

test("isNearScrollBottom accepts positions within threshold", () => {
  assert.equal(
    isNearScrollBottom({
      scrollTop: 880,
      clientHeight: 100,
      scrollHeight: 1000,
      threshold: 32
    }),
    true
  );
});

test("isNearScrollBottom rejects positions above threshold", () => {
  assert.equal(
    isNearScrollBottom({
      scrollTop: 700,
      clientHeight: 100,
      scrollHeight: 1000,
      threshold: 32
    }),
    false
  );
});

test("shouldAutoScrollChat follows only when user is already near the bottom", () => {
  assert.equal(shouldAutoScrollChat(true), true);
  assert.equal(shouldAutoScrollChat(false), false);
});

test("getScrollToLatestTitle explains the jump button action", () => {
  assert.equal(getScrollToLatestTitle(), "滚动到最新消息");
});
