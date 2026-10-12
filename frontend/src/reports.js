export const reportCurrencyOf = (bill) =>
  bill.currency || bill.items?.[0]?.currency || "THB";

export function currencyTotals(bills, field = "gross") {
  const totals = { THB: 0, LAK: 0 };
  for (const bill of bills) {
    if (bill.status !== "active") continue;
    const currency = reportCurrencyOf(bill);
    totals[currency] =
      Math.round((totals[currency] + Number(bill[field] || 0)) * 100) / 100;
  }
  return totals;
}

export function rankedNumbers(
  bills,
  drawId,
  sortCurrency = "THB",
  direction = "desc",
  type = "",
) {
  const rows = new Map();
  for (const bill of bills) {
    if (bill.status !== "active" || String(bill.draw_id) !== String(drawId))
      continue;
    const currency = reportCurrencyOf(bill);
    for (const item of bill.items) {
      if (type && item.type !== type) continue;
      const key = `${item.type}:${item.number}`;
      if (!rows.has(key))
        rows.set(key, {
          key,
          number: item.number,
          type: item.type,
          THB: 0,
          LAK: 0,
          count: 0,
        });
      const row = rows.get(key);
      row[currency] =
        Math.round((row[currency] + Number(item.amount)) * 100) / 100;
      row.count++;
    }
  }
  return [...rows.values()].sort(
    (a, b) =>
      (direction === "asc" ? 1 : -1) * (a[sortCurrency] - b[sortCurrency]) ||
      a.number.localeCompare(b.number) ||
      a.type.localeCompare(b.type),
  );
}

export const reportTypes = [
  "3top",
  "3tod",
  "2top",
  "2bottom",
  "runTop",
  "runBottom",
];
const roundMoney = (value) => Math.round(value * 100) / 100;
export const drawBills = (bills, drawId) =>
  bills.filter(
    (bill) =>
      bill.status === "active" && String(bill.draw_id) === String(drawId),
  );

export function winsForResult(item, top3, bottom2) {
  const top2 = top3.slice(-2);
  switch (item.type) {
    case "3top":
      return item.number === top3;
    case "3tod":
      return [...item.number].sort().join("") === [...top3].sort().join("");
    case "2top":
      return item.number === top2;
    case "2bottom":
      return item.number === bottom2;
    case "runTop":
      return top2.includes(item.number);
    case "runBottom":
      return bottom2.includes(item.number);
    default:
      return false;
  }
}

export function reportGroups(
  bills,
  drawId,
  by = "type",
  users = [],
  exchangeRates,
) {
  const groups = new Map();
  if (by === "type")
    for (const type of reportTypes)
      groups.set(type, { key: type, THB: 0, LAK: 0 });
  for (const bill of drawBills(bills, drawId)) {
    const currency = reportCurrencyOf(bill);
    for (const item of bill.items || []) {
      const key = by === "type" ? item.type : String(bill.member_id);
      if (!groups.has(key))
        groups.set(key, {
          key,
          name:
            bill.member_name ||
            users.find((u) => String(u.id) === key)?.name ||
            `สมาชิก #${key}`,
          THB: 0,
          LAK: 0,
        });
      const row = groups.get(key);
      row[currency] += Number(item.amount || 0);
      if (exchangeRates) {
        row.lakInTHB ??= 0;
        if (currency === "LAK") {
          if (!row.missingRate) {
            const converted = kipToBaht(
              item.amount,
              rateForBill(bill, exchangeRates),
            );
            if (converted === null) row.missingRate = true;
            else row.lakInTHB += converted;
          }
        }
      }
    }
  }
  return [...groups.values()].map((row) => ({
    ...row,
    THB: roundMoney(row.THB),
    LAK: roundMoney(row.LAK),
    ...(exchangeRates
      ? {
          lakInTHB: row.missingRate ? null : row.lakInTHB || 0,
          totalTHB: row.missingRate ? null : row.THB + (row.lakInTHB || 0),
        }
      : {}),
  }));
}

export function forecastReport(
  bills,
  drawId,
  side = "top",
  fixedResult = "00",
  exchangeRates,
) {
  const selected = drawBills(bills, drawId);
  const purchase = Object.fromEntries(
    reportTypes.map((type) => [type, { THB: 0, LAK: 0 }]),
  );
  const entries = selected.flatMap((bill) =>
    (bill.items || []).map((item) => ({
      ...item,
      currency: reportCurrencyOf(bill),
      exchangeRate: rateForBill(bill, exchangeRates),
    })),
  );
  const received = { THB: 0, LAK: 0 };
  for (const item of entries) {
    if (purchase[item.type])
      purchase[item.type][item.currency] += Number(item.amount);
    received[item.currency] += Number(item.net ?? item.amount);
  }
  const convertedReceived = exchangeRates
    ? convertedDrawTotals(bills, drawId, exchangeRates)
    : null;
  const rows = Array.from(
    { length: side === "top" ? 1000 : 100 },
    (_, index) => {
      const number = String(index).padStart(side === "top" ? 3 : 2, "0");
      const top3 = side === "top" ? number : fixedResult;
      const bottom2 = side === "bottom" ? number : fixedResult;
      const payout = Object.fromEntries(
        reportTypes.map((type) => [type, { THB: 0, LAK: 0 }]),
      );
      let count = 0;
      let lakPaidInTHB = 0;
      for (const item of entries)
        if (winsForResult(item, top3, bottom2)) {
          count++;
          if (exchangeRates && item.currency === "LAK")
            lakPaidInTHB = addConverted(
              lakPaidInTHB,
              kipToBaht(
                Number(item.amount) * Number(item.rate || 0),
                item.exchangeRate,
              ),
            );
          payout[item.type][item.currency] +=
            Number(item.amount) * Number(item.rate || 0);
        }
      const paid = { THB: 0, LAK: 0 };
      for (const type of reportTypes)
        for (const currency of ["THB", "LAK"]) {
          payout[type][currency] = roundMoney(payout[type][currency]);
          paid[currency] += payout[type][currency];
        }
      return {
        number,
        top3,
        top2: top3.slice(-2),
        bottom2,
        payout,
        paid,
        count,
        THB: roundMoney(received.THB - paid.THB),
        LAK: roundMoney(received.LAK - paid.LAK),
        ...(exchangeRates
          ? {
              lakPaidInTHB,
              lakProfitInTHB:
                convertedReceived.lakInTHB === null || lakPaidInTHB === null
                  ? null
                  : convertedReceived.lakInTHB - lakPaidInTHB,
              totalProfitTHB:
                convertedReceived.totalTHB === null || lakPaidInTHB === null
                  ? null
                  : convertedReceived.totalTHB - paid.THB - lakPaidInTHB,
            }
          : {}),
      };
    },
  );
  for (const type of reportTypes)
    for (const currency of ["THB", "LAK"])
      purchase[type][currency] = roundMoney(purchase[type][currency]);
  return {
    purchase,
    received: { THB: roundMoney(received.THB), LAK: roundMoney(received.LAK) },
    rows,
    ...(exchangeRates ? { convertedReceived } : {}),
  };
}

