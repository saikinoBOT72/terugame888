"""公開ページ用のコピーを作る：<!--BODY-START--> より後ろだけを取り出し、html/head/body の外枠を外す。
使い方: python3 tools/build_artifact.py index.html 出力先.html"""
import sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read().split('<!--BODY-START-->\n', 1)[1]
for t in ['</head>\n', '<body>\n', '</body>\n', '</html>\n']:
    s = s.replace(t, '')
open(dst, 'w', encoding='utf-8').write(s)
print('wrote', dst)
