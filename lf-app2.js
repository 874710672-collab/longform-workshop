/* lf-app2.js — 长篇 App 主逻辑（二）：全书档案 / 阶段页 / 各环节渲染 */
(function () {
  const $ = window.$, el = window.el;
  const LFE = window.LF_ENGINE, LF = window.LF;

  /* ============ 全书档案（只做一次） ============ */
  function renderBook(st) {
    const p = LF_APP.A.project;
    const head = el('div', 'page-head');
    head.appendChild(el('h1', '', '全书档案'));
    head.appendChild(el('p', 'hint', '这一层只做一次。它决定后面每一段该给读者什么。'));
    st.appendChild(head);

    const pr = p.premise;
    if (!pr.promises.length) pr.promises = [''];
    const fields = [
      ['oneLine', '一句话承诺', '读者翻开这本书，持续拿到的是什么'],
      ['tone', '语气承诺', '用什么调子说话'],
      ['notGive', '明确不承诺什么', '不给读者的东西，和给的一样重要'],
      ['map', '阶段地图', '几段、每段转折强度、全局最大落在哪']
    ];
    fields.forEach(([k, label, hint]) => {
      const box = el('div', 'field');
      box.appendChild(el('label', '', label));
      const ta = el('textarea');
      ta.rows = k === 'oneLine' ? 2 : 4;
      ta.value = pr[k] || '';
      ta.placeholder = hint;
      ta.oninput = () => { pr[k] = ta.value; LF_APP.persist(); };
      box.appendChild(ta);
      st.appendChild(box);
    });

    const box = el('div', 'field');
    box.appendChild(el('label', '', '读者持续获得的那个东西'));
    pr.promises.forEach((x, i) => {
      const ta = el('textarea');
      ta.rows = 2;
      ta.value = x || '';
      ta.placeholder = '读者拿到的感觉是____｜每章怎么兑现____';
      ta.oninput = () => { pr.promises[i] = ta.value; LF_APP.persist(); };
      box.appendChild(ta);
    });
    const add = el('button', 'ghost-btn', '＋ 加一条');
    add.onclick = () => { pr.promises.push(''); LF_APP.persist(); LF_APP.render(); };
    box.appendChild(add);
    st.appendChild(box);

    const act = el('div', 'row');
    const gen = el('button', 'primary-btn', '让 AI 出这份档案');
    gen.onclick = () => LF_ACT.genPremise();
    act.appendChild(gen);
    const toArc = el('button', 'ghost-btn ok', '进入第 1 段 →');
    toArc.onclick = () => { p.bookStep = 'arcs'; LF_APP.A.view = 'arc'; LF_APP.persist(); LF_APP.render(); };
    act.appendChild(toArc);
    st.appendChild(act);
  }

  /* ============ 阶段页 ============ */
  function renderArc(st) {
    const p = LF_APP.A.project, arc = LF_APP.curArc();
    if (!arc) return;

    const head = el('div', 'arc-head');
    const title = el('input', 'arc-title');
    title.value = arc.title;
    title.oninput = () => { arc.title = title.value; LF_APP.persist(); LF_APP.renderTop(); };
    head.appendChild(title);

    const tierSel = el('select', 'arc-tier');
    Object.keys(LF.TIERS).forEach(k => {
      const o = el('option', '', LF.TIERS[k].name + ' · ' + LF.TIERS[k].parts + ' 节');
      o.value = k;
      if (arc.tier === k) o.selected = true;
      tierSel.appendChild(o);
    });
    tierSel.onchange = () => { arc.tier = tierSel.value; LF_APP.persist(); LF_APP.render(); };
    head.appendChild(tierSel);
    st.appendChild(head);

    const ci = el('div', 'carry');
    ci.appendChild(el('label', '', '入口 · 上一段留下的口子'));
    const cin = el('textarea');
    cin.rows = 2;
    cin.value = arc.carryIn;
    cin.placeholder = '把上一段最后留下的那句原文抄在这里。第一段留空。';
    cin.oninput = () => { arc.carryIn = cin.value; LF_APP.persist(); };
    ci.appendChild(cin);
    st.appendChild(ci);

    const step = arc.step;
    st.appendChild(el('p', 'hint step-hint', LF.STEP_DESC[step] || ''));

    if (step === 'draft') return renderDraft(st, p, arc);
    if (step === 'polish') return renderPolish(st, p, arc);
    return renderTextStep(st, p, arc, step);
  }

  /* ============ 文本环节 ============ */
  function renderTextStep(st, p, arc, step) {
    const s = arc.steps[step];
    const txt = LFE.cur(arc, step);

    if (!txt) {
      st.appendChild(el('p', 'empty', '还没有稿子。点下面「生成」出稿。'));
    } else {
      const ta = el('textarea', 'big-text');
      ta.value = txt;
      ta.oninput = () => {
        if (!s.versions[s.sel]) s.versions[s.sel] = { text: '' };
        s.versions[s.sel].text = ta.value;
      };
      ta.onblur = () => LF_APP.persist();
      st.appendChild(ta);
    }

    if (s.versions.length > 1) {
      const hs = el('div', 'versions');
      hs.appendChild(el('span', 'vlabel', '历史：'));
      s.versions.forEach((v, i) => {
        const b = el('button', 'vbtn' + (i === s.sel ? ' on' : ''), 'v' + (i + 1));
        b.onclick = () => { s.sel = i; LF_APP.persist(); LF_APP.render(); };
        hs.appendChild(b);
      });
      st.appendChild(hs);
    }

    st.appendChild(feedbackBox(arc, step));
  }

  function feedbackBox(arc, step) {
    const s = arc.steps[step];
    const box = el('div', 'fb');
    box.appendChild(el('label', '', '给 AI 的意见（只说哪里不对，不要写应该改成什么）'));
    const ta = el('textarea');
    ta.rows = 3;
    ta.placeholder = '例：第二节把母亲写得太可怜了，她不该有表情';
    ta.value = s.feedback || '';
    ta.oninput = () => { s.feedback = ta.value; LF_APP.persist(); };
    box.appendChild(ta);
    return box;
  }

  /* ============ 分节正文 ============ */
  function renderDraft(st, p, arc) {
    const d = arc.steps.draft;
    const plan = LFE.outlinePlan(LFE.cur(arc, 'outline'));
    const total = plan.length || LFE.tierInfo(arc).parts;
    let idx = d.partIdx || 0;
    if (idx >= total) idx = total - 1;
    if (idx < 0) idx = 0;
    d.partIdx = idx;

    const nav = el('div', 'part-nav');
    for (let i = 0; i < total; i++) {
      const pt = d.parts[i];
      const b = el('button', 'pbtn' + (i === idx ? ' on' : '') + (pt ? ' done' : ''), String(i + 1));
      b.onclick = () => { d.partIdx = i; LF_APP.persist(); LF_APP.render(); };
      nav.appendChild(b);
    }
    st.appendChild(nav);

    const part = d.parts[idx];
    const head = el('div', 'part-head');
    head.appendChild(el('strong', '', (plan[idx] && plan[idx].title) || ('第' + (idx + 1) + '节')));
    head.appendChild(el('span', 'tag', part ? LFE.countWords(part.body) + ' 字' : '未写'));
    if (plan[idx] && plan[idx].words) head.appendChild(el('span', 'tag gray', '目标 ' + plan[idx].words + ' 字'));
    st.appendChild(head);

    if (part) {
      const info = window.CHECK.parseSetting(LFE.cur(arc, 'setting'));
      const issues = window.CHECK.checkText(info, part.body, { banned: window.CHECK.parseBanned(LFE.cur(arc, 'setting')) });
      if (issues.length) {
        const ib = el('div', 'issues');
        issues.forEach(x => ib.appendChild(el('div', 'issue ' + x.level, (x.level === 'error' ? '✕ ' : '! ') + x.msg)));
        st.appendChild(ib);
      } else {
        st.appendChild(el('div', 'issues okline', '✓ 自动检查通过（套话 / 人称 / 重复 / 超长段 / 禁写）'));
      }

      const ta = el('textarea', 'big-text draft-text');
      ta.value = part.body;
      ta.oninput = () => { part.body = ta.value; };
      ta.onblur = () => LF_APP.persist();
      st.appendChild(ta);
    } else {
      st.appendChild(el('p', 'empty', '这一节还没写。'));
    }

    const box = el('div', 'fb');
    box.appendChild(el('label', '', '这一节的意见'));
    const fta = el('textarea');
    fta.rows = 3;
    fta.value = d.feedback || '';
    fta.placeholder = '哪里不对写在这里，点「按意见改」只重写这一节';
    fta.oninput = () => { d.feedback = fta.value; LF_APP.persist(); };
    box.appendChild(fta);
    st.appendChild(box);

    const done = d.parts.filter(Boolean).length;
    const words = d.parts.reduce((a, x) => a + (x ? LFE.countWords(x.body) : 0), 0);
    st.appendChild(el('p', 'hint', '已写 ' + done + '/' + total + ' 节，合计 ' + words + ' 字（目标 ' + LFE.tierInfo(arc).words + ' 字）'));
  }

  /* ============ 润色 ============ */
  function renderPolish(st, p, arc) {
    const s = arc.steps.polish;
    const txt = LFE.cur(arc, 'polish');
    if (!txt) {
      st.appendChild(el('p', 'empty', '还没有润色稿。点「生成」把整段润一遍，或先做接缝检查。'));
    } else {
      const ta = el('textarea', 'big-text');
      ta.value = txt;
      ta.oninput = () => { if (s.versions[s.sel]) s.versions[s.sel].text = ta.value; };
      ta.onblur = () => LF_APP.persist();
      st.appendChild(ta);
    }
    const act = el('div', 'row');
    const seam = el('button', 'ghost-btn', '检查接缝');
    seam.onclick = () => LF_ACT.seam();
    act.appendChild(seam);
    st.appendChild(act);
    st.appendChild(feedbackBox(arc, 'polish'));
  }

  window.LF_VIEW = { renderBook, renderArc, renderTextStep, renderDraft, renderPolish, feedbackBox };
  window.LF_EXPORT = { project: window.LF_EXPORT && window.LF_EXPORT.project, arcText: window.LF_EXPORT && window.LF_EXPORT.arcText };
})();
