import React, { useEffect, useState } from "react";
const tables = {
  users: "บัญชี Leader / Member",
  lotteries: "ประเภทหวย",
  draws: "งวดและผลรางวัล",
  settings: "อัตราจ่าย / วงเงิน",
  draw_settings: "เวลาปิดรับ / เลขปิดรับ / จ่ายครึ่ง",
  bills: "โพย",
  credit_requests: "คำขอเดิม (ข้อมูลเก่า)",
  credit_ledger: "ประวัติเดิม (ข้อมูลเก่า)",
  notifications: "การแจ้งเตือน",
};
const modes = [
  {
    id: "notifications",
    title: "ล้างการแจ้งเตือน",
    phrase: "ล้างการแจ้งเตือน",
    tables: ["notifications"],
    detail: "ลบข้อความแจ้งเตือนอย่างเดียว บัญชีและโพยยังอยู่",
  },
  {
    id: "bills",
    title: "ล้างโพยทั้งหมด",
    phrase: "ล้างโพยทั้งหมด",
    tables: ["bills"],
    detail:
      "ลบโพยทุกงวด รวมโพยที่ยกเลิก งวดและผลหวยยังอยู่",
  },
  {
    id: "transactions",
    title: "เริ่มยอดธุรกรรมใหม่",
    phrase: "เริ่มยอดธุรกรรมใหม่",
    tables: ["bills", "credit_requests", "credit_ledger", "notifications"],
    detail:
      "ลบโพย คำขอเดิม (ข้อมูลเก่า) ประวัติเดิม (ข้อมูลเก่า) และการแจ้งเตือน เก็บบัญชี งวด ผลหวย และกฎไว้",
  },
  {
    id: "launch",
    title: "ล้างงวดและธุรกรรมก่อนขึ้น VPS",
    phrase: "ล้างข้อมูลก่อนขึ้น VPS",
    tables: [
      "bills",
      "draw_settings",
      "draws",
      "credit_requests",
      "credit_ledger",
      "notifications",
    ],
    detail:
      "ลบงวด ผลหวย กฎรายงวด และธุรกรรมทั้งหมด เก็บบัญชี ประเภทหวย และอัตราจ่ายไว้",
  },
  {
    id: "fresh",
    title: "เริ่มระบบใหม่ทั้งหมด",
    phrase: "เริ่มระบบใหม่ทั้งหมด",
    tables: [
      "bills",
      "draw_settings",
      "draws",
      "credit_requests",
      "credit_ledger",
      "notifications",
      "settings",
      "users",
    ],
    detail:
      "ลบ Leader และ Member ทุกคนพร้อมข้อมูลที่เกี่ยวข้อง เก็บเฉพาะบัญชี Admin และประเภทหวย เหมาะเมื่อบัญชีที่มีอยู่ทั้งหมดเป็นบัญชีทดสอบ",
  },
];
export default function MaintenancePanel({ api, act }) {
  const [counts, setCounts] = useState(null),
    [error, setError] = useState(""),
    [mode, setMode] = useState("launch"),
    [review, setReview] = useState(false),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [backupConfirmed, setBackupConfirmed] = useState(false),
    [working, setWorking] = useState(false),
    [done, setDone] = useState("");
  const plan = modes.find((entry) => entry.id === mode);
  const load = async () => {
    try {
      const { data } = await api.get("/maintenance");
      setCounts(data.counts);
      setError("");
    } catch {
      setError("โหลดจำนวนข้อมูลไม่สำเร็จ กรุณาลองใหม่");
    }
  };
  useEffect(() => {
    load();
  }, []);
  const backup = async () => {
    setWorking(true);
    try {
      const { data } = await api.get("/maintenance/backup");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download =
        "keelek-backup-" +
        new Date().toISOString().replace(/[:.]/g, "-") +
        ".json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setError("สำรองข้อมูลไม่สำเร็จ กรุณาลองใหม่ก่อนล้างข้อมูล");
    } finally {
      setWorking(false);
    }
  };
  return (
    <section className="panel maintenance-panel">
      <div className="section-head">
        <div>
          <h2>ล้างข้อมูลและเตรียมระบบ</h2>
          <p className="muted">
            เลือกชุดข้อมูล ดูผลกระทบ แล้วค่อยยืนยันการล้าง
          </p>
        </div>
        <button disabled={working} onClick={backup}>
          ดาวน์โหลดสำรองข้อมูล
        </button>
      </div>
      <p className="maintenance-note">
        ไฟล์สำรองมีข้อมูลบัญชีและประวัติระบบ ควรเก็บไว้ในที่ปลอดภัย
        การล้างข้อมูลย้อนกลับจากหน้าเว็บไม่ได้ ไฟล์ JSON
        นี้ใช้สำหรับกู้คืนผ่านผู้ดูแลฐานข้อมูล
      </p>
      {error && (
        <p role="alert" className="danger">
          {error} <button onClick={load}>ลองใหม่</button>
        </p>
      )}
      {done && (
        <p role="status" className="maintenance-success">
          {done}
        </p>
      )}
      {counts && (
        <details className="data-inventory">
          <summary>
            ข้อมูลที่มีอยู่ในระบบ · {Object.keys(tables).length} หมวด
          </summary>
          <div className="inventory-grid">
            {Object.entries(tables).map(([key, title]) => (
              <div key={key}>
                <span>{title}</span>
                <b>{counts[key].toLocaleString()} รายการ</b>
                <small>{key}</small>
              </div>
            ))}
          </div>
        </details>
      )}
      <div className="cleanup-options">
        {modes.map((entry) => (
          <button
            key={entry.id}
            className={mode === entry.id ? "selected" : ""}
            onClick={() => {
              setMode(entry.id);
              setReview(false);
              setConfirmation("");
              setPassword("");
              setBackupConfirmed(false);
              setDone("");
            }}
          >
            <strong>{entry.title}</strong>
            <span>{entry.detail}</span>
          </button>
        ))}
      </div>
      <div className="cleanup-impact">
        <h3>{plan.title}</h3>
        <p>{plan.detail}</p>
        <p>
          ข้อมูลที่จะลบ:{" "}
          {plan.tables
            .map(
              (key) => tables[key] + (counts ? " (" + counts[key] + ")" : ""),
            )
            .join(" · ")}
        </p>
        <p>บัญชี Admin และประเภทหวยยังอยู่ทุกตัวเลือก</p>
      </div>
      {!review ? (
        <button
          className="cleanup-button"
          disabled={!counts || working}
          onClick={() => setReview(true)}
        >
          ตรวจสอบและยืนยันการล้าง
        </button>
      ) : (
        <form
          className="cleanup-confirm"
          onSubmit={async (event) => {
            event.preventDefault();
            setWorking(true);
            try {
              const result = await act(() =>
                api.post("/maintenance/clear", {
                  mode,
                  password,
                  confirmation,
                  backupConfirmed,
                }),
              );
              if (result) {
                setDone("ล้างข้อมูลเรียบร้อยแล้ว");
                setPassword("");
                setConfirmation("");
                setBackupConfirmed(false);
                setReview(false);
                await load();
              }
            } finally {
              setWorking(false);
            }
          }}
        >
          <h3>ยืนยันก่อนลบข้อมูลจริง</h3>
          <label className="check">
            <input
              type="checkbox"
              checked={backupConfirmed}
              onChange={(event) => setBackupConfirmed(event.target.checked)}
              required
            />{" "}
            ฉันสำรองข้อมูลไว้แล้วและยอมรับผลกระทบข้างต้น
          </label>
          <label>
            พิมพ์ “{plan.phrase}”
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              required
            />
          </label>
          <label>
            รหัสผ่าน Admin ปัจจุบัน
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <div className="cleanup-actions">
            <button
              type="button"
              onClick={() => {
                setReview(false);
                setPassword("");
              }}
            >
              ยกเลิก
            </button>
            <button
              className="cleanup-button"
              disabled={
                working ||
                !backupConfirmed ||
                confirmation !== plan.phrase ||
                !password
              }
            >
              {working ? "กำลังล้างข้อมูล…" : "ยืนยันล้างข้อมูลถาวร"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
