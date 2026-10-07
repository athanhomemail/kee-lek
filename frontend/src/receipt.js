const laoMonths = [
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

export function laoReceiptDate(value) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    calendar: "gregory",
    numberingSystem: "latn",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(new Date(value));
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${Number(get("day"))} ${laoMonths[Number(get("month")) - 1]} ${get("year")}`;
}
