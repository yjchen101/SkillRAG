export function shouldWarnBeforeUnload(isDirty: boolean) {
  return isDirty;
}

export function getBeforeUnloadMessage(path: string) {
  return `${path} 还有未保存修改，离开页面会丢失这些内容。`;
}
