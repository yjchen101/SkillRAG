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
      reason: "后端连接恢复后可操作会话"
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
