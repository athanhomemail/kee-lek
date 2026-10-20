export const discountTypes = [
  "3top",
  "3tod",
  "2top",
  "2bottom",
  "runTop",
  "runBottom",
];
export function validateDiscountRates(rates) {
  if (
    !rates ||
    typeof rates !== "object" ||
    Array.isArray(rates) ||
    Object.keys(rates).length !== discountTypes.length ||
    discountTypes.some(
      (k) =>
        typeof rates[k] !== "number" ||
        !Number.isFinite(rates[k]) ||
        rates[k] < 0 ||
        rates[k] > 100 ||
        Math.abs(rates[k] * 100 - Math.round(rates[k] * 100)) > 1e-6,
    )
  )
    throw Error(
      "กรุณากำหนดส่วนลดทั้ง 6 โหมด เป็นตัวเลข 0–100% ทศนิยมไม่เกิน 2 ตำแหน่ง",
    );
  return Object.fromEntries(discountTypes.map((k) => [k, rates[k]]));
}
