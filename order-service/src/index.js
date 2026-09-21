'use strict';

require('./tracing');

const { createApp } = require('./app');
const { connectBroker, publishOrderCreated } = require('./broker');

const PORT = process.env.PORT || 3001;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

async function main() {
  await connectBroker(RABBITMQ_URL);
  console.log('order-service: connected to RabbitMQ');

  const app = createApp({ publishOrderCreated });
  app.listen(PORT, () => {
    console.log(`order-service: listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('order-service failed to start', err);
  process.exit(1);
});
