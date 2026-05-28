import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function CircleJoin() {
  const navigate = useNavigate();
  const [circleName, setCircleName] = useState("");
  const [circlePassword, setCirclePassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      const data = await api.post<{ message: string; circle_id: string }>("/circles/join", {
        circle_name: circleName.trim(),
        join_password: circlePassword,
      });
      setMessage(data.message);
      navigate(`/circles/${data.circle_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "サークル参加に失敗しました");
    }
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>サークル参加</h2>
      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>サークル名</label>
        <input
          type="text"
          value={circleName}
          onChange={(e) => setCircleName(e.target.value)}
          placeholder="例: Circle Matching Demo"
          style={styles.input}
          required
        />
        <label style={styles.label}>サークル参加パスワード</label>
        <input
          type="password"
          value={circlePassword}
          onChange={(e) => setCirclePassword(e.target.value)}
          style={styles.input}
          required
        />
        <button type="submit" style={styles.button}>
          参加する
        </button>
      </form>
      {message && <div style={{ color: "green", marginTop: 10 }}>{message}</div>}
      {error && <div style={{ color: "red", marginTop: 10 }}>{error}</div>}
      <p style={styles.linkText}>
        <span onClick={() => navigate(-1)} style={{ cursor: "pointer" }}>
          前のページに戻る
        </span>
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "400px",
    margin: "40px auto",
    padding: "20px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    background: "#fff",
  },
  title: {
    textAlign: "center",
    marginBottom: "20px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  label: {
    fontWeight: "bold",
  },
  input: {
    padding: "10px",
    borderRadius: "4px",
    border: "1px solid #ccc",
  },
  button: {
    marginTop: "10px",
    padding: "12px",
    background: "#007bff",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  linkText: {
    marginTop: "20px",
    textAlign: "center",
  },
};
