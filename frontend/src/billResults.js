export function billResultStatus(bill, draw, now = Date.now()) {
  if (bill.status === "cancelled") return "cancelled";
  if (
    !draw?.top3 ||
    !draw.top2 ||
    !draw.bottom2 ||
    now < new Date(draw.result_at).getTime()
  )
    return "pending";
  return Number(bill.win || 0) > 0 ? "won" : "lost";
}
export function filterResultBills(
  bills,
  draws,
  {
    status = "",
    currency = "",
    min = "",
    max = "",
    sort = "latest",
    now = Date.now(),
  } = {},
) {
  const drawsById = new Map(draws.map((draw) => [String(draw.id), draw]));
  return bills
    .filter((b) => {
      const result = billResultStatus(b, drawsById.get(String(b.draw_id)), now);
      const unit = b.currency || b.items?.[0]?.currency || "THB";
      return (
        (!status || status === result) &&
        (!currency || currency === unit) &&
        ((min === "" && max === "") ||
          (result === "won" &&
            (min === "" || Number(b.win) >= Number(min)) &&
            (max === "" || Number(b.win) <= Number(max))))
      );
    })
    .sort((a, b) =>
      sort === "win"
        ? Number(b.win || 0) - Number(a.win || 0) || b.id - a.id
        : b.id - a.id,
    );
}

export function paginateBills(bills, requestedPage = 1, pageSize = 25) {
  const totalPages = Math.max(1, Math.ceil(bills.length / pageSize));
  const page = Math.max(1, Math.min(requestedPage, totalPages));
  const offset = (page - 1) * pageSize;
  return {
    page,
    totalPages,
    start: bills.length ? offset + 1 : 0,
    end: Math.min(offset + pageSize, bills.length),
    rows: bills.slice(offset, offset + pageSize),
  };
}
