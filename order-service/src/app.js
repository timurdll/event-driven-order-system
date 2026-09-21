'use strict';

const express = require('express');
const { randomUUID } = require('crypto');
const { saveOrder, getOrder } = require('./store');

function createApp({ publishOrderCreated }) {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'order-service' });
  });

  app.post('/orders', async (req, res) => {
    const { userId, items } = req.body || {};

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId is required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items must be a non-empty array' });
    }
    for (const item of items) {
      if (!item.sku || !item.quantity || typeof item.price !== 'number') {
        return res.status(400).json({ error: 'each item requires sku, quantity and price' });
      }
    }

    const totalAmount = Number(
      items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2),
    );

    const order = {
      orderId: randomUUID(),
      userId,
      items,
      totalAmount,
      status: 'CREATED',
      createdAt: new Date().toISOString(),
    };

    saveOrder(order);

    const event = {
      eventType: 'order.created',
      eventId: randomUUID(),
      orderId: order.orderId,
      userId: order.userId,
      totalAmount: order.totalAmount,
      items: order.items,
      timestamp: order.createdAt,
    };

    try {
      await publishOrderCreated(event);
    } catch (err) {
      req.log?.error?.(err);
      return res.status(502).json({ error: 'failed to publish order event', orderId: order.orderId });
    }

    return res.status(201).json(order);
  });

  app.get('/orders/:orderId', (req, res) => {
    const order = getOrder(req.params.orderId);
    if (!order) {
      return res.status(404).json({ error: 'order not found' });
    }
    return res.status(200).json(order);
  });

  return app;
}

module.exports = { createApp };
