import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function Dashboard({ userId, onOpenGroup }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [type, setType] = useState("Association");
  const [error, setError] = useState("");

  const loadGroups = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("groups")
      .select("*")
      .order("created_at", { ascending: false });
    if (err) setError(err.message); else setGroups(data);
    setLoading(false);
  };

  useEffect(() => { loadGroups(); }, []);

  const createGroup = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const { error: err } = await supabase.from("groups").insert({ name: name.trim(), type, owner_id: userId });
    if (err) { setError(err.message); return; }
    setName("");
    loadGroups();
  };

  const deleteGroup = async (id) => {
    await supabase.from("groups").delete().eq("id", id);
    loadGroups();
  };

  return (
    <div>
      <div className="card">
        <h2>Nouveau groupe</h2>
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
