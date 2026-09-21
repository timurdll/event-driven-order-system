'use strict';

const { trace } = require('@opentelemetry/api');

const tracer = trace.getTracer('payment-service');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simulates charging a payment for an order.
 * Deterministic for totalAmount === 0 (always succeeds) to keep tests stable;
 * otherwise randomised to emulate a real payment gateway's latency/outcome.
 */
async function processPayment(event, { random = Math.random, sleep = delay } = {}) {
  return tracer.startActiveSpan('charge payment', async (span) => {
    try {
      span.setAttribute('order.id', event.orderId);
      span.setAttribute('payment.amount', event.totalAmount);

      await sleep(100 + Math.floor(random() * 300));

      const approved = event.totalAmount === 0 || random() > 0.1;
      const result = {
        orderId: event.orderId,
        status: approved ? 'PAYMENT_APPROVED' : 'PAYMENT_DECLINED',
        amount: event.totalAmount,
      };

      span.setAttribute('payment.status', result.status);
      console.log(
        `[payment-service] order ${event.orderId} -> ${result.status} ($${event.totalAmount})`,
      );
      return result;
    } finally {
      span.end();
    }
  });
}

module.exports = { processPayment };
