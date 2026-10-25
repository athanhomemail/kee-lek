import React, { useState } from "react";
import { paginateBills } from "./billResults.js";

export default function BillPages({
  bills,
  renderBill,
  empty,
  initialPageSize = 25,
  pageSizes = [25, 50, 100],
}) {
  const [requestedPage, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const { page, totalPages, start, end, rows } = paginateBills(
    bills,
    requestedPage,
    pageSize,
  );
  const controls = (position) => (
    <nav className="bill-pagination" aria-label={`เปลี่ยนหน้าโพย${position}`}>
      <span aria-live="polite">
        แสดง {start.toLocaleString("th-TH")}–{end.toLocaleString("th-TH")} จาก{" "}
        {bills.length.toLocaleString("th-TH")} โพย
      </span>
      <div className="bill-pagination-actions">
        <label>
          ต่อหน้า
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          ก่อนหน้า
        </button>
        <label>
          หน้า
          <select
            value={page}
            onChange={(e) => setPage(Number(e.target.value))}
          >
            {Array.from({ length: totalPages }, (_, index) => (
              <option key={index + 1} value={index + 1}>
                {index + 1}
              </option>
            ))}
          </select>
          / {totalPages}
        </label>
        <button
          type="button"
          disabled={page === totalPages}
          onClick={() => setPage(page + 1)}
        >
          ถัดไป
        </button>
      </div>
    </nav>
  );
  if (!bills.length) return <section className="bill-list">{empty}</section>;
  return (
    <>
      {controls("ด้านบน")}
      <section className="bill-list" key={`${page}:${pageSize}`}>
        {rows.map(renderBill)}
      </section>
      {controls("ด้านล่าง")}
    </>
  );
}
