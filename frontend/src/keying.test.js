import test from "node:test";
import assert from "node:assert/strict";
import { numbers, makeItems } from "./keying.js";
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

test("summary keeps different prices inside one category and preserves summed amounts", async () => {
  const { summaryModes } = await import("./keying.js");
  const groups = summaryModes([
    { number: "10", type: "2top", amount: 100 },
    { number: "43", type: "2top", amount: 60 },
    { number: "43", type: "2top", amount: 40 },
    { number: "43", type: "2bottom", amount: 50 },
    { number: "34", type: "2top", amount: 100 },
    { number: "34", type: "2bottom", amount: 50 },
    { number: "123", type: "3top", amount: 20 },
  ]);
  assert.deepEqual(groups[0], {
    category: "2 ตัว",
    rows: [
      { category: "2 ตัว", top: 100, bottom: 0, numbers: ["10"] },
      { category: "2 ตัว", top: 100, bottom: 50, numbers: ["43", "34"] },
    ],
  });
  assert.equal(groups.length, 2);
  assert.equal(groups[1].category, "3 ตัว");
});

test("draft combines paired amounts, isolates categories and updates duplicates once", async () => {
  const { draftRows, updateDraftAmount } = await import("./keying.js");
  const items = [
    { number: "10", type: "2top", amount: 100 },
    { number: "10", type: "2bottom", amount: 50 },
    { number: "10", type: "2top", amount: 20 },
    { number: "123", type: "3tod", amount: 30 },
  ];
  assert.equal(draftRows(items).length, 2);
  assert.deepEqual(draftRows(items)[0].amounts, { "2top": 120, "2bottom": 50 });
  const edited = updateDraftAmount(items, "10", "2top", 80);
  assert.equal(edited.filter((i) => i.type === "2top").length, 1);
  assert.equal(draftRows(edited)[0].amounts["2top"], 80);
  assert.equal(
    updateDraftAmount(edited, "10", "2bottom", 0).some(
      (i) => i.type === "2bottom",
    ),
    false,
  );
  assert.equal(
    draftRows(updateDraftAmount(items, "123", "3top", 40))[1].amounts["3top"],
    40,
  );
  assert.equal(
    items.filter(
      (i) => !(i.number === "10" && draftRows(items)[0].types.includes(i.type)),
    ).length,
    1,
  );
});

test("auto spacing preserves digit batches, leading zeroes and partial input", async () => {
  const { formatNumberInput } = await import("./keying.js");
  assert.equal(formatNumberInput("0102034", 2), "01 02 03 4");
  assert.equal(formatNumberInput("1234567", 3), "123 456 7");
  assert.equal(formatNumberInput("123", 1), "1 2 3");
  assert.equal(formatNumberInput("12 34\n56", 2), "12 34\n56");
  assert.equal(formatNumberInput("", 2), "");
});
test("running and rood accept multiple pasted or typed digits and deduplicate", () => {
  assert.deepEqual(numbers("1 2 1", "วิ่ง"), ["1", "2"]);
  assert.deepEqual(numbers("123", "วิ่ง"), ["1", "2", "3"]);
  const output = numbers("1\n2", "รูด");
  assert.equal(output.length, 36);
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
