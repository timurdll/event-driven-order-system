'use strict';

const orders = new Map();

function saveOrder(order) {
  orders.set(order.orderId, order);
  return order;
}

function getOrder(orderId) {
  return orders.get(orderId);
}

module.exports = { saveOrder, getOrder };
