import React, { useState } from "react";
import { paginateBills } from "./billResults.js";
export default function ReportPages({ rows, children, label = "รายการ" }) {
  const [requested, setPage] = useState(1),
    [size, setSize] = useState(25);
  const page = paginateBills(rows, requested, size);
  return (
    <>
      <nav
        className="bill-pagination history-pagination"
        aria-label={`แบ่งหน้า${label}`}
      >
        <span aria-live="polite">
          แสดง {page.start.toLocaleString("th-TH")}–
          {page.end.toLocaleString("th-TH")} จาก{" "}
          {rows.length.toLocaleString("th-TH")} {label}
        </span>
        <div className="bill-pagination-actions">
          <label>
            ต่อหน้า
            <select
              value={size}
              onChange={(e) => {
                setSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={page.page === 1}
            onClick={() => setPage(page.page - 1)}
          >
            ก่อนหน้า
          </button>
          <span>
            หน้า {page.page} / {page.totalPages}
          </span>
          <button
            disabled={page.page === page.totalPages}
            onClick={() => setPage(page.page + 1)}
          >
            ถัดไป
          </button>
        </div>
      </nav>
      {children(page.rows, page.start ? page.start - 1 : 0)}
    </>
  );
}
