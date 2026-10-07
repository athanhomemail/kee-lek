import test from "node:test";
import assert from "node:assert/strict";
import { numbers, makeItems as makeItemsWithIds } from "./keying.js";
const makeItems = (...args) => makeItemsWithIds(...args).map(({ entryId, ...item }) => item);
test("pasted prices cannot become lottery numbers", () => {
  for (const text of [
    "17.18.19.10.11 50*50บนล่าง",
    "17\n18\n19\n10\n11 50*10",
    "17 18 19 10 11 =50",
    "17.18.19.10.11 =50บน",
  ])
    assert.deepEqual(numbers(text, "2 ตัว"), ["17", "18", "19", "10", "11"]);
});
test("six permutations deduplicate repeating digits", () => {
  assert.equal(numbers("123", "6 กลับ").length, 6);
  assert.equal(numbers("112", "6 กลับ").length, 3);
});
test("rood produces 19 distinct numbers and win permits optional doubles", () => {
  assert.equal(numbers("3", "รูด").length, 19);
  assert.equal(numbers("123", "วิน", true, 2, false).length, 6);
  assert.equal(numbers("123", "วิน", true, 2, true).length, 9);
  assert.throws(() => numbers("112", "วิน"));
});
test("six reverse allows only three top", () => {
  assert.deepEqual(makeItems(["123"], "6 กลับ", 50, 50, 3), [
    { number: "123", type: "3top", amount: 50 },
  ]);
});
test("customer summary groups matching top and bottom amounts", async () => {
  const { summaryGroups } = await import("./keying.js");
  const items = ["32", "23"].flatMap((number) => [
    { number, type: "2top", amount: 100 },
    { number, type: "2bottom", amount: 100 },
  ]);
  assert.deepEqual(summaryGroups(items), [
    { category: "2 ตัว", top: 100, bottom: 100, numbers: ["32", "23"] },
  ]);
});

test("duplicates stay separate in the draft and customer receipt", async () => {
  const { draftRows, summaryModes, updateDraftAmount } = await import("./keying.js");
  const items = [...makeItemsWithIds(numbers("12 12", "2 ตัว"), "2 ตัว", 20, 20, 2), ...makeItemsWithIds(["12"], "2 ตัว", 20, 20, 2)];
  const rows = draftRows(items);
  assert.equal(rows.length, 3);
  assert.equal(new Set(rows.map((row) => row.key)).size, 3);
  assert.deepEqual(summaryModes(items)[0].rows, [{ category: "2 ตัว", top: 20, bottom: 20, numbers: ["12", "12", "12"] }]);
  const changed = updateDraftAmount(items, rows[1].key, "2top", 50);
  assert.deepEqual(draftRows(changed).map((row) => row.amounts["2top"]), [20, 50, 20]);
  const removed = items.filter((_, index) => !rows[1].indices.includes(index));
  assert.equal(draftRows(removed).length, 2);
  assert.equal(items.reduce((sum, item) => sum + item.amount, 0), 120);
});
test("legacy rows pair only consecutive amounts and preserve repeated entries", async () => {
  const { draftRows, updateDraftAmount } = await import("./keying.js");
  const items = makeItems(["12", "12"], "2 ตัว", 20, 20, 2);
  const rows = draftRows(items);
  assert.equal(rows.length, 2);
  assert.deepEqual(draftRows(updateDraftAmount(items, rows[0].key, "2bottom", 40)).map((row) => row.amounts["2bottom"]), [40, 20]);
  assert.equal(draftRows(makeItems(["12", "12"], "2 ตัว", 20, 0, 2)).length, 2);
});

