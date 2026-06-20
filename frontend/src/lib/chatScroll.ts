export type ScrollPosition = {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
  threshold?: number;
};

const DEFAULT_THRESHOLD = 80;

export function isNearScrollBottom({
  scrollTop,
  clientHeight,
  scrollHeight,
  threshold = DEFAULT_THRESHOLD
}: ScrollPosition) {
  return scrollHeight - scrollTop - clientHeight <= threshold;
}

export function shouldAutoScrollChat(isNearBottom: boolean) {
  return isNearBottom;
}

export function getScrollToLatestTitle() {
  return "滚动到最新消息";
}
