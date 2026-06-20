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
