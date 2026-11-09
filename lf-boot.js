/* lf-boot.js — 启动保险
   只做一件事：确保 DOM 就绪后一定渲染一次。
   放在所有脚本最后加载（index.html 已按此顺序）。
*/
(function () {
  function fire() {
    if (!window.LF_APP || typeof window.LF_APP.render !== 'function') return false;
    try {
      window.LF_APP.render();
      var st = document.querySelector('#stage');
      return !!(st && st.innerHTML.length > 0);
    } catch (e) {
      console.error('render failed', e);
      return false;
    }
  }

  var tries = 0;
  function tick() {
    if (fire()) return;
    if (tries++ > 20) return;
    setTimeout(tick, 60);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick);
  } else {
    tick();
  }
  window.addEventListener('load', function () { setTimeout(fire, 0); });
})();
