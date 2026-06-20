import assert from "node:assert/strict";
import test from "node:test";

import {
  getMessagePreview,
  getRawMessageEmptyText,
  getRawMessageIndexLabel,
  getRawMessageToolLabel
} from "../src/lib/messagePreview.ts";

test("getMessagePreview shows streaming placeholder for empty assistant messages", () => {
  assert.equal(
    getMessagePreview({
      content: "",
      role: "assistant",
      isStreaming: true
    }),
    "正在生成回复..."
  );
});

test("getMessagePreview shows a neutral placeholder for empty non-streaming messages", () => {
  assert.equal(
    getMessagePreview({
      content: "   ",
      role: "user"
    }),
    "暂无内容"
  );
});

test("getMessagePreview truncates long visible content", () => {
  assert.equal(
    getMessagePreview({
      content: "abcdef",
      role: "assistant",
      maxLength: 3
    }),
    "abc..."
  );
});

test("getRawMessageIndexLabel marks the latest raw message", () => {
  assert.equal(getRawMessageIndexLabel({ index: 0, total: 3 }), "#1");
  assert.equal(getRawMessageIndexLabel({ index: 2, total: 3 }), "#3 最新");
});

test("getRawMessageToolLabel describes tool usage in Chinese", () => {
  assert.equal(getRawMessageToolLabel(0), "无工具");
  assert.equal(getRawMessageToolLabel(2), "2 个工具");
});

test("getRawMessageEmptyText explains when raw messages appear", () => {
  assert.equal(
    getRawMessageEmptyText(),
    "当前会话还没有消息，发送后会在这里显示原始消息"
  );
});
