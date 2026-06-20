export function getRagModeToggleTitle(enabled: boolean) {
  return enabled ? "关闭 RAG：仅使用普通对话" : "开启 RAG：优先使用知识检索";
}