test("auto spacing preserves digit batches, leading zeroes and partial input", async () => {
  const { formatNumberInput } = await import("./keying.js");
  assert.equal(formatNumberInput("0102034", 2), "01 02 03 4");
  assert.equal(formatNumberInput("1234567", 3), "123 456 7");
  assert.equal(formatNumberInput("123", 1), "1 2 3");
  assert.equal(formatNumberInput("12 34\n56", 2), "12 34\n56");
  assert.equal(formatNumberInput("", 2), "");
});
test("running and rood preserve input occurrences", () => {
  assert.deepEqual(numbers("1 2 1", "วิ่ง"), ["1", "2", "1"]);
  assert.deepEqual(numbers("123", "วิ่ง"), ["1", "2", "3"]);
  const output = numbers("1\n2", "รูด");
  assert.equal(output.length, 38);
  assert.ok(output.includes("10") && output.includes("02"));
});
test("win calculator supports larger sets, optional doubles and three tod amounts", () => {
  assert.equal(numbers("1234", "วิน", true, 2).length, 12);
  assert.equal(numbers("1234", "วิน", true, 3).length, 24);
  assert.equal(numbers("1234", "วิน", true, 3, true).length, 28);
  assert.ok(numbers("012", "วิน", false, 3).includes("012"));
  assert.throws(() => numbers("11", "วิน"));
  assert.throws(() => numbers("12", "วิน", false, 3));
  assert.deepEqual(makeItems(["123"], "วิน", 100, 50, 3), [
    { number: "123", type: "3top", amount: 100 },
    { number: "123", type: "3tod", amount: 50 },
  ]);
  assert.deepEqual(numbers("12 34", "2 ตัว", false, 3), ["12", "34"]);
});

test("win without reverse keeps the lower number from every reverse pair", () => {
  assert.deepEqual(numbers("123", "วิน", false, 2), ["12", "13", "23"]);
  assert.deepEqual(numbers("123", "วิน", true, 2), [
    "12",
    "13",
    "21",
    "23",
    "31",
    "32",
  ]);
  assert.deepEqual(numbers("321", "วิน", false, 2).sort(), ["12", "13", "23"]);
  assert.deepEqual(numbers("123", "วิน", false, 3), ["123", "132", "213"]);
  assert.equal(numbers("123", "วิน", true, 3).length, 6);
  assert.deepEqual(numbers("012", "วิน", false, 3), ["012", "021", "102"]);
  assert.equal(numbers("123", "วิน", false, 3, true).length, 6);
  assert.throws(() => numbers("1", "วิน", false, 2));
  for (const digits of [2, 3]) {
    const reduced = numbers("01234", "วิน", false, digits);
    const full = numbers("01234", "วิน", true, digits);
    assert.equal(reduced.length * 2, full.length);
    for (const number of reduced) {
      const reversed = [...number].reverse().join("");
      assert.ok(number < reversed);
      assert.ok(!reduced.includes(reversed));
      assert.ok(full.includes(number) && full.includes(reversed));
    }
  }
});

test("closed number detection handles generated, reversed and multiple batches", async () => {
  const { blockedNumbers } = await import("./keying.js");
  assert.deepEqual(blockedNumbers(numbers("12", "2 ตัว", true), ["21"]), [
    "21",
  ]);
  assert.deepEqual(blockedNumbers(numbers("1 2", "รูด"), ["12", "21"]), [
    "12",
    "21",
  ]);
  assert.deepEqual(blockedNumbers(["12", "12", "34"], ["12"]), ["12"]);
  assert.deepEqual(blockedNumbers(["12"], undefined), []);
});

test("keyboard reversal appends every entry without losing original duplicates or zeroes", async () => {
  const { appendReversedNumbers } = await import("./keying.js");
  assert.equal(appendReversedNumbers("12 21 14", 2), "12 21 14 21 12 41");
  assert.equal(appendReversedNumbers("01 01 11", 2), "01 01 11 10 10 11");
  assert.equal(appendReversedNumbers("123 012", 3), "123 012 321 210");
  assert.equal(appendReversedNumbers("12 3", 2), "12 3 21");
  assert.equal(appendReversedNumbers("", 2), "");
  assert.equal(appendReversedNumbers("1 2", 1), "1 2");
  assert.equal(appendReversedNumbers("12 14 =50", 2), "12 14 =50\n21 41");
  assert.deepEqual(numbers(appendReversedNumbers("12 14 =50", 2), "2 ตัว"), ["12", "14", "21", "41"]);
  assert.deepEqual(numbers(appendReversedNumbers("12 21 14", 2), "2 ตัว"), ["12", "21", "14", "21", "12", "41"]);
});

