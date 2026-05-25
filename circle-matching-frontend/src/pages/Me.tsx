import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import NotificationButton from "../components/NotificationButton";

const PART_OPTIONS = ["Vo", "Gt", "Ba", "Dr", "Key", "Cho", "Other"];

export default function MePage() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [circles, setCircles] = useState<any[]>([]);
  const [parts, setParts] = useState<string[]>([]);
  const [customPart, setCustomPart] = useState("");
  const [partsMessage, setPartsMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    fetch("http://localhost:8001/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.name) setUserName(data.name);
        if (Array.isArray(data.parts)) {
          setParts(data.parts);
        }
      })
      .catch(() => setError("プロフィール取得に失敗しました"));

    fetch("http://localhost:8001/me/circles", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCircles(data);
        } else if (data.circles) {
          setCircles(data.circles);
        } else {
          setError("サークル一覧の取得に失敗しました");
        }
      })
      .catch(() => setError("サークル一覧の取得に失敗しました"));
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

  const saveParts = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setPartsMessage("");
    setError("");

    try {
      const res = await fetch("http://localhost:8001/me/parts", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ parts }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.detail || "担当パートの保存に失敗しました");
      }
      setParts(data.parts || parts);
      setPartsMessage("担当パートを保存しました");
    } catch (err) {
      setError(err instanceof Error ? err.message : "担当パートの保存に失敗しました");
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
      <button type="button" onClick={saveParts}>
        担当パートを保存
      </button>
      {partsMessage && <div style={{ color: "green", marginTop: 8 }}>{partsMessage}</div>}
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
