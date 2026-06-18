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
