'use strict';

require('./tracing');

const { consumeOrderCreated } = require('./broker');
const { processPayment } = require('./paymentProcessor');
const { startHealthServer } = require('./healthServer');

const PORT = process.env.PORT || 3002;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

async function main() {
  startHealthServer(PORT, 'payment-service');

  await consumeOrderCreated(RABBITMQ_URL, {
    queue: 'payment_queue',
    routingKey: 'order.created',
    serviceName: 'payment-service',
    handler: processPayment,
  });

  console.log('payment-service: consuming order.created events');
}

main().catch((err) => {
  console.error('payment-service failed to start', err);
  process.exit(1);
});
