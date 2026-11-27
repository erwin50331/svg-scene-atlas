/* =========================================================
   網站的「減少動態」開關（site-motion）
   - 只存在這個網站的 localStorage（atlas-motion = reduce / full），不改瀏覽器或系統設定。
   - 沒按過開關時完全照系統的「減少動態效果」設定。
   - 做法：讓 matchMedia("(prefers-reduced-motion…)") 與 CSS 的
     @media (prefers-reduced-motion…) 改聽網站設定，作品本身的程式不用改。
   - 下載的 HTML 檔會移除這段，單獨打開也照系統設定。
   ========================================================= */
(function () {
  var KEY = "atlas-motion";
  var RE = /\(\s*prefers-reduced-motion\s*(?::\s*(reduce|no-preference)\s*)?\)/gi;
  var YES = "(min-width:0px)", NO = "(max-width:0px) and (min-width:1px)";
  var realMM = window.matchMedia ? window.matchMedia.bind(window) : null;
  var sys = realMM ? realMM("(prefers-reduced-motion: reduce)") : { matches: false };

  function read() { try { var v = localStorage.getItem(KEY); return v === "reduce" || v === "full" ? v : null; } catch (e) { return null; } }
  var pref = read();
  function reduced() { return pref ? pref === "reduce" : !!sys.matches; }

  /* JS 端：matchMedia 改聽網站設定 */
  var fakes = [];
  if (realMM) window.matchMedia = function (q) {
    var s = String(q);
    if (!/prefers-reduced-motion/i.test(s)) return realMM(q);
    var calc = function () {
      if (!pref) return realMM(s).matches;
      return realMM(s.replace(RE, function (m, v) { return (v && v.toLowerCase() === "no-preference") === !reduced() ? YES : NO; })).matches;
    };
    var ls = [], mq = {
      media: s, onchange: null,
      get matches() { return calc(); },
      addEventListener: function (t, f) { if (t === "change" && f) ls.push(f); },
      removeEventListener: function (t, f) { ls = ls.filter(function (x) { return x !== f; }); },
      addListener: function (f) { if (f) ls.push(f); },
      removeListener: function (f) { ls = ls.filter(function (x) { return x !== f; }); },
      dispatchEvent: function () { return false; },
      _fire: function () { var e = { matches: calc(), media: s }; ls.forEach(function (f) { try { f.call(mq, e); } catch (x) {} }); if (mq.onchange) try { mq.onchange(e); } catch (x) {} }
    };
    fakes.push(mq);
    return mq;
  };

  /* CSS 端：把 @media (prefers-reduced-motion…) 換成恆真／恆假條件 */
  function walk(rules) {
    for (var i = 0; rules && i < rules.length; i++) {
      var r = rules[i];
      if (r.media && r.cssRules) {
        if (r._rmOrig === undefined) r._rmOrig = /prefers-reduced-motion/i.test(r.media.mediaText) ? r.media.mediaText : null;
        if (r._rmOrig) {
          var t = pref ? r._rmOrig.replace(RE, function (m, v) { return (v && v.toLowerCase() === "no-preference") === !reduced() ? YES : NO; }) : r._rmOrig;
          if (r.media.mediaText !== t) r.media.mediaText = t;
        }
      }
      if (r.cssRules) walk(r.cssRules);
    }
  }
  function applyCss() {
    var sh = document.styleSheets;
    for (var i = 0; i < sh.length; i++) { try { walk(sh[i].cssRules); } catch (e) { /* 跨網域字型樣式表讀不到，略過 */ } }
  }
  applyCss();
  document.addEventListener("DOMContentLoaded", applyCss);
  window.addEventListener("load", applyCss);

  function changed() {
    applyCss();
    document.documentElement.dataset.motion = reduced() ? "reduce" : "full";
    fakes.forEach(function (m) { m._fire(); });
  }
  document.documentElement.dataset.motion = reduced() ? "reduce" : "full";
  if (sys.addEventListener) sys.addEventListener("change", function () { if (!pref) changed(); });

  /* 網站主頁用：讀取／切換 */
  window.atlasMotion = {
    reduced: reduced,
    set: function (v) { pref = v === "reduce" || v === "full" ? v : null; try { pref ? localStorage.setItem(KEY, pref) : localStorage.removeItem(KEY); } catch (e) {} changed(); }
  };

  /* 作品頁：網站那邊切換後，作品重新載入套用（作品多半只在開場讀一次設定） */
  window.addEventListener("storage", function (e) {
    if (e.key !== KEY) return;
    var before = reduced(); pref = read();
    if (reduced() !== before && document.documentElement.hasAttribute("data-scene-motion")) location.reload();
    else changed();
  });
})();
