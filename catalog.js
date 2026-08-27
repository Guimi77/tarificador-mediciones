window.PRODUCT_CATALOG=[];
window.CATALOG_LOAD_ERROR=null;

function parseCsv(text){
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){
      if(ch==='"'&&text[i+1]==='"'){field+='"';i++;}
      else if(ch==='"')quoted=false;
      else field+=ch;
    }else{
      if(ch==='"')quoted=true;
      else if(ch===','){row.push(field);field='';}
      else if(ch==='\n'){row.push(field);rows.push(row);row=[];field='';}
      else if(ch!=='\r')field+=ch;
    }
  }
  if(field||row.length){row.push(field);rows.push(row);}
  const headers=(rows.shift()||[]).map(x=>x.replace(/^\uFEFF/,'').trim());
  return rows.filter(r=>r.some(v=>String(v).trim())).map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]??''])));
}

window.PRODUCT_CATALOG_READY=(async()=>{
  try{
    const response=await fetch(`catalog.csv?v=${Date.now()}`,{cache:'no-store'});
    if(!response.ok)throw new Error(`No se pudo cargar catalog.csv (${response.status})`);
    const rows=parseCsv(await response.text());
    window.PRODUCT_CATALOG=rows.map(row=>({
      c:String(row['Categoría de producto']||'').trim(),
      n:String(row['Nombre']||'').trim(),
      p:Number(String(row['Precio de venta']||'0').replace(',','.'))||0,
      r:String(row['Referencia interna']||'').trim()
    })).filter(p=>p.r||p.n);
    if(window.PRODUCT_CATALOG.length!==1126)throw new Error(`Catálogo incompleto: ${window.PRODUCT_CATALOG.length}/1126 productos`);
    return window.PRODUCT_CATALOG;
  }catch(error){
    window.CATALOG_LOAD_ERROR=error;
    window.PRODUCT_CATALOG=[];
    throw error;
  }
})();
