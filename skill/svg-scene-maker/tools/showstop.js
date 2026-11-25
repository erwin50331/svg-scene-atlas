/* =========================================================
   ShowStop｜表演「再按一下優雅停止」共用模組（2026-11-24）
   用法：放在場景主程式 <script> 之前；主程式最後呼叫
     ShowStop.init({
       on:      () => show.on,                  // 表演中回傳真值（多種表演時回傳種類）
       ff:      () => { show.t = show.dur - .02; },  // （選用）快轉到結尾，讓場景下一幀自己收尾
       btn:     'btnShow' 或 { fire: 'btnFire', stars: 'btnStars' },
       save:    () => ({ ... }),                // 表演開始前記下使用者設定（日夜、天氣…）
       restore: s => { ... },                   // 停止時還原
       stop:    () => { endShow(); ... },       // 立刻結束表演、清掉秀中物件（有 ff 時：快轉後仍未結束才呼叫）
       after:   () => { ... },                  // （選用）最後再補的清理
     });
   停止時：畫面凍結成一張「殘影」疊在上面 1.8 秒淡出（底下已回到原狀），
           還沒響的表演音符取消、正在響的長音淡出，表演排程的計時器取消，
           #cineFx 燈光歸零。播放中按鈕顯示「■ 停止」。
   ========================================================= */
