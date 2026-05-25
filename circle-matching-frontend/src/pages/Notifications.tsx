import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  link_path?: string | null;
  read_at?: string | null;
  created_at: string;
};

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    try {
      const rows = await api.get<NotificationItem[]>("/notifications");
      setNotifications(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "通知の取得に失敗しました");
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const openNotification = async (notification: NotificationItem) => {
    setBusy(true);
    try {
      if (!notification.read_at) {
        await api.patch(`/notifications/${notification.id}/read`);
      }
      if (notification.link_path) {
        navigate(notification.link_path);
      } else {
        await reload();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "通知の更新に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const markAllRead = async () => {
    setBusy(true);
    try {
      await api.patch("/notifications/read-all");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "通知の更新に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <button type="button" onClick={() => navigate("/me")}>戻る</button>
        <button type="button" onClick={markAllRead} disabled={busy || notifications.every((n) => n.read_at)}>
          すべて既読
        </button>
      </div>
      <h1 style={styles.h1}>通知</h1>
      {error && <p style={styles.error}>{error}</p>}
      {notifications.length === 0 ? (
        <p style={styles.empty}>通知はありません</p>
      ) : (
        <div style={styles.list}>
          {notifications.map((notification) => {
            const unread = !notification.read_at;
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => openNotification(notification)}
                disabled={busy}
                style={{
                  ...styles.item,
                  background: unread ? "#eff6ff" : "#fff",
                  borderColor: unread ? "#93c5fd" : "#e5e7eb",
                }}
              >
                <div style={styles.itemHeader}>
                  <strong>{notification.title}</strong>
                  {unread && <span style={styles.unread}>未読</span>}
                </div>
                {notification.body && <p style={styles.body}>{notification.body}</p>}
                <p style={styles.date}>{new Date(notification.created_at).toLocaleString()}</p>
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { width: "min(760px, calc(100vw - 32px))", margin: "32px auto", textAlign: "left" },
  header: { display: "flex", justifyContent: "space-between", gap: 12 },
  h1: { margin: "20px 0" },
  list: { display: "grid", gap: 10 },
  item: {
    width: "100%",
    textAlign: "left",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 14,
    cursor: "pointer",
  },
  itemHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" },
  unread: {
    borderRadius: 999,
    padding: "2px 8px",
    background: "#2563eb",
    color: "#fff",
    fontSize: 12,
    whiteSpace: "nowrap",
  },
  body: { margin: "8px 0 0", color: "#374151" },
  date: { margin: "8px 0 0", color: "#6b7280", fontSize: 12 },
  empty: { color: "#6b7280" },
  error: { color: "#dc2626" },
};
