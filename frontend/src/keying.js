export const labels = {
  "2top": "2 ตัวบน",
  "2bottom": "2 ตัวล่าง",
  "3top": "3 ตัวบน",
  "3tod": "3 ตัวโต๊ด",
  runTop: "วิ่งบน",
  runBottom: "วิ่งล่าง",
};
export function permutations(s) {
  if (s.length === 1) return [s];
  return [
    ...new Set(
      [...s].flatMap((c, i) =>
        permutations(s.slice(0, i) + s.slice(i + 1)).map((p) => c + p),
      ),
    ),
  ];
}
export function numbers(
  text,
  mode,
  reverse = false,
  digits = 2,
  doubles = false,
) {
  const size =
    mode === "3 ตัว" || mode === "6 กลับ"
      ? 3
      : mode === "รูด" || mode === "วิ่ง"
        ? 1
        : 2;
  if (mode === "วิน") {
    if (
      !/^\d{2,10}$/.test(text) ||
      new Set(text).size !== text.length ||
      (digits === 3 && text.length < 3)
    )
      throw Error("วินต้องเลือกเลขไม่ซ้ำอย่างน้อย " + digits + " ตัว");
    const chars = [...text],
      out = [];
    for (const a of chars)
      for (const b of chars)
        if (a !== b) {
          if (digits === 2) out.push(a + b);
          else
            for (const c of chars) if (c !== a && c !== b) out.push(a + b + c);
        }
    if (doubles) for (const a of chars) out.push(a.repeat(digits));
    return [...new Set(out)].filter(
      (number) => reverse || number <= [...number].reverse().join(""),
    );
  }
  if (mode === "6 กลับ") {
    if (!/^\d{3}$/.test(text)) throw Error("กรอกเลข 3 หลัก");
    return permutations(text);
  }
  if (mode === "รูด" || mode === "วิ่ง") {
    const selected = [...new Set(text.match(/\d/g) || [])];
    if (!selected.length) throw Error("ไม่พบตัวเลข");
    if (mode === "วิ่ง") return selected;
    return [
      ...new Set(
        selected.flatMap((digit) =>
          Array.from({ length: 10 }, (_, i) => [digit + i, i + digit]).flat(),
        ),
      ),
    ];
  }
  // Ignore pasted prices; the amounts below always apply to the whole batch.
  const stripped = text.replace(
    /(?:=\s*\d+(?:\s*[*x×]\s*\d+)*|\d+\s*[*x×]\s*\d+(?:\s*[*x×]\s*\d+)*|\d+\s*(?:บน|ล่าง|โต๊ด|บาท)).*$/gm,
    "",
  );
  const out = (stripped.match(/\d+/g) || []).filter((n) => n.length === size);
  if (!out.length) throw Error("ไม่พบเลข " + size + " หลัก");
  return [
    ...new Set(
      reverse && out.length === 1
        ? out.flatMap((n) => [n, [...n].reverse().join("")])
        : out,
    ),
  ];
}
export function makeItems(nums, mode, top, bottom, digits) {
  const size =
    mode === "3 ตัว" || mode === "6 กลับ" || (mode === "วิน" && digits === 3)
      ? 3
      : 2;
  const first = mode === "วิ่ง" ? "runTop" : size === 3 ? "3top" : "2top";
  const second =
    mode === "วิ่ง" ? "runBottom" : size === 3 ? "3tod" : "2bottom";
  return nums.flatMap((number) =>
    [
      { number, type: first, amount: Number(top) },
      { number, type: second, amount: Number(bottom) },
    ].filter((i) => i.amount > 0 && (mode !== "6 กลับ" || i.type === first)),
  );
}
export function summaryGroups(items) {
  const byNumber = {};
  for (const i of items) {
    const category = i.type.startsWith("3")
        ? "3 ตัว"
        : i.type.startsWith("run")
          ? "วิ่ง"
          : "2 ตัว",
      key = category + ":" + i.number;
    const row = (byNumber[key] ??= {
      category,
      number: i.number,
      top: 0,
      bottom: 0,
    });
    if (
      i.type.endsWith("bottom") ||
      i.type === "3tod" ||
      i.type === "runBottom"
    )
      row.bottom += i.amount;
    else row.top += i.amount;
  }
  const groups = {};
  for (const row of Object.values(byNumber)) {
    const key = row.category + ":" + row.top + ":" + row.bottom;
    const g = (groups[key] ??= {
      category: row.category,
      top: row.top,
      bottom: row.bottom,
      numbers: [],
    });
    g.numbers.push(row.number);
  }
  return Object.values(groups);
}

export function summaryModes(items) {
  const modes = new Map();
  for (const row of summaryGroups(items)) {
    if (!modes.has(row.category))
      modes.set(row.category, { category: row.category, rows: [] });
    modes.get(row.category).rows.push(row);
  }
  return [...modes.values()];
}

export function draftRows(items) {
  const rows = new Map();
  for (const item of items) {
    const category = item.type.startsWith("3")
      ? "3 ตัว"
      : item.type.startsWith("run")
        ? "วิ่ง"
        : "2 ตัว";
    const key = category + ":" + item.number;
    if (!rows.has(key))
      rows.set(key, {
        key,
        category,
        number: item.number,
        types:
          category === "3 ตัว"
            ? ["3top", "3tod"]
            : category === "วิ่ง"
              ? ["runTop", "runBottom"]
              : ["2top", "2bottom"],
        amounts: {},
      });
    const row = rows.get(key);
    row.amounts[item.type] =
      (row.amounts[item.type] || 0) + Number(item.amount);
  }
  return [...rows.values()];
}
export function updateDraftAmount(items, number, type, amount) {
  const next = [];
  let inserted = false;
  for (const item of items) {
    if (item.number === number && item.type === type) {
      if (!inserted && Number(amount) > 0)
        next.push({ number, type, amount: Number(amount) });
      inserted = true;
    } else next.push(item);
  }
  if (!inserted && Number(amount) > 0)
    next.push({ number, type, amount: Number(amount) });
  return next;
}

export function formatNumberInput(text, size) {
  return text.replace(/\d+/g, (run) =>
    run.match(new RegExp(".{1," + size + "}", "g")).join(" "),
  );
}

export function blockedNumbers(nums, blocked = []) {
  return [...new Set(nums)].filter((number) => blocked?.includes(number));
}
