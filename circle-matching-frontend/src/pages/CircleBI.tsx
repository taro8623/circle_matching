import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import NotificationButton from "../components/NotificationButton";

type PopularArtist = {
  artist_name: string;
  member_count: number;
};

type MemberStat = {
  user_id: string;
  user_name: string;
  appearance_count: number;
  participation_rate: number;
};

type CircleBIResponse = {
  circle_id: string;
  circle_name: string;
  member_count: number;
  completed_live_count: number;
  popular_artists: PopularArtist[];
  member_stats: MemberStat[];
};

export default function CircleBI() {
  const { circleId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<CircleBIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!circleId) return;
    api.get<CircleBIResponse>(`/circles/${circleId}/bi`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [circleId]);

  if (loading) return <main style={styles.page}>読み込み中...</main>;
  if (error || !data) {
    return (
      <main style={styles.page}>
        <button onClick={() => navigate(`/circles/${circleId}`)}>戻る</button>
        <p style={styles.error}>{error || "BIを取得できませんでした"}</p>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <button onClick={() => navigate(`/circles/${circleId}`)}>戻る</button>
        <NotificationButton />
      </div>
      <h1 style={styles.h1}>{data.circle_name} - BI</h1>

      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>在籍メンバー数</div>
          <div style={styles.summaryValue}>{data.member_count}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>終了済みライブ数</div>
          <div style={styles.summaryValue}>{data.completed_live_count}</div>
        </div>
      </div>

      <section style={styles.section}>
        <h2 style={styles.h2}>人気アーティスト</h2>
        <p style={styles.hint}>プロフィールの「好きなアーティスト」で名前が挙がっている回数です。</p>
        {data.popular_artists.length === 0 ? (
          <p style={styles.empty}>まだ好きなアーティストの登録がありません。</p>
        ) : (
          <div style={styles.artistList}>
            {data.popular_artists.map((artist, index) => (
              <div key={artist.artist_name} style={styles.artistRow}>
                <span style={styles.rank}>{index + 1}</span>
                <span style={styles.artistName}>{artist.artist_name}</span>
                <span style={styles.artistCount}>{artist.member_count}人</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={styles.section}>
        <h2 style={styles.h2}>出演回数・参加率</h2>
        <p style={styles.hint}>終了済みライブを母数に、各メンバーが何回出演したかを集計しています。</p>
        {data.member_stats.length === 0 ? (
          <p style={styles.empty}>集計対象メンバーがいません。</p>
        ) : (
          <div style={styles.table}>
            <div style={{ ...styles.tableRow, ...styles.tableHeader }}>
              <span>メンバー</span>
              <span>出演回数</span>
              <span>参加率</span>
            </div>
            {data.member_stats.map((member) => (
              <div key={member.user_id} style={styles.tableRow}>
                <span>{member.user_name}</span>
                <span>{member.appearance_count}回</span>
                <span>{member.participation_rate}%</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { width: "min(960px, calc(100vw - 32px))", margin: "32px auto", textAlign: "left" },
  header: { display: "flex", justifyContent: "space-between", gap: 12 },
  h1: { margin: "20px 0" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 },
  summaryCard: { padding: 16, border: "1px solid #dbeafe", borderRadius: 12, background: "#f8fbff" },
  summaryLabel: { color: "#64748b", fontSize: 14 },
  summaryValue: { marginTop: 8, fontSize: 28, fontWeight: 700, color: "#0f172a" },
  section: { marginTop: 24, padding: 16, border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" },
  h2: { margin: "0 0 8px", fontSize: 20 },
  hint: { margin: "0 0 12px", color: "#64748b", fontSize: 14 },
  artistList: { display: "grid", gap: 8 },
  artistRow: { display: "grid", gridTemplateColumns: "40px minmax(0, 1fr) auto", gap: 12, alignItems: "center", padding: "10px 0", borderTop: "1px solid #f1f5f9" },
  rank: { color: "#2563eb", fontWeight: 700 },
  artistName: { color: "#0f172a" },
  artistCount: { color: "#334155", fontWeight: 600 },
  table: { display: "grid" },
  tableRow: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 140px 120px", gap: 12, alignItems: "center", padding: "12px 0", borderTop: "1px solid #f1f5f9" },
  tableHeader: { color: "#64748b", fontWeight: 700, fontSize: 13 },
  empty: { color: "#6b7280" },
  error: { color: "#dc2626" },
};
