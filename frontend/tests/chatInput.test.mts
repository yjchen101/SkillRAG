import assert from "node:assert/strict";
import test from "node:test";

import {
  CHAT_INPUT_MAX_HEIGHT,
  CHAT_INPUT_MIN_HEIGHT,
  getChatInputHeight
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
