export function shouldSubmitSessionRename({
  currentTitle,
  draftTitle
}: {
  currentTitle: string;
  draftTitle: string;
}) {
  const nextTitle = draftTitle.trim();
  return nextTitle.length > 0 && nextTitle !== currentTitle.trim();
}

export function shouldDisableSessionRenameSave({
  currentTitle,
  draftTitle
}: {
  currentTitle?: string | null;
  draftTitle: string;
}) {
  if (!currentTitle) {
    return true;
  }

  return !shouldSubmitSessionRename({ currentTitle, draftTitle });
}

export function getSessionRenameSaveTitle({
  currentTitle,
  draftTitle
}: {
  currentTitle?: string | null;
  draftTitle: string;
}) {
  if (!currentTitle) {
    return "请选择一个会话后再重命名";
  }

  const nextTitle = draftTitle.trim();
  if (!nextTitle) {
    return "输入新的会话标题后保存";
  }

  if (nextTitle === currentTitle.trim()) {
    return "标题没有变化";
  }

  return "保存新的会话标题";
}

export function getSessionRenameCancelTitle() {
  return "取消重命名并保留原标题";
}
