import { createPortal } from "react-dom";
import React, { useEffect, useState, useRef } from "react";
import LotteryFlag from "./LotteryFlag.jsx";
import { resultColumns } from "./draws.js";

function ResultCard({ lottery, draw, now, isAdmin, onEdit, onHistory }) {
  const info = lottery || draw;
  return (
    <article className="result-tile">
      <header className="result-tile-heading">
        <LotteryFlag flag={info.flag} />
        <div>
          <h2 title={info.name}>{info.name}</h2>
          <small>{info.kind}</small>
        </div>
      </header>
      <p className="result-tile-date">
        {draw
          ? `งวด ${new Date(draw.draw_date).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })}`
          : "ไม่มีงวดในช่วงที่เลือก"}
      </p>
      <div className="result-tile-numbers">
        {[
          ["3 ตัวบน", "top3"],
          ["2 ตัวบน", "top2"],
          ["2 ตัวล่าง", "bottom2"],
        ].map(([label, field]) => (
          <div key={field}>
            <small>{label}</small>
            <strong>
              {(draw &&
                (isAdmin || now >= new Date(draw.result_at).getTime()) &&
                draw[field]) ||
                "—"}
            </strong>
          </div>
        ))}
      </div>
      <footer className="result-tile-actions">
        {onHistory && (
          <button
            aria-haspopup="dialog"
            aria-label={`ดูย้อนหลัง ${info.name}`}
            onClick={onHistory}
          >
            ดูย้อนหลัง
          </button>
        )}
        {isAdmin && (
          <button
            disabled={!draw}
            className="admin-result-action"
            onClick={() => draw && onEdit(draw)}
          >
            {draw?.top3 ? "แก้ไขผล" : "กรอกผลหวย"}
          </button>
        )}
        {!onHistory && !isAdmin && (
          <span className="muted">
            {draw?.top3 ? "ผลรางวัล" : "รอผลรางวัล"}
          </span>
        )}
      </footer>
    </article>
  );
}
function HistoryDialog({ titleId, onClose, children }) {
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    const previousFocus = document.activeElement;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node.showModal();
    return () => {
      node.close();
      document.body.style.overflow = previous;
      previousFocus?.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      className="result-history-modal"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="result-history-modal-body">{children}</div>
    </dialog>,
    document.body,
  );
}

function LotteryResults({
  lottery,
  current,
  now,
  isAdmin,
  onEdit,
  api,
  from,
  to,
  revision,
  matches,
}) {
  const [open, setOpen] = useState(false);
  const [cursors, setCursors] = useState([null]);
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setPage(0);
    setCursors([null]);
  }, [lottery.id, from, to, revision, current?.id]);
  const before = cursors[page];
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    api
      .get(`/lotteries/${lottery.id}/history`, {
        signal: controller.signal,
        params: {
          before: before || undefined,
          exclude: current?.id || 0,
          from: from || undefined,
          to: to || undefined,
        },
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) setData(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e.response?.data?.error || "โหลดประวัติไม่สำเร็จ");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, before, lottery.id, current?.id, from, to, revision, retry]);
  const titleId = `history-title-${lottery.id}`;
  return (
    <>
      <ResultCard
        lottery={lottery}
        draw={current && matches(current) ? current : null}
        now={now}
        isAdmin={isAdmin}
        onEdit={onEdit}
        onHistory={() => setOpen(true)}
      />
      {open && (
        <HistoryDialog titleId={titleId} onClose={() => setOpen(false)}>
          <header className="result-history-modal-heading">
            <div>
              <h2 id={titleId}>ย้อนหลัง · {lottery.name}</h2>
              <p className="muted">
                {from || to
                  ? `${from || "เริ่มต้น"} – ${to || "ล่าสุด"} · `
                  : ""}
                ครั้งละ 9 งวด
              </p>
            </div>
            <button
              autoFocus
              aria-label="ปิดประวัติหวย"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </header>
          <div className="result-history-modal-content" aria-busy={loading}>
            {loading && <p role="status">กำลังโหลดงวดย้อนหลัง…</p>}
            {error && (
              <p role="alert">
                {error}{" "}
                <button onClick={() => setRetry(retry + 1)}>ลองอีกครั้ง</button>
              </p>
            )}
            {data && (
              <>
                <div className="result-history-grid">
                  {data.draws.map((d) => (
                    <ResultCard
                      key={d.id}
                      draw={d}
                      now={now}
                      isAdmin={isAdmin}
                      onEdit={(draw) => {
                        setOpen(false);
                        onEdit(draw);
                      }}
                    />
                  ))}
                </div>
                {!data.draws.length && (
                  <p className="muted result-history-empty">
                    ไม่มีงวดย้อนหลังในช่วงที่เลือก
                  </p>
                )}
              </>
            )}
          </div>
          <nav
            className="result-history-pagination"
            aria-label="เปลี่ยนหน้าผลย้อนหลัง"
          >
            <button
              disabled={!page || loading}
              onClick={() => setPage(page - 1)}
            >
              ก่อนหน้า
            </button>
            <span>หน้า {page + 1}</span>
            <button
              disabled={!data?.nextBefore || loading}
              onClick={() => {
                setCursors([...cursors.slice(0, page + 1), data.nextBefore]);
                setPage(page + 1);
              }}
            >
              เก่ากว่านี้
            </button>
          </nav>
        </HistoryDialog>
      )}
    </>
  );
}
export default function ResultGrid({
  draws,
  lotteries,
  now,
  matches,
  isAdmin = false,
  onEdit,
  api,
  from,
  to,
  revision,
}) {
  const columns = resultColumns(draws, lotteries, now);
  if (!lotteries.length)
    return <p className="muted">ไม่มีประเภทหวยที่ตรงกับตัวกรอง</p>;
  return (
    <div className="lottery-result-rows">
      {lotteries.map((l) => (
        <LotteryResults
          key={l.id}
          lottery={l}
          current={columns.find((c) => c.lotteryId === l.id)?.current}
          now={now}
          matches={matches}
          isAdmin={isAdmin}
          onEdit={onEdit}
          api={api}
          from={from}
          to={to}
          revision={revision}
        />
      ))}
    </div>
  );
}
