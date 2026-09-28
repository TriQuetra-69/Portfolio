import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); logs=[]
        pg=await b.new_page(viewport={'width':1280,'height':720}); pg.on('pageerror', lambda e: logs.append(str(e)))
        await pg.goto('http://localhost:3000/'); await pg.wait_for_timeout(3000)
        for i in range(10): await pg.mouse.move(300+i*40, 400, steps=2); await pg.wait_for_timeout(40)
        a=await pg.evaluate("(() => { const c=document.getElementById('cursorFx'); const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for(let i=3;i<d.length;i+=4) if(d[i]>0) n++; return n; })()")
        await pg.mouse.click(640,400); await pg.wait_for_timeout(120)
        c=await pg.evaluate("(() => { const c=document.getElementById('cursorFx'); const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for(let i=3;i<d.length;i+=4) if(d[i]>0) n++; return n; })()")
        print('pixels after moving:',a,' after click:',c,' errors:',logs); await b.close()
asyncio.run(main())
