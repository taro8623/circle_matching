import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import NotificationButton from "../components/NotificationButton";

type RecruitingPart = {
  part: string;
  required_count: number;
  accepted_count: number;
};

type CircleSong = {
  id: string;
  title: string;
  artist: string;
  requested_by: string;
  recruiting_parts: RecruitingPart[];
  planned_month?: string | null;
  latest_live_event_name?: string | null;
  latest_live_application_status?: string | null;
};

type CircleSongsForMe = {
  circle_id: string;
  circle_name: string;
  applied_songs: CircleSong[];
  offered_songs: CircleSong[];
  own_songs: CircleSong[];
};

function getStatusBadges(song: CircleSong) {
  const badges = [];
  if (song.planned_month) {
    badges.push(`予定: ${song.planned_month}`);
  }
  if (song.latest_live_application_status === "approved") {
    badges.push(`出演確定: ${song.latest_live_event_name}`);
  } else if (song.latest_live_application_status === "applied") {
    badges.push(`ライブ申請中: ${song.latest_live_event_name}`);
  }
  return badges;
}

function Section({
  title,
  hint,
  emptyText,
  items,
  actionLabel,
  onSongClick,
}: {
  title: string;
  hint: string;
  emptyText: string;
  items: CircleSong[];
  actionLabel: string;
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
          {items.map((song) => (
            <div key={song.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <strong>{song.title}</strong>
                  <p style={styles.meta}>{song.artist}</p>
                </div>
                <button type="button" style={styles.primaryButton} onClick={() => onSongClick(song.id)}>
                  {actionLabel}
                </button>
              </div>
              <p style={styles.meta}>起票者: {song.requested_by}</p>
              {song.recruiting_parts.length > 0 && (
                <p style={styles.meta}>
                  募集状況:{" "}
                  {song.recruiting_parts
                    .map((part) => `${part.part} ${part.accepted_count}/${part.required_count}`)
                    .join(" / ")}
                </p>
              )}
              {getStatusBadges(song).length > 0 && (
                <div style={styles.badgeRow}>
                  {getStatusBadges(song).map((badge) => (
                    <span key={badge} style={styles.badge}>{badge}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function CircleRequestManagement() {
  const { circleId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<CircleSongsForMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!circleId) return;
    api.get<CircleSongsForMe>(`/circles/${circleId}/songs/for-me`)
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
      <h1 style={styles.h1}>{data.circle_name} - 応募・依頼管理</h1>
      <Section
        title="届いている依頼"
        hint="あなたへのお誘いです。返事や詳細確認が必要なものをまとめています。"
        emptyText="返事待ちの依頼はありません。"
        items={data.offered_songs}
        actionLabel="依頼を確認"
        onSongClick={(songId) => navigate(`/songs/${songId}`)}
      />
      <Section
        title="自分の応募中"
        hint="応募済みで、起票者の返答待ちになっている曲です。"
        emptyText="承認待ちの応募はありません。"
        items={data.applied_songs}
        actionLabel="応募状況を見る"
        onSongClick={(songId) => navigate(`/songs/${songId}`)}
      />
      <Section
        title="自分が起票した曲"
        hint="応募や依頼への対応が必要な曲を確認する入口です。"
        emptyText="起票した曲はまだありません。"
        items={data.own_songs}
        actionLabel="曲を管理"
        onSongClick={(songId) => navigate(`/songs/${songId}`)}
      />
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { width: "min(920px, calc(100vw - 32px))", margin: "32px auto", textAlign: "left" },
  header: { display: "flex", justifyContent: "space-between", gap: 12 },
  h1: { margin: "20px 0" },
  h2: { fontSize: 20, marginTop: 0, marginBottom: 8 },
  hint: { margin: "0 0 12px", color: "#64748b", fontSize: 14 },
  section: { marginTop: 24, padding: 16, border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff" },
  list: { display: "grid", gap: 10 },
  card: { border: "1px solid #dbeafe", borderRadius: 8, padding: 14, background: "#f8fbff" },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  meta: { margin: "6px 0 0", color: "#374151", fontSize: 14 },
  badgeRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 },
  badge: {
    borderRadius: 999,
    padding: "4px 10px",
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 12,
  },
  primaryButton: {
    border: "1px solid #2563eb",
    borderRadius: 6,
    padding: "8px 12px",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  empty: { color: "#6b7280" },
  error: { color: "#dc2626" },
};
