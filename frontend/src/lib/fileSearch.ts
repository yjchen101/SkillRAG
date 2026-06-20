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
  return `打开文件：${path}`;
}

export function getInspectorCurrentPathTitle(path: string) {
  return `当前文件：${path}`;
}
