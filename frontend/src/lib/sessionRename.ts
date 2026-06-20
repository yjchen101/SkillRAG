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
