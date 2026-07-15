import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function Join({ code, onDone }) {
  const [status, setStatus] = useState("loading");
  const [groupName, setGroupName] = useState("");
  const [nameInput, setNameInput] = useState("");

  useEffect(() => {
    const run = async () => {
      const { data: groups, error: gErr } = await supabase
        .from("groups")
        .select("id, name, type")
        .eq("join_code", code)
        .limit(1);
      if (gErr || !groups || groups.length === 0) { setStatus("notfound"); return; }
      setGroupName(groups[0].name);
      setStatus("ready");
      window._joinGroupId = groups[0].id;
    };
    run();
  }, [code]);

  const join = async (e) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    const { error: err } = await supabase.from("members").insert({
      group_id: window._joinGroupId,
      name: nameInput.trim(),
      user_id: userData.user.id,
    });
    if (err) { setStatus("error"); return; }
    onDone(window._joinGroupId);
  };

  if (status === "loading") return <div className="app-shell"><p className="muted">Vérification du lien…</p></div>;
  if (status === "notfound") return <div className="app-shell"><p className="error">Ce lien d'invitation n'est plus valide.</p></div>;
  if (status === "error") return <div className="app-shell"><p className="error">Une erreur est survenue. Réessayez.</p></div>;

  return (
    <div className="app-shell" style={{ maxWidth: 380, paddingTop: 80 }}>
      <h1>Rejoindre {groupName}</h1>
      <p className="muted" style={{ marginBottom: 20 }}>Entrez votre nom pour rejoindre ce groupe.</p>
      <form onSubmit={join} className="card">
        <label>Votre nom</label>
        <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="Votre nom" autoFocus />
        <button type="submit" style={{ width: "100%" }}>Rejoindre le groupe</button>
      </form>
    </div>
  );
}
