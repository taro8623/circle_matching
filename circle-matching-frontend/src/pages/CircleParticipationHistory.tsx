import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import NotificationButton from "../components/NotificationButton";

type ParticipationHistoryItem = {
  live_event_id: string;
  live_event_name: string;
  live_event_date?: string | null;
  song_id: string;
  song_title: string;
  artist: string;
  parts: string[];
};

type CircleParticipationHistory = {
  circle_id: string;
  circle_name: string;
  upcoming: ParticipationHistoryItem[];
  history: ParticipationHistoryItem[];
};

function HistorySection({
  title,
  emptyText,
  items,
  onSongClick,
}: {
  title: string;
  emptyText: string;
  items: ParticipationHistoryItem[];
  onSongClick: (songId: string) => void;
}) {
  return (
    <section style={styles.section}>
      <h2 style={styles.h2}>{title}</h2>
      {items.length === 0 ? (
        <p style={styles.empty}>{emptyText}</p>
      ) : (
        <div style={styles.list}>
          {items.map((item) => (
            <button
              key={`${item.live_event_id}-${item.song_id}`}
              type="button"
              style={styles.card}
              onClick={() => onSongClick(item.song_id)}
            >
              <div style={styles.cardHeader}>
                <strong>{item.song_title}</strong>
                <span style={styles.date}>{item.live_event_date || "日付未定"}</span>
              </div>
              <p style={styles.meta}>{item.artist}</p>
              <p style={styles.meta}>ライブ: {item.live_event_name}</p>
              <p style={styles.meta}>担当パート: {item.parts.join(", ")}</p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export default function CircleParticipationHistory() {
  const { circleId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<CircleParticipationHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!circleId) return;
    api.get<CircleParticipationHistory>(`/me/circles/${circleId}/participation-history`)
      .then(setData)
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
  if (!data) return null;

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <button onClick={() => navigate(`/circles/${circleId}`)}>戻る</button>
        <NotificationButton />
      </div>
      <h1 style={styles.h1}>{data.circle_name} - 参加履歴</h1>
      <HistorySection
        title="これからの出演予定"
        emptyText="承認済みの今後の出演予定はありません。"
        items={data.upcoming}
        onSongClick={(songId) => navigate(`/songs/${songId}`)}
      />
      <HistorySection
        title="過去の参加履歴"
        emptyText="終了済みライブの参加履歴はまだありません。"
        items={data.history}
        onSongClick={(songId) => navigate(`/songs/${songId}`)}
      />
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { width: "min(900px, calc(100vw - 32px))", margin: "32px auto", textAlign: "left" },
  header: { display: "flex", justifyContent: "space-between", gap: 12 },
  h1: { margin: "20px 0" },
  h2: { fontSize: 20, marginTop: 0, marginBottom: 12 },
  section: { marginTop: 24, padding: 16, border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff" },
  list: { display: "grid", gap: 10 },
  card: {
    width: "100%",
    textAlign: "left",
    border: "1px solid #dbeafe",
    borderRadius: 8,
    padding: 14,
    background: "#f8fbff",
    cursor: "pointer",
  },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" },
  date: { color: "#1d4ed8", fontSize: 12, whiteSpace: "nowrap" },
  meta: { margin: "6px 0 0", color: "#374151", fontSize: 14 },
  empty: { color: "#6b7280" },
  error: { color: "#dc2626" },
};
