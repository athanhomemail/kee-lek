import React from "react";
import thailand from "./assets/flags/thailand.png";
import laos from "./assets/flags/laos.png";
import vietnam from "./assets/flags/vietnam.png";

const flags = {
  "🇹🇭": { src: thailand, label: "ธงชาติไทย" },
  "🇱🇦": { src: laos, label: "ธงชาติลาว" },
  "🇻🇳": { src: vietnam, label: "ธงชาติเวียดนาม" },
};

export default function LotteryFlag({ flag }) {
  const image = flags[flag];
  return image ? (
    <img className="lottery-flag-image" src={image.src} alt={image.label} />
  ) : (
    <span>{flag}</span>
  );
}
