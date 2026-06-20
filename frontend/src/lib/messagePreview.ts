export function getMessagePreview({
  content,
  role,
  isStreaming = false,
  maxLength = 72
}: {
  content: string;
  role: "user" | "assistant";
  isStreaming?: boolean;
  maxLength?: number;
}) {
  const text = content.trim();

  if (!text) {
    return role === "assistant" && isStreaming ? "正在生成回复..." : "暂无内容";
  }

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

export function getRawMessageIndexLabel({
  index,
  total
}: {
  index: number;
  total: number;
}) {
  const label = `#${index + 1}`;
  return index === total - 1 ? `${label} 最新` : label;
}

export function getRawMessageToolLabel(toolCount: number) {
  return toolCount > 0 ? `${toolCount} 个工具` : "无工具";
}

export function getRawMessageEmptyText() {
  return "当前会话还没有消息，发送后会在这里显示原始消息";
}
