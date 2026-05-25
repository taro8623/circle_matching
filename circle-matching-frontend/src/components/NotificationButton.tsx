import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

type UnreadCountResponse = {
  unread_count: number;
};

export default function NotificationButton() {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    api.get<UnreadCountResponse>("/notifications/unread-count")
      .then((data) => setUnreadCount(data.unread_count))
      .catch(() => setUnreadCount(0));
  }, []);

  return (
    <button type="button" onClick={() => navigate("/notifications")} style={styles.button}>
      通知
      {unreadCount > 0 && <span style={styles.badge}>{unreadCount}</span>}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  button: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minHeight: 32,
  },
  badge: {
    minWidth: 20,
    height: 20,
    padding: "0 6px",
    borderRadius: 999,
    background: "#dc2626",
    color: "#fff",
    fontSize: 12,
    lineHeight: "20px",
    textAlign: "center",
    fontWeight: 700,
  },
};
