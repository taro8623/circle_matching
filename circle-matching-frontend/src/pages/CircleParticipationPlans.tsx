import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import NotificationButton from "../components/NotificationButton";

type ParticipationPlanItem = {
  live_event_id?: string | null;
  live_event_name?: string | null;
  live_event_date?: string | null;
  song_id: string;
  song_title: string;
  artist: string;
  parts: string[];
  planned_month?: string | null;
};

type CircleParticipationPlans = {
  circle_id: string;
  circle_name: string;
  approved: ParticipationPlanItem[];
  applied: ParticipationPlanItem[];
  planned: ParticipationPlanItem[];
};

function PlanSection({
  title,
  hint,
  emptyText,
  items,
  accentColor,
  accentBackground,
  onSongClick,
}: {
  title: string;
  hint: string;
  emptyText: string;
  items: ParticipationPlanItem[];
  accentColor: string;
  accentBackground: string;
  onSongClick: (songId: string) => void;
}) {
  return (
    <section style={styles.section}>
      <h2 style={styles.h2}>{title}</h2>
      <p style={styles.hint}>{hint}</p>
      {items.length === 0 ? (
        <p style={styles.empty}>{emptyText}</p>
      ) : (
        <div style={styles.list}>
          {items.map((item) => (
            <button
              key={`${item.live_event_id || "planned"}-${item.song_id}`}
              type="button"
              style={{ ...styles.card, borderColor: accentColor, background: accentBackground }}
              onClick={() => onSongClick(item.song_id)}
            >
              <div style={styles.cardHeader}>
                <strong>{item.song_title}</strong>
                {item.live_event_date ? (
                  <span style={{ ...styles.badge, color: accentColor }}>{item.live_event_date}</span>
                ) : item.planned_month ? (
                  <span style={{ ...styles.badge, color: accentColor }}>予定月: {item.planned_month}</span>
                ) : (
                  <span style={{ ...styles.badge, color: accentColor }}>日付未定</span>
                )}
              </div>
              <p style={styles.meta}>{item.artist}</p>
              {item.live_event_name ? (
                <p style={styles.meta}>ライブ: {item.live_event_name}</p>
              ) : (
                <p style={styles.meta}>状態: メンバー確定済み・まだ予定段階</p>
              )}
              <p style={styles.meta}>担当パート: {item.parts.join(", ")}</p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export default function CircleParticipationPlans() {
  const { circleId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<CircleParticipationPlans | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!circleId) return;
    api.get<CircleParticipationPlans>(`/me/circles/${circleId}/participation-plans`)
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
      <h1 style={styles.h1}>{data.circle_name} - 参加予定</h1>
      <PlanSection
        title="出演確定"
        hint="ライブ参加が承認されている曲です。"
        emptyText="承認済みの参加予定はありません。"
        items={data.approved}
        accentColor="#059669"
        accentBackground="#ecfdf5"
        onSongClick={(songId) => navigate(`/songs/${songId}`)}
      />
      <PlanSection
        title="申請中"
        hint="ライブ参加を申請済みで、まだ結果待ちの曲です。"
        emptyText="申請中の曲はありません。"
        items={data.applied}
        accentColor="#d97706"
        accentBackground="#fffbeb"
        onSongClick={(songId) => navigate(`/songs/${songId}`)}
      />
      <PlanSection
        title="予定段階"
        hint="メンバーは確定しているが、まだライブ申請前の曲です。"
        emptyText="予定段階の曲はありません。"
        items={data.planned}
        accentColor="#2563eb"
        accentBackground="#eff6ff"
        onSongClick={(songId) => navigate(`/songs/${songId}`)}
      />
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { width: "min(900px, calc(100vw - 32px))", margin: "32px auto", textAlign: "left" },
  header: { display: "flex", justifyContent: "space-between", gap: 12 },
  h1: { margin: "20px 0" },
  h2: { fontSize: 20, marginTop: 0, marginBottom: 8 },
  hint: { margin: "0 0 12px", color: "#64748b", fontSize: 14 },
  section: { marginTop: 24, padding: 16, border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff" },
  list: { display: "grid", gap: 10 },
  card: {
    width: "100%",
    textAlign: "left",
    border: "1px solid #dbeafe",
    borderRadius: 8,
    padding: 14,
    cursor: "pointer",
  },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" },
  badge: { fontSize: 12, whiteSpace: "nowrap", fontWeight: 700 },
  meta: { margin: "6px 0 0", color: "#374151", fontSize: 14 },
  empty: { color: "#6b7280" },
  error: { color: "#dc2626" },
};
