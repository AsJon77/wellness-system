import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import { supabase } from "./supabase";

import TherapistTable from "./components/TherapistTable";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

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

      {/* MAIN */}
      <Route
        path="/"
        element={user ? <TherapistTable /> : <Navigate to="/login" />}
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
