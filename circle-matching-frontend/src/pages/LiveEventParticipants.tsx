import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

type LiveEventParticipantAssignment = {
  song_id: string;
  title: string;
  artist: string;
  part: string;
};

type LiveEventParticipant = {
  participant_type: "circle_member" | "external_member";
  participant_key: string;
  user_id?: string | null;
  display_name: string;
  circle_role?: string | null;
  payment_status?: "unpaid" | "paid";
  profile_parts: string[];
  assignments: LiveEventParticipantAssignment[];
};

type LiveEventParticipantsResponse = {
  live_event_id: string;
  circle_id: string;
  live_event_name: string;
  event_date?: string | null;
  lifecycle_status: string;
  approved_song_count: number;
  participant_count: number;
  can_manage_payments: boolean;
  participants: LiveEventParticipant[];
};

const LIFECYCLE_LABELS: Record<string, string> = {
  scheduled: "開催前",
  completed: "終了",
  cancelled: "中止",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "代表",
  admin: "管理者",
  member: "メンバー",
};

const PAYMENT_STATUS_LABELS: Record<"unpaid" | "paid", string> = {
  unpaid: "未決済",
  paid: "決済完了",
};

export default function LiveEventParticipants() {
  const { circleId, eventId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<LiveEventParticipantsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    api.get<LiveEventParticipantsResponse>(`/live-events/${eventId}/participants`)
      .then((response) => {
        setData(response);
        setError("");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "参加者リストの取得に失敗しました");
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  const updatePaymentStatus = async (
    participant: LiveEventParticipant,
    paymentStatus: "unpaid" | "paid"
  ) => {
    if (!eventId) return;
    const key = `${participant.participant_type}:${participant.participant_key}`;
    setBusyKey(key);
    setError("");
    try {
      await api.patch(`/live-events/${eventId}/participants/payment-status`, {
        participant_type: participant.participant_type,
        participant_key: participant.participant_key,
        payment_status: paymentStatus,
      });
      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          participants: current.participants.map((item) =>
            item.participant_type === participant.participant_type &&
            item.participant_key === participant.participant_key
              ? { ...item, payment_status: paymentStatus }
              : item
          ),
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "決済状態の更新に失敗しました");
    } finally {
      setBusyKey("");
    }
  };

  if (loading) return <main style={styles.page}>読み込み中...</main>;

  return (
    <main style={styles.page}>
      <button onClick={() => navigate(`/circles/${circleId}/live-events`)}>戻る</button>
      {error && <p style={styles.error}>{error}</p>}
      {data && (
        <>
          <div style={styles.header}>
            <div>
              <h1 style={styles.h1}>{data.live_event_name} - 参加者リスト</h1>
              <p style={styles.meta}>
                日付: {data.event_date || "未定"} / 状態: {LIFECYCLE_LABELS[data.lifecycle_status] || data.lifecycle_status}
              </p>
            </div>
            <div style={styles.summaryBox}>
              <div style={styles.summaryValue}>{data.participant_count} 人</div>
              <div style={styles.summaryLabel}>参加者</div>
              <div style={{ ...styles.summaryValue, marginTop: 8 }}>{data.approved_song_count} 曲</div>
              <div style={styles.summaryLabel}>承認済み曲</div>
            </div>
          </div>

          {data.participants.length === 0 ? (
            <section style={styles.emptyBox}>
              <p style={styles.emptyTitle}>まだ参加者はいません</p>
              <p style={styles.emptyText}>このライブで承認済みになった曲の参加メンバーがここに表示されます。</p>
            </section>
          ) : (
            <div style={styles.list}>
              {data.participants.map((participant) => {
                const paymentStatus = participant.payment_status || "unpaid";
                const participantBusyKey = `${participant.participant_type}:${participant.participant_key}`;
                return (
                  <section
                    key={`${participant.participant_type}-${participant.participant_key}`}
                    style={styles.card}
                  >
                    <div style={styles.cardHeader}>
                      <div>
                        <h2 style={styles.cardTitle}>{participant.display_name}</h2>
                        <div style={styles.badgeRow}>
                          <span style={participant.participant_type === "circle_member" ? styles.memberBadge : styles.externalBadge}>
                            {participant.participant_type === "circle_member" ? "サークル内" : "外部"}
                          </span>
                          {participant.circle_role && (
                            <span style={styles.roleBadge}>{ROLE_LABELS[participant.circle_role] || participant.circle_role}</span>
                          )}
                        </div>
                      </div>
                      <div style={styles.statusColumn}>
                        <div style={styles.assignmentCount}>{participant.assignments.length} 枠</div>
                        {data.can_manage_payments ? (
                          <select
                            value={paymentStatus}
                            disabled={busyKey === participantBusyKey}
                            onChange={(e) =>
                              updatePaymentStatus(
                                participant,
                                e.target.value as "unpaid" | "paid"
                              )
                            }
                            style={styles.select}
                          >
                            <option value="unpaid">未決済</option>
                            <option value="paid">決済完了</option>
                          </select>
                        ) : (
                          <span
                            style={
                              paymentStatus === "paid"
                                ? styles.paidBadge
                                : styles.unpaidBadge
                            }
                          >
                            {PAYMENT_STATUS_LABELS[paymentStatus]}
                          </span>
                        )}
                      </div>
                    </div>

                    {participant.profile_parts.length > 0 && (
                      <div style={styles.badgeRow}>
                        {participant.profile_parts.map((part) => (
                          <span key={part} style={styles.partBadge}>{part}</span>
                        ))}
                      </div>
                    )}

                    <div style={styles.assignmentList}>
                      {participant.assignments.map((assignment) => (
                        <div key={`${assignment.song_id}-${assignment.part}`} style={styles.assignmentItem}>
                          <div>
                            <strong>{assignment.title}</strong>
                            <div style={styles.meta}>{assignment.artist}</div>
                          </div>
                          <span style={styles.assignmentPart}>{assignment.part}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { width: "min(960px, calc(100vw - 32px))", margin: "32px auto", textAlign: "left" },
  header: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginTop: 20, marginBottom: 24 },
  h1: { margin: "0 0 8px" },
  meta: { margin: 0, color: "#4b5563", fontSize: 14 },
  summaryBox: {
    minWidth: 140,
    padding: 16,
    borderRadius: 12,
    border: "1px solid #dbeafe",
    background: "#eff6ff",
    textAlign: "center",
  },
  summaryValue: { fontSize: 24, fontWeight: 700, color: "#1d4ed8" },
  summaryLabel: { fontSize: 12, color: "#1e3a8a" },
  list: { display: "grid", gap: 16 },
  card: { padding: 16, border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  cardTitle: { margin: 0, fontSize: 20 },
  statusColumn: { display: "grid", gap: 8, justifyItems: "end" },
  badgeRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 },
  memberBadge: {
    border: "1px solid #bfdbfe",
    borderRadius: 999,
    padding: "2px 8px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 12,
  },
  externalBadge: {
    border: "1px solid #fbcfe8",
    borderRadius: 999,
    padding: "2px 8px",
    background: "#fdf2f8",
    color: "#be185d",
    fontSize: 12,
  },
  roleBadge: {
    border: "1px solid #e5e7eb",
    borderRadius: 999,
    padding: "2px 8px",
    background: "#f8fafc",
    color: "#334155",
    fontSize: 12,
  },
  partBadge: {
    border: "1px solid #cbd5e1",
    borderRadius: 999,
    padding: "2px 8px",
    background: "#fff",
    color: "#334155",
    fontSize: 12,
  },
  assignmentCount: { fontSize: 13, color: "#475569", fontWeight: 700 },
  select: {
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: "8px 10px",
    background: "#fff",
    color: "#0f172a",
  },
  unpaidBadge: {
    border: "1px solid #fecaca",
    borderRadius: 999,
    padding: "4px 10px",
    background: "#fef2f2",
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: 700,
  },
  paidBadge: {
    border: "1px solid #bbf7d0",
    borderRadius: 999,
    padding: "4px 10px",
    background: "#f0fdf4",
    color: "#15803d",
    fontSize: 12,
    fontWeight: 700,
  },
  assignmentList: { display: "grid", gap: 10, marginTop: 14 },
  assignmentItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: 12,
    background: "#f8fafc",
  },
  assignmentPart: {
    border: "1px solid #fde68a",
    borderRadius: 999,
    padding: "2px 8px",
    background: "#fffbeb",
    color: "#92400e",
    fontSize: 12,
    whiteSpace: "nowrap",
  },
  emptyBox: {
    marginTop: 20,
    padding: 20,
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    background: "#f8fafc",
  },
  emptyTitle: { margin: "0 0 6px", fontWeight: 700, color: "#334155" },
  emptyText: { margin: 0, color: "#64748b" },
  error: { color: "#dc2626", marginTop: 16 },
};
