/* lf-app3.js — 长篇 App 主逻辑（三）：生成 / 按意见改 / 通过 / 接缝 */
(function () {
  const $ = window.$, el = window.el;
  const LFE = window.LF_ENGINE, LF = window.LF, A = () => window.LF_APP.A;

  function settle(fn, label) {
    const a = A();
    a.busy = { label: label };
    a.abort = new AbortController();
    window.LF_APP.render();
    return Promise.resolve()
      .then(fn)
      .catch(e => {
        if (e && e.name === 'AbortError') window.LF_APP.toast('已停止');
        else { console.error(e); window.LF_APP.toast('出错：' + (e.message || e), 5000); }
      })
      .finally(() => { a.busy = null; a.abort = null; window.LF_APP.persist(); window.LF_APP.render(); });
  }

  function setVersion(step, text, appendMode) {
    if (!step.versions) step.versions = [];
    if (appendMode) {
      // 「按意见改」：保留上一版作历史，新建一版
      step.versions.push({ text: text, at: Date.now() });
      step.sel = step.versions.length - 1;
    } else {
      step.versions.push({ text: text, at: Date.now() });
      step.sel = step.versions.length - 1;
    }
  }

  /* ---------- 全书档案 ---------- */
  function genPremise() {
    return settle(async () => {
      const p = A().project;
      const system = window.LF_PROMPTS.get(p, 'system');
      const user = window.LF_PROMPTS.fill(window.LF_PROMPTS.get(p, 'premise'), {
        brief: LFE.briefText(p.brief)
      });
      const out = await window.API.chat({
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        signal: A().abort.signal
      });
      // 解析成字段
      const pick = (tag, next) => {
        const re = new RegExp(tag + '[^\\n]*\\n([\\s\\S]*?)(?=' + (next || '$') + ')');
        const m = out.match(re);
        return m ? m[1].trim() : '';
      };
      const pr = p.premise;
      pr.oneLine = pick('【一句话承诺】', '【读者持续获得') || pr.oneLine;
      const prm = pick('【读者持续获得[^】]*】', '【语气承诺】');
      if (prm) pr.promises = prm.split(/\n+/).map(x => x.replace(/^[-·\d.、\s]+/, '').trim()).filter(Boolean);
      pr.tone = pick('【语气承诺】', '【明确不承诺') || pr.tone;
      pr.notGive = pick('【明确不承诺[^】]*】', '【阶段地图】') || pr.notGive;
      pr.map = pick('【阶段地图】') || pr.map;
      p.premiseRaw = out;
    }, '生成全书档案');
  }

  /* ---------- 普通环节 ---------- */
  function gen() {
    const p = A().project;
    if (p && A().view === 'book') return genPremise();
    const arc = window.LF_APP.curArc();
    if (!arc) return;
    if (arc.step === 'draft') return genPart();
    if (arc.step === 'polish') return genPolish();
    return genStep(arc, arc.step);
  }

  function genStep(arc, step) {
    return settle(async () => {
      const p = A().project;
      const ctx = LFE.buildContext(p, arc, step);
      const s = arc.steps[step];
      const cnt = Math.max(1, Math.min(4, LF.cfg().candidates || 1));
      const outs = [];
      for (let i = 0; i < cnt; i++) {
        const out = await window.API.chat({ messages: ctx.messages, signal: A().abort.signal });
        outs.push(window.LF_TIDY ? window.LF_TIDY(out) : out);
        if (A().abort && A().abort.signal.aborted) break;
      }
      if (!outs.length) return;
      if (s.status !== 'done') {
        // 首次：整批替换为候选，选中第一个
        s.versions = outs.map(t => ({ text: t, at: Date.now() }));
        s.sel = 0;
      } else {
        // 已通过后重生成：追加
        outs.forEach(t => s.versions.push({ text: t, at: Date.now() }));
        s.sel = s.versions.length - outs.length;
        s.status = 'idle';
      }
      s.feedback = '';
    }, '生成 · ' + LF.STEP_NAME[step]);
  }

  /* ---------- 逐节正文 ---------- */
  function genPart() {
    const arc = window.LF_APP.curArc();
    return settle(async () => {
      const p = A().project;
      const d = arc.steps.draft;
      const idx = d.partIdx || 0;
      const ctx = LFE.buildDraftContext(p, arc, idx);
      const out = await window.API.chat({ messages: ctx.messages, signal: A().abort.signal });
      const plan = LFE.outlinePlan(LFE.cur(arc, 'outline'));
      const title = (plan[idx] && plan[idx].title) || ('第' + (idx + 1) + '节');
      d.parts = d.parts || [];
      const old = d.parts[idx];
      d.parts[idx] = {
        title: title,
        body: cleanBody(out),
        history: (old && old.body) ? (old.history || []).concat([old.body]) : (old && old.history) || []
      };
      d.feedback = '';
      d.status = d.parts.every(Boolean) ? 'idle' : 'idle';
    }, '写作第 ' + ((arc.steps.draft.partIdx || 0) + 1) + ' 节');
  }

  function cleanBody(t) {
    return String(t || '')
      .replace(/^```[\s\S]*?\n/, '')
      .replace(/```$/,'')
      .replace(/^(好的|以下是)[^\n]*\n+/, '')
      .trim();
  }

  /* ---------- 润色 ---------- */
  function genPolish() {
    const arc = window.LF_APP.curArc();
    return settle(async () => {
      const p = A().project;
      const s = arc.steps.polish;
      const draft = LFE.joinDraft(arc);
      if (!draft) { window.LF_APP.toast('还没有正文可润色'); return; }
      const t = LFE.tierInfo(arc);
      const user = window.LF_PROMPTS.fill(window.LF_PROMPTS.get(p, 'polish'), {
        draft: draft, words: t.words, feedback: (s.feedback || '').trim()
      });
      const system = window.LF_PROMPTS.get(p, 'system');
      const out = await window.API.chat({
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        signal: A().abort.signal
      });
      setVersion(s, window.LF_TIDY ? window.LF_TIDY(out) : cleanBody(out));
      s.feedback = '';
    }, '润色整段');
  }

  /* ---------- 按意见改 ---------- */
  function revise() {
    const p = A().project;
    if (p && A().view === 'book') return genPremise();
    const arc = window.LF_APP.curArc();
    if (!arc) return;
    if (arc.step === 'draft') return genPart();
    if (arc.step === 'polish') return genPolish();
    return genStep(arc, arc.step);
  }

  /* ---------- 接缝检查 ---------- */
  function seam() {
    const arc = window.LF_APP.curArc();
    return settle(async () => {
      const p = A().project;
      const d = arc.steps.draft;
      const parts = (d.parts || []).filter(Boolean);
      const ctx = LFE.buildSeamContext(p, arc, parts[0] ? parts[0].body : '', parts.length ? parts[parts.length - 1].body : '');
      const out = await window.API.chat({ messages: ctx.messages, signal: A().abort.signal });
      // 结果以意见形式放到 polish 环节
      const s = arc.steps.polish;
      s.feedback = (s.feedback ? s.feedback + '\n\n' : '') + '【接缝检查】\n' + out;
    }, '检查接缝');
  }

  /* ---------- 通过 ---------- */
  function approve() {
    const p = A().project;
    const arc = window.LF_APP.curArc();
    if (!arc) return;

    if (arc.step === 'draft') {
      const d = arc.steps.draft;
      const plan = LFE.outlinePlan(LFE.cur(arc, 'outline'));
      const total = plan.length || LFE.tierInfo(arc).parts;
      const filled = d.parts.filter(Boolean).length;
      if (filled < total) {
        if (!confirm('还有 ' + (total - filled) + ' 节没写，确定要进入润色吗？')) return;
      }
      d.status = 'done';
      arc.step = 'polish';
      LF_APP.persist(); LF_APP.render();
      return;
    }

    const order = LF.STEPS.filter(k => k !== 'premise');
    const i = order.indexOf(arc.step);
    // 正文之外的环节
    const s = arc.steps[arc.step];
    if (s && !s.versions[s.sel]) { window.LF_APP.toast('还没有稿子'); return; }
    if (s) s.status = 'done';

    if (arc.step === 'polish') {
      // 收尾：提示抄出口原文
      const last = ((arc.steps.draft.parts || []).filter(Boolean).pop() || {});
      const guess = (last.body || '').trim().split(/\n+/).filter(Boolean).slice(-3).join('\n');
      arc.carryOut = arc.carryOut || guess;
      LF_APP.persist();
      const next = confirm('这一段完成了。\n\n把「出口」留给下一段用：\n\n' + arc.carryOut + '\n\n现在创建下一段？');
      if (next) newArc();
      else LF_APP.render();
      return;
    }

    const nextStep = order[i + 1];
    if (nextStep) { arc.step = nextStep; LF_APP.persist(); LF_APP.render(); }
  }

  /* ---------- 新建下一段 ---------- */
  function newArc() {
    const p = A().project;
    const arc = window.LF_APP.curArc();
    const carried = (arc && (arc.carryOut || '')) || '';
    const n = window.LF.newArc(p.arcs.length + 1);
    n.title = '第 ' + n.no + ' 段';
    n.tier = arc ? arc.tier : 'l';
    n.carryIn = carried;
    p.arcs.push(n);
    p.curArc = p.arcs.length - 1;
    LF_APP.persist();
    LF_APP.render();
    window.LF_APP.toast('已新建第 ' + n.no + ' 段，入口已自动填入');
  }

  /* ---------- 切换段 ---------- */
  function switchArc(i) {
    const p = A().project;
    if (!p || !p.arcs[i]) return;
    p.curArc = i;
    A().view = 'arc';
    LF_APP.persist();
    LF_APP.render();
  }

  window.LF_ACT = { gen, genPremise, genStep, genPart, genPolish, revise, seam, approve, newArc, switchArc };
})();
