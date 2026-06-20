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
