const test = require('node:test');
const assert = require('node:assert/strict');
const {
  addedTaxPaise,
  allocateDiscount,
  includedTaxPaise,
  maximumSafeDiscountPaise,
  minimumGrossForMargin,
} = require('../pricing');

test('extracts GST from an inclusive selling price in paise', () => {
  assert.equal(includedTaxPaise(11800, 18), 1800);
  assert.equal(includedTaxPaise(10000, 18), 1525);
  assert.equal(includedTaxPaise(10000, 0), 0);
});

test('adds supplier GST to recorded purchase cost for conservative margin checks', () => {
  const purchaseTaxPaise = addedTaxPaise(10000, 18);
  assert.equal(purchaseTaxPaise, 1800);
  assert.equal(minimumGrossForMargin(10000 + purchaseTaxPaise, 18), 15472);
});

test('sets the inclusive price needed for a 10% gross margin after GST', () => {
  assert.equal(minimumGrossForMargin(9000, 0), 10000);
  assert.equal(minimumGrossForMargin(9000, 18), 11800);
});

test('caps a percentage discount at the product margin floor', () => {
  const lines = [{ totalPaise: 12500, maximumDiscountPaise: 700 }];
  assert.equal(maximumSafeDiscountPaise(1250, lines, 12500), 700);
  assert.deepEqual(allocateDiscount(700, lines, 12500), [700]);
});

test('caps a basket discount against each item margin floor', () => {
  const lines = [
    { totalPaise: 10000, maximumDiscountPaise: 500 },
    { totalPaise: 30000, maximumDiscountPaise: 1200 },
  ];
  assert.equal(maximumSafeDiscountPaise(4000, lines, 40000), 1600);
  assert.deepEqual(allocateDiscount(1600, lines, 40000), [400, 1200]);
});

test('does not discount an item with unknown cost data', () => {
  assert.equal(maximumSafeDiscountPaise(500, [{ totalPaise: 10000, maximumDiscountPaise: null }], 10000), 0);
});
