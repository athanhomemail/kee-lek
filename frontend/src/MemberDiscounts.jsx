import LotteryOptions from "./LotteryOptions.jsx";
import {
  rememberDiscounts,
  reconcileDiscounts,
  memberDiscountRates,
} from "./memberDiscountState.js";
import React, { useState, useEffect } from "react";
import { discountTypes } from "./discounts.js";
import { labels } from "./keying.js";
const zero = () => Object.fromEntries(discountTypes.map((k) => [k, 0]));
export default function MemberDiscounts({ state, api, act, renderActions }) {
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const [lotteryId, setLotteryId] = useState(
    String(state.lotteries.find((l) => !l.deleted_at)?.id || ""),
  );
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pendingRates, setPendingRates] = useState({});
  useEffect(() => {
    setPendingRates((pending) =>
      reconcileDiscounts(pending, state.memberDiscounts),
    );
  }, [state.memberDiscounts]);
  const members = state.users.filter((m) => m.role === "Member" && m.active);
  useEffect(() => {
    setSelected((previous) => {
      const active = previous.filter((id) =>
        state.users.some((m) => m.id === id && m.role === "Member" && m.active),
      );
      return active.length === previous.length ? previous : active;
    });
    if (
      !state.lotteries.some((l) => !l.deleted_at && String(l.id) === lotteryId)
    ) {
      setLotteryId(
        String(state.lotteries.find((l) => !l.deleted_at)?.id || ""),
      );
      setDraft(null);
    }
  }, [state.users, state.lotteries, lotteryId]);
  const visible = members.filter((m) =>
    `${m.name} ${m.username} ${m.phone || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const ratesFor = (id) =>
    memberDiscountRates(state.memberDiscounts, pendingRates, id, lotteryId);
  const rates =
    draft || (selected.length === 1 ? ratesFor(selected[0]) : zero());
  const reset = () => {
    setDraft(null);
    setSaved(false);
  };
  return (
    <fieldset
      className="member-discounts member-discounts-fields"
      disabled={saving}
    >
      <div className="member-list-toolbar">
        <input
          aria-label="ค้นหาสมาชิก"
          placeholder="ค้นหาชื่อ / บัญชี / เบอร์โทร"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          onClick={() => {
            const all = visible.every((m) => selected.includes(m.id));
            setSelected(
              all
                ? selected.filter((id) => !visible.some((m) => m.id === id))
                : [...new Set([...selected, ...visible.map((m) => m.id)])],
            );
            reset();
          }}
        >
          เลือกทั้งหมด / ล้าง
        </button>
      </div>
      <div className="compact-members">
        {visible.map((m) => (
          <div className="compact-member" key={m.id}>
            <label>
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
                <strong>{m.name}</strong>
                <small>
                  {m.username}
                  {m.phone ? ` · ${m.phone}` : ""}
                </small>
              </span>
            </label>
            <div className="member-row-actions">
              <button
                onClick={() => {
                  setSelected([m.id]);
                  reset();
                }}
              >
                ส่วนลด
              </button>
              {renderActions?.(m)}
            </div>
          </div>
        ))}
      </div>
      {!visible.length && <p className="muted">ไม่พบสมาชิก</p>}
      {selected.length > 0 && (
        <div className="member-discount-editor">
          <div className="section-head">
            <h3>
              ส่วนลด ·{" "}
              {selected.length === 1
                ? members.find((m) => m.id === selected[0])?.name
                : `${selected.length} คน`}
            </h3>
            <button
              onClick={() => {
                setSelected([]);
                reset();
              }}
            >
              ปิด
            </button>
          </div>
          <label>
            ประเภทหวย
            <select
              value={lotteryId}
              onChange={(e) => {
                setLotteryId(e.target.value);
                reset();
              }}
            >
              <LotteryOptions
                items={state.lotteries.filter((l) => !l.deleted_at)}
              />
            </select>
          </label>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const memberIds = [...selected];
              const savedLotteryId = Number(lotteryId);
              const savedRates = Object.fromEntries(
                discountTypes.map((k) => [k, Number(rates[k])]),
              );
              setSaving(true);
              setSaved(false);
              try {
                await act(async () => {
                  await api.post("/member-discounts", {
                    memberIds,
                    lotteryId: savedLotteryId,
                    rates: savedRates,
                  });
                  setPendingRates((previous) =>
                    rememberDiscounts(
                      previous,
                      memberIds,
                      savedLotteryId,
                      savedRates,
                    ),
                  );
                  setDraft(savedRates);
                  setSaved(true);
                });
              } finally {
                setSaving(false);
              }
            }}
          >
            {selected.length > 1 && (
              <p className="muted">ใช้อัตราด้านล่างกับทุกคนที่เลือก</p>
            )}
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
            <p className="muted">บาทและกีบใช้อัตราเดียวกัน · มีผลกับโพยใหม่</p>
            <button
              className="primary"
              disabled={saving || !selected.length || !lotteryId}
            >
              {saving ? "กำลังบันทึก…" : "บันทึกส่วนลดสำหรับสมาชิกที่เลือก"}
            </button>
            {saved && <p role="status">บันทึกส่วนลดแล้ว</p>}
          </form>
        </div>
      )}
    </fieldset>
  );
}
