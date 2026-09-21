'use strict';

const { updateInventory } = require('../src/inventoryProcessor');
const { getStock } = require('../src/stockStore');

describe('updateInventory', () => {
  test('reserves stock for every item in the order', async () => {
    const sku = `SKU-TEST-${Date.now()}`;
    const before = getStock(sku);

    const result = await updateInventory({
      orderId: 'o-1',
      items: [{ sku, quantity: 3 }],
    });

    expect(result.orderId).toBe('o-1');
    expect(result.updates).toEqual([{ sku, remaining: before - 3 }]);
    expect(getStock(sku)).toBe(before - 3);
  });

  test('handles multiple items in one order', async () => {
    const skuA = `SKU-A-${Date.now()}`;
    const skuB = `SKU-B-${Date.now()}`;

    const result = await updateInventory({
      orderId: 'o-2',
      items: [
        { sku: skuA, quantity: 1 },
        { sku: skuB, quantity: 5 },
      ],
    });

    expect(result.updates).toHaveLength(2);
    expect(getStock(skuA)).toBe(99);
    expect(getStock(skuB)).toBe(95);
  });
});
