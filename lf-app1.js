/* lf-app1.js — 长篇 App 主逻辑（一）：状态 / 路由 / 顶栏 / 侧栏 */
(function () {
  const $ = s => document.querySelector(s);
  const el = (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined && txt !== null) e.textContent = txt;
    return e;
  };

  const A = {
    project: null,
    view: 'home',        // home | book | arc
    busy: null,
    abort: null
  };

  /* ---------- 持久 ---------- */
  function persist() {
    if (A.project) window.LF.put(A.project);
  }

  function curArc() { return window.LF.curArc(A.project); }

  function openProject(id) {
    const p = window.LF.get(id);
    if (!p) return;
    A.project = p;
    A.view = 'arc';
    if (!p.premise || !p.premise.oneLine) A.view = 'book';
    render();
  }

  function newProject() {
    const p = window.LF.newProject();
    window.LF.put(p);
    A.project = p;
    A.view = 'book';
    render();
  }

  /* ---------- 通用动作 ---------- */
  function toast(msg, ms) {
    let t = $('#toast');
    if (!t) { t = el('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(t._tm);
    t._tm = setTimeout(() => t.classList.remove('on'), ms || 2200);
  }

  function stopBusy() {
    if (A.abort) { try { A.abort.abort(); } catch (e) {} }
    A.abort = null;
    A.busy = null;
    render();
  }

  /* ---------- 渲染入口 ---------- */
  function render() {
    renderTop();
    renderNav();
    renderStage();
    renderDock();
  }

  function renderTop() {
    const p = A.project;
    $('#tbProject').textContent = p ? p.title : '长篇工坊';
    const sub = $('#tbSub');
    if (!p) sub.textContent = '选择或新建一部长篇';
    else if (A.view === 'book') sub.textContent = '全书档案 · 只做一次';
    else {
      const a = curArc();
      sub.textContent = a ? (a.title + ' · ' + (window.LF.STEP_NAME[a.step] || '')) : '';
    }
    $('#btnBack').hidden = (A.view === 'home' && !p);
  }

  function renderNav() {
    const nav = $('#steps');
    nav.innerHTML = '';
    const p = A.project;
    if (!p || A.view === 'home') { nav.hidden = true; return; }
    nav.hidden = false;

    if (A.view === 'book') {
      const b = el('div', 'step on');
      b.appendChild(el('i', '', '0'));
      b.appendChild(el('span', '', '全书档案'));
      b.onclick = () => { A.view = 'book'; render(); };
      nav.appendChild(b);
      return;
    }

    const arc = curArc();
    if (!arc) return;
    const order = window.LF.STEPS.filter(k => k !== 'premise');
    const curIdx = order.indexOf(arc.step);
    order.forEach((k, i) => {
      const done = arc.steps[k] && arc.steps[k].status === 'done';
      const b = el('div', 'step' + (k === arc.step ? ' on' : '') + (done ? ' ok' : ''));
      b.appendChild(el('i', '', done ? '✓' : String(i + 1)));
      b.appendChild(el('span', '', window.LF.STEP_NAME[k]));
      b.onclick = () => {
        // 未完成的前序环节不允许跳转
        const blocked = order.slice(0, i).some(x => !(arc.steps[x] && arc.steps[x].status === 'done'));
        if (blocked) { toast('上一环节还没通过，不能跳到这一步'); return; }
        arc.step = k; persist(); render();
      };
      nav.appendChild(b);
    });
  }

  function renderStage() {
    const st = $('#stage');
    st.innerHTML = '';
    if (!A.project) return renderHome(st);
    if (A.view === 'book') return window.LF_VIEW.renderBook(st);
    return window.LF_VIEW.renderArc(st);
  }

  function renderDock() {
    const d = $('#dock');
    d.innerHTML = '';
    if (!A.project || A.view === 'home') { d.hidden = true; return; }
    d.hidden = false;

    const info = el('div', 'dock-info');
    if (A.busy) info.textContent = '生成中… ' + (A.busy.label || '');
    else {
      const arc = curArc();
      if (A.view === 'arc' && arc) {
        const t = window.LF_ENGINE.tierInfo(arc);
        let n = 0;
        if (arc.step === 'draft') {
          n = (arc.steps.draft.parts || []).reduce((a, x) => a + (x ? window.LF_ENGINE.countWords(x.body) : 0), 0);
        } else {
          n = window.LF_ENGINE.countWords(window.LF_ENGINE.cur(arc, arc.step));
        }
        info.textContent = n + ' 字 / 目标 ' + t.words + ' 字';
      } else info.textContent = '—';
    }
    d.appendChild(info);

    const acts = el('div', 'dock-acts');
    if (A.busy) {
      const b = el('button', 'ghost-btn', '■ 停止');
      b.onclick = stopBusy;
      acts.appendChild(b);
    } else {
      const gen = el('button', 'primary-btn', '生成');
      gen.onclick = () => window.LF_ACT.gen();
      acts.appendChild(gen);
      const rev = el('button', 'ghost-btn', '✎ 按意见改');
      rev.onclick = () => window.LF_ACT.revise();
      acts.appendChild(rev);
      const ok = el('button', 'ghost-btn ok', '通过 →');
      ok.onclick = () => window.LF_ACT.approve();
      acts.appendChild(ok);
    }
    d.appendChild(acts);
  }

  /* ---------- 首页 ---------- */
  function renderHome(st) {
    const list = window.LF.loadAll();
    const head = el('div', 'page-head');
    head.appendChild(el('h1', '', '长篇工坊'));
    head.appendChild(el('p', 'hint', '每个阶段跑一次完整的短篇流水线：立意 → 设定 → 大纲 → 正文 → 润色'));
    st.appendChild(head);

    const nb = el('button', 'primary-btn big', '＋ 新建长篇');
    nb.onclick = newProject;
    st.appendChild(nb);

    if (!list.length) {
      st.appendChild(el('p', 'empty', '还没有项目。'));
      return;
    }
    const grid = el('div', 'cards');
    list.forEach(p => {
      const c = el('div', 'card');
      c.appendChild(el('div', 'card-title', p.title));
      const arcs = (p.arcs || []).map(a => {
        const parts = (a.steps && a.steps.draft && a.steps.draft.parts || []).filter(Boolean).length;
        return '第' + a.no + '段 ' + (window.LF.STEP_NAME[a.step] || '') + (parts ? '（' + parts + '节）' : '');
      }).join(' · ');
      c.appendChild(el('div', 'card-sub', arcs || '未开始'));
      c.onclick = () => openProject(p.id);
      const del = el('button', 'icon-btn del', '🗑');
      del.onclick = (e) => {
        e.stopPropagation();
        if (confirm('删除《' + p.title + '》？不可恢复')) { window.LF.del(p.id); render(); }
      };
      c.appendChild(del);
      grid.appendChild(c);
    });
    st.appendChild(grid);
  }

  /* ---------- 导出 ---------- */
  function exportProject() {
    const p = A.project;
    if (!p) return;
    const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (p.title || '长篇') + '.json';
    a.click();
  }

  function exportArcText() {
    const arc = curArc();
    if (!arc) return;
    const txt = window.LF_ENGINE.joinDraft(arc) || window.LF_ENGINE.cur(arc, 'polish');
    const blob = new Blob([txt], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (A.project.title || '长篇') + '_' + arc.title + '.txt';
    a.click();
  }

  window.LF_APP = { A, render, renderTop, renderNav, renderStage, renderHome, renderDock, persist, curArc, toast, openProject, stopBusy };
  window.LF_EXPORT = { project: exportProject, arcText: exportArcText };
  window.$ = $; window.el = el;
})();
