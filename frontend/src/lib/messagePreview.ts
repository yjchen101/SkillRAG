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