// Stored LAK amounts are K units; exchange rates are actual kip per baht.
export function kipToBaht(amountK, rate) {
  const value = Number(rate);
  return Number.isFinite(value) && value > 0
    ? (Number(amountK) * 1000) / value
    : null;
}
const rateForBill = (bill, exchangeRates) =>
  exchangeRates?.find(
    (entry) => String(entry.leader_id) === String(bill.leader_id),
  )?.rate;
const addConverted = (sum, value) =>
  sum === null || value === null ? null : sum + value;
export function convertedDrawTotals(bills, drawId, exchangeRates) {
  let lakInTHB = 0,
    thb = 0;
  for (const bill of drawBills(bills, drawId))
    for (const item of bill.items || []) {
      if (reportCurrencyOf(bill) === "LAK")
        lakInTHB = addConverted(
          lakInTHB,
          kipToBaht(
            Number(item.net ?? item.amount),
            rateForBill(bill, exchangeRates),
          ),
        );
      else thb += Number(item.net ?? item.amount);
    }
  return { lakInTHB, totalTHB: lakInTHB === null ? null : thb + lakInTHB };
}

// One explicit result, including the separately recorded two-digit top result.
export function resultScenario(bills, drawId, result) {
  const received = { THB: 0, LAK: 0 };
  const paid = { THB: 0, LAK: 0 };
  const payout = Object.fromEntries(
    reportTypes.map((t) => [t, { THB: 0, LAK: 0 }]),
  );
  let count = 0;
  for (const bill of drawBills(bills, drawId)) {
    const currency = reportCurrencyOf(bill);
    for (const item of bill.items || []) {
      received[currency] += Number(item.net ?? item.amount);
      const wins =
        item.type === "2top"
          ? item.number === result.top2
          : item.type === "runTop"
            ? result.top2.includes(item.number)
            : winsForResult(item, result.top3, result.bottom2);
      if (wins) {
        count++;
        payout[item.type][currency] +=
          Number(item.amount) * Number(item.rate || 0);
      }
    }
  }
  for (const t of reportTypes)
    for (const c of ["THB", "LAK"]) {
      payout[t][c] = roundMoney(payout[t][c]);
      paid[c] += payout[t][c];
    }
  return {
    received,
    paid,
    payout,
    count,
    profit: {
      THB: roundMoney(received.THB - paid.THB),
      LAK: roundMoney(received.LAK - paid.LAK),
    },
  };
}

export function numberExposure(bills, drawId, currency = "THB") {
  const rows = new Map();
  for (const bill of drawBills(bills, drawId)) {
    if (reportCurrencyOf(bill) !== currency) continue;
    for (const item of bill.items || []) {
      // All permutations of a tod number win together, so share one exposure.
      const number =
        item.type === "3tod" ? [...item.number].sort().join("") : item.number;
      const key = `${item.type}:${number}`;
      if (!rows.has(key))
        rows.set(key, {
          key,
          type: item.type,
          number,
          amount: 0,
          payout: 0,
          count: 0,
        });
      const row = rows.get(key);
      row.amount += Number(item.amount);
      row.payout += Number(item.amount) * Number(item.rate || 0);
      row.count++;
    }
  }
  return [...rows.values()].map((r) => ({
    ...r,
    amount: roundMoney(r.amount),
    payout: roundMoney(r.payout),
  }));
}

export function winningBills(bills, draw, now = Date.now()) {
  if (
    !draw?.top3 ||
    !draw.top2 ||
    !draw.bottom2 ||
    now < new Date(draw.result_at).getTime()
  )
    return [];
  return drawBills(bills, draw.id).flatMap((bill) => {
    const items = (bill.items || [])
      .filter((item) =>
        item.type === "2top"
          ? item.number === draw.top2
          : item.type === "runTop"
            ? draw.top2.includes(item.number)
            : winsForResult(item, draw.top3, draw.bottom2),
      )
      .map((item) => ({
        ...item,
        payout: roundMoney(Number(item.amount) * Number(item.rate || 0)),
      }));
    const total = roundMoney(items.reduce((sum, item) => sum + item.payout, 0));
    return total > 0
      ? [
          {
            ...bill,
            currency: reportCurrencyOf(bill),
            winningItems: items,
            winningTotal: total,
          },
        ]
      : [];
  });
}
