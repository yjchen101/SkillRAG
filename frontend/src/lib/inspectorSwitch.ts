export type InspectorSwitchState = {
  currentPath: string;
  nextPath: string;
  isDirty: boolean;
};

export function shouldConfirmInspectorSwitch({
  currentPath,
  nextPath,
  isDirty
}: InspectorSwitchState) {
  return isDirty && currentPath !== nextPath;
}

export function getInspectorSwitchConfirmMessage({
  currentPath,
  nextPath
}: {
  currentPath: string;
  nextPath: string;
}) {
  const current = currentPath.trim();
  const next = nextPath.trim();
  if (!current || !next) {
    return "当前文件还有未保存修改。切换文件会丢弃这些修改，确定继续？";
  }

  return `当前文件「${current}」还有未保存修改。切换到「${next}」会丢弃这些修改，确定继续？`;
}
