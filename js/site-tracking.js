// 更细的访客记录（GA 默认只记「打开了哪页」），以及每位访客浏览完后发给作者的一份报告：
//   - 打开网站：问一次访客接口（Vercel 上的 jinghe-site-tracker）这个 IP 属于哪家公司，公司名记进 GA（用户属性 visitor_org）。这一步不推送
//   - 每页：实际阅读时长（只算页面在前台的时间）、最大滚动深度、看到了哪几节（h1/h2）、点了什么（简历 / 邮箱 / Scholar / 外链）、视频播放
//     → GA 事件照常发；同时累计进这位访客这次浏览的记录（localStorage，多个标签页共用一份）
//   - 关掉网站的最后一个页面时（站内点链接跳页不算），把整次浏览的报告一次发出 → 作者手机只收到一条
//   - 手机直接划掉浏览器来不及发的：下次再打开网站时先补发上一次的
// 作者自己：网址带一次 ?me 之后，这台设备永远不发（GA 照常记）。本地打开（localhost / file）也不发。
(() => {
  const API = 'https://jinghe-site-tracker.vercel.app/api/visit';
  const SESS = 'jh:sess', TABS = 'jh:tabs';
  const IDLE = 30 * 60 * 1000; // 30 分钟没动静 = 新的一次浏览
  const ga = (...a) => typeof window.gtag === 'function' && window.gtag(...a);
  const q = new URLSearchParams(location.search);
  try { if (q.has('me')) localStorage.setItem('jh:me', '1'); } catch (_) {}
  const isMe = (() => { try { return localStorage.getItem('jh:me') === '1'; } catch (_) { return false; } })();
  const live = location.hostname === 'caijinghe.github.io' && !isMe;
  const send = (body, beacon) => {
    if (!live) return Promise.resolve(null);
    const data = JSON.stringify(body);
    // text/plain = 简单请求，不需要预检；离开页面时用 sendBeacon，页面关了也发得出去
    if (beacon && navigator.sendBeacon) { navigator.sendBeacon(API, new Blob([data], { type: 'text/plain' })); return Promise.resolve(null); }
    return fetch(API, { method: 'POST', body: data, headers: { 'Content-Type': 'text/plain' }, keepalive: true }).then((r) => r.json()).catch(() => null);
  };
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch (_) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const page = location.pathname.replace(/^\//, '') || 'index.html';
  const title = (document.querySelector('h1')?.innerText || document.title || page).replace(/\s+/g, ' ').trim().slice(0, 60);
  const pv = Math.random().toString(36).slice(2, 10); // 这一次打开这个页面
  const now = Date.now();

  // —— 这一次浏览的记录：上一次没发出去、又过了 30 分钟的，先补发
  let s = read(SESS, null);
  if (s && !s.sent && now - s.last > IDLE && Object.keys(s.visits || {}).length) send({ type: 'summary', session: s, late: true });
  const fresh = !s || now - s.last > IDLE;
  if (fresh) s = { start: now, last: now, ref: document.referrer, utm: q.get('utm_source') || '', landing: page, visits: {}, sent: false };
  else if (s.sent) { s.sent = false; s.resumed = true; } // 发过报告后又回来接着看：之后再发一份「续」
  s.visits[pv] = { page, title, at: now, secs: 0, scroll: 0, sections: [], clicks: [], videos: 0 };
  s.last = now;
  write(SESS, s);

  // —— 公司名：每次新的浏览问一次接口（不推送），记进 GA
  if (fresh) {
    send({ type: 'start', page }).then((info) => {
      if (!info) return;
      try { localStorage.setItem('jh:org', info.org || ''); } catch (_) {}
      ga('set', 'user_properties', { visitor_org: (info.org || 'unknown').slice(0, 36) });
      ga('event', 'visitor_info', { visitor_org: (info.org || 'unknown').slice(0, 100), visitor_city: info.city || '', vpn_or_hosting: info.hosting || info.proxy ? 'yes' : 'no' });
    });
  } else {
    try { const org = localStorage.getItem('jh:org'); if (org) ga('set', 'user_properties', { visitor_org: org.slice(0, 36) }); } catch (_) {}
  }

  // —— 现在开着哪些页面（判断是不是关掉了最后一个）：每个页面隔一会儿报个到。后台标签页的计时器会被浏览器放慢，所以 90 秒内报过到都算开着
  const beat = () => { const t = read(TABS, {}); t[pv] = Date.now(); write(TABS, t); };
  beat();
  setInterval(beat, 5000);
  const othersOpen = () => {
    const t = read(TABS, {}), cut = Date.now() - 90000;
    return Object.entries(t).some(([k, v]) => k !== pv && v > cut);
  };
  const leaveTabs = () => { const t = read(TABS, {}); delete t[pv]; Object.keys(t).forEach((k) => t[k] < Date.now() - 10 * 60000 && delete t[k]); write(TABS, t); };

  // —— 阅读时长：只算页面在前台的时间
  let visible = 0, since = document.visibilityState === 'visible' ? performance.now() : null;
  const tick = () => { if (since != null) { visible += performance.now() - since; since = performance.now(); } };

  // —— 滚动深度
  let maxScroll = 0;
  const onScroll = () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    const p = h > 0 ? (scrollY / h) * 100 : 100;
    if (p > maxScroll) maxScroll = Math.min(100, p);
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // —— 看到了哪几节：h1 / h2 进入视口一半以上算看到
  const sections = [];
  const io = 'IntersectionObserver' in window && new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    const name = (e.target.innerText || e.target.textContent).replace(/\s+/g, ' ').trim().slice(0, 40);
    io.unobserve(e.target);
    if (!name || sections.includes(name)) return;
    sections.push(name);
    ga('event', 'section_view', { section_name: name, page_name: page });
  }), { threshold: 0.5 });
  const watch = () => document.querySelectorAll('h1, h2').forEach((el) => io && io.observe(el));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();

  // —— 点了什么（站内跳页记下时间：紧接着的离开不算「看完了」）
  const clicks = [];
  let internalNavAt = 0;
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    const url = new URL(a.href, location.href);
    const type = href.startsWith('mailto:') ? 'email'
      : /drive\.google\.com/.test(url.host) ? 'resume'
      : /scholar\.google/.test(url.host) ? 'scholar'
      : /linkedin\.com/.test(url.host) ? 'linkedin'
      : url.origin !== location.origin ? 'outbound'
      : /\.html$|\/$/.test(url.pathname) ? 'page' : '';
    if (!type) return;
    if (type === 'page' && a.target !== '_blank' && !e.metaKey && !e.ctrlKey && !e.shiftKey) internalNavAt = Date.now();
    if (type !== 'page') clicks.push(type);
    ga('event', 'link_click', { link_type: type, link_url: a.href.slice(0, 100), page_name: page, transport_type: 'beacon' });
  }, true);

  // —— 视频播放（自动静音循环播放的不算）
  let videos = 0;
  document.addEventListener('play', (e) => {
    if (e.target.tagName !== 'VIDEO' || (e.target.muted && e.target.autoplay)) return;
    videos++;
    ga('event', 'video_play', { video_src: (e.target.currentSrc || '').split('/').pop().slice(0, 80), page_name: page });
  }, true);

  // —— 把这一页的进度写回这次浏览的记录（别的标签页可能也改过，所以每次都先读最新的）
  const save = () => {
    tick();
    const cur = read(SESS, null);
    if (!cur || !cur.visits || !cur.visits[pv]) return;
    cur.visits[pv] = { page, title, at: cur.visits[pv].at, secs: Math.round(visible / 1000), scroll: Math.round(maxScroll), sections: sections.slice(0, 8), clicks: clicks.slice(0, 8), videos };
    cur.last = Date.now();
    write(SESS, cur);
    return cur;
  };

  // —— GA：每页的阅读报告（离开时发；回来再离开会再发一次增量足够大的）
  let gaReported = 0;
  const gaRead = () => {
    const secs = Math.round(visible / 1000);
    if (secs - gaReported < 5) return;
    gaReported = secs;
    ga('event', 'page_read', { page_name: page, visible_seconds: secs, max_scroll: Math.round(maxScroll), sections_seen: sections.length, transport_type: 'beacon' });
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { since = performance.now(); beat(); }
    else { tick(); since = null; save(); gaRead(); }
  });

  // —— 离开这一页：是关掉了网站的最后一个页面（不是站内跳页、也没有别的标签页开着），就发整次浏览的报告
  addEventListener('pagehide', () => {
    const cur = save();
    gaRead();
    leaveTabs();
    if (!cur || cur.sent) return;
    if (Date.now() - internalNavAt < 4000 || othersOpen()) return;
    cur.sent = true;
    write(SESS, cur);
    send({ type: 'summary', session: cur }, true);
  });
  // 从「返回」缓存里恢复的页面：重新报到，接着记
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    beat();
    const cur = read(SESS, null);
    if (cur && cur.sent) { cur.sent = false; cur.resumed = true; cur.visits[pv] = cur.visits[pv] || { page, title, at: Date.now(), secs: 0, scroll: 0, sections: [], clicks: [], videos: 0 }; write(SESS, cur); }
  });
})();
