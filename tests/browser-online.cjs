// Run with server.py and Playwright available, as for browser-clipboard.cjs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const BASE = 'a'.repeat(40), NEXT = 'b'.repeat(40), IMAGE = 'c'.repeat(40);
(async () => {
  const browser = await chromium.launch({headless:true, ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
  try {
    const page = await browser.newPage();
    const errors=[], uploads=[], publications=[];
    let failUpload=false, failPublish=false, releasePublish;
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/__editor',route=>route.fulfill({json:{ok:true,mode:'github',publicURL:'https://justinhu-nz.github.io/atlasTamaki/'}}));
    await page.route('**/ideas.js',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync('ideas.js','utf8')+`\nwindow.ATLAS_REVISION = '${BASE}';`}));
    await page.route('**/api/images',async route=>{
      uploads.push(route.request());
      if(failUpload)return route.fulfill({status:502,json:{error:'Upload interrupted'}});
      return route.fulfill({json:{path:`images/upload-${IMAGE}.png`,sha:IMAGE}});
    });
    await page.route('**/api/publish',async route=>{
      const body=route.request().postDataJSON();publications.push(body);
      if(failPublish)return route.fulfill({status:409,json:{error:'The repository changed. Export a backup before reloading.'}});
      if(releasePublish)await new Promise(resolve=>releasePublish.resolve=resolve);
      return route.fulfill({json:{commit:NEXT,publicURL:'https://justinhu-nz.github.io/atlasTamaki/'}});
    });
    await page.route('**/api/publish-status?*',route=>route.fulfill({json:{state:'live',publicURL:'https://justinhu-nz.github.io/atlasTamaki/'}}));
    await page.goto(new URL('editor.html',process.env.ATLAS_URL || 'http://127.0.0.1:8765/').href);
    await page.waitForFunction(()=>online && STICKERS.length>0 && !!document.querySelector('#ideaList'));
    assert.equal(await page.locator('#viewLink').getAttribute('href'),'https://justinhu-nz.github.io/atlasTamaki/');
    const paste=()=>page.evaluate(()=>{
      const canvas=document.createElement('canvas');canvas.width=20;canvas.height=10;
      const bytes=Uint8Array.from(atob(canvas.toDataURL().split(',')[1]),c=>c.charCodeAt(0));
      const data=new DataTransfer();data.items.add(new File([bytes],'image.png',{type:'image/png'}));
      document.body.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));
    });
    await paste();
    await page.waitForFunction(()=>cur?.images.length===1 && imageTasks.size===0);
    assert.equal(uploads.length,1);
    assert.equal(uploads[0].headers()['x-atlas-editor'],'1');
    assert.ok(uploads[0].postDataBuffer().length>0);
    assert.equal(await page.locator('#save').textContent(),'Publish changes');
    await page.locator('#save').click();
    await page.waitForFunction(()=>!publishing && !dirty && window.ATLAS_REVISION==='b'.repeat(40));
    assert.equal(publications[0].base,BASE);
    assert.deepEqual(publications[0].uploads,[{path:`images/upload-${IMAGE}.png`,sha:IMAGE}]);
    assert.ok(publications[0].data.ideas.some(i=>i.images.some(im=>im.file===`images/upload-${IMAGE}.png`)));
    assert.doesNotMatch(JSON.stringify(publications[0]),/blob:/);
    await page.waitForFunction(()=>document.querySelector('#saveInfo').textContent.includes('map is live'));
    // Edits made while the previous snapshot is publishing must stay dirty.
    releasePublish={};
    await page.evaluate(()=>{cur.description='First edit';markDirty();});
    await page.locator('#save').click();
    await page.waitForFunction(()=>publishing);
    await page.evaluate(()=>{cur.description='Second edit while publishing';markDirty();});
    while(!releasePublish.resolve)await new Promise(resolve=>setTimeout(resolve,10));
    releasePublish.resolve(); releasePublish=null;
    await page.waitForFunction(()=>!publishing);
    assert.equal(await page.evaluate(()=>dirty),true);
    // Conflicts retain the edit and allow a self-contained image backup.
    failPublish=true;
    await page.locator('#save').click();
    await page.waitForSelector('[data-backup]');
    assert.equal(await page.evaluate(()=>dirty),true);
    const downloadEvent=page.waitForEvent('download');
    await page.locator('[data-backup]').click();
    const download=await downloadEvent;
    const stream=await download.createReadStream();
    const chunks=[];for await(const chunk of stream)chunks.push(chunk);
    const backup=Buffer.concat(chunks).toString();
    assert.match(backup,/data:image\/png;base64,/);
    assert.match(backup,/Second edit while publishing/);
    // An upload failure must not add a reference that can't be published.
    const count=await page.evaluate(()=>cur.images.length);
    failUpload=true;await paste();
    await page.waitForFunction(()=>imageTasks.size===0);
    assert.equal(await page.evaluate(()=>cur.images.length),count);
    assert.deepEqual(errors,[]);
    console.log('PASS: online paste/upload, atomic publish payload, live confirmation, concurrent edits, conflicts, self-contained backup, failed uploads');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
