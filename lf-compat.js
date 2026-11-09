/* lf-compat.js — 让原版 api.js 能直接复用
   api.js 里写的是 Store.cfg()，这里把 LF 的配置接口挂成 Store 的形状。
   必须在 api.js 之前加载。
*/
(function () {
  window.Store = {
    cfg: function () {
      const c = window.LF.cfg();
      return {
        baseUrl: c.baseUrl,
        apiKey: c.apiKey,
        model: c.model,
        temperature: c.temperature,
        maxTokens: c.maxTokens,
        stream: c.stream,
        thinkingMode: c.thinkingMode || 'off'
      };
    }
  };
})();
