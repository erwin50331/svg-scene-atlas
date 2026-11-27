#!/usr/bin/env python3
"""
把網站的「減少動態」開關（assets/motion.js）嵌進每組作品，讓作品也聽網站右上角的開關。
用法：在網站根目錄執行  python3 tools/motion_inject.py  （之後再跑 tools/make-pure.py）
可重複執行：會先拿掉舊的 <script id="site-motion"> 再放新的，位置在 </head> 前。
網站的下載功能會把這段拿掉，所以下載的 HTML 不會帶著它。
"""
import pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
JS = (ROOT / "assets" / "motion.js").read_text(encoding="utf-8").strip()
TAG = ('<script id="site-motion">document.documentElement.setAttribute("data-scene-motion","");\n'
       + JS + "\n</script>\n")
RE = re.compile(r'<script id="site-motion">.*?</script>\n?', re.S)

n = 0
for f in sorted((ROOT / "scenes").glob("*.html")):
    html = RE.sub("", f.read_text(encoding="utf-8"))
    if "</head>" in html:
        html = html.replace("</head>", TAG + "</head>", 1)
    else:
        m = re.search(r"<body[^>]*>", html)
        html = html[:m.start()] + TAG + html[m.start():] if m else TAG + html
    f.write_text(html, encoding="utf-8"); n += 1
print(f"已嵌入 {n} 組作品")
