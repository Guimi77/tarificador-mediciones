window.CATALOG_LOAD_ERROR=null;

// La interfaz y la carga de documentos deben funcionar aunque el catálogo tarde o falle.
await import('./app.js');

(async()=>{
  try{
    if(window.PRODUCT_CATALOG_READY){
      await window.PRODUCT_CATALOG_READY;
    }
    window.dispatchEvent(new CustomEvent('catalog-ready',{detail:{count:(window.PRODUCT_CATALOG||[]).length}}));
    console.info(`Catálogo Odoo cargado: ${(window.PRODUCT_CATALOG||[]).length} productos`);
  }catch(error){
    console.error('No se pudo cargar el catálogo Odoo',error);
    window.CATALOG_LOAD_ERROR=error;
    window.dispatchEvent(new CustomEvent('catalog-error',{detail:{message:error?.message||String(error)}}));
  }
})();
