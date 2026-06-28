import assert from "node:assert/strict";
import test from "node:test";

import {
  getChatPanelSectionLabels,
  getChatPanelIntroCopy,
  getStarterPromptActionTitle,
  getStarterPromptCountLabel,
  getStarterPrompts
} from "../src/lib/starterPrompts.ts";

test("getStarterPrompts exposes several actionable prompts", () => {
  const prompts = getStarterPrompts();

  assert.ok(prompts.length >= 3);
  for (const prompt of prompts) {
    assert.ok(prompt.id.trim());
    assert.ok(prompt.title.trim());
    assert.ok(prompt.prompt.trim().length > prompt.title.trim().length);
  }
});

test("getStarterPrompts includes system, knowledge, and session-oriented prompts", () => {
  assert.deepEqual(
    getStarterPrompts().map((prompt) => prompt.id),
    ["explain-system", "inspect-knowledge", "summarize-session"]
  );
});

test("getStarterPrompts uses localized workspace terms", () => {
  const [systemPrompt] = getStarterPrompts();

  assert.equal(systemPrompt.description, "从记忆、技能和工作区提示开始梳理。");
  assert.equal(
    systemPrompt.prompt,
    "请基于当前记忆、技能和工作区文件，解释这个本地 Agent 工作台现在是如何工作的，并指出我可以从哪里开始调整。"
  );
});

test("getStarterPromptCountLabel explains available starter actions", () => {
  assert.equal(getStarterPromptCountLabel(0), "暂无起步问题");
  assert.equal(getStarterPromptCountLabel(3), "3 个起步问题");
});

test("getStarterPromptActionTitle explains enabled and disabled starter actions", () => {
  assert.equal(
    getStarterPromptActionTitle({
      disabled: false,
      disabledReason: undefined,
      title: "解释当前系统"
    }),
    "发送起步问题「解释当前系统」"
  );
  assert.equal(
    getStarterPromptActionTitle({
      disabled: true,
      disabledReason: "工作台连接失败",
      title: "检查知识库"
    }),
    "工作台连接失败"
  );
  assert.equal(
    getStarterPromptActionTitle({
      disabled: true,
      disabledReason: undefined,
      title: "总结会话"
    }),
    "工作台可用后再发送起步问题"
  );
});

test("getChatPanelSectionLabels localizes visible panel labels", () => {
  assert.deepEqual(getChatPanelSectionLabels(), {
    conversation: "对话",
    ready: "就绪"
  });
});

test("getChatPanelIntroCopy uses localized workspace terms", () => {
  assert.deepEqual(getChatPanelIntroCopy(), {
    title: "一个本地、透明、文件驱动的 Agent 工作台",
    description: "你可以直接提问，也可以在右侧编辑记忆、技能和工作区文件。所有系统提示、会话和工具执行都可以追踪。"
  });
});
