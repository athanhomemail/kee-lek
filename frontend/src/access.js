export function accessTime(expiresAt, now = Date.now()) {
  const remaining = new Date(expiresAt).getTime() - now;
  return {
    days: Number.isFinite(remaining)
      ? Math.max(0, Math.ceil(remaining / 86400000))
      : 0,
    expiring:
      Number.isFinite(remaining) && remaining > 0 && remaining <= 3 * 86400000,
  };
}
