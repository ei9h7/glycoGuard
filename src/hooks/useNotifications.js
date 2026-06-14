import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "glycoguard_notifications_enabled";

const supported = typeof window !== "undefined" && "Notification" in window;

/**
 * Manages browser push-notification permission + the user's opt-in preference
 * (stored locally) for feed-timer reminders.
 */
export function useNotifications() {
  const [permission, setPermission] = useState(supported ? Notification.permission : "unsupported");
  const [enabled, setEnabled] = useState(() => localStorage.getItem(STORAGE_KEY) === "true");

  useEffect(() => {
    if (!supported) return;
    setPermission(Notification.permission);
  }, []);

  const enable = useCallback(async () => {
    if (!supported) return false;
    let perm = Notification.permission;
    if (perm === "default") {
      perm = await Notification.requestPermission();
      setPermission(perm);
    }
    const ok = perm === "granted";
    setEnabled(ok);
    localStorage.setItem(STORAGE_KEY, String(ok));
    return ok;
  }, []);

  const disable = useCallback(() => {
    setEnabled(false);
    localStorage.setItem(STORAGE_KEY, "false");
  }, []);

  const notify = useCallback((title, options) => {
    if (!supported || !enabled || Notification.permission !== "granted") return;
    try {
      new Notification(title, options);
    } catch {
      // Notification constructor can throw on some platforms (e.g. mobile Safari) — ignore.
    }
  }, [enabled]);

  return { supported, permission, enabled, enable, disable, notify };
}
