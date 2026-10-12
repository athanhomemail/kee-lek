import React from "react";
import LotteryFlag from "./LotteryFlag.jsx";
import { resultColumns } from "./draws.js";

function ResultCard({ draw, now }) {
  return (
    <section className="panel result">
      <span className="badge">{draw.kind}</span>
      <h2>
        <LotteryFlag flag={draw.flag} /> {draw.name}
      </h2>
      <p className="muted">
        งวด{" "}
        {new Date(draw.draw_date).toLocaleDateString("th-TH", {
          timeZone: "Asia/Bangkok",
        })}
      </p>
      <div className="winning">
        {[
          ["3 ตัวบน", "top3"],
          ["2 ตัวบน", "top2"],
          ["2 ตัวล่าง", "bottom2"],
        ].map(([label, field]) => (
          <div key={field}>
            <small>{label}</small>
            <strong>
              {(now >= new Date(draw.result_at).getTime() && draw[field]) ||
                "—"}
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ResultGrid({ draws, lotteries, now, matches }) {
  const columns = resultColumns(draws, lotteries, now);
  // Select each lottery's current draw before applying date filters.
  const visible = columns.filter((c) =>
    [c.current, ...c.history].some((d) => d && matches(d)),
  );
  if (!visible.length) return <p className="muted">ไม่มีงวดที่ตรงกับตัวกรอง</p>;
  const history = visible.map((c) => c.history.filter(matches));
  const rows = Math.max(0, ...history.map((items) => items.length));
  return (
    <div className="result-grid-scroll">
      <div
        className="result-grid"
        style={{ "--result-columns": visible.length }}
      >
        <h2 className="result-section-label">
          งวดปัจจุบัน / รอออกผล / งวดล่าสุด
        </h2>
        {visible.map((c) => (
          <div key={c.lotteryId}>
            {c.current && matches(c.current) ? (
              <ResultCard draw={c.current} now={now} />
            ) : (
              <div className="result-placeholder muted">
                {c.history[0]?.name} · ไม่มีงวดปัจจุบันในช่วงที่เลือก
              </div>
            )}
          </div>
        ))}
        <h2 className="result-section-label result-history-divider">
          งวดย้อนหลัง
        </h2>
        {Array.from({ length: rows }, (_, row) =>
          visible.map((c, column) => (
            <div key={`${c.lotteryId}-${row}`}>
              {history[column][row] && (
                <ResultCard draw={history[column][row]} now={now} />
              )}
            </div>
          )),
        )}
        {!rows && (
          <p className="result-section-label muted">
            ยังไม่มีงวดย้อนหลังในช่วงที่เลือก
          </p>
        )}
      </div>
    </div>
  );
}
