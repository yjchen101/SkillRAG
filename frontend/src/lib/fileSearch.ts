export function getFileSearchEmptyMessage({
  query,
  totalCount
}: {
  query: string;
  totalCount: number;
}) {
  const trimmedQuery = query.trim();
  if (trimmedQuery) {
    return `没有匹配「${trimmedQuery}」的文件`;
  }

  return totalCount === 0 ? "暂无可编辑文件，稍后重试" : "没有匹配的文件";
}

export function getFileFilterCountLabel({
  filteredCount,
  totalCount,
  query
}: {
  filteredCount: number;
  totalCount: number;
  query: string;
}) {
  if (totalCount === 0) {
    return "暂无可编辑文件";
  }

  return query.trim()
    ? `匹配 ${filteredCount} / ${totalCount} 个文件`
    : `共 ${totalCount} 个文件`;
}

export function getFilePathChipTitle(path: string) {
  const trimmedPath = path.trim();
  return trimmedPath ? `打开文件：${trimmedPath}` : "打开当前文件";
}

export function getFileSearchClearTitle() {
  return "清空文件搜索条件";
}

export function getFileSearchInputTitle() {
  return "按文件路径筛选列表";
}

export function getInspectorCurrentPathTitle(path: string) {
  const trimmedPath = path.trim();
  return trimmedPath ? `当前文件：${trimmedPath}` : "当前文件未选择";
}

export function getInspectorCurrentPathLabel(path: string) {
  const trimmedPath = path.trim();
  return trimmedPath || "未选择文件";
}

export function getInspectorSaveShortcutTitle() {
  return "按 Cmd 或 Ctrl + S 保存当前文件";
}

export function getInspectorPanelLabels() {
  return {
    section: "检查器",
    heading: "记忆 / 技能 / 提示"
  };
}
