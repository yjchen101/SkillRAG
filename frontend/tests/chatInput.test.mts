import assert from "node:assert/strict";
import test from "node:test";

import {
  CHAT_INPUT_MAX_HEIGHT,
  CHAT_INPUT_MIN_HEIGHT,
  getChatInputCountLabel,
  getChatInputHeight,
  getChatInputSendTitle,
  shouldShowChatInputClear,
  shouldRefocusChatInputAfterSend
} from "../src/lib/chatInput.ts";

test("getChatInputHeight keeps short content at the minimum height", () => {
  assert.deepEqual(getChatInputHeight(64), {
    height: CHAT_INPUT_MIN_HEIGHT,
    overflowY: "hidden"
  });
});

test("getChatInputHeight grows with multiline content", () => {
  assert.deepEqual(getChatInputHeight(180), {
    height: 180,
    overflowY: "hidden"
  });
});

test("getChatInputHeight caps tall content and enables scrolling", () => {
  assert.deepEqual(getChatInputHeight(420), {
    height: CHAT_INPUT_MAX_HEIGHT,
    overflowY: "auto"
  });
});

test("getChatInputCountLabel reports raw input length", () => {
  assert.equal(getChatInputCountLabel(""), "0 字");
  assert.equal(getChatInputCountLabel("hello"), "5 字");
});

test("shouldShowChatInputClear appears only for editable drafts", () => {
  assert.equal(shouldShowChatInputClear("", false), false);
  assert.equal(shouldShowChatInputClear("draft", false), true);
  assert.equal(shouldShowChatInputClear("draft", true), false);
});

test("shouldRefocusChatInputAfterSend only accepts submitted enabled input", () => {
  assert.equal(
    shouldRefocusChatInputAfterSend({ disabled: false, submittedValue: "hello" }),
    true
  );
  assert.equal(
    shouldRefocusChatInputAfterSend({ disabled: false, submittedValue: "   " }),
    false
  );
  assert.equal(
    shouldRefocusChatInputAfterSend({ disabled: true, submittedValue: "hello" }),
    false
  );
});

test("getChatInputSendTitle explains why sending is unavailable", () => {
  assert.equal(
    getChatInputSendTitle({ disabled: false, value: "" }),
    "输入内容后发送"
  );
  assert.equal(
    getChatInputSendTitle({ disabled: false, value: "  hi  " }),
    "发送消息"
  );
  assert.equal(
    getChatInputSendTitle({
      disabled: true,
      disabledReason: "正在连接后端",
      value: "hi"
    }),
    "正在连接后端"
  );
});
