import React, { useState } from "react";
import { Eye, KeyRound, Copy } from "lucide-react";

function PasswordDetails({ username, password, reset = false }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="new-password-result">
      <p>
        ชื่อผู้ใช้ <strong>{username}</strong>
      </p>
      <label>
        {reset ? "รหัสผ่านใหม่" : "รหัสผ่านปัจจุบัน"}
        <input
          readOnly
          value={password}
          aria-label={reset ? "รหัสผ่านใหม่" : "รหัสผ่านปัจจุบัน"}
        />
      </label>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(password);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        <Copy size={15} />
        {copied ? "คัดลอกแล้ว" : "คัดลอกรหัสผ่าน"}
      </button>
      <p className="muted">
        {reset
          ? "ผู้ใช้ต้องเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งถัดไป"
          : "ดูรหัสเดิมได้โดยไม่ต้องเปลี่ยนรหัสผ่าน"}
      </p>
    </div>
  );
}

export default function UserPasswordAccess({ person, api, act, modal }) {
  const reset = () =>
    modal({
      title: `ตั้งรหัสผ่านใหม่ให้ ${person.name}`,
      content: (
        <p>
          รหัสผ่านเดิมของ {person.username} จะใช้ไม่ได้หลังตั้งใหม่
          ผู้ใช้ต้องเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งถัดไป
        </p>
      ),
      confirm: () =>
        act(async () => {
          const { data } = await api.post(`/users/${person.id}/reset-password`);
          modal({
            title: "รหัสผ่านใหม่",
            content: (
              <PasswordDetails
                username={data.username}
                password={data.password}
                reset
              />
            ),
          });
        }),
    });
  return (
    <button
      className="user-reset-password"
      onClick={() =>
        act(async () => {
          const { data } = await api.get(`/users/${person.id}/password`);
          modal({
            title: `รหัสผ่านของ ${person.name}`,
            content: data.available ? (
              <PasswordDetails
                username={data.username}
                password={data.password}
              />
            ) : (
              <div className="password-unavailable">
                <p>{data.message}</p>
                <p className="muted">
                  ถ้าจำรหัสเดิมไม่ได้และยังไม่มีข้อมูลสำหรับเปิดดู
                  สามารถเลือกตั้งรหัสใหม่ได้
                </p>
                <button onClick={reset}>
                  <KeyRound size={15} />
                  ตั้งรหัสผ่านใหม่
                </button>
              </div>
            ),
          });
        })
      }
    >
      <Eye size={15} />
      ดูรหัสผ่าน
    </button>
  );
}
