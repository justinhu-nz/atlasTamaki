// ATLAS_URL=http://127.0.0.1:8765/ CHROME_PATH=/path/to/chrome node tests/browser-clipboard.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({headless:true,...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
  try {
    const page = await browser.newPage();
    const errors=[], uploads=[];
    page.on('pageerror', e=>errors.push(e.message));
    // Exercise the upload flow without writing test images or ideas into the user's project.
    await page.route('**/images/pasted-*', async route => {
      const request=route.request();
      if (request.method() !== 'PUT') return route.continue();
      uploads.push({name:new URL(request.url()).pathname.split('/').pop(),bytes:request.postDataBuffer().length});
      await route.fulfill({json:{path:'images/'+uploads.at(-1).name}});
    });
    await page.goto(new URL('editor.html',process.env.ATLAS_URL || 'http://127.0.0.1:8765/').href);
    await page.waitForFunction(()=>server && STICKERS.length>0 && !!document.querySelector('#ideaList'));
    const initial = await page.evaluate(()=>IDEAS.length);
    const paste = (count=1,fallback=false) => page.evaluate(({count,fallback})=>{
      const canvas=document.createElement('canvas');canvas.width=20;canvas.height=10;
      canvas.getContext('2d').fillRect(0,0,20,10);
      const bytes=Uint8Array.from(atob(canvas.toDataURL().split(',')[1]),c=>c.charCodeAt(0));
      const data=new DataTransfer();
      for(let i=0;i<count;i++)data.items.add(new File([bytes],'image.png',{type:'image/png'}));
      const e=new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data});
      if(fallback)Object.defineProperty(e,'clipboardData',{value:{files:[],items:[...data.items]}});
      (document.querySelector('#f-description') || document.body).dispatchEvent(e);
      return e.defaultPrevented;
    },{count,fallback});
    assert.equal(await paste(),true);
    await page.waitForFunction(()=>cur?.images.length===1 && !!document.querySelector('.imgcard'));
    const added=await page.evaluate(()=>({count:IDEAS.length,aspect:curImg.aspect,center:curImg.center,mapCenter:map.getCenter().toArray(),file:curImg.file,dirty,loaded:EL.get(curImg).querySelector('img').complete}));
    assert.equal(added.count,initial+1);
    assert.equal(added.aspect,2);
    assert.deepEqual(added.center,added.mapCenter);
    assert.ok(added.dirty);
    assert.match(added.file,/^images\/pasted-image-.+\.png$/);
    // Images also paste while a description field is focused, and multiple files are added once each.
    await page.locator('#f-description').focus();
    assert.equal(await paste(2,true),true);
    await page.waitForFunction(()=>cur.images.length===3 && document.querySelectorAll('.imgcard').length===3);
    const files=await page.evaluate(()=>cur.images.map(im=>im.file));
    assert.equal(new Set(files).size,3);
    const text=await page.evaluate(()=>{
      const data=new DataTransfer();data.setData('text/plain','A normal description');
      const e=new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data});
      document.querySelector('#f-description').dispatchEvent(e);
      return {prevented:e.defaultPrevented,count:cur.images.length};
    });
    assert.deepEqual(text,{prevented:false,count:3});
    await page.evaluate(()=>undo());
    assert.equal(await page.evaluate(()=>cur.images.length),2);
    assert.equal(uploads.length,3);
    assert.ok(uploads.every(upload=>upload.bytes>0));
    assert.deepEqual(errors,[]);
    // Static hosting must export the image bytes, not a dangling images/ path.
    await page.route('**/__editor', route => route.fulfill({status:404,body:''}));
    await page.reload();
    await page.waitForFunction(()=>STICKERS.length>0 && !!document.querySelector('#ideaList'));
    await page.evaluate(()=>serverReady);
    assert.equal(await page.evaluate(()=>server),false);
    assert.equal(await paste(),true);
    await page.waitForFunction(()=>cur?.images.length===1 && !!document.querySelector('.imgcard'));
    assert.match(await page.evaluate(()=>curImg.file),/^data:image\/png;base64,/);
    const exported=await page.evaluate(()=>ideasJs());
    const downloads=[];
    page.on('download',download=>downloads.push(download.suggestedFilename()));
    const downloaded=page.waitForEvent('download');
    await page.evaluate(()=>save());
    await downloaded;
    assert.deepEqual(downloads,['ideas.js']);
    // Load the exported data into a fresh document: the clipboard blob URL is gone.
    await page.route('**/ideas.js',route=>route.fulfill({contentType:'text/javascript',body:exported}));
    await page.reload();
    await page.waitForFunction(()=>STICKERS.some(s=>s.img.file?.startsWith('data:image/')));
    const restored=await page.evaluate(async()=>{
      const img=IDEAS.flatMap(i=>i.images).find(im=>im.file?.startsWith('data:image/'));
      const picture=new Image();picture.src=img.file;await picture.decode();
      return {width:picture.naturalWidth,height:picture.naturalHeight};
    });
    assert.deepEqual(restored,{width:20,height:10});
    assert.deepEqual(errors,[]);
    console.log('PASS: clipboard upload, multiple images, item fallback, undo, text paste, single-file static export and image reload');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
