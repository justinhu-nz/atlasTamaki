from pathlib import Path
import re,shutil

out=Path(__file__).parent
source=Path('/Users/admin/.codex/visualizations/2026/10/25/01a171d4-5288-7b91-807f-43231d21543d')
fragment=(source/'atlas-options.html').read_text()
css=fragment.split('<style>')[1].split('</style>')[0]
js=fragment.split('<script>')[1].split('</script>')[0]
for asset in ['map','station','street','plan','bridge','junction','network']:
 shutil.copyfile(source/'atlas-assets'/f'{asset}.jpg',out/'assets'/f'{asset}.jpg')
 js=re.sub(asset+r":'data:image/jpeg;base64,[^']+'",asset+":'assets/"+asset+".jpg'",js,count=1)
js=js.replace('const ideas=[','let ideas=[')
js=js.replace("let saved=window.openai?.widgetState?.privateContent||{};", "let saved={}; try {saved=JSON.parse(localStorage.getItem('atlas-placement')||'{}'); const stored=JSON.parse(localStorage.getItem('atlas-ideas')||'null'); if(stored)ideas=stored;} catch(error) {console.warn('Saved prototype data could not be loaded',error);}")
start=js.index(' function remember()')
end=js.index('\n function xy',start)
js=js[:start]+" function remember(){try{localStorage.setItem('atlas-placement',JSON.stringify({place}));}catch{}}"+js[end:]
js=re.sub(r" if\(globalThis.Tweak&&mode==='cards'\).*?\n",'',js)
js=js.replace('Illustrative content & locations','Interactive HTML prototype')
js=js.replace("'Local preview only'","'Saved in this browser'")
js=js.replace('height:89px','height:81px')
js=js.replace("custom||assets.plan","custom||assets[ideas[editIndex].img]||ideas[editIndex].img")
js=js.replace("let zoom=1,pan=", "let editIndex=2; let zoom=1,pan=")
js=js.replace("${assets[d.img]}","${assets[d.img]||d.img}")
js=js.replace("img.src=assets[d.img]", "img.src=assets[d.img]||d.img")
js=js.replace("${assets[d.img]}","${assets[d.img]||d.img}")
js=js.replace("image.src=custom||assets[ideas[editIndex].img]||ideas[editIndex].img", "image.src=custom||assets[ideas[editIndex].img]||ideas[editIndex].img")
js=js.replace('const image=document.createElement', 'const image=document.createElement')
js=js.replace('Preview placement</button>', 'Save idea</button>')
js=js.replace('Add your own image<input', 'Replace image<input')
js=js.replace('No tracing required.', 'Drag the image or use position controls. Save to try it in all three prototypes.')
js=js.replace("const r=new FileReader();r.onload=()=>{custom=r.result;render();};r.readAsDataURL(file);", "if(file.size>2500000){alert('Choose an image smaller than 2.5 MB for this browser-local prototype.');return;}const r=new FileReader();r.onload=()=>{custom=r.result;render();};r.readAsDataURL(file);")
old="note.textContent=app.querySelector('[name=caption]').value+' — '+(app.querySelector('[name=credit]').value||'Credit not entered')+'. Session preview only.';remember();"
new="""const d=ideas[editIndex];d.title=app.querySelector('[name=caption]').value.trim()||'Untitled idea';d.credit=app.querySelector('[name=credit]').value;d.x=place.x;d.y=place.y;d.size=place.size;d.angle=place.angle;if(custom)d.img=custom;try{localStorage.setItem('atlas-ideas',JSON.stringify(ideas));note.textContent='Saved. Open any prototype to see this idea.';}catch{note.textContent='Could not save: browser storage is full or unavailable. Export JSON to keep your changes.';}remember();"""
assert old in js
js=js.replace(old,new)
needle="  app.querySelector('[type=file]').onchange="
insert="""  map.querySelector('.upload').insertAdjacentHTML('afterbegin','<label>Edit idea<select class="idea-select">'+ideas.map((d,i)=>'<option value="'+i+'">'+d.title+'</option>').join('')+'</select></label>');
  const chooser=app.querySelector('.idea-select');chooser.value=editIndex;chooser.onchange=()=>{editIndex=+chooser.value;const d=ideas[editIndex];custom=null;place={x:d.x,y:d.y,size:d.size||250,angle:d.angle??-15};app.querySelector('[name=caption]').value=d.title;app.querySelector('[name=credit]').value=d.credit||'';app.querySelector('[name=size]').value=place.size;app.querySelector('[name=angle]').value=place.angle;render();};
  app.querySelector('.editor-tools').insertAdjacentHTML('beforeend','<label>East / west<input name="east" aria-label="East west position" type="range" min="0" max="100" value="50"></label><label>North / south<input name="north" aria-label="North south position" type="range" min="0" max="100" value="43"></label><button class="export">Export ideas JSON</button>');
  app.querySelector('[name=east]').oninput=e=>{place.x=+e.target.value/100;render();};app.querySelector('[name=north]').oninput=e=>{place.y=+e.target.value/100;render();};
  app.querySelector('.export').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(ideas,null,2)],{type:'application/json'}));a.download='atlas-ideas.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
"""
assert needle in js
js=js.replace(needle,insert+needle)
js=js.replace('Source & credit</strong><br>Example', 'Source & credit</strong><br>${d.credit?escapeHtml(d.credit)+"<br>":""}Example')
js=js.replace("const root=document.getElementById('atlas-options');", "const root=document.getElementById('atlas-options');\nfunction escapeHtml(s){return String(s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));}")
# Titles are editable: escape them where interpolated into markup.
js=js.replace('${d.title}','${escapeHtml(d.title)}').replace("'+d.title+'","'+escapeHtml(d.title)+'")
js=js.replace("if(selected===i&&unfold)","if(selected===i&&unfold)")
js=js.replace("rotate(-15deg);pointer-events:none", "rotate(-15deg);pointer-events:none")
js=js.replace("${(mode==='compare'?450:340)*s}","${(d.size||(mode==='compare'?450:340))*s}")
js=js.replace("if(mode==='compare'){img.style.transform", "img.style.transform=`translate(-50%,-50%) rotate(${d.angle??-15}deg)`;if(mode==='compare'){img.style.transform")
css+='''
:root{color-scheme:light;font-family:Arial,sans-serif;background:#f3f3ed;color:#243b35}body{margin:0}.site-nav{display:flex;align-items:center;gap:8px;padding:12px 22px;flex-wrap:wrap;background:#fffefa;border-bottom:1px solid #d9dfd5}.site-nav a{color:#243b35;text-decoration:none;padding:10px 12px;border-radius:6px;font-size:13px}.site-nav a[aria-current=page]{background:#205d49;color:#fff}.site-nav .home{font-family:Georgia,serif;font-size:19px;margin-right:auto}main{max-width:1400px;margin:auto;padding:18px}#atlas-options .atlas-app{border-radius:10px}#atlas-options .atlas-map{height:calc(100vh - 262px);min-height:540px}#atlas-options .stamp{margin-right:0}#atlas-options .upload{top:72px}#atlas-options .upload select{display:block;width:100%;padding:7px;margin:7px 0 10px;background:var(--paper);color:var(--ink);border:1px solid var(--rule)}#atlas-options .editor-tools{grid-template-columns:repeat(3,minmax(0,1fr))}#atlas-options [data-mode=edit] .atlas-map{min-height:690px}#atlas-options .saved{top:230px}#atlas-options .basemap{filter:saturate(.7)}@media(max-width:600px){main{padding:8px}.site-nav{padding:8px;gap:2px}.site-nav .home{width:100%}.site-nav a{padding:9px;font-size:12px}#atlas-options .atlas-map{height:660px}#atlas-options [data-mode=edit] .atlas-map{height:820px}#atlas-options .editor-tools{grid-template-columns:1fr 1fr}}
'''
(out/'styles.css').write_text(css)
(out/'app.js').write_text(js)
pages=[('postcards.html','Anchored postcards','cards'),('plans.html','Fold-out plans','fold'),('compare.html','Compare on the ground','compare'),('editor.html','Image editor','edit')]
for filename,title,mode in pages:
 nav='<a class="home" href="index.html">Atlas Tāmaki · prototypes</a>'+''.join(f'<a href="{f}"'+(' aria-current="page"' if f==filename else '')+f'>{t}</a>' for f,t,m in pages)
 (out/filename).write_text(f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title} — Atlas Tāmaki</title><link rel="stylesheet" href="styles.css"><script src="app.js" defer></script></head><body><nav class="site-nav" aria-label="Prototypes">{nav}</nav><main><div id="atlas-options"><div class="atlas-app" data-mode="{mode}"></div></div></main></body></html>''')
print('Built four standalone HTML pages with shared local assets.')
