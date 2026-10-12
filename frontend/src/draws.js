// Keep the closest unreleased draw per lottery, even if its sales cutoff passed.
export function nextDraws(draws, now = Date.now()) {
  const next = new Map();
  for (const draw of draws) {
    const time = new Date(draw.result_at).getTime();
    if (!Number.isFinite(time) || time <= now) continue;
    const previous = next.get(draw.lottery_id);
    if (!previous || time < new Date(previous.result_at).getTime())
      next.set(draw.lottery_id, draw);
  }
  return [...next.values()].sort(
    (a, b) => new Date(a.result_at) - new Date(b.result_at),
  );
}
export function resultDraws(draws, now = Date.now()) {
  const nextIds = new Set(nextDraws(draws, now).map((d) => d.id));
  return draws
    .filter((d) => new Date(d.result_at).getTime() <= now || nextIds.has(d.id))
    .sort((a, b) => new Date(b.result_at) - new Date(a.result_at));
}
export function homePage(role) {
  return role === "Member" ? "คีย์" : "ผล";
}

// Result rows advance at midnight in Thailand, independently of publication time.
export function resultColumns(draws, lotteries = [], now = Date.now()) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const groups = new Map();
  for (const draw of draws) {
    const day = String(draw.draw_date || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    if (!groups.has(draw.lottery_id)) groups.set(draw.lottery_id, []);
    groups.get(draw.lottery_id).push(draw);
  }
  const order = [...lotteries.map((l) => l.id), ...groups.keys()];
  return [...new Set(order)]
    .filter((id) => groups.has(id))
    .map((id) => {
      const sorted = groups
        .get(id)
        .sort((a, b) => String(a.draw_date).localeCompare(String(b.draw_date)));
      const history = sorted
        .filter((d) => String(d.draw_date).slice(0, 10) < today)
        .reverse();
      const upcoming = sorted.find(
        (d) => String(d.draw_date).slice(0, 10) >= today,
      );
      return {
        lotteryId: id,
        current: upcoming || history.shift() || null,
        history,
      };
    });
}
