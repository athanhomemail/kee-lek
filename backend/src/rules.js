export const types = ["2top", "2bottom", "3top", "3tod", "runTop", "runBottom"];
export const defaults = {
  limit: 1000,
  discount: 0,
  rates: {
    "2top": 95,
    "2bottom": 95,
    "3top": 900,
    "3tod": 150,
    runTop: 3,
    runBottom: 4,
  },
  blocked: [],
  half: [],
  closeAt: "",
};
export function price(items, config) {
  if (!Array.isArray(items) || !items.length || items.length > 1000)
    throw Error("โพยต้องมี 1–1000 รายการ");
  const result = items.map((i) => {
    const length = i.type?.startsWith("2")
      ? 2
      : i.type?.startsWith("3")
        ? 3
        : 1;
    if (
      !types.includes(i.type) ||
      !new RegExp(`^[0-9]{${length}}$`).test(i.number) ||
      !Number.isFinite(i.amount) ||
      i.amount <= 0 ||
      Math.abs(Math.round(i.amount * 100) - i.amount * 100) > 1e-6
    )
      throw Error("เลขหรือจำนวนเงินไม่ถูกต้อง");
    if (config.blocked.includes(i.number)) throw Error("มีเลขปิดรับในโพย");
    const discount = Number(config.discounts?.[i.type] ?? config.discount ?? 0);
    return {
      ...i,
      discount,
      rate:
        Number(config.rates[i.type]) *
        (config.half.includes(i.number) ? 0.5 : 1),
      net: Math.round(i.amount * (1 - discount / 100) * 100) / 100,
    };
  });
  return {
    items: result,
    gross: result.reduce((s, i) => s + i.amount, 0),
    net: Math.round(result.reduce((s, i) => s + i.net, 0) * 100) / 100,
  };
}
export function winnings(bill, draw) {
  return bill.items.reduce((sum, i) => {
    const win =
      i.type === "2top"
        ? i.number === draw.top2
        : i.type === "2bottom"
          ? i.number === draw.bottom2
          : i.type === "3top"
            ? i.number === draw.top3
            : i.type === "3tod"
              ? [...i.number].sort().join("") ===
                [...(draw.top3 || "")].sort().join("")
              : i.type === "runTop"
                ? draw.top2?.includes(i.number)
                : draw.bottom2?.includes(i.number);
    return sum + (win ? i.amount * i.rate : 0);
  }, 0);
}
