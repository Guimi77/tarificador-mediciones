import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

const $=s=>document.querySelector(s);
const input=$('#measurementInput'),cards=$('#cards'),results=$('#resultsPanel'),trace=$('#tracePanel'),cardTemplate=$('#cardTemplate'),componentTemplate=$('#componentTemplate'),fileInput=$('#measurementFile'),dropZone=$('#dropZone'),fileName=$('#measurementFileName'),fileStatus=$('#fileStatus');
const money=new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'});
const catalog=window.PRODUCT_CATALOG||[];

const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/²/g,'2').replace(/[×]/g,'x').replace(/ø/g,' diam ').replace(/[^a-z0-9.,+/' -]/g,' ').replace(/\s+/g,' ').trim();
const stop=new Set('suministro instalacion instalado instalada montaje montado montada totalmente incluso incluye conexionado conexionada conexionadas conexionados replanteo colocacion fijacion para por con del de la el los las un una unos unas en y e o a al se su sus segun proyecto obra numero unidades prevista previstas realmente especificaciones documentacion grafica criterio medicion precio'.split(' '));
const synonyms={
  cpm:['cpm','caja proteccion medida','caja general proteccion medida','proteccion y medida'],
  tierra:['tierra','puesta tierra','toma tierra'],
  piqueta:['piqueta','electrodo tierra'],
  tubo:['tubo','canalizacion','forroplast','corrugado','conducto'],
  cable:['cable','conductor','conductores','manguera'],
  enchufe:['enchufe','schuko','toma corriente','base corriente'],
  datos:['datos','rj45','utp'],
  tv:['tv','rtv','antena','coaxial'],
  diferencial:['diferencial','interruptor diferencial'],
  magnetotermico:['magnetotermico','automatico','pia'],
  sobretension:['sobretension','sobretensiones','spd'],
  cuadro:['cuadro','armario electrico','envolvente electrica']
};
function enrichText(s){let t=' '+norm(s)+' ';for(const [key,arr] of Object.entries(synonyms)){if(arr.some(v=>t.includes(' '+v+' ')||t.includes(v)))t+=' '+key+' ';}return t.replace(/\s+/g,' ').trim()}
function tokens(s){return [...new Set(enrichText(s).split(' ').filter(w=>w.length>2&&!stop.has(w)&&!/^\d+$/.test(w)))]}
const indexed=catalog.map(p=>{const text=enrichText(`${p.r} ${p.n} ${p.c}`);return{p,text,t:new Set(tokens(text))}});

function specs(s){const t=norm(s);return{
  sections:[...t.matchAll(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*mm2/g)].map(m=>m[1].replace(',','.')),
  multicore:[...t.matchAll(/(\d+)\s*x\s*(\d+(?:[.,]\d+)?)/g)].map(m=>`${m[1]}x${m[2].replace(',','.')}`),
  amps:[...t.matchAll(/(\d+)\s*a\b/g)].map(m=>m[1]),
  diam:[...t.matchAll(/(?:diam|dn|tubo|forroplast)\s*(?:de\s*)?(\d+)\s*mm/g)].map(m=>m[1]),
  poles:[...t.matchAll(/\b([234])\s*p\b/g)].map(m=>m[1]),
  ma:[...t.matchAll(/(30|300)\s*ma\b/g)].map(m=>m[1])
}}
function scoreProduct(query,item){const q=enrichText(query),qt=tokens(q),ps=specs(q),pt=item.text;let score=0,matched=[];
  for(const tok of qt){if(item.t.has(tok)){score+=3;matched.push(tok)}else if(tok.length>4&&pt.includes(tok)){score+=1.2;matched.push(tok)}}
  if(q.includes('cpm')&&pt.includes('cpm'))score+=12;
  if(q.includes('piqueta')&&pt.includes('piqueta'))score+=10;
  if(q.includes('tierra')&&pt.includes('tierra'))score+=5;
  if(q.includes('cable')&&pt.includes('cable'))score+=4;
  if(q.includes('tubo')&&(pt.includes('tubo')||pt.includes('forroplast')))score+=4;
  if(q.includes('jung')&&pt.includes('jung'))score+=5;
  if(q.includes('ls990')&&pt.includes('ls990'))score+=6;
  const is=specs(pt);
  const tech=(a,b,bonus=7,penalty=5)=>{if(!a.length)return;if(a.some(x=>b.includes(x)))score+=bonus;else if(b.length)score-=penalty};
  tech(ps.multicore,is.multicore,10,8);tech(ps.sections,is.sections,8,5);tech(ps.amps,is.amps,7,5);tech(ps.diam,is.diam,8,6);tech(ps.poles,is.poles,6,4);tech(ps.ma,is.ma,8,7);
  if(/pequeno material/.test(pt)&&!/pequeno material/.test(q))score-=12;
  if(/mano de obra/.test(pt)&&!/mano de obra/.test(q))score-=12;
  return{score,matched};
}
function findCandidates(query,limit=4){return indexed.map(i=>({...scoreProduct(query,i),product:i.p})).filter(x=>x.product.p>0).sort((a,b)=>b.score-a.score).slice(0,limit)}
function choose(query,min=9){const a=findCandidates(query,2),best=a[0],second=a[1];if(!best||best.score<min)return null;const margin=best.score-(second?.score||0);if(best.score<14&&margin<2.5)return null;return{...best,confidence:best.score>=20?'alta':best.score>=13?'media':'baja',query}}

function qtyBefore(text,word,def=1){const t=norm(text),re=new RegExp('(\\d+(?:[.,]\\d+)?)\\s*(?:ud|u|mts?|ml|m)?\\.?\\s*(?:de\\s+)?'+word,'i'),m=t.match(re);return m?Number(m[1].replace(',','.')):def}
function materialQueries(desc,unit){const t=enrichText(desc),out=[];const push=(query,qty,why,min=9)=>out.push({query,qty,why,min});
  if(/\biec010\b/.test(t)||(/caja/.test(t)&&/proteccion/.test(t)&&/medida/.test(t))||/\bcpm2?-?s?4\b/.test(t))push('BUCMONO MONOBUC CPMMONO caja general proteccion y medida CPM 63A',1,'Caja de protección y medida CPM hasta 63 A',8);
  if(/toma tierra|puesta tierra|tierra vivienda|tierra piscina/.test(t)){
    const cm=t.match(/(\d+(?:[.,]\d+)?)\s*(?:mts?|m|ml)\.?\s*cable\s*cobre\s*desnudo\s*(\d+(?:[.,]\d+)?)\s*mm/);
    if(cm)push(`cable cobre desnudo ${cm[2]} mm tierra`,Number(cm[1].replace(',','.')),`Cable de cobre desnudo ${cm[2]} mm`,9);
    const pq=t.match(/(\d+)\s*(?:ud\.?\s*)?(?:piqueta|pique)/);if(pq)push('piqueta toma tierra',Number(pq[1]),'Piqueta de puesta a tierra',8);
    if(/caja/.test(t))push('caja seccionamiento comprobacion tierra',1,'Caja de tierra descrita en la partida',10);
  }
  const multi=[...t.matchAll(/(?:cable|cables|manguera|conductores?)[^.;]{0,100}?(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s*mm2/g)];
  for(const m of multi){let q=1;if(unit==='m')q=1;else q=qtyBefore(t,'(?:cable|manguera)',1);push(`cable ${m[1]}x${m[2]} mm2`,q,`Cable ${m[1]}x${m[2]} mm²`,10)}
  const single=[...t.matchAll(/(?:cable|conductor)[^.;]{0,80}?1\s*x\s*(\d+(?:[.,]\d+)?)\s*mm2/g)];
  for(const m of single)push(`cable unipolar 1x${m[1]} mm2`,unit==='m'?1:qtyBefore(t,'cable',1),`Cable unipolar 1x${m[1]} mm²`,10);
  const special=t.match(/(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s*\+\s*1g\s*(\d+(?:[.,]\d+)?)\s*mm2/);if(special)push(`cable rz1-k ${special[1]}x${special[2]}+1g${special[3]} mm2`,1,`Cable ${special[1]}x${special[2]}+1G${special[3]} mm²`,10);
  const tube=[...t.matchAll(/(?:tubo|forroplast|canalizacion)[^.;]{0,50}?(?:diam|dn|de)?\s*(16|20|25|32|40|50|63|75)\s*mm/g)];
  for(const m of tube)push(`tubo ${m[1]} mm`,unit==='m'?1:qtyBefore(t,'tubo',1),`Tubo/canalización Ø${m[1]} mm`,9);
  if(/jung|ls990/.test(t)){
    if(/interruptor/.test(t)&&!/diferencial/.test(t))push('Jung LS990 interruptor',1,'Mecanismo interruptor JUNG LS990',10);
    if(/conmutad/.test(t))push('Jung LS990 conmutador',1,'Mecanismo conmutador JUNG LS990',10);
    if(/cruzamiento|cruce/.test(t))push('Jung LS990 cruzamiento',1,'Mecanismo cruzamiento JUNG LS990',10);
    if(/schuko|toma corriente|enchufe/.test(t))push('Jung LS990 schuko toma corriente',1,'Base Schuko JUNG LS990',10);
    if(/rj45|datos/.test(t))push('Jung LS990 RJ45 cat6',1,'Toma RJ45 JUNG LS990',10);
  }
  return out;
}
function completePartQuery(desc){const t=enrichText(desc);if(/punto (?:de )?(?:alumbrado|luz)/.test(t)){if(/cruzamiento|cruce/.test(t))return'partida punto luz cruzamiento completo';if(/conmutad/.test(t))return'partida punto luz conmutado completo';if(/interruptor|simple/.test(t))return'partida punto luz simple interruptor completo'}if(/(?:base|toma|punto).*(?:schuko|enchufe|corriente)/.test(t))return'partida base enchufe 16A completa';if(/toma.*datos|rj45/.test(t))return'partida punto datos RJ45 cat6 completo';if(/toma.*tv|senal tv/.test(t))return'partida toma TV completa';if(/tramitacion.*baja tension|boletin/.test(t))return'boletin electrico tramitacion industria';return null}
function classify(desc,unit){const t=enrichText(desc);if(/no se oferta|no se presupuesta|no ofertar|obra civil/.test(t))return{status:'excluded',reason:'El propio estado de mediciones indica que no se oferta / es obra civil.',suggestions:[]};if(/cuadro/.test(t)&&/segun.*esquema|esquema electrico/.test(t))return{status:'scheme',reason:'Cuadro según esquema: no se valora sin adjuntar el esquema.',suggestions:[]};
  const cq=completePartQuery(desc);if(cq){const found=choose(cq,8);if(found&&/partidas/i.test(found.product.c))return{status:'normal',reason:'',suggestions:[makeSuggestion(found,1,'Equivalencia de partida completa')]};}
  const queries=materialQueries(desc,String(unit||'').toLowerCase()),suggestions=[];for(const q of queries){const found=choose(q.query,q.min);if(found&&!suggestions.some(s=>s.product.r===found.product.r))suggestions.push(makeSuggestion(found,q.qty,q.why))}
  if(suggestions.length)return{status:'normal',reason:'',suggestions};
  const generic=choose(desc,18);if(generic)return{status:'normal',reason:'',suggestions:[makeSuggestion(generic,1,'Mejor equivalencia global del catálogo')]};
  return{status:'review',reason:'No se ha encontrado una equivalencia suficientemente sólida en el catálogo completo.',suggestions:[]}}
function makeSuggestion(found,qty,why){return{product:found.product,qty,why:`${why}. Búsqueda: “${found.query}”. Coincidencia ${found.score.toFixed(1)} puntos`,confidence:found.confidence}}

const example=`12 | Punto de luz sencillo | ud\n35 | Línea 3x2,5 mm² | m\n8 | Base enchufe 16A | ud\n1 | Cuadro eléctrico según esquema | ud`;
$('#loadExample').onclick=()=>input.value=example;$('#analyze').onclick=analyzeText;$('#addRow').onclick=()=>addPart();$('#exportCsv').onclick=exportCsv;
dropZone.onclick=()=>fileInput.click();dropZone.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fileInput.click()}};['dragenter','dragover'].forEach(ev=>dropZone.addEventListener(ev,e=>{e.preventDefault();dropZone.classList.add('dragging')}));['dragleave','drop'].forEach(ev=>dropZone.addEventListener(ev,e=>{e.preventDefault();dropZone.classList.remove('dragging')}));dropZone.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)processFile(f)});fileInput.addEventListener('change',()=>{if(fileInput.files[0])processFile(fileInput.files[0])});

