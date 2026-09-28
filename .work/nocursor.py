import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); logs=[]
        pg=await b.new_page(viewport={'width':1280,'height':720}); pg.on('pageerror', lambda e: logs.append(str(e)))
        await pg.goto('http://localhost:3000/'); await pg.wait_for_timeout(3000)
        await pg.mouse.move(500,400); await pg.mouse.move(900,500); await pg.wait_for_timeout(300)
        n=await pg.evaluate("document.querySelectorAll('.cursor-ring, .cursor-dot').length")
        await pg.click('a[href=\"#projects\"]'); await pg.wait_for_timeout(8000)
        y=await pg.evaluate("Math.round(window.scrollY) + " (projects section at " + document.getElementById('projects').offsetTop + ")"")
        print('cursor elements:', n, '| nav click scrolled to', y, '| errors:', logs); await b.close()
asyncio.run(main())
