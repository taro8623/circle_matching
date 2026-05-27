import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import NotificationButton from "../components/NotificationButton";

type ChatRoomListItem = {
  chat_room_id: string;
  song_request_id: string;
  song_title: string;
  artist: string;
  last_message_preview?: string | null;
  last_message_at?: string | null;
  unread_count: number;
};

export default function CircleChats() {
  const { circleId } = useParams();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<ChatRoomListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!circleId) return;
    api.get<ChatRoomListItem[]>(`/circles/${circleId}/chat-rooms`)
      .then(setRooms)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [circleId]);

  if (loading) return <main style={styles.page}>読み込み中...</main>;
  if (error) {
    return (
      <main style={styles.page}>
        <button onClick={() => navigate(`/circles/${circleId}`)}>戻る</button>
        <p style={styles.error}>{error}</p>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <button onClick={() => navigate(`/circles/${circleId}`)}>戻る</button>
        <NotificationButton />
      </div>
      <h1 style={styles.h1}>チャット</h1>
      <p style={styles.meta}>参加中の曲チャットを、更新順と未読つきで確認できます。</p>

      {rooms.length === 0 ? (
        <p style={styles.empty}>まだ参加中のチャットはありません</p>
      ) : (
        <div style={styles.list}>
          {rooms.map((room) => (
            <button
              key={room.chat_room_id}
              type="button"
              style={styles.card}
              onClick={() => navigate(`/songs/${room.song_request_id}/chat`)}
            >
              <div style={styles.cardHeader}>
                <div>
                  <strong>{room.song_title}</strong>
                  <p style={styles.artist}>{room.artist}</p>
                </div>
                {room.unread_count > 0 && (
                  <span style={styles.unreadBadge}>未読 {room.unread_count}</span>
                )}
              </div>
              <p style={styles.preview}>
                {room.last_message_preview || "まだメッセージはありません"}
              </p>
              <p style={styles.time}>
                {room.last_message_at
                  ? new Date(room.last_message_at).toLocaleString("ja-JP")
                  : "更新なし"}
              </p>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { width: "min(900px, calc(100vw - 32px))", margin: "32px auto", textAlign: "left" },
  header: { display: "flex", justifyContent: "space-between", gap: 12 },
  h1: { margin: "20px 0 8px" },
  meta: { color: "#64748b", marginTop: 0 },
  list: { display: "grid", gap: 12, marginTop: 20 },
  card: {
    width: "100%",
    textAlign: "left",
    border: "1px solid #dbeafe",
    borderRadius: 10,
    padding: 16,
    background: "#f8fbff",
    cursor: "pointer",
  },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  artist: { margin: "4px 0 0", color: "#4b5563", fontSize: 14 },
  unreadBadge: {
    borderRadius: 999,
    padding: "4px 10px",
    background: "#dbeafe",
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 700,
  },
  preview: { margin: "10px 0 0", color: "#334155" },
  time: { margin: "10px 0 0", color: "#94a3b8", fontSize: 13 },
  empty: { color: "#6b7280" },
  error: { color: "#dc2626" },
};
