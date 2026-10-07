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
    const batch = (text.match(/\d+/g) || []).filter((n) => n.length === 3);
    if (!batch.length) throw Error("กรอกเลข 3 หลัก");
    return batch.flatMap(permutations);
  }
  if (mode === "รูด" || mode === "วิ่ง") {
    const selected = text.match(/\d/g) || [];
    if (!selected.length) throw Error("ไม่พบตัวเลข");
    if (mode === "วิ่ง") return selected;
    return selected.flatMap((digit) => [
      ...new Set(Array.from({ length: 10 }, (_, i) => [digit + i, i + digit]).flat()),
    ]);
  }
  // Ignore pasted prices; the amounts below always apply to the whole batch.
  const stripped = text.replace(
    /(?:=\s*\d+(?:\s*[*x×]\s*\d+)*|\d+\s*[*x×]\s*\d+(?:\s*[*x×]\s*\d+)*|\d+\s*(?:บน|ล่าง|โต๊ด|บาท)).*$/gm,
    "",
  );
  const out = (stripped.match(/\d+/g) || []).filter((n) => n.length === size);
  if (!out.length) throw Error("ไม่พบเลข " + size + " หลัก");
  return reverse
    ? out.flatMap((n) => [n, [...n].reverse().join("")])
    : out;
}
export function makeItems(nums, mode, top, bottom, digits) {
  const size =
    mode === "3 ตัว" || mode === "6 กลับ" || (mode === "วิน" && digits === 3)
      ? 3
      : 2;
  const first = mode === "วิ่ง" ? "runTop" : size === 3 ? "3top" : "2top";
  const second =
    mode === "วิ่ง" ? "runBottom" : size === 3 ? "3tod" : "2bottom";
  return nums.flatMap((number) => {
    const entryId = crypto.randomUUID();
    return [
      { entryId, number, type: first, amount: Number(top) },
      { entryId, number, type: second, amount: Number(bottom) },
    ].filter((i) => i.amount > 0 && (mode !== "6 กลับ" || i.type === first));
  });
}
export function summaryGroups(items) {
  const entries = draftRows(items).map((row) => ({
    category: row.category,
    number: row.number,
    top: row.amounts[row.types[0]] || 0,
    bottom: row.amounts[row.types[1]] || 0,
  }));
  const groups = {};
  for (const row of entries) {
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
  const rows = [];
  const identified = new Map();
  items.forEach((item, index) => {
    const category = item.type.startsWith("3") ? "3 ตัว" : item.type.startsWith("run") ? "วิ่ง" : "2 ตัว";
    const types = category === "3 ตัว" ? ["3top", "3tod"] : category === "วิ่ง" ? ["runTop", "runBottom"] : ["2top", "2bottom"];
    // Older bills have no entry ID: pair only consecutive top/bottom entries.
    let row = item.entryId ? identified.get(item.entryId) : rows.at(-1);
    if (!item.entryId && !(row && !row.entryId && row.number === item.number && row.category === category && row.indices.at(-1) === index - 1 && item.type === types[1] && row.amounts[types[0]] !== undefined && row.amounts[types[1]] === undefined)) row = null;
    if (!row) {
      row = { key: item.entryId || "legacy:" + index, entryId: item.entryId, category, number: item.number, types, amounts: {}, indices: [] };
      rows.push(row);
      if (item.entryId) identified.set(item.entryId, row);
    }
    row.amounts[item.type] = Number(item.amount);
    row.indices.push(index);
  });
  return rows;
}
export function updateDraftAmount(items, key, type, amount) {
  const row = draftRows(items).find((row) => row.key === key);
  if (!row) return items;
  const entryId = row.entryId || crypto.randomUUID();
  const next = items.flatMap((item, index) => {
    if (!row.indices.includes(index)) return [item];
    if (item.type === type) return Number(amount) > 0 ? [{ ...item, entryId, amount: Number(amount) }] : [];
    return [{ ...item, entryId }];
  });
  if (Number(amount) > 0 && row.amounts[type] === undefined)
    next.splice(row.indices[0], 0, { entryId, number: row.number, type, amount: Number(amount) });
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

// Keep each original entry, including duplicates.
export function appendReversedNumbers(text, size) {
  const stripped = text.replace(
    /(?:=\s*\d+(?:\s*[*x×]\s*\d+)*|\d+\s*[*x×]\s*\d+(?:\s*[*x×]\s*\d+)*|\d+\s*(?:บน|ล่าง|โต๊ด|บาท)).*$/gm,
    "",
  );
  const batch = (stripped.match(/\d+/g) || []).filter((n) => n.length === size);
  if (size < 2 || !batch.length) return text;
  return text + (stripped !== text ? "\n" : /\s$/.test(text) ? "" : " ") + batch.map((n) => [...n].reverse().join("")).join(" ");
}
