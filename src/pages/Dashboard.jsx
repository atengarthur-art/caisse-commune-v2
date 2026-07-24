import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const FREE_MAX_GROUPS = 3;

export default function Dashboard({ userId, onOpenGroup }) {
  const [groups, setGroups] = useState([]);
  const [visits, setVisits] = useState({});
  const [plan, setPlan] = useState("free");
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [type, setType] = useState("Association");
  const [error, setError] = useState("");

  const loadAll = async () => {
    setLoading(true);
    const [{ data: g, error: gErr }, { data: p }, { data: v }] = await Promise.all([
      supabase.from("groups").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("plan").eq("id", userId).single(),
      supabase.from("group_visits").select("*").eq("user_id", userId),
    ]);
    if (gErr) setError(gErr.message); else setGroups(g);
    if (p) setPlan(p.plan);
    const map = {};
    (v || []).forEach((row) => { map[row.group_id] = row.last_seen; });
    setVisits(map);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const ownedGroups = groups.filter((g) => g.owner_id === userId);
  const atLimit = plan === "free" && ownedGroups.length >= FREE_MAX_GROUPS;

  const isNew = (g) => {
    const lastSeen = visits[g.id];
    if (lastSeen) return new Date(g.last_activity_at) > new Date(lastSeen);
    return g.owner_id !== userId;
  };

  const createGroup = async (e) => {
    e.preventDefault();
    if (!name.trim() || atLimit) return;
    const { data: userData } = await supabase.auth.getUser();
    const { data: newGroup, error: err } = await supabase
      .from("groups")
      .insert({ name: name.trim(), type, owner_id: userId })
      .select()
      .single();
    if (err) { setError(err.message); return; }
    const displayName = userData.user.email?.split("@")[0] || "Moi";
    await supabase.from("members").insert({ group_id: newGroup.id, name: displayName, user_id: userId });
    setName("");
    loadAll();
  };

  const deleteGroup = async (id) => {
    await supabase.from("groups").delete().eq("id", id);
    loadAll();
  };

  const togglePlan = async () => {
    const newPlan = plan === "free" ? "premium" : "free";
    await supabase.from("profiles").update({ plan: newPlan }).eq("id", userId);
    loadAll();
  };

  return (
    <div>
      <div className="card row">
        <div>
          <div className="muted">Votre plan</div>
          <strong>{plan === "premium" ? "Premium" : "Gratuit"}</strong>
          {plan === "free" && <span className="muted"> ({ownedGroups.length}/{FREE_MAX_GROUPS} groupes créés)</span>}
        </div>
        <button className="secondary" onClick={togglePlan}>
          {plan === "premium" ? "Repasser en Gratuit" : "Passer Premium"}
        </button>
      </div>

      <div className="card">
        <h2>Nouveau groupe</h2>
        {atLimit ? (
          <p className="error">Limite du plan gratuit atteinte ({FREE_MAX_GROUPS} groupes). Passez Premium pour en créer davantage.</p>
        ) : (
          <form onSubmit={createGroup}>
            <label>Nom du groupe</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Tontine des amis" />
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {["Association", "Tontine", "Famille", "Colocation", "Équipe / Entreprise", "Projet ponctuel"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            {error && <p className="error">{error}</p>}
            <button type="submit">Créer le groupe</button>
          </form>
        )}
      </div>

      <div className="card">
        <h2>Vos groupes</h2>
        {loading ? (
          <p className="muted">Chargement…</p>
        ) : groups.length === 0 ? (
          <p className="muted">Aucun groupe pour l'instant. Créez-en un ci-dessus.</p>
        ) : (
          groups.map((g) => (
            <div key={g.id} className="list-item">
              <div style={{ cursor: "pointer" }} onClick={() => onOpenGroup(g.id)}>
                <strong>{g.name}</strong> {isNew(g) && <span style={{ background: "#B8894B", color: "#241B0B", fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 3, marginLeft: 6 }}>Nouveau</span>}
                <div className="muted">{g.type}{g.owner_id !== userId && " · membre"}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
    }
