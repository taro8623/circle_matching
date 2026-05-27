import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

type Member = {
  id: string;
  name: string;
  parts: string[];
  bio?: string | null;
  role?: string;
};

const PART_OPTIONS = ["Vo", "Gt", "Ba", "Dr", "Key", "Cho", "Other"];

export default function CircleMembers() {
  const { circleId } = useParams();
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [circleName, setCircleName] = useState("");
  const [filterPart, setFilterPart] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!circleId) return;
    api.get<any>(`/circles/${circleId}`)
      .then((data) => {
        setMembers(data.members);
        setCircleName(data.name);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [circleId]);

  const filteredMembers = members.filter((m) => {
    if (!filterPart) return true;
    return m.parts.includes(filterPart);
  });

  if (loading) return <div style={styles.page}>読み込み中...</div>;
  if (error) return <div style={styles.page}><p style={styles.error}>{error}</p></div>;

  return (
    <main style={styles.page}>
      <button onClick={() => navigate(`/circles/${circleId}`)}>戻る</button>
      <h1 style={styles.h1}>{circleName} - メンバー一覧</h1>

      <section style={styles.filterSection}>
        <label style={{ fontWeight: "bold", marginRight: 8 }}>パートで絞り込む:</label>
        <select 
          value={filterPart} 
          onChange={(e) => setFilterPart(e.target.value)}
          style={styles.select}
        >
          <option value="">すべて表示</option>
          {PART_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {filterPart && (
          <button onClick={() => setFilterPart("")} style={styles.clearButton}>クリア</button>
        )}
      </section>

      <div style={styles.memberGrid}>
        {filteredMembers.length === 0 ? (
          <p style={styles.empty}>該当するメンバーはいません</p>
        ) : (
          filteredMembers.map((m) => (
            <div key={m.id} style={styles.card}>
              <div style={styles.memberHeader}>
                <span style={styles.name}>{m.name}</span>
                {m.role === "owner" && <span style={styles.roleBadge}>代表</span>}
              </div>
              <div style={styles.partContainer}>
                {m.parts.length > 0 ? (
                  m.parts.map(p => (
                    <span key={p} style={styles.partBadge}>{p}</span>
                  ))
                ) : (
                  <span style={styles.noPart}>パート未設定</span>
                )}
              </div>
              <div style={styles.bioSection}>
                <div style={styles.bioLabel}>自己紹介</div>
                <p style={styles.bioText}>{m.bio?.trim() || "自己紹介はまだ登録されていません"}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { width: "min(800px, calc(100vw - 32px))", margin: "32px auto", textAlign: "left" },
  h1: { fontSize: 24, margin: "20px 0" },
  filterSection: { marginBottom: 24, display: "flex", alignItems: "center", gap: 12, padding: 16, background: "#f3f4f6", borderRadius: 8 },
  select: { padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 16 },
  clearButton: { background: "none", border: "none", color: "#6b7280", textDecoration: "underline", cursor: "pointer" },
  memberGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 },
  card: { padding: 16, border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },
  memberHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  name: { fontWeight: "bold", fontSize: 18 },
  roleBadge: { fontSize: 11, background: "#fee2e2", color: "#991b1b", padding: "2px 6px", borderRadius: 4 },
  partContainer: { display: "flex", flexWrap: "wrap", gap: 6 },
  bioSection: { marginTop: 14, paddingTop: 12, borderTop: "1px solid #f1f5f9" },
  bioLabel: { fontSize: 12, fontWeight: "bold", color: "#64748b", marginBottom: 6 },
  bioText: { margin: 0, fontSize: 14, color: "#334155", whiteSpace: "pre-wrap", lineHeight: 1.5 },
  partBadge: { fontSize: 12, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", padding: "2px 8px", borderRadius: 999 },
  noPart: { fontSize: 13, color: "#9ca3af", fontStyle: "italic" },
  error: { color: "#dc2626" },
  empty: { color: "#6b7280", gridColumn: "1 / -1", textAlign: "center", padding: "40px 0" }
};
