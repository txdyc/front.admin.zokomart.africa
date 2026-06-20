/** 在隔离的新窗口里写入自包含 HTML 并触发打印。返回 false 表示弹窗被拦截。 */
export function printHtml(html: string): boolean {
  const w = window.open('', '_blank', 'width=480,height=520');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  const trigger = () => {
    w.focus();
    w.print();
  };
  if (w.document.readyState === 'complete') trigger();
  else w.onload = trigger;
  return true;
}
