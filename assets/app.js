/* =========================================================
   SVG 動畫圖鑑｜網站程式
   一般不需要修改；新增場景請改 data/scenes.js
   ========================================================= */
(function () {
  "use strict";

  const SITE = window.SITE || {};
  const SCENES = (window.SCENES || []).filter(Boolean);
  const SCENES_ALL = SCENES;  // 略過資料檔裡多打的逗號
  const STYLES = window.STYLES || [];
  const TAGS = window.TAGS || [];
  const GUIDE = window.STYLE_GUIDE || {};

  /* ---------------- 網站統計（SITE.analytics 留空就完全不載入） ---------------- */
  // 事件名稱：open/SC-19（打開預覽）、download/SC-19/html-pure、download/SC-19/html-full、
  // download/SC-19/mp4（日後 MP4 按鈕呼叫 window.atlasTrack("download", "SC-19", "mp4")）、prompt/SC-19（複製 Prompt）
  const track = (function () {
    const code = String(SITE.analytics || "").trim();
    if (!code) return () => {};
    const endpoint = /^https?:\/\//.test(code) ? code : /^[a-z0-9-]+$/i.test(code) ? `https://${code}.goatcounter.com/count` : "";
    if (!endpoint) return () => {};
    const queue = [];
    const sc = document.createElement("script");
    sc.async = true; sc.src = "https://gc.zgo.at/count.js"; sc.dataset.goatcounter = endpoint;
    sc.onload = () => { while (queue.length) send(queue.shift()); };
    document.head.appendChild(sc);
    function send(ev) { try { window.goatcounter.count(ev); } catch (e) { /* 統計失敗不影響網站 */ } }
    return function (action, id, detail) {
      const s = SCENES_ALL.find((x) => x.id === id);
      const ev = { path: [action, id, detail].filter(Boolean).join("/"), title: s ? `${id} ${s.title}` : id, event: true };
      if (window.goatcounter && window.goatcounter.count) send(ev); else queue.push(ev);
    };
  })();
  window.atlasTrack = track;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const key = (id) => id.toLowerCase();
  const thumb = (s, t) => `thumbs/${key(s.id)}-${t}.jpg`;
  const sceneUrl = (s) => `scenes/${s.file}`;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  // 減少動態：照網站右上角的開關（沒按過就照系統設定），見 assets/motion.js
  const rmq = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  const isReduced = () => !!(rmq && rmq.matches);
  // 在別人的頁框裡（例如預覽環境）瀏覽器可能擋下載，改成開新分頁
  const framed = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();

  /* ---------------- Prompt 產生器 ---------------- */
  function buildPrompt(s) {
    const list = (arr) => arr.map((x) => `- ${x}`).join("\n");
    return [
      `請你擔任 SVG 動畫插畫師，幫我做一組可互動的寬幅場景動畫。請用繁體中文寫註解。`,
      ``,
      `【場景】${s.place}｜${s.title}`,
      s.summary,
      ``,
      `【畫面重點】`,
      list(s.elements),
      `- 加上行人、交通工具和生活感的小物件，細節要豐富`,
      ``,
      `【風格】${GUIDE[s.guide || s.style] || s.style}`,
      ``,
      `【環境動態】`,
      list(s.ambient),
      ``,
      `【互動】`,
      list(s.interact),
      ``,
      `【技術規格】`,
      `- 單一自包含 HTML 檔（SVG ＋原生 JavaScript，不依賴外部函式庫）`,
      `- 寬版構圖 viewBox 1600×600，RWD 自動縮放`,
      `- 所有顏色集中在檔案開頭的 CSS 變數，白天與夜晚各一組，方便換色`,
      `- 日夜循環：可自動播放，也可手動切換`,
      `- 支援 prefers-reduced-motion`,
      `- 程式碼加上中文註解，標出「場景、角色、動畫、互動」各區塊`,
      `- 只畫原創內容，不使用任何既有角色、品牌或商標`,
      ``,
      `（參考作品：${SITE.name || "SVG 動畫圖鑑"} ${s.id}）`
    ].join("\n");
  }

  /* ---------------- 複製到剪貼簿 ---------------- */
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (err) {}
      ta.remove();
      return ok;
    }
  }
  let toastTimer;
  const CHECK = '<svg class="ck" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  function toast(msg) {
    const t = $("toast");
    const top = [...document.querySelectorAll("dialog[open]")].pop();
    (top || document.body).appendChild(t);   // 開著視窗時放進視窗裡，才不會被蓋住
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
  }
  async function copyPrompt(s, btn) {
    track("prompt", s.id);
    const ok = await copyText(buildPrompt(s));
    if (ok) {
      toast(`已複製 ${s.id} 的 Prompt，貼到你的 Claude 就能開始`);
      if (btn) {
        btn.classList.add("done");
        const label = btn.querySelector("span");
        const ic = btn.querySelector("svg"), oldIc = ic ? ic.outerHTML : "";
        if (ic && !btn._ck) { ic.outerHTML = CHECK; btn._ck = oldIc; }
        if (label) { if (!btn._old) btn._old = label.textContent; label.textContent = "已複製"; clearTimeout(btn._t); btn._t = setTimeout(() => { label.textContent = btn._old; btn._old = null; const c = btn.querySelector("svg"); if (c && btn._ck) c.outerHTML = btn._ck; btn._ck = null; btn.classList.remove("done"); }, 2000); }
      }
    } else {
      // 只有按了「複製 Prompt」才會看到內容
      if (!dlg.open || current !== s) openViewer(s);
      const ta = $("vPromptText");
      ta.value = buildPrompt(s); $("vFallback").hidden = false;
      ta.focus(); ta.select();
    }
  }

  /* ---------------- 下載 ---------------- */
  // ver："pure" 純插畫版（只有動畫畫面）、"full" 完整版（含控制列與說明）
  // 下載前可勾選要不要「點擊音效」與「背景配樂」，下載的檔案會依勾選調整
  const pureUrl = (s) => `scenes/pure/${s.file}`;
  const fileUrl = (s, ver) => ver === "pure" ? pureUrl(s) : sceneUrl(s);
  const dlName = (s, ver, quiet) => s.file.replace(/\.html$/, (ver === "pure" ? "-pure" : "") + (quiet ? "-" + quiet : "") + ".html");
  const BGM_RE = /<script id="scene-bgm">[\s\S]*?<\/script>\n?/;
  const MOTION_RE = /<script id="site-motion">[\s\S]*?<\/script>\n?/;  // 網站專用的減少動態開關，下載時拿掉
  const MUTE = '<script id="scene-mute">/* 下載時選了不要點擊音效：場景本身的聲音一律靜音（背景配樂不受影響） */' +
    '(function(){var A=window.AudioContext||window.webkitAudioContext;if(!A)return;window.__SceneAudioContext=A;' +
    'function M(o){var c=new A(o);c.suspend();c.resume=function(){return Promise.resolve();};return c;}M.prototype=A.prototype;' +
    'window.AudioContext=M;if(window.webkitAudioContext)window.webkitAudioContext=M;})();</script>' +
    '<style id="scene-mute-css">#btnSound{display:none!important}</style>\n';
  const textCache = {};
  function getText(url) {
    if (!textCache[url]) textCache[url] = fetch(url).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); });
    return textCache[url];
  }
  function soundsOf(html) {
    const music = BGM_RE.test(html);
    return { music, sfx: /AudioContext/.test(html.replace(BGM_RE, "")) };
  }
  function shape(html, o) {
    html = html.replace(MOTION_RE, "");
    if (!o.music) html = html.replace(BGM_RE, "").replace(/\n?\s*<button id="btnMusic"[^>]*>[^<]*<\/button>/, "");
    if (!o.sfx) html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + "\n" + MUTE) : MUTE + html;
    return html;
  }
  function saveFile(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/html;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  const dd = $("dlDlg"), form = $("dlForm");
  const CLIPS = String(SITE.clips || "").trim().replace(/([^/])$/, "$1/").replace(/^\/$/, "");
  // 下載鈕：箭頭落下 → 進度圈 → 打勾（約 1 秒），再關視窗
  function downloadAnim(b) {
    if (!b || isReduced()) return Promise.resolve();
    b.classList.remove("ok"); b.classList.add("busy"); b.disabled = true;
    return new Promise((r) => setTimeout(() => { b.classList.remove("busy"); b.classList.add("ok"); setTimeout(() => { b.classList.remove("ok"); b.disabled = false; r(); }, 520); }, 760));
  }
  // 觸發下載的那顆按鈕，短暫變成「✓ 已下載」
  function flashDone(btn, text) {
    if (btn._done) return; btn._done = true;
    const label = btn.querySelector("span"), ic = btn.querySelector("svg");
    const oldL = label ? label.textContent : null, oldI = ic ? ic.outerHTML : "";
    if (ic) ic.outerHTML = CHECK;
    if (label) label.textContent = text; else if (ic) { btn._txt = btn.lastChild.textContent; btn.lastChild.textContent = text; }
    btn.classList.add("done");
    setTimeout(() => { const c = btn.querySelector("svg"); if (c && oldI) c.outerHTML = oldI; if (label) label.textContent = oldL; else if (btn._txt) btn.lastChild.textContent = btn._txt; btn.classList.remove("done"); btn._done = false; }, 2200);
  }
  let dlScene = null, dlInfo = { music: false, sfx: false };
  async function refreshDlOpts() {
    const ver = form.ver.value, s = dlScene;
    const clip = form.fmt && form.fmt.value !== "html";
    $("dlVer").hidden = clip;
    if (clip) { $("dlSound").hidden = true; $("dlNoSound").hidden = true; return; }
    try { dlInfo = soundsOf(await getText(fileUrl(s, ver))); } catch (e) { dlInfo = { music: false, sfx: false, offline: true }; }
    if (s !== dlScene) return;
    $("optSfx").hidden = !dlInfo.sfx; $("optMusic").hidden = !dlInfo.music;
    $("dlSound").hidden = !dlInfo.sfx && !dlInfo.music;
    $("dlNoSound").hidden = dlInfo.offline || dlInfo.sfx || dlInfo.music;
    $("musicNote").textContent = ver === "pure" ? "原創循環配樂，打開後點一下畫面開始播放" : "原創循環配樂，用畫面下方「♪ 配樂」開關";
  }
  let dlOpener = null;
  function openDl(s, ver) {
    dlScene = s; dlOpener = window.__lastBtn || (document.activeElement && document.activeElement.closest ? document.activeElement.closest(".btn") : null);
    $("dlSub").textContent = `${s.id}　${s.title}`;
    form.ver.value = ver || "pure"; form.sfx.checked = true; form.music.checked = true;
    $("dlFmt").hidden = !CLIPS; form.fmt.value = "html"; $("dlVer").hidden = false;
    $("dlSound").hidden = true; $("dlNoSound").hidden = true;
    refreshDlOpts();
    dd.showModal();
  }
  form.addEventListener("change", (e) => { if (e.target.name === "ver" || e.target.name === "fmt") refreshDlOpts(); });
  $("dlCancel").addEventListener("click", () => dd.close());
  dd.addEventListener("click", (e) => { if (e.target === dd) dd.close(); });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (CLIPS && form.fmt.value !== "html") {
      const s = dlScene, fmt = form.fmt.value, url = CLIPS + s.file.replace(/\.html$/, "." + fmt);
      await downloadAnim($("dlGo"));
      dd.close();
      if (dlOpener) flashDone(dlOpener, "已下載");
      track("download", s.id, fmt);
      if (framed) { window.open(url, "_blank", "noopener"); toast(`已在新分頁開啟 ${fmt.toUpperCase()}`); return; }
      const a = document.createElement("a"); a.href = url; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
      toast(`開始下載 ${fmt.toUpperCase()}`); return;
    }
    const s = dlScene, ver = form.ver.value, label = ver === "pure" ? "純插畫版" : "完整版";
    const o = { sfx: !dlInfo.sfx || form.sfx.checked, music: !dlInfo.music || form.music.checked };
    await downloadAnim($("dlGo"));
    dd.close();
    if (dlOpener) flashDone(dlOpener, "已下載");
    track("download", s.id, "html-" + ver);
    if (framed) {   // 預覽框架裡不能直接下載，改開新分頁
      window.open(fileUrl(s, ver), "_blank", "noopener");
      toast(`已在新分頁開啟${label}，可用瀏覽器另存新檔`); return;
    }
    const quiet = !o.sfx && !o.music && (dlInfo.sfx || dlInfo.music) ? "silent" : !o.music && dlInfo.music ? "nomusic" : !o.sfx && dlInfo.sfx ? "nosfx" : "";
    try {
      const name = dlName(s, ver, quiet);
      saveFile(name, shape(await getText(fileUrl(s, ver)), o));
      toast(`開始下載${label}：${name}`);
    } catch (err) {   // 讀不到檔案（例如直接用 file:// 開網站）就直接下載原檔
      const a = document.createElement("a"); a.href = fileUrl(s, ver); a.download = dlName(s, ver, "");
      document.body.appendChild(a); a.click(); a.remove();
      toast(`開始下載${label}`);
    }
  });

  /* ---------------- 統計與開場 ---------------- */
  const regions = [...new Set(SCENES.map((s) => s.region))];
  const usedStyles = STYLES.filter((st) => SCENES.some((s) => s.style === st));
  $("statScenes").textContent = SCENES.length;
  $("statGoal").textContent = SITE.goal ? `／${SITE.goal}` : "";
  $("statStyles").textContent = usedStyles.length;
  $("statRegions").textContent = regions.filter((r) => !["原創地點", "太空", "深海", "高空"].includes(r)).length;
  $("year").textContent = new Date().getFullYear();
  if (SITE.repo) { const r = $("repoLink"); r.href = SITE.repo; r.hidden = false; }
  /* ---------------- Skill 下載 ---------------- */
  if (SITE.repo) $("skillSrc").href = SITE.repo.replace(/\/$/, "") + "/tree/main/skill/svg-scene-maker";
  if (SITE.repo) $("skillLog").href = SITE.repo.replace(/\/$/, "") + "/blob/main/skill/svg-scene-maker/CHANGELOG.md";
  $("skillDl").addEventListener("click", () => track("download", "skill", "zip"));

  /* ---------------- 聯絡 ---------------- */
  if (SITE.repo) { const c = $("contactRepo"); c.href = SITE.repo; c.hidden = false; $("contactRepoSoon").hidden = true; }
  (() => {
    const form = $("contactForm"), send = $("cSend"), status = $("cStatus"), msg = $("cMsg");
    if (!form) return;
    const HINT = { "留言": ["想說的話", "例如：最喜歡里斯本那一組！"], "許願": ["想看哪裡、什麼畫風", "例如：想看京都清水寺的浮世繪版本"] };
    form.addEventListener("change", (e) => {
      if (e.target.name !== "類型") return;
      const [l, p] = HINT[e.target.value];
      $("cMsgLabel").textContent = l; msg.placeholder = p;
    });
    const endpoint = (SITE.contact || "").trim();
    if (!endpoint) {
      send.disabled = true;
      status.textContent = "留言功能將在網站正式上線後開放。";
      return;
    }
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!msg.value.trim()) { status.textContent = "請先寫點內容再送出。"; msg.focus(); return; }
      const em = $("cEmail");
      if (em.value && !em.checkValidity()) { status.textContent = "Email 格式好像不太對。"; em.focus(); return; }
      const fd = new FormData(form);
      fd.append("_subject", `SVG 動畫圖鑑｜新${fd.get("類型")}`);
      send.disabled = true; status.textContent = "傳送中…";
      try {
        const r = await fetch(endpoint, { method: "POST", body: fd, headers: { Accept: "application/json" } });
        if (!r.ok) throw new Error(r.status);
        form.reset();
        $("cMsgLabel").textContent = HINT["留言"][0]; msg.placeholder = HINT["留言"][1];
        status.textContent = "已送出，謝謝你！";
        send.classList.add("sent"); setTimeout(() => send.classList.remove("sent"), 2600);
      } catch (err) {
        status.textContent = "送出失敗，請稍後再試一次。";
      } finally { send.disabled = false; }
    });
  })();

  const byNum = (a, b) => parseInt(a.id.slice(3), 10) - parseInt(b.id.slice(3), 10);
  // 「最新」固定顯示編號最大的一組（補做的舊編號不會搶走最新位置）
  const latest = SCENES.slice().sort((a, b) => byNum(b, a))[0];
  if (latest) {
    $("heroDay").src = thumb(latest, "day");
    $("heroDay").alt = `${latest.title} 白天`;
    $("heroNight").src = thumb(latest, "night");
    $("heroId").textContent = latest.id;
    $("heroTitle").textContent = `${latest.title}・${latest.place}`;
    $("heroPlate").setAttribute("aria-label", `預覽最新場景：${latest.title}`);
    $("heroPlate").addEventListener("click", () => openViewer(latest));
    let night = false;
    setInterval(() => { night = !night && !isReduced(); $("heroNight").style.opacity = night ? 1 : 0; }, 4200);
  }

  /* ---------------- 篩選狀態 ---------------- */
  const state = { q: "", style: "全部", region: "全部", tag: "全部", sort: "new", picks: false };

  /* ---------------- 作者精選 ---------------- */
  const PICKS = (SITE.picks || []).map((id) => SCENES.find((s) => s.id === id)).filter(Boolean);
  // 每次打開網頁都把精選順序打亂，最大張的那一組不會永遠是同一組
  for (let i = PICKS.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [PICKS[i], PICKS[j]] = [PICKS[j], PICKS[i]]; }
  const isPick = (s) => PICKS.includes(s);

  // 地區、類型下拉選單（依數量排序）
  function fillSelect(sel, label, values, counter) {
    const items = values.map((v) => [v, counter(v)]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hant"));
    sel.innerHTML = `<option value="全部">${label}</option>` +
      items.map(([v, n]) => `<option value="${esc(v)}" ${n ? "" : "disabled"}>${esc(v)}（${n}）</option>`).join("");
  }
  // 地區下拉：依洲分組，組內依注音排序；新國家沒列到的會放進「其他地區」
  const CONTINENTS = [
    ["亞洲", ["台灣", "日本", "中國", "蒙古", "越南", "泰國", "新加坡", "尼泊爾", "印度", "馬爾地夫", "阿曼", "阿拉伯聯合大公國", "約旦", "黎巴嫩", "伊朗", "土耳其", "沙烏地阿拉伯", "卡達", "韓國", "香港", "澳門", "馬來西亞", "印尼", "菲律賓", "柬埔寨"]],
    ["歐洲", ["英國", "法國", "德國", "荷蘭", "瑞士", "奧地利", "義大利", "梵蒂岡", "西班牙", "葡萄牙", "希臘", "克羅埃西亞", "波蘭", "愛沙尼亞", "立陶宛", "拉脫維亞", "丹麥", "挪威", "法羅群島", "俄羅斯", "冰島", "芬蘭", "瑞典", "比利時", "捷克", "匈牙利"]],
    ["北美洲", ["美國", "加拿大", "墨西哥"]],
    ["中南美洲", ["巴拿馬", "秘魯", "巴西", "阿根廷", "智利", "古巴"]],
    ["非洲", ["埃及", "坦尚尼亞", "肯亞", "剛果", "馬達加斯加", "摩洛哥", "南非"]],
    ["大洋洲", ["紐西蘭", "澳洲"]],
    ["南極洲", ["南極"]],
    ["特別場景", ["原創地點", "太空", "深海", "高空"]],
  ];
  (function fillRegion(sel) {
    const zh = new Intl.Collator("zh-Hant-TW-u-co-zhuyin").compare;
    const n = (r) => SCENES.filter((s) => s.region === r).length;
    const known = new Set(CONTINENTS.flatMap((c) => c[1]));
    const groups = CONTINENTS.map(([name, list]) => [name, regions.filter((r) => list.includes(r))]);
    const rest = regions.filter((r) => !known.has(r));
    if (rest.length) groups.splice(groups.length - 1, 0, ["其他地區", rest]);
    sel.innerHTML = `<option value="全部">全部地區</option>` + groups.filter((g) => g[1].length).map(([name, list]) =>
      `<optgroup label="${esc(name)}（${list.reduce((a, r) => a + n(r), 0)}）">` +
      (name !== "特別場景" && list.length > 1 ? `<option value="洲:${esc(name)}">全部${esc(name)}（${list.reduce((a, r) => a + n(r), 0)}）</option>` : "") +
      list.slice().sort(zh).map((r) => `<option value="${esc(r)}">${esc(r)}（${n(r)}）</option>`).join("") + `</optgroup>`).join("");
  })($("fRegion"));
  fillSelect($("fTag"), "全部類型", TAGS, (t) => SCENES.filter((s) => (s.tags || []).includes(t)).length);

  function renderChips() {
    const count = (st) => SCENES.filter((s) => s.style === st).length;
    const pickChip = PICKS.length
      ? `<button type="button" class="pick-chip" data-picks="1" aria-pressed="${state.picks}">${ICON.star}作者精選<em>${PICKS.length}</em></button><span class="sep" aria-hidden="true"></span>`
      : "";
    // 風格依作品數由多到少排列；數量一樣時照 STYLES 原本的順序；還沒有作品的風格先不顯示
    const byCount = STYLES.map((st, i) => [st, count(st), i]).filter((x) => x[1]).sort((a, b) => b[1] - a[1] || a[2] - b[2]).map((x) => x[0]);
    $("styleChips").innerHTML = pickChip + ["全部", ...byCount].map((st) => {
      const n = st === "全部" ? SCENES.length : count(st);
      const name = st === "全部" ? "全部風格" : st;
      return `<button type="button" data-style="${esc(st)}" aria-pressed="${st === state.style}" ${n ? "" : "disabled"}>${esc(name)}<em>${n}</em></button>`;
    }).join("");
  }

  function matches(s) {
    if (state.picks && !isPick(s)) return false;
    if (state.style !== "全部" && s.style !== state.style) return false;
    if (state.region.startsWith("洲:")) { const c = CONTINENTS.find((x) => x[0] === state.region.slice(2)); if (!c || !c[1].includes(s.region)) return false; }
    else if (state.region !== "全部" && s.region !== state.region) return false;
    if (state.tag !== "全部" && !(s.tags || []).includes(state.tag)) return false;
    if (state.q) {
      const hay = [s.id, s.title, s.place, s.region, s.style, s.summary, ...(s.tags || []), ...(s.elements || []), ...(s.interact || [])].join(" ").toLowerCase();
      return state.q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
    }
    return true;
  }

  /* ---------------- 卡片 ---------------- */
  const ICON = {
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.5 2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
    caret: '<svg class="caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>'
  };
  function card(s) {
    return `<article class="card" data-id="${esc(s.id)}">
      <button type="button" class="plate" data-act="view" aria-label="打開 ${esc(s.title)}">
        <img src="${thumb(s, "day")}" alt="${esc(s.title)}，${esc(s.style)}風格" loading="lazy" width="960" height="360">
        <img class="night" src="${thumb(s, "night")}" alt="" loading="lazy" width="960" height="360">
      </button>
      <div class="card-body">
        <div class="card-top"><span class="mono">${esc(s.id)}</span><time datetime="${esc(s.date)}" class="mono">${esc(s.date)}</time></div>
        <h3>${esc(s.title)}</h3>
        <p class="place">${esc(s.place)}</p>
        <div class="meta">${isPick(s) ? `<span class="tag pick">${ICON.star}作者精選</span>` : ""}<span class="tag style">${esc(s.style)}</span>${(s.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
        <p class="desc">${esc(s.summary)}</p>
        <div class="actions">
          <button type="button" class="btn primary" data-act="download">${ICON.down}<span>下載</span></button>
          <button type="button" class="btn" data-act="copy">${ICON.copy}<span>複製 Prompt</span></button>
        </div>
      </div>
    </article>`;
  }

  let visible = [];
  function render() {
    if (typeof stopLive === "function") stopLive();
    visible = SCENES.filter(matches).sort(state.sort === "new" ? (a, b) => byNum(b, a) : byNum);
    const grid = $("grid");
    grid.innerHTML = visible.map(card).join("");
    grid.querySelectorAll(".card").forEach((el) => {
      const s = SCENES.find((x) => x.id === el.dataset.id);
    });
    $("empty").hidden = visible.length > 0;
    const filtered = state.picks || state.q || state.style !== "全部" || state.region !== "全部" || state.tag !== "全部";
    $("clearBtn").hidden = !filtered;
    $("resultCount").textContent = filtered ? `找到 ${visible.length} 組場景（共 ${SCENES.length} 組）` : `共 ${SCENES.length} 組場景`;
  }

  /* 滑鼠移到卡片縮圖上：直接在縮圖位置播放動畫（純插畫版），移開就停 */
  const canHover = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  let liveTimer = null, livePlate = null;
  function stopLive() {
    clearTimeout(liveTimer);
    if (livePlate) { const f = livePlate.querySelector("iframe.live"); if (f) f.remove(); livePlate = null; }
  }
  if (canHover) {
    $("grid").addEventListener("pointerover", (e) => {
      if (isReduced()) return;
      const plate = e.target.closest(".card .plate");
      if (!plate || plate === livePlate) return;
      stopLive(); livePlate = plate;
      liveTimer = setTimeout(() => {   // 滑鼠一進來就立刻開始載入
        const s = SCENES.find((x) => x.id === plate.closest(".card").dataset.id);
        const f = document.createElement("iframe");
        f.className = "live"; f.src = pureUrl(s); f.tabIndex = -1;
        f.setAttribute("aria-hidden", "true"); f.title = "";
        f.addEventListener("load", () => f.classList.add("on"));
        plate.appendChild(f);
      }, 0);
    });
    $("grid").addEventListener("pointerout", (e) => {
      if (livePlate && !livePlate.contains(e.relatedTarget)) stopLive();
    });
  }

  $("grid").addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const s = SCENES.find((x) => x.id === el.closest(".card").dataset.id);
    if (el.dataset.act === "view") openViewer(s);
    if (el.dataset.act === "copy") copyPrompt(s, el);
    if (el.dataset.act === "download") openDl(s, "pure");
  });

  /* ---------------- 篩選事件 ---------------- */
  let qTimer;
  $("q").addEventListener("input", (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => { state.q = e.target.value.trim(); render(); }, 150); });
  $("fRegion").addEventListener("change", (e) => { state.region = e.target.value; render(); });

  /* ---------------- 護照印章裝飾（寬螢幕時作品牆左下、右上各一枚，純裝飾不可點） ---------------- */
  (function stamps() {
    const gal = $("gallery");
    if (!gal) return;
    const total = SCENES.length;
    // 不均勻的印泥：用雜訊把一部分墨色吃掉，看起來像蓋得不太好的章
    const worn = (id, seed) => `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${seed}" result="n"/>
        <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="${seed + 7}" result="m"/>
        <feColorMatrix in="m" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.75" result="patch"/>
        <feComposite in="SourceGraphic" in2="patch" operator="in" result="a"/>
        <feDisplacementMap in="a" in2="n" scale="3.5"/>
      </filter>`;
    const round = `<svg viewBox="0 0 160 160" aria-hidden="true"><defs>${worn("wornA", 3)}
        <path id="ringA" d="M80 80 m-58 0 a58 58 0 1 1 116 0 a58 58 0 1 1 -116 0"/></defs>
      <g filter="url(#wornA)" fill="none" stroke="currentColor">
        <circle cx="80" cy="80" r="74" stroke-width="3.5"/><circle cx="80" cy="80" r="68" stroke-width="1.2"/><circle cx="80" cy="80" r="44" stroke-width="1.6"/>
        <text font-family="IBM Plex Mono,monospace" font-size="11" font-weight="600" letter-spacing="3.2" fill="currentColor" stroke="none"><textPath href="#ringA">SVG SCENE ATLAS ★ WORLD TOUR ★ 2026 ★</textPath></text>
        <text x="80" y="78" text-anchor="middle" font-family="Noto Sans TC,sans-serif" font-size="17" font-weight="900" fill="currentColor" stroke="none">環遊世界</text>
        <text x="80" y="97" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="10.5" font-weight="600" letter-spacing="1.5" fill="currentColor" stroke="none">${total} SCENES</text>
      </g></svg>`;
    const rect = `<svg viewBox="0 0 180 120" aria-hidden="true"><defs>${worn("wornB", 11)}</defs>
      <g filter="url(#wornB)" fill="none" stroke="currentColor">
        <rect x="4" y="4" width="172" height="112" rx="10" stroke-width="3.5"/><rect x="11" y="11" width="158" height="98" rx="6" stroke-width="1.2"/>
        <line x1="22" y1="44" x2="158" y2="44" stroke-width="1.2"/><line x1="22" y1="86" x2="158" y2="86" stroke-width="1.2"/>
        <text x="90" y="35" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="13" font-weight="600" letter-spacing="4" fill="currentColor" stroke="none">ARRIVED</text>
        <text x="90" y="73" text-anchor="middle" font-family="Noto Sans TC,sans-serif" font-size="22" font-weight="900" letter-spacing="3" fill="currentColor" stroke="none">入境許可</text>
        <text x="90" y="103" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="10.5" font-weight="600" letter-spacing="2" fill="currentColor" stroke="none">VIA CLAUDE · 2026</text>
      </g></svg>`;
    const a = document.createElement("div"); a.className = "deco-stamp tr"; a.innerHTML = round;
    const b = document.createElement("div"); b.className = "deco-stamp bl"; b.innerHTML = rect;
    document.body.append(a, b);
    // 只有捲到作品牆時才淡淡浮現
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => es.forEach((en) => document.body.classList.toggle("in-gallery", en.isIntersecting)), { rootMargin: "-30% 0px -30% 0px" }).observe(gal);
    } else document.body.classList.add("in-gallery");
  })();
  $("fTag").addEventListener("change", (e) => { state.tag = e.target.value; render(); });
  $("fSort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
  $("styleChips").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b || b.disabled) return;
    if (b.dataset.picks) state.picks = !state.picks;
    else state.style = b.dataset.style;
    renderChips(); render();
  });
  function clearFilters() {
    Object.assign(state, { q: "", style: "全部", region: "全部", tag: "全部", picks: false });
    $("q").value = ""; $("fRegion").value = "全部"; $("fTag").value = "全部";
    renderChips(); render();
  }
  $("clearBtn").addEventListener("click", clearFilters);
  $("emptyClear").addEventListener("click", clearFilters);

  /* ---------------- 縮圖日夜 ---------------- */
  function setTime(t) {
    $("grid").dataset.time = t;
    $("tDay").setAttribute("aria-pressed", String(t === "day"));
    $("tNight").setAttribute("aria-pressed", String(t === "night"));
    store.set("atlas-time", t);
  }
  $("tDay").addEventListener("click", () => setTime("day"));
  $("tNight").addEventListener("click", () => setTime("night"));
  if (store.get("atlas-time") === "night") setTime("night");

  /* ---------------- 外觀（深色／淺色） ---------------- */
  const root = document.documentElement;
  const savedTheme = store.get("atlas-theme");
  // 預設跟著訪客系統的深色／淺色設定；按過右上角切換鈕後，記住他的選擇
  const sysDark = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const pickTheme = () => (savedTheme === "dark" || savedTheme === "light") ? savedTheme : (sysDark && sysDark.matches ? "dark" : "light");
  root.dataset.theme = pickTheme();
  if (sysDark && sysDark.addEventListener) sysDark.addEventListener("change", () => { if (!store.get("atlas-theme")) root.dataset.theme = sysDark.matches ? "dark" : "light"; });
  $("themeBtn").addEventListener("click", () => {
    const isDark = root.dataset.theme ? root.dataset.theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = isDark ? "light" : "dark";
    store.set("atlas-theme", root.dataset.theme);
  });

  /* ---------------- 減少動態開關 ---------------- */
  // 只存在這個網站（localStorage 的 atlas-motion），不改瀏覽器或系統設定；沒按過就照系統的「減少動態效果」
  (() => {
    const M = window.atlasMotion; if (!M) return;
    const nav = $("motionNav"), btn = $("motionBtn");
    const sync = () => {
      const on = M.reduced();
      btn.setAttribute("aria-pressed", String(on)); btn.title = on ? "減少動態：開（再按一下恢復動畫）" : "減少動態：關";
      nav.setAttribute("aria-checked", String(on));
    };
    const toggle = () => {
      M.set(M.reduced() ? "full" : "reduce"); sync();
      // 首屏精選、預覽視窗裡的作品重新載入，套用新設定
      ["pickFrame", "vFrame"].forEach((id) => { const f = $(id); if (f && f.src && !/about:blank/.test(f.src)) f.src = f.src; });
      stopLive();
    };
    btn.addEventListener("click", toggle);
    nav.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });
    if (rmq && rmq.addEventListener) rmq.addEventListener("change", sync);
    sync();
  })();

  /* ---------------- 手機選單 ---------------- */
  (() => {
    const bar = document.querySelector(".topbar"), btn = $("menuBtn"), nav = $("mainNav");
    const set = (on) => { bar.classList.toggle("open", on); btn.setAttribute("aria-expanded", String(on)); btn.setAttribute("aria-label", on ? "關閉選單" : "開啟選單"); };
    btn.addEventListener("click", (e) => { e.stopPropagation(); set(!bar.classList.contains("open")); });
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
    document.addEventListener("click", (e) => { if (!bar.contains(e.target)) set(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && bar.classList.contains("open")) { set(false); btn.focus(); } });
    window.addEventListener("resize", () => { if (innerWidth > 560) set(false); });
  })();

  /* ---------------- 預覽視窗 ---------------- */
  const dlg = $("viewer");
  let current = null;
  function openViewer(s) {
    current = s;
    $("vId").textContent = s.id;
    $("vTitle").textContent = s.title;
    $("vPlace").textContent = s.place;
    $("vMeta").innerHTML = `<span class="tag style">${esc(s.style)}</span>` + (s.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
    $("vFallback").hidden = true; $("vPromptText").value = "";
    $("vOpen").href = sceneUrl(s);
    $("vFrame").title = `${s.title} 場景預覽`;
    $("vFrame").src = sceneUrl(s);
    if (!dlg.open) dlg.showModal();
    track("open", s.id);
    try { history.replaceState(null, "", "#" + key(s.id)); } catch (e) { location.hash = key(s.id); }
  }
  function closeViewer() {
    if (dlg.open) dlg.close();
  }
  dlg.addEventListener("close", () => {
    $("vFrame").src = "about:blank";
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
  });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) closeViewer(); });
  $("vClose").addEventListener("click", closeViewer);
  function step(d) {
    const list = visible.length ? visible : SCENES;
    let i = list.findIndex((x) => x.id === current.id);
    if (i < 0) i = 0;
    openViewer(list[(i + d + list.length) % list.length]);
  }
  $("vPrev").addEventListener("click", () => step(-1));
  $("vNext").addEventListener("click", () => step(1));
  $("vCopy").addEventListener("click", (e) => copyPrompt(current, e.currentTarget));
  $("vDownload").addEventListener("click", () => openDl(current, "pure"));


  // 網址 #sc-07 可直接打開該組預覽
  function fromHash() {
    const h = decodeURIComponent(location.hash.slice(1)).toLowerCase();
    const s = SCENES.find((x) => key(x.id) === h);
    if (s) openViewer(s);
  }
  window.addEventListener("hashchange", fromHash);

  /* 精選播放區：進到畫面才載入場景，避免拖慢首頁 */
  let pickIndex = 0, pickVisible = false, pickStart = Date.now(), pickElapsed = 0;
  const PICK_SECS = 22;   // 首屏輪播：每組約 22 秒，開著配樂或捲離時暫停
  function showPick(i, load) {
    const s = PICKS[i]; if (!s) return;
    pickIndex = i;
    $("pickId").textContent = s.id;
    $("pickTitle").textContent = s.title;
    $("pickPlace").textContent = `${s.region}　·　${s.style}`;
    $("pickNo").textContent = String(i + 1).padStart(2, "0");
    $("pickSum").textContent = s.summary || "";
    pickStart = Date.now(); pickElapsed = 0;
    $("pickFrame").title = `${s.title}（作者精選）`;
    $("pickFrame").parentElement.style.backgroundImage = `url("${thumb(s, "day")}")`;
    $("picksList").querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-current", String(j === i)));
    if (load || pickVisible) {
      if (pickMusic().playing) pickMusic().stop();
      $("pickFrame").src = pureUrl(s); pickVisible = true;
    }
  }

  /* 精選配樂：場景檔裡有 window.sceneMusic 的就能播。
     瀏覽器規定要使用者點過才能出聲，所以在點擊當下先建立 AudioContext，再交給場景用 */
  let musicOn = false, audioCtx = null, picksInView = true;
  const NO_MUSIC = { playing: false, start() {}, stop() {} };
  function pickMusic() {
    try { return $("pickFrame").contentWindow.sceneMusic || NO_MUSIC; } catch (e) { return NO_MUSIC; }
  }
  function unlockAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state !== "running") audioCtx.resume();
  }
  function syncMusic() {
    const m = pickMusic(), b = $("pickMusic");
    b.hidden = m === NO_MUSIC;
    if (musicOn && picksInView && !document.hidden && m !== NO_MUSIC) m.start(audioCtx || undefined);
    else if (m.playing) m.stop();
    b.setAttribute("aria-pressed", String(musicOn));
    $("pickMusicText").textContent = musicOn ? "配樂播放中" : "播放配樂";
  }
  function musicGesture(on) { musicOn = on; if (on) unlockAudio(); syncMusic(); }
  if (PICKS.length) {
    $("picks").hidden = false;
    $("picksList").innerHTML = PICKS.map((s, i) => `<li><button type="button" data-i="${i}" aria-current="false">
        <img src="${thumb(s, "day")}" alt="" loading="lazy" width="960" height="360">
        <span class="n">${String(i + 1).padStart(2, "0")}</span><span class="t">${esc(s.title)}</span>
        <span class="p">${esc(s.place)}・${esc(s.style)}</span></button></li>`).join("");
    $("picksList").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-i]"); if (!b) return;
      musicGesture(true); showPick(+b.dataset.i, true);
    });
    $("pickFrame").addEventListener("load", syncMusic);
    $("pickMusic").addEventListener("click", () => musicGesture(!musicOn));
    $("navPicks").addEventListener("click", () => { musicGesture(true); if (!pickVisible) showPick(pickIndex, true); });
    $("pickMore").addEventListener("click", () => { musicOn = false; syncMusic(); openViewer(PICKS[pickIndex]); });
    $("pickDl").addEventListener("click", () => openDl(PICKS[pickIndex], "pure"));
    $("pickTotal").textContent = String(PICKS.length).padStart(2, "0");
    const step = (d) => showPick((pickIndex + d + PICKS.length) % PICKS.length, true);
    $("pickPrev").addEventListener("click", () => step(-1));
    $("pickNext").addEventListener("click", () => step(1));
    // 輪播進度：只在首屏看得到、沒開配樂時往前走
    let lastTick = Date.now();
    setInterval(() => {
      const now = Date.now(), dt = now - lastTick; lastTick = now;
      if (!musicOn && picksInView && !document.hidden && pickVisible) pickElapsed += dt;
      const p = Math.min(1, pickElapsed / (PICK_SECS * 1000));
      const cur = $("picksList").querySelector('button[aria-current="true"]'); if (cur) cur.style.setProperty("--p", p.toFixed(3));
      if (p >= 1) step(1);
    }, 200);
    // iframe 依首屏高度蓋滿
    if ("ResizeObserver" in window) new ResizeObserver(([x]) => $("picks").style.setProperty("--th-h", x.contentRect.height + "px")).observe($("picks"));
    showPick(0, false);
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((en) => { if (en.some((x) => x.isIntersecting)) { showPick(pickIndex, true); io.disconnect(); } }, { rootMargin: "200px" });
      io.observe($("picks"));
      // 捲離精選區時配樂淡出，捲回來再接著播
      // 清單高度跟著左邊播放畫面走，兩邊上下對齊
      if ("ResizeObserver" in window) new ResizeObserver(([x]) => $("picksList").style.setProperty("--stage-h", x.contentRect.height + "px")).observe($("pickFrame").parentElement);
      new IntersectionObserver((en) => { picksInView = en[en.length - 1].isIntersecting; syncMusic(); }, { threshold: 0.15 }).observe($("picks"));
    } else showPick(0, true);
    document.addEventListener("visibilitychange", syncMusic);
  } else {
    $("navPicks").hidden = true;
  }

  // 按 / 直接跳到搜尋框
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
    const el = document.activeElement;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    if (document.querySelector("dialog[open]")) return;
    e.preventDefault();
    $("gallery").scrollIntoView({ behavior: "smooth", block: "start" });
    $("q").focus({ preventScroll: true });
  });

  renderChips();
  render();
  fromHash();
})();
