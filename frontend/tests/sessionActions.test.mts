import assert from "node:assert/strict";
import test from "node:test";

import { getSessionActionState } from "../src/lib/sessionActions.ts";

test("getSessionActionState disables actions while a response is streaming", () => {
  assert.deepEqual(
    getSessionActionState({
      isStreaming: true,
      isInitializing: false,
      workspaceError: null
    }),
    {
      disabled: true,
      reason: "正在生成回复，完成后再操作会话"
    }
  );
});

test("getSessionActionState disables actions during workspace initialization", () => {
  assert.deepEqual(
    getSessionActionState({
      isStreaming: false,
      isInitializing: true,
      workspaceError: null
    }),
    {
      disabled: true,
      reason: "工作台初始化完成后可操作会话"
    }
  );
});

test("getSessionActionState disables actions when the backend is unavailable", () => {
  assert.deepEqual(
    getSessionActionState({
      isStreaming: false,
      isInitializing: false,
      workspaceError: "fetch failed"
    }),
    {
      disabled: true,
      reason: "后端连接恢复后可操作会话"
    }
  );
});

test("getSessionActionState disables session-required actions without a session", () => {
  assert.deepEqual(
    getSessionActionState({
      isStreaming: false,
      isInitializing: false,
      workspaceError: null,
      currentSessionId: null,
      requiresSession: true
    }),
    {
      disabled: true,
      reason: "当前没有可操作的会话"
    }
  );
});

test("getSessionActionState allows actions when the workspace is ready", () => {
  assert.deepEqual(
    getSessionActionState({
      isStreaming: false,
      isInitializing: false,
      workspaceError: null,
      currentSessionId: "session-1",
      requiresSession: true
    }),
    {
      disabled: false,
      reason: null
    }
  );
});
