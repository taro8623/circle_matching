import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import CircleJoin from "./pages/CircleJoin";
import Me from "./pages/Me";
import ProtectedRoute from "./components/ProtectedRoute";
import CreateCirclePage from "./pages/CreateCircles";
import Home from "./pages/Home";
import CircleDetail from "./pages/CircleDetail";
import SongCreate from "./pages/SongCreate";
import SongDetail from "./pages/SongDetail";
import SongChat from "./pages/SongChat";
import LiveEvents from "./pages/LiveEvents";
import Notifications from "./pages/Notifications";
import CircleMembers from "./pages/CircleMembers";
import CircleParticipationHistory from "./pages/CircleParticipationHistory";
import CirclePermissionSettings from "./pages/CirclePermissionSettings";
import CircleAdminActionLogs from "./pages/CircleAdminActionLogs";
import CircleParticipationPlans from "./pages/CircleParticipationPlans";
import CircleRequestManagement from "./pages/CircleRequestManagement";
import CircleChats from "./pages/CircleChats";
import CircleBI from "./pages/CircleBI";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />

        <Route path="/circle/create" element={<CreateCirclePage />} />
        <Route path="/circle/join" element={<CircleJoin />} />

        <Route path="/circles/:circleId" element={<ProtectedRoute><CircleDetail /></ProtectedRoute>} />
        <Route path="/circles/:circleId/songs/new" element={<ProtectedRoute><SongCreate /></ProtectedRoute>} />
        <Route path="/circles/:circleId/live-events" element={<ProtectedRoute><LiveEvents /></ProtectedRoute>} />
        <Route path="/circles/:circleId/request-management" element={<ProtectedRoute><CircleRequestManagement /></ProtectedRoute>} />
        <Route path="/circles/:circleId/chats" element={<ProtectedRoute><CircleChats /></ProtectedRoute>} />
        <Route path="/circles/:circleId/bi" element={<ProtectedRoute><CircleBI /></ProtectedRoute>} />
        <Route path="/circles/:circleId/participation-plans" element={<ProtectedRoute><CircleParticipationPlans /></ProtectedRoute>} />
        <Route path="/circles/:circleId/participation-history" element={<ProtectedRoute><CircleParticipationHistory /></ProtectedRoute>} />
        <Route path="/circles/:circleId/members" element={<ProtectedRoute><CircleMembers /></ProtectedRoute>} />
        <Route path="/circles/:circleId/permission-settings" element={<ProtectedRoute><CirclePermissionSettings /></ProtectedRoute>} />
        <Route path="/circles/:circleId/admin-action-logs" element={<ProtectedRoute><CircleAdminActionLogs /></ProtectedRoute>} />

        <Route path="/songs/:songId" element={<ProtectedRoute><SongDetail /></ProtectedRoute>} />
        <Route path="/songs/:songId/chat" element={<ProtectedRoute><SongChat /></ProtectedRoute>} />

        <Route path="/me" element={<ProtectedRoute><Me /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
