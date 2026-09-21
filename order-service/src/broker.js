'use strict';

const amqp = require('amqplib');
const { trace, context, propagation, SpanKind } = require('@opentelemetry/api');

const EXCHANGE = 'orders_exchange';
const tracer = trace.getTracer('order-service');

let connection;
let channel;

async function connectBroker(url) {
  connection = await amqp.connect(url);
  channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
  return channel;
}

async function publishOrderCreated(event) {
  if (!channel) {
    throw new Error('Broker channel is not initialized');
  }

  return tracer.startActiveSpan(
    'orders_exchange publish order.created',
    { kind: SpanKind.PRODUCER },
    async (span) => {
      try {
        const headers = {};
        propagation.inject(context.active(), headers);

        span.setAttribute('messaging.system', 'rabbitmq');
        span.setAttribute('messaging.destination', EXCHANGE);
        span.setAttribute('messaging.destination_kind', 'topic');
        span.setAttribute('messaging.rabbitmq.routing_key', 'order.created');
        span.setAttribute('order.id', event.orderId);

        channel.publish(EXCHANGE, 'order.created', Buffer.from(JSON.stringify(event)), {
          headers,
          contentType: 'application/json',
          persistent: true,
        });
      } finally {
        span.end();
      }
    },
  );
}

async function closeBroker() {
  await channel?.close();
  await connection?.close();
}

module.exports = { connectBroker, publishOrderCreated, closeBroker };
