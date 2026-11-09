/* lf-tidy.js — 把模型输出里的 markdown 记号清理成纯文本
   在 setVersion 之前调用；只动记号，不动内容。
*/
(function () {
  function tidy(t) {
    let s = String(t || '');
    // 去掉 ``` 代码块围栏
    s = s.replace(/```[\s\S]*?\n/g, '').replace(/```/g, '');
    // 行首的 # / ## / ###
    s = s.replace(/^\s{0,3}#{1,6}\s*/gm, '');
    // 行首列表符
    s = s.replace(/^\s*[-*+]\s+/gm, '');
    // 粗体 / 斜体标记
    s = s.replace(/\*\*\*(.+?)\*\*\*/g, '$1');
    s = s.replace(/\*\*(.+?)\*\*/g, '$1');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2');
    s = s.replace(/__(.+?)__/g, '$1');
    // 行内代码
    s = s.replace(/`([^`\n]+)`/g, '$1');
    // 常见客套开头
    s = s.replace(/^(好的|以下是)[^\n]*\n+/, '');
    // 三行以上空行压成两行
    s = s.replace(/\n{3,}/g, '\n\n');
    return s.trim();
  }
  window.LF_TIDY = tidy;
})();
