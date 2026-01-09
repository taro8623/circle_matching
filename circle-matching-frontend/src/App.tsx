import { BrowserRouter, Routes, Route } from "react-router-dom";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import CircleRegister from "./pages/CircleRegister";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<CircleRegister />} />
      </Routes>
    </BrowserRouter>
  );
}
