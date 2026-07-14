import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function sum(arr) { return arr.reduce((a, b) => a + b, 0); }

const TYPE_LABEL = { cotisation: "Cotisation", depense: "Dépense (caisse)", avance: "Avance membre", remboursement: "Remboursement" };

function buildJournal(cotisations, depenses, members) {
  const entries = [];
  cotisations.forEach((c) => {
    const m = members.find((x) => x.id === c.member_id);
    entries.push({ id: "c-" + c.id, date: c.date, type: "cotisation", libelle: "Cotisation — " + (m?.name || "—"), montant: c.montant });
  });
  depenses.forEach((d) => {
    if (!d.source) {
      entries.push({ id: "d-" + d.id, date: d.date, type: "depense", libelle: d.libelle, montant: -d.montant });
    } else {
      const m = members.find((x) => x.id === d.source);
      entries.push({ id: "a-" + d.id, date: d.date, type: "avance", libelle: "Avance — " + d.libelle + " (" + (m?.name || "—") + ")", montant: 0 });
      if (d.rembourse) {
        entries.push({ id: "r-" + d.id, date: d.remboursement_date || d.date, type: "remboursement", libelle: "Remboursement — " + d.libelle + " (" + (m?.name || "—") + ")", montant: -d.montant });
      }
    }
  });
  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let running = 0;
  return entries.map((e) => { running += e.montant; return { ...e, solde: running }; });
}

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
  const [depSource, setDepSource] = useState("");
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
    const { error: err } = await supabase.from("depenses").insert({
      group_id: groupId,
      libelle: depLibelle.trim(),
      montant,
      source: depSource || null,
      rembourse: false,
    });
    if (err) setError(err.message);
    setDepLibelle(""); setDepMontant(""); setDepSource("");
    loadAll();
  };

  const toggleRembourse = async (d) => {
    const { error: err } = await supabase.from("depenses").update({
      rembourse: !d.rembourse,
      remboursement_date: !d.rembourse ? new Date().toISOString().slice(0, 10) : null,
    }).eq("id", d.id);
    if (err) setError(err.message);
    loadAll();
  };

  if (!group) return <p className="muted">Chargement du groupe…</p>;

  const totalCotise = sum(cotisations.map((c) => c.montant));
  const totalDepenseCaisse = sum(depenses.filter((d) => !d.source).map((d) => d.montant));
  const totalRembourse = sum(depenses.filter((d) => d.source && d.rembourse).map((d) => d.montant));
  const totalARembourser = sum(depenses.filter((d) => d.source && !d.rembourse).map((d) => d.montant));
  const soldeCaisse = totalCotise - totalDepenseCaisse - totalRembourse;
  const journal = buildJournal(cotisations, depenses, members).reverse();

  return (
    <div>
      <a className="link" onClick={onBack}>&larr; Retour aux groupes</a>
      <h1 style={{ marginTop: 10 }}>{group.name}</h1>
      <p className="muted" style={{ marginBottom: 16 }}>{group.type}</p>
      {error && <p className="error">{error}</p>}

      <div className="card row">
        <div><div className="muted">Total cotisé</div><div className="money pos">{totalCotise.toLocaleString("fr-FR")} €</div></div>
        <div><div className="muted">Solde caisse</div><div className="money pos">{soldeCaisse.toLocaleString("fr-FR")} €</div></div>
        <div><div className="muted">À rembourser</div><div className="money neg">{totalARembourser.toLocaleString("fr-FR")} €</div></div>
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
          <label>Payé par</label>
          <select value={depSource} onChange={(e) => setDepSource(e.target.value)}>
            <option value="">La caisse</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name} (avance)</option>)}
          </select>
          <button type="submit">Enregistrer la dépense</button>
        </form>
        <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
          « Avance » = un membre a payé de sa poche. Le montant lui est dû tant qu'il n'est pas marqué remboursé.
        </p>
        {depenses.map((d) => {
          const payeur = members.find((m) => m.id === d.source);
          return (
            <div key={d.id} className="list-item">
              <div>
                <div>{d.libelle} · {d.date}</div>
                <div className="muted">{payeur ? `avancé par ${payeur.name}` : "payé par la caisse"}{payeur && (d.rembourse ? " · remboursé" : " · non remboursé")}</div>
              </div>
              <div className="row" style={{ gap: 10 }}>
                <span className="money neg">-{d.montant}</span>
                {payeur && (
                  <button className="secondary" onClick={() => toggleRembourse(d)}>
                    {d.rembourse ? "Annuler" : "Rembourser"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <h2>Journal des opérations</h2>
        {journal.length === 0 ? <p className="muted">Aucune opération enregistrée.</p> : journal.map((e) => (
          <div key={e.id} className="list-item">
            <div>
              <div>{e.libelle}</div>
              <div className="muted">{e.date} · {TYPE_LABEL[e.type]}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className={e.montant > 0 ? "money pos" : e.montant < 0 ? "money neg" : "muted"}>
                {e.montant > 0 ? "+" : ""}{e.montant}
              </div>
              <div className="muted" style={{ fontSize: 11 }}>solde: {e.solde}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
    }
