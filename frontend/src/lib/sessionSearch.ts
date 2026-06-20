export function getSessionSearchEmptyMessage({
  query,
  totalCount
}: {
  query: string;
  totalCount: number;
}) {
  const trimmedQuery = query.trim();
  if (trimmedQuery) {
    return `没有匹配「${trimmedQuery}」的会话`;
  }

  return totalCount === 0 ? "还没有会话，点击新建开始" : "没有匹配的会话";
}

export function getSessionFilterCountLabel({
  filteredCount,
  totalCount,
  query
}: {
  filteredCount: number;
  totalCount: number;
  query: string;
}) {
  if (totalCount === 0) {
    return "暂无会话";
  }

  return query.trim()
    ? `匹配 ${filteredCount} / ${totalCount} 个会话`
    : `共 ${totalCount} 个会话`;
}

export function getSessionSearchClearTitle() {
  return "清空会话搜索条件";
}
