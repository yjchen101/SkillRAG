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

export function shouldDisableInspectorSave({
  isDirty,
  isSaving
}: {
  isDirty: boolean;
  isSaving: boolean;
}) {
  return isSaving || !isDirty;
}
