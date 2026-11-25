#!/usr/bin/env python3
"""把 ShowStop 模組與場景專屬設定（adapter）注入場景 HTML。
用法：python3 showstop_inject.py 場景檔.html adapter.js [錨點字串]
- 模組放在主程式第一個 <body> 內的 <script> 之前（已存在就更新）。
- adapter 放在錨點之前；沒給錨點時放在主程式最後一個 '})();\n</script>' 之前（IIFE 內，看得到 show 等變數）。
"""
import re, sys, pathlib
here = pathlib.Path(__file__).parent
MOD = (here / 'showstop.js').read_text()
f = pathlib.Path(sys.argv[1]); ad = pathlib.Path(sys.argv[2]).read_text().strip()
anchor = sys.argv[3] if len(sys.argv) > 3 else None
s = f.read_text()
# 先拿掉舊的 adapter 區塊（它的註解裡也有 <script id="showstop"> 字樣，必須先處理），再拿掉舊模組
s = re.sub(r'\n?/\* ShowStop：再按一下優雅停止表演.*?/\* /ShowStop \*/\n', '\n', s, flags=re.S)
s = re.sub(r'^<script id="showstop">\n.*?\n</script>\n', '', s, count=1, flags=re.S | re.M)
body = next((k for k in (s.find('<body'), s.find('</head>'), s.rfind('</style>')) if k >= 0), 0)  # 有的檔案沒有 <body>
i = s.index('<script', body)
s = s[:i] + '<script id="showstop">\n' + MOD.strip() + '\n</script>\n' + s[i:]
block = '/* ShowStop：再按一下優雅停止表演（共用模組在上方 <script id="showstop">） */\n' + ad + '\n/* /ShowStop */\n'
if anchor:
    j = s.index(anchor)
else:
    # 主程式（showstop 之後的第一個 script）裡最後一個 '})();' 再接 </script>
    k = s.index('</script>', s.index('<script id="showstop">') + 10)
    main_start = s.index('<script', k)
    main_end = s.index('</script>', main_start)
    j = s.rfind('})();', main_start, main_end)
    if j < 0: raise SystemExit('找不到 IIFE 結尾，請給錨點')
s = s[:j] + block + s[j:]
f.write_text(s)
print('ok', f.name)
