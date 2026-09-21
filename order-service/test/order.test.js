'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');

describe('order-service', () => {
  const publishOrderCreated = jest.fn().mockResolvedValue(undefined);
  const app = createApp({ publishOrderCreated });

  beforeEach(() => {
    publishOrderCreated.mockClear();
  });

  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('POST /orders creates an order and publishes an event', async () => {
    const res = await request(app)
      .post('/orders')
      .send({
        userId: 'u-123',
        items: [{ sku: 'SKU-001', name: 'Mouse', quantity: 2, price: 19.99 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.orderId).toBeDefined();
    expect(res.body.status).toBe('CREATED');
    expect(res.body.totalAmount).toBeCloseTo(39.98);
    expect(publishOrderCreated).toHaveBeenCalledTimes(1);
    expect(publishOrderCreated.mock.calls[0][0]).toMatchObject({
      eventType: 'order.created',
      orderId: res.body.orderId,
    });
  });

  test('POST /orders rejects missing userId', async () => {
    const res = await request(app)
      .post('/orders')
      .send({ items: [{ sku: 'SKU-001', quantity: 1, price: 5 }] });

    expect(res.status).toBe(400);
    expect(publishOrderCreated).not.toHaveBeenCalled();
  });

  test('POST /orders rejects empty items', async () => {
    const res = await request(app).post('/orders').send({ userId: 'u-1', items: [] });
    expect(res.status).toBe(400);
  });

  test('GET /orders/:id returns the created order', async () => {
    const createRes = await request(app)
      .post('/orders')
      .send({
        userId: 'u-42',
        items: [{ sku: 'SKU-002', name: 'Cable', quantity: 1, price: 9.99 }],
      });

    const getRes = await request(app).get(`/orders/${createRes.body.orderId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.userId).toBe('u-42');
  });

  test('GET /orders/:id returns 404 for unknown order', async () => {
    const res = await request(app).get('/orders/does-not-exist');
    expect(res.status).toBe(404);
  });

  test('POST /orders returns 502 when publishing fails', async () => {
    publishOrderCreated.mockRejectedValueOnce(new Error('broker down'));
    const res = await request(app)
      .post('/orders')
      .send({ userId: 'u-1', items: [{ sku: 'SKU-001', quantity: 1, price: 5 }] });

    expect(res.status).toBe(502);
  });
});
