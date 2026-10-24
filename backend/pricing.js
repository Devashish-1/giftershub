function includedTaxPaise(amountPaise, taxRate) {
  const denominator = 100 + taxRate;
  return Number((BigInt(amountPaise) * BigInt(taxRate) + BigInt(Math.floor(denominator / 2))) / BigInt(denominator));
}

function addedTaxPaise(amountPaise, taxRate) {
  return Number((BigInt(amountPaise) * BigInt(taxRate) + 50n) / 100n);
}

function minimumGrossForMargin(costPaise, taxRate) {
  if (!Number.isSafeInteger(costPaise) || costPaise < 0) return null;
  const minimumTaxablePaise = Number((BigInt(costPaise) * 100n + 89n) / 90n);
  if (!Number.isSafeInteger(minimumTaxablePaise)) return null;
  let low = minimumTaxablePaise;
  let high = Number((BigInt(minimumTaxablePaise) * BigInt(100 + taxRate) + 99n) / 100n) + 2;
  if (!Number.isSafeInteger(high)) return null;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (middle - includedTaxPaise(middle, taxRate) >= minimumTaxablePaise) high = middle;
    else low = middle + 1;
  }
  return low;
}

function allocateDiscount(discountPaise, lines, subtotalPaise) {
  let remainingPaise = discountPaise;
  return lines.map((line, index) => {
    const sharePaise = index === lines.length - 1
      ? remainingPaise
      : subtotalPaise > 0 ? Number((BigInt(discountPaise) * BigInt(line.totalPaise)) / BigInt(subtotalPaise)) : 0;
    remainingPaise -= sharePaise;
    return sharePaise;
  });
}

function maximumSafeDiscountPaise(requestedPaise, lines, subtotalPaise) {
  if (!Number.isSafeInteger(requestedPaise) || requestedPaise <= 0 ||
      !lines.length || !Number.isSafeInteger(subtotalPaise) ||
      !lines.every(line => Number.isSafeInteger(line.maximumDiscountPaise) && line.maximumDiscountPaise >= 0)) return 0;
  let low = 0;
  let high = requestedPaise;
  while (low < high) {
    const candidate = Math.ceil((low + high) / 2);
    const shares = allocateDiscount(candidate, lines, subtotalPaise);
    if (shares.every((share, index) => share <= lines[index].maximumDiscountPaise)) low = candidate;
    else high = candidate - 1;
  }
  return low;
}

module.exports = {
  addedTaxPaise,
  allocateDiscount,
  includedTaxPaise,
  maximumSafeDiscountPaise,
  minimumGrossForMargin,
};
