window.CATALOG_LOAD_ERROR=null;

const cleanKey=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const pickField=(row,names)=>{
  for(const name of names){if(row?.[name]!=null&&row[name]!=='')return row[name];}
  for(const [key,value] of Object.entries(row||{})){
    const k=cleanKey(key);
    if(names.some(name=>k===cleanKey(name)||k.includes(cleanKey(name))))return value;
  }
  return '';
};
const toPrice=value=>{
  if(typeof value==='number')return value;
  let s=String(value??'').trim().replace(/\s/g,'').replace(/€/g,'');
  if(!s)return 0;
  if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
  else if(s.includes(','))s=s.replace(',','.');
  const n=Number(s.replace(/[^0-9.-]/g,''));
  return Number.isFinite(n)?n:0;
};

try{
  if(window.PRODUCT_CATALOG_READY)await window.PRODUCT_CATALOG_READY;
  window.PRODUCT_CATALOG=(window.PRODUCT_CATALOG||[]).map(row=>({
    r:String(row.r??pickField(row,['Referencia interna','referencia','default_code'])??'').trim(),
    n:String(row.n??pickField(row,['Nombre','nombre','name'])??'').trim(),
    p:toPrice(row.p??pickField(row,['Precio de venta','precio venta','list_price','precio'])),
    c:String(row.c??pickField(row,['Categoría de producto','categoria de producto','categoría','categoria','categ_id'])??'').trim()
  })).filter(p=>p.r||p.n);
}catch(error){
  window.CATALOG_LOAD_ERROR=error;
}

const catalog=window.PRODUCT_CATALOG||[];
const directSearch=q=>{
  const s=cleanKey(q);
  return catalog.filter(p=>cleanKey(`${p.r} ${p.n} ${p.c}`).includes(s)).slice(0,20);
};

const diag=document.createElement('section');
diag.className='panel';
diag.id='catalogDiagnostic';
diag.innerHTML=`
  <div class="panel-head"><div><h2>Diagnóstico del catálogo</h2><p>Esta caja comprueba directamente lo que la web tiene cargado antes de valorar mediciones.</p></div></div>
  <div id="catalogHealth" style="display:grid;gap:8px;margin-bottom:14px"></div>
  <div style="display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:10px"><input id="catalogDebugSearch" type="text" value="BUCMONO" placeholder="Buscar referencia o nombre"><button id="catalogDebugButton">Buscar catálogo</button></div>
  <div id="catalogDebugResults" style="margin-top:12px;display:grid;gap:6px"></div>`;
const firstPanel=document.querySelector('main .panel');
if(firstPanel)firstPanel.before(diag);else document.querySelector('main')?.prepend(diag);

const health=document.getElementById('catalogHealth');
const known=['BUCMONO','PLS','PIQUETA','A3X1'];
const rows=[`Productos cargados realmente: <strong>${catalog.length}</strong>`,...known.map(k=>{const p=directSearch(k)[0];return `${p?'✓':'✗'} ${k}: ${p?`<strong>${p.r}</strong> — ${p.n} — ${p.p.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}`:'NO ENCONTRADO'}`})];
if(window.CATALOG_LOAD_ERROR)rows.unshift(`⚠ Error cargando catálogo: ${window.CATALOG_LOAD_ERROR.message||window.CATALOG_LOAD_ERROR}`);
health.innerHTML=rows.map(x=>`<div>${x}</div>`).join('');

function renderDebug(){
  const q=document.getElementById('catalogDebugSearch').value;
  const found=directSearch(q);
  const box=document.getElementById('catalogDebugResults');
  box.innerHTML=found.length?found.map(p=>`<div style="padding:9px;border:1px solid #e2e6eb;border-radius:8px"><strong>${p.r}</strong> · ${p.p.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}<br><span style="color:#697386">${p.n}</span></div>`).join(''):`<div style="color:#a33;font-weight:700">0 resultados para “${q}”</div>`;
}
document.getElementById('catalogDebugButton').onclick=renderDebug;
document.getElementById('catalogDebugSearch').addEventListener('keydown',e=>{if(e.key==='Enter')renderDebug()});
renderDebug();

await import('./app.js');

const options=document.getElementById('catalogOptions');
if(options){
  const frag=document.createDocumentFragment();
  catalog.forEach(p=>{const o=document.createElement('option');o.value=p.r||p.n;o.label=`${p.n} · ${p.p.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}`;frag.appendChild(o)});
  options.replaceChildren(frag);
}

window.dispatchEvent(new CustomEvent(window.CATALOG_LOAD_ERROR?'catalog-error':'catalog-ready',{detail:{count:catalog.length,message:window.CATALOG_LOAD_ERROR?.message||''}}));
