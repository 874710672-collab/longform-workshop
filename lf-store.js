/* lf-store.js — 长篇版数据模型
   三层：book（全书层，一次）→ arcs（阶段层，每段一次五环节）→ 段内 7 节
   与短篇 store.js 的差异：项目下面多一层 arc；stage 各环节多三层结构字段。
*/
(function () {
  const LS_KEY = 'lf_projects_v1';
  const CFG_KEY = 'lf_cfg_v1';

  const STEPS = ['premise', 'topic', 'setting', 'outline', 'draft', 'polish'];
  const STEP_NAME = {
    premise: '全书档案',
    topic: '阶段立意',
    setting: '阶段设定',
    outline: '分节大纲',
    draft: '分节正文',
    polish: '润色成稿'
  };
  const STEP_DESC = {
    premise: '只做一次：承诺 / 语气 / 不承诺 / 阶段地图',
    topic: '出 3 个方案，挑一个。必须接住上一段的开口',
    setting: '定死规则与人物。本段结束时谁会知道什么',
    outline: '每节只做一件事，写清情绪走向和读者多知道什么',
    draft: '一次只写一节，人工逐节审',
    polish: '单节润色 + 全段润色 + 接缝检查'
  };

  // 篇幅：一段多少节
  const TIERS = {
    s: { name: '段·小', min: 3000, max: 5000, parts: 3 },
    m: { name: '段·中', min: 8000, max: 12000, parts: 5 },
    l: { name: '段·大', min: 15000, max: 20000, parts: 7 }
  };

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function newStep() {
    return { status: 'idle', versions: [], sel: 0, feedback: '', rejected: [] };
  }

  function newArc(no) {
    return {
      id: uid(),
      no: no || 1,
      title: '第 ' + (no || 1) + ' 段',
      tier: 'l',
      // 交接层：入口（上一段留下的一句原文）+ 出口（本段留下的一句原文）
      carryIn: '',
      carryOut: '',
      step: 'topic',
      steps: {
        topic: newStep(),
        setting: newStep(),
        outline: newStep(),
        draft: { status: 'idle', versions: [], sel: 0, feedback: '', partIdx: 0, parts: [] },
        polish: newStep()
      }
    };
  }

  function newProject() {
    return {
      id: uid(),
      title: '未命名长篇',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      brief: { genre: '', tags: '', idea: '', pov: '第三人称', style: '', avoid: '' },
      // 全书层
      premise: {
        oneLine: '',        // 一句话承诺
        promises: [],       // 读者持续获得什么（1-3 条）
        tone: '',           // 语气承诺
        notGive: '',        // 明确不承诺什么
        map: ''             // 阶段地图：几段、每段转折强度、全局最大落在哪
      },
      premiseStep: newStep(),
      bookStep: 'premise',
      arcs: [newArc(1)],
      curArc: 0
    };
  }

  function migrate(p) {
    if (!p) return p;
    if (!p.premise) p.premise = { oneLine: '', promises: [], tone: '', notGive: '', map: '' };
    if (!p.premiseStep) p.premiseStep = newStep();
    if (!p.bookStep) p.bookStep = 'premise';
    if (!Array.isArray(p.arcs) || !p.arcs.length) p.arcs = [newArc(1)];
    p.arcs.forEach((a, i) => {
      if (!a.id) a.id = uid();
      if (!a.no) a.no = i + 1;
      if (!a.title) a.title = '第 ' + a.no + ' 段';
      if (!a.tier || !TIERS[a.tier]) a.tier = 'l';
      if (!a.steps) a.steps = {};
      Object.keys(STEPS).forEach(() => {});
      ['topic', 'setting', 'outline', 'polish'].forEach(k => {
        if (!a.steps[k]) a.steps[k] = newStep();
        if (!Array.isArray(a.steps[k].rejected)) a.steps[k].rejected = [];
      });
      if (!a.steps.draft) a.steps.draft = { status: 'idle', versions: [], sel: 0, feedback: '', partIdx: 0, parts: [] };
      if (!Array.isArray(a.steps.draft.parts)) a.steps.draft.parts = [];
      if (typeof a.carryIn !== 'string') a.carryIn = '';
      if (typeof a.carryOut !== 'string') a.carryOut = '';
      if (!a.step) a.step = 'topic';
    });
    if (typeof p.curArc !== 'number') p.curArc = 0;
    return p;
  }

  /* ---------- 存储 ---------- */
  function loadAll() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      return (JSON.parse(raw) || []).map(migrate);
    } catch (e) { return []; }
  }

  function saveAll(list) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(list)); return true; }
    catch (e) { alert('保存失败：存储空间可能满了\n' + e.message); return false; }
  }

  function get(id) {
    return loadAll().find(p => p.id === id) || null;
  }

  function put(p) {
    const list = loadAll();
    p.updatedAt = Date.now();
    const i = list.findIndex(x => x.id === p.id);
    if (i >= 0) list[i] = p; else list.unshift(p);
    saveAll(list);
    return p;
  }

  function del(id) {
    saveAll(loadAll().filter(p => p.id !== id));
  }

  /* ---------- 配置 ---------- */
  function cfg() {
    try {
      return Object.assign({
        baseUrl: 'https://api.deepseek.com',
        apiKey: '',
        model: 'deepseek-flash',
        thinkingMode: 'off',
        temperature: 0.85,
        maxTokens: 8192,
        stream: true,
        candidates: 1
      }, JSON.parse(localStorage.getItem(CFG_KEY) || '{}'));
    } catch (e) { return { baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash', thinkingMode: 'off', temperature: 0.85, maxTokens: 8192, stream: true, candidates: 1 }; }
  }

  function saveCfg(c) {
    localStorage.setItem(CFG_KEY, JSON.stringify(c));
  }

  /* ---------- 工具 ---------- */
  function curArc(p) {
    return p && p.arcs && p.arcs[p.curArc] ? p.arcs[p.curArc] : null;
  }

  window.LF = {
    LS_KEY, CFG_KEY, STEPS, STEP_NAME, STEP_DESC, TIERS,
    uid, newArc, newProject, migrate,
    loadAll, saveAll, get, put, del, cfg, saveCfg, curArc
  };
})();
