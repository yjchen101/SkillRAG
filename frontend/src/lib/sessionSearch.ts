export function getSessionSearchEmptyMessage(query: string) {
  const trimmedQuery = query.trim();
  return trimmedQuery ? `没有匹配「${trimmedQuery}」的会话` : "没有匹配的会话";
}
