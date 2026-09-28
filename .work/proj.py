import asyncio
from playwright.async_api import async_playwright
ARGS=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=ARGS)
        pg=await b.new_page(viewport={'width':1280,'height':720}); pg.set_default_timeout(180000)
        await pg.goto('http://localhost:3000/'); await pg.wait_for_timeout(22000)
        r=await pg.evaluate("""() => { const c = SEA._debug.cam; const out = [];
          for (let a = 0; a <= 90; a += 6) { const rad = a * Math.PI / 180; const v = new THREE.Vector3(14.5 - Math.sin(rad) * 1050, 300, 18 - Math.cos(rad) * 1050).project(c);
            out.push(a + ':' + ((v.x + 1) / 2).toFixed(2) + ',' + ((1 - v.y) / 2).toFixed(2)); }
          const o = new THREE.Vector3(0, 6.4, 0).project(c); out.push('ship:' + ((o.x + 1) / 2).toFixed(2));
          return out.join('  '); }""")
        print(r); await b.close()
asyncio.run(main())
