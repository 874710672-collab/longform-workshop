/* lf-engine.js — 长篇版流程编排
   与短篇 engine.js 的差异：
   1. 每节的输入里带上"上一段留下的口子"
   2. 正文一次只写一节（沿用），但每节写完立刻跑 check.js
   3. 全段写完做接缝检查（seam）
*/
(function () {
  const P = () => window.LF_PROMPTS;

  function briefText(b) {
    const L = [];
    if (b.genre) L.push('题材：' + b.genre);
    if (b.tags) L.push('标签：' + b.tags);
    if (b.idea) L.push('我的想法：' + b.idea);
    if (b.pov) L.push('人称视角：' + b.pov);
    if (b.style) L.push('文风要求：' + b.style);
    if (b.avoid) L.push('不要写的：' + b.avoid);
    return L.join('\n');
  }

  function tierInfo(arc) {
    const T = window.LF.TIERS;
    const t = T[arc && arc.tier] || T.l;
    return { name: t.name, words: Math.round((t.min + t.max) / 2), parts: t.parts, min: t.min, max: t.max };
  }

  function cur(arc, step) {
    const s = arc.steps[step];
    return s && s.versions[s.sel] ? s.versions[s.sel].text : '';
  }

  function fbText(arc, step) {
    const s = arc.steps[step];
    const f = s && (s.feedback || '').trim();
    return f ? '作者的意见（必须照改）：\n' + f : '';
  }

  function premiseText(p) {
    const pr = p.premise || {};
    const L = [];
    if (pr.oneLine) L.push('一句话承诺：' + pr.oneLine);
    if (pr.promises && pr.promises.length) L.push('读者持续获得：' + pr.promises.join('｜'));
    if (pr.tone) L.push('语气承诺：' + pr.tone);
    if (pr.notGive) L.push('明确不承诺：' + pr.notGive);
    if (pr.map) L.push('阶段地图：' + pr.map);
    if (!L.length) return '（全书档案尚未填写）';
    return L.join('\n');
  }

  /* 正文分节：[{title, body}] */
  function splitParts(text) {
    if (!text) return [];
    const lines = String(text).split('\n');
    const parts = [];
    let c = null;
    const isHead = (ln) => {
      const s = ln.trim();
      if (!s || s.length > 30) return false;
      return /^(第[一二三四五六七八九十百零\d]+[节章回]|[\d]+[、.．]\s|[一二三四五六七八九十]+[、.]\s?)/.test(s) || /^[\d]+$/.test(s);
    };
    for (const ln of lines) {
      if (isHead(ln) && (c === null || c.body.trim())) {
        if (c) parts.push(c);
        c = { title: ln.trim(), body: '' };
      } else {
        if (!c) c = { title: '', body: '' };
        c.body += ln + '\n';
      }
    }
    if (c) parts.push(c);
    const out = parts.filter(x => x.body.trim() || x.title);
    return out.map((x, i) => ({ title: x.title || '第' + (i + 1) + '节', body: x.body.trim() }));
  }

  /* 从大纲抓每节字数 */
  function outlinePlan(outlineText) {
    const parts = splitParts(outlineText);
    return parts.map((p, i) => {
      const m = (p.body.match(/约\s*(\d+)\s*字/) || p.title.match(/(\d+)\s*字/) || []);
      return { title: p.title.replace(/[-—|｜].*$/, '').trim(), words: m[1] ? +m[1] : 0 };
    });
  }

  function countWords(s) {
    return (String(s || '').replace(/\s/g, '')).length;
  }

  function joinDraft(arc) {
    const d = arc.steps.draft;
    if (!d || !d.parts || !d.parts.length) return '';
    return d.parts.filter(Boolean).map(p => p.title + '\n\n' + p.body).join('\n\n');
  }

  /* 单步上下文（除正文外的所有环节） */
  function buildContext(p, arc, step) {
    const t = tierInfo(arc);
    const v = {
      brief: briefText(p.brief),
      premise: premiseText(p),
      topic: cur(arc, 'topic'),
      setting: cur(arc, 'setting'),
      outline: cur(arc, 'outline'),
      arcTitle: arc.title,
      carryIn: arc.carryIn || '（第一段，无上一段）',
      tier: t.name,
      words: t.words,
      parts: t.parts,
      feedback: ''
    };
    v.feedback = step ? fbText(arc, step) : '';
    const system = P().get(p, 'system');
    const user = P().fill(P().get(p, step), v);
    return { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], vars: v };
  }

  function buildDraftContext(p, arc, idx) {
    const t = tierInfo(arc);
    const plan = outlinePlan(cur(arc, 'outline'));
    const part = plan[idx] || { title: '第' + (idx + 1) + '节', words: Math.round(t.words / t.parts) };
    const d = arc.steps.draft;
    const prevParts = (d.parts || []).slice(0, idx).filter(Boolean);
    const prev = prevParts.length
      ? prevParts.map(x => x.body).join('\n\n').slice(-2500)
      : (arc.carryIn ? '（上一段结尾：' + arc.carryIn + '）' : '（本段第一节，无前文）');
    const v = {
      brief: briefText(p.brief),
      premise: premiseText(p),
      topic: cur(arc, 'topic'),
      setting: cur(arc, 'setting'),
      outline: cur(arc, 'outline'),
      prev: prev,
      partTitle: part.title,
      partWords: '约 ' + (part.words || Math.round(t.words / t.parts)) + ' 字',
      feedback: fbText(arc, 'draft')
    };
    const system = P().get(p, 'system');
    const user = P().fill(P().get(p, 'draft'), v);
    return { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], vars: v };
  }

  function buildSeamContext(p, arc, firstPart, lastPart) {
    const v = { carryIn: arc.carryIn || '（第一段）', firstPart: firstPart || '', lastPart: lastPart || '', feedback: '' };
    const system = P().get(p, 'system');
    const user = P().fill(P().get(p, 'seam'), v);
    return { messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
  }

  window.LF_ENGINE = {
    briefText, tierInfo, cur, fbText, premiseText, splitParts, outlinePlan,
    countWords, joinDraft, buildContext, buildDraftContext, buildSeamContext
  };
})();
