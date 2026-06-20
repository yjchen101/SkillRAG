import assert from "node:assert/strict";
import test from "node:test";

import { getMessagePreview } from "../src/lib/messagePreview.ts";

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
