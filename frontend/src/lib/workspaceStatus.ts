export type WorkspaceStatusState = {
  isInitializing: boolean;
  error: string | null;
};

export type WorkspaceStatusView =
  | {
      kind: "loading" | "error";
      title: string;
      message: string;
    }
  | null;

export function getWorkspaceStatusView(state: WorkspaceStatusState): WorkspaceStatusView {
  if (state.isInitializing) {
    return {
      kind: "loading",
      title: "正在连接后端",
      message: "正在加载会话、技能、知识索引和工作区文件。"
    };
  }

  if (state.error) {
    return {
      kind: "error",
      title: "后端连接失败",
      message: `初始化失败：${state.error}`
    };
  }

  return null;
}

export function getWorkspaceRetryLabel(isRetrying: boolean) {
  return isRetrying ? "正在重试" : "重试连接";
}
