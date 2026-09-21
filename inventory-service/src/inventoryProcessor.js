'use strict';

const { trace } = require('@opentelemetry/api');
const { reserveStock } = require('./stockStore');

const tracer = trace.getTracer('inventory-service');

/** Reserves stock for every item in the order event. */
async function updateInventory(event) {
  return tracer.startActiveSpan('reserve stock', async (span) => {
    try {
      span.setAttribute('order.id', event.orderId);
      span.setAttribute('order.item_count', event.items.length);

      const updates = event.items.map((item) => {
        const remaining = reserveStock(item.sku, item.quantity);
        console.log(
          `[inventory-service] order ${event.orderId}: reserved ${item.quantity}x ${item.sku} (remaining: ${remaining})`,
        );
        return { sku: item.sku, remaining };
      });

      return { orderId: event.orderId, updates };
    } finally {
      span.end();
    }
  });
}

module.exports = { updateInventory };
