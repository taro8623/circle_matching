import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

type Message = {
  id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
};

type ChatRoom = {
  id: string;
  song_request_id: string;
  participant_ids: string[];
  messages: Message[];
};

export default function SongChat() {
  const { songId } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const reload = async () => {
    if (!songId) return;
    try {
      const r = await api.get<ChatRoom>(`/songs/${songId}/chat`);
      setRoom(r);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得失敗");
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [songId]);

  const send = async () => {
    if (!content.trim()) return;
    setBusy(true);
    try {
      await api.post(`/songs/${songId}/chat`, { content });
      setContent("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "送信失敗");
    } finally { setBusy(false); }
  };

  return (
    <main style={styles.page}>
      <button onClick={() => navigate(`/songs/${songId}`)}>戻る</button>
      <h1 style={styles.h1}>曲チャット</h1>
      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.feed}>
        {room?.messages.length === 0 && <p style={styles.empty}>まだメッセージはありません</p>}
        {room?.messages.map((m) => (
          <div key={m.id} style={styles.msg}>
            <div style={styles.msgHeader}>
              <strong>{m.user_name}</strong>
              <span style={styles.time}>{new Date(m.created_at).toLocaleString()}</span>
            </div>
            <div style={styles.msgBody}>{m.content}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div style={styles.inputRow}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          style={styles.input}
          placeholder="メッセージを入力 (Enterで改行、ボタンで送信)"
        />
        <button disabled={busy || !content.trim()} onClick={send}>送信</button>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { width: "min(720px, calc(100vw - 32px))", margin: "32px auto", textAlign: "left" },
  h1: { margin: "16px 0" },
  feed: { border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, maxHeight: "60vh", overflowY: "auto", background: "#fff" },
  msg: { marginBottom: 16 },
  msgHeader: { display: "flex", justifyContent: "space-between", marginBottom: 4 },
  msgBody: { whiteSpace: "pre-wrap" },
  time: { color: "#6b7280", fontSize: 12 },
  inputRow: { display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginTop: 12 },
  input: { padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 14, resize: "vertical" },
  empty: { color: "#6b7280" },
  error: { color: "#dc2626" },
};
