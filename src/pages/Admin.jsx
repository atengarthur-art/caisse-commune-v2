import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function taskStatus(task) {
  if (!task.derniere_realisation) return { label: "Jamais réalisé", urgent: true, echeance: null };
  const d = new Date(task.derniere_realisation + "T00:00:00");
  d.setDate(d.getDate() + task.frequence_jours);
  const urgent = d < new Date();
  return { label: urgent ? "À faire" : "À jour", urgent, echeance: d.toISOString().slice(0, 10) };
}

export default function Admin({ onBack }) {
  const [tasks, setTasks] = useState([]);
  const [countries, setCountries] = useState([]);
  const [newCountry, setNewCountry] = useState("");
  const [newDevise, setNewDevise] = useState("EUR");
  const [stats, setStats] = useState({ groupes: 0, membres: 0 });

  const loadAll = async () => {
    const [{ data: t }, { data: c }, { data: g }, { data: m }] = await Promise.all([
      supabase.from("admin_tasks").select("*").order("label"),
      supabase.from("admin_countries").select("*").order("nom"),
      supabase.from("groups").select("id", { count: "exact", head: true }),
      supabase.from("members").select("id", { count: "exact", head: true }),
    ]);
    setTasks(t || []);
    setCountries(c || []);
    setStats({ groupes: g?.length ?? 0, membres: m?.length ?? 0 });
  };

  useEffect(() => { loadAll(); }, []);

  const markDone = async (id) => {
    await supabase.from("admin_tasks").update({ derniere_realisation: new Date().toISOString().slice(0, 10) }).eq("id", id);
    loadAll();
  };

  const addCountry = async () => {
    if (!newCountry.trim()) return;
    await supabase.from("admin_countries").insert({ nom: newCountry.trim(), devise: newDevise, statut: "à vérifier" });
    setNewCountry("");
    loadAll();
  };

  const removeCountry = async (id) => {
    await supabase.from("admin_countries").delete().eq("id", id);
    loadAll();
  };

  const toggleStatut = async (c) => {
    const nouveau = c.statut === "à jour" ? "à vérifier" : "à jour";
    await supabase.from("admin_countries").update({ statut: nouveau }).eq("id", c.id);
    loadAll();
  };

  const overdueCount = tasks.filter((t) => taskStatus(t).urgent).length;

  return (
    <div className="app-shell">
      <a className="link" onClick={onBack}>← Retour à l'application</a>
      <h1 style={{ marginTop: 10 }}>Administration &amp; Conformité</h1>
      <p className="muted" style={{ marginBottom: 20 }}>Espace réservé. Les rappels sont automatiques ; les décisions restent humaines.</p>

      <div className="card row">
        <div><div className="muted">Groupes</div><strong>{stats.groupes}</strong></div>
        <div><div className="muted">Membres</div><strong>{stats.membres}</strong></div>
        <div><div className="muted">Tâches en retard</div><strong style={{ color: overdueCount > 0 ? "#A23E32" : "inherit" }}>{overdueCount}</strong></div>
      </div>

      <div className="card">
        <h2>Tâches de conformité récurrentes</h2>
        {tasks.map((task) => {
          const s = taskStatus(task);
          return (
            <div key={task.id} className="list-item">
              <div>
                <div>{task.label}</div>
                <div className="muted">
                  Tous les {task.frequence_jours} j · Dernière fois : {task.derniere_realisation || "jamais"}
                  {s.echeance && ` · échéance ${s.echeance}`}
                </div>
              </div>
              <div className="row" style={{ gap: 10, width: "auto" }}>
                <span style={{ color: s.urgent ? "#A23E32" : "#1F5C4E", fontWeight: 600, fontSize: 13 }}>{s.label}</span>
                <button className="secondary" onClick={() => markDone(task.id)}>Fait aujourd'hui</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <h2>Registre des pays</h2>
        {countries.map((c) => (
          <div key={c.id} className="list-item">
            <div>{c.nom} <span className="muted">· {c.devise}</span></div>
            <div className="row" style={{ gap: 10, width: "auto" }}>
              <button className="secondary" onClick={() => toggleStatut(c)}>{c.statut}</button>
              <button className="danger" onClick={() => removeCountry(c.id)}>Retirer</button>
            </div>
          </div>
        ))}
        <div className="row" style={{ marginTop: 12, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <input placeholder="Ajouter un pays" value={newCountry} onChange={(e) => setNewCountry(e.target.value)} />
          </div>
          <select value={newDevise} onChange={(e) => setNewDevise(e.target.value)} style={{ width: "auto" }}>
            {["EUR", "USD", "XOF", "XAF", "GBP", "CAD", "MAD", "NGN", "GHS", "CHF"].map((d) => <option key={d}>{d}</option>)}
          </select>
          <button onClick={addCountry}>Ajouter</button>
        </div>
      </div>
    </div>
  );
}
