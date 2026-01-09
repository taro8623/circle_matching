import { useState } from "react";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userName, setUserName] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const res = await fetch("http://localhost:8000/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: userName, // ← ここを修正
        email,
        password,
      }),
    });

    if (res.ok) {
      alert("登録成功");
      window.location.href = "/login";
    } else {
      alert("登録失敗");
    }
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>登録</h2>

      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>メールアドレス</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
          required
        />

        <label style={styles.label}>パスワード</label>
        <input
          type="password"
          value={password}
          autoComplete="new-password"
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
          required
        />

        <label style={styles.label}>ユーザ名</label>
        <input
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          style={styles.input}
        />

        <button type="submit" style={styles.button}>
          登録する
        </button>
      </form>

      <p style={styles.linkText}>
        すでに登録済みの方は <a href="/login">ログイン</a>
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
