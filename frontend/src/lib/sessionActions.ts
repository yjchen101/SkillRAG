export type SessionActionState = {
  disabled: boolean;
  reason: string | null;
};

export function getSessionActionState({
  isStreaming,
  isInitializing,
  workspaceError,
  currentSessionId,
  requiresSession = false
}: {
  isStreaming: boolean;
  isInitializing: boolean;
  workspaceError: string | null;
  currentSessionId?: string | null;
  requiresSession?: boolean;
}): SessionActionState {
  if (isStreaming) {
    return {
      disabled: true,
      reason: "正在生成回复，完成后再操作会话"
    };
  }

  if (isInitializing) {
    return {
      disabled: true,
      reason: "工作台初始化完成后可操作会话"
    };
  }

  if (workspaceError) {
    return {
      disabled: true,
      reason: "工作台连接恢复后可操作会话"
    };
  }

  if (requiresSession && !currentSessionId) {
    return {
      disabled: true,
      reason: "当前没有可操作的会话"
    };
  }

  return {
    disabled: false,
    reason: null
  };
}

export function getSessionActionButtonTitle({
  actionLabel,
  state
}: {
  actionLabel: string;
  state: SessionActionState;
}) {
  return state.disabled && state.reason ? state.reason : actionLabel;
}

export function getCompressionActionButtonTitle(state: SessionActionState) {
  return getSessionActionButtonTitle({
    actionLabel: "压缩当前会话上下文",
    state
  });
}

export function getNavbarNewSessionButtonTitle(state: SessionActionState) {
  return getSessionActionButtonTitle({
    actionLabel: "创建新的会话",
    state
  });
}

export function getSessionDeleteConfirmMessage(title: string) {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    return "删除这个未命名会话？此操作不可撤销。";
  }

  return `删除会话「${trimmedTitle}」？此操作不可撤销。`;
}
