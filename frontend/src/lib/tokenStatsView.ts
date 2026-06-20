export type TokenStatsViewInput = {
  system_tokens: number;
  compressed_context_tokens: number;
  message_tokens: number;
  total_tokens: number;
};

export function getTokenStatsView(stats: TokenStatsViewInput | null) {
  if (!stats) {
    return {
      label: "暂无 token 指标",
      title: "发送消息后显示本轮上下文 token 统计"
    };
  }

  return {
    label: `${stats.total_tokens} tokens`,
    title: `总计 ${stats.total_tokens} · 系统 ${stats.system_tokens} · 压缩上下文 ${stats.compressed_context_tokens} · 消息 ${stats.message_tokens}`
  };
}
