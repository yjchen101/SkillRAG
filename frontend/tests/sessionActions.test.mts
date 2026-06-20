import assert from "node:assert/strict";
import test from "node:test";

import {
  getCompressionActionButtonTitle,
  getNavbarNewSessionButtonTitle,
  getSessionDeleteConfirmMessage,
  getSessionActionButtonTitle,
  getSessionActionState
} from "../src/lib/sessionActions.ts";

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

test("getSessionActionButtonTitle explains disabled and enabled actions", () => {
  assert.equal(
    getSessionActionButtonTitle({
      actionLabel: "新建会话",
      state: { disabled: false, reason: null }
    }),
    "新建会话"
  );
  assert.equal(
    getSessionActionButtonTitle({
      actionLabel: "删除会话",
      state: { disabled: true, reason: "正在生成回复，完成后再操作会话" }
    }),
    "正在生成回复，完成后再操作会话"
  );
});

test("getNavbarNewSessionButtonTitle explains navbar new session action", () => {
  assert.equal(
    getNavbarNewSessionButtonTitle({ disabled: false, reason: null }),
    "创建新的会话"
  );
  assert.equal(
    getNavbarNewSessionButtonTitle({
      disabled: true,
      reason: "工作台初始化完成后可操作会话"
    }),
    "工作台初始化完成后可操作会话"
  );
});

test("getCompressionActionButtonTitle explains compression availability", () => {
  assert.equal(
    getCompressionActionButtonTitle({ disabled: false, reason: null }),
    "压缩当前会话上下文"
  );
  assert.equal(
    getCompressionActionButtonTitle({
      disabled: true,
      reason: "当前没有可操作的会话"
    }),
    "当前没有可操作的会话"
  );
});

test("getSessionDeleteConfirmMessage explains destructive deletion", () => {
  assert.equal(
    getSessionDeleteConfirmMessage("季度复盘"),
    "删除会话「季度复盘」？此操作不可撤销。"
  );
  assert.equal(
    getSessionDeleteConfirmMessage("   "),
    "删除这个未命名会话？此操作不可撤销。"
  );
});
