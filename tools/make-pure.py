#!/usr/bin/env python3
"""
產生「純插畫版」場景檔：只顯示 1600×600 動畫畫面，隱藏下方的控制列與說明文字。
用法：在網站根目錄執行  python3 tools/make-pure.py
會讀取 scenes/*.html，輸出到 scenes/pure/ （同檔名）。新增場景後重跑一次即可。
做法：在 </head> 前插入一段 CSS，不改動場景原本的程式；
場景仍會自動日夜循環，畫面上的點擊互動也都保留。
"""
import pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "scenes"
OUT = SRC / "pure"
OUT.mkdir(exist_ok=True)

PURE_CSS = """<style id="pure-art">
/* =========================================================
   純插畫版：只顯示場景畫面，隱藏控制列與說明文字。
   想恢復完整版，刪掉這整段 <style id="pure-art"> 即可。
   ========================================================= */
html,body{height:100%;margin:0!important;overflow:hidden}
body{display:flex!important;align-items:center;justify-content:center;padding:0!important}
body>.wrap{width:100%!important;max-width:min(100vw,calc(100vh * 8 / 3))!important;
  margin:0!important;padding:0!important;gap:0!important;display:block!important}
body>.wrap>:not(.stage){display:none!important}
body>.wrap>.stage{width:100%!important;max-width:100%!important;margin:0!important;
  border:0!important;border-radius:0!important;box-shadow:none!important}
</style>
"""

count = 0
for f in sorted(SRC.glob("*.html")):
    html = f.read_text(encoding="utf-8")
    html = re.sub(r'<style id="pure-art">.*?</style>\n?', "", html, flags=re.S)
    if "</head>" in html:
        html = html.replace("</head>", PURE_CSS + "</head>", 1)
    elif "</html>" in html:
        i = html.rfind("</html>")
        html = html[:i] + PURE_CSS + html[i:]
    else:
        html = html + "\n" + PURE_CSS
    (OUT / f.name).write_text(html, encoding="utf-8")
    count += 1
print(f"已產生 {count} 個純插畫版到 {OUT}")
