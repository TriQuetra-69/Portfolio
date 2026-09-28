import base64, re
b64=lambda p: base64.b64encode(open(p,'rb').read()).decode()
html=open('index.html').read(); css=open('style.css').read()
html=re.sub(r'\?v=\d+"', '"', html)
css=re.sub(r"url\((assets/fonts/[^)]+\.woff2)\)", lambda m: f"url(data:font/woff2;base64,{b64(m.group(1))})", css)
html=html.replace('<link rel="stylesheet" href="style.css" />', f'<style>\n{css}\n</style>')
for js in ['assets/three.min.js','config.js','scene.js','app.js','fx.js']:
    code=open(js).read(); assert '</script' not in code.lower(), js
    html=html.replace(f'<script src="{js}"></script>', f'<script>\n{code}\n</script>')
pdf='data:application/pdf;base64,'+b64('assets/Sanskar_Pandey_Resume.pdf')
html=html.replace('href="assets/Sanskar_Pandey_Resume.pdf"', f'href="{pdf}"')
open('/home/user/Sanskar_Pandey_Portfolio.html','w').write(html)
print(len(html)//1024,'KB')
