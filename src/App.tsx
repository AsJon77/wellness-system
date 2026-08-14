import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import { supabase } from "./supabase";

import TherapistTable from "./components/TherapistTable";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import MemberPage from "./pages/MemberPage";
import History from "./pages/History";
import Orders from "./pages/Orders";

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();

      setUser(data.user);

      setLoading(false);
    };

    getUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      },
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Routes>
      {/* LOGIN */}
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />

      {/* HOME */}
      <Route path="/" element={user ? <Home /> : <Navigate to="/login" />} />

      {/* DAILY SYSTEM (therapist table) */}
      <Route
        path="/daily"
        element={user ? <TherapistTable /> : <Navigate to="/login" />}
      />

      {/* MEMBER */}
      <Route
        path="/members"
        element={user ? <MemberPage /> : <Navigate to="/login" />}
      />

      {/* HISTORY */}
      <Route
        path="/history"
        element={user ? <History /> : <Navigate to="/login" />}
      />

      {/* ORDERS */}
      <Route
        path="/orders"
        element={user ? <Orders /> : <Navigate to="/login" />}
      />

      {/* DASHBOARD */}
      <Route
        path="/dashboard"
        element={user ? <Dashboard /> : <Navigate to="/login" />}
      />
    </Routes>
  );
}

export default App;
