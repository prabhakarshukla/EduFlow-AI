"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/hooks/useTheme";
import { captureEvent } from "@/lib/posthog/helpers";
import { EVENTS } from "@/lib/posthog/events";

function Card({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-xl p-6 transition-all duration-200 ${className}`}
      style={{
        background: "var(--ui-surface)",
        border: "1px solid var(--ui-border)",
        boxShadow: "var(--ui-shadow-card)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[10px] font-semibold uppercase tracking-widest mb-4"
      style={{ color: "var(--ui-muted)" }}
    >
      {children}
    </p>
  );
}

export default function SettingsPage() {
  const { theme, isDark, setTheme } = useTheme();
  const [name, setName] = useState("EduFlow Student");
  const [email, setEmail] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const [notificationPermissionStatus, setNotificationPermissionStatus] =
    useState<"enabled" | "disabled" | "denied" | "unsupported">("disabled");
  const [notificationStatusMessage, setNotificationStatusMessage] = useState<
    string | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const NOTIFICATIONS_KEY = "notificationsEnabled";
  const REMINDERS_KEY = "remindersEnabled";
  useEffect(() => {
    const loadUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const fullName =
          typeof user?.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name.trim()
            : "";
        const displayName =
          fullName ||
          (typeof user?.user_metadata?.name === "string"
            ? user.user_metadata.name.trim()
            : "");

        if (displayName) {
          setName(displayName);
        }
        if (user?.email) {
          setEmail(user.email);
        }
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    try {
      const savedNotifications = localStorage.getItem(NOTIFICATIONS_KEY);
      const savedReminders = localStorage.getItem(REMINDERS_KEY);

      if (savedNotifications !== null) {
        setNotificationsEnabled(savedNotifications === "true");
      }
      if (savedReminders !== null) {
        setRemindersEnabled(savedReminders === "true");
      }
    } catch (error) {
      console.error("Error loading preference settings:", error);
    } finally {
      setPreferencesHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!preferencesHydrated) return;
    if (typeof window === "undefined") return;

    if (!("Notification" in window)) {
      setNotificationsEnabled(false);
      setNotificationPermissionStatus("unsupported");
      setNotificationStatusMessage(
        "Browser notifications are not supported in this browser.",
      );
      return;
    }

    if (Notification.permission === "denied") {
      setNotificationsEnabled(false);
      setNotificationPermissionStatus("denied");
      setNotificationStatusMessage(
        "Notification permission is blocked in your browser settings.",
      );
      return;
    }

    setNotificationPermissionStatus(
      notificationsEnabled ? "enabled" : "disabled",
    );
    setNotificationStatusMessage(null);
  }, [notificationsEnabled, preferencesHydrated]);

  useEffect(() => {
    if (!preferencesHydrated) return;

    try {
      localStorage.setItem(NOTIFICATIONS_KEY, String(notificationsEnabled));
      localStorage.setItem(REMINDERS_KEY, String(remindersEnabled));
    } catch (error) {
      console.error("Error saving preference settings:", error);
    }
  }, [notificationsEnabled, remindersEnabled, preferencesHydrated]);

  const handleNotificationsToggle = async () => {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      setNotificationPermissionStatus(
        typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "denied"
          ? "denied"
          : "disabled",
      );
      setNotificationStatusMessage(null);
      return;
    }

    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationsEnabled(false);
      setNotificationPermissionStatus("unsupported");
      setNotificationStatusMessage(
        "Browser notifications are not supported in this browser.",
      );
      return;
    }

    try {
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();

      if (permission === "granted") {
        captureEvent(EVENTS.NOTIFICATION_PERMISSION_GRANTED);
        setNotificationsEnabled(true);
        setNotificationPermissionStatus("enabled");
        setNotificationStatusMessage(null);
        return;
      }

      setNotificationsEnabled(false);
      setNotificationPermissionStatus(
        permission === "denied" ? "denied" : "disabled",
      );
      setNotificationStatusMessage(
        permission === "denied"
          ? "Notification permission is blocked in your browser settings."
          : "Notification permission was not granted.",
      );
    } catch (error) {
      setNotificationsEnabled(false);
      setNotificationPermissionStatus("disabled");
      setNotificationStatusMessage(
        "Unable to request notification permission right now.",
      );
    }
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setMessage({ type: "error", text: "Name cannot be empty" });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: trimmedName },
      });
      if (error) {
        throw error;
      }

      setName(trimmedName);
      setMessage({ type: "success", text: "Settings saved successfully" });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save settings";
      setMessage({ type: "error", text: errorMessage });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="px-6 sm:px-8 py-8 max-w-[1280px] mx-auto space-y-8">
      <div className="space-y-2">
        <h1
          className="text-2xl sm:text-[28px] font-bold tracking-tight"
          style={{ color: "var(--ui-heading)" }}
        >
          Settings
        </h1>
        <p className="text-sm" style={{ color: "var(--ui-muted)" }}>
          Manage your EduFlow AI preferences and account options.
        </p>
      </div>

      {message && (
        <div
          className="px-4 py-3 rounded-lg text-sm font-medium"
          style={{
            background:
              message.type === "success"
                ? "rgba(16, 185, 129, 0.1)"
                : "rgba(239, 68, 68, 0.1)",
            color: message.type === "success" ? "#10b981" : "#ef4444",
            border: `1px solid ${
              message.type === "success"
                ? "rgba(16, 185, 129, 0.3)"
                : "rgba(239, 68, 68, 0.3)"
            }`,
          }}
        >
          {message.type === "success" ? "✓ " : "✕ "}
          {message.text}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <div className="space-y-4">
            <div>
              <SectionLabel>Account</SectionLabel>
              <h2
                className="text-lg font-semibold mb-4"
                style={{ color: "var(--ui-text)" }}
              >
                Profile & Email
              </h2>
            </div>

            <div className="space-y-3">
              <div>
                <label
                  className="text-xs font-medium tracking-wide uppercase mb-2 block"
                  style={{ color: "var(--ui-subtle)" }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  placeholder="Loading..."
                  className="w-full px-3 py-2 text-sm rounded-lg"
                  style={{
                    background: "var(--ui-surface-2)",
                    color: "var(--ui-muted)",
                    border: "1px solid var(--ui-border)",
                  }}
                />
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--ui-subtle)" }}
                >
                  Managed through authentication
                </p>
              </div>

              <div>
                <label
                  className="text-xs font-medium tracking-wide uppercase mb-2 block"
                  style={{ color: "var(--ui-subtle)" }}
                >
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-3 py-2 text-sm rounded-lg transition-all duration-200"
                  style={{
                    background: "var(--ui-surface)",
                    color: "var(--ui-text)",
                    border: "1px solid var(--ui-border)",
                    outline: "none",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#14b8a6";
                    e.currentTarget.style.boxShadow =
                      "0 0 0 3px rgba(20, 184, 166, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--ui-border)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
                style={{
                  background: saving
                    ? "var(--ui-border)"
                    : "linear-gradient(135deg, #6EE7D8 0%, #14B8A6 100%)",
                  color: saving ? "var(--ui-muted)" : "#0d2420",
                  border: "none",
                  cursor: saving ? "not-allowed" : "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!saving) {
                    (e.currentTarget as HTMLElement).style.boxShadow =
                      "0 6px 22px rgba(110,231,216,0.44)";
                    (e.currentTarget as HTMLElement).style.transform =
                      "translateY(-2px)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!saving) {
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    (e.currentTarget as HTMLElement).style.transform =
                      "translateY(0)";
                  }
                }}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            <div>
              <SectionLabel>Preferences</SectionLabel>
              <h2
                className="text-lg font-semibold mb-4"
                style={{ color: "var(--ui-text)" }}
              >
                Customization
              </h2>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "var(--ui-text)" }}
                  >
                    Theme
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--ui-muted)" }}
                  >
                    {isDark ? "Dark mode" : "Light mode"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { const next = isDark ? "light" : "dark"; captureEvent(EVENTS.THEME_CHANGED, { theme: next }); setTheme(next); }}
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200"
                  style={{
                    background: isDark ? "#14b8a6" : "var(--ui-border)",
                  }}
                >
                  <span
                    className="inline-block h-4 w-4 transform rounded-full transition-all duration-200"
                    style={{
                      background: "#ffffff",
                      marginLeft: isDark ? "1.5rem" : "0.25rem",
                    }}
                  />
                </button>
              </div>

              <div
                className="flex items-center justify-between pt-2"
                style={{ borderTop: "1px solid var(--ui-border)" }}
              >
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "var(--ui-text)" }}
                  >
                    Notifications
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--ui-muted)" }}
                  >
                    Alert settings
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--ui-subtle)" }}
                  >
                    {notificationPermissionStatus === "denied"
                      ? "Permission denied"
                      : notificationsEnabled
                        ? "Enabled"
                        : "Disabled"}
                  </p>
                  {notificationStatusMessage && (
                    <p
                      className="text-[11px] mt-1 leading-relaxed"
                      style={{
                        color:
                          notificationPermissionStatus === "denied" ||
                          notificationPermissionStatus === "unsupported"
                            ? "#f87171"
                            : "var(--ui-muted)",
                      }}
                    >
                      {notificationStatusMessage}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleNotificationsToggle}
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200"
                  style={{
                    background: notificationsEnabled
                      ? "#14b8a6"
                      : "var(--ui-border)",
                  }}
                >
                  <span
                    className="inline-block h-4 w-4 transform rounded-full transition-all duration-200"
                    style={{
                      background: "#ffffff",
                      marginLeft: notificationsEnabled ? "1.5rem" : "0.25rem",
                    }}
                  />
                </button>
              </div>

              <div
                className="flex items-center justify-between pt-2"
                style={{ borderTop: "1px solid var(--ui-border)" }}
              >
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "var(--ui-text)" }}
                  >
                    Reminders
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--ui-muted)" }}
                  >
                    Study reminders
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--ui-subtle)" }}
                  >
                    {remindersEnabled ? "Enabled" : "Disabled"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { captureEvent(EVENTS.REMINDERS_TOGGLED, { enabled: !remindersEnabled }); setRemindersEnabled(!remindersEnabled); }}
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200"
                  style={{
                    background: remindersEnabled
                      ? "#14b8a6"
                      : "var(--ui-border)",
                  }}
                >
                  <span
                    className="inline-block h-4 w-4 transform rounded-full transition-all duration-200"
                    style={{
                      background: "#ffffff",
                      marginLeft: remindersEnabled ? "1.5rem" : "0.25rem",
                    }}
                  />
                </button>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            <div>
              <SectionLabel>Data & Privacy</SectionLabel>
              <h2
                className="text-lg font-semibold mb-4"
                style={{ color: "var(--ui-text)" }}
              >
                Legal & Policy
              </h2>
            </div>

            <div className="space-y-2">
              <Link
                href="/privacy"
                className="block px-3 py-2.5 rounded-lg transition-colors duration-200 text-sm font-medium"
                style={{
                  color: "#14b8a6",
                  background: "rgba(20, 184, 166, 0.05)",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "rgba(20, 184, 166, 0.1)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "rgba(20, 184, 166, 0.05)";
                }}
              >
                → Privacy Policy
              </Link>

              <Link
                href="/terms"
                className="block px-3 py-2.5 rounded-lg transition-colors duration-200 text-sm font-medium"
                style={{
                  color: "#14b8a6",
                  background: "rgba(20, 184, 166, 0.05)",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "rgba(20, 184, 166, 0.1)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "rgba(20, 184, 166, 0.05)";
                }}
              >
                → Terms & Conditions
              </Link>

              <Link
                href="/license"
                className="block px-3 py-2.5 rounded-lg transition-colors duration-200 text-sm font-medium"
                style={{
                  color: "#14b8a6",
                  background: "rgba(20, 184, 166, 0.05)",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "rgba(20, 184, 166, 0.1)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "rgba(20, 184, 166, 0.05)";
                }}
              >
                → License
              </Link>
            </div>
          </div>
        </Card>
      </div>

      <div
        className="px-6 py-4 rounded-lg text-xs text-center"
        style={{
          background: "rgba(20, 184, 166, 0.05)",
          color: "var(--ui-muted)",
          border: "1px solid rgba(20, 184, 166, 0.1)",
        }}
      >
        <p>
          More settings and customization options coming soon. Your data is
          always kept private and secure.
        </p>
      </div>
    </div>
  );
}
