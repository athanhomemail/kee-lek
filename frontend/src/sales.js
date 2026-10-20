export function offeredLotteries(state) {
  return (state?.lotteries || []).filter(
    (l) =>
      !l.deleted_at &&
      l.enabled &&
      state.settings?.find((s) => String(s.lottery_id) === String(l.id))?.config
        ?.selling !== false,
  );
}
