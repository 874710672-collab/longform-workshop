/* lf-app4.js — 长篇 App 主逻辑（四）：设置 / 段列表 / 启动 */
(function () {
  const $ = window.$, el = window.el;
  const LF = window.LF, A = () => window.LF_APP.A;

  function closeDrawer() {
    const b = document.getElementById('arcList');
    if (b) b.classList.remove('open');
  }

  /* ---------- 段列表（侧栏） ---------- */
  function renderArcList() {
    const p = A().project;
    const box = $('#arcList');
    if (!box) return;
    box.innerHTML = '';
    if (!p) { box.hidden = true; return; }
    box.hidden = false;

    const head = el('div', 'al-head');
    head.appendChild(el('span', '', '阶段'));
    const nb = el('button', 'icon-btn', '＋');
    nb.title = '新建下一段';
    nb.onclick = () => { closeDrawer(); window.LF_ACT.newArc(); };
    head.appendChild(nb);
    box.appendChild(head);

    (p.arcs || []).forEach((a, i) => {
      const done = a.step === 'polish' && a.steps.polish && a.steps.polish.status === 'done';
      const row = el('div', 'al-row' + (i === p.curArc ? ' on' : '') + (done ? ' done' : ''));
      row.appendChild(el('span', 'al-no', String(a.no)));
      const mid = el('div', 'al-mid');
      mid.appendChild(el('div', 'al-title', a.title));
      mid.appendChild(el('div', 'al-sub', done ? '已完成' : (LF.STEP_NAME[a.step] || '')));
      row.appendChild(mid);
      row.onclick = () => { closeDrawer(); window.LF_ACT.switchArc(i); };
      box.appendChild(row);
    });

    const bk = el('div', 'al-row book');
    bk.appendChild(el('span', 'al-no', '0'));
    const bm = el('div', 'al-mid');
    bm.appendChild(el('div', 'al-title', '全书档案'));
    bm.appendChild(el('div', 'al-sub', p.premise.oneLine ? '已填' : '未填'));
    bk.appendChild(bm);
    bk.onclick = () => { closeDrawer(); A().view = 'book'; LF_APP.render(); };
    box.appendChild(bk);
  }

  /* ---------- 设置面板 ---------- */
  function openSettings() {
    const c = LF.cfg();
    const mask = el('div', 'mask');
    const panel = el('div', 'panel');
    panel.appendChild(el('h2', '', '设置'));

    const rows = [
      ['baseUrl', 'Base URL', 'https://api.deepseek.com'],
      ['apiKey', 'API Key', 'sk-…'],
      ['model', '模型', 'deepseek-chat']
    ];
    const inputs = {};
    rows.forEach(([k, label, ph]) => {
      const f = el('div', 'field');
      f.appendChild(el('label', '', label));
      const i = el('input');
      i.value = c[k] || '';
      i.placeholder = ph;
      if (k === 'apiKey') i.type = 'password';
      inputs[k] = i;
      f.appendChild(i);
      panel.appendChild(f);
    });

    const f3 = el('div', 'field');
    f3.appendChild(el('label', '', '每步生成几个候选（1-4）'));
    const sel = el('select');
    [1, 2, 3, 4].forEach(n => {
      const o = el('option', '', n + ' 个');
      o.value = String(n);
      if ((c.candidates || 1) === n) o.selected = true;
      sel.appendChild(o);
    });
    f3.appendChild(sel);
    panel.appendChild(f3);

    const f4 = el('div', 'field');
    f4.appendChild(el('label', '', '流式输出'));
    const sw = el('input');
    sw.type = 'checkbox';
    sw.checked = c.stream !== false;
    f4.appendChild(sw);
    panel.appendChild(f4);

    // 思考模式
    const f5 = el('div', 'field');
    f5.appendChild(el('label', '', '思考模式'));
    const tm = el('select');
    [
      ['off', '关闭思考（推荐）· 发 thinking:disabled'],
      ['auto', '自动判断 · 只对支持的模型关闭'],
      ['none', '不发任何参数 · 完全交给服务端']
    ].forEach(([v, t]) => {
      const o = el('option', '', t);
      o.value = v;
      if ((c.thinkingMode || 'off') === v) o.selected = true;
      tm.appendChild(o);
    });
    f5.appendChild(tm);
    const tip = el('p', 'hint',
      'DeepSeek 新版（v4 / flash）和豆包 seed 系列默认都开着思考，不关会慢、贵，还可能把思考混进正文。');
    tip.style.margin = '6px 0 0';
    f5.appendChild(tip);
    panel.appendChild(f5);

    const act = el('div', 'row');
    const test = el('button', 'ghost-btn', '测试连接');
    test.onclick = async () => {
      try {
        LF.saveCfg(Object.assign(LF.cfg(), {
          baseUrl: inputs.baseUrl.value, apiKey: inputs.apiKey.value,
          model: inputs.model.value, stream: false
        }));
        const r = await window.API.testConn();
        alert('连接正常：' + r.slice(0, 40));
      } catch (e) { alert('连接失败：' + (e.message || e)); }
    };
    act.appendChild(test);

    const save = el('button', 'primary-btn', '保存');
    save.onclick = () => {
      const nc = Object.assign(LF.cfg(), {
        baseUrl: inputs.baseUrl.value.trim(),
        apiKey: inputs.apiKey.value.trim(),
        model: inputs.model.value.trim(),
        candidates: +sel.value,
        stream: sw.checked,
        thinkingMode: tm.value
      });
      LF.saveCfg(nc);
      mask.remove();
      window.LF_APP.toast('已保存');
    };
    act.appendChild(save);

    const close = el('button', 'ghost-btn', '关闭');
    close.onclick = () => mask.remove();
    act.appendChild(close);
    panel.appendChild(act);

    mask.appendChild(panel);
    mask.onclick = e => { if (e.target === mask) mask.remove(); };
    document.body.appendChild(mask);
  }

  /* ---------- 导入 ---------- */
  function importProject() {
    const inp = el('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = () => {
      const f = inp.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const p = window.migrateProject(JSON.parse(r.result));
          LF.put(p);
          window.LF_APP.openProject(p.id);
        } catch (e) { alert('导入失败：' + e.message); }
      };
      r.readAsText(f);
    };
    inp.click();
  }

  /* ---------- 启动 ---------- */
  function on(id, fn) {
    const e = document.getElementById(id);
    if (e) e.onclick = fn;
    else console.warn('[lf] 缺少元素 #' + id);
  }

  function boot() {
    const goHome = () => { A().project = null; A().view = 'home'; window.LF_APP.render(); };
    on('btnHome', goHome);
    on('btnBack', goHome);
    on('btnSet', openSettings);
    on('btnExport', () => {
      if (!A().project) return;
      const want = confirm('导出整本书 JSON？\n\n取消 = 只导出当前段正文');
      if (want) window.LF_EXPORT.project(); else window.LF_EXPORT.arcText();
    });
    on('btnImport', importProject);

    on('btnArcs', () => {
      const b = document.getElementById('arcList');
      if (!b) return;
      b.classList.toggle('open');
    });

    // 点侧栏外的空白处收起
    document.getElementById('stage').addEventListener('click', () => {
      const b = document.getElementById('arcList');
      if (b && b.classList.contains('open')) b.classList.remove('open');
    });

    // 从 URL 导入配置（?base=&key=&model=）方便首发
    const q = new URLSearchParams(location.search);
    if (q.get('key')) {
      const c = LF.cfg();
      c.apiKey = q.get('key');
      if (q.get('base')) c.baseUrl = q.get('base');
      if (q.get('model')) c.model = q.get('model');
      LF.saveCfg(c);
    }

    window.LF_APP.render();
    renderArcList();
  }

  /* 每次渲染后刷新段列表：由 lf-app1 的 render() 直接调用 */
  window.LF_RENDER_ARCS = renderArcList;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  window.LF_BOOT = boot;
  window.LF_SETTINGS = { open: openSettings };
})();
