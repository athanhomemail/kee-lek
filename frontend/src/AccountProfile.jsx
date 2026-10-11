import React, { useState } from "react";
import { UserRound, Save, KeyRound, Link2, MessageCircle } from "lucide-react";

export default function AccountProfile({ user, api, act, changePassword }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  return (
    <div className="account-profile">
      <section className="panel account-details">
        <div className="account-heading">
          <span className="account-avatar">
            <UserRound size={23} />
          </span>
          <div>
            <span className="report-eyebrow">บัญชีของฉัน</span>
            <h2>{user.name}</h2>
            <p>
              {user.username} <span className="account-role">{user.role}</span>
            </p>
          </div>
        </div>
        <form
          key={`${user.id}:${user.name}:${user.phone || ""}`}
          onChange={() => setSaved(false)}
          onSubmit={async (e) => {
            e.preventDefault();
            if (saving) return;
            const values = Object.fromEntries(new FormData(e.currentTarget));
            setSaving(true);
            setSaved(false);
            try {
              const success = await act(async () => {
                await api.patch("/me", values);
                return true;
              });
              if (success) setSaved(true);
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="account-form-fields">
            <label>
              ชื่อ–สกุล
              <input
                name="name"
                required
                maxLength={150}
                defaultValue={user.name}
                placeholder="กรอกชื่อ–สกุล"
                autoComplete="name"
              />
            </label>
            <label>
              เบอร์โทร
              <input
                name="phone"
                type="tel"
                maxLength={30}
                pattern="[+0-9 \-]{8,20}"
                defaultValue={user.phone || ""}
                placeholder="กรอกเบอร์โทร"
                autoComplete="tel"
              />
              <small>เว้นว่างได้ หากยังไม่ได้ระบุเบอร์โทร</small>
            </label>
          </div>
          <div className="account-form-footer">
            <span className="muted">
              ข้อมูลนี้ใช้แสดงชื่อในระบบและรายการผู้ใช้
            </span>
            <button className="primary" disabled={saving}>
              <Save size={16} />
              {saving ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
            </button>
          </div>
          {saved && (
            <p className="account-save-status" role="status">
              บันทึกข้อมูลแล้ว
            </p>
          )}
        </form>
      </section>
      <div className="account-secondary">
        <section className="panel account-security">
          <span className="account-card-icon">
            <KeyRound size={19} />
          </span>
          <h3>รหัสผ่าน</h3>
          <p className="muted">เปลี่ยนรหัสผ่านที่ใช้เข้าสู่ระบบ</p>
          <button onClick={changePassword}>
            <KeyRound size={15} />
            เปลี่ยนรหัสผ่าน
          </button>
        </section>
        <section className="panel account-line">
          <span className="account-card-icon">
            <MessageCircle size={20} />
          </span>
          <div className="account-line-heading">
            <h3>เชื่อมต่อ LINE OA</h3>
            <span>เร็ว ๆ นี้</span>
          </div>
          <p className="muted">
            รับข่าวสารและการแจ้งเตือนผ่าน LINE เมื่อเปิดให้บริการ
          </p>
          <button disabled aria-label="ผูกบัญชีกับ LINE OA ยังไม่เปิดให้บริการ">
            <Link2 size={15} />
            ผูกบัญชีกับ LINE OA
          </button>
        </section>
      </div>
    </div>
  );
}
