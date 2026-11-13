import { useEffect, useState } from "react";

const updates = new EventTarget();

export function refreshBillData(detail) {
  updates.dispatchEvent(new CustomEvent("change", { detail }));
}

const empty = { bills: [], usage: [], total: 0, page: 1 };

export function useBillData(api, user, filters, enabled = true) {
  const key = enabled && user ? JSON.stringify(filters) : "";
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!key) return;
    const params = JSON.parse(key);
    let active = true;
    let pending = false;
    let timer;
    let controller;
    const load = async () => {
      if (!active) return;
      if (controller) {
        pending = true;
        return;
      }
      controller = new AbortController();
      try {
        const { data } = await api.get("/bill-data", {
          params,
          signal: controller.signal,
        });
        if (active) setResult({ key, userId: user.id, ...data });
      } catch {
        if (active)
          setResult((previous) => ({
            ...(previous?.key === key && previous.userId === user.id
              ? previous
              : empty),
            key,
            userId: user.id,
            error: true,
          }));
      } finally {
        controller = null;
        if (pending && active) {
          pending = false;
          schedule();
        }
      }
    };
    const schedule = () => {
      if (!timer)
        timer = setTimeout(() => {
          timer = null;
          load();
        }, 200);
    };
    const change = ({ detail }) => {
      if (detail && params.draw && String(params.draw) !== String(detail.draw))
        return;
      if (
        detail &&
        user.role === "Member" &&
        !params.keying &&
        String(user.id) !== String(detail.member)
      )
        return;
      schedule();
    };
    updates.addEventListener("change", change);
    load();
    return () => {
      active = false;
      clearTimeout(timer);
      controller?.abort();
      updates.removeEventListener("change", change);
    };
  }, [api, key, user?.id, user?.role]);
  return key && result?.key === key && result.userId === user.id
    ? result
    : { ...empty, loading: Boolean(key) };
}
