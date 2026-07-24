import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function sum(arr) { return arr.reduce((a, b) => a + b, 0); }

const FREE_MAX_MEMBERS = 10;
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
  const [plan, setPlan] = useState("free");
  const [isOwner, setIsOwner] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [memberName, setMemberName] = useState("");
  const [cotMemberId, setCotMemberId] = useState("");
  const [cotMontant, setCotMontant] = useState("");
  const [depLibelle, setDepLibelle] = useState("");
  const [depMontant, setDepMontant] = useState("");
  const [depSource, setDepSource] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [votesCount, setVotesCount] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");

  const loadAll = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user.id;
    setCurrentUserId(uid);
    const [{ data: g }, { data: m }, { data: c }, { data: d }, { data: ownerPlan }, { data: reqs }] = await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).single(),
      supabase.from("members").select("*").eq("group_id", groupId).order("created_at"),
      supabase.from("cotisations").select("*").eq("group_id", groupId).order("date", { ascending: false }),
      supabase.from("depenses").select("*").eq("group_id", groupId).order("date", { ascending: false }),
      supabase.rpc("get_owner_plan", { gid: groupId }),
      supabase.from("group_action_requests").select("*").eq("group_id", groupId).eq("status", "pending").limit(1),
    ]);

    if (!g) { onBack(); return; }

    setGroup(g); setMembers(m || []); setCotisations(c || []); setDepenses(d || []);
    if (ownerPlan) setPlan(ownerPlan);
    setIsOwner(g.owner_id === uid);
    if (!cotMemberId && m && m[0]) setCotMemberId(m[0].id);

    const req = reqs && reqs[0] ? reqs[0] : null;
    setPendingRequest(req);
    if (req) {
      const { data: votes } = await supabase.from("group_action_votes").select("voter_id").eq("request_id", req.id);
      setVotesCount(votes ? votes.length : 0);
      setHasVoted(!!(votes && votes.find((v) => v.voter_id === uid)));
    } else {
      setVotesCount(0); setHasVoted(false);
    }

    await supabase.from("group_visits").upsert({ group_id: groupId, user_id: uid, last_seen: new Date().toISOString() });
  };

  useEffect(() => { loadAll(); }, [groupId]);

  const atMemberLimit = plan === "free" && members.length >= FREE_MAX_MEMBERS;
  const myMembership = members.find((m) => m.user_id === currentUserId);
  const connectedOthers = members.filter((m) => m.user_id && m.user_id !== group?.owner_id);

  const addMember = async (e) => {
    e.preventDefault();
    if (!memberName.trim() || atMemberLimit) return;
    const { error: err } = await supabase.from("members").insert({ group_id: groupId, name: memberName.trim() });
    if (err) setError(err.message);
    setMemberName("");
    loadAll();
  };

  const removeMember = async (id) => {
    const { error: err } = await supabase.from("members").delete().eq("id", id);
    if (err) setError(err.message);
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
      group_id: groupId, libelle: depLibelle.trim(), montant, source: depSource || null, rembourse: false,
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

  const copyLink = () => {
    const link = `${window.location.origin}/rejoindre/${group.join_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const leaveGroup = async () => {
    if (!myMembership) return;
    const { error: err } = await supabase.from("members").delete().eq("id", myMembership.id);
    if (err) { setError(err.message); return; }
    onBack();
  };

  const requestDeletion = async () => {
    const { error: err } = await supabase.rpc("create_group_action_request", { gid: groupId, atype: "delete" });
    if (err) { setError(err.message); return; }
    const { data: stillExists } = await supabase.from("groups").select("id").eq("id", groupId).maybeSingle();
    if (!stillExists) { onBack(); return; }
    loadAll();
  };

  const requestTransfer = async () => {
    if (!transferTarget) return;
    const { error: err } = await supabase.rpc("create_group_action_request", { gid: groupId, atype: "transfer", target: transferTarget });
    if (err) { setError(err.message); return; }
    setTransferTarget("");
    loadAll();
  };

  const castVote = async () => {
    if (!pendingRequest) return;
    const { error: err } = await supabase.from("group_action_votes").insert({ request_id: pendingRequest.id, voter_id: currentUserId });
    if (err) { setError(err.message); return; }
    loadAll();
  };

  const cancelRequest = async () => {
    if (!pendingRequest) return;
    await supabase.from("group_action_requests").delete().eq("id", pendingRequest.id);
    loadAll();
  };

  if (!group) return <p className="muted">Chargement du groupe…</p>;

  const totalCotise = sum(cotisations.map((c) => c.montant));
  const totalDepenseCaisse = sum(depenses.filter((d) => !d.source).map((d) => d.montant));
  const totalRembourse = sum(depenses.filter((d) => d.source && d.rembourse).map((d) => d.montant));
  const totalARembourser = sum(depenses.filter((d) => d.source && !d.rembourse).map((d) => d.montant));
  const soldeCaisse = totalCotise - totalDepenseCaisse - totalRembourse;
  const journal = buildJournal(cotisations, depenses, members).reverse();
  const eligibleCount = pendingRequest ? (pendingRequest.eligible_voters || []).length : 0;
  const iCanVote = pendingRequest && (pendingRequest.eligible_voters || []).includes(currentUserId);

  return (
    <div>
      <a className="link" onClick={onBack}>&larr; Retour aux groupes</a>
      <h1 style={{ marginTop: 10 }}>{group.name}</h1>
      <p className="muted" style={{ marginBottom: 16 }}>{group.type}</p>
      {error && <p className="error">{error}</p>}

      {pendingRequest && (
        <div className="card" style={{ borderColor: "#B8894B" }}>
          <h2>{pendingRequest.action_type === "delete" ? "Demande de suppression en cours" : "Demande de transfert en cours"}</h2>
          <p className="muted" style={{ marginBottom: 10 }}>
            Votes reçus : {votesCount}/{eligibleCount}. Tous les membres connectés doivent approuver.
          </p>
          {iCanVote && !hasVoted && <button onClick={castVote}>Approuver</button>}
          {hasVoted && <p className="muted">Vous avez déjà approuvé cette demande.</p>}
          {isOwner && <button className="secondary" style={{ marginLeft: 8 }} onClick={cancelRequest}>Annuler la demande</button>}
        </div>
      )}

      <div className="card row">
        <div><div className="muted">Total cotisé</div><div className="money pos">{totalCotise.toLocaleString("fr-FR")} €</div></div>
        <div><div className="muted">Solde caisse</div><div className="money pos">{soldeCaisse.toLocaleString("fr-FR")} €</div></div>
        <div><div className="muted">À rembourser</div><div className="money neg">{totalARembourser.toLocaleString("fr-FR")} €</div></div>
      </div>

      {isOwner && (
        <div className="card">
          <h2>Inviter des membres</h2>
          <p className="muted" style={{ marginBottom: 10 }}>
            Partagez ce lien : la personne crée son compte et rejoint automatiquement ce groupe, en lecture seule.
          </p>
          <button className="secondary" onClick={copyLink}>{copied ? "Lien copié !" : "Copier le lien d'invitation"}</button>
        </div>
      )}

      {isOwner && !pendingRequest && (
        <div className="card">
          <h2>Gestion du groupe</h2>
          <button className="danger" onClick={requestDeletion} style={{ marginBottom: 14 }}>
            Demander la suppression du groupe
          </button>
          {connectedOthers.length > 0 && (
            <>
              <label>Transférer la propriété à</label>
              <select value={transferTarget} onChange={(e) => setTransferTarget(e.target.value)}>
                <option value="">Choisir un membre connecté</option>
                {connectedOthers.map((m) => <option key={m.id} value={m.user_id}>{m.name}</option>)}
              </select>
              <button className="secondary" onClick={requestTransfer} disabled={!transferTarget}>Demander le transfert</button>
            </>
          )}
          <p className="muted" style={{ marginTop: 10 }}>
            Ces deux actions nécessitent l'accord unanime des membres connectés (s'il y en a).
          </p>
        </div>
      )}

      {!isOwner && myMembership && !leaving && (
        <div className="card">
          <button className="danger" onClick={() => setLeaving(true)}>Quitter ce groupe</button>
        </div>
      )}
      {!isOwner && myMembership && leaving && (
        <div className="card">
          <p style={{ marginBottom: 10 }}>Confirmer que vous quittez ce groupe ?</p>
          <div className="row" style={{ justifyContent: "flex-start", gap: 10 }}>
            <button className="danger" onClick={leaveGroup}>Confirmer</button>
            <button className="secondary" onClick={() => setLeaving(false)}>Annuler</button>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Membres {plan === "free" && <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>({members.length}/{FREE_MAX_MEMBERS})</span>}</h2>
        {isOwner && (
          atMemberLimit ? (
            <p className="error">Limite du plan gratuit atteinte ({FREE_MAX_MEMBERS} membres). Passez Premium pour en ajouter davantage.</p>
          ) : (
            <form onSubmit={addMember} className="row" style={{ alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}><input placeholder="Nom du membre (sans compte)" value={memberName} onChange={(e) => setMemberName(e.target.value)} /></div>
              <button type="submit">Ajouter</button>
            </form>
          )
        )}
        {members.map((m) => (
          <div key={m.id} className="list-item">
            <span>{m.name}{m.user_id === group.owner_id && <span className="muted" style={{ fontSize: 12 }}> · trésorier</span>}</span>
            <div className="row" style={{ gap: 10, width: "auto" }}>
              {m.user_id && m.user_id !== group.owner_id && <span className="muted" style={{ fontSize: 12 }}>compte connecté</span>}
              {isOwner && m.user_id !== group.owner_id && <button className="danger" onClick={() => removeMember(m.id)}>Retirer</button>}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Cotisations</h2>
        {isOwner && (
          members.length === 0 ? <p className="muted">Ajoutez d'abord un membre.</p> : (
            <form onSubmit={addCotisation}>
              <label>Membre</label>
              <select value={cotMemberId} onChange={(e) => setCotMemberId(e.target.value)}>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <label>Montant</label>
              <input type="number" min="0" step="any" value={cotMontant} onChange={(e) => setCotMontant(e.target.value)} />
              <button type="submit">Enregistrer la cotisation</button>
            </form>
          )
        )}
        {cotisations.map((c) => {
          const m = members.find((x) => x.id === c.member_id);
          return <div key={c.id} className="list-item"><span>{m?.name || "—"} · {c.date}</span><span className="money pos">+{c.montant}</span></div>;
        })}
      </div>

      <div className="card">
        <h2>Dépenses</h2>
        {isOwner && (
          <>
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
          </>
        )}
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
                {isOwner && payeur && (
                  <button className="secondary" onClick={() => toggleRembourse(d)}>{d.rembourse ? "Annuler" : "Rembourser"}</button>
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
