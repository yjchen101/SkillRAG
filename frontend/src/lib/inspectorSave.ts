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
  const target = path.trim();

  if (!target) {
    if (isSaving) {
      return "正在保存当前文件";
    }

    return isDirty ? "保存当前文件" : "当前文件已同步";
  }

  if (isSaving) {
    return `正在保存 ${target}`;
  }

  return isDirty ? `保存 ${target}` : `${target} 已同步`;
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

export function getInspectorDirtyStatusTitle(isDirty: boolean) {
  return isDirty ? "当前文件有未保存修改" : "当前文件已保存到磁盘";
}
