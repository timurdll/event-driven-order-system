'use strict';

const amqp = require('amqplib');
const { trace, context, propagation, SpanKind, SpanStatusCode } = require('@opentelemetry/api');

const EXCHANGE = 'orders_exchange';

async function consumeOrderCreated(url, { queue, routingKey, serviceName, handler }) {
  const tracer = trace.getTracer(serviceName);
  const connection = await amqp.connect(url);
  const channel = await connection.createChannel();

  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(queue, { durable: true });
  await channel.bindQueue(queue, EXCHANGE, routingKey);
  await channel.prefetch(10);

  channel.consume(queue, async (msg) => {
    if (!msg) return;

    const headers = msg.properties.headers || {};
    const parentContext = propagation.extract(context.active(), headers);

    await context.with(parentContext, async () => {
      const span = tracer.startSpan(`${queue} process ${routingKey}`, {
        kind: SpanKind.CONSUMER,
        attributes: {
          'messaging.system': 'rabbitmq',
          'messaging.destination': EXCHANGE,
          'messaging.rabbitmq.routing_key': routingKey,
          'messaging.operation': 'process',
        },
      });

      try {
        await context.with(trace.setSpan(parentContext, span), async () => {
          const event = JSON.parse(msg.content.toString());
          span.setAttribute('order.id', event.orderId);
          await handler(event);
        });
        channel.ack(msg);
      } catch (err) {
        span.recordException(err);
        span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        channel.nack(msg, false, false);
      } finally {
        span.end();
      }
    });
  });

  return { connection, channel };
}

module.exports = { consumeOrderCreated };
