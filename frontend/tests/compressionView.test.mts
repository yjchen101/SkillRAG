import assert from "node:assert/strict";
import test from "node:test";

import {
  getCompressedMessageCountLabel,
  getCompressionBudgetTitle,
  getCompressionBudgetTargetLabel,
  getCompressionEventCountLabel,
  getCompressionRepairLabel,
  getCompressionReasonLabel,
  getCompressionTimestampLabel,
  getCompressionWindowTitle,
  getCompressionSavingsLabel
} from "../src/lib/compressionView.ts";

test("getCompressionSavingsLabel reports saved token percentage", () => {
  assert.equal(
    getCompressionSavingsLabel({
      preCompressTokens: 1000,
      postCompressTokens: 250
    }),
    "节省 75%"
  );
});

test("getCompressionSavingsLabel does not show negative savings", () => {
  assert.equal(
    getCompressionSavingsLabel({
      preCompressTokens: 1000,
      postCompressTokens: 1200
    }),
    "节省 0%"
  );
});

test("getCompressionSavingsLabel handles missing token baselines", () => {
  assert.equal(
    getCompressionSavingsLabel({
      preCompressTokens: 0,
      postCompressTokens: 0
    }),
    "节省 --"
  );
});

test("getCompressionEventCountLabel summarizes visible compression history", () => {
  assert.equal(getCompressionEventCountLabel(1), "最近 1 次压缩");
  assert.equal(getCompressionEventCountLabel(3), "最近 3 次压缩");
});

test("getCompressionReasonLabel localizes known and empty reasons", () => {
  assert.equal(getCompressionReasonLabel("prompt_tokens_exceeded"), "自动触发");
  assert.equal(getCompressionReasonLabel("manual_request"), "手动触发");
  assert.equal(getCompressionReasonLabel(""), "未知原因");
});

test("getCompressionTimestampLabel explains missing timestamps", () => {
  assert.equal(getCompressionTimestampLabel(0), "未知时间");
});

test("getCompressionRepairLabel explains degraded repaired summaries", () => {
  assert.equal(getCompressionRepairLabel(), "已修复摘要");
});

test("getCompressionBudgetTargetLabel localizes target token budgets", () => {
  assert.equal(getCompressionBudgetTargetLabel(4096), "目标 4096 tokens");
});

test("getCompressionBudgetTitle localizes the budget panel heading", () => {
  assert.equal(getCompressionBudgetTitle(), "预算");
});

test("getCompressionWindowTitle localizes the window panel heading", () => {
  assert.equal(getCompressionWindowTitle(), "窗口");
});

test("getCompressedMessageCountLabel localizes compressed message counts", () => {
  assert.equal(getCompressedMessageCountLabel(3), "已压缩 3 条消息");
});
