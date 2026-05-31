import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function CircleRegister() {
  const navigate = useNavigate();

  const [circleId, setCircleId] = useState("");
  const [circlePassword, setCirclePassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log("サークル登録:", { circleId, circlePassword });
    // 後で FastAPI と接続する
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>サークル登録</h2>

      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>サークルID</label>
        <input
          type="text"
          value={circleId}
          onChange={(e) => setCircleId(e.target.value)}
          style={styles.input}
          required
        />

        <label style={styles.label}>サークル登録パスワード</label>
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