async function processFile(file){fileName.textContent=`Archivo: ${file.name}`;fileStatus.textContent='Leyendo archivo…';fileStatus.className='reading';try{const ext=file.name.split('.').pop().toLowerCase();let text='';if(ext==='pdf')text=await readPdf(file);else if(ext==='csv')text=await readCsv(file);else if(ext==='xlsx'||ext==='xls')text=await readExcel(file);else throw new Error('Formato no compatible');if(!text.trim())throw new Error('El archivo se ha leído, pero no se han encontrado partidas con cantidad y unidad.');input.value=text;fileStatus.textContent=`✓ ${text.split(/\n/).filter(Boolean).length} partidas detectadas. Buscando materiales en ${catalog.length} productos…`;fileStatus.className='success';analyzeText()}catch(err){console.error(err);fileStatus.textContent='⚠ '+err.message;fileStatus.className='error'}}
async function readPdf(file){const data=new Uint8Array(await file.arrayBuffer()),pdf=await pdfjsLib.getDocument({data}).promise;let pages=[];for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n),content=await page.getTextContent(),items=content.items.map(x=>({s:x.str.trim(),x:x.transform[4],y:x.transform[5]})).filter(x=>x.s),rows=[];items.sort((a,b)=>b.y-a.y||a.x-b.x).forEach(it=>{let row=rows.find(r=>Math.abs(r.y-it.y)<4);if(!row){row={y:it.y,items:[]};rows.push(row)}row.items.push(it)});rows.sort((a,b)=>b.y-a.y).forEach(r=>{r.items.sort((a,b)=>a.x-b.x);pages.push(r.items.map(i=>i.s).join(' '))})}return extractMeasurementLines(pages)}
function extractMeasurementLines(lines){const text=lines.join('\n').replace(/\u00a0/g,' '),headerRe=/(\d+(?:\.\d+){2,})\s+([A-Za-z0-9_#.-]+)\s+(Ud\.?|u|m|ml|m2|m²|m3|m³|kg)\s+([^\n]+)/gi,matches=[...text.matchAll(headerRe)],out=[];for(let i=0;i<matches.length;i++){const h=matches[i],start=h.index+h[0].length,end=i+1<matches.length?matches[i+1].index:text.length,block=text.slice(start,end),total=block.match(/Total\s+(Ud\.?|u|m|ml|m2|m²|m3|m³|kg)\.*\s*:\s*([0-9]+(?:[.,][0-9]+)?)/i);if(!total)continue;let desc=h[4].trim();const extra=block.split(/Total\s+/i)[0].split('\n').filter(s=>s.trim()).filter(s=>!/^\s*(INSTALACIONES|Presupuesto parcial|Comentario P\.ig\.|Página)/i.test(s)).filter(s=>!/^\s*(?:[\wÀ-ÿ() .-]+\s+)?\d+(?:[.,]\d+)?(?:\s+\d+(?:[.,]\d+)?){0,5}\s*$/i.test(s)).filter(s=>!/^\s*(Criterio de medición|Criterio de valoración)/i.test(s)).slice(0,40).join(' ');if(extra)desc+=' '+extra;out.push(`${Number(total[2].replace(',','.'))} | ${h[2]} — ${desc.replace(/\s+/g,' ').trim()} | ${h[3].replace('.','')}`)}return out.join('\n')}
async function readCsv(file){const text=await file.text();return tableToMeasurements(text.split(/\r?\n/).map(r=>r.split(r.includes(';')?';':',')))}
async function readExcel(file){if(!window.XLSX)throw new Error('No se pudo cargar el lector de Excel');const wb=XLSX.read(await file.arrayBuffer(),{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]],rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});return tableToMeasurements(rows)}
function tableToMeasurements(rows){const out=[];rows.forEach(row=>{const cells=row.map(v=>String(v).trim()),unitI=cells.findIndex(v=>/^(ud|u|m|ml|m2|m²|m3|m³|kg)$/i.test(v)),nums=cells.map((v,i)=>({i,v:v.match(/^\d+(?:[.,]\d+)?$/)})).filter(x=>x.v);if(unitI>=0&&nums.length){const q=nums.find(x=>x.i>unitI)||nums[nums.length-1],desc=cells.slice(0,unitI).filter(v=>v&&!/^\d+(?:\.\d+)*$/.test(v)).join(' ');if(desc&&q)out.push(`${q.v[0].replace(',','.')} | ${desc} | ${cells[unitI]}`)}});return out.join('\n')}

function analyzeText(){cards.innerHTML='';input.value.split(/\n/).map(v=>v.trim()).filter(Boolean).forEach(line=>{const p=line.split(/\s*[|;\t]\s*/),data={qty:p.length>1?(num(p[0])||1):1,description:p.length>1?p[1]:line,unit:p[2]||'ud'};addPart(data,classify(data.description,data.unit))});if(!cards.children.length)addPart();results.classList.remove('hidden');trace.classList.remove('hidden');recalculate();results.scrollIntoView({behavior:'smooth',block:'start'})}
function num(v){return Number(String(v??'').replace(',','.'))||0}function needsScheme(v){const t=enrichText(v);return /cuadro/.test(t)&&/segun.*esquema|esquema electrico/.test(t)}function schemeReady(card){return !needsScheme(card.querySelector('.description').value)||card.dataset.scheme==='yes'}
function addPart(data={},classification={status:'normal',reason:'',suggestions:[]}){const f=cardTemplate.content.cloneNode(true),card=f.querySelector('.part-card');card.dataset.partStatus=classification.status;card.dataset.partReason=classification.reason||'';card.querySelector('.qty').value=data.qty??1;card.querySelector('.description').value=data.description??'';card.querySelector('.unit').value=data.unit??'ud';card.querySelectorAll('.part-fields input').forEach(el=>el.addEventListener('input',recalculate));card.querySelector('.remove-part').onclick=()=>{card.remove();recalculate()};card.querySelector('.add-component').onclick=()=>addComponent(card);card.querySelector('.scheme').onchange=e=>{const file=e.target.files[0];card.dataset.scheme=file?'yes':'no';card.querySelector('.scheme-name').textContent=file?`Adjunto: ${file.name}`:'';recalculate()};cards.appendChild(f);if(classification.suggestions?.length)classification.suggestions.forEach(s=>addComponent(card,{qty:s.qty,ref:s.product.r,price:s.product.p,source:'catalogo',note:`${s.why} · confianza ${s.confidence}`}));else if(classification.status==='normal'||classification.status==='review')addComponent(card);syncScheme(card);recalculate()}
function addComponent(card,data={}){const f=componentTemplate.content.cloneNode(true),row=f.querySelector('.component-row');row.querySelector('.component-qty').value=data.qty??1;row.querySelector('.component-ref').value=data.ref??'';row.querySelector('.component-price').value=data.price??'';row.querySelector('.component-source').value=data.source??'manual';row.querySelector('.component-note').value=data.note??'';row.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',recalculate));row.querySelector('.component-ref').addEventListener('change',()=>fillCatalogRow(row));row.querySelector('.remove-component').onclick=()=>{row.remove();recalculate()};card.querySelector('.component-list').appendChild(f);recalculate()}
function fillCatalogRow(row){const q=norm(row.querySelector('.component-ref').value),p=catalog.find(x=>norm(x.r)===q)||catalog.find(x=>norm(x.r).startsWith(q));if(!p)return;row.querySelector('.component-ref').value=p.r;row.querySelector('.component-price').value=p.p;row.querySelector('.component-source').value='catalogo';row.querySelector('.component-note').value=p.n;recalculate()}
function syncScheme(card){const box=card.querySelector('.scheme-box');if(needsScheme(card.querySelector('.description').value))box.classList.remove('hidden');else{box.classList.add('hidden');card.dataset.scheme='no'}}
function recalculate(){let grand=0,traces=[];[...cards.querySelectorAll('.part-card')].forEach((card,i)=>{const qty=num(card.querySelector('.qty').value),desc=card.querySelector('.description').value.trim()||`Partida ${i+1}`,partStatus=card.dataset.partStatus||'normal',reason=card.dataset.partReason||'',ready=schemeReady(card);let unitCost=0,details=[];card.querySelectorAll('.component-row').forEach(row=>{const cq=num(row.querySelector('.component-qty').value),ref=row.querySelector('.component-ref').value.trim()||'Sin referencia',price=num(row.querySelector('.component-price').value),source=row.querySelector('.component-source').value,note=row.querySelector('.component-note').value.trim(),total=cq*price;unitCost+=total;row.querySelector('.component-total').textContent=money.format(total);if(ref!=='Sin referencia')details.push(`${ref}: ${cq} × ${money.format(price)}${note?' · '+note:''}`)});let total=0,statusText='',statusClass='status warning',traceText='';if(partStatus==='excluded'){statusText='⊘ Excluida · no se oferta';traceText=reason}else if(partStatus==='scheme'&&!ready){statusText='⚠ Pendiente de esquema · no valorado';traceText=reason}else if(unitCost>0){total=qty*unitCost;statusText='✓ Materiales encontrados en catálogo';statusClass='status ok';traceText=details.join(' · ')}else{statusText='⚠ Revisar · sin equivalencia automática';traceText=reason||'No se encontró una equivalencia suficientemente sólida.'}grand+=total;card.querySelector('.part-total').textContent=money.format(total);const status=card.querySelector('.status');status.textContent=statusText;status.className=statusClass;traces.push({name:`${qty} × ${desc}`,text:traceText})});$('#lineCount').textContent=cards.children.length;$('#grandTotal').textContent=money.format(grand);$('#traceList').innerHTML=traces.map(t=>`<div class="trace-item"><strong>${esc(t.name)}</strong><span>${esc(t.text)}</span></div>`).join('')}
function exportCsv(){const out=[['Cantidad','Referencia / descripción','Unidad','Componente','Cantidad componente','Precio unitario','Origen','Criterio','Total partida']];[...cards.querySelectorAll('.part-card')].forEach(card=>{const qty=num(card.querySelector('.qty').value),desc=card.querySelector('.description').value,unit=card.querySelector('.unit').value,status=card.dataset.partStatus||'normal',ready=schemeReady(card),comps=[...card.querySelectorAll('.component-row')];let unitCost=0;comps.forEach(r=>unitCost+=num(r.querySelector('.component-qty').value)*num(r.querySelector('.component-price').value));const total=status!=='excluded'&&ready?qty*unitCost:0;if(!comps.length)out.push([qty,desc,unit,'',0,0,status,card.dataset.partReason||'',total]);else comps.forEach(r=>out.push([qty,desc,unit,r.querySelector('.component-ref').value,num(r.querySelector('.component-qty').value),num(r.querySelector('.component-price').value),r.querySelector('.component-source').value,r.querySelector('.component-note').value,total]))});const csv=out.map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(';')).join('\n'),blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='tarificacion-mediciones.csv';a.click();URL.revokeObjectURL(a.href)}
function esc(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