test("six reverse preserves separate input entries", () => {
  assert.equal(numbers("123 321", "6 กลับ").length, 12);
});

test("removing a duplicate input entry removes only the selected occurrence", async () => {
  const { removeNumberInputEntry, appendReversedNumbers } = await import("./keying.js");
  const text = appendReversedNumbers("12 12", 2);
  for (const index of [0, 1]) {
    const remaining = removeNumberInputEntry(text, 2, index);
    assert.deepEqual(numbers(remaining, "2 ตัว"), ["12", "21", "21"]);
    assert.equal(makeItemsWithIds(numbers(remaining, "2 ตัว"), "2 ตัว", 10, 20, 2).length, 6);
  }
  assert.deepEqual(numbers(removeNumberInputEntry(text, 2, 3), "2 ตัว"), ["12", "12", "21"]);
  assert.equal(removeNumberInputEntry("01 01 2", 2, 1), "01  2");
});

test("input badges and deletion ignore prices and preserve pasted content", async () => {
  const { numberInputEntries, removeNumberInputEntry } = await import("./keying.js");
  const text = "12 12 =50\n21 21 50*50บนล่าง";
  assert.deepEqual(numberInputEntries(text, 2).map((entry) => entry.number), ["12", "12", "21", "21"]);
  const remaining = removeNumberInputEntry(text, 2, 1);
  assert.equal(remaining, "12  =50\n21 21 50*50บนล่าง");
  assert.deepEqual(numbers(remaining, "2 ตัว"), ["12", "21", "21"]);
  assert.equal(removeNumberInputEntry(text, 2, 99), text);
});

test("generated entries are excluded by occurrence rather than number value", async () => {
  const { excludeNumberEntries } = await import("./keying.js");
  assert.deepEqual(excludeNumberEntries(["12", "12", "21", "21"], [1]), ["12", "21", "21"]);
  const generated = numbers("123 123", "6 กลับ");
  const remaining = excludeNumberEntries(generated, [0, 7]);
  assert.equal(remaining.length, 10);
  assert.equal(remaining.filter((number) => number === "123").length, 1);
});

test("completed numbers become badges while only incomplete digits remain editable", async () => {
  const { splitNumberInput } = await import("./keying.js");
  assert.deepEqual(splitNumberInput("1", 2), { completed: [], pending: "1" });
  assert.deepEqual(splitNumberInput("12", 2), { completed: ["12"], pending: "" });
  assert.deepEqual(splitNumberInput("12 12 3", 2), { completed: ["12", "12"], pending: "3" });
  assert.deepEqual(splitNumberInput("0102034", 2), { completed: ["01", "02", "03"], pending: "4" });
  assert.deepEqual(splitNumberInput("1234567", 3), { completed: ["123", "456"], pending: "7" });
  assert.deepEqual(splitNumberInput("12 12 =50\n21 21 50*50บนล่าง", 2), { completed: ["12", "12", "21", "21"], pending: "" });
});

test("inline typing, reversal and deletion preserve duplicate badge entries", async () => {
  const { splitNumberInput, formatNumberInput, appendReversedNumbers, removeNumberInputEntry } = await import("./keying.js");
  let text = "";
  for (const digit of "1212") {
    const { completed, pending } = splitNumberInput(text, 2);
    text = [...completed, formatNumberInput(pending + digit, 2)].join(" ");
  }
  assert.deepEqual(splitNumberInput(text, 2), { completed: ["12", "12"], pending: "" });
  text = appendReversedNumbers(text, 2);
  assert.deepEqual(splitNumberInput(text, 2), { completed: ["12", "12", "21", "21"], pending: "" });
  text = removeNumberInputEntry(text, 2, 1);
  assert.deepEqual(splitNumberInput(text, 2), { completed: ["12", "21", "21"], pending: "" });
});
