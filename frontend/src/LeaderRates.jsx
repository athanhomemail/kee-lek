import React from "react";
import { ArrowRightLeft } from "lucide-react";
import { labels } from "./keying.js";

export function ExchangeSettings({ state, api, act, modal }) {
  const rate = state.exchangeRates?.find(
    (r) => String(r.leader_id) === String(state.user.id),
  )?.rate;
  return (
    <section className="leader-exchange lao-exchange">
      <div className="lao-exchange-heading">
        <span className="lao-exchange-icon">
          <ArrowRightLeft size={18} />
        </span>
        <div>
          <h3>อัตราแลกเปลี่ยน กีบ → บาท</h3>
          <p className="muted">สำหรับแสดงยอดแปลงในหน้าสถิติเท่านั้น</p>
        </div>
        <span className="lao-exchange-badge">รายงาน</span>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const rate = Number(
            new FormData(event.currentTarget).get("exchangeRate"),
          );
          act(async () => {
            await api.post("/report-exchange", { rate });
            modal({ title: "บันทึกอัตราแลกเปลี่ยนแล้ว" });
          });
        }}
      >
        <label htmlFor="leader-exchange-rate">1 บาท เท่ากับ</label>
        <div className="leader-exchange-input">
          <input
            id="leader-exchange-rate"
            key={rate ?? "unset"}
            name="exchangeRate"
            type="number"
            min="0.000001"
            step="any"
            required
            defaultValue={rate || ""}
            placeholder="จำนวนกีบ"
          />
          <span>กีบ</span>
        </div>
        <button className="primary">บันทึกอัตราแลกเปลี่ยน</button>
      </form>
      <p className="muted lao-exchange-note">
        เช่น 1 บาท = 650 กีบ → ยอด 65 K แสดงเป็น 100 บาท ·
        ใช้ค่าล่าสุดกับรายงานทุกงวด
      </p>
    </section>
  );
}

export function RateTable({ config: c }) {
  const field = (name, value, label, isLimit = false) => (
    <input
      name={name}
      aria-label={label}
      type="number"
      min={isLimit ? "0.01" : "0"}
      step="0.01"
      required
      defaultValue={value}
    />
  );
  return (
    <>
      <div className="rate-table-heading">
        <h3>อัตราจ่ายและวงเงินรับต่อเลข</h3>
        <span className="muted">แยกวงเงินบาทและกีบในแต่ละงวด</span>
      </div>
      <div className="leader-rate-table-scroll">
        <table className="leader-rate-table">
          <thead>
            <tr>
              <th rowSpan={2}>ประเภท</th>
              <th colSpan={2}>บาท (THB)</th>
              <th colSpan={2}>กีบ · หน่วย K</th>
            </tr>
            <tr>
              <th>อัตราจ่าย / 1 บาท</th>
              <th>รับสูงสุด / เลข (บาท)</th>
              <th>อัตราจ่าย / 1 K</th>
              <th>รับสูงสุด / เลข (K)</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(labels).map(([type, label]) => (
              <tr key={type}>
                <th>{label}</th>
                <td>
                  {field(type, c.rates[type], `${label} — อัตราจ่ายต่อ 1 บาท`)}
                </td>
                <td>
                  {field(
                    "limit_" + type,
                    c.limits?.[type] ?? c.limit,
                    `${label} — รับสูงสุดต่อเลขในหนึ่งงวด (บาท)`,
                    true,
                  )}
                </td>
                <td>
                  {field(
                    "lak_" + type,
                    c.lak?.rates?.[type] ?? c.rates[type],
                    `${label} — อัตราจ่ายต่อ 1 K`,
                  )}
                </td>
                <td>
                  {field(
                    "lak_limit_" + type,
                    c.lak?.limits?.[type] ?? 1000,
                    `${label} — รับสูงสุดต่อเลขในหนึ่งงวด (K)`,
                    true,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="rate-table-help">
        <summary>อัตราจ่ายและวงเงินคิดอย่างไร</summary>
        <p>
          วงเงินนับยอดซื้อของสมาชิกทั้งเครือข่าย แยกตามเลข ประเภท สกุลเงิน
          และงวด เช่น 2 ตัวบนเลข 12 รับสูงสุด 1,000 บาท เลขอื่นนับแยกกัน
        </p>
        <p>1 K = 1,000 กีบ · อัตราจ่าย 95 หมายถึงซื้อ 1 K ถูกรางวัลจ่าย 95 K</p>
      </details>
    </>
  );
}
