import asyncio, sys, time
from playwright.async_api import async_playwright
ARGS=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"]
mode=sys.argv[1] if len(sys.argv)>1 else 'hero'
mobile=len(sys.argv)>2 and sys.argv[2]=='m'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=ARGS); logs=[]
        vp={'viewport':{'width':390,'height':844},'is_mobile':True,'has_touch':True} if mobile else {'viewport':{'width':1280,'height':720}}
        pg=await b.new_page(**vp); pg.set_default_timeout(180000)
        pg.on('pageerror', lambda e: logs.append('ERR '+str(e)))
        pg.on('console', lambda m: logs.append(m.type+' '+m.text[:300]) if m.type in ('error','warning') else None)
        await pg.goto('http://localhost:3000/'); await pg.wait_for_timeout(15000)
        ts=int(time.time())
        if mode=='night':
            await pg.evaluate("window.SEA.setNight(true)"); await pg.wait_for_timeout(9000)
        if mode.startswith('sec:'):
            sid=mode[4:]
            await pg.evaluate(f"window.scrollTo({{top:document.getElementById('{sid}').offsetTop,behavior:'instant'}})"); await pg.wait_for_timeout(20000)
        elif not mobile:
            for i in range(5):
                await pg.mouse.move(700+i*60, 600-i*10, steps=3); await pg.wait_for_timeout(250)
            await pg.mouse.click(760, 640); await pg.wait_for_timeout(1500)
        fn=f'/home/user/{"m" if mobile else "t"}_{mode.replace(":","_")}_{ts}.png'
        await pg.screenshot(path=fn); print(fn)
        print(logs[:8]); await b.close()
asyncio.run(main())
