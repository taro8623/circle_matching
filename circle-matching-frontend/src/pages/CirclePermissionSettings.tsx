import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

type PermissionMember = {
  user_id: string;
  user_name: string;
  role: string;
};

type PermissionAssignee = {
  user_id: string;
  user_name: string;
  is_owner: boolean;
  is_explicit: boolean;
};

type PermissionItem = {
  key: string;
  label: string;
  description?: string | null;
  assigned_users: PermissionAssignee[];
};

type PermissionSettingsResponse = {
  circle_id: string;
  current_user_id: string;
  current_user_permissions: string[];
  members: PermissionMember[];
  permissions: PermissionItem[];
};

export default function CirclePermissionSettings() {
  const { circleId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<PermissionSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");

  const reload = async () => {
    if (!circleId) return;
    setLoading(true);
    try {
      const response = await api.get<PermissionSettingsResponse>(`/circles/${circleId}/permission-settings`);
      setData(response);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circleId]);

  const currentUserPermissions = useMemo(
    () => new Set(data?.current_user_permissions || []),
    [data]
  );

  const togglePermission = async (permissionKey: string, userId: string, enabled: boolean) => {
    if (!circleId) return;
    setBusyKey(`${permissionKey}:${userId}`);
    setError("");
    try {
      await api.patch(`/circles/${circleId}/permissions/${permissionKey}`, {
        user_id: userId,
        enabled,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setBusyKey("");
    }
  };

  if (loading) return <div style={styles.page}>読み込み中...</div>;
  if (error && !data) return <div style={styles.page}><p style={styles.error}>{error}</p></div>;
  if (!data) return null;

  return (
    <main style={styles.page}>
      <button onClick={() => navigate(`/circles/${circleId}`)}>戻る</button>
      <h1 style={styles.h1}>権限付与設定</h1>
      <p style={styles.meta}>
        ライブ運営まわりの権限をタスクごとに個別付与できます。代表者は常に全権限を持ちます。
      </p>
      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.permissionGrid}>
        {data.permissions.map((permission) => {
          const assignedIds = new Set(permission.assigned_users.map((user) => user.user_id));
          const canGrant = currentUserPermissions.has("grant_circle_permissions");
          const canRevoke = currentUserPermissions.has("revoke_circle_permissions");

          return (
            <section key={permission.key} style={styles.card}>
              <h2 style={styles.h2}>{permission.label}</h2>
              {permission.description && <p style={styles.meta}>{permission.description}</p>}

              <div style={styles.currentSection}>
                <div style={styles.sectionLabel}>現在この権限を持つメンバー</div>
                {permission.assigned_users.length === 0 ? (
                  <p style={styles.empty}>まだいません</p>
                ) : (
                  <div style={styles.chipRow}>
                    {permission.assigned_users.map((user) => (
                      <span key={user.user_id} style={styles.chip}>
                        {user.user_name}
                        {user.is_owner ? "（代表）" : user.is_explicit ? "" : "（自動）"}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div style={styles.sectionLabel}>メンバーごとの設定</div>
              <div style={styles.memberList}>
                {data.members.map((member) => {
                  const assigned = assignedIds.has(member.user_id) || member.role === "owner";
                  const isOwner = member.role === "owner";
                  const actionKey = `${permission.key}:${member.user_id}`;

                  return (
                    <div key={member.user_id} style={styles.memberRow}>
                      <div>
                        <strong>{member.user_name}</strong>
                        {isOwner && <span style={styles.ownerLabel}>代表</span>}
                      </div>
                      <div style={styles.memberActions}>
                        <span style={assigned ? styles.enabledText : styles.disabledText}>
                          {assigned ? "付与中" : "未付与"}
                        </span>
                        {!isOwner && !assigned && canGrant && (
                          <button
                            type="button"
                            style={styles.primaryButton}
                            disabled={busyKey === actionKey}
                            onClick={() => togglePermission(permission.key, member.user_id, true)}
                          >
                            与える
                          </button>
                        )}
                        {!isOwner && assigned && canRevoke && (
                          <button
                            type="button"
                            style={styles.secondaryButton}
                            disabled={busyKey === actionKey}
                            onClick={() => togglePermission(permission.key, member.user_id, false)}
                          >
                            外す
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { width: "min(980px, calc(100vw - 32px))", margin: "32px auto", textAlign: "left" },
  h1: { fontSize: 28, margin: "20px 0 8px" },
  h2: { margin: "0 0 8px", fontSize: 18 },
  meta: { color: "#64748b", marginTop: 0, lineHeight: 1.5 },
  error: { color: "#dc2626" },
  permissionGrid: { display: "grid", gap: 16, marginTop: 20 },
  card: { border: "1px solid #dbeafe", borderRadius: 12, padding: 16, background: "#fff" },
  currentSection: { marginTop: 12, marginBottom: 16 },
  sectionLabel: { fontSize: 12, fontWeight: "bold", color: "#475569", marginBottom: 8 },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 999,
    padding: "4px 10px",
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 13,
  },
  memberList: { display: "grid", gap: 10 },
  memberRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: "12px 0",
    borderTop: "1px solid #e2e8f0",
  },
  memberActions: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  ownerLabel: {
    marginLeft: 8,
    fontSize: 12,
    color: "#991b1b",
    background: "#fee2e2",
    borderRadius: 999,
    padding: "2px 8px",
  },
  enabledText: { color: "#166534", fontWeight: "bold", fontSize: 13 },
  disabledText: { color: "#64748b", fontSize: 13 },
  primaryButton: {
    border: "1px solid #2563eb",
    borderRadius: 6,
    padding: "8px 12px",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    padding: "8px 12px",
    background: "#fff",
    color: "#0f172a",
    cursor: "pointer",
  },
  empty: { color: "#64748b", margin: 0 },
};
