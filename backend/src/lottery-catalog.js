export function bangkokToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function hideUnpublished(draws, role, now = Date.now()) {
  return draws.map((d) =>
    role !== "Admin" && new Date(d.result_at).getTime() > now
      ? { ...d, top3: null, top2: null, bottom2: null }
      : d,
  );
}
export const currentResultsSql = `SELECT d.*,l.name,l.kind,l.flag,l.enabled FROM lotteries l
 JOIN draws d ON d.id=COALESCE(
 (SELECT id FROM draws WHERE lottery_id=l.id AND draw_date>=? ORDER BY draw_date,id LIMIT 1),
 (SELECT id FROM draws WHERE lottery_id=l.id AND draw_date<? ORDER BY draw_date DESC,id DESC LIMIT 1))
 LEFT JOIN settings s ON s.lottery_id=l.id AND s.leader_id=?
 WHERE l.deleted_at IS NULL`;
export const teamSalesSql =
  " AND l.enabled=1 AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.config,'$.selling')),'true') <> 'false'";
