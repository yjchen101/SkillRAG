export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "未知时间";
  }

  const diffMs = now - timestamp * 1000;
  if (diffMs < 0) {
    return "刚刚";
  }

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) {
    return "刚刚";
  }

  if (diffMs < hour) {
    return `${Math.floor(diffMs / minute)} 分钟前`;
  }

  if (diffMs < day) {
    return `${Math.floor(diffMs / hour)} 小时前`;
  }

  if (diffMs < day * 2) {
    return "昨天";
  }

  if (diffMs < day * 7) {
    return `${Math.floor(diffMs / day)} 天前`;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp * 1000));
}
