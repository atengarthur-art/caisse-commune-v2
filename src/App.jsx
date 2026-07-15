import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import GroupDetail from "./pages/GroupDetail.jsx";
import Join from "./pages/Join.jsx";

export default function App() {
  const [session, setSession] = useState(undefined);
  const [activeGroupId, setActiveGroupId] = useState(null);

  const joinCode = window.location.pathname.startsWith("/rejoindre/")
    ? window.location.pathname.split("/rejoindre/")[1]
    : null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div className="app-shell"><p className="muted">Chargement…</p></div>;
  }

  if (!session) {
    return <Login />;
  }

  if (joinCode) {
    return (
      <Join
        code={joinCode}
        onDone={(groupId) => {
          window.history.replaceState({}, "", "/");
          setActiveGroupId(groupId);
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <div className="row" style={{ marginBottom: 20 }}>
        <div>
          <h1>Caisse Commune</h1>
          <p className="muted">Connecté en tant que {session.user.email}</p>
        </div>
        <button className="secondary" onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
      </div>

      {activeGroupId ? (
        <GroupDetail groupId={activeGroupId} onBack={() => setActiveGroupId(null)} />
      ) : (
        <Dashboard userId={session.user.id} onOpenGroup={setActiveGroupId} />
      )}
    </div>
  );
      }
