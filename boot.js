window.CATALOG_LOAD_ERROR=null;

const cleanKey=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const pickField=(row,names)=>{for(const name of names){if(row?.[name]!=null&&row[name]!=='')return row[name];}for(const [key,value] of Object.entries(row||{})){const k=cleanKey(key);if(names.some(name=>k===cleanKey(name)||k.includes(cleanKey(name))))return value;}return '';};
const toPrice=value=>{if(typeof value==='number')return value;let s=String(value??'').trim().replace(/\s/g,'').replace(/€/g,'');if(!s)return 0;if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');else if(s.includes(','))s=s.replace(',','.');const n=Number(s.replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:0;};
const normalizeCatalog=rows=>(rows||[]).map(row=>({r:String(row.r??pickField(row,['Referencia interna','referencia','default_code'])??'').trim(),n:String(row.n??pickField(row,['Nombre','nombre','name'])??'').trim(),p:toPrice(row.p??pickField(row,['Precio de venta','precio venta','list_price','precio'])),c:String(row.c??pickField(row,['Categoría de producto','categoria de producto','categoría','categoria','categ_id'])??'').trim()})).filter(p=>p.r||p.n);

try{if(window.PRODUCT_CATALOG_READY)await window.PRODUCT_CATALOG_READY;window.PRODUCT_CATALOG=normalizeCatalog(window.PRODUCT_CATALOG);}catch(error){window.CATALOG_LOAD_ERROR=error;}

const badge=document.getElementById('catalogBadge');
const catalogFile=document.getElementById('catalogFile');
const catalogMessage=document.getElementById('catalogMessage');
const updateBadge=()=>{const count=(window.PRODUCT_CATALOG||[]).length;const ok=count>0&&!window.CATALOG_LOAD_ERROR;badge?.classList.toggle('catalog-ok',ok);badge?.classList.toggle('catalog-error',!ok);if(badge)badge.innerHTML=`Catálogo Odoo <span class="catalog-check">${ok?'✓':'!'}</span><small>${count.toLocaleString('es-ES')} productos</small>`;};
updateBadge();

function populateOptions(){const options=document.getElementById('catalogOptions');if(!options)return;const frag=document.createDocumentFragment();(window.PRODUCT_CATALOG||[]).forEach(p=>{const o=document.createElement('option');o.value=p.r||p.n;o.label=`${p.n} · ${p.p.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}`;frag.appendChild(o)});options.replaceChildren(frag);}
populateOptions();

catalogFile?.addEventListener('change',async()=>{
  const file=catalogFile.files?.[0];if(!file)return;
  try{
    if(!/\.csv$/i.test(file.name))throw new Error('Selecciona un archivo CSV');
    const products=normalizeCatalog(window.CATALOG_PARSE_CSV(await file.text()));
    if(!products.length)throw new Error('No se han encontrado productos válidos');
    window.PRODUCT_CATALOG=products;window.CATALOG_LOAD_ERROR=null;populateOptions();updateBadge();
    catalogMessage.textContent=`Catálogo cargado: ${products.length.toLocaleString('es-ES')} productos. Se usará durante esta sesión.`;catalogMessage.className='catalog-message success';
    window.dispatchEvent(new CustomEvent('catalog-ready',{detail:{count:products.length,source:'uploaded'}}));
  }catch(error){catalogMessage.textContent=`No se ha cargado: ${error.message||error}`;catalogMessage.className='catalog-message error';}
  finally{catalogFile.value='';}
});

await import('./app.js');
window.dispatchEvent(new CustomEvent(window.CATALOG_LOAD_ERROR?'catalog-error':'catalog-ready',{detail:{count:(window.PRODUCT_CATALOG||[]).length,message:window.CATALOG_LOAD_ERROR?.message||''}}));
