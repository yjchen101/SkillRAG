export const CHAT_INPUT_MIN_HEIGHT = 112;
export const CHAT_INPUT_MAX_HEIGHT = 260;

export type ChatInputHeight = {
  height: number;
  overflowY: "hidden" | "auto";
};

export function getChatInputHeight(
  scrollHeight: number,
  minHeight = CHAT_INPUT_MIN_HEIGHT,
  maxHeight = CHAT_INPUT_MAX_HEIGHT
): ChatInputHeight {
  const nextHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));

  return {
    height: nextHeight,
    overflowY: scrollHeight > maxHeight ? "auto" : "hidden"
  };
}

export function getChatInputCountLabel(value: string) {
  return `${value.length} 字`;
}

export function shouldShowChatInputClear(value: string, disabled: boolean) {
  return !disabled && value.length > 0;
}

export function shouldRefocusChatInputAfterSend({
  disabled,
  submittedValue
}: {
  disabled: boolean;
  submittedValue: string;
}) {
  return !disabled && submittedValue.trim().length > 0;
}
