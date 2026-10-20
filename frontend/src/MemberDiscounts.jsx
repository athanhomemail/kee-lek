import React, { useState } from "react";
import { discountTypes } from "./discounts.js";
import { labels } from "./keying.js";
const zero = () => Object.fromEntries(discountTypes.map((k) => [k, 0]));
export default function MemberDiscounts({ state, api, act }) {
  const [selected, setSelected] = useState([]);
  const [lotteryId, setLotteryId] = useState(
    String(state.lotteries[0]?.id || ""),
  );
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const members = state.users.filter((m) => m.role === "Member" && m.active);
  const ratesFor = (id) =>
    state.memberDiscounts?.find(
      (r) =>
        String(r.member_id) === String(id) &&
        String(r.lottery_id) === lotteryId,
    )?.rates || zero();
  const rates =
    draft || (selected.length === 1 ? ratesFor(selected[0]) : zero());
  const reset = () => {
    setDraft(null);
    setSaved(false);
  };
  return (
    <section className="member-discounts">
      <h3>กำหนดส่วนลดให้สมาชิก</h3>
      <p>
        เลือกสมาชิกหนึ่งคนหรือหลายคน แล้วกำหนดส่วนลดสำหรับหวยที่เลือก
        ใช้อัตราเดียวกันทั้งบาทและกีบ ค่าเริ่มต้นทุกโหมดคือ 0%
      </p>
      <label>
        ประเภทหวย
        <select
          value={lotteryId}
          onChange={(e) => {
            setLotteryId(e.target.value);
            reset();
          }}
        >
          {state.lotteries.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => {
          setSelected(
            selected.length === members.length ? [] : members.map((m) => m.id),
          );
          reset();
        }}
      >
        เลือกทั้งหมด / ล้างการเลือก
      </button>
      <div className="discount-members">
        {members.map((m) => (
          <label key={m.id}>
            <input
              type="checkbox"
              checked={selected.includes(m.id)}
              onChange={(e) => {
                setSelected(
                  e.target.checked
                    ? [...selected, m.id]
                    : selected.filter((id) => id !== m.id),
                );
                reset();
              }}
            />
            <span>
              {m.name} ({m.username})
              <small>
                {discountTypes
                  .map((k) => `${labels[k]} ${ratesFor(m.id)[k] || 0}%`)
                  .join(" · ")}
              </small>
            </span>
          </label>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSaving(true);
          setSaved(false);
          act(async () => {
            try {
              await api.post("/member-discounts", {
                memberIds: selected,
                lotteryId: Number(lotteryId),
                rates: Object.fromEntries(
                  discountTypes.map((k) => [k, Number(rates[k])]),
                ),
              });
              setSaved(true);
              setDraft(null);
            } finally {
              setSaving(false);
            }
          });
        }}
      >
        <p>
          เลือกแล้ว {selected.length} คน
          {selected.length > 1
            ? " — บันทึกจะใช้อัตราทั้ง 6 โหมดด้านล่างกับทุกคนที่เลือก"
            : ""}
        </p>
        <div className="discount-rate-grid">
          {discountTypes.map((k) => (
            <label key={k}>
              {labels[k]} (%)
              <input
                required
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={rates[k]}
                onChange={(e) => {
                  setDraft({ ...rates, [k]: e.target.value });
                  setSaved(false);
                }}
              />
            </label>
          ))}
        </div>
        <p className="muted">
          มีผลกับโพยใหม่หลังบันทึก โพยที่บันทึกแล้วจะใช้อัตราเดิม
        </p>
        <button
          className="primary"
          disabled={saving || !selected.length || !lotteryId}
        >
          {saving ? "กำลังบันทึก…" : "บันทึกส่วนลดสำหรับสมาชิกที่เลือก"}
        </button>
        {saved && <p role="status">บันทึกส่วนลดแล้ว</p>}
      </form>
    </section>
  );
}
