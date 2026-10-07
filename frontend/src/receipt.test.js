import test from "node:test";
import assert from "node:assert/strict";
import { laoReceiptDate } from "./receipt.js";

test("receipt dates always use Lao month names for all twelve months", () => {
  const months = [
    "ມັງກອນ",
    "ກຸມພາ",
    "ມີນາ",
    "ເມສາ",
    "ພຶດສະພາ",
    "ມິຖຸນາ",
    "ກໍລະກົດ",
    "ສິງຫາ",
    "ກັນຍາ",
    "ຕຸລາ",
    "ພະຈິກ",
    "ທັນວາ",
  ];
  months.forEach((month, index) => {
    assert.equal(
      laoReceiptDate(`2026-${String(index + 1).padStart(2, "0")}-07`),
      `7 ${month} 2026`,
    );
  });
});

test("receipt timestamp uses Bangkok date across midnight and year boundary", () => {
  assert.equal(
    laoReceiptDate(new Date("2026-12-31T18:00:00Z")),
    "1 ມັງກອນ 2027",
  );
});
