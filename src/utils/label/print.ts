/** 在隔离的新窗口里打开自包含 HTML 并触发打印。返回 false 表示弹窗被拦截。 */
export function printHtml(html: string): boolean {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const w = window.open(url, '_blank', 'width=480,height=520');
  if (!w) {
    URL.revokeObjectURL(url);
    return false;
  }
  w.onload = () => {
    w.focus();
    w.print();
    URL.revokeObjectURL(url);
  };
  return true;
}
