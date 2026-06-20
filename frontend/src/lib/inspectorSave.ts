export function getInspectorSaveLabel({
  isDirty,
  isSaving
}: {
  isDirty: boolean;
  isSaving: boolean;
}) {
  if (isSaving) {
    return "保存中";
  }

  return isDirty ? "保存修改" : "已同步";
}

export function getInspectorSaveTitle({
  path,
  isDirty,
  isSaving
}: {
  path: string;
  isDirty: boolean;
  isSaving: boolean;
}) {
  if (isSaving) {
    return `正在保存 ${path}`;
  }

  return isDirty ? `保存 ${path}` : `${path} 已同步`;
}

export function shouldDisableInspectorSave({
  isDirty,
  isSaving
}: {
  isDirty: boolean;
  isSaving: boolean;
}) {
  return isSaving || !isDirty;
}
