'use strict';

// In-memory demo stock: every SKU starts with 100 units unless already tracked.
const DEFAULT_STOCK = 100;
const stock = new Map();

function getStock(sku) {
  if (!stock.has(sku)) {
    stock.set(sku, DEFAULT_STOCK);
  }
  return stock.get(sku);
}

/** Returns the updated stock level, allowing it to go negative (backorder) for simplicity. */
function reserveStock(sku, quantity) {
  const current = getStock(sku);
  const updated = current - quantity;
  stock.set(sku, updated);
  return updated;
}

module.exports = { getStock, reserveStock };
