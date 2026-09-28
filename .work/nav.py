import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); logs=[]
        pg=await b.new_page(viewport={'width':1280,'height':720}); pg.on('pageerror', lambda e: logs.append(str(e)))
        await pg.goto('http://localhost:3000/'); await pg.wait_for_selector('#loader.done', state='attached', timeout=120000); await pg.wait_for_timeout(1500)
        await pg.click('a[href="#projects"]'); await pg.wait_for_timeout(8000); a=await pg.evaluate('Math.round(scrollY)'); await pg.wait_for_timeout(15000); print('after 8s:', a)
        y=await pg.evaluate("[Math.round(window.scrollY), document.getElementById('projects').offsetTop]")
        print('scrollY, projects top:', y, '| errors:', logs); await b.close()
asyncio.run(main())
