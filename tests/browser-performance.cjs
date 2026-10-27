// Run against a staged project path, with Playwright available through NODE_PATH:
// ATLAS_URL=http://127.0.0.1:8897/atlasTamaki/ node tests/browser-performance.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.ATLAS_URL || 'http://127.0.0.1:8897/atlasTamaki/';
const browserOptions = {headless: true};
if (process.env.CHROME_PATH) browserOptions.executablePath = process.env.CHROME_PATH;
(async () => {
  const browser = await chromium.launch(browserOptions);
  try {
    for (const mobile of [false, true]) {
      const page = await browser.newPage(mobile ? {viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3} : {viewport:{width:1440,height:900}});
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(base);
      await page.waitForFunction(() => !document.querySelector('#loading'));
      await page.waitForFunction(() => map.loaded());
      await page.waitForTimeout(500);
      const startup = await page.evaluate(() => ({
        stickers:STICKERS.length,
        visible:STICKERS.filter(s=>s.el.style.display!=='none').length,
        originals:performance.getEntriesByType('resource').filter(r=>/\/images\/(?!optimized)/.test(r.name)).length,
        imageBytes:performance.getEntriesByType('resource').filter(r=>/\/images\//.test(r.name)).reduce((sum,r)=>sum+r.encodedBodySize,0),
        listChildren:document.querySelector('#list').childElementCount
      }));
      assert.equal(startup.stickers,36);
      assert.equal(startup.originals,0,'startup must not download original images');
      assert.equal(startup.listChildren,0,'hidden list must not be built');
      assert.ok(startup.imageBytes < 500000);
      await page.locator('#introGo').click();
      await page.locator('#listBtn').click();
      assert.ok(await page.locator('.card').count() > 10);
      await page.locator('.card').first().click();
      await page.waitForSelector('#panel.open');
      assert.match(await page.locator('.hero img').getAttribute('src'), /-960\.webp$/);
      await page.locator('#tsToggle').check();
      await page.waitForFunction(() => !!map.getSource('truescale'));
      assert.match(await page.evaluate(() => map.getStyle().sources.truescale.url), /-2048\.webp$/);
      await page.locator('#tsToggle').uncheck();
      await page.locator('.hero .zoom').click();
      await page.waitForFunction(() => {const img=document.querySelector('#lightbox img');return img.complete && img.naturalWidth>0;});
      assert.doesNotMatch(await page.locator('#lightbox img').getAttribute('src'), /optimized/);
      await page.locator('#lightbox').click();
      await page.locator('.ptop .x').click();
      await page.locator('#search').fill('rosedale');
      await page.waitForTimeout(300);
      assert.equal(await page.locator('#results [data-slug]').count(),1);
      const filter = await page.evaluate(() => ({line:map.getFilter('geo-line'),hit:map.getFilter('geo-hit')}));
      assert.deepEqual(filter.line,filter.hit,'hidden routes must not keep their hit target');
      await page.locator('#search').fill('');
      await page.locator('#search').blur();
      await page.evaluate(() => {map.jumpTo({center:[174.8,-36.89],zoom:11.6});});
      await page.waitForTimeout(1000);
      // A stationary hover should settle without continuously repainting the WebGL map.
      const repaint = await page.evaluate(async () => {
        let renders=0, layouts=0;
        const original=jostle;
        jostle=(...args)=>{layouts++;return original(...args);};
        const count=()=>renders++;
        map.on('render',count);
        hovered=STICKERS.find(s=>s.p);kick();
        await new Promise(r=>setTimeout(r,1200));
        const settledLayouts=layouts;
        await new Promise(r=>setTimeout(r,300));
        map.off('render',count);jostle=original;
        return {renders,layouts,settledLayouts};
      });
      assert.equal(repaint.layouts,repaint.settledLayouts,'animation must settle');
      assert.ok(repaint.renders<8,`hover caused ${repaint.renders} WebGL repaints`);
      // Geography changes must cull offscreen stickers and bring them back on return.
      await page.evaluate(() => map.jumpTo({center:[0,0],zoom:8}));
      await page.waitForFunction(() => STICKERS.every(s => s.el.style.display === "none" || s === hovered));
      await page.evaluate(() => {hovered=null;map.jumpTo({center:[174.8,-36.89],zoom:11.6});});
      await page.waitForFunction(() => STICKERS.some(s => s.el.style.display !== "none"));
      assert.ok(await page.evaluate(() => map.getPixelRatio() <= 2));
      // Exercise an actual route: the current catalogue happens to contain pictures only.
      await page.evaluate(() => {
        const idea=IDEAS[0], [lng,lat]=idea.images[0].center;
        idea.geometry={type:"LineString",coordinates:[[lng,lat],[lng+.01,lat+.01]]};
        map.getSource("geo").setData({type:"FeatureCollection",features:[{type:"Feature",geometry:idea.geometry,properties:{slug:idea.slug,color:CATS[idea.category].color}}]});
        hovered=STICKERS.find(s=>s.idea===idea);lastHl=null;kick();
      });
      await page.waitForFunction(() => map.getFeatureState({source:"geo",id:IDEAS[0].slug}).highlight === true);
      await page.locator('.basemap-control summary').click();
      await page.locator('.basemap-control input[value="streets"]').check();
      await page.waitForFunction(() => document.querySelector('.basemap-control fieldset').disabled === false && document.querySelector('.basemap-status').hidden);
      await page.waitForFunction(() => map.getFeatureState({source:"geo",id:IDEAS[0].slug}).highlight === true);
      assert.ok(await page.evaluate(() => !!map.getLayer("transport-rail-line") && !!map.getLayer("geo-hit")));
      await page.waitForFunction(() => map.loaded());
      await page.screenshot({path:`/tmp/atlas-${mobile?'mobile':'desktop'}.png`});
      console.log(JSON.stringify({device:mobile?'mobile':'desktop',startup,repaint,errors}));
      assert.deepEqual(errors,[]);
      await page.close();
    }
    // Slow images cannot block startup or direct links.
    const delayed = await browser.newPage();
    await delayed.route('**/images/**',route=>route.abort());
    await delayed.goto(base+'#idea/rosedale-busway-station');
    await delayed.waitForFunction(()=>!document.querySelector('#loading'));
    assert.equal(await delayed.locator('#panel h1').textContent(),'Rosedale busway station');
    await delayed.close();
    // Editor still initializes, shows optimized thumbnails and preserves source paths on export.
    const editor = await browser.newPage();
    const editorErrors=[];editor.on('pageerror',e=>editorErrors.push(e.message));
    await editor.goto(base+'editor.html#idea/rosedale-busway-station');
    await editor.waitForFunction(()=>STICKERS.length===36 && !!cur);
    const exported=await editor.evaluate(()=>({image:cleanIdea(cur).images[0], original:cur.images[0].src,thumb:EL.get(cur.images[0]).querySelector('img').getAttribute('src')}));
    assert.equal(exported.image.file,exported.original);
    assert.ok(!JSON.stringify(exported.image).includes('optimized'));
    assert.deepEqual(editorErrors,[]);
    await editor.close();
    console.log('PASS: desktop/mobile interactions, deferred originals, idle rendering, blocked images, direct links, editor export');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
