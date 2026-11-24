/* 微互動：漣漪點擊、風格標籤滑動底塊、作者精選星星爆開、縮圖骨架載入 */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  // 記住最後按的按鈕（Safari 點按鈕不會 focus，下載完成要回到那顆按鈕打勾）
  document.addEventListener("pointerdown", (e) => {
    const b = e.target.closest(".btn"); if (b) window.__lastBtn = b;
    const r = e.target.closest(".btn,.chips button,.seg button");
    if (!r || r.disabled || reduce.matches) return;
    const box = r.getBoundingClientRect(), d = Math.max(box.width, box.height) * 2.2;
    const s = document.createElement("span"); s.className = "rip";
    s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - box.left - d / 2}px;top:${e.clientY - box.top - d / 2}px`;
    r.appendChild(s); s.addEventListener("animationend", () => s.remove());
  }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { const b = e.target.closest && e.target.closest(".btn"); if (b) window.__lastBtn = b; } }, true);

  // 風格標籤：一塊底色滑到被選的標籤
  const chips = document.getElementById("styleChips");
  let last = null;
  function placeInk(animate) {
    if (!chips) return;
    const on = chips.querySelector('button[data-style][aria-pressed="true"]');
    let ink = chips.querySelector(".ink");
    if (!on) { if (ink) ink.remove(); chips.classList.remove("has-ink"); last = null; return; }
    const fresh = !ink;
    if (fresh) { ink = document.createElement("i"); ink.className = "ink"; ink.setAttribute("aria-hidden", "true"); chips.prepend(ink); }
    const x = on.offsetLeft, w = on.offsetWidth, pick = false;
    if (fresh && last) { ink.classList.add("still"); ink.style.transform = `translateX(${last.x}px)`; ink.style.width = last.w + "px"; ink.classList.toggle("pick", last.pick); void ink.offsetWidth; ink.classList.remove("still"); }
    if (!animate || reduce.matches) ink.classList.add("still");
    ink.style.transform = `translateX(${x}px)`; ink.style.width = w + "px"; ink.style.top = on.offsetTop + "px"; ink.style.height = on.offsetHeight + "px";
    ink.classList.toggle("pick", pick);
    if (!animate || reduce.matches) { void ink.offsetWidth; ink.classList.remove("still"); }
    chips.classList.add("has-ink");
    last = { x, w, pick };
  }
  if (chips) {
    new MutationObserver(() => placeInk(true)).observe(chips, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
    addEventListener("resize", () => placeInk(false));
    requestAnimationFrame(() => placeInk(false));
    if (document.fonts) document.fonts.ready.then(() => placeInk(false));
    // 作者精選：星星爆開
    chips.addEventListener("click", (e) => {
      const b = e.target.closest(".pick-chip"); if (!b || reduce.matches) return;
      setTimeout(() => {
        const nb = chips.querySelector(".pick-chip"); if (!nb || nb.getAttribute("aria-pressed") !== "true") return;
        nb.classList.remove("burst"); void nb.offsetWidth; nb.classList.add("burst");
        const svg = nb.querySelector("svg"); if (!svg) return;
        const cr = chips.getBoundingClientRect(), sr = svg.getBoundingClientRect();
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * Math.PI * 2, sp = document.createElement("i"); sp.className = "spark";
          sp.style.cssText = `left:${sr.left - cr.left + chips.scrollLeft + sr.width / 2 - 2.5}px;top:${sr.top - cr.top + sr.height / 2 - 2.5}px;--dx:${Math.cos(a) * 18}px;--dy:${Math.sin(a) * 18}px`;
          chips.appendChild(sp); sp.addEventListener("animationend", () => sp.remove());
        }
      }, 0);
    });
  }

  // 縮圖骨架：圖載入前顯示流光
  function watch(plate) {
    const img = plate.querySelector("img:not(.night)");
    if (!img || img.complete && img.naturalWidth) { plate.classList.add("loaded"); return; }
    const done = () => plate.classList.add("loaded");
    img.addEventListener("load", done, { once: true }); img.addEventListener("error", done, { once: true });
  }
  const grid = document.getElementById("grid");
  if (grid) {
    grid.querySelectorAll(".plate").forEach(watch);
    new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => n.querySelectorAll && n.querySelectorAll(".plate").forEach(watch)))).observe(grid, { childList: true, subtree: true });
  }
})();
