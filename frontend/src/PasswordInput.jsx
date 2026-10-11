import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function PasswordInput(props) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="password-input-wrap">
      <input
        {...props}
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <button
        type="button"
        className="password-eye"
        aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
        aria-pressed={visible}
        title={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? (
          <EyeOff size={19} aria-hidden="true" />
        ) : (
          <Eye size={19} aria-hidden="true" />
        )}
      </button>
    </span>
  );
}
