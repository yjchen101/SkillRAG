import assert from "node:assert/strict";
import test from "node:test";

import { getTokenStatsView } from "../src/lib/tokenStatsView.ts";

test("getTokenStatsView explains missing metrics in Chinese", () => {
  assert.deepEqual(getTokenStatsView(null), {
    label: "暂无 token 指标",
    title: "发送消息后显示本轮上下文 token 统计"
  });
});

test("getTokenStatsView summarizes total and token split", () => {
  assert.deepEqual(
    getTokenStatsView({
      system_tokens: 120,
      compressed_context_tokens: 80,
      message_tokens: 300,
      total_tokens: 500
    }),
    {
      label: "500 个 token",
      title: "总计 500 个 token · 系统 120 个 · 压缩上下文 80 个 · 消息 300 个"
    }
  );
});