(function () {
  'use strict';
  const W = window;
  const FADE = 1.8;                      // 殘影淡出秒數
  let cfg = null, saved = null, epoch = 0, zone = 0, quiet = null;
  const reducedQ = W.matchMedia ? W.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const isOn = () => { try { return cfg ? cfg.on() : false; } catch (e) { return false; } };

  /* ---------- ① 計時器：記下「表演開始時排程」的 setTimeout / setInterval ---------- */
  const _st = W.setTimeout, _ct = W.clearTimeout, _si = W.setInterval, _ci = W.clearInterval;
  const zt = new Map();                  // id → { iv, keep }
  // 音訊收尾、泡泡移除這類「善後」計時器保留，其餘（放煙火、下一段劇情）停止時取消
  const KEEP = /\.remove\(\)|disconnect|duck|level\(|\.gain\b|removeChild|classList\.remove/;
  function wrapFn(fn, ep) {
    if (typeof fn !== 'function') return fn;
    return function () {
      if (ep !== epoch) return;          // 已被停止
      zone++; try { return fn.apply(this, arguments); } finally { zone--; }
    };
  }
  // 表演進行中排程的「台詞」（say／bubble／narr）也算表演的，停止時一起取消
  const LINE = /\b(say|bubble|narr)\(/;
  W.setTimeout = function (fn, ms, ...a) {
    if (!zone && !(cfg && typeof fn === 'function' && ms > 0 && LINE.test(String(fn)) && isOn())) return _st(fn, ms, ...a);
    let id; const keep = typeof fn === 'function' && KEEP.test(String(fn)) && String(fn).length < 400;
    const g = keep ? fn : wrapFn(fn, epoch);
    id = _st(function () { zt.delete(id); return g.apply(this, arguments); }, ms, ...a);
    zt.set(id, { iv: false, keep }); return id;
  };
  W.clearTimeout = function (id) { zt.delete(id); return _ct(id); };
  W.setInterval = function (fn, ms, ...a) {
    if (!zone) return _si(fn, ms, ...a);
    const id = _si(wrapFn(fn, epoch), ms, ...a); zt.set(id, { iv: true, keep: false }); return id;
  };
  W.clearInterval = function (id) { zt.delete(id); return _ci(id); };

  /* ---------- ② 聲音：記下表演期間排程的音符；停止時取消未響的、淡掉長音 ---------- */
  const srcs = new Set(); const outs = new WeakMap();
  const SN = W.AudioScheduledSourceNode && W.AudioScheduledSourceNode.prototype;
  if (SN) {
    const _start = SN.start, _stop = SN.stop;
    SN.start = function (when, ...a) {
      const c = this.context, now = c.currentTime;
      if (quiet) quiet.push(this);       // 停止過程中（快轉到結尾）冒出的聲音，稍後直接靜音
      this.__ss = { at: Math.max(now, when || 0), end: Infinity, show: !!(zone || isOn()) };
      if (this.__ss.show) { srcs.add(this); this.addEventListener('ended', () => srcs.delete(this)); }
      return _start.call(this, when, ...a);
    };
    SN.stop = function (when, ...a) {
      if (this.__ss) this.__ss.end = Math.max(this.context.currentTime, when || 0);
      return _stop.call(this, when, ...a);
    };
  }
  const AN = W.AudioNode && W.AudioNode.prototype;
  if (AN) {   // 所有接到喇叭的線都先經過一顆總音量，停止時可以短暫壓低長音
    const _conn = AN.connect;
    AN.connect = function (dest, ...a) {
      if (dest && dest === this.context.destination && !this.__ssOut) {
        let g = outs.get(this.context);
        if (!g) { g = this.context.createGain(); g.__ssOut = true; _conn.call(g, this.context.destination); outs.set(this.context, g); }
        return _conn.call(this, g, ...a);
      }
      return _conn.call(this, dest, ...a);
    };
  }
  function stopAudio() {
    let longs = [], ctx = null;
    for (const s of srcs) {
      const c = s.context, now = c.currentTime, m = s.__ss; ctx = c;
      if (!m || !m.show) continue;
      if (m.at > now + .02) { try { s.stop(); } catch (e) {} srcs.delete(s); }      // 還沒響：直接取消
      else if (isFinite(m.end) && m.end > now + 1.2) longs.push(s);                                     // 長音：淡掉再停
    }
    if (longs.length && ctx) {
      const g = outs.get(ctx), now = ctx.currentTime;
      if (g) {
        g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(g.gain.value, now);
        g.gain.linearRampToValueAtTime(0, now + 1.1); g.gain.setValueAtTime(0, now + 1.2);
        g.gain.linearRampToValueAtTime(1, now + 1.9);
      }
      longs.forEach(s => { try { s.stop(now + 1.15); } catch (e) {} srcs.delete(s); });
    }
    srcs.clear();
  }

  /* ---------- ③ 殘影：把目前畫面凍結複製一份疊上去再淡出 ---------- */
  let ghostCss = false;
  function ghost(svg) {
    if (!svg || reducedQ.matches) return;
    if (!ghostCss) {
      ghostCss = true;
      const st = document.createElement('style');
      st.textContent = '.ss-ghost,.ss-ghost *{animation-play-state:paused!important;pointer-events:none!important}.ss-ghost{position:absolute!important;margin:0!important;will-change:opacity;transition:opacity ' + FADE + 's cubic-bezier(.4,0,.2,1)}';
      document.head.appendChild(st);
    }
    const cl = svg.cloneNode(true);
    cl.classList.add('ss-ghost'); cl.removeAttribute('tabindex'); cl.setAttribute('aria-hidden', 'true');
    // 凍結色票：把目前的 CSS 變數抄到殘影上，底下換色不影響殘影
    const cs = getComputedStyle(svg);
    const names = new Set();
    for (let i = 0; i < cs.length; i++) if (cs[i].startsWith('--')) names.add(cs[i]);
    try { for (const sh of document.styleSheets) for (const r of sh.cssRules) if (r.style) for (const p of r.style) if (p.startsWith('--')) names.add(p); } catch (e) {}
    for (const p of document.documentElement.style) if (p.startsWith('--')) names.add(p);
    names.forEach(p => { const v = cs.getPropertyValue(p); if (v) cl.style.setProperty(p, v); });
    // 漸層、濾鏡等定義改名，殘影只用自己那份（凍結）
    const map = {};
    cl.querySelectorAll('[id]').forEach(e => { const n = e.id + '__ss'; map[e.id] = n; e.id = n; });
    cl.id = svg.id; delete map[svg.id];
    const fix = v => v.replace(/url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/g, (m, id) => map[id] ? 'url(#' + map[id] + ')' : m);
    const all = cl.querySelectorAll('*'), orig = svg.querySelectorAll('*');
    let needCs = false;
    try { for (const sh of document.styleSheets) for (const r of sh.cssRules) if (r.cssText.includes('url(#') || r.cssText.includes('url("#')) { needCs = true; break; } } catch (e) {}
    for (let i = 0; i < all.length; i++) {
      const e = all[i];
      for (const a of e.attributes) {
        if (a.value.includes('url(')) e.setAttribute(a.name, fix(a.value));
        else if ((a.name === 'href' || a.name === 'xlink:href') && a.value[0] === '#' && map[a.value.slice(1)]) e.setAttribute(a.name, '#' + map[a.value.slice(1)]);
      }
      if (needCs && orig[i]) {
        const o = getComputedStyle(orig[i]);
        for (const p of ['fill', 'stroke', 'filter', 'clip-path', 'mask']) { const v = o.getPropertyValue(p); if (v && v.includes('url(')) e.style.setProperty(p, fix(v.replace(/url\("?[^#")]*#/g, 'url(#').replace(/"\)/g, ')'))); }
      }
    }
    const par = svg.parentElement;
    if (getComputedStyle(par).position === 'static') par.style.position = 'relative';
    const r = svg.getBoundingClientRect(), pr = par.getBoundingClientRect();
    Object.assign(cl.style, { left: (r.left - pr.left + par.scrollLeft - par.clientLeft) + 'px', top: (r.top - pr.top + par.scrollTop - par.clientTop) + 'px', width: r.width + 'px', height: r.height + 'px', opacity: 1 });
    svg.after(cl);
    try { cl.pauseAnimations && cl.pauseAnimations(); } catch (e) {}
    requestAnimationFrame(() => requestAnimationFrame(() => { cl.style.opacity = 0; }));
    _st(() => cl.remove(), FADE * 1000 + 300);
  }

  /* ---------- ④ 秀中冒出的說話泡泡：停止時一起收掉 ---------- */
  let added = [];
  const mo = W.MutationObserver ? new MutationObserver(ms => { if (!isOn()) return; for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) added.push(n); }) : null;
  const BUB = /bubble|say|speech|talk|tip/i;
  function clearBubbles() {
    if (mo) for (const m of mo.takeRecords()) for (const n of m.addedNodes) if (n.nodeType === 1) added.push(n);
    added.forEach(n => {
      if (!n.isConnected || n.closest('.ss-ghost')) return;
      const p = n.parentElement;
      if (BUB.test(n.getAttribute('class') || '') || (p && BUB.test((p.id || '') + ' ' + (p.getAttribute('class') || '')))) n.remove();
    });
    added = [];
  }

  /* ---------- ⑤ 停止 ---------- */
  let stopping = false;
  function cancel() {
    if (stopping) return; stopping = true;
    const svg = cfg.svg ? document.querySelector(cfg.svg) : (document.getElementById('scene') || document.querySelector('svg'));
    try { ghost(svg); } catch (e) {}
    epoch++;
    for (const [id, z] of zt) if (!z.keep) { z.iv ? _ci(id) : _ct(id); zt.delete(id); }
    try { stopAudio(); } catch (e) {}
    quiet = [];
    zone++;   // 收尾過程中（快轉那幾幀、stop、restore）排出的計時器，例如散場後的鳴笛、煙火，最後一起取消
    // ff：把表演時間快轉到結尾，讓場景自己的收尾邏輯跑完一幀（殘影蓋著看不到），再補 stop
    if (cfg.ff) {
      try { cfg.ff(); } catch (e) { console.warn('ShowStop ff', e); }
      let n = 0; const wait = () => { if (isOn() && n++ < 8) requestAnimationFrame(wait); else finish(); };
      requestAnimationFrame(wait);
    } else finish();
  }
  function finish() {
    try { if (isOn() || !cfg.ff) cfg.stop && cfg.stop(); } catch (e) { console.warn('ShowStop stop', e); }
    try { if (typeof W.setCine === 'function') W.setCine(0); } catch (e) {}
    try { if (cfg.cine) cfg.cine(); } catch (e) {}
    if (saved && cfg.restore) { try { cfg.restore(saved); } catch (e) { console.warn('ShowStop restore', e); } }
    saved = null;
    clearBubbles();
    (quiet || []).forEach(s => { try { s.stop(); } catch (e) {} }); quiet = null;
    zone = Math.max(0, zone - 1);
    for (const [id, z] of zt) if (!z.keep) { z.iv ? _ci(id) : _ct(id); zt.delete(id); }
    try { cfg.after && cfg.after(); } catch (e) {}
    // 背景配樂（scene-bgm）表演時被壓小聲：停止後很快恢復
    try { if (W.sceneMusic && W.sceneMusic.playing) W.sceneMusic.duck(.3); } catch (e) {}
    stopping = false;
    sync();
  }

  /* ---------- ⑥ 按鈕：開始時記下設定；表演中再按＝停止；文字顯示「■ 停止」 ---------- */
  const btns = [];
  function btnFor(kind) {
    if (!kind) return null;
    if (typeof cfg.btn === 'string') return document.getElementById(cfg.btn);
    const id = cfg.btn[kind] || cfg.btn['*']; return id ? document.getElementById(id) : null;
  }
  function sync() {
    const k = isOn(), act = btnFor(k);
    btns.forEach(b => {
      const st = b === act, txt = cfg.label || '■ 停止';
      if (st && b.disabled) b.disabled = false;   // 有些作品表演中會把按鈕停用，這裡讓它能按「停止」
      // 作品自己改了按鈕文字（例如收場時換成下一個特效名稱）就記下來，結束時還原成它
      if (b.classList.contains('ss-stop') && b.textContent !== txt) { b.__ssLabel = b.innerHTML; if (st) b.textContent = txt; }
      if (st && !b.classList.contains('ss-stop')) {
        b.__ssLabel = b.innerHTML; b.classList.add('ss-stop');
        b.textContent = cfg.label || '■ 停止'; b.title = '再按一下停止表演';
      } else if (!st && b.classList.contains('ss-stop')) {
        b.classList.remove('ss-stop'); b.innerHTML = b.__ssLabel; b.removeAttribute('title');
      }
    });
  }
  function loop() { sync(); requestAnimationFrame(loop); }

  W.ShowStop = {
    init(c) {
      cfg = c;
      const ids = typeof c.btn === 'string' ? [c.btn] : Object.values(c.btn);
      [...new Set(ids)].forEach(id => {
        const b = document.getElementById(id); if (!b) return;
        b.__ssLabel = b.innerHTML; btns.push(b);
        b.addEventListener('click', e => {
          const k = isOn();
          if (k && btnFor(k) === b) {
            e.stopImmediatePropagation(); e.preventDefault();
            if (e.isTrusted || c.allowSynthetic) cancel();
            return;
          }
          if (!k) {
            if (c.save) { try { saved = c.save(); } catch (er) { saved = null; } }
            epoch++; zone++; added = [];
            // 這次點擊同步排出的計時器都算表演的（點擊處理完就關掉）
            let done = false; const off = () => { if (!done) { done = true; zone = Math.max(0, zone - 1); W.removeEventListener('click', off); } };
            W.addEventListener('click', off); _st(off, 0);
          }
        }, true);
      });
      if (mo) { const s = c.svg ? document.querySelector(c.svg) : (document.getElementById('scene') || document.querySelector('svg')); if (s) mo.observe(s, { childList: true, subtree: true }); }
      requestAnimationFrame(loop);
    },
    cancel: () => { if (isOn()) cancel(); },
    get saved() { return saved; }
  };
})();
