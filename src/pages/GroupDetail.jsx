import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function sum(arr) { return arr.reduce((a, b) => a + b, 0); }

export default function GroupDetail({ groupId, onBack }) {
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [cotisations, setCotisations] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [memberName, setMemberName] = useState("");
  const [cotMemberId, setCotMemberId] = useState("");
  const [cotMontant, setCotMontant] = useState("");
  const [depLibelle, setDepLibelle] = useState("");
  const [depMontant, setDepMontant] = useState("");
  const [error, setError] = useState("");

  const loadAll = async () => {
    const [{ data: g }, { data: m }, { data: c }, { data: d }] = await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).single(),
      supabase.from("members").select("*").eq("group_id", groupId).order("created_at"),
      supabase.from("cotisations").select("*").eq("group_id", groupId).order("date", { ascending: false }),
      supabase.from("depenses").select("*").eq("group_id", groupId).order("date", { ascending: false }),
    ]);
    setGroup(g); setMembers(m || []); setCotisations(c || []); setDepenses(d || []);
    if (!cotMemberId && m && m[0]) setCotMemberId(m[0].id);
  };

  useEffect(() => { loadAll(); }, [groupId]);

  const addMember = async (e) => {
    e.preventDefault();
    if (!memberName.trim()) return;
    const { error: err } = await supabase.from("members").insert({ group_id: groupId, name: memberName.trim() });
    if (err) setError(err.message);
    setMemberName("");
    loadAll();
  };

  const addCotisation = async (e) => {
    e.preventDefault();
    const montant = parseFloat(cotMontant);
    if (!cotMemberId || !montant || montant <= 0) return;
    const { error: err } = await supabase.from("cotisations").insert({ group_id: groupId, member_id: cotMemberId, montant });
    if (err) setError(err.message);
    setCotMontant("");
    loadAll();
  };

  const addDepense = async (e) => {
    e.preventDefault();
    const montant = parseFloat(depMontant);
    if (!depLibelle.trim() || !montant || montant <= 0) return;
    const { error: err } = await supabase.from("depenses").insert({ group_id: groupId, libelle: depLibelle.trim(), montant });
    if (err) setError(err.message);
    setDepLibelle(""); setDepMontant("");
    loadAll();
  };

  if (!group) return <p className="muted">Chargement du groupe…</p>;

  const totalCotise = sum(cotisations.map((c) => c.montant));
  const totalDepense = sum(depenses.map((d) => d.montant));
  const solde = totalCotise - totalDepense;

  return (
    <div>
      <a className="link" onClick={onBack}>&larr; Retour aux groupes</a>
      <h1 style={{ marginTop: 10 }}>{group.name}</h1>
      <p className="muted" style={{ marginBottom: 16 }}>{group.type}</p>
      {error && <p className="error">{error}</p>}

      <div className="card row">
        <div><div className="muted">Total cotisé</div><div className="money pos">{totalCotise.toLocaleString("fr-FR")} €</div></div>
        <div><div className="muted">Total dépensé</div><div className="money neg">{totalDepense.toLocaleString("fr-FR")} €</div></div>
        <div><div className="muted">Solde caisse</div><div className="money pos">{solde.toLocaleString("fr-FR")} €</div></div>
      </div>

      <div className="card">
        <h2>Membres</h2>
        <form onSubmit={addMember} className="row" style={{ alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}><input placeholder="Nom du membre" value={memberName} onChange={(e) => setMemberName(e.target.value)} /></div>
          <button type="submit">Ajouter</button>
        </form>
        {members.map((m) => <div key={m.id} className="list-item"><span>{m.name}</span></div>)}
      </div>

      <div className="card">
        <h2>Cotisations</h2>
        {members.length === 0 ? <p className="muted">Ajoutez d'abord un membre.</p> : (
          <form onSubmit={addCotisation}>
            <label>Membre</label>
            <select value={cotMemberId} onChange={(e) => setCotMemberId(e.target.value)}>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <label>Montant</label>
            <input type="number" min="0" step="any" value={cotMontant} onChange={(e) => setCotMontant(e.target.value)} />
            <button type="submit">Enregistrer la cotisation</button>
          </form>
        )}
        {cotisations.map((c) => {
          const m = members.find((x) => x.id === c.member_id);
          return <div key={c.id} className="list-item"><span>{m?.name || "—"} · {c.date}</span><span className="money pos">+{c.montant}</span></div>;
        })}
      </div>

      <div className="card">
        <h2>Dépenses</h2>
        <form onSubmit={addDepense}>
          <label>Libellé</label>
          <input value={depLibelle} onChange={(e) => setDepLibelle(e.target.value)} placeholder="ex. Location salle" />
          <label>Montant</label>
          <input type="number" min="0" step="any" value={depMontant} onChange={(e) => setDepMontant(e.target.value)} />
          <button type="submit">Enregistrer la dépense</button>
        </form>
        {depenses.map((d) => (
          <div key={d.id} className="list-item"><span>{d.libelle} · {d.date}</span><span className="money neg">-{d.montant}</span></div>
        ))}
      </div>
    </div>
  );
      }
