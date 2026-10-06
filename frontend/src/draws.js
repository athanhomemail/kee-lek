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
