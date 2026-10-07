import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import html2canvas from "html2canvas";
import MaintenancePanel from "./MaintenancePanel.jsx";
import LotteryFlag from "./LotteryFlag.jsx";
import {
  Sparkles,
  LayoutDashboard,
  Settings,
  Receipt,
  Keyboard,
  User,
  LogOut,
  Bell,
  ArrowRight,
  Plus,
  Wallet,
  Check,
  X,
  Copy,
  Trash2,
} from "lucide-react";
import {
  numbers,
  makeItems,
  labels,
  summaryModes,
  draftRows,
  updateDraftAmount,
  formatNumberInput,
  blockedNumbers,
  appendReversedNumbers,
  removeNumberInputEntry,
  excludeNumberEntries,
  splitNumberInput,
} from "./keying";
import { accessTime } from "./access.js";
import { nextDraws, resultDraws, homePage } from "./draws";
const api = axios.create({ baseURL: "/api" }),
  money = (n) =>
    Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 }),
  date = (d) => new Date(d).toLocaleDateString("th-TH");
const menus = {
  Admin: ["ผล", "ตั้งค่า", "สถิติ"],
  Leader: ["ผล", "โพย", "ตั้งค่า", "สถิติ", "บัญชี"],
  Member: ["ผล", "โพย", "คีย์", "สถิติ", "บัญชี"],
};
const icons = {
  ผล: Sparkles,
  โพย: Receipt,
  ตั้งค่า: Settings,
  คีย์: Keyboard,
  สถิติ: LayoutDashboard,
  บัญชี: User,
};
function Form({ fields, onSubmit, submit = "บันทึก", className }) {
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(Object.fromEntries(new FormData(e.target)));
      }}
    >
      {fields.map((f) => (
        <label key={f.name}>
          {f.label}
          <input
            required={f.required !== false}
            name={f.name}
            type={f.type || "text"}
            defaultValue={f.value}
            step={f.type === "number" ? "0.01" : undefined}
          />
        </label>
      ))}
      <button className="primary">{submit}</button>
    </form>
  );
}
export default function App() {
  const [token, setToken] = useState(sessionStorage.getItem("token") || ""),
    [state, setState] = useState(null),
    [page, setPage] = useState("ผล"),
    [modal, setModal] = useState(null),
    [busy, setBusy] = useState(false),
    [drawId, setDrawId] = useState(""),
    [mode, setMode] = useState("2 ตัว"),
    [text, setText] = useState(""),
    [top, setTop] = useState(""),
    [bottom, setBottom] = useState(""),
    [reverse, setReverse] = useState(false),
    [digits, setDigits] = useState(2),
    [doubles, setDoubles] = useState(false),
    [winDigits, setWinDigits] = useState(""),
    [items, setItems] = useState([]),
    [note, setNote] = useState(""),
    [filter, setFilter] = useState(""),
    [memberFilter, setMemberFilter] = useState(""),
    [tick, setTick] = useState(Date.now()),
    [editId, setEditId] = useState(null),
    [pasted, setPasted] = useState(false),
    [kindFilter, setKindFilter] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const receipt = useRef();
  const [receiptTime, setReceiptTime] = useState(new Date());
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [billStatus, setBillStatus] = useState("");
  const submittingBill = useRef(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 3000);
    return () => clearTimeout(timer);
  }, [copied]);
  const [excludedNumbers, setExcludedNumbers] = useState([]);
  useEffect(() => {
    setExcludedNumbers([]);
  }, [text, mode, digits, reverse, doubles, drawId]);
  const numberInput = useRef();
  const reverseBatch = useRef(null);
  useEffect(() => {
    reverseBatch.current = null;
  }, [mode, digits, drawId]);
  useEffect(() => {
    if (reverseBatch.current?.expanded !== text) reverseBatch.current = null;
  }, [text]);
  useEffect(() => {
    let tabFocus = false;
    const keydown = (event) => {
      tabFocus = event.key === "Tab";
    };
    const pointerdown = () => {
      tabFocus = false;
    };
    const focusin = (event) => {
      if (
        tabFocus &&
        event.target.matches("input, textarea") &&
        typeof event.target.select === "function"
      ) {
        event.target.select();
      }
      tabFocus = false;
    };
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("pointerdown", pointerdown, true);
    document.addEventListener("focusin", focusin);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("pointerdown", pointerdown, true);
      document.removeEventListener("focusin", focusin);
    };
  }, []);
  api.defaults.headers.common.Authorization = token ? "Bearer " + token : "";
  const load = async () => {
    const { data } = await api.get("/state");
    setState(data);
  };
  const message = (t) => setModal({ title: t });
  const act = async (fn) => {
    setBusy(true);
    try {
      const result = await fn();
      if (token && !state?.user?.must_change) await load();
      return result;
    } catch (e) {
      message(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!token) return;
    api
      .get("/me")
      .then(({ data }) => {
        setState({ user: data });
        setPage(homePage(data.role));
        if (!data.must_change)
          load().catch((e) =>
            message(e.response?.data?.error || "เชื่อมต่อไม่ได้"),
          );
      })
      .catch(() => {
        setToken("");
        sessionStorage.removeItem("token");
      });
    const s = io({ auth: { token }, path: "/socket.io", autoConnect: false });
    s.io.uri = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    s.connect();
    s.on("refresh", () => load().catch(() => {}));
    s.on("connect", () => load().catch(() => {}));
    s.on("expired", logout);
    return () => s.disconnect();
  }, [token]);
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const upcoming = state?.draws
      ?.map((d) => new Date(d.result_at).getTime() - Date.now())
      .filter((ms) => ms > 0);
    if (!upcoming?.length) return;
    const timer = setTimeout(
      () => load().catch(() => {}),
      Math.min(2147483647, Math.min(...upcoming) + 1000),
    );
    return () => clearTimeout(timer);
  }, [state?.draws]);
  const logout = () => {
    setPage("ผล");
    setFilter("");
    setMemberFilter("");
    setItems([]);
    setDrawId("");
    setEditId(null);
    sessionStorage.removeItem("token");
    setToken("");
    setState(null);
  };
  const u = state?.user,
    draw = state?.draws?.find((d) => String(d.id) === String(drawId)),
    base = state?.settings?.find(
      (s) => s.lottery_id === draw?.lottery_id,
    )?.config,
    config = base
      ? {
          ...base,
          ...state?.drawSettings?.find((s) => s.draw_id === draw?.id)?.config,
        }
      : null;
  const countdown = (d) => {
    const c = state.drawSettings?.find((s) => s.draw_id === d.id)?.config;
    const remaining =
      Math.min(new Date(c?.closeAt || d.result_at), new Date(d.result_at)) -
      tick;
    if (!c) return "รอหัวหน้าตั้งเวลาปิดรับ";
    if (remaining <= 0) return "ปิดรับแล้ว";
    const seconds = Math.floor(remaining / 1000);
    return (
      (seconds >= 86400 ? Math.floor(seconds / 86400) + " วัน " : "") +
      String(Math.floor(seconds / 3600) % 24).padStart(2, "0") +
      ":" +
      String(Math.floor(seconds / 60) % 60).padStart(2, "0") +
      ":" +
      String(seconds % 60).padStart(2, "0")
    );
  };
  const matches = (d) =>
    d &&
    (!kindFilter || d.kind === kindFilter) &&
    (!from || String(d.draw_date).slice(0, 10) >= from) &&
    (!to || String(d.draw_date).slice(0, 10) <= to);
  const scopedBills = (state?.bills || []).filter(
    (b) =>
      matches(state?.draws?.find((d) => d.id === b.draw_id)) &&
      (!memberFilter || String(b.member_id) === memberFilter),
  );
  const filters = (
    <div className="toolbar">
      <select
        aria-label="ชนิดหวย"
        value={kindFilter}
        onChange={(e) => setKindFilter(e.target.value)}
      >
        <option value="">ทุกชนิดหวย</option>
        <option>หวยไทย</option>
        <option>หวยนอก</option>
      </select>
      {page === "ผล" && (
        <>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">หวยทุกประเภท</option>
            {(state?.lotteries || []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <span className="muted">ผลย้อนหลัง · เรียงตามงวดล่าสุด</span>
        </>
      )}
      {page === "โพย" && (
        <>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">ทุกงวด</option>
            {resultDraws(state?.draws || [], tick).map((d) => (
              <option value={"d" + d.id} key={d.id}>
                {d.name} {date(d.draw_date)}
              </option>
            ))}
          </select>
          {u?.role === "Leader" && (
            <select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
            >
              <option value="">สมาชิกทั้งหมด</option>
              {(state?.users || []).map((m) => (
                <option value={m.id} key={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
        </>
      )}
      <label>
        ตั้งแต่
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </label>
      <label>
        ถึง
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </label>
    </div>
  );
  const total = items.reduce((s, i) => s + i.amount, 0),
    net = items.reduce(
      (s, i) =>
        s +
        Math.round(
          i.amount *
            (1 -
              Number(config?.discounts?.[i.type] ?? config?.discount ?? 0) /
                100) *
            100,
        ) /
          100,
      0,
    );
  const available = (i) =>
    Number(config?.limits?.[i.type] ?? config?.limit ?? 0) -
    (state.usage || [])
      .filter((b) => b.draw_id === draw?.id)
      .flatMap((b) => b.items)
      .filter((x) => x.type === i.type && x.number === i.number)
      .reduce((s, x) => s + x.amount, 0) +
    (editId
      ? (state.bills.find((b) => b.id === editId)?.items || [])
          .filter((x) => x.number === i.number && x.type === i.type)
          .reduce((s, x) => s + x.amount, 0)
      : 0);
  const inputMode = mode === "วิน" ? (digits === 3 ? "3 ตัว" : "2 ตัว") : mode;
  const inputSize =
    inputMode === "3 ตัว" || inputMode === "6 กลับ"
      ? 3
      : ["รูด", "วิ่ง"].includes(inputMode)
        ? 1
        : 2;
  const inputTokens = splitNumberInput(text, inputSize);
  let preview = [];
  try {
    if (text) {
      const previewNumbers = numbers(
        text,
        inputMode,
        mode === "วิน" ? false : reverse,
        digits,
        doubles,
      );
      preview = makeItems(previewNumbers, mode, 1, 1, digits);
    }
  } catch {}
  const previewEntries = draftRows(preview).map((row, index) => ({ ...row, inputIndex: index }))
    .filter((row) => !excludedNumbers.includes(row.inputIndex));
  const previewIds = new Set(previewEntries.map((row) => row.entryId));
  preview = preview.filter((item) => previewIds.has(item.entryId));
  const removeInputEntry = (index) => {
    setExcludedNumbers([]);
    setText((current) => removeNumberInputEntry(current, inputSize, index));
  };
  const removePreviewEntry = (index) => {
    if (["รูด", "6 กลับ"].includes(inputMode) || reverse) {
      setExcludedNumbers((current) => [...current, index]);
    } else {
      removeInputEntry(index);
    }
  };
  const previewRemaining = (number, type) =>
    available({ number, type }) -
    items
      .filter((i) => i.number === number && i.type === type)
      .reduce((sum, i) => sum + Number(i.amount), 0) -
    Number(
      type === "2bottom" || type === "3tod" || type === "runBottom"
        ? bottom
        : top,
    );
  const add = () => {
    try {
      const nums = numbers(
          text,
          inputMode,
          mode === "วิน" ? false : reverse,
          digits,
          doubles,
        ),
        added = makeItems(
          excludeNumberEntries(nums, excludedNumbers),
          mode,
          top,
          bottom,
          digits,
        );
      const closed = blockedNumbers(
        excludeNumberEntries(nums, excludedNumbers),
        config?.blocked,
      );
      if (closed.length)
        throw Error(
          "เลขปิดรับ: " +
            closed.join(", ") +
            " กรุณานำเลขเหล่านี้ออกก่อนเพิ่มลงโพย",
        );
      if (!added.length) throw Error("กรอกยอดซื้ออย่างน้อยหนึ่งช่อง");
      setItems([...items, ...added]);
      setText("");
      setPasted(false);
      setTop("");
      setBottom("");
      numberInput.current?.focus();
    } catch (e) {
      message(e.message);
    }
  };
  const addOnEnter = (event) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!event.repeat) add();
  };
  const editBill = (b) => {
    setDrawId(String(b.draw_id));
    setItems(
      b.items.map(({ entryId, number, type, amount }) => ({ entryId, number, type, amount })),
    );
    setNote(b.note || "");
    setEditId(b.id);
    setPage("คีย์");
  };
  const copyImage = async () => {
    setCopied(false);
    setCopying(true);
    setReceiptTime(new Date());
    try {
      const png = (async () => {
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
        const canvas = await html2canvas(receipt.current, {
          backgroundColor: "#fff",
          scale: 2,
        });
        const blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
        if (!blob) throw Error("สร้างรูปภาพไม่สำเร็จ");
        return blob;
      })();
      png.catch(() => {});
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": png }),
      ]);
      setCopied(true);
    } catch {
      message(
        "คัดลอกรูปภาพไม่สำเร็จ กรุณาลองใหม่หรือใช้เบราว์เซอร์ที่รองรับการคัดลอกรูปภาพ",
      );
    } finally {
      setCopying(false);
    }
  };
  const password = () =>
    setModal({
      title: "เปลี่ยนรหัสผ่าน",
      content: (
        <Form
          fields={[
            { name: "current", label: "รหัสผ่านเดิม", type: "password" },
            {
              name: "password",
              label: "รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)",
              type: "password",
            },
          ]}
          onSubmit={(v) =>
            act(async () => {
              await api.post("/password", v);
              await load();
              setModal(null);
            })
          }
        />
      ),
    });
  if (!token)
    return (
      <div className="login">
        <div className="login-decoration" aria-hidden="true">
          <span>32</span>
          <span>123</span>
          <span>✦</span>
        </div>
        <div className="login-card">
          <div className="login-heading">
            <div className="login-icon">
              <Keyboard size={34} strokeWidth={1.6} />
            </div>
            <div className="logo">
              คีย์เลข<span>.</span>
            </div>
            <p className="login-tagline">คีย์ง่าย ทุกยอดอยู่ในมือคุณ</p>
            <h2>เข้าสู่ระบบ</h2>
            <p className="muted">ยินดีต้อนรับกลับสู่พื้นที่ของคุณ</p>
          </div>
          <Form
            fields={[
              { name: "username", label: "ชื่อผู้ใช้" },
              { name: "password", label: "รหัสผ่าน", type: "password" },
            ]}
            submit={busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ →"}
            onSubmit={(v) =>
              act(async () => {
                const { data } = await api.post("/login", v);
                sessionStorage.setItem("token", data.token);
                setToken(data.token);
              })
            }
          />
          {import.meta.env.DEV && (
            <div className="quick-login">
              <span>เข้าใช้งานด่วน · บัญชีทดสอบ</span>
              <div>
                {[
                  ["Admin", "testadmin", Settings],
                  ["Leader", "testleader", User],
                  ["Member", "testmember", Keyboard],
                ].map(([role, username, Icon]) => (
                  <button
                    key={role}
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        const { data } = await api.post("/login", {
                          username,
                          password: "test1234",
                        });
                        sessionStorage.setItem("token", data.token);
                        setPage(homePage(data.user.role));
                        setToken(data.token);
                      })
                    }
                  >
                    <Icon size={18} />
                    {role}
                  </button>
                ))}
              </div>
              <small>สำหรับทดสอบในเครื่องเท่านั้น</small>
            </div>
          )}
          <p className="small muted">บัญชีสมาชิกสร้างโดยหัวหน้าเครือข่าย</p>
        </div>
        {modal && (
          <div className="overlay">
            <div className="modal">
              <h3>{modal.title}</h3>
              <button onClick={() => setModal(null)}>ตกลง</button>
            </div>
          </div>
        )}
      </div>
    );
  if (!u) return <div className="loading">กำลังโหลด คีย์เลข…</div>;
  return (
    <div className="shell">
      <div className="topbar">
        <div className="logo">
          <span className="brand-symbol">
            <Keyboard size={23} />
          </span>{" "}
          คีย์เลข<span>.</span>
        </div>

        <nav>
          {menus[u.role].map((m) => {
            const Icon = icons[m];
            return (
              <button
                key={m}
                className={
                  (page === m ? "selected " : "") +
                  ((u.role === "Member" ? m === "คีย์" : m === "ตั้งค่า")
                    ? "featured"
                    : "")
                }
                onClick={() => {
                  setPage(m);
                  if (m === "คีย์" && drawId)
                    requestAnimationFrame(() => numberInput.current?.focus());
                  setFilter("");
                  setMemberFilter("");
                }}
              >
                <Icon size={20} />
                {m}
                {page === m && <ArrowRight size={16} />}
              </button>
            );
          })}
        </nav>
        <div className="header-right">
          {u.role !== "Admin" && state.accessExpiresAt && (
            <span className="access-remaining">
              เหลือ {accessTime(state.accessExpiresAt, tick).days} วัน
            </span>
          )}
          <button
            onClick={() =>
              setModal({
                title: "การแจ้งเตือน",
                content: (
                  <div>
                    {state.notifications?.length ? (
                      state.notifications.map((n) => (
                        <p key={n.id} className="notice">
                          {n.message}
                        </p>
                      ))
                    ) : (
                      <p>ยังไม่มีการแจ้งเตือน</p>
                    )}
                  </div>
                ),
              })
            }
          >
            <Bell size={20} />
          </button>
          <button
            className="header-password"
            title="เปลี่ยนรหัสผ่าน"
            aria-label="เปลี่ยนรหัสผ่าน"
            onClick={password}
          >
            <Settings size={18} />
          </button>
          {u.role === "Member" && (
            <button
              className="credit"
              onClick={() =>
                setModal({
                  title: "ขอเพิ่มเครดิต",
                  content: (
                    <Form
                      fields={[
                        {
                          name: "amount",
                          label: "จำนวนเครดิตที่ต้องการ",
                          type: "number",
                        },
                      ]}
                      onSubmit={(v) =>
                        act(async () => {
                          await api.post("/credit-requests", v);
                          setModal(null);
                        })
                      }
                    />
                  ),
                })
              }
            >
              <Wallet size={17} /> ฿{money(u.credit)} <Plus size={15} />
            </button>
          )}
          <button
            className="logout-button"
            title="ออกจากระบบ"
            aria-label="ออกจากระบบ"
            onClick={logout}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
      {u.role !== "Admin" &&
        state.accessExpiresAt &&
        accessTime(state.accessExpiresAt, tick).expiring && (
          <div className="access-warning" role="status">
            ใกล้หมดอายุ · เหลือเวลาใช้งาน{" "}
            {accessTime(state.accessExpiresAt, tick).days} วัน · หมดอายุ{" "}
            {date(state.accessExpiresAt)}
          </div>
        )}
      <div className="workspace">
        <main>
          {u.must_change ? (
            <section className="panel onboarding-panel">
              <div className="onboarding-icon">
                <User size={30} />
              </div>
              <h2>ตั้งรหัสผ่านของคุณก่อนเริ่มใช้งาน</h2>
              <p>บัญชีนี้ใช้รหัสผ่านเริ่มต้น กรุณาเปลี่ยนเพื่อใช้งานระบบ</p>
              <button className="primary" onClick={password}>
                เปลี่ยนรหัสผ่าน
              </button>
            </section>
          ) : !state.draws ? (
            <p>กำลังโหลดข้อมูล…</p>
          ) : (
            <>
              {page === "ผล" && (
                <>
                  {filters}

                  <div className="cards">
                    {resultDraws(state.draws, tick)
                      .filter(
                        (d) =>
                          matches(d) &&
                          (!filter || String(d.lottery_id) === filter),
                      )
                      .map((d) => (
                        <section className="panel result" key={d.id}>
                          <span className="badge">{d.kind}</span>
                          <h2>
                            <LotteryFlag flag={d.flag} /> {d.name}
                          </h2>
                          <p className="muted">งวด {date(d.draw_date)}</p>
                          <div className="winning">
                            <div>
                              <small>3 ตัวบน</small>
                              <strong>
                                {(tick >= new Date(d.result_at) && d.top3) ||
                                  "—"}
                              </strong>
                            </div>
                            <div>
                              <small>2 ตัวบน</small>
                              <strong>
                                {(tick >= new Date(d.result_at) && d.top2) ||
                                  "—"}
                              </strong>
                            </div>
                            <div>
                              <small>2 ตัวล่าง</small>
                              <strong>
                                {(tick >= new Date(d.result_at) && d.bottom2) ||
                                  "—"}
                              </strong>
                            </div>
                          </div>
                        </section>
                      ))}
                  </div>
                  {!state.draws.length && (
                    <Empty text="ยังไม่มีงวดหวย รอผู้ดูแลเพิ่มงวดแรก" />
                  )}
                </>
              )}
              {page === "คีย์" &&
                (!draw ? (
                  <>
                    {["หวยไทย", "หวยนอก"].map((kind) => (
                      <section className="lottery-selection" key={kind}>
                        <h2 className="section-title">{kind}</h2>
                        <div className="cards lottery-selection-cards">
                          {state.lotteries
                            .filter((l) => l.kind === kind)
                            .map((l) => {
                              const d = nextDraws(state.draws, tick).find(
                                (d) => d.lottery_id === l.id,
                              );
                              const cutoff = state.drawSettings.find(
                                (s) => s.draw_id === d?.id,
                              )?.config?.closeAt;
                              const unavailable =
                                !l.enabled ||
                                !d ||
                                !cutoff ||
                                tick >= new Date(cutoff).getTime() ||
                                !state.settings.some(
                                  (s) => s.lottery_id === l.id,
                                );
                              return (
                                <button
                                  className="panel lottery"
                                  key={l.id}
                                  disabled={unavailable}
                                  onClick={() => {
                                    setDrawId(String(d.id));
                                    setMode("2 ตัว");
                                    setText("");
                                    setTop("");
                                    setBottom("");
                                    setReverse(false);
                                    setPasted(false);
                                    requestAnimationFrame(() =>
                                      numberInput.current?.focus(),
                                    );
                                    setItems([]);
                                    setEditId(null);
                                  }}
                                >
                                  <div className="lottery-top">
                                    <span className="flag">
                                      <LotteryFlag flag={l.flag} />
                                    </span>
                                    <span className="badge">
                                      {!l.enabled
                                        ? "เร็ว ๆ นี้"
                                        : !d
                                          ? "ยังไม่มีงวด"
                                          : unavailable
                                            ? "ยังไม่เปิดรับ"
                                            : "เปิดรับ"}
                                    </span>
                                  </div>
                                  <h2>{l.name}</h2>
                                  <div className="lottery-draw-line">
                                    <span className="muted">
                                      {d
                                        ? "งวด " + date(d.draw_date)
                                        : "รอประกาศงวด"}
                                    </span>
                                    <span className="countdown">
                                      {d ? countdown(d) : "—"}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                        </div>
                      </section>
                    ))}
                  </>
                ) : (
                  <>
                    <div className="key-heading">
                      <h2>
                        <LotteryFlag flag={draw.flag} /> {draw.name}{" "}
                        <small>{date(draw.draw_date)}</small>
                      </h2>
                      <div className="key-countdown">
                        <small>เวลาที่เหลือก่อนปิดรับ</small>
                        <strong>{countdown(draw)}</strong>
                      </div>
                      <button
                        className="change-lottery"
                        onClick={() => {
                          setDrawId("");
                          setItems([]);
                          setEditId(null);
                        }}
                      >
                        ← เลือกหวยอื่น
                      </button>
                    </div>
                    <div className="key-grid">
                      <section className="panel">
                        <div className="tabs">
                          {[
                            "2 ตัว",
                            "3 ตัว",
                            "6 กลับ",
                            "รูด",
                            "วิ่ง",
                            "วิน",
                          ].map((m) => (
                            <button
                              key={m}
                              className={m === mode ? "active" : ""}
                              onClick={() => {
                                setMode(m);
                                setText("");
                                setWinDigits("");
                                setPasted(false);
                                setReverse(false);
                                setBottom("");
                                numberInput.current?.focus();
                              }}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                        {mode === "วิน" && (
                          <div className="win-calculator">
                            <div className="win-display-row">
                              <div className="win-display">
                                {winDigits.split("").join(" ") ||
                                  "เลือกเลขที่ต้องการวิน"}
                              </div>
                              <button
                                className="win-option win-size"
                                aria-label={
                                  "วิน " + digits + " ตัว กดเพื่อสลับจำนวนหลัก"
                                }
                                onClick={() => {
                                  setDigits((current) =>
                                    current === 2 ? 3 : 2,
                                  );
                                  setText("");
                                }}
                              >
                                {digits} ตัว <span>สลับ 2 / 3 ตัว</span>
                              </button>
                            </div>
                            <div className="win-keypad">
                              {[
                                "7",
                                "8",
                                "9",
                                "4",
                                "5",
                                "6",
                                "1",
                                "2",
                                "3",
                              ].map((digit) => (
                                <button
                                  key={digit}
                                  className={
                                    winDigits.includes(digit) ? "selected" : ""
                                  }
                                  aria-pressed={winDigits.includes(digit)}
                                  aria-label={"เลือกเลขวิน " + digit}
                                  onClick={() => {
                                    setWinDigits((current) =>
                                      current.includes(digit)
                                        ? current.replace(digit, "")
                                        : current + digit,
                                    );
                                    setText("");
                                  }}
                                >
                                  {digit}
                                </button>
                              ))}
                              <button
                                className={
                                  "win-option " + (doubles ? "selected" : "")
                                }
                                aria-pressed={doubles}
                                onClick={() => {
                                  setDoubles((current) => !current);
                                  setText("");
                                }}
                              >
                                รวมเลข{digits === 2 ? "เบิ้น" : "ตอง"}
                              </button>
                              <button
                                className={
                                  winDigits.includes("0") ? "selected" : ""
                                }
                                aria-pressed={winDigits.includes("0")}
                                aria-label="เลือกเลขวิน 0"
                                onClick={() => {
                                  setWinDigits((current) =>
                                    current.includes("0")
                                      ? current.replace("0", "")
                                      : current + "0",
                                  );
                                  setText("");
                                }}
                              >
                                0
                              </button>
                              <span className="muted small">กลับเลขด้วย Spacebar ในช่องเลข</span>
                            </div>
                            <button
                              className="primary full"
                              onClick={() => {
                                try {
                                  setText(
                                    numbers(
                                      winDigits,
                                      "วิน",
                                      reverse,
                                      digits,
                                      doubles,
                                    ).join(" "),
                                  );
                                  setPasted(false);
                                  numberInput.current?.focus();
                                } catch (e) {
                                  message(e.message);
                                }
                              }}
                            >
                              คำนวณเลขวิน
                            </button>
                          </div>
                        )}
                        <div className="keying-tools">
                          {" "}
                          {inputSize > 1 && (
                            <span className="muted small">Spacebar: เพิ่ม / เอาเลขกลับออก</span>
                          )}
                          {["2 ตัว", "3 ตัว"].includes(mode) && (
                            <button
                              onClick={() =>
                                setText(
                                  Array.from({ length: 10 }, (_, i) =>
                                    String(i).repeat(mode === "2 ตัว" ? 2 : 3),
                                  ).join(" "),
                                )
                              }
                            >
                              + เลข{mode === "2 ตัว" ? "เบิ้น" : "ตอง"}ทั้งหมด
                            </button>
                          )}
                        </div>
                        <label>
                          เลขที่ต้องการซื้อ{" "}
                          <span className="muted small">
                            {pasted
                              ? "ชุดเลขจากข้อความ"
                              : text.replace(/[^0-9]/g, "").length +
                                " / " +
                                inputSize +
                                " หลัก"}
                          </span>
                          <div className="number-entry-field" onClick={() => numberInput.current?.focus()}>
                            {inputTokens.completed.map((number, index) => (
                              <span className="number-entry-badge" key={index}>
                                <span>{number}</span>
                                <button type="button" aria-label={`ลบเลข ${number} รายการที่ ${index + 1}`} onClick={() => removeInputEntry(index)}>
                                  <X size={12} />
                                </button>
                              </span>
                            ))}
                          <input
                            type="text"
                            inputMode="numeric"
                            aria-label="เลขที่ต้องการซื้อ"
                            ref={numberInput}
                            value={inputTokens.pending}
                            onKeyDown={(e) => {
                              if (e.key === "Backspace" && !inputTokens.pending && inputTokens.completed.length && !e.nativeEvent.isComposing) {
                                e.preventDefault();
                                const last = inputTokens.completed.at(-1);
                                setText([...inputTokens.completed.slice(0, -1), last.slice(0, -1)].join(" "));
                                return;
                              }
                              if (e.key !== " " || e.nativeEvent.isComposing || inputSize === 1) return;
                              e.preventDefault();
                              if (e.repeat) return;
                              const batch = reverseBatch.current;
                              if (batch && text === batch.expanded) {
                                setText(batch.original);
                                reverseBatch.current = null;
                              } else {
                                const expanded = appendReversedNumbers(text, inputSize);
                                if (expanded === text) return;
                                reverseBatch.current = { original: text, expanded };
                                setText(expanded);
                              }
                              const field = e.target;
                              requestAnimationFrame(() => field.setSelectionRange(field.value.length, field.value.length));
                            }}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9\s]/g, "");
                              setText([...inputTokens.completed, formatNumberInput(raw, inputSize)].join(" "));
                              setPasted(false);
                            }}
                            onPaste={(e) => {
                              if (mode === "6 กลับ") {
                                e.preventDefault();
                                message("โหมดนี้ไม่รองรับการวางข้อความ");
                              } else {
                                e.preventDefault();
                                const pastedText = e.clipboardData.getData("text");
                                const field = e.target;
                                const pastedTokens = splitNumberInput(
                                  inputTokens.pending.slice(0, field.selectionStart) +
                                    pastedText + inputTokens.pending.slice(field.selectionEnd),
                                  inputSize,
                                );
                                setText([...inputTokens.completed, ...pastedTokens.completed, pastedTokens.pending].filter(Boolean).join(" "));
                                setPasted(true);
                                setReverse(false);
                              }
                            }}
                            placeholder={inputTokens.completed.length ? "" :
                              ["2 ตัว", "3 ตัว", "รูด", "วิ่ง"].includes(mode)
                                ? "พิมพ์เลข หรือวางข้อความจากลูกค้า"
                                : "กรอกตัวเลข"
                            }
                          />
                          </div>
                        </label>
                        <div className="amounts">
                          <label>
                            {mode === "วิ่ง" ? "วิ่งบน" : "ยอดบน"}
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={top}
                              onChange={(e) => setTop(e.target.value)}
                              onKeyDown={addOnEnter}
                            />
                          </label>
                          {mode !== "6 กลับ" && (
                            <label>
                              {mode === "วิ่ง"
                                ? "วิ่งล่าง"
                                : mode === "3 ตัว" ||
                                    (mode === "วิน" && digits === 3)
                                  ? "ยอดโต๊ด"
                                  : "ยอดล่าง"}
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={bottom}
                                onChange={(e) => setBottom(e.target.value)}
                                onKeyDown={addOnEnter}
                              />
                            </label>
                          )}
                        </div>
                        {preview.length > 0 && (
                          <div className="capacity-preview">
                            <div className="capacity-title">
                              <strong>ตรวจเลขก่อนเพิ่มโพย</strong>
                              <span>{draftRows(preview).length} เลข</span>
                            </div>
                            <div
                              className="capacity-table"
                              role="table"
                              aria-label="ยอดรับซื้อคงเหลือของชุดเลข"
                            >
                              <div
                                className="capacity-row capacity-columns"
                                role="row"
                              >
                                <span role="columnheader">เลข</span>
                                <span role="columnheader">
                                  {mode === "วิ่ง" ? "วิ่งบน" : "บน"} ·
                                  รับได้อีก
                                </span>
                                <span role="columnheader">
                                  {inputSize === 3
                                    ? "โต๊ด"
                                    : mode === "วิ่ง"
                                      ? "วิ่งล่าง"
                                      : "ล่าง"}{" "}
                                  · รับได้อีก
                                </span>
                                <span role="columnheader">สถานะ</span>
                                <span role="columnheader" aria-label="ลบเลข" />
                              </div>
                              <div className="capacity-body">
                                {previewEntries.map((row) => {
                                  const closed = config?.blocked?.includes(
                                    row.number,
                                  );
                                  const half = config?.half?.includes(
                                    row.number,
                                  );
                                  return (
                                    <div
                                      className={
                                        "capacity-row " +
                                        (closed
                                          ? "capacity-closed"
                                          : half
                                            ? "capacity-half"
                                            : "")
                                      }
                                      role="row"
                                      key={row.key}
                                    >
                                      <strong role="cell">{row.number}</strong>
                                      {row.types.map((type) => (
                                        <span
                                          role="cell"
                                          key={type}
                                          className={
                                            previewRemaining(row.number, type) <
                                            0
                                              ? "capacity-over"
                                              : ""
                                          }
                                        >
                                          {row.amounts[type]
                                            ? money(
                                                previewRemaining(
                                                  row.number,
                                                  type,
                                                ),
                                              )
                                            : "—"}
                                        </span>
                                      ))}
                                      <span
                                        role="cell"
                                        className={
                                          "capacity-status " +
                                          (closed
                                            ? "closed"
                                            : half
                                              ? "half"
                                              : "normal")
                                        }
                                      >
                                        {closed
                                          ? "ปิดรับ"
                                          : half
                                            ? "จ่ายครึ่ง"
                                            : "ปกติ"}
                                      </span>
                                      <button
                                        className="capacity-remove"
                                        tabIndex={-1}
                                        aria-label={
                                          "นำเลข " +
                                          row.number +
                                          " รายการที่ " + (row.inputIndex + 1) + " ออกจากชุดก่อนเพิ่มโพย"
                                        }
                                        onClick={() =>
                                          removePreviewEntry(row.inputIndex)
                                        }
                                      >
                                        <X size={13} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                        <button
                          className="primary full"
                          disabled={
                            blockedNumbers(
                              preview.map((i) => i.number),
                              config?.blocked,
                            ).length > 0
                          }
                          onClick={add}
                        >
                          <Plus size={18} /> เพิ่มเลขลงโพย
                        </button>
                        <div className="rules">
                          {[
                            ["blocked", "เลขปิดรับ"],
                            ["half", "จ่ายครึ่ง"],
                          ].map(([kind, title]) => (
                            <div
                              key={kind}
                              className={"rule-group rule-" + kind}
                            >
                              <strong>{title}</strong>
                              <div className="rule-numbers">
                                {config?.[kind]?.length ? (
                                  config[kind].map((number) => (
                                    <span className="rule-number" key={number}>
                                      {number}
                                    </span>
                                  ))
                                ) : (
                                  <span className="rule-empty">ไม่มี</span>
                                )}
                              </div>
                            </div>
                          ))}
                          <small>ยอดรับซื้ออัปเดตเมื่อสมาชิกส่งโพย</small>
                        </div>
                      </section>
                      <section className="panel">
                        <div className="draft-heading">
                          <h2>
                            {editId ? "แก้ไขโพย #" + editId : "โพยปัจจุบัน"}{" "}
                            <span className="badge">
                              {draftRows(items).length} เลข
                            </span>
                          </h2>
                          <button
                            className="clear-draft"
                            disabled={!items.length}
                            onClick={() => setItems([])}
                          >
                            <Trash2 size={15} /> ลบเลขทั้งหมด
                          </button>
                        </div>
                        <div className="item-list">
                          {draftRows(items).map((row) => (
                            <div className="item draft-row" key={row.key}>
                              <div className="draft-number">
                                <strong>{row.number}</strong>
                                <small>{row.category}</small>
                                {config?.blocked?.includes(row.number) && (
                                  <span className="number-alert alert-blocked">
                                    เลขปิดรับ
                                  </span>
                                )}
                                {config?.half?.includes(row.number) && (
                                  <span className="number-alert alert-half">
                                    จ่ายครึ่ง
                                  </span>
                                )}
                              </div>
                              <div className="draft-amounts">
                                {row.types.map((type, index) => (
                                  <React.Fragment key={type}>
                                    {index > 0 && (
                                      <span className="amount-times">×</span>
                                    )}
                                    <label>
                                      <span className="draft-amount-control">
                                        <span className="draft-amount-prefix">
                                          {type === "3tod"
                                            ? "โต๊ด"
                                            : type === "2bottom" ||
                                                type === "runBottom"
                                              ? "ล่าง"
                                              : "บน"}
                                        </span>
                                        <input
                                          className="amount-edit"
                                          aria-label={
                                            "ยอดซื้อ " +
                                            row.number +
                                            " " +
                                            labels[type]
                                          }
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={row.amounts[type] || ""}
                                          placeholder="0"
                                          onChange={(e) =>
                                            setItems((current) =>
                                              updateDraftAmount(
                                                current,
                                                row.key,
                                                type,
                                                e.target.value,
                                              ),
                                            )
                                          }
                                        />
                                      </span>
                                      <small>
                                        รับได้{" "}
                                        {money(
                                          available({
                                            number: row.number,
                                            type,
                                          }),
                                        )}
                                      </small>
                                    </label>
                                  </React.Fragment>
                                ))}
                              </div>
                              <button
                                tabIndex={-1}
                                aria-label={
                                  "ลบเลข " + row.number + " " + row.category
                                }
                                onClick={() =>
                                  setItems((current) =>
                                    current.filter(
                                      (_, index) => !row.indices.includes(index),
                                    ),
                                  )
                                }
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ))}
                          {!items.length && (
                            <Empty text="เพิ่มเลขเพื่อเริ่มโพยของคุณ" />
                          )}
                        </div>
                        <label>
                          หมายเหตุ (ไม่บังคับ)
                          <input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            maxLength={500}
                          />
                        </label>
                        <div className="totals">
                          <p>
                            ลูกค้าชำระ <b>฿{money(total)}</b>
                          </p>
                          <p>
                            ส่วนลดของคุณ <b>฿{money(total - net)}</b>
                          </p>
                          <p>
                            ตัดเครดิต <strong>฿{money(net)}</strong>
                          </p>
                        </div>
                        <button
                          disabled={!items.length || copying}
                          className="full"
                          onClick={copyImage}
                        >
                          <Copy size={17} />{" "}
                          {copying
                            ? "กำลังสร้างรูปภาพ…"
                            : "คัดลอกรูปภาพสำหรับลูกค้า"}
                          {copied && (
                            <span className="copy-success-badge" role="status">
                              <Check size={12} /> Copy แล้ว
                            </span>
                          )}
                        </button>
                        <button
                          className="primary full"
                          disabled={busy || !items.length || !config}
                          onClick={async () => {
                            if (submittingBill.current) return;
                            submittingBill.current = true;
                            setBusy(true);
                            setBillStatus("");
                            try {
                              await api.post(
                                "/bills" + (editId ? "/" + editId : ""),
                                { draw_id: draw.id, items, note },
                              );
                              setEditId(null);
                              setItems([]);
                              setNote("");
                              setMode("2 ตัว");
                              setText("");
                              setTop("");
                              setBottom("");
                              setBillStatus("ส่งโพยแล้ว");
                              numberInput.current?.focus();
                              try {
                                await load();
                              } catch {
                                setBillStatus("ส่งโพยแล้ว แต่โหลดรายการล่าสุดไม่ได้ กรุณารีเฟรชหน้า");
                              }
                            } catch (e) {
                              setBillStatus(e.response?.data?.error || e.message || "ส่งโพยไม่สำเร็จ");
                            } finally {
                              submittingBill.current = false;
                              setBusy(false);
                            }
                          }}
                        >
                          {submittingBill.current ? "กำลังส่งโพย…" : "ยืนยันส่งโพย"} <ArrowRight size={17} />
                        </button>
                        {billStatus && <p role="status" aria-live="polite">{billStatus}</p>}
                      </section>
                    </div>
                    <section className="panel recent">
                      <h2>5 โพยล่าสุดของคุณ</h2>
                      {state.bills
                        .filter((b) => b.draw_id === draw.id)
                        .slice(-5)
                        .reverse()
                        .map((b) => (
                          <Bill
                            key={b.id}
                            b={b}
                            state={state}
                            edit={
                              u.role === "Member" ? () => editBill(b) : null
                            }
                            cancel={() =>
                              setModal({
                                title: "ยกเลิกโพย #" + b.id,
                                confirm: () =>
                                  act(async () => {
                                    await api.delete("/bills/" + b.id);
                                    setModal(null);
                                  }),
                              })
                            }
                          />
                        ))}
                    </section>
                  </>
                ))}
              {page === "โพย" && (
                <>
                  {filters}

                  <section className="panel">
                    {scopedBills
                      .filter((b) => !filter || "d" + b.draw_id === filter)
                      .slice()
                      .reverse()
                      .map((b) => (
                        <Bill
                          key={b.id}
                          b={b}
                          state={state}
                          edit={u.role === "Member" ? () => editBill(b) : null}
                          cancel={
                            u.role === "Member"
                              ? () =>
                                  setModal({
                                    title: "ยืนยันยกเลิกโพย #" + b.id,
                                    confirm: () =>
                                      act(async () => {
                                        await api.delete("/bills/" + b.id);
                                        setModal(null);
                                      }),
                                  })
                              : null
                          }
                        />
                      ))}
                    {!state.bills.length && <Empty text="ยังไม่มีโพยที่ส่ง" />}
                  </section>
                </>
              )}
              {page === "สถิติ" && (
                <>
                  {filters}
                  <div className="cards metrics">
                    {[
                      [
                        "จำนวนโพย",
                        scopedBills.filter((b) => b.status === "active").length,
                      ],
                      [
                        "ยอดขาย",
                        scopedBills
                          .filter((b) => b.status === "active")
                          .reduce((s, b) => s + b.gross, 0),
                      ],
                      [
                        "ส่วนลด",
                        scopedBills
                          .filter((b) => b.status === "active")
                          .reduce((s, b) => s + b.gross - b.net, 0),
                      ],
                      [
                        "ยอดถูกรางวัล",
                        scopedBills
                          .filter((b) => b.status === "active")
                          .reduce((s, b) => s + b.win, 0),
                      ],
                    ].map(([label, value]) => (
                      <div className="panel" key={label}>
                        <p className="muted">{label}</p>
                        <h2>
                          {label === "จำนวนโพย" ? value : "฿" + money(value)}
                        </h2>
                      </div>
                    ))}
                  </div>
                  <section className="panel">
                    <h2>ยอดขายแยกตามประเภทหวย</h2>
                    {state.lotteries.map((l) => {
                      const sum = scopedBills
                          .filter(
                            (b) =>
                              b.status === "active" &&
                              state.draws.find((d) => d.id === b.draw_id)
                                ?.lottery_id === l.id,
                          )
                          .reduce((s, b) => s + b.gross, 0),
                        max = Math.max(
                          1,
                          ...state.lotteries.map((l) =>
                            scopedBills
                              .filter(
                                (b) =>
                                  b.status === "active" &&
                                  state.draws.find((d) => d.id === b.draw_id)
                                    ?.lottery_id === l.id,
                              )
                              .reduce((s, b) => s + b.gross, 0),
                          ),
                        );
                      return (
                        <div className="chart-row" key={l.id}>
                          <span>{l.name}</span>
                          <div>
                            <i style={{ width: (sum / max) * 100 + "%" }} />
                          </div>
                          <b>{money(sum)}</b>
                        </div>
                      );
                    })}
                    {u.role !== "Member" && (
                      <>
                        <h3>
                          {u.role === "Admin"
                            ? "ยอดแยกตาม Leader"
                            : "ยอดแยกตามสมาชิก"}
                        </h3>
                        {state.users.map((person) => {
                          const rows = scopedBills.filter(
                            (b) =>
                              b.status === "active" &&
                              (u.role === "Admin"
                                ? b.leader_id
                                : b.member_id) === person.id,
                          );
                          return (
                            <div className="item" key={person.id}>
                              <span>
                                {person.name} · {rows.length} โพย
                              </span>
                              <b>
                                ฿{money(rows.reduce((s, b) => s + b.gross, 0))}
                              </b>
                            </div>
                          );
                        })}
                      </>
                    )}
                    <h3>ผลรายโพย</h3>
                    {scopedBills
                      .slice()
                      .reverse()
                      .map((b) => (
                        <div className="item" key={b.id}>
                          <span>
                            #{b.id} ·{" "}
                            {state.draws.find((d) => d.id === b.draw_id)?.name}
                          </span>
                          <b>
                            {b.status === "cancelled"
                              ? "ยกเลิก"
                              : state.draws.find((d) => d.id === b.draw_id)
                                    ?.top3
                                ? b.win > 0
                                  ? "ถูกรางวัล ฿" + money(b.win)
                                  : "ไม่ถูกรางวัล"
                                : "รอผล"}
                          </b>
                        </div>
                      ))}
                    <p className="muted small">
                      ยอดรางวัลแสดงเพื่อสรุปเท่านั้น
                      ยังไม่มีการเพิ่มรางวัลกลับเข้าเครดิตอัตโนมัติ
                    </p>
                  </section>
                </>
              )}
              {page === "ตั้งค่า" && (
                <div className="settings-page">
                  <SettingsPage state={state} act={act} modal={setModal} />
                </div>
              )}
              {page === "บัญชี" && (
                <>
                  <section className="panel">
                    <h2>{u.name}</h2>
                    <p>
                      {u.username} · {u.role}
                    </p>
                    <p>เครดิต ฿{money(u.credit)}</p>
                    <button onClick={password}>เปลี่ยนรหัสผ่าน</button>
                  </section>
                  {u.role === "Leader" && (
                    <Team state={state} act={act} modal={setModal} />
                  )}
                </>
              )}
            </>
          )}
        </main>
        <footer>คีย์เลข · ทุกเลข ทุกยอด จัดการได้ง่ายขึ้น</footer>
        {draw && items.length > 0 && (
          <div className="receipt-capture" aria-hidden="true">
            <CustomerReceipt
              ref={receipt}
              draw={draw}
              items={items}
              total={total}
              createdAt={receiptTime}
            />
          </div>
        )}
      </div>
      {modal && (
        <div className="overlay">
          <div className="modal">
            <button className="close" onClick={() => setModal(null)}>
              <X size={20} />
            </button>
            <h2>{modal.title}</h2>
            {modal.content}
            <div className="modal-actions">
              <button onClick={() => setModal(null)}>ปิด</button>
              {modal.confirm && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={modal.confirm}
                >
                  {busy ? "กำลังบันทึก…" : "ยืนยัน"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function Empty({ text }) {
  return (
    <div className="empty">
      <Receipt size={32} />
      <p>{text}</p>
    </div>
  );
}
function Bill({ b, state, cancel, edit }) {
  const d = state.draws.find((d) => d.id === b.draw_id);
  const setting = state.drawSettings?.find(
    (s) => s.draw_id === b.draw_id,
  )?.config;
  const editable =
    setting?.closeAt &&
    Date.now() <
      Math.min(
        new Date(setting.closeAt).getTime(),
        new Date(d?.result_at).getTime(),
      );
  return (
    <details className="bill">
      <summary>
        <span>
          #{String(b.id).padStart(5, "0")} · {d?.name} · {date(d?.draw_date)}
        </span>
        <b>
          ฿{money(b.gross)}{" "}
          <small>{b.status === "cancelled" ? "ยกเลิกแล้ว" : "ส่งแล้ว"}</small>
        </b>
      </summary>
      {b.items.map((i, index) => (
        <div className="item" key={index}>
          <strong>{i.number}</strong>
          <span>{labels[i.type]}</span>
          <span>
            ฿{money(i.amount)} · ลด {i.discount}% · จ่าย {i.rate}
          </span>
        </div>
      ))}
      <p>
        ลูกค้าชำระ {money(b.gross)} · ส่วนลด {money(b.gross - b.net)} ·
        ตัดเครดิต {money(b.net)}
      </p>
      <p>
        ถูกรางวัล {money(b.win)} บาท · {b.note || "ไม่มีหมายเหตุ"}
      </p>
      {edit && editable && b.status === "active" && (
        <button onClick={edit}>แก้ไขโพย</button>
      )}
      {cancel && editable && b.status === "active" && (
        <button onClick={cancel}>
          <Trash2 size={16} /> ยกเลิกโพย
        </button>
      )}
    </details>
  );
}
function Team({ state, act, modal }) {
  const create = () =>
    modal({
      title: "สร้างบัญชีสมาชิก",
      content: (
        <Form
          fields={[
            { name: "name", label: "ชื่อจริง–สกุล" },
            { name: "phone", label: "เบอร์โทร", type: "tel" },
          ]}
          onSubmit={(v) =>
            act(async () => {
              const { data } = await api.post("/users", v);
              modal({
                title: "บัญชีใหม่ — เก็บรหัสนี้เพื่อส่งให้สมาชิก",
                content: (
                  <p>
                    ชื่อผู้ใช้: <b>{data.username}</b>
                    <br />
                    รหัสผ่าน: <b>{data.password}</b>
                  </p>
                ),
              });
            })
          }
        />
      ),
    });
  return (
    <section className="panel">
      <div className="section-head">
        <h2>สมาชิกในเครือข่าย</h2>
        <button className="primary" onClick={create}>
          <Plus size={17} /> เพิ่มสมาชิก
        </button>
      </div>
      {state.users.map((m) => (
        <div className="item" key={m.id}>
          <span className="avatar">{m.name[0]}</span>
          <div>
            {m.name}
            <small>
              {m.username} · {m.phone}
            </small>
          </div>
          <b>฿{money(m.credit)}</b>
          <button
            onClick={() =>
              modal({
                title: "ปรับเครดิต " + m.name,
                content: (
                  <Form
                    fields={[
                      {
                        name: "amount",
                        label: "จำนวนเพิ่ม / ลด (ใส่ค่าติดลบเพื่อลด)",
                        type: "number",
                      },
                    ]}
                    onSubmit={(v) =>
                      act(async () => {
                        await api.patch("/users/" + m.id, v);
                        modal(null);
                      })
                    }
                  />
                ),
              })
            }
          >
            ปรับเครดิต
          </button>
        </div>
      ))}
      <h3>คำขอเพิ่มเครดิต</h3>
      {state.requests
        .filter((r) => r.status === "pending")
        .map((r) => (
          <div className="item" key={r.id}>
            <span>
              {state.users.find((u) => u.id === r.member_id)?.name} · ฿
              {money(r.amount)}
            </span>
            <button
              onClick={() =>
                act(() =>
                  api.patch("/credit-requests/" + r.id, { approve: true }),
                )
              }
            >
              <Check size={17} /> อนุมัติ
            </button>
            <button
              onClick={() =>
                modal({
                  title: "ปฏิเสธคำขอ",
                  content: (
                    <Form
                      fields={[{ name: "note", label: "เหตุผล" }]}
                      onSubmit={(v) =>
                        act(async () => {
                          await api.patch("/credit-requests/" + r.id, {
                            ...v,
                            approve: false,
                          });
                          modal(null);
                        })
                      }
                    />
                  ),
                })
              }
            >
              ปฏิเสธ
            </button>
          </div>
        ))}
    </section>
  );
}
function SettingsPage({ state, act, modal }) {
  const [adminTab, setAdminTab] = useState("leaders");
  const [search, setSearch] = useState("");
  const [drawLottery, setDrawLottery] = useState("");
  const [drawStatus, setDrawStatus] = useState("upcoming");
  const matchesSearch = (row) =>
    [row.name, row.username, row.phone, row.draw_date]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase());
  const u = state.user;
  return u.role === "Admin" ? (
    <div className="admin-settings">
      <div className="admin-overview">
        <div>
          <h2>จัดการระบบ</h2>
          <p className="muted">เลือกหมวดที่ต้องการจัดการ</p>
        </div>
        <div className="admin-counts">
          <span>{state.users.length} Leader</span>
          <span>{state.lotteries.length} ประเภทหวย</span>
          <span>{state.draws.length} งวด</span>
        </div>
      </div>
      <div className="admin-tabs">
        {[
          ["leaders", "เครือข่าย"],
          ["lotteries", "ประเภทหวย"],
          ["draws", "งวดและผลรางวัล"],
          ["maintenance", "ล้างข้อมูล / เตรียม VPS"],
        ].map(([id, name]) => (
          <button
            key={id}
            className={adminTab === id ? "active" : ""}
            onClick={() => {
              setAdminTab(id);
              setSearch("");
            }}
          >
            {name}
          </button>
        ))}
      </div>
      {adminTab !== "maintenance" && (
        <div className="admin-search">
          <input
            aria-label="ค้นหาในหมวดตั้งค่า"
            placeholder="ค้นหาชื่อ ชื่อบัญชี หรือเบอร์โทร…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}
      {adminTab === "leaders" && (
        <section className="panel">
          <div className="section-head">
            <h2>หัวหน้าเครือข่าย</h2>
            <button
              className="primary"
              onClick={() =>
                modal({
                  title: "สร้าง Leader",
                  content: (
                    <Form
                      fields={[
                        { name: "name", label: "ชื่อจริง–สกุล" },
                        { name: "phone", label: "เบอร์โทร", type: "tel" },
                        {
                          name: "expires_at",
                          label: "ใช้งานได้ถึง",
                          type: "datetime-local",
                        },
                      ]}
                      onSubmit={(v) =>
                        act(async () => {
                          const { data } = await api.post("/users", v);
                          modal({
                            title: "บัญชี Leader ใหม่",
                            content: (
                              <p>
                                {data.username}
                                <br />
                                {data.password}
                              </p>
                            ),
                          });
                        })
                      }
                    />
                  ),
                })
              }
            >
              + เพิ่ม Leader
            </button>
          </div>
          {state.users.filter(matchesSearch).map((l) => (
            <div className="item" key={l.id}>
              <div>
                {l.name}
                <small>
                  {l.username} · หมดอายุ {date(l.expires_at)} ·{" "}
                  {l.active ? "เปิดใช้งาน" : "ระงับ"}
                </small>
                <span
                  className={
                    "leader-time " +
                    (accessTime(l.expires_at).expiring || !l.active
                      ? "is-warning"
                      : "")
                  }
                >
                  {!l.active
                    ? "ปิดการใช้งาน"
                    : accessTime(l.expires_at).days > 0
                      ? "เหลือ " + accessTime(l.expires_at).days + " วัน"
                      : "หมดอายุแล้ว"}
                </span>
              </div>
              <button
                onClick={() =>
                  modal({
                    title: "เพิ่มหรือลดเวลา " + l.name,
                    content: (
                      <Form
                        fields={[
                          {
                            name: "expires_at",
                            label: "วันหมดอายุ",
                            type: "datetime-local",
                            value: new Date(
                              new Date(l.expires_at).getTime() + 7 * 3600000,
                            )
                              .toISOString()
                              .slice(0, 16),
                          },
                        ]}
                        onSubmit={(v) =>
                          act(async () => {
                            await api.patch("/users/" + l.id, {
                              ...v,
                              active: Boolean(l.active),
                            });
                            modal(null);
                          })
                        }
                      />
                    ),
                  })
                }
              >
                แก้ไขเวลา
              </button>
              <button
                onClick={() =>
                  modal({
                    title:
                      (l.active ? "ปิดการใช้งาน " : "เปิดการใช้งาน ") +
                      l.name +
                      " และสมาชิกทั้งหมด",
                    confirm: () =>
                      act(async () => {
                        await api.patch("/users/" + l.id, {
                          expires_at: l.expires_at,
                          active: !l.active,
                        });
                        modal(null);
                      }),
                  })
                }
              >
                {l.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
              </button>
            </div>
          ))}
        </section>
      )}
      {adminTab === "lotteries" && (
        <section className="panel">
          <div className="section-head">
            <h2>ประเภทหวย</h2>
            <button
              onClick={() =>
                modal({
                  title: "เพิ่มประเภทหวย",
                  content: (
                    <Form
                      fields={[
                        { name: "name", label: "ชื่อหวย" },
                        { name: "kind", label: "ชนิดหวย: หวยไทย หรือ หวยนอก" },
                        { name: "flag", label: "ธง (emoji)", required: false },
                      ]}
                      onSubmit={(v) =>
                        act(async () => {
                          await api.post("/lotteries", v);
                          modal(null);
                        })
                      }
                    />
                  ),
                })
              }
            >
              + เพิ่ม
            </button>
          </div>
          {state.lotteries.filter(matchesSearch).map((l) => (
            <div className="item" key={l.id}>
              <strong>
                <LotteryFlag flag={l.flag} /> {l.name}
              </strong>
              <span>{l.kind}</span>
              <button
                onClick={() =>
                  act(() =>
                    api.patch("/lotteries/" + l.id, { enabled: !l.enabled }),
                  )
                }
              >
                {l.enabled ? "เปิดอยู่ · กดปิด" : "ปิดอยู่ · กดเปิด"}
              </button>
              <button
                onClick={() =>
                  modal({
                    title: "แก้ไข " + l.name,
                    content: (
                      <Form
                        fields={[
                          { name: "name", label: "ชื่อหวย", value: l.name },
                          { name: "kind", label: "ชนิดหวย", value: l.kind },
                          {
                            name: "flag",
                            label: "ธง",
                            value: l.flag,
                            required: false,
                          },
                        ]}
                        onSubmit={(v) =>
                          act(async () => {
                            await api.put("/lotteries/" + l.id, v);
                            modal(null);
                          })
                        }
                      />
                    ),
                  })
                }
              >
                แก้ไข
              </button>
              <button
                onClick={() =>
                  modal({
                    title: "ลบประเภท " + l.name,
                    content: <p>ลบได้เฉพาะประเภทที่ยังไม่มีงวด</p>,
                    confirm: () =>
                      act(async () => {
                        await api.delete("/lotteries/" + l.id);
                        modal(null);
                      }),
                  })
                }
              >
                ลบ
              </button>
              <button
                onClick={() =>
                  modal({
                    title: "เพิ่มงวด " + l.name,
                    content: (
                      <Form
                        fields={[
                          { name: "draw_date", label: "วันงวด", type: "date" },
                          {
                            name: "result_at",
                            label: "เวลาเผยแพร่ผล",
                            type: "datetime-local",
                          },
                        ]}
                        onSubmit={(v) =>
                          act(async () => {
                            await api.post("/draws", {
                              ...v,
                              lottery_id: l.id,
                            });
                            modal(null);
                          })
                        }
                      />
                    ),
                  })
                }
              >
                + งวด
              </button>
            </div>
          ))}
        </section>
      )}
      {adminTab === "draws" && (
        <section className="panel">
          <h2>งวดและผลรางวัล</h2>
          <div className="admin-draw-filters">
            <select
              aria-label="กรองประเภทหวย"
              value={drawLottery}
              onChange={(e) => setDrawLottery(e.target.value)}
            >
              <option value="">ทุกประเภทหวย</option>
              {state.lotteries.map((lottery) => (
                <option key={lottery.id} value={lottery.id}>
                  {lottery.name}
                </option>
              ))}
            </select>
            <select
              aria-label="กรองสถานะงวด"
              value={drawStatus}
              onChange={(e) => setDrawStatus(e.target.value)}
            >
              <option value="upcoming">งวดที่ยังไม่ออกผล</option>
              <option value="past">งวดย้อนหลัง</option>
              <option value="all">ทุกงวด</option>
            </select>
          </div>
          {state.draws
            .filter(matchesSearch)
            .filter(
              (d) =>
                (!drawLottery || String(d.lottery_id) === drawLottery) &&
                (drawStatus === "all" ||
                  (drawStatus === "upcoming"
                    ? new Date(d.result_at) > new Date()
                    : new Date(d.result_at) <= new Date())),
            )
            .sort((a, b) => new Date(a.result_at) - new Date(b.result_at))
            .map((d) => (
              <div className="item" key={d.id}>
                <span>
                  {d.name} · {date(d.draw_date)}
                </span>
                <button
                  onClick={() =>
                    modal({
                      title: "แก้ไขงวด",
                      content: (
                        <Form
                          fields={[
                            {
                              name: "draw_date",
                              label: "วันงวด",
                              type: "date",
                              value: String(d.draw_date).slice(0, 10),
                            },
                            {
                              name: "result_at",
                              label: "เวลาเผยแพร่ผล",
                              type: "datetime-local",
                              value: new Date(
                                new Date(d.result_at).getTime() + 7 * 3600000,
                              )
                                .toISOString()
                                .slice(0, 16),
                            },
                          ]}
                          onSubmit={(v) =>
                            act(async () => {
                              await api.put("/draws/" + d.id, v);
                              modal(null);
                            })
                          }
                        />
                      ),
                    })
                  }
                >
                  แก้ไขงวด
                </button>
                <button
                  onClick={() =>
                    modal({
                      title: "ลบงวด " + d.name,
                      content: <p>ลบได้เฉพาะงวดที่ยังไม่มีโพย</p>,
                      confirm: () =>
                        act(async () => {
                          await api.delete("/draws/" + d.id);
                          modal(null);
                        }),
                    })
                  }
                >
                  ลบงวด
                </button>
                <button
                  onClick={() =>
                    modal({
                      title: "ผล " + d.name,
                      content: (
                        <Form
                          fields={[
                            { name: "top3", label: "3 ตัวบน", value: d.top3 },
                            { name: "top2", label: "2 ตัวบน", value: d.top2 },
                            {
                              name: "bottom2",
                              label: "2 ตัวล่าง",
                              value: d.bottom2,
                            },
                          ]}
                          onSubmit={(v) =>
                            act(async () => {
                              await api.patch("/draws/" + d.id, v);
                              modal(null);
                            })
                          }
                        />
                      ),
                    })
                  }
                >
                  บันทึกผล
                </button>
              </div>
            ))}
        </section>
      )}
      {adminTab === "maintenance" && <MaintenancePanel act={act} api={api} />}
    </div>
  ) : (
    <>
      {state.lotteries
        .filter((l) => l.enabled)
        .map((l) => {
          const c =
            state.settings.find((s) => s.lottery_id === l.id)?.config ||
            state.defaults;
          return (
            <section className="panel" key={l.id}>
              <h2>
                <LotteryFlag flag={l.flag} /> {l.name}
              </h2>
              <Form
                className="rates-form"
                fields={[
                  {
                    name: "limit",
                    label: "รับสูงสุดต่อเลข / ประเภท / งวด",
                    type: "number",
                    value: c.limit,
                  },
                  {
                    name: "discount",
                    label: "ส่วนลดค่าเริ่มต้น (%)",
                    type: "number",
                    value: c.discount,
                  },
                  ...Object.keys(labels).flatMap((type) => [
                    {
                      name: "limit_" + type,
                      label: labels[type] + " — รับสูงสุดต่อเลข",
                      type: "number",
                      value: c.limits?.[type] ?? c.limit,
                    },
                    {
                      name: type,
                      label: labels[type] + " — อัตราจ่ายต่อบาท",
                      type: "number",
                      value: c.rates[type],
                    },
                    {
                      name: "discount_" + type,
                      label: labels[type] + " — ส่วนลด (%)",
                      type: "number",
                      value: c.discounts?.[type] ?? c.discount,
                    },
                  ]),
                ]}
                onSubmit={(v) =>
                  act(async () => {
                    await api.post("/settings/" + l.id, {
                      closeAt: new Date().toISOString(),
                      limit: Number(v.limit),
                      discount: Number(v.discount),
                      limits: Object.fromEntries(
                        Object.keys(labels).map((k) => [
                          k,
                          Number(v["limit_" + k]),
                        ]),
                      ),
                      rates: Object.fromEntries(
                        Object.keys(labels).map((k) => [k, Number(v[k])]),
                      ),
                      discounts: Object.fromEntries(
                        Object.keys(labels).map((k) => [
                          k,
                          Number(v["discount_" + k]),
                        ]),
                      ),
                      blocked: [],
                      half: [],
                    });
                    modal({ title: "บันทึกการตั้งค่าแล้ว" });
                  })
                }
              />
            </section>
          );
        })}
      {state.lotteries
        .filter((l) => l.enabled)
        .map((lottery) => (
          <DrawRulesCard
            key={lottery.id}
            lottery={lottery}
            state={state}
            act={act}
            modal={modal}
          />
        ))}
    </>
  );
}

function DrawRulesCard({ lottery, state, act, modal }) {
  const [selectedId, setSelectedId] = useState("");
  const upcoming = state.draws
    .filter(
      (d) => d.lottery_id === lottery.id && new Date(d.result_at) > Date.now(),
    )
    .sort((a, b) => new Date(a.result_at) - new Date(b.result_at));
  const d = upcoming.find((d) => String(d.id) === selectedId) || upcoming[0];
  if (!d) return null;
  const c = state.drawSettings.find((s) => s.draw_id === d.id)?.config;
  const closeAt =
    c?.closeAt && Number.isFinite(Date.parse(c.closeAt))
      ? new Date(Date.parse(c.closeAt) + 7 * 3600000).toISOString().slice(0, 16)
      : "";
  return (
    <section className="panel draw-rules">
      <div className="section-head">
        <h2>
          กฎงวด · <LotteryFlag flag={lottery.flag} /> {lottery.name}
        </h2>
        <span className="badge">{upcoming.length} งวดที่ยังไม่ออกผล</span>
      </div>
      <label>
        เลือกงวดหวย
        <select
          aria-label={"เลือกงวด " + lottery.name}
          value={String(d.id)}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {upcoming.map((draw) => (
            <option key={draw.id} value={draw.id}>
              งวด {date(draw.draw_date)}
            </option>
          ))}
        </select>
      </label>
      <Form
        key={d.id + JSON.stringify(c)}
        fields={[
          {
            name: "closeDate",
            label: "วันที่ปิดรับ",
            type: "date",
            value:
              closeAt.slice(0, 10) ||
              new Date(new Date(d.result_at).getTime() + 7 * 3600000)
                .toISOString()
                .slice(0, 10),
          },
          {
            name: "closeTime",
            label: "เวลาปิดรับ",
            type: "time",
            value: closeAt.slice(11, 16),
          },
          {
            name: "blocked",
            label: "เลขปิดรับ (คั่นด้วยช่องว่าง)",
            value: c?.blocked?.join(" ") || "",
            required: false,
          },
          {
            name: "half",
            label: "เลขจ่ายครึ่ง (คั่นด้วยช่องว่าง)",
            value: c?.half?.join(" ") || "",
            required: false,
          },
        ]}
        onSubmit={(v) =>
          act(async () => {
            await api.post("/draw-settings/" + d.id, {
              closeAt: v.closeDate + "T" + v.closeTime,
              blocked: v.blocked.split(/\s+/).filter(Boolean),
              half: v.half.split(/\s+/).filter(Boolean),
            });
            modal({ title: "บันทึกกฎงวด " + date(d.draw_date) + " แล้ว" });
          })
        }
      />
    </section>
  );
}

const CustomerReceipt = React.forwardRef(function CustomerReceipt(
  { draw, items, total, createdAt },
  ref,
) {
  return (
    <div ref={ref} className="customer-receipt">
      <h2>คีย์เลข · {draw.name}</h2>
      <p>งวด {date(draw.draw_date)}</p>
      <p className="receipt-created">
        วันที่ {date(createdAt)} เวลา{" "}
        {createdAt.toLocaleTimeString("th-TH", {
          timeZone: "Asia/Bangkok",
          hour12: false,
        })}
      </p>
      {summaryModes(items).map((group) => (
        <section className="receipt-mode" key={group.category}>
          <h3>{group.category}</h3>
          {group.rows.map((row, index) => (
            <div className="receipt-number-set" key={index}>
              <b>{row.numbers.join(", ")}</b>
              <span className="receipt-price">
                {row.top}×{row.bottom}
              </span>
            </div>
          ))}
        </section>
      ))}
      <h3>ยอดชำระ ฿{money(total)}</h3>
    </div>
  );
});
