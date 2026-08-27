await window.PRODUCT_CATALOG_READY;
await import('./app.js');
console.info(`Catálogo Odoo cargado: ${window.PRODUCT_CATALOG.length} productos`);
