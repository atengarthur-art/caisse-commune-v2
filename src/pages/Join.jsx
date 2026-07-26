import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function Join({ code, onDone }) {
  const [status, setStatus] = useState("loading");
  const [groupName, setGroupName] = useState("");
  const [groupId, setGroupId] = useState(null);
  const [existingMembership, setExistingMembership] = useState(null);
  const [nameInput, setNameInput] = useState("");

  useEffect(() => {
    const run = async () => {
      const { data, error: err } = await supabase.rpc("get_group_by_code", { code });
      if (err || !data || data.length === 0) { setStatus("notfound"); return; }
      const gid = data[0].id;
      setGroupName(data[0].name);
      setGroupId(gid);

      const { data: userData } = await supabase.auth.getUser();
      const { data: existing } = await supabase
        .from("members")
        .select("*")
        .eq("group_id", gid)
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (existing && existing.active) {
        onDone(gid);
        return;
      }
      setExistingMembership(existing || null);
      setNameInput(existing ? existing.name : "");
      setStatus("ready");
    };
    run();
  }, [code]);

  const join = async (e) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    const { data: userData } = await supabase.auth.getUser();

    if (existingMembership) {
      const { error: err } = await supabase
        .from("members")
        .update({ active: true, left_at: null, name: nameInput.trim() })
        .eq("id", existingMembership.id);
      if (err) { setStatus("error"); return; }
    } else {
      const { error: err } = await supabase.from("members").insert({
        group_id: groupId,
        name: nameInput.trim(),
        user_id: userData.user.id,
      });
      if (err) { setStatus("error"); return; }
    }
    onDone(groupId);
  };

  if (status === "loading") return <div className="app-shell"><p className="muted">Vérification du lien…</p></div>;
  if (status === "notfound") return <div className="app-shell"><p className="error">Ce lien d'invitation n'est plus valide.</p></div>;
  if (status === "error") return <div className="app-shell"><p className="error">Une erreur est survenue. Réessayez.</p></div>;

  return (
    <div className="app-shell" style={{ maxWidth: 380, paddingTop: 80 }}>
      <h1>{existingMembership ? "Rejoindre à nouveau" : "Rejoindre"} {groupName}</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        {existingMembership ? "Vous aviez quitté ce groupe. Confirmez votre nom pour le rejoindre à nouveau." : "Entrez votre nom pour rejoindre ce groupe."}
      </p>
      <form onSubmit={join} className="card">
        <label>Votre nom</label>
        <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="Votre nom" autoFocus />
        <button type="submit" style={{ width: "100%" }}>{existingMembership ? "Rejoindre à nouveau" : "Rejoindre le groupe"}</button>
      </form>
    </div>
  );
    }
