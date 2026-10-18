(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  // 颜色只有一个来源：tokens.css。canvas / WAAPI / 拼 rgb() 的地方都从这里读，不在 JS 里写色值
  const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  // 身份色：单人 = 左侧色条 + 一点点同色底；多人 = 中性底 + 按人分段的色条（扁平，不用渐变过渡）
  const ID = ['emma', 'sam', 'mom', 'dad'];
  const idColor = p => tok(`--id-${p}`);
  function identity(whoList) {
    const ps = whoList.filter(p => ID.includes(p));
    if (!ps.length) return null;
    const fill = p => tok(`--id-${p}-fill`);
    const strip = ps.length === 1 ? fill(ps[0]) : `linear-gradient(to right, ${ps.map((p, i) => `${fill(p)} ${i / ps.length * 100}% ${(i + 1) / ps.length * 100}%`).join(', ')})`;
    // 单人：右下角一团同色亮光；多人：右下角其他人的颜色柔和地晕开（实色打底，只在角落有渐变）
    // 光晕尺寸用 --glow / --glow-multi，由容器按卡片大小给（日历页的小块用小光晕，避免整块被晕脏）
    if (ps.length === 1) {
      const c = fill(ps[0]);
      return { bg: `radial-gradient(var(--glow, 140px 100px) at 100% 100%, color-mix(in srgb, ${c} 45%, #fff) 0%, transparent 100%), ${c}`, strip };
    }
    // 色带顺序：和底色越接近的放越外层（和底色相接、过渡自然），差别最大的放圆心
    const rgb = h => { const v = parseInt(h.replace('#', ''), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; };
    const dist = (a, b) => { const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b), rm = (r1 + r2) / 2; return Math.sqrt((2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2); };
    const base = fill(ps[0]);
    const rest = ps.slice(1).sort((a, b) => dist(fill(b), base) - dist(fill(a), base));   // 远 → 近 = 圆心 → 外层
    // 色带均匀：圆心先实实占住一块（0–14%），其余等距排开，88% 前淡完（最外层不再拖成一大片）
    const n = rest.length, step = n > 1 ? 48 / (n - 1) : 0;
    const stops = rest.map((p, i) => i === 0 ? `${fill(p)} 0%, ${fill(p)} 14%` : `${fill(p)} ${Math.round(14 + i * step)}%`).join(', ');
    return { bg: `radial-gradient(var(--glow-multi, 170px 120px) at 100% 100%, ${stops}, transparent 88%), ${fill(ps[0])}`, strip };
  }
  function paintIdentity(root) {
    for (const el of root.querySelectorAll ? root.querySelectorAll('[data-who]') : []) {
      const who = el.dataset.who === 'all' ? ID : el.dataset.who.split(',');
      const v = identity(who);
      if (!v) continue;
      el.style.setProperty('--ev-bg', v.bg);
    }
  }
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) { paintIdentity(n); if (n.matches?.('[data-who]')) paintIdentity(n.parentNode); } })))
    .observe(document.getElementById('stage') || document.body, { childList: true, subtree: true });

  // ---------- 共享片段注入 ----------
  for (const slot of $$('[data-slot]')) {
    const frag = document.getElementById('tpl-' + slot.dataset.slot).content.cloneNode(true);
    if (slot.classList.contains('tile')) slot.appendChild(frag);
    else slot.replaceWith(frag);
  }

  // 导航：Family / Personal 都是 Home（走近时识别是谁，切成对应的 Home），Calendar、Tasks 是独立页面
  let lastHome = 's1';
  const PAGE_NAV = { s3: 'Calendar', s4: 'Tasks', s7: 'Meals' };
  for (const f of $$('.frame')) {
    const cur = PAGE_NAV[f.id] || 'Home';
    for (const b of $$('.nav', f)) {
      const on = b.getAttribute('aria-label') === cur;
      b.classList.toggle('cur', on); b.classList.toggle('st', on);
    }
  }
  $$('.nav.home').forEach(b => b.addEventListener('click', () => show(lastHome)));
  $$('.nav[aria-label="Calendar"]').forEach(b => b.addEventListener('click', () => show('s3')));
  $$('.nav[aria-label="Tasks"]').forEach(b => b.addEventListener('click', () => show('s4')));
  $$('.nav[aria-label="Meals"]').forEach(b => b.addEventListener('click', () => show('s7')));

  // ---------- 等比缩放 ----------
  const stage = $('#stage');
  function fit() {
    const s = Math.min(innerWidth / 1280, (innerHeight - 44) / 800);
    window.__stageScale = s;
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  addEventListener('resize', fit);
  fit();

  // ---------- 屏幕切换 ----------
  const btns = $$('.switcher button');
  const voices = {};

  // 灵动岛：Personal 页常驻显示 Emma；她开口时展开成 "Emma is speaking"，别的页说完就收回
  const island = $('.island', stage);
  let speaking = false;
  function syncIsland() {
    island.classList.toggle('is-speaking', speaking);
    const rwOpenNow = !!document.querySelector('.rw-modal:not([hidden])');   // Rewards 浮层打开时让出顶部
    // 只在 Emma 的 Personal 屏、有人说话时出现；Family 首页是全家共用的，不显示个人身份
    island.classList.toggle('is-on', speaking && $('#s2').classList.contains('on') && !rwOpenNow);
  }
  function show(id) {
    if (id === 's5') { show('s2'); openRewards(); return; }   // Rewards 现在是 Personal 上的浮层，不是独立页面
    $$('.frame').forEach(f => f.classList.toggle('on', f.id === id));
    btns.forEach(b => b.setAttribute('aria-pressed', b.dataset.to === id));
    history.replaceState(null, '', '#' + id);
    if (id !== 's2' && typeof rwOpen !== 'undefined' && rwOpen) closeRewards();
    if (!PAGE_NAV[id] && id !== 's5' && id !== 's6') lastHome = id;   // s5 = Rewards（Personal 子页），s6 = 屏保
    syncIsland();
    Object.values(voices).forEach(v => v.syncRive());
    enter($('#' + id));
    if (id === 's2') { growBars(); growProgress(); growRewards(); }
    if (id === 's3') calPage.restore();
    if (id === 's5') rwPage.restore();
    screensaver(id === 's6');
    if (id === 's4') tkPage.setDay(0);
    else tkPage.close();
  }

  // 面板按从左上到右下的对角顺序错落入场
  function enterables(frame) {
    if (frame.id === 's2') return [$('.header', frame), ...$$('.board > .tile', frame)];
    if (frame.id === 's3') return [$('.header', frame), $('.calpage', frame)];
    if (frame.id === 's5') return [$('.header', frame), $('.rwpage', frame)];
    if (frame.id === 's6') return [];
    if (frame.id === 's4') return [$('.header', frame), $('.tkpage', frame)];
    if (frame.id === 's7') return [$('.header', frame), ...$$('.mlpage > .card', frame)];
    const widgets = $$('.memories, .card', frame).filter(el => !el.closest('.cal') || el.classList.contains('cal'));
    return [$('.header', frame), ...new Set([$('.cal', frame), ...widgets, $('.memories', frame)?.parentElement.children[1], $('.memories', frame)?.parentElement.children[2]])].filter(Boolean);
  }
  let enterTimer = 0;
  function enter(frame) {
    const els = enterables(frame);
    const o = frame.getBoundingClientRect();
    const key = el => { const r = el.getBoundingClientRect(); return (r.left - o.left) * 0.55 + (r.top - o.top); };
    els.sort((a, b) => key(a) - key(b));
    els.forEach((el, i) => {
      el.classList.remove('tile-in');
      el.style.setProperty('--i', i);
      void el.offsetWidth;
      el.classList.add('tile-in');
    });
    clearTimeout(enterTimer);
    enterTimer = setTimeout(() => els.forEach(el => el.classList.remove('tile-in')), 560 + els.length * 40);
  }
  btns.forEach(b => b.addEventListener('click', () => show(b.dataset.to)));
  addEventListener('keydown', e => {
    if (e.target.closest('input, textarea')) return;
    if (e.key === '1') show('s1');
    if (e.key === '2') show('s2');
    if (e.key === '3') show('s3');
    if (e.key === '4') show('s4');
    if (e.key === '7') show('s7');
  });

  // ---------- 演示时钟：从 Tue Oct 29 3:00 PM 开始走 ----------
  const offset = new Date(2024, 9, 29, 15, 0, 0) - Date.now();
  const now = () => new Date(Date.now() + offset);
  const s2 = $('#s2');
  const clock = $('.clock', s2);

  // 12 瓣花边表盘
  (() => {
    const pts = [];
    for (let i = 0; i <= 240; i++) {
      const t = i / 240 * Math.PI * 2, r = 84 + 4.2 * Math.cos(12 * t);
      pts.push(`${(94 + r * Math.cos(t)).toFixed(2)},${(100 + r * Math.sin(t)).toFixed(2)}`);
    }
    $('.clock-face', clock).setAttribute('d', 'M' + pts.join('L') + 'Z');
    // 画布裁到表盘的外接框：花瓣正好顶到格子边，不留内缩
    const R = 84 + 4.2;
    $('svg', clock).setAttribute('viewBox', `${94 - R} ${100 - R} ${2 * R} ${2 * R}`);
  })();

  function tick() {
    const d = now(), h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
    const hm = `${h % 12 || 12}:${String(m).padStart(2, '0')}`;
    $$('.header .time').forEach(el => { if (el.textContent !== hm) el.textContent = hm; });
    $$('.header .pm').forEach(el => { el.textContent = h < 12 ? 'AM' : 'PM'; });
    $$('[data-ss-big]').forEach(el => { if (el.textContent !== hm) el.textContent = hm; });
    $('.hand-h', clock).setAttribute('transform', `rotate(${(h % 12 + m / 60) * 30} 94 100)`);
    $('.hand-m', clock).setAttribute('transform', `rotate(${(m + s / 60) * 6} 94 100)`);
    $('.hand-s', clock).setAttribute('transform', `rotate(${s * 6} 94 100)`);
    $('.clock-digital', clock).textContent = hm;
  }
  tick();
  setInterval(tick, 1000);
  clock.addEventListener('click', () => clock.classList.toggle('digital'));

  // ---------- 日历：点日期 / 左右箭头切换，每天的事件按日期种子生成（同一天每次一样） ----------
  const WEEK = [28, 29, 30, 31, 1, 2, 3].map((d, i) => new Date(2024, i < 4 ? 9 : 10, d));
  const TODAY = 1;
  const PEOPLE = {
    emma: { name: 'Emma', av: '<img class="fill cover" src="assets/profile/avatar.jpg" alt="">' },
    sam: { name: 'Sam', av: '<img class="fill cover" src="assets/sam.jpg" alt="">' },
    mom: { name: 'Mom', av: '<img class="fill cover" src="assets/4a680.png" alt="">' },
    dad: { name: 'Dad', av: '<img class="fill cover" src="assets/7903a.png" alt="">' },
  };
  // Family 屏：每个成员一种渐变（取自 Figma 原事件色）
  const FAMILY_COLOR = Object.fromEntries(['emma', 'sam', 'mom', 'dad', 'pair', 'all'].map(k => [k, [tok(`--m-${k}-soft`), tok(`--m-${k}`)]]));
  // Emma 屏：混合事件融进对方的颜色
  const FAMILY_POOL = [
    ['Piano Lesson', ['emma']], ['Art Club', ['emma']], ['Spelling Quiz Prep', ['emma']],
    ['Swim Class', ['sam']], ['Soccer Practice', ['sam']], ['Dentist @ Bright Smiles', ['sam']],
    ['Grocery Run', ['mom']], ['Yoga', ['mom']], ['Book Club', ['mom']],
    ['Team Standup', ['dad'], false, '9:30 AM'], ['Car Service', ['dad']], ['Pick up dry cleaning', ['dad'], true],
    ['Library Visit', ['emma', 'sam']], ['Science Fair Prep', ['emma', 'dad']], ['Basketball Game', ['sam', 'dad']],
    ['Parent–Teacher Meeting', ['mom', 'dad']], ['Movie Night', ['all'], false, '7:30 PM'], ['Family Dinner @ Grandma’s', ['all'], false, '6:30 PM'],
    ['Farmers Market', ['all'], false, '9:30 AM'], ['Bike Ride in the Park', ['all']],
  ];
  const EMMA_POOL = [
    ['Piano Practice'], ['Art Club'], ['Reading Time', null, '7:30 PM'], ['Pack School Bag', null, '8:00 PM'], ['Spelling Quiz'],
    ['Swim Lesson'], ['Playdate with Lily'], ['Library Book Due'],
    ['Homework with Sam', 'sam'], ['Bake Cookies with Mom', 'mom'], ['Bike Ride with Dad', 'dad'],
    ['Science Fair Prep', 'dad'], ['Movie Night', 'all', '7:30 PM'], ['Family Dinner', 'all', '6:30 PM'], ['Farmers Market', 'all', '9:30 AM'],
  ];
  const SLOTS = ['8:00 AM', '9:30 AM', '11:00 AM', '12:30 PM', '2:00 PM', '3:30 PM', '4:30 PM', '5:30 PM', '6:30 PM', '7:30 PM'];
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  function pick(pool, n, rand, weekend) {
    const isAll = e => String(e[1]) === 'all';
    const p = pool.map(e => ({ e, w: rand() + (weekend && isAll(e) ? .3 : 0) })).sort((a, b) => b.w - a.w);
    const out = [];
    for (const { e } of p) {                        // 全家活动一天最多 2 个，其余留给个人/两人事件
      if (isAll(e) && out.filter(isAll).length >= 2) continue;
      out.push(e);
      if (out.length === n) break;
    }
    return out;
  }
  // 有固定时段的先占位，其余随机取空闲时段，最后按时间排序
  const toMin = t => { const [, h, m, ap] = t.match(/(\d+):(\d+) (AM|PM)/); return (+h % 12 + (ap === 'PM' ? 12 : 0)) * 60 + +m; };
  function schedule(events, fixedOf, rand) {
    const used = new Set(events.map(fixedOf).filter(Boolean));
    const free = SLOTS.filter(s => !used.has(s)).sort(() => rand() - .5);
    return events.map(e => [e, fixedOf(e) || free.pop()]).sort((a, b) => toMin(a[1]) - toMin(b[1]));
  }
  const RINGS = '<div class="ring r380"><div><img src="assets/d4cf6.svg" alt=""></div></div><div class="ring r260"><div><img src="assets/51820.svg" alt=""></div></div>';

  // ---- 共享数据：按日期给出 Family 事件（列表和 Calendar 页共用） ----
  const dayNum = d => Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
  const TODAY_DATE = new Date(2024, 9, 29);
  const TODAY_EVENTS = [   // 10/29：Figma 原稿的事件，时间拉开不重叠
    { title: 'Library Book Due', who: ['emma'], start: 540, dur: 30 },
    { title: 'Check over your homework', who: ['emma', 'sam'], start: 930, dur: 45 },
    { title: 'Annual Check-up @ Smith', who: ['mom'], start: 990, dur: 60 },
    { title: 'Soccer Practice', who: ['sam'], start: 1050, dur: 60 },
    { title: 'Neighborhood BBQ', who: ['all'], start: 1110, dur: 120 },
  ];
  const ALL_DAY = { 20025: [{ title: 'Call Pediatrician · before 6 PM', who: ['dad'] }], 20026: [{ title: 'Mom’s Birthday', who: ['mom'] }], 20027: [{ title: 'Halloween', who: ['all'] }], 20028: [{ title: 'No School', who: ['emma', 'sam'] }] };
  const fmtTime = m => `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, '0')} ${m < 720 ? 'AM' : 'PM'}`;
  const peopleOf = who => who[0] === 'all' ? ['emma', 'sam', 'mom', 'dad'] : who;
  const colorKey = who => who[0] === 'all' ? 'all' : who.length > 1 ? 'pair' : who[0];
  const colorOf = who => FAMILY_COLOR[colorKey(who)];
  const labelOf = who => who[0] === 'all' ? 'Everyone' : who.map(p => PEOPLE[p].name).join(' & ');
  function familyEvents(date) {
    const k = dayNum(date);
    if (k === dayNum(TODAY_DATE)) return TODAY_EVENTS;
    const rand = rng(k * 7919 + 13), weekend = [0, 6].includes(date.getDay()), n = 2 + Math.floor(rand() * 3);
    const WEEKEND_ONLY = ['Farmers Market', 'Bike Ride in the Park', 'Basketball Game'];
    const WEEKDAY_ONLY = ['Team Standup', 'Parent–Teacher Meeting', 'Spelling Quiz Prep', 'Car Service', 'Dentist @ Bright Smiles'];
    const pool = FAMILY_POOL.filter(e => !(weekend ? WEEKDAY_ONLY : WEEKEND_ONLY).includes(e[0]));
    const evs = schedule(pick(pool, n, rand, weekend), e => e[3], rand).map(([[title, who, before], time]) => {
      const dur = before ? 30 : [30, 45, 60, 60, 90][Math.floor(rand() * 5)];
      return { title, who, before, dur, start: toMin(time) - (before ? 30 : 0), rings: who.length > 1 || who[0] === 'all' || rand() < .25 };
    });
    // 周末下午 / 晚上补两个固定活动，避免周视图右下角空着
    const WEEKEND_EXTRA = {
      6: [{ title: 'Family Bike Ride', who: ['all'], start: 960, dur: 90 }, { title: 'Backyard S’mores', who: ['all'], start: 1110, dur: 75 }],
      0: [{ title: 'Grandma’s Visit', who: ['all'], start: 900, dur: 120 }, { title: 'Board Game Night', who: ['emma', 'sam', 'dad'], start: 1140, dur: 60 }],
    };
    for (const x of WEEKEND_EXTRA[date.getDay()] || []) {
      if (!evs.some(e => e.start < x.start + x.dur && x.start < e.start + e.dur)) evs.push({ ...x, rings: true });
    }
    evs.sort((a, b) => a.start - b.start);
    // 不重叠：先缩短前一个，还撞就把后一个顺延
    for (let i = 1; i < evs.length; i++) {
      const p = evs[i - 1], e = evs[i];
      if (p.start + p.dur > e.start) p.dur = Math.max(30, e.start - p.start);
      if (p.start + p.dur > e.start) e.start = p.start + p.dur;
    }
    const kept = DELETED_EVENTS[k] ? evs.filter(e => !DELETED_EVENTS[k].has(`${e.start}|${e.title}`)) : evs;
    return ADDED_EVENTS[k] ? [...kept, ...ADDED_EVENTS[k]].sort((a, b) => a.start - b.start) : kept;
  }
  // 删掉的生成事件（按日期种子算出来的删不掉，只能记下来生成时跳过）
  const DELETED_EVENTS = {};
  // 用 + Add 新建的事件：今天的直接进 TODAY_EVENTS，其它天按 dayNum 存这里，生成当天事件时并进去
  const ADDED_EVENTS = {};
  function addFamilyEvent(date, e) {
    const k = dayNum(date);
    const list = k === dayNum(TODAY_DATE) ? TODAY_EVENTS : (ADDED_EVENTS[k] ??= []);
    list.push(e);
    list.sort((a, b) => a.start - b.start);
    if (k === dayNum(TODAY_DATE)) familyTodayInsert(e);
  }
  function removeFamilyEvent(date, e) {
    const k = dayNum(date), list = k === dayNum(TODAY_DATE) ? TODAY_EVENTS : ADDED_EVENTS[k];
    const i = list ? list.indexOf(e) : -1;
    if (i >= 0) list.splice(i, 1);
    else (DELETED_EVENTS[k] ??= new Set()).add(`${e.start}|${e.title}`);
    if (k === dayNum(TODAY_DATE)) familyTodayRemove(e);
  }
  // Family 屏今天的列表是单独缓存的，改了今天的事件要同步那一行
  function familyTodayRemove(e) {
    const api = $('#s1 .cal')?._api;
    if (!api) return;
    if (!api.isToday()) api.goToday();
    [...api.list.children].find(r => $('.t', r)?.textContent === e.title)?.remove();
    api.save();
  }
  function familyTodayInsert(e) {
    const api = $('#s1 .cal')?._api;
    if (!api) return;
    if (!api.isToday()) api.goToday();
    const rows = [...api.list.children];
    const at = rows.find(r => { const s = $('.s', r)?.textContent || ''; return !s.startsWith('Before') && toMin(s.split(' · ')[0]) > e.start; })
      || rows.find(r => ($('.s', r)?.textContent || '').startsWith('Before'));
    const tmp = document.createElement('div');
    tmp.innerHTML = familyRow({ ...e, rings: e.who.length > 1 || e.who[0] === 'all' });
    api.list.insertBefore(tmp.firstElementChild, at || null);
    api.save();
  }

  function familyDay(i) { return familyEvents(WEEK[i]).map(familyRow).join(''); }
  function familyRow({ title, who, before, start, dur, rings }) {
    {
      const people = who[0] === 'all' ? ['emma', 'sam', 'mom'] : who, color = colorOf(who);
      const [main, ...rest] = people.slice().reverse();
      const extras = rest.map((p, m) => `<div class="extra st extra-${m + 1}">${PEOPLE[p].av}</div>`).join('');
      const time = before ? 'Before ' + fmtTime(start + dur) : fmtTime(start);
      return `<div class="event st" data-who="${peopleOf(who)}">
        ${rings ? RINGS : ''}
        <div class="ev-text"><p class="t">${title}</p><p class="s">${time} · ${labelOf(who)}</p></div>
        <div class="member st">${extras}<div class="av av30 st">${PEOPLE[main].av}</div></div></div>`;
    }
  }

  function emmaDay(i) {
    const rand = rng(i * 104729 + 7), weekend = i >= 5, n = 4 + Math.floor(rand() * 3);
    const me = '<div class="av av30 st"><img class="fill cover" src="assets/profile/avatar.jpg" alt=""></div>';
    return schedule(pick(EMMA_POOL, n, rand, weekend), e => e[2], rand).map(([[title, with_], time]) => {
      const others = !with_ ? [] : with_ === 'all' ? ['sam', 'mom'] : [with_];
      const label = !with_ ? 'Emma' : with_ === 'all' ? 'Everyone' : 'Emma & ' + PEOPLE[with_].name;
      const avs = me + others.map(p => `<div class="av av30 st">${PEOPLE[p].av}</div>`).join('');
      return with_
        ? `<div class="event st ev-emma" data-who="emma,${with_ === 'all' ? 'sam,mom,dad' : with_}"><div class="ev-text"><p class="t">${title}</p><p class="s">${time} · ${label}</p></div><div class="stack">${avs}</div></div>`
        : `<div class="event st ev-emma" data-who="emma"><div class="ev-text"><p class="t">${title}</p><p class="s">${time} · ${label}</p></div><div class="stack">${avs}</div></div>`;
    }).join('');
  }

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const fmt = d => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  for (const cal of $$('.cal')) {
    const emma = !!cal.closest('#s2');
    const days = $$('.day', cal), list = $('.events', cal), scroller = $('.scroll', cal);
    const title = $('.cal-head .t', cal), sub = $('.cal-head .s', cal);
    let original = list.innerHTML;
    let cur = TODAY;
    const select = (i, dir) => {
      if (i === cur || i < 0 || i >= days.length) return;
      dir = dir || Math.sign(i - cur);
      cur = i;
      days.forEach((d, j) => d.classList.toggle('cur', i === j));
      title.textContent = fmt(WEEK[i]);
      sub.textContent = i === TODAY ? 'Today' : i === TODAY + 1 ? 'Tomorrow' : '';
      // 旧的一页整体滑出，新的一页从另一侧滑入
      const old = list.cloneNode(true);
      old.classList.add('events-out');
      old.style.top = -scroller.scrollTop + 'px';
      scroller.append(old);
      list.innerHTML = i === TODAY ? original : emma ? emmaDay(i) : familyDay(i);
      scroller.scrollTop = 0;
      const ease = 'cubic-bezier(0.32, 0.72, 0, 1)', ms = reduceMotion.matches ? 0 : 420;
      old.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-dir * 104}%)` }], { duration: ms, easing: ease, fill: 'forwards' }).onfinish = () => old.remove();
      list.animate([{ transform: `translateX(${dir * 104}%)` }, { transform: 'translateX(0)' }], { duration: ms, easing: ease });
    };
    // 给语音回执用：回到今天、插入新行后更新今天的快照
    cal._api = { list, scroller, emma, goToday: () => select(TODAY), isToday: () => cur === TODAY, save: () => { original = list.innerHTML.replace(/ rc-awaiting/g, ''); } };
    // 在事件列表上左右滑动 = 翻到前一天 / 后一天
    let sx = null, sy = 0;
    scroller.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
    scroller.addEventListener('pointerup', e => {
      if (sx === null) return;
      const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) select(cur + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    });
    days.forEach((d, i) => d.addEventListener('click', () => select(i)));
    const [prev, next] = $$('.cal-head button', cal);
    prev.addEventListener('click', () => select(cur - 1, -1));
    next.addEventListener('click', () => select(cur + 1, 1));
  }


  // ===================== Calendar 页：周 / 日视图 =====================
  const calPage = (() => {
    const s3 = $('#s3'), card = $('.calpage', s3), grid = $('.cp-grid', card), pop = $('.cp-pop', card);
    const H0 = 7, H1 = 22, PX = 56;                       // 7:00–22:00，每小时 56px
    const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const CHIP = { emma: 1, sam: 1, mom: 1, dad: 1 };   // 颜色见 tokens.css --m-*-solid
    const st = { offset: 0, view: 'week', day: TODAY_DATE, sel: new Set() /* 空 = 显示全部 */, scroll: (12 - H0) * PX };
    const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
    const same = (a, b) => dayNum(a) === dayNum(b);
    const weekStart = () => addDays(new Date(2024, 9, 28), st.offset * 7);
    const avHTML = p => `<div class="av st">${PEOPLE[p].av}</div>`;
    // 单人 = 自己的颜色；多人 = 各成员颜色渐变融合 + 颗粒（同 Personal 屏混合事件）
    const TINT = Object.fromEntries(['emma', 'sam', 'mom', 'dad'].map(k => [k, tok(`--m-${k}-tint`)]));
    const grad = (who, deg = 160) => {
      const ps = peopleOf(who);
      if (ps.length === 1) { const c = colorOf(who); return `linear-gradient(${deg}deg, rgb(${c[0]}), rgb(${c[1]}))`; }
      const stops = ps.map((p, i) => `rgb(${TINT[p]}) ${Math.round(8 + i / (ps.length - 1) * 84)}%`).join(', ');
      return `var(--grain) 0 0 / 140px 140px, linear-gradient(115deg, ${stops})`;
    };
    const visible = who => !st.sel.size || peopleOf(who).some(p => st.sel.has(p));

    // 成员筛选
    const peopleEl = $('.cp-people', card);
    peopleEl.innerHTML = Object.keys(CHIP).map(p => `<button class="cp-chip filter-chip" type="button" data-p="${p}" aria-pressed="false"><div class="av st">${PEOPLE[p].av}</div>${PEOPLE[p].name}</button>`).join('');
    $$('.cp-chip', peopleEl).forEach(b => b.addEventListener('click', () => {
      // 先点 = 只看这个人；再点别人 = 加进来；点已选的 = 去掉，全去掉回到显示全部
      const p = b.dataset.p;
      st.sel.has(p) ? st.sel.delete(p) : st.sel.add(p);
      $$('.cp-chip', peopleEl).forEach(c => {
        const on = st.sel.has(c.dataset.p);
        c.setAttribute('aria-pressed', on);
        c.classList.toggle('sel', on);
        c.classList.toggle('off', st.sel.size > 0 && !on);
      });
      render(0);
    }));

    // 重叠排布（类似 Google 日历）：30 分钟内同时开始的并排，较晚开始的向右缩进叠放
    const INDENT = 16;
    function lanes(evs) {
      const sorted = evs.slice().sort((a, b) => a.start - b.start || b.dur - a.dur);
      const groups = [];
      for (const e of sorted) {
        const g = groups.find(g => Math.abs(g.start - e.start) < 30 && g.items.some(x => x.start + x.dur > e.start));
        if (g) { g.items.push(e); continue; }
        const active = groups.filter(g => g.items.some(x => x.start + x.dur > e.start));
        groups.push({ start: e.start, items: [e], indent: active.length ? Math.max(...active.map(g => g.indent)) + 1 : 0 });
      }
      let z = 0;
      const out = groups.flatMap(g => g.items.map((e, i) => ({ e, indent: g.indent, i, n: g.items.length, z: ++z })));
      // 只有和别的事件重叠时才加白色分隔描边
      out.forEach(x => { x.ov = out.some(y => y !== x && y.e.start < x.e.start + x.e.dur && x.e.start < y.e.start + y.e.dur); });
      return out;
    }

    function build() {
      const days = st.view === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(weekStart(), i)) : [st.day];
      const ws = days[0], we = days[days.length - 1];
      // 标题只一行：日视图 "Monday, Oct 7"，周视图 "Oct 7 – 13"（跨月 "Oct 28 – Nov 3"）；看的不是今天就变灰，且 Today 按钮不可按的反过来
      const md = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const title = $('[data-cp-month]', card), hasToday = days.some(d => same(d, TODAY_DATE));
      title.textContent = st.view === 'week'
        ? (ws.getMonth() === we.getMonth() ? `${md(ws)} – ${we.getDate()}` : `${md(ws)} – ${md(we)}`)
        : ws.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      title.classList.toggle('off', !hasToday);
      $('[data-cp-today]', card).disabled = hasToday;

      const now = new Date(Date.now() + offset), nowMin = now.getHours() * 60 + now.getMinutes();
      const g = document.createElement('div');
      g.className = 'cp-grid-in' + (st.view === 'day' ? ' day-view' : '');
      g.style.setProperty('--cols', days.length);
      const head = days.map(d => `<div class="cp-dh${same(d, TODAY_DATE) ? ' today' : ''}" data-d="${dayNum(d)}"><span>${DOW[d.getDay()]}</span><b>${d.getDate()}</b></div>`).join('');
      const allday = days.map(d => `<div class="cp-adc">${(ALL_DAY[dayNum(d)] || []).filter(e => visible(e.who)).map(e => `<div class="cp-ad" data-who="${e.who}">${e.title}</div>`).join('')}</div>`).join('');
      const hours = Array.from({ length: H1 - H0 }, (_, h) => `<p style="top:${h * PX}px">${h === 0 ? '' : fmtTime((H0 + h) * 60).replace(':00', '')}</p>`).join('');
      const lines = Array.from({ length: H1 - H0 }, (_, h) => `<div class="cp-line" style="top:${h * PX}px"></div>`).join('');
      let k = 0;
      const cols = days.map(d => {
        const evs = lanes(familyEvents(d).filter(e => e.start + e.dur > H0 * 60 && visible(e.who)));
        const blocks = evs.map(({ e, indent, i, n, z, ov }) => {
          const top = (e.start - H0 * 60) / 60 * PX, h = Math.max(22, e.dur / 60 * PX - 3);
          const time = e.before ? 'Before ' + fmtTime(e.start + e.dur) : `${fmtTime(e.start)} – ${fmtTime(e.start + e.dur)}`;
          const avs = h >= 54 ? `<div class="avs">${peopleOf(e.who).map(avHTML).join('')}</div>` : '';
          return `<button class="cp-ev pop-in${ov ? ' ov' : ''}${h < 38 ? ' short' : h < 56 ? ' mid' : ''}" type="button" data-who="${e.who}" data-i="${dayNum(d)}:${e.start}:${e.title}"
            style="--k:${k++};z-index:${z};top:${top + 1}px;height:${h}px;left:calc((100% - ${indent * INDENT}px) * ${i / n} + ${indent * INDENT + 3}px);width:calc((100% - ${indent * INDENT}px) / ${n} - 6px)">
            <p class="t">${e.title}</p>${h >= 38 ? `<p class="s">${time}</p>` : ''}${avs}</button>`;
        }).join('');
        const nowLine = same(d, TODAY_DATE) && nowMin > H0 * 60 && nowMin < H1 * 60 ? `<div class="cp-now" style="top:${(nowMin - H0 * 60) / 60 * PX}px"></div>` : '';
        return `<div class="cp-col${same(d, TODAY_DATE) ? ' today' : ''}" style="height:${(H1 - H0) * PX}px">${blocks}${nowLine}</div>`;
      }).join('');
      g.innerHTML = `<div class="cp-row cp-head"><div></div>${head}</div>
        <div class="cp-row cp-allday"><div class="cp-gl">All day</div>${allday}</div>
        <div class="cp-body"><div class="cp-inner">${lines}<div class="cp-hours">${hours}</div>${cols}</div></div>`;
      return g;
    }

    function render(dir = 0) {
      hidePop();
      const prev = $('.cp-grid-in', grid);
      if (prev) st.scroll = $('.cp-body', prev).scrollTop;
      const g = build();
      grid.append(g);
      $('.cp-body', g).scrollTop = st.scroll;
      $$('.cp-dh', g).forEach(el => el.addEventListener('click', () => {
        st.day = new Date(+el.dataset.d * 864e5 + 12 * 36e5); setView(st.view === 'week' ? 'day' : 'week', 0);
      }));
      $$('.cp-ev', g).forEach(el => el.addEventListener('click', e => { e.stopPropagation(); showPop(el, e.clientX); }));
      $$('.cp-ev', g).forEach(el => el.addEventListener('animationend', () => el.classList.remove('pop-in'), { once: true }));
      if (prev) {
        if (!dir || reduceMotion.matches) { prev.remove(); return; }
        const ease = 'cubic-bezier(0.32, 0.72, 0, 1)';
        $$('.cp-ev', g).forEach(el => el.classList.remove('pop-in'));
        prev.animate([{ transform: 'none' }, { transform: `translateX(${-dir * 104}%)` }], { duration: 440, easing: ease, fill: 'forwards' }).onfinish = () => prev.remove();
        g.animate([{ transform: `translateX(${dir * 104}%)` }, { transform: 'none' }], { duration: 440, easing: ease });
      }
    }

    function showPop(el, clickX) {
      const [d, start, ...t] = el.dataset.i.split(':'), title = t.join(':');
      const e = familyEvents(new Date(+d * 864e5 + 12 * 36e5)).find(x => x.start === +start && x.title === title);
      const date = new Date(+d * 864e5 + 12 * 36e5).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      const time = e.before ? 'Before ' + fmtTime(e.start + e.dur) : `${fmtTime(e.start)} – ${fmtTime(e.start + e.dur)}`;
      pop.innerHTML = `<div class="strip" style="background:${identity(peopleOf(e.who)).strip}"></div><p class="t">${e.title}</p><p class="s">${date} · <span class="nw">${time}</span></p>
        <div class="who">${peopleOf(e.who).map(p => `<span>${avHTML(p)}${PEOPLE[p].name}</span>`).join('')}</div>
        <div class="cp-pop-acts">
          <button type="button" data-pop-edit><svg viewBox="0 0 16 16"><path d="M10.6 2.9l2.5 2.5-7.4 7.4-3.2.7.7-3.2z"/></svg>Edit</button>
          <button type="button" class="del" data-pop-del><svg viewBox="0 0 16 16"><path d="M2.8 4.3h10.4M6.2 4.3V2.8h3.6v1.5M4.2 4.3l.6 8.9h6.4l.6-8.9M6.8 6.6v4.4M9.2 6.6v4.4"/></svg>Delete</button>
        </div>`;
      const evDate = new Date(+d * 864e5 + 12 * 36e5);
      $('[data-pop-del]', pop).addEventListener('click', () => {
        hidePop();
        el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.94)' }], { duration: 200, easing: 'ease-in', fill: 'forwards' }).onfinish = () => {
          removeFamilyEvent(evDate, e);
          render(0);
        };
      });
      $('[data-pop-edit]', pop).addEventListener('click', () => { hidePop(); editEvent(evDate, e); });
      // 按弹窗实际尺寸定位：优先放事件右侧，放不下放左侧；两侧都放不下（日视图满宽）就跟着点击位置；纵向夹在卡片内
      pop.hidden = false;
      const c = card.getBoundingClientRect(), r = el.getBoundingClientRect(), s = window.__stageScale || 1;
      const W = card.offsetWidth, H = card.offsetHeight, pw = pop.offsetWidth, ph = pop.offsetHeight, M = 12, G = 8;
      const L = (r.left - c.left) / s, R = (r.right - c.left) / s, T = (r.top - c.top) / s;
      let x;
      if (R + G + pw <= W - M) x = R + G;
      else if (L - G - pw >= M) x = L - G - pw;
      else x = Math.min(Math.max(((clickX ?? r.left + r.width / 2) - c.left) / s + 16, M), W - pw - M);
      const y = Math.min(Math.max(T, M), H - ph - M);
      pop.style.left = x + 'px'; pop.style.top = y + 'px';
    }
    const hidePop = () => { pop.hidden = true; };
    function editEvent(date, e) {
      const { days } = addCtx();
      const TIMES = [...new Set([480, 600, 720, 900, 1020, 1140, e.start])].sort((a, b) => a - b);
      addSheet.open({
        title: 'Edit event', placeholder: 'What’s happening?', text: e.title, saveLabel: 'Save',
        rows: [
          { label: 'Day', value: String(dayNum(date)), options: days.map(x => ({ v: String(dayNum(x)), label: x.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }) })) },
          { label: 'Time', value: String(e.start), options: TIMES.map(t => ({ v: String(t), label: fmtTime(t) })) },
          { label: 'Who', multi: true, value: e.who, options: [{ v: 'all', label: 'Everyone' }, ...['emma', 'sam', 'mom', 'dad'].map(personChip)] },
        ],
        onSave(title, d, t, who) {
          const to = days.find(x => String(dayNum(x)) === d) || date;
          const next = { ...e, title, who, start: +t, before: e.before && +t === e.start ? e.before : undefined };
          removeFamilyEvent(date, e);
          addFamilyEvent(to, next);
          showAdded(to, next);
        },
      });
    }
    card.addEventListener('click', e => { if (!e.target.closest('.cp-pop, .cp-ev')) hidePop(); });

    function setView(v, dir) {
      st.view = v;
      $$('.cp-seg button', card).forEach(b => b.setAttribute('aria-pressed', b.dataset.view === v));
      render(dir);
    }
    $$('.cp-seg button', card).forEach(b => b.addEventListener('click', () => {
      if (b.dataset.view === st.view) return;
      if (b.dataset.view === 'day') {   // 切到日视图：本周就看今天，否则看那一周的周一
        const ws = weekStart();
        st.day = dayNum(TODAY_DATE) >= dayNum(ws) && dayNum(TODAY_DATE) < dayNum(ws) + 7 ? TODAY_DATE : ws;
      } else {                          // 切回周视图：跳到所选那天所在的周
        st.offset = Math.floor((dayNum(st.day) - dayNum(new Date(2024, 9, 28))) / 7);
      }
      setView(b.dataset.view, 0);
    }));
    const step = dir => {
      if (st.view === 'week') st.offset += dir; else st.day = addDays(st.day, dir);
      render(dir);
    };
    $('[data-cp-prev]', card).addEventListener('click', () => step(-1));
    $('[data-cp-next]', card).addEventListener('click', () => step(1));
    $('[data-cp-today]', card).addEventListener('click', () => {
      const dir = st.view === 'week' ? -Math.sign(st.offset) : -Math.sign(dayNum(st.day) - dayNum(TODAY_DATE));
      st.offset = 0; st.day = TODAY_DATE; st.scroll = (12 - H0) * PX; render(dir);
    });
    // 左右滑动翻周 / 翻天
    let sx = null, sy = 0;
    grid.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
    grid.addEventListener('pointerup', e => {
      if (sx === null) return;
      const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) step(dx < 0 ? 1 : -1);
    });

    render();
    // 语音新建事件后：回到包含今天的那一周、重绘、把新事件滚到可见处，返回它的时间块（先隐藏占位）
    function place(e) {
      if (st.view === 'week') st.offset = 0; else st.day = TODAY_DATE;
      st.scroll = Math.max(0, (e.start / 60 - H0) * PX - 140);
      render(0);
      const el = $$('.cp-grid-in:last-child .cp-ev', grid).find(b => b.dataset.i === `${dayNum(TODAY_DATE)}:${e.start}:${e.title}`);
      el?.classList.remove('pop-in');
      el?.classList.add('rc-awaiting');
      return el;
    }
    // + Add：弹窗里的日期选项 = 正在看的这一周；默认选中正在看的那天（周视图里有今天就选今天）
    function addCtx() {
      const base = st.view === 'day' ? st.day : addDays(weekStart(), 0);
      const mon = addDays(base, -((base.getDay() + 6) % 7));
      const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
      const day = st.view === 'day' ? st.day : days.find(d => same(d, TODAY_DATE)) || days[0];
      return { days, day };
    }
    function showAdded(date, e) {
      if (st.view === 'day') st.day = date;
      else st.offset = Math.floor((dayNum(date) - dayNum(new Date(2024, 9, 28))) / 7);
      st.scroll = Math.max(0, (e.start / 60 - H0) * PX - 140);
      render(0);
      const el = $$('.cp-grid-in:last-child .cp-ev', grid).find(b => b.dataset.i === `${dayNum(date)}:${e.start}:${e.title}`);
      if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    }
    return { render, card, place, addCtx, showAdded, restore() { const b = $('.cp-grid-in .cp-body', grid); if (b) b.scrollTop = st.scroll; }, flashBBQ() {
      const el = $$('.cp-ev', grid).find(b => b.textContent.includes('Neighborhood BBQ'));
      if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    } };
  })();

  // ---------- Our Little World 轮播：点击/左右滑切换，6 秒自动播放 ----------
  (() => {
    const card = $('#s1 .memories');
    const imgs = $$('.slides img', card);
    const count = $('[data-slide-count]', card);
    if (imgs.length < 2) { count.textContent = `1 / ${imgs.length}`; return; }
    let i = 0, timer = 0, x0 = null;
    const go = n => {
      imgs[i].classList.remove('on');
      i = (n + imgs.length) % imgs.length;
      imgs[i].classList.add('on');
      count.textContent = `${i + 1} / ${imgs.length}`;
      clearInterval(timer);
      timer = setInterval(() => go(i + 1), 6000);
    };
    card.addEventListener('pointerdown', e => { x0 = e.clientX; });
    card.addEventListener('pointerup', e => {
      if (x0 === null || e.target.closest('[data-ask]')) return;
      const dx = e.clientX - x0; x0 = null;
      go(Math.abs(dx) > 30 && dx > 0 ? i - 1 : i + 1);
    });
    go(0);
  })();

  // ---------- 金币 / 任务 / 奖励 ----------
  const state = {
    balance: 22,
    tasks: [
      { name: 'Wake up on time', icon: 'assets/emoji/23f0.svg', coins: 3, done: true, when: 'Morning' },
      { name: 'Morning reading', icon: 'assets/emoji/1f4d6.svg', coins: 10, done: false, when: 'Morning' },
      { name: 'Help cook dinner', icon: 'assets/emoji/1f373.svg', coins: 4, done: false, when: 'Evening' },
    ],
    grabs: [
      { name: 'Water Plants', date: '10/22', coins: 3, icon: 'assets/emoji/1fab4.svg' },
      { name: 'Walk Biscuit', date: '10/23', coins: 5, icon: 'assets/emoji/1f436.svg' },
      { name: 'Fold Laundry', date: '10/24', coins: 4, icon: 'assets/emoji/1f9fa.svg' },
    ],
    // 礼物：Personal 卡上的三个（ice-cream / switch / milkshake）和 Rewards 页共用同一份
    rewards: [
      { id: 'book', name: 'Extra book at bedtime', cost: 8, art: 'assets/emoji/1f4da.svg', cat: 'treat' },
      { id: 'ice-cream', name: 'Ice Cream Cone', cost: 10, art: 'assets/rewards/ice-cream.png', cat: 'treat' },
      { id: 'pancakes', name: 'Pancake breakfast', cost: 15, art: 'assets/emoji/1f373.svg', cat: 'treat' },
      { id: 'dinner', name: 'Pick tonight’s dinner', cost: 20, art: 'assets/emoji/1f374.svg', cat: 'treat' },
      { id: 'stay-up', name: 'Stay up 30 min later', cost: 25, art: 'assets/emoji/1f6cf.svg', cat: 'fun' },
      { id: 'park', name: 'Park day with Biscuit', cost: 30, art: 'assets/emoji/1f436.svg', cat: 'fun' },
      { id: 'soccer', name: 'Soccer with Dad', cost: 35, art: 'assets/emoji/26bd.svg', cat: 'fun' },
      { id: 'garden', name: 'Plant my own flower', cost: 40, art: 'assets/emoji/1f331.svg', cat: 'fun' },
      { id: 'milkshake', name: 'Milkshake', cost: 60, art: 'assets/rewards/milkshake.png', cat: 'treat' },
      { id: 'mystery', name: 'Mystery box', cost: 75, art: 'assets/emoji/1f4e6.svg', cat: 'big' },
      { id: 'lake', name: 'Road trip to the lake', cost: 90, art: 'assets/emoji/1f697.svg', cat: 'big' },
      { id: 'switch', name: 'Nintendo Switch', cost: 100, art: 'assets/rewards/switch.png', cat: 'big', tilt: true },
    ],
    history: [
      { name: 'Extra book at bedtime', art: 'assets/emoji/1f4da.svg', cost: 8, date: 'Sat, Oct 26' },
      { name: 'Pancake breakfast', art: 'assets/emoji/1f373.svg', cost: 15, date: 'Sun, Oct 20' },
      { name: 'Park day with Biscuit', art: 'assets/emoji/1f436.svg', cost: 30, date: 'Sat, Oct 12' },
    ],
  };
  const rewardById = id => state.rewards.find(r => r.id === id);

  const board = $('.board', s2);
  const balanceEl = $('.balance', s2);
  const coinsEl = $('.tasks-coins', s2);
  const bump = el => { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); };
  const checklist = $('.checklist', s2);
  const grabsEl = $('.grabs', s2);
  const coinChip = n => `<span class="chip badge badge--coin"><img class="coin" src="assets/2714f.svg" alt=""><b>${n}</b></span>`;

  // 进入 Personal 屏：Rewards 里的奖品依次滑入、奖品图带回弹蹦出来、余额和进度数字往上数，可兑换的 Redeem 最后弹出
  function growRewards() {
    if (reduceMotion.matches) return;
    const card = $('.rewards', s2);
    if (!card) return;
    const D0 = 300, spring = 'cubic-bezier(0.2, 1.5, 0.45, 1)', out = 'cubic-bezier(0.23, 1, 0.32, 1)';
    const countUp = (el, delay, dur = 650) => {
      if (!el) return;
      const target = +el.textContent || 0, t0 = performance.now() + delay;
      el.textContent = '0';
      const step = now => {
        const p = Math.min(1, Math.max(0, (now - t0) / dur));
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      setTimeout(() => { el.textContent = target; }, delay + dur + 30);   // 兜底：保证最终值
    };
    countUp($('.balance b', card), D0);
    $$('.reward', card).forEach((li, i) => {
      const d = D0 + 80 + i * 70;
      li.animate([{ opacity: 0, transform: 'translateY(14px) scale(0.97)' }, { opacity: 1, transform: 'none' }],
        { duration: 460, delay: d, easing: out, fill: 'backwards' });
      const art = $('.reward-art', li);
      if (art) {
        const base = getComputedStyle(art).transform, b = base === 'none' ? '' : base;
        art.animate([{ opacity: 0, transform: `${b} scale(0.5) rotate(-14deg)` }, { opacity: 1, transform: b || 'none' }],
          { duration: 620, delay: d + 90, easing: spring, fill: 'backwards' });
      }
      countUp($('.reward-prog b', li), d + 120, 600);
      if (li.classList.contains('can')) {
        $('.redeem', li)?.animate([{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'none' }],
          { duration: 520, delay: d + 260, easing: spring, fill: 'backwards' });
      }
    });
  }

  function renderBalance() {
    $$('[data-balance]').forEach(el => { el.textContent = state.balance; });
    $('[data-coins]', s2).textContent = state.balance;
    rwPage?.render();
    for (const li of $$('.reward', s2)) {
      const r = rewardById(li.dataset.id), btn = $('.btn', li), can = !r.done && state.balance >= r.cost;
      li.classList.toggle('done', !!r.done);
      li.classList.toggle('can', can);
      btn.disabled = !can;
      btn.textContent = r.done ? 'Redeemed' : 'Redeem';
      const prog = $('.reward-prog b', li);
      if (prog) prog.textContent = Math.min(state.balance, r.cost);
    }
  }

  function renderProgress() {
    const done = state.tasks.filter(t => t.done).length, total = state.tasks.length;
    $('[data-done]', s2).textContent = `${done} of ${total} done`;
    const pct = Math.round(done / total * 100);
    $('[data-bar]', s2).style.width = pct + '%';
    $('[data-pct]', s2).textContent = pct + '%';
    $('.progress', s2).setAttribute('aria-valuenow', pct);
    tkPage?.syncFamily();
  }

  // 金币从 from 飞到余额胶囊（反向则飞出）
  function flyCoins(fromEl, toEl, n) {
    const b = board.getBoundingClientRect(), s = window.__stageScale || 1;
    const p = el => { const r = el.getBoundingClientRect(); return [(r.left + r.width / 2 - b.left) / s, (r.top + r.height / 2 - b.top) / s]; };
    const [x0, y0] = p(fromEl), [x1, y1] = p(toEl);
    const count = Math.min(5, Math.max(1, Math.round(n / 2)));
    for (let i = 0; i < count; i++) {
      const c = document.createElement('img');
      c.src = 'assets/2714f.svg';
      c.className = 'fly-coin';
      c.style.left = x0 - 7 + 'px';
      c.style.top = y0 - 6 + 'px';
      board.append(c);
      const dx = x1 - x0, dy = y1 - y0, lift = -60 - i * 6;
      c.animate([
        { transform: 'translate(0,0) rotate(42deg) scale(1)', opacity: 0 },
        { transform: `translate(${dx * .5}px,${dy * .5 + lift}px) rotate(200deg) scale(1.25)`, opacity: 1, offset: .5 },
        { transform: `translate(${dx}px,${dy}px) rotate(400deg) scale(.8)`, opacity: 1 },
      ], { duration: 640, delay: i * 60, easing: 'cubic-bezier(.45,0,.25,1)' }).onfinish = () => c.remove();
    }
    setTimeout(() => {
      toEl.classList.remove('bump'); void toEl.offsetWidth; toEl.classList.add('bump');
    }, 600 + (count - 1) * 60);
    return 600 + (count - 1) * 60;
  }

  function taskRow(t, enter) {
    const li = document.createElement('li');
    li.className = 'check-row' + (t.done ? ' done' : '') + (enter ? ' enter' : '');
    const icon = '';   // 和 Tasks 页一致：列表不放图标
    li.innerHTML = `<button class="check" type="button" aria-label="Mark ${t.name} done" aria-pressed="${t.done}"><svg viewBox="0 0 16 16"><path d="M3.5 8.3l3 3 6-6.4"/></svg></button>${icon}<p>${t.name}</p>${coinChip(t.coins)}<div class="hr"></div>`;
    $('.check', li).addEventListener('click', () => {
      t.done = !t.done;
      li.classList.toggle('done', t.done);
      $('.check', li).setAttribute('aria-pressed', t.done);
      renderProgress();
      const chip = $('.chip', li);
      if (t.done) {
        const ms = flyCoins(chip, coinsEl, t.coins);
        setTimeout(() => { state.balance += t.coins; renderBalance(); bump(balanceEl); }, ms);
      } else {
        state.balance = Math.max(0, state.balance - t.coins);
        renderBalance();
      }
    });
    return li;
  }

  // 进入 Personal 屏：进度条从 0 往右弹到当前进度，百分比同步数上去
  function growProgress() {
    const bar = $('[data-bar]', s2), pctEl = $('[data-pct]', s2);
    const done = state.tasks.filter(t => t.done).length, target = Math.round(done / state.tasks.length * 100);
    bar.style.transition = 'none';
    bar.style.width = '0';
    pctEl.textContent = '0%';
    void bar.offsetWidth;
    const delay = 320, dur = 760;
    bar.style.transition = `width ${dur}ms cubic-bezier(0.2, 1.5, 0.45, 1) ${delay}ms`;
    bar.style.width = target + '%';
    const t0 = performance.now() + delay;
    const step = now => {
      const p = Math.min(1, Math.max(0, (now - t0) / (dur * 0.8)));
      pctEl.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + '%';
      if (p < 1) requestAnimationFrame(step);
      else bar.style.transition = '';
    };
    requestAnimationFrame(step);
    clearTimeout(growProgress.t);
    growProgress.t = setTimeout(() => { pctEl.textContent = target + '%'; bar.style.transition = ''; }, delay + dur);
  }

  function renderTasks() {
    checklist.replaceChildren(...state.tasks.map(t => taskRow(t)));
    renderProgress();
  }

  const GRABS_EMPTY = '<li class="grabs-empty"><img src="assets/emoji/1f60a.svg" alt=""><p>All claimed, nice!</p><span>New tasks show up tomorrow</span></li>';

  function claim(g, card) {
    const i = state.grabs.indexOf(g);
    if (i < 0) return;
    state.grabs.splice(i, 1);
    const t = { name: g.name, icon: g.icon, coins: g.coins, done: false };
    state.tasks.push(t);
    const done = () => {
      card?.remove();
      if (!state.grabs.length) grabsEl.innerHTML = GRABS_EMPTY;
      const row = taskRow(t, true);
      checklist.append(row);
      checklist.scrollTo({ top: checklist.scrollHeight, behavior: 'smooth' });
      renderProgress();
    };
    if (card) { card.classList.add('claimed'); setTimeout(done, 260); } else done();
  }

  // 语音领取：立刻插入一行（先隐藏占位，等回执卡飞到再显现），返回这一行作为落点
  function claimForReceipt(g) {
    const i = state.grabs.indexOf(g);
    if (i < 0) return null;
    state.grabs.splice(i, 1);
    const t = { name: g.name, icon: g.icon, coins: g.coins, done: false };
    state.tasks.push(t);
    const card = $$('.grab', grabsEl).find(li => $('.g-name', li)?.textContent === g.name);
    if (card) { card.classList.add('claimed'); setTimeout(() => { card.remove(); if (!state.grabs.length) grabsEl.innerHTML = GRABS_EMPTY; }, 260); }
    const row = taskRow(t, false);
    row.classList.add('rc-awaiting');
    row.dataset.ring = '5 -8 7 -8 14';   // 光环只框这一行内容，不压到底部分隔线
    checklist.append(row);
    checklist.scrollTop = checklist.scrollHeight;
    renderProgress();
    return row;
  }

  function renderGrabs() {
    grabsEl.replaceChildren(...state.grabs.map(g => {
      const li = document.createElement('li');
      li.className = 'grab st';
      li.innerHTML = `<p class="g-name">${g.name}</p><p class="g-date">${g.date}</p>${coinChip(g.coins)}<button class="btn btn--neutral btn--sm" type="button">Claim</button>`;
      $('.btn', li).addEventListener('click', () => claim(g, li));
      return li;
    }));
  }

  function redeem(r) {
    if (r.done || state.balance < r.cost) return;
    state.balance -= r.cost;
    r.done = true;
    state.history.unshift({ name: r.name, art: r.art, cost: r.cost, date: 'Today' });
    $$('.balance, .tasks-coins, .rw-balance').forEach(bump);
    renderBalance();
    rwPage.renderHistory();
    celebrate(r.name, r.art, r.cost);
  }

  for (const li of $$('.reward', s2)) {
    const btn = $('.redeem', li);
    btn.addEventListener('click', () => redeem(rewardById(li.dataset.id)));
  }
  // 点 Rewards 卡（Redeem 按钮以外）进 Rewards 页看全部礼物
  $('.rewards', s2).addEventListener('click', e => { if (!e.target.closest('.redeem')) openRewards(); });

  // ---------- Rewards 页（s5）：全部礼物 + 分类 + 兑换记录 ----------
  var rwPage = (() => {
    const s5 = $('#s5'), body = $('.rw-body', s5), hist = $('.rw-hist', s5), histBtn = $('.rw-hist-btn', s5);
    // 分层：最想要的大目标 → 现在就能换的 → 继续攒的；同一份进度只说一遍
    const GOAL = 'switch';
    let cat = 'all';
    const coin = n => `<span class="chip badge badge--coin"><img class="coin" src="assets/2714f.svg" alt=""><b>${n}</b></span>`;
    const art = r => `<span class="rw-ico" data-cat="${r.cat}"><img${r.tilt ? ' class="tilt"' : ''} src="${r.art}" alt=""></span>`;
    const pct = r => Math.min(1, state.balance / r.cost) * 100;
    const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };

    function render() {
      const keep = body.scrollTop;
      const show = r => !r.done && (cat === 'all' || r.cat === cat);
      const goal = rewardById(GOAL);
      const ready = state.rewards.filter(r => show(r) && r.id !== GOAL && state.balance >= r.cost);
      const saving = state.rewards.filter(r => show(r) && r.id !== GOAL && state.balance < r.cost).sort((a, b) => a.cost - b.cost);
      const out = [];
      if (show(goal)) {
        out.push(el(`<section class="rw-goal st">
          <div class="rw-goal-art"><img${goal.tilt ? ' class="tilt"' : ''} src="${goal.art}" alt=""></div>
          <div class="rw-goal-info">
            <p class="rw-kicker">Saving for</p>
            <p class="rw-goal-name">${goal.name}</p>
            <div class="rw-goal-track"><i style="width:${pct(goal)}%"></i></div>
            <p class="rw-goal-meta"><b>${Math.min(state.balance, goal.cost)}</b> of ${goal.cost} coins · ${Math.max(0, goal.cost - state.balance)} to go</p>
          </div>
          ${state.balance >= goal.cost ? '<button class="btn btn--primary btn--sm rw-redeem" type="button">Redeem</button>' : ''}
        </section>`));
        $('.rw-redeem', out[0])?.addEventListener('click', () => redeem(goal));
      }
      if (ready.length) {
        out.push(el(`<p class="rw-sec section-label">Ready to redeem</p>`));
        const ul = el(`<ul class="rw-ready"></ul>`);
        for (const r of ready) {
          const li = el(`<li class="rw-tile st">${art(r)}<p class="rw-name">${r.name}</p><div class="rw-txt rw-foot">${coin(r.cost)}<button class="btn btn--primary btn--sm rw-redeem" type="button">Redeem</button></div></li>`);
          $('.rw-redeem', li).addEventListener('click', () => redeem(r));
          ul.append(li);
        }
        out.push(ul);
      }
      if (saving.length) {
        out.push(el(`<p class="rw-sec section-label">Save up for</p>`));
        const ul = el(`<ul class="rw-saving"></ul>`);
        for (const r of saving) ul.append(el(`<li class="rw-line st">${art(r)}<div class="rw-txt"><p class="rw-name">${r.name}</p><div class="rw-track"><i style="width:${pct(r)}%"></i></div></div><p class="rw-more">${r.cost - state.balance} more</p></li>`));
        out.push(ul);
      }
      if (!out.length) out.push(el(`<p class="rw-none">Nothing here yet</p>`));
      body.replaceChildren(...out);
      body.scrollTop = keep;
    }

    const seg = $$('.rw-seg button', s5);
    seg.forEach(b => b.addEventListener('click', () => {
      seg.forEach(x => x.setAttribute('aria-pressed', x === b));
      cat = b.dataset.cat;
      render();
      body.scrollTop = 0;
    }));
    const toggleHist = open => { hist.hidden = !open; histBtn.setAttribute('aria-expanded', open); };
    histBtn.addEventListener('click', e => { e.stopPropagation(); toggleHist(hist.hidden); });
    s5.addEventListener('click', e => { if (!hist.hidden && !e.target.closest('.rw-hist')) toggleHist(false); });
    $('.rw-back', s5).addEventListener('click', () => closeRewards());
    return {
      renderHistory() {
        hist.innerHTML = `<h3>Redeemed by Emma</h3><ul>${state.history.map(h =>
          `<li><img src="${h.art}" alt=""><p>${h.name}<span>${h.date}</span></p><span class="chip badge badge--coin"><img class="coin" src="assets/2714f.svg" alt=""><b>−${h.cost}</b></span></li>`).join('')}</ul>`;
      },
      render,
      restore() { toggleHist(false); body.scrollTop = 0; },
    };
  })();
  rwPage.renderHistory();

  // ---------- Rewards 浮层：从 Personal 的 Rewards 卡片原地展开（子功能，不跳新页面），收起时缩回卡片 ----------
  const rwModal = document.createElement('div');
  rwModal.className = 'rw-modal';
  rwModal.hidden = true;
  rwModal.innerHTML = `<div class="rw-scrim"></div><div class="rw-panel" role="dialog" aria-label="Rewards">
    <button class="rw-collapse icon-btn icon-btn--sm icon-btn--ghost" type="button" aria-label="Close rewards"><svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8"/></svg></button></div>`;
  s2.append(rwModal);
  const rwPanel = $('.rw-panel', rwModal), rwContent = $('.rwpage', $('#s5'));
  rwPanel.append(rwContent);
  let rwOpen = false;
  const rwEase = 'cubic-bezier(0.32, 0.72, 0, 1)';
  // 卡片在面板坐标里的位置 → clip-path inset（裁切展开，不拉伸内容和圆角）
  function cardInset() {
    const k = window.__stageScale || 1, c = $('.rewards', s2).getBoundingClientRect(), p = rwPanel.getBoundingClientRect();
    const t = (c.top - p.top) / k, l = (c.left - p.left) / k, r = (p.right - c.right) / k, b = (p.bottom - c.bottom) / k;
    return `inset(${t}px ${r}px ${b}px ${l}px round 22px)`;
  }
  function openRewards() {
    if (rwOpen) return;
    rwOpen = true;
    if (!s2.classList.contains('on')) show('s2');
    rwPage.restore?.();
    rwModal.hidden = false;
    syncIsland();
    const card = $('.rewards', s2), fast = reduceMotion.matches;
    const from = cardInset();
    card.style.visibility = 'hidden';
    rwPanel.animate([{ clipPath: from }, { clipPath: 'inset(0px 0px 0px 0px round 28px)' }], { duration: fast ? 0 : 560, easing: rwEase });
    $('.rw-scrim', rwModal).animate([{ opacity: 0 }, { opacity: 1 }], { duration: fast ? 150 : 360, easing: 'ease-out' });
    rwContent.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: fast ? 150 : 360, delay: fast ? 0 : 200, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'backwards' });
    $('.rw-collapse', rwModal).animate([{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: fast ? 0 : 320, easing: 'cubic-bezier(0.2, 1.5, 0.45, 1)', fill: 'backwards' });
  }
  function closeRewards() {
    if (!rwOpen) return;
    rwOpen = false;
    const fast = reduceMotion.matches, card = $('.rewards', s2);
    rwContent.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' });
    $('.rw-collapse', rwModal).animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' });
    rwPanel.animate([{ clipPath: 'inset(0px 0px 0px 0px round 28px)' }, { clipPath: cardInset() }], { duration: fast ? 0 : 440, delay: fast ? 0 : 60, easing: rwEase, fill: 'forwards' });
    $('.rw-scrim', rwModal).animate([{ opacity: 1 }, { opacity: 0 }], { duration: fast ? 120 : 420, easing: 'ease-out', fill: 'forwards' });
    setTimeout(() => {
      card.style.visibility = '';
      rwModal.hidden = true;
      syncIsland();
      rwModal.getAnimations({ subtree: true }).forEach(a => a.cancel());
    }, fast ? 130 : 520);
  }
  $('.rw-collapse', rwModal).addEventListener('click', closeRewards);
  $('.rw-scrim', rwModal).addEventListener('click', closeRewards);
  addEventListener('keydown', e => { if (e.key === 'Escape' && rwOpen) closeRewards(); });
  renderBalance();

  // ---------- 兑换成功：庆祝卡 + 彩纸 ----------
  function celebrate(name, art, cost) {
    const root = document.createElement('div');
    root.className = 'celebrate';
    root.innerHTML = `<canvas class="confetti"></canvas>
      <div class="cele-card" role="dialog" aria-label="Reward redeemed">
        <div class="cele-badge"><i></i><img src="${art}" alt=""></div>
        <p class="cele-title"><svg viewBox="0 0 24 24"><path d="M12 2.5l2.7 6.2 6.8.6-5.2 4.5 1.6 6.6L12 16.9l-5.9 3.5 1.6-6.6-5.2-4.5 6.8-.6z"/></svg>You got it!<svg viewBox="0 0 24 24"><path d="M12 2.5l2.7 6.2 6.8.6-5.2 4.5 1.6 6.6L12 16.9l-5.9 3.5 1.6-6.6-5.2-4.5 6.8-.6z"/></svg></p>
        <p class="cele-sub">Emma redeemed</p>
        <div class="cele-item st"><img src="${art}" alt=""><p>${name}</p><span class="chip badge badge--coin"><img class="coin" src="assets/2714f.svg" alt=""><b>−${cost}</b></span></div>
      </div>`;
    $('.frame.on').append(root);
    const close = () => {
      if (root.classList.contains('out')) return;
      root.classList.add('out');
      setTimeout(() => root.remove(), 320);
    };
    root.addEventListener('click', close);
    setTimeout(close, 3600);
    if (!reduceMotion.matches) confetti($('.confetti', root));
  }

  function confetti(canvas) {
    const W = 1280, H = 800, dpr = Math.min(devicePixelRatio || 1, 2) * (window.__stageScale || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const COLORS = ['--m-emma-solid', '--m-sam-solid', '--m-mom-solid', '--m-pair'].map(n => `rgb(${tok(n)})`).concat([tok('--accent'), tok('--gold')]);
    const STAR = tok('--gold');
    const coin = new Image(); coin.src = 'assets/2714f.svg';
    const cx = W / 2, cy = H / 2 - 40;
    const parts = Array.from({ length: 90 }, (_, i) => {
      const a = Math.random() * Math.PI * 2, v = 5 + Math.random() * 9;
      const kind = i % 9 === 0 ? 'coin' : i % 4 === 0 ? 'star' : i % 2 ? 'dot' : 'rect';
      return { x: cx, y: cy, vx: Math.cos(a) * v * 1.25, vy: Math.sin(a) * v - 5, r: Math.random() * Math.PI, vr: (Math.random() - .5) * .3,
        s: kind === 'coin' ? 16 : kind === 'star' ? 9 + Math.random() * 6 : 4 + Math.random() * 4, kind, c: COLORS[i % COLORS.length] };
    });
    const star = (x, y, s) => {
      ctx.beginPath();
      for (let k = 0; k < 10; k++) { const rr = k % 2 ? s * .45 : s, t = k * Math.PI / 5 - Math.PI / 2; ctx.lineTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr); }
      ctx.closePath(); ctx.fill();
    };
    const t0 = performance.now();
    const frame = now => {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.vx *= .985; p.vy = p.vy * .985 + .32; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 1.6) / .9);
        ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.kind === 'star' ? STAR : p.c;
        if (p.kind === 'coin') ctx.drawImage(coin, -p.s / 2, -p.s * .45, p.s, p.s * .9);
        else if (p.kind === 'star') star(0, 0, p.s);
        else if (p.kind === 'dot') { ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(-p.s / 2, -p.s * .9, p.s, p.s * 1.8);
        ctx.restore();
      }
      if (t < 2.6 && canvas.isConnected) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  // ---------- Tasks 页：四个家庭成员各一列，按时段分组；Emma 这一列就是 Personal 屏的同一份任务 ----------
  var tkPage = (() => {
    const s4 = $('#s4'), page = $('.tkpage', s4), cols = $('.tk-cols', page), pop = $('.tk-pop', page);
    const E = n => `assets/emoji/${n}.svg`;
    // 配色取自 Family 屏 "Tasks for today" 的成员行；acc = 进度环/勾选色
    const MEMBERS = [
      { id: 'emma', kid: true, tasks: state.tasks, coins: () => state.balance,
        bg: [tok('--task-emma-soft'), tok('--task-emma')], acc: tok('--task-emma-acc') },
      { id: 'sam', kid: true, bank: 15, bg: [tok('--task-sam-soft'), tok('--task-sam')], acc: tok('--task-sam-acc'), tasks: [
        { name: 'Brush teeth', icon: E('1faa5'), coins: 2, done: true, when: 'Morning' },
        { name: 'Soccer practice', icon: E('26bd'), coins: 5, done: false, when: 'Afternoon' },
        { name: 'Pack school bag', icon: E('1f392'), coins: 3, done: false, when: 'Evening' },
      ] },
      { id: 'mom', bg: [tok('--task-mom-soft'), tok('--task-mom')], acc: tok('--task-mom-acc'), tasks: [
        { name: 'Pack lunches', icon: E('1f96a'), done: true, when: 'Morning' },
        { name: 'Grocery run', icon: E('1f6d2'), done: true, when: 'Afternoon' },
        { name: 'Set the table', icon: E('1f374'), done: true, when: 'Evening' },
        { name: 'Fold laundry', icon: E('1f9fa'), done: false, when: 'Chores' },
      ] },
      { id: 'dad', bg: [tok('--task-dad-soft'), tok('--task-dad')], acc: tok('--task-dad-acc'), tasks: [
        { name: 'Make the bed', icon: E('1f6cf'), done: true, when: 'Morning' },
        { name: 'Car service', icon: E('1f697'), done: true, when: 'Afternoon' },
        { name: 'Take out trash', icon: E('1f5d1'), done: false, when: 'Evening' },
        { name: 'Pay bills', icon: E('1f4b3'), done: false, when: 'Chores' },
      ] },
    ];
    const SECTIONS = ['Morning', 'Afternoon', 'Evening', 'Chores'];
    // 翻天：0 = 今天。今天用上面这份（Emma 的就是 state.tasks）；别的天从各人的任务池按日期种子挑 3 个，过去的都已完成，未来的都没做
    const POOL = {
      emma: [['Morning reading', '1f4d6', 'Morning'], ['Piano practice', '1f3b9', 'Afternoon'], ['Feed Biscuit', '1f436', 'Morning'], ['Water plants', '1fab4', 'Afternoon'], ['Tidy my room', '1f9f9', 'Chores'], ['Pack school bag', '1f392', 'Evening']],
      sam: [['Brush teeth', '1faa5', 'Morning'], ['Soccer practice', '26bd', 'Afternoon'], ['Pack school bag', '1f392', 'Evening'], ['Walk Biscuit', '1f436', 'Afternoon'], ['Homework', '1f4da', 'Evening']],
      mom: [['Pack lunches', '1f96a', 'Morning'], ['Grocery run', '1f6d2', 'Afternoon'], ['Set the table', '1f374', 'Evening'], ['Fold laundry', '1f9fa', 'Chores'], ['Water the garden', '1f331', 'Morning']],
      dad: [['Make the bed', '1f6cf', 'Morning'], ['Take out trash', '1f5d1', 'Evening'], ['Pay bills', '1f4b3', 'Chores'], ['Car wash', '1f697', 'Afternoon'], ['Cook breakfast', '1f373', 'Morning']],
    };
    let day = 0;
    MEMBERS.forEach(m => { m.today = m.tasks; m.byDay = {}; });
    function tasksFor(m, d) {
      if (!d) return m.today;
      return m.byDay[d] ??= (() => {
        const rand = rng(d * 131 + MEMBERS.indexOf(m) * 17 + 7), pool = POOL[m.id].slice();
        return Array.from({ length: 3 }, () => {
          const [name, icon, when] = pool.splice(Math.floor(rand() * pool.length), 1)[0];
          return { name, icon: E(icon), when, coins: m.kid ? 2 + Math.floor(rand() * 4) : 0, done: d < 0 };
        });
      })();
    }
    const DAY_FMT = { weekday: 'short', month: 'short', day: 'numeric' };
    function setDay(d) {
      day = d;
      MEMBERS.forEach(m => { m.tasks = tasksFor(m, d); });
      const date = new Date(2024, 9, 29 + d), rel = { '-1': 'Yesterday', 0: 'Today', 1: 'Tomorrow' }[d];
      $('[data-tk-date]', page).textContent = (rel ? rel + ' · ' : '') + date.toLocaleDateString('en-US', DAY_FMT);
      page.classList.toggle('tk-other', d !== 0);
      $('[data-tk-today]', page).disabled = d === 0;
      render(true);
    }
    $('[data-tk-prev]', page).addEventListener('click', () => setDay(day - 1));
    $('[data-tk-next]', page).addEventListener('click', () => setDay(day + 1));
    $('[data-tk-today]', page).addEventListener('click', () => { if (day) setDay(0); });
    const coinsOf = m => m.coins ? m.coins() : m.bank;
    const doneOf = m => m.tasks.filter(t => t.done).length;
    const ringSVG = m => {
      const pct = m.tasks.length ? doneOf(m) / m.tasks.length * 100 : 0;
      return `<svg class="tk-ring" viewBox="0 0 34 34"><circle cx="17" cy="17" r="14.4" stroke="rgba(255,255,255,.62)"/><circle cx="17" cy="17" r="14.4" stroke="${m.acc}" pathLength="100" stroke-dasharray="${pct ? Math.max(0.1, pct - 6) : 0} 100" stroke-dashoffset="-3"/></svg>`;
    };

    function header(m) {
      const p = PEOPLE[m.id];
      return `<div class="task st tk-head m-${m.id}">
        <div class="avw st"><div class="av av36 st">${p.av}</div></div>
        <div class="lbl"><p class="n">${p.name}</p><p class="d">${doneOf(m)} of ${m.tasks.length} done</p></div>
        ${m.kid ? `<span class="chip badge badge--coin tk-bank"><img class="coin" src="assets/2714f.svg" alt=""><b>${coinsOf(m)}</b></span>` : ''}
        ${ringSVG(m)}
      </div>`;
    }

    function row(m, t) {
      const li = document.createElement('li');
      li.className = 'check-row tk-row st' + (t.done ? ' done' : '');
      li.innerHTML = `<button class="check" type="button" aria-label="Mark ${t.name} done" aria-pressed="${t.done}"><svg viewBox="0 0 16 16"><path d="M3.5 8.3l3 3 6-6.4"/></svg></button><p>${t.name}</p>${t.coins ? `<span class="tk-coins">+${t.coins}</span>` : ''}`;
      $('.check', li).addEventListener('click', e => { e.stopPropagation(); toggle(m, t); });
      li.addEventListener('click', () => open(m, t, li));
      return li;
    }

    function column(m, i) {
      const col = document.createElement('section');
      col.className = `tk-col tk-col--${m.id}`;
      col.dataset.m = m.id;
      col.style.cssText = `--i:${i}`;   // 颜色全部来自 .tk-col--{id}（同一套成员色板）
      col.innerHTML = header(m);
      const list = document.createElement('div');
      list.className = 'tk-list scroll';
      // 不分时段：一条连续列表（仍按时段先后排序）
      const ul = document.createElement('ul');
      ul.append(...SECTIONS.flatMap(sec => m.tasks.filter(t => (t.when || 'Chores') === sec)).map(t => row(m, t)));
      list.append(ul);
      col.append(list);
      return col;
    }

    // 勾选只更新这个人自己：这一行、列头的 x of n done、进度环、金币；不重建整列（重建会重放入场动画，看起来像闪一下）
    const ringDash = m => { const pct = m.tasks.length ? doneOf(m) / m.tasks.length * 100 : 0; return `${pct ? Math.max(0.1, pct - 6) : 0} 100`; };
    function toggle(m, t) {
      t.done = !t.done;
      if (t.coins) {
        if (m.id === 'emma') state.balance = Math.max(0, state.balance + (t.done ? t.coins : -t.coins));
        else m.bank = Math.max(0, m.bank + (t.done ? t.coins : -t.coins));
      }
      if (m.id === 'emma') { renderTasks(); renderBalance(); }
      const col = $(`.tk-col[data-m="${m.id}"]`, cols);
      const li = $$('.tk-row', col).find(el => $('p', el).textContent === t.name);
      if (!li) {                                   // 这一列的任务结构变了（比如新领了任务）才重建，并且不放入场动画
        const keep = $('.tk-list', col).scrollTop, next = column(m, MEMBERS.indexOf(m));
        next.style.animation = 'none';
        col.replaceWith(next);
        $('.tk-list', next).scrollTop = keep;
      } else {
        li.classList.toggle('done', t.done);
        $('.check', li).setAttribute('aria-pressed', t.done);
        li.classList.remove('just');
        if (t.done) { void li.offsetWidth; li.classList.add('just'); }
        const head = $('.tk-head', col);
        $('.lbl .d', head).textContent = `${doneOf(m)} of ${m.tasks.length} done`;
        $('.tk-ring circle:last-child', head).style.strokeDasharray = ringDash(m);
        const bank = $('.tk-bank', head);
        if (bank) { $('b', bank).textContent = coinsOf(m); if (t.done && t.coins) bump(bank); }
        if (!pop.hidden && pop.task === t) close();
      }
      summary();
      syncFamily();
    }

    // 点任务行：弹出详情卡，可以直接标记完成
    function open(m, t, li) {
      if (!pop.hidden && pop.task === t) return close();
      pop.task = t;
      pop.innerHTML = `        <p class="t">${t.name}</p>
        <p class="s">${t.when || 'Chores'} · ${PEOPLE[m.id].name}</p>
        ${t.coins ? `<div class="tk-pop-coins">${coinChip(t.coins)}<span>${t.done ? 'earned' : 'to earn'}</span></div>` : ''}
        <button class="btn btn--primary btn--lg btn--block tk-pop-btn${t.done ? ' undo' : ''}" type="button">${t.done ? 'Mark as not done' : 'Mark as complete'}</button>`;
      pop.style.setProperty('--acc', m.acc);
      $('.tk-pop-btn', pop).addEventListener('click', () => { close(); toggle(m, t); });
      const r = li.getBoundingClientRect(), o = page.getBoundingClientRect(), k = window.__stageScale || 1;
      pop.hidden = false;
      const w = pop.offsetWidth, h = pop.offsetHeight;
      let x = (r.left - o.left) / k + 16, y = (r.bottom - o.top) / k + 6;
      x = Math.min(x, page.offsetWidth - w - 12);
      if (y + h > page.offsetHeight - 12) y = (r.top - o.top) / k - h - 6;
      pop.style.left = x + 'px';
      pop.style.top = y + 'px';
      $$('.tk-row.sel', cols).forEach(el => el.classList.remove('sel'));
      li.classList.add('sel');
    }
    function close() {
      pop.hidden = true;
      pop.task = null;
      $$('.tk-row.sel', cols).forEach(el => el.classList.remove('sel'));
    }
    s4.addEventListener('pointerdown', e => { if (!pop.hidden && !e.target.closest('.tk-pop, .tk-row')) close(); });
    addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    cols.addEventListener('scroll', close, true);

    function summary() {
      const all = MEMBERS.flatMap(m => m.tasks), done = all.filter(t => t.done).length;
      // 全家总进度已去掉（顶栏不再显示）
    }

    // Family 屏 "Tasks for today" 的计数和进度环跟着这里走
    function syncFamily() {
      const rows = $$('#s1 .task');
      for (const m of MEMBERS) {
        const r = rows.find(el => $('.lbl .n', el)?.textContent === PEOPLE[m.id].name);
        if (!r) continue;
        const t = { ...m, tasks: m.today };   // Family 屏永远是今天
        $('.lbl .d', r).textContent = `${doneOf(t)} of ${t.tasks.length} done`;
        const old = $('.prog, .tk-ring', r);
        old.insertAdjacentHTML('afterend', ringSVG(t));
        old.remove();
      }
    }

    function render(entering) {
      close();
      cols.replaceChildren(...MEMBERS.map(column));
      cols.classList.remove('in'); void cols.offsetWidth;
      cols.classList.toggle('in', !!entering);
      summary();
    }
    render();
    syncFamily();
    // + Add：加到正在看的那一天、选中的人、选中的时段
    const SEC_ICON = { Morning: '23f0', Afternoon: '1f4da', Evening: '1f6cf', Chores: '1f9f9' };
    function add(name, who, when) {
      const m = MEMBERS.find(x => x.id === who);
      m.tasks.push({ name, icon: E(SEC_ICON[when]), when, coins: m.kid ? 3 : 0, done: day < 0 });
      render();
      if (!day) syncFamily();
      const row = $$(`.tk-col[data-m="${who}"] .tk-row`, cols).find(el => $('p', el).textContent === name);
      row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      row?.classList.add('tk-new');
    }
    return { render, close, syncFamily, add, setDay };
  })();

  // ---------- Meals 页 s7：静态内容，左右两栏各自可滑 ----------
  (() => {
    const s7 = $('#s7');
    const I = {
      all: '<svg viewBox="0 0 16 16"><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1.2"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1.2"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1.2"/><rect x="9" y="9" width="4.5" height="4.5" rx="1.2"/></svg>',
      dessert: '<svg viewBox="0 0 16 16"><path d="M3 13.5h10V9H3zM3 9c0-1.6 2.2-2.6 5-2.6S13 7.4 13 9M8 6.4V4.2"/><circle cx="8" cy="3.2" r=".9"/></svg>',
      fast: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8.8" r="5"/><path d="M8 6.3v2.5l1.6 1M6.5 2.5h3"/></svg>',
      pot: '<svg viewBox="0 0 16 16"><path d="M2.5 7h11v3.5a3 3 0 0 1-3 3h-5a3 3 0 0 1-3-3zM1 7h1.5M13.5 7H15M6 4.8c0-1 .8-1.3.8-2.3M9.4 4.8c0-1 .8-1.3.8-2.3"/></svg>',
      app: '<svg viewBox="0 0 16 16"><path d="M5 2.5v3.2a1.5 1.5 0 0 0 3 0V2.5M6.5 2.5v11M11.5 13.5V2.5C10.3 3 9.6 4.3 9.6 6.2v2.3h1.9"/></svg>',
      prep: '<svg viewBox="0 0 16 16"><rect x="2" y="5.5" width="12" height="8" rx="2"/><path d="M5 5.5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.5M2 9h12"/></svg>',
      saved: '<svg viewBox="0 0 16 16"><path d="M4.5 2.5h7v11L8 11l-3.5 2.5z"/></svg>',
      created: '<svg viewBox="0 0 16 16"><path d="M10.6 2.9l2.5 2.5-7.4 7.4-3.2.7.7-3.2z"/></svg>',
      cal: '<svg viewBox="0 0 16 16"><rect x="2.5" y="3.5" width="11" height="10" rx="2"/><path d="M2.5 7h11M5.5 2v3M10.5 2v3"/></svg>',
      fork: '<svg viewBox="0 0 21 21"><path d="M4 2.6v4.2a2.1 2.1 0 0 0 4.2 0V2.6M6.1 2.6v15.8M15.75 18.4V2.6c-1.85.7-3 2.7-3 5.5v3.3h3"/></svg>',
    };
    const chip = (icon, label, on) => `<span class="ml-chip filter-chip${on ? ' on' : ''}">${icon}${label}</span>`;
    $('[data-ml-cats]', s7).innerHTML = [[I.all, 'All', 1], [I.dessert, 'Dessert'], [I.fast, 'Fast prep'], [I.pot, 'One-Pot'], [I.app, 'Appetizer'], [I.prep, 'Meal prep']].map(c => chip(...c)).join('');
    $('[data-ml-tabs]', s7).innerHTML = [[I.all, 'All', 1], [I.saved, 'Saved by you'], [I.created, 'Created by you']].map(c => chip(...c)).join('');

    const M = n => `assets/meals/${n}.jpg`;
    const EXPLORE = [
      ['Kung Pao Chicken', 'kung-pao-chicken', 1], ['Chicken Congee', 'chicken-congee'], ['Honey Teriyaki Salmon', 'honey-teriyaki-salmon', 1],
      ['Beef Lo Mein', 'beef-lo-mein'], ['Wontons', 'wontons', 1], ['Shakshuka', 'shakshuka'],
      ['Spaghetti Bolognese', 'spaghetti-bolognese'], ['Japanese Katsudon', 'katsudon'], ['Pad See Ew', 'pad-see-ew', 1],
      ['Salmon Avocado Salad', 'salmon-avocado-salad'], ['Lasagne', 'lasagne'], ['Carrot Cake', 'carrot-cake'],
    ];
    $('[data-ml-grid]', s7).innerHTML = EXPLORE.map(([name, img, saved]) => `
      <div class="ml-card">
        <div class="ml-photo"><img src="${M(img)}" alt="" draggable="false">
          <span class="ml-acts"><span class="ml-act${saved ? ' saved' : ''}">${I.saved}</span><span class="ml-act">${I.cal}</span></span>
        </div>
        <p class="ml-name">${name}</p>
      </div>`).join('');

    // 前两道是家里自己写的菜谱，没有照片，用刀叉占位（同参考截图）
    const COLLECTION = [
      ["Grandma's Dumplings"], ['Saturday Pancake Stack'],
      ['Chicken Fried Rice', 'chicken-fried-rice'], ['Sweet and Sour Pork', 'sweet-sour-pork'], ['Tonkatsu Pork', 'tonkatsu'],
      ['Teriyaki Chicken Casserole', 'teriyaki-chicken'], ['Margherita Pizza', 'margherita'], ['Banana Pancakes', 'banana-pancakes'],
      ['Tuna Niçoise', 'tuna-nicoise'], ['Apple Frangipane Tart', 'apple-tart'], ['Chicken Quinoa Greek Salad', 'quinoa-greek-salad'],
      ['Bread and Butter Pudding', 'bread-butter-pudding'],
    ];
    $('[data-ml-list]', s7).innerHTML = COLLECTION.map(([name, img]) => `
      <li class="ml-row st">
        ${img ? `<img class="ml-thumb" src="${M(img)}" alt="" draggable="false">` : `<span class="ml-thumb ml-thumb-empty">${I.fork}</span>`}
        <p>${name}</p>
      </li>`).join('');
  })();

  renderTasks();
  renderGrabs();
  renderBalance();

  // ---------- 便签：家人留言，点一下翻页 ----------
  const NOTES = [
    { from: 'from Mom', text: 'Don’t forget your library book today!' },
    { from: 'from Dad', text: 'Piano at 5. I’ll pick you up after school.' },
    { from: 'from Sam', text: 'BBQ tonight. Save me a cookie!' },
  ];
  const note = $('.note', s2), noteText = $('[data-note-text]', s2), noteDots = $('[data-note-dots]', s2);
  noteDots.innerHTML = NOTES.map(() => '<i></i>').join('');
  let noteIdx = 0;
  function drawNote() {
    const n = NOTES[noteIdx];
    noteText.textContent = n.text;
    $('[data-note-from]', s2).textContent = n.from;
    $$('i', noteDots).forEach((d, k) => d.classList.toggle('on', k === noteIdx));
  }
  drawNote();
  // 翻页：dir = 1 下一张（文字往左出、从右进），-1 上一张；from = 松手时文字已经被拖到的位置
  const ease = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const nextNote = (dir = 1, from = 0) => {
    noteText.animate([{ transform: `translateX(${from}px)`, opacity: Math.max(0, 1 - Math.abs(from) / 120) }, { transform: `translateX(${-dir * 40}px)`, opacity: 0 }], { duration: 160, easing: 'ease-in', fill: 'forwards' }).onfinish = () => {
      noteIdx = (noteIdx + dir + NOTES.length) % NOTES.length;
      drawNote();
      noteText.animate([{ transform: `translateX(${dir * 40}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 280, easing: ease, fill: 'forwards' });
    };
  };
  // 左右滑：文字跟手，过 40px 松手就翻页，不够就弹回；没怎么动 = 单点，也翻到下一张
  let nx = null, ndx = 0;
  note.addEventListener('pointerdown', e => { nx = e.clientX; ndx = 0; note.setPointerCapture(e.pointerId); });
  note.addEventListener('pointermove', e => {
    if (nx === null) return;
    ndx = (e.clientX - nx) / (window.__stageScale || 1);
    noteText.getAnimations().forEach(a => a.cancel());
    noteText.style.transform = `translateX(${ndx}px)`;
    noteText.style.opacity = Math.max(0.2, 1 - Math.abs(ndx) / 140);
  });
  const noteUp = () => {
    if (nx === null) return;
    nx = null;
    const dx = ndx;
    noteText.style.transform = noteText.style.opacity = '';
    if (Math.abs(dx) < 6) nextNote(1);
    else if (Math.abs(dx) >= 40) nextNote(dx < 0 ? 1 : -1, dx);
    else noteText.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 260, easing: ease });
  };
  note.addEventListener('pointerup', noteUp);
  note.addEventListener('pointercancel', noteUp);
  note.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); nextNote(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); nextNote(-1); }
  });

  // ---------- Peak Hours ----------
  // Emma 的一天，按小时
  const PEAK = [
    [0, ''], [0, ''], [0, ''], [0, ''], [0, ''], [0, ''], [.08, ''], [.3, 'Breakfast'],
    [.46, 'School drop-off'], [.4, 'Math class'], [.52, 'Reading group'], [.6, 'Science'],
    [.42, 'Lunch & recess'], [.5, 'Art class'], [.38, 'Pickup'], [.62, 'Library'],
    [.88, 'Homework with Sam'], [.74, 'Piano practice'], [.82, 'Neighborhood BBQ'], [.56, 'BBQ'],
    [.4, 'Reading time'], [.2, 'Pack school bag'], [.06, ''], [0, ''],
  ];
  const hourLabel = i => `${i % 12 || (i === 0 ? 0 : 12)} ${i < 12 ? 'AM' : 'PM'}`;
  const barsEl = $('.bars', s2), peakSub = $('.peak-sub', s2);
  const maxI = PEAK.reduce((m, p, i) => p[0] > PEAK[m][0] ? i : m, 0);
  PEAK.forEach(([v, what], i) => {
    const b = document.createElement('div');
    b.className = 'bar' + (i === maxI ? ' peak-max' : '');
    b.setAttribute('role', 'listitem');
    b.innerHTML = `<i style="height:0"></i>${i % 4 === 0 ? `<span>${hourLabel(i)}</span>` : ''}`;
    b.addEventListener('click', () => {
      const was = b.classList.contains('sel');
      $$('.bar', barsEl).forEach(x => x.classList.remove('sel'));
      if (was) { peakSub.textContent = 'Today'; return; }
      b.classList.add('sel');
      peakSub.textContent = `${hourLabel(i)} · ${what || 'Free'}`;
    });
    barsEl.append(b);
  });
  function growBars() {
    const fills = $$('.bar i', barsEl);
    fills.forEach(el => { el.style.transition = 'none'; el.style.height = '0'; });
    void barsEl.offsetWidth;
    requestAnimationFrame(() => fills.forEach((el, i) => {
      el.style.transition = '';
      el.style.transitionDelay = 260 + i * 18 + 'ms';
      el.style.height = PEAK[i][0] ? Math.max(6, PEAK[i][0] * 66) + 'px' : '0';
    }));
  }

  // ---------- 天气 ----------
  const weather = $('.weather72', s2);
  let celsius = false;
  weather.addEventListener('click', () => {
    const t = $('.w-temp', weather);
    t.classList.add('swap');
    setTimeout(() => {
      celsius = !celsius;
      $('[data-temp]', weather).textContent = celsius ? 22 : 72;
      t.classList.remove('swap');
    }, 160);
  });

  // ---------- 快捷操作 ----------
  const fab = $('.fab', s2), fabMain = $('.fab-main', fab);
  fabMain.addEventListener('click', () => {
    const open = !fab.classList.contains('is-open');
    fab.classList.toggle('is-open', open);
    fabMain.setAttribute('aria-expanded', open);
  });
  $$('.fab-act', fab).forEach(a => a.addEventListener('click', () => {
    a.classList.remove('pinged'); void a.offsetWidth; a.classList.add('pinged');
  }));

  // 点小鸟（非 Tap to ask）时依次新建的事件
  const CREATE = [
    { title: 'Movie Night', who: ['all'], start: 1245, dur: 60, heard: 'Add movie night tonight at 8:45 for everyone.' },
    { title: 'Story Time', who: ['dad', 'emma'], start: 750, dur: 30, heard: 'Put story time with Dad and Emma at 12:30 today.' },
  ];
  let pending = null;

  // ---------- Nestie 语音：一只小鸟挂在舞台上，两屏共用，切换页面时不动 ----------
  if (window.Nestie) {
    const s1 = $('#s1');
    const onHome = () => !$('#s2').classList.contains('on') && !$('#s5').classList.contains('on');
    voices.nestie = new Nestie(stage, {
      center: [1201, 728],
      resident: true,
      onHear: on => { if (speaking !== on) { speaking = on; syncIsland(); } },
      // heard = 演示用的识别结果；status = 工具状态（进行中 / ✓ 完成）；say = 小鸟一句一句说
      reply: () => {
        const mode = voices.nestie.mode; voices.nestie.mode = null;
        pending = null;
        if (onHome() && (mode === 'query' || !CREATE.length)) return {
          heard: 'Are there any plans for this weekend?',
          status: ['Searching your calendar'],
          say: ['Neighborhood BBQ is Saturday at 6 PM.', 'And Soccer Practice is on Sunday.'],
        };
        if (onHome()) {
          const e = CREATE[0];
          pending = { kind: 'event', e };
          return {
            heard: e.heard,
            status: ['Adding it to the family calendar…', '✓ Event created'],
            say: ['Done!', `${e.title} is on the calendar, today at ${fmtTime(e.start)}.`],
          };
        }
        const g = state.grabs[0];
        if (!g) return {
          heard: 'Can I pick up another task?',
          status: ['Checking your tasks'],
          say: ['You have claimed everything today.', 'Great job, Emma!'],
        };
        pending = { kind: 'task', g };
        const short = g.name.length > 18 ? g.name.slice(0, 17) + '…' : g.name;
        return {
          heard: `Can you add ${g.name.toLowerCase()} to my tasks?`,
          status: [`Updating the task “${short}”…`, '✓ Task updated'],
          say: ['Got it!', `I added “${g.name}” to your tasks for today.`],
        };
      },
      onComplete: () => {
        if (pending?.kind === 'event') return receiptEvent(pending.e);
        if (pending?.kind === 'task') return receiptTask(pending.g);
        if ($('#s3').classList.contains('on')) { calPage.flashBBQ(); return; }
        const bbq = $$('.event', s1).find(e => e.textContent.includes('Neighborhood BBQ'));
        if (!bbq) return;
        bbq.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        bbq.classList.remove('flash'); void bbq.offsetWidth; bbq.classList.add('flash');
      },
    });
    $('[data-ask]', s1).addEventListener('click', () => { voices.nestie.mode = 'query'; voices.nestie.start(); });

    // ---- 语音回执：完成后先亮回执卡，再飞进它在界面上的位置 ----
    const ICON = {
      clock: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/><path d="M8 4.8V8l2.2 1.4"/></svg>',
      people: '<svg viewBox="0 0 16 16"><circle cx="6" cy="5.5" r="2.4"/><path d="M1.8 13.5c.4-2.4 2.1-3.7 4.2-3.7s3.8 1.3 4.2 3.7"/><path d="M10.6 3.4a2.3 2.3 0 0 1 0 4.4M12.2 9.9c1.2.5 2 1.7 2.1 3.6"/></svg>',
      cal: '<svg viewBox="0 0 16 16"><rect x="2.2" y="3" width="11.6" height="10.8" rx="2.4"/><path d="M2.2 6.6h11.6M5.4 1.8v2.4M10.6 1.8v2.4"/></svg>',
      coin: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/><path d="M8 5v6M6.2 6.6c0-.9.8-1.4 1.8-1.4s1.8.5 1.8 1.3c0 1.9-3.6 1.1-3.6 3 0 .8.8 1.4 1.8 1.4s1.8-.6 1.8-1.4"/></svg>',
    };
    const avs = ps => ps.map(p => `<div class="av st">${PEOPLE[p].av}</div>`);

    // Family 日历列表（今天）里按时间插入一行
    function insertFamilyToday(e, hidden) {
      const api = $('#s1 .cal')._api;
      if (!api.isToday()) api.goToday();
      const rows = [...api.list.children];
      const at = rows.find(r => { const s = $('.s', r)?.textContent || ''; return !s.startsWith('Before') && toMin(s.split(' · ')[0]) > e.start; })
        || rows.find(r => ($('.s', r)?.textContent || '').startsWith('Before'));
      const tmp = document.createElement('div');
      tmp.innerHTML = familyRow({ ...e, rings: e.who.length > 1 || e.who[0] === 'all' });
      const row = tmp.firstElementChild;
      if (hidden) row.classList.add('rc-awaiting');
      api.list.insertBefore(row, at || null);
      api.save();
      api.scroller.scrollTop = Math.max(0, row.offsetTop - api.scroller.clientHeight / 2 + row.offsetHeight / 2);
      return row;
    }

    function receiptEvent(e) {
      const onCal = $('#s3').classList.contains('on');
      flyReceipt(stage, {
        action: 'Event created',
        preview: familyRow({ ...e, rings: true }),
        details: [[ICON.clock, `Today · ${fmtTime(e.start)} – ${fmtTime(e.start + e.dur)}`], [ICON.people, labelOf(e.who)]],
        people: avs(peopleOf(e.who)),
        prepare: () => {
          CREATE.shift();
          TODAY_EVENTS.push(e);
          TODAY_EVENTS.sort((a, b) => a.start - b.start);
          const row = insertFamilyToday(e, !onCal);
          if (onCal) return calPage.place(e);
          calPage.render(0);
          return row;
        },
      });
    }

    function receiptTask(g) {
      flyReceipt(stage, {
        action: 'Task added',
        preview: `<div class="rc-task rc-task--emma"><span class="rc-check"></span><p>${g.name}</p>${coinChip(g.coins)}</div>`,
        details: [[ICON.cal, 'Today · Emma’s tasks'], [ICON.coin, `+${g.coins} coins when it’s done`]],
        people: avs(['emma']),
        prepare: () => claimForReceipt(g),
      });
    }

    // 滑 Tasks for today 时小鸟先让开（它压在列表右下角），停手 450ms 后回来；语音进行中不躲
    const taskList = $('.task', s1)?.closest('.scroll');
    let duckTimer = 0;
    taskList?.addEventListener('scroll', () => {
      if (voices.nestie.state !== 'idle') return;
      voices.nestie.host.classList.add('is-ducking');
      clearTimeout(duckTimer);
      duckTimer = setTimeout(() => voices.nestie.host.classList.remove('is-ducking'), 450);
    }, { passive: true });
  }

  // ---------- 鼠标拖拽滚动（触屏本来就能滑） ----------
  for (const el of $$('.scroll')) {
    let y0 = null, top0 = 0, moved = false;
    el.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.target.closest('button')) return;
      y0 = e.clientY; top0 = el.scrollTop; moved = false;
    });
    addEventListener('pointermove', e => {
      if (y0 === null) return;
      const dy = (e.clientY - y0) / (window.__stageScale || 1);
      if (Math.abs(dy) > 3) { moved = true; el.classList.add('dragging'); }
      el.scrollTop = top0 - dy;
    });
    addEventListener('pointerup', () => { y0 = null; el.classList.remove('dragging'); });
    el.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
  }

  // 横向的也一样：Up for grabs 用鼠标左右拖；拖时先关掉吸附，松手后再打开让它吸到最近一张
  for (const el of $$('.grabs')) {
    let x0 = null, left0 = 0, moved = false;
    el.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.target.closest('button')) return;
      x0 = e.clientX; left0 = el.scrollLeft; moved = false;
    });
    addEventListener('pointermove', e => {
      if (x0 === null) return;
      const dx = (e.clientX - x0) / (window.__stageScale || 1);
      if (Math.abs(dx) > 3 && !moved) { moved = true; el.classList.add('dragging'); el.style.scrollSnapType = 'none'; }
      if (moved) el.scrollLeft = left0 - dx;
    });
    addEventListener('pointerup', () => {
      if (x0 === null) return;
      x0 = null;
      el.classList.remove('dragging');
      if (!moved) return;
      const cards = $$('.grab', el), pad = 26;
      const near = cards.reduce((best, c) => Math.abs(c.offsetLeft - pad - el.scrollLeft) < Math.abs(best.offsetLeft - pad - el.scrollLeft) ? c : best, cards[0]);
      if (near) el.scrollTo({ left: near.offsetLeft - pad, behavior: 'smooth' });
      setTimeout(() => { el.style.scrollSnapType = ''; }, 400);
    });
    el.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
  }

  // ---------- + Add 新建弹窗（Calendar 事件 / Tasks 任务共用）：标题 + 几行选项，填了标题才能加 ----------
  const addSheet = (() => {
    const root = document.createElement('div');
    root.className = 'as-wrap';
    root.hidden = true;
    root.innerHTML = `<div class="as-card card st" role="dialog" aria-modal="true">
      <p class="as-title o18"></p>
      <input class="as-input" type="text" maxlength="40" autocomplete="off">
      <div class="as-rows"></div>
      <div class="as-actions"><button class="btn btn--neutral btn--sm" type="button" data-as-cancel>Cancel</button><button class="btn btn--primary add-btn" type="button" data-as-save disabled>Add</button></div>
    </div>`;
    stage.append(root);
    const input = $('.as-input', root), save = $('[data-as-save]', root);
    let rows = [], done = null;
    const close = () => { root.hidden = true; done = null; };
    function open(o) {
      $('.as-title', root).textContent = o.title;
      input.value = o.text || ''; input.placeholder = o.placeholder;
      save.textContent = o.saveLabel || 'Add';
      rows = o.rows.map(r => ({ ...r, value: r.multi ? new Set([].concat(r.value)) : r.value }));
      $('.as-rows', root).replaceChildren(...rows.map(r => {
        const el = document.createElement('div');
        el.className = 'as-row';
        el.innerHTML = `<p>${r.label}</p><div class="as-chips">${r.options.map(op =>
          `<button class="as-chip filter-chip" type="button" data-v="${op.v}">${op.html || ''}${op.label}</button>`).join('')}</div>`;
        const sync = () => $$('.as-chip', el).forEach(b => b.setAttribute('aria-pressed', r.multi ? r.value.has(b.dataset.v) : r.value === b.dataset.v));
        el.addEventListener('click', e => {
          const b = e.target.closest('.as-chip');
          if (!b) return;
          const v = b.dataset.v;
          if (!r.multi) r.value = v;
          else if (v === 'all') r.value = new Set(['all']);
          else {   // 选具体的人就去掉 Everyone；全取消了回到 Everyone
            r.value.delete('all');
            r.value.has(v) ? r.value.delete(v) : r.value.add(v);
            if (!r.value.size) r.value.add('all');
          }
          sync();
        });
        sync();
        return el;
      }));
      done = o.onSave;
      save.disabled = !input.value.trim();
      root.hidden = false;
      input.focus();
    }
    input.addEventListener('input', () => { save.disabled = !input.value.trim(); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !save.disabled) save.click(); });
    save.addEventListener('click', () => {
      const fn = done, vals = rows.map(r => r.multi ? [...r.value] : r.value);
      close();
      fn?.(input.value.trim(), ...vals);
    });
    $('[data-as-cancel]', root).addEventListener('click', close);
    root.addEventListener('click', e => { if (e.target === root) close(); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && !root.hidden) close(); });
    return { open };
  })();
  const personChip = p => ({ v: p, label: PEOPLE[p].name, html: `<span class="av st">${PEOPLE[p].av}</span>` });

  $('[data-cp-add]').addEventListener('click', () => {
    const { days, day } = calPage.addCtx();
    const TIMES = [480, 600, 720, 900, 1020, 1140];
    addSheet.open({
      title: 'New event', placeholder: 'What’s happening?',
      rows: [
        { label: 'Day', value: String(dayNum(day)), options: days.map(d => ({ v: String(dayNum(d)), label: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }) })) },
        { label: 'Time', value: '900', options: TIMES.map(t => ({ v: String(t), label: fmtTime(t) })) },
        { label: 'Who', multi: true, value: 'all', options: [{ v: 'all', label: 'Everyone' }, ...['emma', 'sam', 'mom', 'dad'].map(personChip)] },
      ],
      onSave(title, d, t, who) {
        const date = days.find(x => String(dayNum(x)) === d), e = { title, who, start: +t, dur: 60 };
        addFamilyEvent(date, e);
        calPage.showAdded(date, e);
      },
    });
  });
  $('[data-tk-add]').addEventListener('click', () => addSheet.open({
    title: 'New task', placeholder: 'What needs doing?',
    rows: [
      { label: 'For', value: 'emma', options: ['emma', 'sam', 'mom', 'dad'].map(personChip) },
      { label: 'When', value: 'Afternoon', options: ['Morning', 'Afternoon', 'Evening', 'Chores'].map(v => ({ v, label: v })) },
    ],
    onSave: (name, who, when) => tkPage.add(name, who, when),
  }));

  // ---------- 屏保（s6）：三张小鸟油画每 5s 交叉淡入（pad slideshowInterval），字一律白色；点一下回到之前的页面 ----------
  const ssEl = $('#s6'), ssImgs = $$('.ss-slides img', ssEl);
  let ssIdx = 0, ssTimer = 0;
  function ssGo(i) {
    ssIdx = i;
    ssImgs.forEach((im, k) => im.classList.toggle('on', k === i));
    clockTone(ssImgs[i]);
  }
  // 时钟颜色跟着背景走（用户换任何背景都成立）：读时钟背后那块区域的平均亮度和主色调，
  // 暗背景 → 提亮的玻璃白（带一点主色），亮背景 → 半透明白 + 亮边（带一点主色）。
  // file:// 下浏览器不让读本地图片像素，就退回图片上手写的 data-tone。
  const toneCache = new WeakMap();
  function analyze(img) {
    if (toneCache.has(img)) return toneCache.get(img);
    let res = null;
    try {
      const c = document.createElement('canvas'), w = 48, h = 24;
      c.width = w; c.height = h;
      const iw = img.naturalWidth, ih = img.naturalHeight;
      // 时钟在画面里的区域（frame 1280×800，object-fit: cover）：左下角 ≈ x 36–560、y 520–760
      const s = Math.max(1280 / iw, 800 / ih), ox = (iw * s - 1280) / 2, oy = (ih * s - 800) / 2;
      const sx = (36 + ox) / s, sy = (520 + oy) / s, sw = 524 / s, sh = 240 / s;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      const d = ctx.getImageData(0, 0, w, h).data;
      let r = 0, g = 0, b = 0;
      for (let k = 0; k < d.length; k += 4) { r += d[k]; g += d[k + 1]; b += d[k + 2]; }
      const n = d.length / 4; r /= n; g /= n; b /= n;
      const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      let hue = 0;
      if (mx !== mn) { const dd = mx - mn; hue = mx === r ? ((g - b) / dd) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; hue = Math.round(hue * 60 + 360) % 360; }
      const sat = mx ? (mx - mn) / mx : 0;
      res = { tone: L > 140 ? 'light' : 'dark', hue, sat: Math.min(sat, 0.5) };
    } catch { res = { tone: img.dataset.tone || 'dark', hue: 0, sat: 0 }; }
    toneCache.set(img, res);
    return res;
  }
  function clockTone(img) {
    const apply = () => {
      const { tone, hue, sat } = analyze(img), S = Math.round(sat * 100);
      ssEl.dataset.tone = tone;
      // 文字墨色（日期行、COMING UP）：同一色系，浅背景用深墨、深背景用白
      ssEl.style.setProperty('--ss-ink', tone === 'dark' ? '#fff' : `hsla(${hue}, ${Math.max(18, Math.round(S * .9))}%, 20%, 0.86)`);
      ssEl.style.setProperty('--ss-fill', tone === 'dark' ? `hsla(${hue}, ${S}%, 88%, 0.5)` : `hsla(${hue}, ${Math.max(18, Math.round(S * .9))}%, 42%, 0.62)`);
    };
    // 画面交叉淡入 600ms，数字样式在一半时切换，和画面同步
    const go = () => setTimeout(apply, 300);
    img.complete && img.naturalWidth ? go() : img.addEventListener('load', go, { once: true });
  }

  function screensaver(on) {
    clearInterval(ssTimer);
    if (!on) return;
    ssGo(0);
    ssTimer = setInterval(() => ssGo((ssIdx + 1) % ssImgs.length), 5000);
  }
  ssEl.addEventListener('click', () => show(lastHome));

  // ---------- 控制中心：从屏幕顶边往下拉出来（鼠标可点顶部小横条），上滑 / 点空白 / Esc 收起 ----------
  (() => {
    const ICON = {
      wifi: '<svg viewBox="0 0 20 20"><path d="M2.36 7.36A10.8 10.8 0 0 1 17.64 7.36M4.91 9.91A7.2 7.2 0 0 1 15.09 9.91M7.45 12.45A3.6 3.6 0 0 1 12.55 12.45"/><circle cx="10" cy="15" r="1.25" fill="currentColor" stroke="none"/></svg>',
      wifiOff: '<svg viewBox="0 0 20 20"><path d="M2.36 7.36A10.8 10.8 0 0 1 17.64 7.36M4.91 9.91A7.2 7.2 0 0 1 15.09 9.91M7.45 12.45A3.6 3.6 0 0 1 12.55 12.45M3 2.5l14 14.5"/><circle cx="10" cy="15" r="1.25" fill="currentColor" stroke="none"/></svg>',
      lock: '<svg viewBox="0 0 20 20"><rect x="4.5" y="9" width="11" height="8" rx="2" fill="currentColor" stroke="none"/><path d="M7 9V6.8a3 3 0 0 1 6 0V9"/></svg>',
      screenOff: '<svg viewBox="0 -960 960 960"><path fill="currentColor" stroke="none" d="M819-251q-12 12-28.5 12T763-250q-12-12-12-28.5t12-28.5q14-13 23.5-26t18.5-32q-85-8-161.5-44.5T506-507q-63-63-99-139t-43-160q-20 11-31 19t-28 24q-11 11-28 11t-28-11q-11-11-11-28t11-28q30-27 60.5-46t77.5-40q20-9 39.5 5t18.5 37q-3 85 27.5 162T563-564q60 60 138 91.5T862-444q23-1 36.5 18t5.5 41q-15 39-35.5 71T819-251ZM748-66l-81-80q-35 13-71 19.5t-72 6.5q-84 0-157.5-32t-128-86.5Q184-293 152-366.5T120-524q0-36 6.5-72t19.5-71l-78-78q-12-12-12-29t12-29q12-12 29-12t29 12l678 680q11 11 11 28t-11 28q-11 11-28 11.5T748-66ZM524-200q20 0 39.5-2.5T603-210L210-603q-5 21-7.5 40.5T200-524q0 135 94.5 229.5T524-200ZM406-407Zm116-116Z"/></svg>',   // Material Symbols bedtime_off（月亮划掉）
      restart: '<svg viewBox="0 0 20 20"><path d="M15.4 11.2A5.6 5.6 0 1 1 13.9 5.8M14.2 2.8v3.4h-3.4"/></svg>',
      vol: '<svg viewBox="0 0 20 20"><path d="M3.5 7.8h2.6L9.8 4.6v10.8l-3.7-3.2H3.5z" fill="currentColor" stroke="none"/><path d="M13 7.3a3.6 3.6 0 0 1 0 5.4M15.2 5.2a6.6 6.6 0 0 1 0 9.6"/></svg>',
      bright: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="3.6"/><path d="M10 6.4a3.6 3.6 0 0 1 0 7.2z" fill="currentColor"/><path d="M10 2.5v1.6M10 15.9v1.6M2.5 10h1.6M15.9 10h1.6M4.7 4.7l1.1 1.1M14.2 14.2l1.1 1.1M4.7 15.3l1.1-1.1M14.2 5.8l1.1-1.1"/></svg>',
      moon: '<svg viewBox="0 0 20 20"><path d="M15.6 12.6A6.4 6.4 0 0 1 7.4 4.4a6.4 6.4 0 1 0 8.2 8.2z" fill="currentColor" stroke="none"/></svg>',
      timer: '<svg viewBox="0 0 20 20"><circle cx="10" cy="11" r="5.8"/><path d="M10 8v3l2 1.4M8 2.8h4M15 5.6l1-1"/></svg>',
      alarm: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10.8" r="5.6"/><path d="M10 8v2.9l1.9 1.2M3.6 5.2l2.3-2M16.4 5.2l-2.3-2"/></svg>',
      micOff: '<svg viewBox="0 0 20 20"><rect x="7.6" y="2.8" width="4.8" height="9" rx="2.4"/><path d="M5 9.6a5 5 0 0 0 10 0M10 14.6v2.6"/><path class="slash-gap" d="M4 3.5l12 13"/><path d="M4 3.5l12 13"/></svg>',
      mic: '<svg viewBox="0 0 20 20"><rect x="7.6" y="2.8" width="4.8" height="9" rx="2.4"/><path d="M5 9.6a5 5 0 0 0 10 0M10 14.6v2.6"/></svg>',
      wake: '<svg viewBox="0 0 20 20"><path d="M4.5 13.5c1.5-1 2-2.6 2-4.5a3.5 3.5 0 0 1 7 0c0 1.9.5 3.5 2 4.5zM8.3 15.6a1.8 1.8 0 0 0 3.4 0"/><path class="slash-gap" d="M4.5 4l11 12"/><path d="M4.5 4l11 12"/></svg>',
      wakeOn: '<svg viewBox="0 0 20 20"><path d="M4.5 13.5c1.5-1 2-2.6 2-4.5a3.5 3.5 0 0 1 7 0c0 1.9.5 3.5 2 4.5zM8.3 15.6a1.8 1.8 0 0 0 3.4 0"/></svg>',
      open: '<svg viewBox="0 0 20 20"><path d="M7 5h8v8M15 5 5 15"/></svg>',
    };
    const TIPS = [
      ['Calendar', '“Hey Nestie, add dinner with Mom at 7 tonight”', '<svg viewBox="0 0 16 16"><rect x="2.5" y="3.5" width="11" height="10" rx="2"/><path d="M2.5 7h11M5.5 2v3M10.5 2v3"/></svg>'],
      ['Tasks', '“Hey Nestie, what’s left on Sam’s list?”', '<svg viewBox="0 0 16 16"><rect x="2.5" y="2.5" width="11" height="11" rx="2.5"/><path d="M5.5 8l1.8 1.8L10.8 6"/></svg>'],
      ['Shopping', '“Hey Nestie, add milk and eggs to the list”', '<svg viewBox="0 0 16 16"><path d="M2 3h1.8l1.6 7.2h7l1.4-5H4.6"/><circle cx="6.2" cy="13" r=".9"/><circle cx="11.4" cy="13" r=".9"/></svg>'],
      ['Rewards', '“Hey Nestie, how many coins does Emma have?”', '<svg viewBox="0 0 16 16"><rect x="2.5" y="6" width="11" height="7.5" rx="1.5"/><path d="M2 6h12M8 6v7.5M8 6C6.5 3 4 3.3 4.6 4.8 5 5.8 8 6 8 6zm0 0c1.5-3 4-2.7 3.4-1.2C11 5.8 8 6 8 6z"/></svg>'],
      ['Timer', '“Hey Nestie, set a timer for 10 minutes”', '<svg viewBox="0 0 16 16"><circle cx="8" cy="8.8" r="5"/><path d="M8 6.3v2.5l1.6 1M6.5 2.5h3"/></svg>'],
      ['Meals', '“Hey Nestie, what’s for dinner tonight?”', '<svg viewBox="0 0 16 16"><path d="M4 2.5v3.2a1.5 1.5 0 0 0 3 0V2.5M5.5 2.5v11M11.5 13.5V2.5C10.3 3 9.6 4.3 9.6 6.2v2.3h1.9"/></svg>'],
    ];
    const st = { wifi: true, night: true, mic: false, wake: false, vol: 0.52, bright: 0.8, tip: 0, timer: 0, left: 0 };

    const cc = document.createElement('div');
    cc.className = 'cc';
    cc.innerHTML = `<div class="cc-scrim"></div>
      <div class="cc-panel" role="dialog" aria-label="Control center">
        <button class="cc-tile cc-wide" data-k="wifi" type="button"><span class="cc-ico">${ICON.wifi}</span><span class="cc-txt"><b>Wi-Fi</b><i></i></span></button>
        <div class="cc-tile cc-wide cc-off ga-lock"><span class="cc-ico">${ICON.lock}</span><span class="cc-txt"><b>Parents Lock</b><i>Set up in the Nestify app</i></span></div>
        <div class="cc-pair ga-power">
          <button class="cc-tile cc-small" data-k="screenOff" type="button">${ICON.screenOff}<b>Screen Off</b></button>
          <button class="cc-tile cc-small" data-k="restart" type="button">${ICON.restart}<b>Restart</b></button>
        </div>
        <div class="cc-tile cc-sliders ga-sliders">
          <label><span class="cc-lab">${ICON.vol}Volume</span><input type="range" min="0" max="1" step="0.01" data-s="vol"></label>
          <label><span class="cc-lab">${ICON.bright}Brightness</span><input type="range" min="0" max="1" step="0.01" data-s="bright"></label>
        </div>
        <button class="cc-tile cc-wide ga-night" data-k="night" type="button"><span class="cc-ico">${ICON.moon}</span><span class="cc-txt"><b>Night Mode</b><i></i></span></button>
        <div class="cc-tile cc-wide ga-timer"><span class="cc-ico">${ICON.timer}</span><span class="cc-txt"><b data-timer-t>Timer</b><i data-timer-s>Start a timer</i></span></div>
        <div class="cc-trio ga-mins">${[5, 10, 15].map(m => `<button class="cc-tile cc-min" data-min="${m}" type="button"><b>${m}</b> min</button>`).join('')}</div>
        <div class="cc-tile cc-wide ga-alarm"><span class="cc-ico">${ICON.alarm}</span><span class="cc-txt"><b>Alarm</b><i>Set an alarm</i></span></div>
        <div class="cc-tile cc-tips ga-tips">
          <div class="cc-tips-head"><b>How to use Nestie</b><span class="cc-open">${ICON.open}</span></div>
          <p class="cc-quote"></p>
          <div class="cc-tips-foot"><span class="cc-cat"></span><span class="cc-dots">${TIPS.map(() => '<i></i>').join('')}</span></div>
        </div>
        <div class="cc-pair ga-mic">
          <button class="cc-tile cc-wide cc-half" data-k="wake" type="button"><span class="cc-ico"></span><span class="cc-txt"><b>“Hey Nestie”</b><i></i></span></button>
          <button class="cc-tile cc-wide cc-half" data-k="mic" type="button"><span class="cc-ico"></span><span class="cc-txt"><b>Microphone</b><i></i></span></button>
        </div>
      </div>
      <button class="cc-grab" type="button" aria-label="Open control center"></button>
      <div class="cc-black" hidden></div>`;
    stage.append(cc);
    const panel = $('.cc-panel', cc), scrim = $('.cc-scrim', cc), black = $('.cc-black', cc);
    $('.cc-tile[data-k="wifi"]', cc).style.gridArea = 'wifi';

    function paint() {
      const set = (k, on, sub) => { const b = $(`[data-k="${k}"]`, cc); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); if (sub != null) $('.cc-txt i', b).textContent = sub; };
      set('wifi', st.wifi, st.wifi ? 'Connected' : 'Off');
      $('[data-k="wifi"] .cc-ico', cc).innerHTML = st.wifi ? ICON.wifi : ICON.wifiOff;
      set('night', st.night, st.night ? 'Scheduled 23:00 – 07:00' : 'Off');
      set('mic', st.mic, st.mic ? 'On' : 'Muted');
      $('[data-k="mic"] .cc-ico', cc).innerHTML = st.mic ? ICON.mic : ICON.micOff;
      // 麦克风关着时唤醒词也没法用
      const wakeOn = st.mic && st.wake, wakeBtn = $('[data-k="wake"]', cc);
      set('wake', wakeOn, !st.mic ? 'Mic is off' : st.wake ? 'Listening' : 'Off');
      wakeBtn.classList.toggle('cc-off', !st.mic);
      $('.cc-ico', wakeBtn).innerHTML = wakeOn ? ICON.wakeOn : ICON.wake;
      $$('.cc-dots i', cc).forEach((d, i) => d.classList.toggle('on', i === st.tip));
      $('.cc-cat', cc).innerHTML = TIPS[st.tip][2] + TIPS[st.tip][0];
      const q = $('.cc-quote', cc);
      if (q.dataset.tip !== String(st.tip)) {
        q.dataset.tip = st.tip;
        // 统一两行："Hey Nestie," 独占第一行，指令在第二行
        const [, cmd] = TIPS[st.tip][1].match(/^“Hey Nestie, (.*)$/);
        q.innerHTML = `<span class="cc-wake">Hey Nestie,</span><span>${cmd.replace(/”$/, '')}</span>`;
        q.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
      }
      $$('.cc-min', cc).forEach(b => b.classList.toggle('on', +b.dataset.min === st.timer));
      for (const r of $$('input[type=range]', cc)) { r.value = st[r.dataset.s]; r.style.setProperty('--v', st[r.dataset.s] * 100 + '%'); }
      // 亮度真的作用在画面上（不压暗控制中心自己）；默认 0.8 = 原样，往下变暗、往上略亮
      const lv = st.bright >= 0.8 ? 1 + (st.bright - 0.8) * 0.4 : 0.4 + 0.6 * st.bright / 0.8;
      $$('.frame', stage).forEach(f => { f.style.filter = Math.abs(lv - 1) < 0.005 ? '' : `brightness(${lv.toFixed(3)})`; });
    }

    for (const b of $$('[data-k]', cc)) b.addEventListener('click', () => {
      const k = b.dataset.k;
      if (k === 'wake') { if (st.mic) st.wake = !st.wake; }
      else if (k === 'screenOff') { close(); setTimeout(() => { black.hidden = false; black.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: 'ease-out' }); }, 220); return; }
      else if (k === 'restart') { close(); black.hidden = false; black.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: 'ease-in', fill: 'forwards' }).onfinish = () => location.reload(); return; }
      else st[k] = !st[k];
      paint();
    });
    black.addEventListener('click', () => { black.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).onfinish = () => { black.hidden = true; }; });
    for (const r of $$('input[type=range]', cc)) r.addEventListener('input', () => { st[r.dataset.s] = +r.value; paint(); });

    // 计时器：点 5/10/15 开始倒计时，再点同一个取消
    let tick = 0;
    const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    function timerText() {
      $('[data-timer-t]', cc).textContent = st.timer ? fmt(st.left) : 'Timer';
      $('[data-timer-s]', cc).textContent = st.timer ? `${st.timer} min timer running` : 'Start a timer';
    }
    for (const b of $$('.cc-min', cc)) b.addEventListener('click', () => {
      clearInterval(tick);
      const m = +b.dataset.min;
      st.timer = st.timer === m ? 0 : m;
      st.left = st.timer * 60;
      if (st.timer) tick = setInterval(() => { st.left = Math.max(0, st.left - 1); if (!st.left) { clearInterval(tick); st.timer = 0; paint(); } timerText(); }, 1000);
      timerText(); paint();
    });

    // 小贴士轮播：点一下下一条，打开时每 5 秒自动换
    let tipTimer = 0;
    const nextTip = () => { st.tip = (st.tip + 1) % TIPS.length; paint(); };
    $('.cc-tips', cc).addEventListener('click', () => { nextTip(); clearInterval(tipTimer); tipTimer = setInterval(nextTip, 5000); });

    // 拖拽：从顶边往下拉打开，在面板上往上推收起
    const H = () => panel.offsetHeight + 24;
    let open = false, drag = null;
    const place = (y, animate) => {
      const p = Math.max(0, Math.min(1, y / H()));
      panel.style.transition = scrim.style.transition = animate ? '' : 'none';
      panel.style.transform = `translateY(${(p - 1) * H()}px)`;
      scrim.style.opacity = p;
      cc.classList.toggle('is-live', p > 0);
    };
    function show(on) {
      open = on;
      place(on ? H() : 0, true);
      cc.classList.toggle('is-open', on);
      clearInterval(tipTimer);
      if (on) { paint(); tipTimer = setInterval(nextTip, 5000); }
    }
    function close() { show(false); }
    const k = () => window.__stageScale || 1;
    const startDrag = (e, from) => { drag = { y0: e.clientY, from, t0: performance.now(), moved: false }; };
    stage.addEventListener('pointerdown', e => {
      if (open) { if (e.target.closest('.cc-panel') && !e.target.closest('input, button, .cc-tips')) startDrag(e, H()); return; }
      const r = stage.getBoundingClientRect();
      if ((e.clientY - r.top) / k() < 26) startDrag(e, 0);
    });
    addEventListener('pointermove', e => {
      if (!drag) return;
      const dy = (e.clientY - drag.y0) / k();
      if (Math.abs(dy) > 4) drag.moved = true;
      if (drag.moved) place(drag.from + dy, false);
    });
    addEventListener('pointerup', e => {
      if (!drag) return;
      const dy = (e.clientY - drag.y0) / k(), v = dy / Math.max(1, performance.now() - drag.t0);
      const wasMoved = drag.moved, from = drag.from;
      drag = null;
      if (!wasMoved) { if (!from) show(true); return; }
      show(v > 0.4 || (v > -0.4 && from + dy > H() * 0.45));
    });
    scrim.addEventListener('click', close);
    // 鼠标/手指点横条已经由上面的顶边手势处理，这里只接键盘（Enter/空格）触发的点击
    $('.cc-grab', cc).addEventListener('click', e => { if (e.detail === 0) show(!open); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && open) close(); });
    paint();
    place(0, false);
  })();

  paintIdentity(document);
  window.__proto = { state, renderBalance, rwPage, voices, calPage, tkPage, show, $, $$ };
  show(['#s2', '#s3', '#s4', '#s5', '#s6', '#s7', '#s8'].includes(location.hash) ? location.hash.slice(1) : 's1');
})();
