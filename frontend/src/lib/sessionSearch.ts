export function getSessionSearchEmptyMessage(query: string) {
  const trimmedQuery = query.trim();
  return trimmedQuery ? `没有匹配「${trimmedQuery}」的会话` : "没有匹配的会话";
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
  return query.trim()
    ? `匹配 ${filteredCount} / ${totalCount} 个会话`
    : `共 ${totalCount} 个会话`;
}
