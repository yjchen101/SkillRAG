import assert from "node:assert/strict";
import test from "node:test";

import { getWorkspaceRetryLabel, getWorkspaceStatusView } from "../src/lib/workspaceStatus.ts";

test("getWorkspaceStatusView returns loading copy while initializing", () => {
  assert.deepEqual(getWorkspaceStatusView({ isInitializing: true, error: null }), {
    kind: "loading",
    title: "正在连接工作台",
    message: "正在加载会话、技能、知识索引和工作区文件。"
  });
});

test("getWorkspaceStatusView returns retryable error copy when initialization fails", () => {
  assert.deepEqual(getWorkspaceStatusView({ isInitializing: false, error: "fetch failed" }), {
    kind: "error",
    title: "工作台连接失败",
    message: "初始化失败：fetch failed"
  });
});

test("getWorkspaceStatusView returns null when the workspace is ready", () => {
  assert.equal(getWorkspaceStatusView({ isInitializing: false, error: null }), null);
});

test("getWorkspaceRetryLabel reflects retry progress", () => {
  assert.equal(getWorkspaceRetryLabel(false), "重试连接");
  assert.equal(getWorkspaceRetryLabel(true), "正在重试");
});
