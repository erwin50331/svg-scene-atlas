/* =========================================================
   【互動】背景配樂（Web Audio 即時合成，原創曲，不使用任何音檔）
   - 控制列「♪ 配樂」按鈕開關；網站「作者精選」播放區會呼叫
     window.sceneMusic.start() / stop()
   - 想換曲子：改下面 SCORE 區塊裡的音符陣列即可
     音符寫法："A4"、"C#5"、"Eb4"；"-" 是休止；數字是長度（幾格）
   ========================================================= */
(function () {
  "use strict";
  // __SceneAudioContext：下載時選了「不要點擊音效」會把場景音效靜音，配樂仍用原本的 AudioContext
  const AC = window.__SceneAudioContext || window.AudioContext || window.webkitAudioContext;
  if (!AC) return;

  // 音名 → 頻率
  function hz(n) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(n);
    const st = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
    return 440 * Math.pow(2, (st + (+m[3] + 1) * 12 - 69) / 12);
  }
  // 旋律陣列 → { 格數: [音名, 長度] }
  function seq(list) {
    const map = {}; let s = 0;
    for (const [n, len] of list) { if (n !== "-") map[s] = [n, len]; s += len; }
    return map;
  }

  let ctx = null, out = null, timer = null, playing = false, nextT = 0, step = 0;

  /* ---------- 樂器 ---------- */
  function env(t, a, d, v) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    g.connect(out); return g;
  }
  function osc(type, f, t, dur, dest, detune) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
    if (detune) o.detune.value = detune;
    o.connect(dest); o.start(t); o.stop(t + dur + 0.05); return o;
  }
  let noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const x = noiseBuf.getChannelData(0); for (let i = 0; i < x.length; i++) x[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s;
  }
  const I = {
    // 撥弦（吉他、烏德琴）：鋸齒波＋快速關閉的低通濾波
    pluck(f, t, d, v, bright) {
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass";
      lp.frequency.setValueAtTime(bright || 2600, t); lp.frequency.exponentialRampToValueAtTime(350, t + d);
      lp.connect(env(t, 0.004, d, v || 0.1));
      osc("sawtooth", f, t, d, lp); osc("triangle", f * 2, t, d * 0.5, lp);
    },
    // 顫音撥弦：同一個音快速連撥（葡萄牙吉他、卡農琴的招牌）
    tremolo(f, t, d, v, gap) {
      gap = gap || 0.085;
      for (let k = 0; k * gap < d - 0.04; k++) I.pluck(f, t + k * gap, 0.16, (v || 0.07) * (k ? 0.8 : 1.1), 3200);
    },
    // 柔和撥弦（豎琴）
    harp(f, t, d, v) { osc("triangle", f, t, d, env(t, 0.006, d, v || 0.05)); osc("sine", f * 2, t, d * 0.4, env(t, 0.004, d * 0.4, (v || 0.05) * 0.25)); },
    // 長笛／錫口哨：正弦波＋輕微抖音、慢起音
    flute(f, t, d, v) {
      v = v || 0.06;
      const g = ctx.createGain(); g.connect(out);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.12);
      g.gain.setValueAtTime(v, t + Math.max(0.13, d - 0.18)); g.gain.linearRampToValueAtTime(0.0001, t + d + 0.12);
      const o = osc("sine", f, t, d + 0.15, g);
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.007, t + 0.4);
      lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + d + 0.2);
      const h = ctx.createGain(); h.gain.value = 0.15; h.connect(g); osc("sine", f * 2, t, d + 0.15, h);
      // 氣音
      const n = noise(), bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f * 2; bp.Q.value = 2;
      n.connect(bp); bp.connect(env(t, 0.05, 0.25, v * 0.25)); n.start(t); n.stop(t + 0.4);
    },
    // 持續低音墊底
    pad(f, t, d, v) {
      v = v || 0.03;
      const g = ctx.createGain(); g.connect(out);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + d * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + d + 0.3);
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 800; lp.connect(g);
      osc("sawtooth", f, t, d + 0.3, lp, -7); osc("sawtooth", f, t, d + 0.3, lp, 7);
    },
    // 手鼓低音「咚」
    dum(t, v) {
      const o = osc("sine", 120, t, 0.4, env(t, 0.003, 0.32, v || 0.3));
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(58, t + 0.25);
    },
    // 手鼓高音「嗒」
    tek(t, v) {
      const n = noise(), hp = ctx.createBiquadFilter(); hp.type = "bandpass"; hp.frequency.value = 3200; hp.Q.value = 0.9;
      n.connect(hp); hp.connect(env(t, 0.002, 0.07, v || 0.12)); n.start(t); n.stop(t + 0.12);
    },
    // 海浪聲：濾過的白噪音慢慢起落
    wave(t, d, v) {
      const n = noise(), lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520;
      const g = ctx.createGain(); g.connect(out);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v || 0.04, t + d * 0.45); g.gain.linearRampToValueAtTime(0.0001, t + d);
      n.connect(lp); lp.connect(g); n.start(t); n.stop(t + d + 0.1);
    }
  };

  /* ---------- 曲譜（每組場景不同，見下方 SCORE） ---------- */
  // 範例曲：C 大調、4/4 拍、輕快的豎琴＋長笛（原創）。換成你自己的曲子時，只改這個 SCORE。
  // 規則：旋律的強拍音一定要是當下和弦的組成音；經過音只放在弱拍、而且很短。
  const SCORE = (() => {
    // 和弦：[低音, 和弦音...]
    const CH = { C: ["C3", "C4", "E4", "G4"], Am: ["A2", "A3", "C4", "E4"], F: ["F2", "F3", "A3", "C4"], G: ["G2", "G3", "B3", "D4"] };
    const bars = ["C", "Am", "F", "G", "C", "Am", "F", "G"];
    // 旋律：每小節 8 格（八分音符），[音名, 長度]，"-" 是休止
    const mel = seq([
      ["E5", 2], ["G5", 2], ["E5", 2], ["C5", 2],      // C
      ["C5", 2], ["E5", 2], ["A4", 4],                 // Am
      ["A4", 2], ["C5", 2], ["F5", 2], ["C5", 2],      // F
      ["B4", 2], ["D5", 2], ["G4", 4],                 // G
      ["G5", 2], ["E5", 2], ["C5", 2], ["E5", 2],      // C
      ["E5", 3], ["D5", 1], ["C5", 4],                 // Am（D5 是弱拍上的短經過音）
      ["F5", 2], ["A5", 2], ["C5", 4],                 // F
      ["D5", 2], ["B4", 2], ["G4", 2], ["-", 2]        // G
    ]);
    return {
      bpm: 96, stepsPerBeat: 2, steps: 64, volume: 0.5, gain: 2.5,
      play(s, t, dt) {
        const bar = Math.floor(s / 8), i = s % 8, ch = CH[bars[bar]];
        if (i === 0) I.pad(hz(ch[0]), t, dt * 7.5, 0.025);                    // 低音墊底
        if (i % 2 === 0) I.harp(hz(ch[1 + (i / 2) % 3]), t, dt * 3, 0.04);   // 豎琴分解和弦
        const m = mel[s]; if (m) I.flute(hz(m[0]), t, m[1] * dt * 0.95, 0.05);
      }
    };
  })();

  /* ---------- 播放引擎（一般不需要修改） ---------- */
  function schedule() {
    const dt = 60 / SCORE.bpm / SCORE.stepsPerBeat;
    while (nextT < ctx.currentTime + 0.35) {
      try { SCORE.play(step, nextT, dt); } catch (e) {}
      nextT += dt; step = (step + 1) % SCORE.steps;
    }
  }
  function setBtn() {
    const b = document.getElementById("btnMusic");
    if (b) { b.setAttribute("aria-pressed", String(playing)); b.textContent = "♪ 配樂：" + (playing ? "開" : "關"); }
  }
  function level(v, sec) {
    const t = ctx.currentTime; out.gain.cancelScheduledValues(t);
    out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), t); out.gain.linearRampToValueAtTime(Math.max(0.0001, v), t + sec);
  }
  let duckTimer = null;
  // ext：外層網頁（例如圖鑑網站的精選播放區）在使用者點擊時先建立好的 AudioContext，
  // 這樣瀏覽器不會擋自動播放；單獨打開這個檔案時不用傳
  function start(ext) {
    if (!ctx) {
      ctx = ext || new AC(); out = ctx.createGain(); out.gain.value = 0.0001;
      // 壓縮器讓音量平均，不會忽大忽小
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.25;
      const master = ctx.createGain(); master.gain.value = (SCORE.gain || 1) * .64; // 配樂音量預設 ×0.64：音樂太大聲會蓋過場景音效
      out.connect(comp); comp.connect(master); master.connect(ctx.destination);
    }
    if (ctx.state !== "running") ctx.resume();
    if (playing) return;
    playing = true; step = 0; nextT = ctx.currentTime + 0.1;
    level(SCORE.volume, 1.5); schedule(); timer = setInterval(schedule, 90); setBtn();
  }
  function stop() {
    if (!playing) return;
    playing = false; clearInterval(timer); clearTimeout(duckTimer); level(0.0001, 0.8); setBtn();
  }
  // 場景裡其他音樂（例如水舞、法朵）響起時，配樂先轉小聲
  function duck(sec) {
    if (!playing) return;
    clearTimeout(duckTimer); level(SCORE.volume * 0.12, 0.6);
    duckTimer = setTimeout(() => { if (playing) level(SCORE.volume, 2); }, sec * 1000);
  }
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) { if (playing) ctx.suspend(); } else if (playing) ctx.resume();
  });
  window.sceneMusic = {
    start, stop, duck,
    toggle() { playing ? stop() : start(); },
    get playing() { return playing; }
  };
  const btn = document.getElementById("btnMusic");
  if (btn) btn.addEventListener("click", () => window.sceneMusic.toggle());
  setBtn();
  // 純插畫版沒有按鈕：單獨打開時，點一下畫面就開始播（嵌在別的網頁裡時交給外層控制）
  let top = true; try { top = window.top === window; } catch (e) { top = false; }
  if (document.getElementById("pure-art") && top) {
    const go = () => { start(); document.removeEventListener("pointerdown", go); document.removeEventListener("keydown", go); };
    document.addEventListener("pointerdown", go); document.addEventListener("keydown", go);
  }
})();
