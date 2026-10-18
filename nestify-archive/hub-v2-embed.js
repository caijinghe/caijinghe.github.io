/* Family Hub 屏幕里跑的新版 pad UI 的嵌入层（画布尺寸见 hub-v2-embed.css 头注）。

   hub.js 和这里是同源的，所以除了 postMessage 的 token 之外，hub.js 还直接调
   window.__hub：
     configure({ cal, tasks })  飞入卡片的数据（唯一真相在 hub.js 的 calCards / taskCards），
                                这里据此把它们的「落地版本」预先插进日历 / 任务页占位
     flyRects(kind)             每张飞入卡片落点的矩形（iframe 坐标，1920×1200）+ 背景，
                                hub.js 乘上 padS 就是屏幕坐标——落点是量出来的，不再写死
     birdRect()                 Nestie 小鸟的矩形（hub.js 在飞入层上给它挖洞）

   token 是「状态描述」：hub.js 加载后会重复发好几次同一个 token，所以每个 token
   的处理必须幂等，同一个 token 第二次到达什么都不做。 */
(() => {
  const P = window.__proto;
  if (!P) return;
  const { $, $$, state } = P;
  const html = document.documentElement;
  const K = 1.5;   // 画布 1280×800 → iframe 1920×1200

  Object.defineProperty(window, '__stageScale', { get: () => K, set() {}, configurable: true });

  const nestie = P.voices.nestie;

  /* 颜色不在这里写：落点元素只标 data-who，由 proto 自己的 paintIdentity（app.js）按
     tokens.css 的成员色上色——和 proto 里的日历事件同一套实色 + 角落光晕。 */
  const AV = {
    emma: 'assets/profile/avatar.jpg', sam: 'assets/sam.jpg', mom: 'assets/4a680.png', dad: 'assets/7903a.png',
  };
  const peopleOf = who => who[0] === 'all' ? ['emma', 'sam', 'mom', 'dad'] : who;
  const fmtTime = m => `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, '0')} ${m < 720 ? 'AM' : 'PM'}`;
  const H0 = 7, PX = 56;   // calPage：7:00 起，每小时 56px

  let cfg = { cal: [], tasks: [] };

  /* ---------- 日历：飞入事件的落地版本 ----------
     和 calPage.build() 画的 .cp-ev 同一套几何和配色，只是带 data-fly，fly 阶段隐身占位，
     play 阶段直接现身——hub.js 那边的飞行卡片在同一帧把自己切掉，两张一模一样，看不出交接。
     日历翻周 / 换视图会整格重建，所以由 MutationObserver 保证随时补回来。 */
  const calGrid = $('#s3 .cp-grid');
  function injectCal() {
    const g = $('.cp-grid-in:last-child', calGrid);
    if (!g || g.classList.contains('day-view') || $('[data-fly]', g)) return;
    const cols = $$('.cp-col', g), adcs = $$('.cp-adc', g);
    cfg.cal.forEach((e, i) => {
      if (e.allDay) {
        const ad = document.createElement('div');
        ad.className = 'cp-ad';
        ad.dataset.fly = i;
        ad.dataset.who = peopleOf(e.who);
        ad.textContent = e.title;
        adcs[e.day]?.append(ad);
        return;
      }
      const top = (e.start - H0 * 60) / 60 * PX, h = Math.max(22, e.dur / 60 * PX - 3);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cp-ev' + (h < 38 ? ' short' : h < 56 ? ' mid' : '');
      b.dataset.fly = i;
      b.dataset.who = peopleOf(e.who);
      b.style.cssText = `z-index:5;top:${top + 1}px;height:${h}px;left:3px;width:calc(100% - 6px)`;
      b.innerHTML = `<p class="t">${e.title}</p>${h >= 38 ? `<p class="s">${fmtTime(e.start)} – ${fmtTime(e.start + e.dur)}</p>` : ''}`
        + (h >= 54 ? `<div class="avs">${peopleOf(e.who).map(p => `<div class="av st"><img class="fill cover" src="${AV[p]}" alt=""></div>`).join('')}</div>` : '');
      cols[e.day]?.append(b);
    });
  }
  new MutationObserver(() => { injectCal(); layoutChanged(); }).observe(calGrid, { childList: true });

  /* ---------- 任务页：新任务的落地版本 ----------
     tkPage.render() 每次进页面都整列重建，同样靠 MutationObserver 补回。行的结构照抄
     tkPage 的 row()：新版每人一条连续列表，不分时段、行里没有图标，金币是行尾的「+N」。 */
  const tkCols = $('#s4 .tk-cols');
  function injectTasks() {
    cfg.tasks.forEach((t, i) => {
      const col = $(`.tk-col[data-m="${t.m}"]`, tkCols);
      if (!col || $(`[data-fly="${i}"]`, col)) return;
      const ul = $('.tk-list ul', col);
      if (!ul) return;
      const li = document.createElement('li');
      li.className = 'check-row tk-row st';
      li.dataset.fly = i;
      li.innerHTML = `<button class="check" type="button" aria-pressed="false"><svg viewBox="0 0 16 16"><path d="M3.5 8.3l3 3 6-6.4"/></svg></button><p>${t.name}</p>`
        + (t.coins ? `<span class="tk-coins">+${t.coins}</span>` : '');
      ul.append(li);
    });
  }
  new MutationObserver(() => { injectTasks(); layoutChanged(); }).observe(tkCols, { childList: true });

  /* ---------- Rewards：idle 永远是「Stay up 30 min later 刚好攒够、还没兑」 ----------
     新版孩子页 My goal 里只有 Switch / Stay up / Milkshake / Road trip 四个（state 里的
     Ice Cream 已经没有卡片了），而起始 22 币一个都换不了——所以这一拍先把余额补到
     刚好够 Stay up（25），Redeem 亮起来；play 真的点它（扣币、彩纸、庆祝卡都是 app.js
     自己的）。读者往回滚再进来时还原成「刚好够」，离开这一拍还原成起始余额。 */
  const PICK = state.rewards.find(r => r.id === 'stay-up');
  const BAL0 = state.balance;
  function resetRewards(bal) {
    $$('.celebrate').forEach(el => el.remove());
    if (!PICK) return;
    PICK.done = false;
    state.balance = bal;
    state.history = state.history.filter(h => h.date !== 'Today');
    P.renderBalance();
    P.rwPage.renderHistory();
  }
  function playRewards() {
    $('#s2 .reward[data-id="stay-up"] .btn')?.click();
  }

  /* ---------- Meals：两道菜被收藏，飞进右边 My collection 的顶上 ----------
     Meals 页在 app.js 里是纯静态的，这一拍的动作完全是嵌入层自己演的。 */
  const s7 = $('#s7');
  const SAVE = ['Chicken Congee', 'Shakshuka'];
  let mealTimers = [];
  function resetMeals() {
    mealTimers.forEach(clearTimeout);
    mealTimers = [];
    $$('[data-fly-meal]', s7).forEach(el => el.remove());
    $$('.ml-act[data-was]', s7).forEach(el => { el.classList.remove('saved'); delete el.dataset.was; });
    s7.getAnimations({ subtree: true }).forEach(a => a.cancel());
  }
  function playMeals() {
    resetMeals();
    const list = $('[data-ml-list]', s7);
    const cards = $$('.ml-card', s7);
    const k = K;   // 屏幕 px → 画布 px
    SAVE.forEach((name, n) => {
      const card = cards.find(c => $('.ml-name', c).textContent === name);
      if (!card) return;
      mealTimers.push(setTimeout(() => {
        const act = $('.ml-act', card);
        act.dataset.was = '';
        act.classList.add('saved');
        act.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }],
          { duration: 360, easing: 'cubic-bezier(0.2, 1.5, 0.45, 1)' });

        const img = $('img', card);
        const row = document.createElement('li');
        row.className = 'ml-row st';
        row.dataset.flyMeal = '';
        row.innerHTML = `<img class="ml-thumb" src="${img.getAttribute('src')}" alt=""><p>${name}</p>`;
        list.prepend(row);
        list.scrollTop = 0;
        const rowH = row.offsetHeight + 8;
        // 其余行让位：从原位置滑下去
        [...list.children].slice(1).forEach(el => el.animate(
          [{ transform: `translateY(${-rowH}px)` }, { transform: 'none' }],
          { duration: 520, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' }));
        // 菜图从卡片上飞到缩略图的位置
        const st = $('#stage').getBoundingClientRect();
        const a = img.getBoundingClientRect(), b = $('.ml-thumb', row).getBoundingClientRect();
        const ghost = document.createElement('img');
        ghost.src = img.getAttribute('src');
        ghost.dataset.flyMeal = '';
        ghost.style.cssText = `position:absolute;z-index:40;left:${(b.left - st.left) / k}px;top:${(b.top - st.top) / k}px;width:${b.width / k}px;height:${b.height / k}px;border-radius:10px;object-fit:cover;pointer-events:none;box-shadow:0 10px 24px rgba(52,54,47,.18)`;
        $('#s7').append(ghost);
        const sx = a.width / b.width, sy = a.height / b.height;
        const dx = (a.left - b.left) / k, dy = (a.top - b.top) / k;
        $('.ml-thumb', row).style.opacity = '0';
        row.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 320, fill: 'backwards' });
        ghost.animate([
          { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, transformOrigin: '0 0', borderRadius: '14px' },
          { transform: 'none', transformOrigin: '0 0', borderRadius: '10px' },
        ], { duration: 720, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' }).onfinish = () => {
          $('.ml-thumb', row).style.opacity = '';
          ghost.remove();
        };
      }, 450 + n * 900));
    });
  }

  /* ---------- token ---------- */
  const TAB = { home: 's1', calendar: 's3', lists: 's4', rewards: 's2', meals: 's7' };
  let cur = '';
  function apply(token) {
    if (token === cur) return;
    const [tab, phase] = token.split('|');
    const id = TAB[tab];
    if (!id) return;
    const prevTab = cur.split('|')[0];
    cur = token;
    html.dataset.hubTab = tab;
    html.dataset.hubPhase = phase;

    if (!$('#' + id).classList.contains('on')) P.show(id);
    injectCal();
    injectTasks();

    // 小鸟的对话只属于 Home 那一拍；换走就收掉，不然气泡会跟到日历上
    if (tab !== 'home' && nestie && nestie.state !== 'idle') nestie.go('idle');
    if (tab !== 'meals') resetMeals();
    if (tab === 'rewards' && phase === 'idle') resetRewards(Math.max(BAL0, PICK ? PICK.cost : 0));
    if (tab === 'rewards' && phase === 'play') playRewards();
    if (tab === 'meals' && phase === 'play') playMeals();
    if (tab === 'home' && phase === 'think' && nestie && nestie.state === 'idle') {
      nestie.mode = 'query';
      nestie.start();
    }
    if (prevTab === 'rewards' && tab !== 'rewards') resetRewards(BAL0);
    layoutChanged();
  }
  /* 换页 / 插好占位之后，落点才量得到——告诉 hub.js 重新摆一次卡片。两帧之后再发：
     show() 切 frame、tkPage 重建列都要等布局落定。 */
  let layoutRaf = 0;
  function layoutChanged() {
    cancelAnimationFrame(layoutRaf);
    layoutRaf = requestAnimationFrame(() => {
      layoutRaf = requestAnimationFrame(() => { try { parent.postMessage('hub:layout', '*'); } catch (e) {} });
    });
  }
  addEventListener('message', e => { if (typeof e.data === 'string' && e.data.includes('|')) apply(e.data); });

  /* ---------- 给 hub.js 量落点 ---------- */
  function rectOf(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width) return null;
    // 背景：日历落点取 proto 算好的 --ev-bg（实色 + 角落光晕，光晕是百分比尺寸，缩放不变形）
    const cs = getComputedStyle(el);
    return { x: r.left, y: r.top, w: r.width, h: r.height, bg: cs.getPropertyValue('--ev-bg').trim() || cs.backgroundImage };
  }
  window.__hub = {
    configure(c) {
      cfg = { cal: c.cal || [], tasks: c.tasks || [] };
      $$('[data-fly]').forEach(el => el.remove());
      injectCal();
      injectTasks();
    },
    flyRects(kind) {
      if (kind === 'calendar') return cfg.cal.map((_, i) => rectOf($(`#s3 .cp-grid-in:last-child [data-fly="${i}"]`)));
      if (kind === 'lists') return cfg.tasks.map((_, i) => rectOf($(`#s4 [data-fly="${i}"]`)));
      return [];
    },
    birdRect: () => nestie ? rectOf(nestie.host) : null,
    apply,
  };
})();
