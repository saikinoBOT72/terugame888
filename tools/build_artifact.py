"""公開ページ用のコピーを作る：<!--BODY-START--> より後ろだけを取り出し、html/head/body の外枠を外す。
同じリポジトリのファイルを読む <link rel="stylesheet" href="…"> と <script src="…"></script> は中身を埋め込む（1ファイルにする）。
使い方: python3 tools/build_artifact.py index.html 出力先.html"""
import os, re, sys
src, dst = sys.argv[1], sys.argv[2]
base = os.path.dirname(os.path.abspath(src))
s = open(src, encoding='utf-8').read().split('<!--BODY-START-->\n', 1)[1]
for t in ['</head>\n', '<body>\n', '</body>\n', '</html>\n']:
    s = s.replace(t, '')
local = lambda h: not re.match(r'^(https?:)?//', h)
read = lambda h: open(os.path.join(base, h), encoding='utf-8').read()
s = re.sub(r'<link rel="stylesheet" href="([^"]+)">', lambda m: '<style>\n' + read(m[1]) + '</style>' if local(m[1]) else m[0], s)
s = re.sub(r'<script src="([^"]+)"></script>', lambda m: '<script>\n' + read(m[1]) + '</script>' if local(m[1]) else m[0], s)
open(dst, 'w', encoding='utf-8').write(s)
print('wrote', dst)
