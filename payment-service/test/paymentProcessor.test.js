'use strict';

const { processPayment } = require('../src/paymentProcessor');

describe('processPayment', () => {
  const noSleep = () => Promise.resolve();

  test('always approves a zero-amount order', async () => {
    const result = await processPayment(
      { orderId: 'o-1', totalAmount: 0 },
      { random: () => 0.05, sleep: noSleep },
    );
    expect(result.status).toBe('PAYMENT_APPROVED');
  });

  test('approves when random draw is above the decline threshold', async () => {
    const result = await processPayment(
      { orderId: 'o-2', totalAmount: 49.99 },
      { random: () => 0.5, sleep: noSleep },
    );
    expect(result.status).toBe('PAYMENT_APPROVED');
    expect(result.orderId).toBe('o-2');
    expect(result.amount).toBe(49.99);
  });

  test('declines when random draw is within the decline threshold', async () => {
    const result = await processPayment(
      { orderId: 'o-3', totalAmount: 49.99 },
      { random: () => 0.01, sleep: noSleep },
    );
    expect(result.status).toBe('PAYMENT_DECLINED');
  });
});
