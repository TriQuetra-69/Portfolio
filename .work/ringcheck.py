import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); logs=[]
        pg=await b.new_page(viewport={'width':1280,'height':720}); pg.on('pageerror', lambda e: logs.append(str(e)))
        await pg.goto('http://localhost:3000/'); await pg.wait_for_timeout(3000)
        await pg.mouse.move(200,300); await pg.mouse.move(900,500)
        r=await pg.evaluate("(() => { const r=document.querySelector('.cursor-ring').getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]; })()")
        print('mouse at (900,500), ring centre at', r, 'errors:', logs); await b.close()
asyncio.run(main())
