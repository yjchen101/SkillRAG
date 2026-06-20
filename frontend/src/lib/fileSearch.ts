export function getFileSearchEmptyMessage(query: string) {
  const trimmedQuery = query.trim();
  return trimmedQuery ? `没有匹配「${trimmedQuery}」的文件` : "没有匹配的文件";
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
  return query.trim()
    ? `匹配 ${filteredCount} / ${totalCount} 个文件`
    : `共 ${totalCount} 个文件`;
}

export function getFilePathChipTitle(path: string) {
  return `打开文件：${path}`;
}
