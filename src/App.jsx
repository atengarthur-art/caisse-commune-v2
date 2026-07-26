import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import GroupDetail from "./pages/GroupDetail.jsx";
import Join from "./pages/Join.jsx";
import { t } from "./i18n";

export default function App() {
  const [session, setSession] = useState(undefined);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [langue, setLangueState] = useState("fr");

  const joinCode = window.location.pathname.startsWith("/rejoindre/")
    ? window.location.pathname.split("/rejoindre/")[1]
    : null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase.from("profiles").select("langue").eq("id", session.user.id).single()
      .then(({ data }) => { if (data && data.langue) setLangueState(data.langue); });
  }, [session]);

  const setLangue = async (l) => {
    setLangueState(l);
    if (session) await supabase.from("profiles").update({ langue: l }).eq("id", session.user.id);
  };

  if (session === undefined) {
    return <div className="app-shell"><p className="muted">{t("chargement", langue)}</p></div>;
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
          <p className="muted">{t("connecteEnTantQue", langue)} {session.user.email}</p>
        </div>
        <div className="row" style={{ width: "auto", gap: 10 }}>
          <select value={langue} onChange={(e) => setLangue(e.target.value)} style={{ width: "auto", marginBottom: 0 }}>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
          <button className="secondary" onClick={() => supabase.auth.signOut()}>{t("seDeconnecter", langue)}</button>
        </div>
      </div>

      {activeGroupId ? (
        <GroupDetail groupId={activeGroupId} onBack={() => setActiveGroupId(null)} langue={langue} />
      ) : (
        <Dashboard userId={session.user.id} onOpenGroup={setActiveGroupId} langue={langue} />
      )}
    </div>
  );
}
