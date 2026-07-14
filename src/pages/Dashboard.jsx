import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const FREE_MAX_GROUPS = 3;

export default function Dashboard({ userId, onOpenGroup }) {
  const [groups, setGroups] = useState([]);
  const [plan, setPlan] = useState("free");
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [type, setType] = useState("Association");
  const [error, setError] = useState("");

  const loadAll = async () => {
    setLoading(true);
    const [{ data: g, error: gErr }, { data: p }] = await Promise.all([
      supabase.from("groups").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("plan").eq("id", userId).single(),
    ]);
    if (gErr) setError(gErr.message); else setGroups(g);
    if (p) setPlan(p.plan);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const atLimit = plan === "free" && groups.length >= FREE_MAX_GROUPS;

  const createGroup = async (e) => {
    e.preventDefault();
    if (!name.trim() || atLimit) return;
    const { error: err } = await supabase.from("groups").insert({ name: name.trim(), type, owner_id: userId });
    if (err) { setError(err.message); return; }
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
          {plan === "free" && <span className="muted"> ({groups.length}/{FREE_MAX_GROUPS} groupes)</span>}
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
                <strong>{g.name}</strong>
                <div className="muted">{g.type}</div>
              </div>
              <button className="danger" onClick={() => deleteGroup(g.id)}>Supprimer</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
    }
