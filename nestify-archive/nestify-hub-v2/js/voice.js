// Nestie 语音交互：Rive 小鸟 + 边缘光 + 出生动画 + 用户/小鸟气泡。
// 移植自 cai_website 2026/js/nestify-voice-{bird,glow}.js 与 nestify-birth.js；
// 会话流程照 pad（agent_interaction）：聆听（边缘呼吸，实时转写）→ 工作中（边缘转圈，
// "Working on it" → 工具状态）→ 说话（一句一句换）→ 完成停 1s → 空闲。尺寸按 1920×1080 ×0.667 换算。
(() => {
  const SHADERS = window.NESTIE_SHADERS;
  const RIV = window.NESTIE_RIV;
  const COLORS = [[56, 212, 230], [91, 156, 246], [241, 79, 206], [244, 209, 78]];
  const K = 1.5; // 画布 1280×800 → shader 坐标 1920×1200
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const clampMs = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

  const clamp = x => Math.max(0, Math.min(1, x));
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };

  function program(gl, frag) {
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const pr = gl.createProgram();
    gl.attachShader(pr, compile(gl.VERTEX_SHADER, 'attribute vec2 position;varying vec2 vUV;void main(){vUV=position*.5+.5;gl_Position=vec4(position,0.,1.);}'));
    gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(pr);
    gl.useProgram(pr);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(pr, 'position');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    const cache = new Map();
    const loc = n => { if (!cache.has(n)) cache.set(n, gl.getUniformLocation(pr, n)); return cache.get(n); };
    return {
      f: (n, v) => gl.uniform1f(loc(n), v),
      v2: (n, x, y) => gl.uniform2f(loc(n), x, y),
      v3: (n, c) => gl.uniform3f(loc(n), c[0] / 255, c[1] / 255, c[2] / 255),
      dispose() { gl.deleteBuffer(buf); gl.deleteProgram(pr); },
    };
  }

  function sizeCanvas(gl, canvas) {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  }

  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0)).buffer;

  class Nestie {
    /**
     * @param {HTMLElement} frame 1280×800 画面
     * @param {object} o
     *   center  小鸟中心（画面坐标）
     *   resident 小鸟常驻（否则每次唤起时出生、结束后离开）
     *   reply   说话气泡两行文字
     *   onComplete 完成态回调（投递动画等）
     *   onHear  用户开口 / 停止说话（灵动岛用）
     */
    constructor(frame, o) {
      this.frame = frame;
      this.o = Object.assign({ center: [1201, 728], size: 117, resident: false, reply: ['', ''] }, o);
      this.state = 'idle';
      this.shown = false;

      const layer = document.createElement('div');
      layer.className = 'voice-layer';
      frame.append(layer);
      this.layer = layer;

      this.glowCanvas = document.createElement('canvas');
      this.glowCanvas.className = 'voice-glow';
      layer.append(this.glowCanvas);

      const [cx, cy] = this.o.center, s = this.o.size;
      const host = document.createElement('button');
      host.className = 'nestie';
      host.type = 'button';
      host.setAttribute('aria-label', 'Talk to Nestie');
      host.style.cssText = `left:${cx - s / 2}px;top:${cy - s / 2}px;width:${s}px;height:${s}px`;
      host.innerHTML = '<canvas class="nestie-blink"></canvas><canvas class="nestie-speak"></canvas>';
      layer.append(host);
      this.host = host;
      host.addEventListener('click', () => this.state === 'listening' ? this.go('thinking') : this.start());

      // 用户气泡：屏幕下方居中，标题行（Listening + 竖条 / Working on it + 圆点）+ 转写
      this.ear = document.createElement('div');
      this.ear.className = 'vb vb-user';
      this.ear.innerHTML = '<div class="vb-head"><span class="vb-label">Listening</span><span class="vb-ind"><i class="vb-bars"><b></b><b></b><b></b><b></b><b></b></i><i class="vb-dots"><b></b><b></b><b></b></i></span></div><p class="vb-text"></p>';
      // 小鸟气泡：右沿在小鸟左边 16px，底边和用户气泡同高，往上长
      this.say = document.createElement('div');
      this.say.className = 'vb vb-bird';
      this.say.style.right = `${frame.offsetWidth - (cx - s / 2) + 16}px`;
      this.say.innerHTML = '<p class="vb-text"></p>';
      layer.append(this.ear, this.say);
      this.timers = [];

      this.initGlow();
      this.initRive();
      if (this.o.resident) this.appear(false);
    }

    initGlow() {
      const gl = this.glowCanvas.getContext('webgl', { alpha: true, premultipliedAlpha: true });
      if (!gl) return;
      this.gl = gl;
      this.u = program(gl, SHADERS.edge);
      this.u.v2('uSize', 1920, 1200);
      COLORS.forEach((c, i) => this.u.v3('uEdgeC' + i, c));
      this.time = 0; this.gate = 0; this.thinking = 0; this.raf = 0; this.last = 0;
    }

    initRive() {
      if (!window.rive) return;
      const [blinkC, speakC] = this.host.querySelectorAll('canvas');
      const layout = new rive.Layout({ fit: rive.Fit.Contain, alignment: rive.Alignment.Center });
      const make = (key, canvas) => new rive.Rive({
        buffer: b64(RIV[key]), canvas, autoplay: true, layout,
        onLoad: () => { this.fit(); this.syncRive(); },
      });
      this.blink = make('blink', blinkC);
      this.speak = make('speak', speakC);
      new ResizeObserver(() => this.fit()).observe(this.host);
    }

    // Rive 按 canvas 像素尺寸渲染：用布局宽度 × 舞台缩放 × DPR，留 1.5 倍余量避免放大发糊
    fit() {
      const scale = window.__stageScale || 1;
      const px = Math.round(this.o.size * scale * Math.max(devicePixelRatio || 1, 2) * 1.5);
      for (const [r, c] of [[this.blink, this.host.children[0]], [this.speak, this.host.children[1]]]) {
        if (!r || !px || c.width === px) continue;
        c.width = c.height = px;
        r.resizeToCanvas();
        r.drawFrame?.();
      }
    }

    syncRive() {
      const visible = !this.frame.classList.contains('frame') || this.frame.classList.contains('on');
      const active = this.shown && visible && !document.hidden && !reduce.matches;
      const talking = this.state === 'speaking';
      if (this.blink) active && !talking ? this.blink.play() : this.blink.pause();
      if (this.speak) active && talking ? this.speak.play() : this.speak.pause();
    }

    // 出生：彩色 metaball 汇聚成小鸟（birth.frag），随后小鸟弹出
    appear(withBirth = true) {
      this.shown = true;
      this.host.classList.remove('is-leaving');
      this.host.classList.add('is-shown');
      if (withBirth && !reduce.matches) {
        this.host.classList.add('is-entering');
        this.birth();
        setTimeout(() => this.host.classList.remove('is-entering'), 1400);
      }
      this.syncRive();
    }

    leave() {
      this.shown = false;
      this.host.classList.add('is-leaving');
      setTimeout(() => { if (!this.shown) this.host.classList.remove('is-shown', 'is-leaving'); this.syncRive(); }, 320);
    }

    birth() {
      const canvas = document.createElement('canvas');
      canvas.className = 'voice-birth';
      this.layer.append(canvas);
      const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true });
      if (!gl) { canvas.remove(); return; }
      const u = program(gl, SHADERS.birth);
      const center = [this.o.center[0] * K, this.o.center[1] * K];
      u.v2('uSize', 1920, 1200);
      u.v2('uCorePos', ...center);
      const balls = Array.from({ length: 8 }, (_, i) => {
        const a = i * Math.PI / 4, sr = 117 + Math.random() * 108, ta = Math.random() * Math.PI * 2, to = 16 + Math.random() * 28;
        return {
          start: [center[0] + Math.cos(a) * sr, center[1] + Math.sin(a) * sr],
          end: [center[0] + Math.cos(ta) * to, center[1] + Math.sin(ta) * to],
          r: 20 + Math.random() * 22, col: COLORS[i % 4],
        };
      });
      const t0 = performance.now();
      const draw = now => {
        const p = (now - t0) / 900;
        if (p >= 1) { u.dispose(); canvas.remove(); return; }
        sizeCanvas(gl, canvas);
        const conv = smooth((p - .04) / .56), merged = smooth((p - .58) / .22), fade = 1 - smooth((p - .86) / .14), appear = smooth(p / .12);
        u.f('uCoreR', 125 * (1 - .7 * conv) * fade);
        u.f('uSoft', merged);
        u.f('uTail', 1.3 * Math.max(0, 4 * conv * (1 - conv)));
        u.f('uBlue', smooth((conv - .45) / .45));
        balls.forEach((b, i) => {
          u.v2('uP' + i, b.start[0] + (b.end[0] - b.start[0]) * conv, b.start[1] + (b.end[1] - b.start[1]) * conv);
          u.f('uR' + i, b.r * (.42 + .4 * merged) * appear * fade);
          u.v3('uC' + i, b.col);
          const dx = b.end[0] - b.start[0], dy = b.end[1] - b.start[1], d = Math.hypot(dx, dy);
          u.v2('uV' + i, dx / d, dy / d);
        });
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);
    }

    // o.reply() → { heard, status: [进行中, 完成], say: [一句, 一句…] }；老的两行数组也认
    start() {
      if (this.state !== 'idle') return;
      const r = typeof this.o.reply === 'function' ? this.o.reply() : this.o.reply;
      this.script = Array.isArray(r) ? { heard: '', status: [], say: [r.join(' ')] } : { status: [], ...r };
      if (!this.shown) {
        this.appear(true);
        this.timer = setTimeout(() => this.go('listening'), reduce.matches ? 0 : 1300);
      } else {
        this.go('listening');
      }
    }

    after(ms, fn) { this.timers.push(setTimeout(fn, ms)); }

    label(text) {
      const el = this.ear.querySelector('.vb-label');
      if (el.textContent === text) return;
      el.textContent = text;
      el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap');
    }

    // 只让变了的尾巴淡入；转写中气泡只长不缩，定稿后回到真实宽度
    caption(el, text, prev = '') {
      const keep = text.startsWith(prev) ? prev : '';
      el.innerHTML = esc(keep) + (text.length > keep.length ? `<span class="new">${esc(text.slice(keep.length))}</span>` : '');
    }

    hear(text, final) {
      const ear = this.ear, p = ear.querySelector('.vb-text');
      if (text) this.o.onHear?.(true);
      if (!final) ear.style.minWidth = ear.offsetWidth + 'px';
      this.caption(p, text, this.heard || '');
      this.heard = text;
      ear.classList.toggle('has-text', !!text);
      if (final) { ear.classList.add('is-final'); ear.style.minWidth = ''; }
    }

    go(state) {
      clearTimeout(this.timer);
      this.timers.forEach(clearTimeout); this.timers = [];
      this.state = state;
      this.frame.dataset.voice = state;
      this.host.classList.toggle('is-speaking', state === 'speaking');
      this.syncRive();
      const { heard = '', status = [], say = [] } = this.script || {};
      if (state !== 'listening') this.o.onHear?.(false);
      const fast = reduce.matches;

      if (state === 'listening') {
        this.heard = '';
        this.ear.classList.remove('has-text', 'is-final', 'is-working');
        this.ear.querySelector('.vb-text').textContent = '';
        this.label('Listening');
        this.ear.classList.add('is-on');
        // 识别器一段段吐字：每次多 1–2 个词
        const words = heard.split(' ').filter(Boolean);
        let t = 700, n = 0;
        while (n < words.length) {
          n = Math.min(words.length, n + (n % 3 === 2 ? 2 : 1));
          const part = words.slice(0, n).join(' ');
          this.after(t, () => this.hear(part, false));
          t += 260;
        }
        this.after(t + 500, () => this.hear(heard, true));
        this.after(t + 1100, () => this.go('thinking'));
      }

      if (state === 'thinking') {
        if (!this.ear.classList.contains('is-final')) this.hear(heard, true);
        this.ear.classList.add('is-working');
        this.label('Working on it');
        let t = 900;
        if (status[0]) { this.after(t, () => this.label(status[0])); t += 1500; }
        if (status[1]) { this.after(t, () => this.label(status[1])); t += 800; }
        this.after(Math.max(t, 1800), () => this.go('speaking'));
      }

      if (state === 'speaking') {
        this.ear.classList.remove('is-on');
        const p = this.say.querySelector('.vb-text');
        let t = 0;
        say.forEach((line, i) => {
          this.after(t, () => {
            this.caption(p, line);
            this.say.classList.add('is-on');
          });
          t += fast ? 2400 : clampMs(900 + 55 * line.length, 1600, 3600);
        });
        this.after(t, () => this.go('complete'));
      }

      if (state === 'complete') {
        this.o.onComplete?.();
        this.after(1000, () => this.go('idle'));
      }

      if (state === 'idle') {
        this.ear.classList.remove('is-on');
        this.say.classList.remove('is-on');
        delete this.frame.dataset.voice;
        if (!this.o.resident) this.leave();
        return;
      }
      this.loop();
    }

    loop() {
      if (!this.gl || this.raf) return;
      this.last = 0;
      const draw = now => {
        this.raf = 0;
        const dt = this.last ? Math.min((now - this.last) / 1000, .05) : 0;
        this.last = now;
        const on = this.state === 'listening' || this.state === 'thinking';
        if (!reduce.matches) this.time += dt;
        this.gate = reduce.matches ? +on : this.gate + (+on - this.gate) * (1 - Math.exp(-dt / .35));
        const target = this.state === 'thinking' ? 1 : 0;
        this.thinking = reduce.matches ? target : this.thinking + (target - this.thinking) * Math.min(1, dt * 8);

        const { u, time } = this, th = this.thinking;
        const br = .5 + .5 * Math.sin(time * 2 * Math.PI / 2.7);
        const mix = (a, b) => a + (b - a) * th;
        sizeCanvas(this.gl, this.glowCanvas);
        u.f('uTime', time);
        u.f('uIntensity', this.gate * mix((.42 + .10 * br) * 1.47, 1.73));
        u.f('uBreath', 1);
        u.f('uFlowSpeed', mix(.1, .06));
        u.f('uReach', mix(96 * (.45 + .9 * br), 60));
        u.f('uWaveAmp', mix(20, 6));
        u.f('uFeather', mix(.18, .7));
        u.f('uBandMix', th);
        u.f('uBandPos', (time / 1.8) % 1);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
        if (on || this.gate > .002) this.raf = requestAnimationFrame(draw);
      };
      this.raf = requestAnimationFrame(draw);
    }
  }

  window.Nestie = Nestie;
})();
