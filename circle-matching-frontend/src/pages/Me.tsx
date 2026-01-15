import React, { useEffect, useState } from "react";

export default function Me() {
  type User = { name: string; email: string };
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("未ログインです");
      return;
    }
    fetch("http://localhost:8001/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("ユーザ情報取得失敗");
        return res.json();
      })
      .then((data) => setUser(data))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div>{error}</div>;
  if (!user) return <div>読み込み中...</div>;

  return (
    <div>
      <h2>ユーザ情報</h2>
      <p>名前: {user.name}</p>
      <p>メール: {user.email}</p>
      <button onClick={() => {
        localStorage.removeItem("token");
        window.location.href = "/login";
      }}>ログアウト</button>
    </div>
  );
}
