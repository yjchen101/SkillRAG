export function getRagModeToggleTitle(enabled: boolean) {
  return enabled ? "关闭知识检索：仅使用普通对话" : "开启知识检索：优先使用本地知识";
}

export function getRagModeToggleLabel(enabled: boolean) {
  return enabled ? "知识检索已开" : "知识检索已关";
}
