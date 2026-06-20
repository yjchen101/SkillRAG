export type StarterPrompt = {
  id: string;
  title: string;
  description: string;
  prompt: string;
};

const STARTER_PROMPTS: StarterPrompt[] = [
  {
    id: "explain-system",
    title: "解释当前系统",
    description: "从 Memory、Skills 和工作区提示开始梳理。",
    prompt: "请基于当前 Memory、Skills 和 Workspace 文件，解释这个本地 Agent 工作台现在是如何工作的，并指出我可以从哪里开始调整。"
  },
  {
    id: "inspect-knowledge",
    title: "检查知识库",
    description: "查看可用知识、索引状态和可能的缺口。",
    prompt: "请检查当前知识库和技能配置，告诉我哪些知识已经可用于检索，哪些地方可能需要补充或重建索引。"
  },
  {
    id: "summarize-session",
    title: "总结会话",
    description: "把当前会话压缩成后续可复用的要点。",
    prompt: "请总结当前会话的目标、已经完成的工作、尚未解决的问题，以及下一步最值得做的动作。"
  }
];

export function getStarterPrompts() {
  return STARTER_PROMPTS;
}

export function getStarterPromptCountLabel(count: number) {
  return `${count} 个起步问题`;
}
