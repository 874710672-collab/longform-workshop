/* lf-boot.js — 启动兜底
   两件事都要保证：
   1) 首屏渲染出来
   2) 顶栏 / 底栏按钮绑上事件
   任一没做到就重试，最多 25 次（约 1.5 秒）
*/
(function () {
  var done = { render: false, bind: false };

  function tryRender() {
    if (!window.LF_APP || typeof window.LF_APP.render !== 'function') return false;
    try {
      window.LF_APP.render();
      var st = document.getElementById('stage');
      done.render = !!(st && st.innerHTML.length > 0);
    } catch (e) {
      console.error('[lf-boot] render failed', e);
    }
    return done.render;
  }

  function tryBind() {
    if (done.bind) return true;
    var back = document.getElementById('btnBack');
    // 已绑过就不重复绑
    if (back && back.onclick) { done.bind = true; return true; }
    if (typeof window.LF_BOOT !== 'function') return false;
    try {
      window.LF_BOOT();
      var b2 = document.getElementById('btnBack');
      done.bind = !!(b2 && b2.onclick);
    } catch (e) {
      console.error('[lf-boot] boot failed', e);
    }
    return done.bind;
  }

  var n = 0;
  function tick() {
    tryRender();
    tryBind();
    if (done.render && done.bind) return;
    if (n++ > 25) {
      console.warn('[lf-boot] 放弃重试', done);
      return;
    }
    setTimeout(tick, 60);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick);
  } else {
    tick();
  }
  window.addEventListener('load', function () { setTimeout(tick, 0); });
})();
