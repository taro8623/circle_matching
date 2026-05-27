import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import NotificationButton from "../components/NotificationButton";
import { api } from "../api";

const PART_OPTIONS = ["Vo", "Gt", "Ba", "Dr", "Key", "Cho", "Other"];

type MeResponse = {
  name: string;
  parts: string[];
  bio?: string | null;
};

type CircleSummary = {
  id: string;
  name: string;
};

export default function MePage() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [circles, setCircles] = useState<CircleSummary[]>([]);
  const [parts, setParts] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [customPart, setCustomPart] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [me, myCircles] = await Promise.all([
          api.get<MeResponse>("/me"),
          api.get<CircleSummary[]>("/me/circles"),
        ]);
        setUserName(me.name || "");
        setParts(Array.isArray(me.parts) ? me.parts : []);
        setBio(me.bio ?? "");
        setCircles(Array.isArray(myCircles) ? myCircles : []);
      } catch {
        setError("プロフィール取得に失敗しました");
      }
    };

    load();
  }, []);

  const togglePart = (part: string) => {
    setParts((current) =>
      current.includes(part) ? current.filter((item) => item !== part) : [...current, part]
    );
  };

  const addCustomPart = () => {
    const part = customPart.trim();
    if (!part || parts.includes(part)) return;
    setParts((current) => [...current, part]);
    setCustomPart("");
  };

  const saveProfile = async () => {
    setProfileMessage("");
    setError("");
    const normalizedBio = bio.trim();

    if (!normalizedBio) {
      setError("自己紹介は必須です。メンバー検索時にも表示されます。");
      return;
    }

    try {
      setSaving(true);
      const [profile, partsResponse] = await Promise.all([
        api.put<MeResponse>("/me/profile", { bio: normalizedBio }),
        api.put<{ parts: string[] }>("/me/parts", { parts }),
      ]);
      setBio(profile.bio ?? normalizedBio);
      setParts(partsResponse.parts || parts);
      setProfileMessage("プロフィールを保存しました");
    } catch (err) {
      setError(err instanceof Error ? err.message : "プロフィールの保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2>{userName || "..."} さんのプロフィール</h2>
        <NotificationButton />
      </div>
      <hr />
      <h3>自己紹介 <span style={{ color: "#dc2626" }}>*必須</span></h3>
      <p style={{ color: "#6b7280", marginTop: 0 }}>
        ここに書いた内容は、他のメンバーがメンバー一覧を見るときにも表示されます。
      </p>
      <textarea
        value={bio}
        onChange={(event) => setBio(event.target.value)}
        placeholder="担当パート、好きなジャンル、やりたい曲の方向性などを書いてください"
        rows={5}
        style={{ width: "100%", maxWidth: 640, padding: "10px 12px", marginBottom: 16 }}
      />
      <h3>担当パート</h3>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        {PART_OPTIONS.map((part) => (
          <label
            key={part}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: "8px 10px",
              background: "#fff",
            }}
          >
            <input
              type="checkbox"
              checked={parts.includes(part)}
              onChange={() => togglePart(part)}
            />
            {part}
          </label>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          value={customPart}
          onChange={(event) => setCustomPart(event.target.value)}
          placeholder="自由入力パート"
          style={{ padding: "8px 10px" }}
        />
        <button type="button" onClick={addCustomPart}>
          追加
        </button>
      </div>
      {parts.length > 0 && <p>選択中: {parts.join(", ")}</p>}
      <button type="button" onClick={saveProfile} disabled={saving}>
        {saving ? "保存中..." : "プロフィールを保存"}
      </button>
      {profileMessage && <div style={{ color: "green", marginTop: 8 }}>{profileMessage}</div>}
      <hr />
      <h3>参加サークル</h3>
      {error && <div style={{ color: "red" }}>{error}</div>}
      <ul>
        {circles.length === 0 ? (
          <li>参加サークルはありません</li>
        ) : (
          circles.map((circle) => (
            <li key={circle.id}>
              <button
                type="button"
                onClick={() => navigate(`/circles/${circle.id}`)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#2563eb",
                  padding: 0,
                  textDecoration: "underline",
                }}
              >
                {circle.name}
              </button>
            </li>
          ))
        )}
      </ul>
      <button onClick={() => navigate("/circle/join")}>＋ 新規サークル参加</button>
      <br />
      <button onClick={() => navigate("/circle/create")}>＋ 新規サークル作成</button>
      <hr style={{ margin: "20px 0" }} />
      <button onClick={handleLogout} style={{ color: "red" }}>
        ログアウト
      </button>
    </div>
  );
}
