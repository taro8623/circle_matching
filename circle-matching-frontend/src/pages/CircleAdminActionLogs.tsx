import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

type AdminActionLog = {
  id: string;
  actor_user_id: string;
  actor_user_name: string;
  permission_key: string;
  permission_label: string;
  target_type: string;
  target_id?: string | null;
  summary: string;
  details?: string | null;
  created_at: string;
};

export default function CircleAdminActionLogs() {
  const { circleId } = useParams();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AdminActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!circleId) return;
    api.get<AdminActionLog[]>(`/circles/${circleId}/admin-action-logs`)
      .then((data) => {
        setLogs(data);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [circleId]);

  if (loading) return <div style={styles.page}>読み込み中...</div>;
  if (error) return <div style={styles.page}><p style={styles.error}>{error}</p></div>;

  return (
    <main style={styles.page}>
      <button onClick={() => navigate(`/circles/${circleId}`)}>戻る</button>
      <h1 style={styles.h1}>管理者操作ログ</h1>
      <p style={styles.meta}>権限を持つメンバーが実行した重要操作の履歴です。</p>

      {logs.length === 0 ? (
        <p style={styles.empty}>まだログはありません</p>
      ) : (
        <div style={styles.list}>
          {logs.map((log) => (
            <section key={log.id} style={styles.card}>
              <div style={styles.header}>
                <strong>{log.summary}</strong>
                <span style={styles.badge}>{log.permission_label}</span>
              </div>
              <p style={styles.meta}>実行者: {log.actor_user_name}</p>
              {log.details && <p style={styles.details}>{log.details}</p>}
              <p style={styles.time}>{new Date(log.created_at).toLocaleString("ja-JP")}</p>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { width: "min(900px, calc(100vw - 32px))", margin: "32px auto", textAlign: "left" },
  h1: { fontSize: 28, margin: "20px 0 8px" },
  meta: { color: "#64748b", marginTop: 0 },
  list: { display: "grid", gap: 12, marginTop: 20 },
  card: { border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, background: "#fff" },
  header: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" },
  badge: {
    borderRadius: 999,
    padding: "4px 10px",
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 12,
  },
  details: { margin: "8px 0", color: "#334155" },
  time: { margin: 0, color: "#94a3b8", fontSize: 13 },
  empty: { color: "#64748b" },
  error: { color: "#dc2626" },
};
