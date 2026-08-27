window.CATALOG_LOAD_ERROR=null;

const cleanKey=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const pickField=(row,names)=>{
  for(const name of names){if(row?.[name]!=null&&row[name]!=='')return row[name];}
  const entries=Object.entries(row||{});
  for(const [key,value] of entries){
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

  console.info(`Catálogo Odoo normalizado: ${window.PRODUCT_CATALOG.length} productos`);
}catch(error){
  console.error('No se pudo cargar/normalizar el catálogo Odoo; la subida de documentos seguirá disponible.',error);
  window.CATALOG_LOAD_ERROR=error;
}

await import('./app.js');

const catalog=window.PRODUCT_CATALOG||[];
const options=document.getElementById('catalogOptions');
if(options){
  const frag=document.createDocumentFragment();
  catalog.forEach(p=>{
    const o=document.createElement('option');
    o.value=p.r||p.n;
    o.label=`${p.n}${p.p?` · ${p.p.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}`:''}`;
    frag.appendChild(o);
  });
  options.replaceChildren(frag);
}

const findProduct=value=>{
  const q=String(value||'').trim().toLowerCase();
  if(!q)return null;
  return catalog.find(p=>p.r.toLowerCase()===q)||catalog.find(p=>p.r.toLowerCase().startsWith(q+' '))||catalog.find(p=>p.r.toLowerCase().includes(q));
};

document.addEventListener('change',e=>{
  if(!e.target.classList?.contains('component-ref'))return;
  const row=e.target.closest('.component-row');
  const p=findProduct(e.target.value);
  if(!row||!p)return;
  e.target.value=p.r;
  const price=row.querySelector('.component-price');
  const source=row.querySelector('.component-source');
  const note=row.querySelector('.component-note');
  if(price){price.value=p.p;price.dispatchEvent(new Event('input',{bubbles:true}));}
  if(source)source.value='catalogo';
  if(note)note.value=`${p.n} · Catálogo Odoo`;
});

// Equivalencia segura ya validada: IEC010 describe una CPM hasta 63 A.
const applyValidatedEquivalences=()=>{
  const p=catalog.find(x=>x.r==='BUCMONO MONOBUC CPMMONO 482021'||x.r.startsWith('BUCMONO '));
  if(!p)return;
  document.querySelectorAll('.part-card').forEach(card=>{
    const desc=String(card.querySelector('.description')?.value||'').toLowerCase();
    if(!desc.includes('iec010')&&!(/caja de protecci[oó]n y medida/.test(desc)&&/63\s*a/.test(desc)))return;
    let row=card.querySelector('.component-row');
    if(!row){card.querySelector('.add-component')?.click();row=card.querySelector('.component-row');}
    if(!row)return;
    const ref=row.querySelector('.component-ref');
    if(ref&&ref.value.trim())return;
    ref.value=p.r;
    row.querySelector('.component-price').value=p.p;
    row.querySelector('.component-source').value='catalogo';
    row.querySelector('.component-note').value='Equivalencia validada: caja de protección y medida CPM hasta 63 A · Catálogo Odoo';
    row.querySelector('.component-price').dispatchEvent(new Event('input',{bubbles:true}));
  });
};

const cards=document.getElementById('cards');
if(cards)new MutationObserver(()=>queueMicrotask(applyValidatedEquivalences)).observe(cards,{childList:true,subtree:true});
applyValidatedEquivalences();

window.dispatchEvent(new CustomEvent(window.CATALOG_LOAD_ERROR?'catalog-error':'catalog-ready',{detail:{count:catalog.length,message:window.CATALOG_LOAD_ERROR?.message||''}}));
