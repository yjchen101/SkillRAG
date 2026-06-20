import assert from "node:assert/strict";
import test from "node:test";

import { formatRelativeTime } from "../src/lib/relativeTime.ts";

const NOW_SECONDS = 1_700_000_000;
const NOW_MS = NOW_SECONDS * 1000;

test("formatRelativeTime explains missing timestamps", () => {
  assert.equal(formatRelativeTime(0, NOW_MS), "未知时间");
});

test("formatRelativeTime keeps recent timestamps compact", () => {
  assert.equal(formatRelativeTime(NOW_SECONDS - 20, NOW_MS), "刚刚");
});

test("formatRelativeTime reports minute-level age", () => {
  assert.equal(formatRelativeTime(NOW_SECONDS - 120, NOW_MS), "2 分钟前");
});

test("formatRelativeTime clarifies future timestamps", () => {
  assert.equal(formatRelativeTime(NOW_SECONDS + 60, NOW_MS), "时间未到");
});
