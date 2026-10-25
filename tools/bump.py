# 公開のたびに実行：ブラウザが古いファイルを使い続けないよう、読みこむファイルに版番号をつける
import glob, json, os, re, time
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
v = time.strftime('%Y%m%d%H%M%S')
imports = {"three": "./vendor/three.module.min.js", "three/addons/": "./vendor/addons/"}
for f in sorted(glob.glob(os.path.join(root, 'js', '*.js'))):
    n = './js/' + os.path.basename(f)
    imports[n] = f'{n}?v={v}'
p = os.path.join(root, 'index.html')
s = open(p, encoding='utf-8').read()
s = re.sub(r'<script type="importmap">.*?</script>', '<script type="importmap">\n' + json.dumps({"imports": imports}, indent=1, ensure_ascii=False) + '\n</script>', s, flags=re.S)
s = re.sub(r'href="style\.css(\?v=\d+)?"', f'href="style.css?v={v}"', s)
s = re.sub(r'src="js/main\.js(\?v=\d+)?"', f'src="js/main.js?v={v}"', s)
open(p, 'w', encoding='utf-8').write(s)
print('version', v)
