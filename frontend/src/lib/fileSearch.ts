export function getFileSearchEmptyMessage(query: string) {
  const trimmedQuery = query.trim();
  return trimmedQuery ? `没有匹配「${trimmedQuery}」的文件` : "没有匹配的文件";
}
