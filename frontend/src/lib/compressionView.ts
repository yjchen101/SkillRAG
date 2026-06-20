export function getCompressionSavingsLabel({
  preCompressTokens,
  postCompressTokens
}: {
  preCompressTokens: number;
  postCompressTokens: number;
}) {
  if (preCompressTokens <= 0 || postCompressTokens < 0) {
    return "节省 --";
  }

  const savedTokens = Math.max(0, preCompressTokens - postCompressTokens);
  const savedPercent = Math.round((savedTokens / preCompressTokens) * 100);

  return `节省 ${savedPercent}%`;
}

export function getCompressionEventCountLabel(count: number) {
  return `最近 ${count} 次压缩`;
}

export function getCompressionReasonLabel(reason: string) {
  if (reason === "prompt_tokens_exceeded") {
    return "自动触发";
  }
  if (reason === "manual_request") {
    return "手动触发";
  }
  return reason || "未知原因";
}

export function getCompressionTimestampLabel(timestamp: number) {
  if (!timestamp) {
    return "未知时间";
  }

  return new Date(timestamp * 1000).toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function getCompressionRepairLabel() {
  return "已修复摘要";
}

export function getCompressionBudgetTargetLabel(targetBudgetTokens: number) {
  return `目标 ${targetBudgetTokens} tokens`;
}
