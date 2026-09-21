'use strict';

require('./tracing');

const { consumeOrderCreated } = require('./broker');
const { updateInventory } = require('./inventoryProcessor');
const { startHealthServer } = require('./healthServer');

const PORT = process.env.PORT || 3003;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

async function main() {
  startHealthServer(PORT, 'inventory-service');

  await consumeOrderCreated(RABBITMQ_URL, {
    queue: 'inventory_queue',
    routingKey: 'order.created',
    serviceName: 'inventory-service',
    handler: updateInventory,
  });

  console.log('inventory-service: consuming order.created events');
}

main().catch((err) => {
  console.error('inventory-service failed to start', err);
  process.exit(1);
});
