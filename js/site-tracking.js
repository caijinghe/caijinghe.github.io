// 更细的访客记录（GA 默认只记「打开了哪页」）：
//   - 打开网站：通知访客接口（Vercel 上的 jinghe-site-tracker），作者手机收到「哪家公司 / 哪个城市在看」；接口回传的公司名记进 GA（用户属性 visitor_org）
//   - 每页：实际阅读时长（只算页面在前台的时间）、最大滚动深度、看到了哪几节（h1/h2）、点了什么（简历 / 邮箱 / Scholar / 外链 / 项目）、视频播放
//     → 离开页面时发 GA 事件 page_read，同时推送一条阅读报告
// 作者自己：网址带一次 ?me 之后，这台设备永远不发（GA 照常记）。本地打开（localhost / file）也不发。
(() => {
  const API = 'https://jinghe-site-tracker.vercel.app/api/visit';
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
  const page = location.pathname.replace(/^\//, '') || 'index.html';
  const title = (document.querySelector('h1')?.innerText || document.title || page).replace(/\s+/g, ' ').trim().slice(0, 60);

  // —— 打开网站：同一位访客 30 分钟内只报一次（开好几个标签页也只报一次）
  const now = Date.now();
  let last = 0;
  try { last = Number(localStorage.getItem('jh:start') || 0); } catch (_) {}
  if (now - last > 30 * 60 * 1000) {
    try { localStorage.setItem('jh:start', String(now)); } catch (_) {}
    send({ type: 'start', page, ref: document.referrer, utm: q.get('utm_source') || '' }).then((info) => {
      if (!info) return;
      try { localStorage.setItem('jh:org', info.org || ''); } catch (_) {}
      ga('set', 'user_properties', { visitor_org: (info.org || 'unknown').slice(0, 36) });
      ga('event', 'visitor_info', { visitor_org: (info.org || 'unknown').slice(0, 100), visitor_city: info.city || '', vpn_or_hosting: info.hosting || info.proxy ? 'yes' : 'no' });
    });
  } else {
    try { const org = localStorage.getItem('jh:org'); if (org) ga('set', 'user_properties', { visitor_org: org.slice(0, 36) }); } catch (_) {}
  }

  // —— 阅读时长：只算页面在前台的时间
  let visible = 0, since = document.visibilityState === 'visible' ? performance.now() : null;
  const tick = () => { if (since != null) { visible += performance.now() - since; since = performance.now(); } };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') since = performance.now();
    else { tick(); since = null; report(); }
  });

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

  // —— 点了什么
  const clicks = [];
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
      : /\.html$/.test(url.pathname) ? 'page' : '';
    if (!type) return;
    const label = type === 'page' ? url.pathname.split('/').pop().replace('.html', '') : type;
    clicks.push(label);
    ga('event', 'link_click', { link_type: type, link_url: a.href.slice(0, 100), page_name: page, transport_type: 'beacon' });
  }, true);

  // —— 视频播放
  let videos = 0;
  document.addEventListener('play', (e) => {
    if (e.target.tagName !== 'VIDEO' || e.target.muted && e.target.autoplay) return; // 自动静音循环播放的不算
    videos++;
    ga('event', 'video_play', { video_src: (e.target.currentSrc || '').split('/').pop().slice(0, 80), page_name: page });
  }, true);

  // —— 离开（切走 / 关闭 / 跳到别的页）：发一次报告；回来再离开会再发一次增量足够大的
  let reported = 0;
  function report() {
    tick();
    const secs = Math.round(visible / 1000);
    if (secs - reported < 5) return;
    reported = secs;
    ga('event', 'page_read', { page_name: page, visible_seconds: secs, max_scroll: Math.round(maxScroll), sections_seen: sections.length, transport_type: 'beacon' });
    send({ type: 'leave', page, title, secs, scroll: maxScroll, sections, clicks, videos }, true);
  }
  addEventListener('pagehide', report);
})();
