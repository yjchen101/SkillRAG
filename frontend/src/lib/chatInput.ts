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
  const visibleValue = value.trim();
  if (!visibleValue.length) {
    return "尚未输入";
  }

  return `${visibleValue.length} 字`;
}

export function getChatInputSendTitle({
  disabled,
  disabledReason,
  value
}: {
  disabled: boolean;
  disabledReason?: string;
  value: string;
}) {
  if (disabled) {
    return disabledReason ?? "正在生成回复";
  }

  if (!value.trim()) {
    return "输入内容后发送";
  }

  return "发送消息";
}

export function getChatInputAvailabilityCopy({
  isInitializing,
  workspaceError,
  isStreaming
}: {
  isInitializing: boolean;
  workspaceError: string | null;
  isStreaming: boolean;
}) {
  if (isInitializing) {
    return {
      disabledReason: "正在连接工作台",
      placeholder: "正在连接工作台，稍后即可发送"
    };
  }

  if (workspaceError) {
    return {
      disabledReason: "工作台连接失败",
      placeholder: "工作台连接失败，重试成功后再发送"
    };
  }

  if (isStreaming) {
    return {
      disabledReason: "正在接收流式回复",
      placeholder: undefined
    };
  }

  return {
    disabledReason: undefined,
    placeholder: undefined
  };
}

export function getChatInputClearTitle() {
  return "清空当前输入";
}

export function getChatInputHelperText(disabled: boolean, disabledReason?: string) {
  if (!disabled) {
    return "支持工具调用、记忆检索和多段响应。";
  }

  if (disabledReason === "正在连接工作台") {
    return "正在连接工作台，稍后可继续发送。";
  }

  if (disabledReason === "工作台连接失败") {
    return "工作台连接失败，重试成功后可继续发送。";
  }

  return "正在接收流式回复，完成后可继续追问。";
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
