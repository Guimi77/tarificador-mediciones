window.CATALOG_LOAD_ERROR=null;

try{
  if(window.PRODUCT_CATALOG_READY){
    await window.PRODUCT_CATALOG_READY;
  }
  console.info(`Catálogo Odoo cargado antes de iniciar la app: ${(window.PRODUCT_CATALOG||[]).length} productos`);
}catch(error){
  console.error('No se pudo cargar el catálogo Odoo; la subida de documentos seguirá disponible.',error);
  window.CATALOG_LOAD_ERROR=error;
}

await import('./app.js');

window.dispatchEvent(new CustomEvent(window.CATALOG_LOAD_ERROR?'catalog-error':'catalog-ready',{detail:{count:(window.PRODUCT_CATALOG||[]).length,message:window.CATALOG_LOAD_ERROR?.message||''}}));
