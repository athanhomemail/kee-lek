import React from "react";
import LotteryFlag from "./LotteryFlag.jsx";
import { resultColumns } from "./draws.js";

function ResultCard({ draw, now, isAdmin, onEdit }) {
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
              {((isAdmin || now >= new Date(draw.result_at).getTime()) &&
                draw[field]) ||
                "—"}
            </strong>
          </div>
        ))}
      </div>
      {isAdmin && (
        <button
          className="admin-result-action result-edit-action"
          onClick={() => onEdit(draw)}
        >
          {draw.top3 ? "แก้ไขผล" : "กรอกผลหวย"}
        </button>
      )}
    </section>
  );
}

export default function ResultGrid({
  draws,
  lotteries,
  now,
  matches,
  isAdmin = false,
  onEdit,
}) {
  const columns = resultColumns(draws, lotteries, now);
  // Select each lottery's current draw before applying date filters.
  const visible = columns.filter((c) =>
    [c.current, ...c.history].some((d) => d && matches(d)),
  );
  if (!visible.length) return <p className="muted">ไม่มีงวดที่ตรงกับตัวกรอง</p>;
  return (
    <div className="lottery-result-rows">
      {visible.map((c) => {
        const history = c.history.filter(matches);
        return (
          <section className="lottery-result-row" key={c.lotteryId}>
            <h2>{c.current?.name || c.history[0]?.name}</h2>
            <div className="lottery-result-track">
              <div className="lottery-result-current">
                <span className="lottery-result-label">
                  งวดปัจจุบัน / งวดล่าสุด
                </span>
                {c.current && matches(c.current) ? (
                  <ResultCard
                    draw={c.current}
                    now={now}
                    isAdmin={isAdmin}
                    onEdit={onEdit}
                  />
                ) : (
                  <div className="panel result-placeholder muted">
                    ไม่มีงวดปัจจุบันในช่วงที่เลือก
                  </div>
                )}
              </div>
              {history.map((d) => (
                <div className="lottery-result-history" key={d.id}>
                  <span className="lottery-result-label">งวดย้อนหลัง</span>
                  <ResultCard
                    draw={d}
                    now={now}
                    isAdmin={isAdmin}
                    onEdit={onEdit}
                  />
                </div>
              ))}
              {!history.length && (
                <p className="muted lottery-result-no-history">
                  ไม่มีงวดย้อนหลังในช่วงที่เลือก
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
