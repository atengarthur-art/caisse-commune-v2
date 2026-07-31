import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { t, typeLabel } from "../i18n";
import * as XLSX from "xlsx";
import { AdBanner } from "../ads";
const FREE_MAX_DOCUMENTS = 5;

function sum(arr) { return arr.reduce((a, b) => a + b, 0); }

const TYPE_LABEL = { fr: { cotisation: "Cotisation", depense: "Dépense (caisse)", avance: "Avance membre", remboursement: "Remboursement" }, en: { cotisation: "Contribution", depense: "Expense (fund)", avance: "Member advance", remboursement: "Reimbursement" } };
const DEVISES = ["EUR", "USD", "XOF", "XAF", "GBP", "CAD", "MAD", "NGN", "GHS", "CHF"];
const FREE_MAX_MEMBERS = 10;

function buildJournal(cotisations, depenses, members, convert, langue) {
  const L = TYPE_LABEL[langue] || TYPE_LABEL.fr;
  const entries = [];
  cotisations.forEach((c) => {
    const m = members.find((x) => x.id === c.member_id);
    entries.push({ id: "c-" + c.id, date: c.date, type: "cotisation", libelle: L.cotisation + " — " + (m?.name || "—"), montant: convert(c.montant, c.devise) });
  });
  depenses.forEach((d) => {
    if (!d.source) {
      entries.push({ id: "d-" + d.id, date: d.date, type: "depense", libelle: d.libelle, montant: -convert(d.montant, d.devise) });
    } else {
      const m = members.find((x) => x.id === d.source);
      entries.push({ id: "a-" + d.id, date: d.date, type: "avance", libelle: L.avance + " — " + d.libelle + " (" + (m?.name || "—") + ")", montant: 0 });
      if (d.rembourse) {
        entries.push({ id: "r-" + d.id, date: d.remboursement_date || d.date, type: "remboursement", libelle: L.remboursement + " — " + d.libelle + " (" + (m?.name || "—") + ")", montant: -convert(d.montant, d.devise) });
      }
    }
  });
  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let running = 0;
  return entries.map((e) => { running += e.montant; return { ...e, solde: running }; });
}

export default function GroupDetail({ groupId, onBack, langue = "fr" }) {
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [cotisations, setCotisations] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [plan, setPlan] = useState("free");
  const [isOwner, setIsOwner] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [memberName, setMemberName] = useState("");
  const [cotMemberId, setCotMemberId] = useState("");
  const [cotMontant, setCotMontant] = useState("");
  const [cotDevise, setCotDevise] = useState("EUR");
  const [depLibelle, setDepLibelle] = useState("");
  const [depMontant, setDepMontant] = useState("");
  const [depDevise, setDepDevise] = useState("EUR");
  const [depSource, setDepSource] = useState("");
  const [propType, setPropType] = useState("cotisation");
  const [propLibelle, setPropLibelle] = useState("");
  const [propMontant, setPropMontant] = useState("");
  const [propDevise, setPropDevise] = useState("EUR");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [votesCount, setVotesCount] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [displayDevise, setDisplayDevise] = useState(null);
  const [rates, setRates] = useState({});
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [docFile, setDocFile] = useState(null);
  const [docCategorie, setDocCategorie] = useState("");
  const [docUploading, setDocUploading] = useState(false);
  const [showAd, setShowAd] = useState(false);

  const loadAll = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user.id;
    setCurrentUserId(uid);
    const [gRes, mRes, cRes, dRes, planRes, reqRes, propRes] = await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).single(),
      supabase.from("members").select("*").eq("group_id", groupId).order("created_at"),
      supabase.from("cotisations").select("*").eq("group_id", groupId).order("date", { ascending: false }),
      supabase.from("depenses").select("*").eq("group_id", groupId).order("date", { ascending: false }),
      supabase.rpc("get_owner_plan", { gid: groupId }),
      supabase.from("group_action_requests").select("*").eq("group_id", groupId).eq("status", "pending").limit(1),
      supabase.from("operation_proposals").select("*").eq("group_id", groupId).order("created_at", { ascending: false }),
    ]);

    const g = gRes.data, m = mRes.data, c = cRes.data, d = dRes.data, ownerPlan = planRes.data, reqs = reqRes.data, props = propRes.data;
    if (mRes.error) setError(mRes.error.message);

    if (!g) { onBack(); return; }

    setGroup(g); setMembers(m || []); setCotisations(c || []); setDepenses(d || []);
    setProposals(props || []);
    if (ownerPlan) setPlan(ownerPlan);
    setIsOwner(g.owner_id === uid);
    if (!cotMemberId && m && m[0]) setCotMemberId(m[0].id);
    if (!displayDevise) setDisplayDevise(g.devise);
    setCotDevise(g.devise); setDepDevise(g.devise); setPropDevise(g.devise);

    const req = reqs && reqs[0] ? reqs[0] : null;
    setPendingRequest(req);
    if (req) {
      const { data: votes } = await supabase.from("group_action_votes").select("voter_id").eq("request_id", req.id);
      setVotesCount(votes ? votes.length : 0);
      setHasVoted(!!(votes && votes.find((v) => v.voter_id === uid)));
    } else {
      setVotesCount(0); setHasVoted(false);
    }
    
const{ data: docs } = await supabase.from("documents").select("*").eq("group_id", groupId).order("created_at", { ascending: false });
    setDocuments(docs || []);
    await supabase.from("group_visits").upsert(
      { group_id: groupId, user_id: uid, last_seen: new Date().toISOString() },
      { onConflict: "group_id,user_id" }
    );
  };

  useEffect(() => { loadAll(); }, [groupId]);

  useEffect(() => {
    if (!displayDevise) return;
    fetch(`https://open.er-api.com/v6/latest/${displayDevise}`)
      .then((r) => r.json())
      .then((data) => { if (data && data.rates) setRates(data.rates); })
      .catch(() => setRates({}));
  }, [displayDevise]);

  const convert = (amount, devise) => {
    if (!devise || devise === displayDevise) return amount;
    const r = rates[devise];
    if (!r) return amount;
    return amount / r;
  };

  const activeMembers = members.filter((m) => m.active);
  const atMemberLimit = plan === "free" && activeMembers.length >= FREE_MAX_MEMBERS;
  const myMembership = members.find((m) => m.user_id === currentUserId);
  const myActiveMembership = myMembership && myMembership.active ? myMembership : null;
  const connectedOthers = activeMembers.filter((m) => m.user_id && m.user_id !== group?.owner_id);
  const pendingProposals = proposals.filter((p) => p.status === "pending");

  const memberStats = (id) => ({
    nbCot: cotisations.filter((c) => c.member_id === id).length,
    nbAv: depenses.filter((d) => d.source === id).length,
  });
  
  const addMember = async (e) => {
    e.preventDefault();
    if (!memberName.trim() || atMemberLimit) return;
    const { error: err } = await supabase.from("members").insert({ group_id: groupId, name: memberName.trim() });
    if (err) setError(err.message);
    setMemberName("");
    loadAll();
  };

  const removeMember = async (id) => {
    const { error: err } = await supabase.from("members").update({ active: false, left_at: new Date().toISOString() }).eq("id", id);
    if (err) setError(err.message);
    setConfirmRemoveId(null);
    loadAll();
  };

  const reactivateMember = async (id) => {
    const { error: err } = await supabase.from("members").update({ active: true, left_at: null }).eq("id", id);
    if (err) setError(err.message);
    loadAll();
  };

  const addCotisation = async (e) => {
    e.preventDefault();
    const montant = parseFloat(cotMontant);
    if (!cotMemberId || !montant || montant <= 0) return;
    const { error: err } = await supabase.from("cotisations").insert({ group_id: groupId, member_id: cotMemberId, montant, devise: cotDevise });
    if (err) setError(err.message);
    else if (plan === "free") setShowAd(true);
    setCotMontant("");
    loadAll();
  }; 

  const addDepense = async (e) => {
    e.preventDefault();
    const montant = parseFloat(depMontant);
    if (!depLibelle.trim() || !montant || montant <= 0) return;
    const { error: err } = await supabase.from("depenses").insert({
      group_id: groupId, libelle: depLibelle.trim(), montant, devise: depDevise, source: depSource || null, rembourse: false,
    });
    if (err) setError(err.message);
    else if (plan === "free") setShowAd(true);
    setDepLibelle(""); setDepMontant(""); setDepSource("");
    loadAll();
  };   

  const toggleRembourse = async (d) => {
    const newVal = !d.rembourse;
    const { error: err } = await supabase.from("depenses").update({
      rembourse: newVal,
      rembourse_confirme: false,
      remboursement_date: newVal ? new Date().toISOString().slice(0, 10) : null,
    }).eq("id", d.id);
    if (err) setError(err.message);
    loadAll();
  };

  const confirmReimbursement = async (id) => {
    const { error: err } = await supabase.rpc("confirm_reimbursement", { did: id });
    if (err) setError(err.message);
    loadAll();
  };

  const copyLink = () => {
    const link = `${window.location.origin}/rejoindre/${group.join_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cotisations.map((c) => ({
      Date: c.date,
      Membre: members.find((m) => m.id === c.member_id)?.name || "",
      Montant: c.montant,
      Devise: c.devise,
    }))), "Cotisations");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(depenses.map((d) => ({
      Date: d.date,
      Libelle: d.libelle,
      Montant: d.montant,
      Devise: d.devise,
      PayePar: members.find((m) => m.id === d.source)?.name || "La caisse",
      Rembourse: d.rembourse ? (d.rembourse_confirme ? "Confirmé" : "Signalé") : "Non",
    }))), "Dépenses");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(journal.map((e) => ({
      Date: e.date,
      Operation: e.libelle,
      Montant: e.montant,
      SoldeCaisse: e.solde,
    }))), "Journal");
    XLSX.writeFile(wb, `rapport-${group.name.replace(/\s+/g, "-")}.xlsx`);
  };

  const uploadDocument = async (e) => {
    e.preventDefault();
    if (!docFile) return;
    setDocUploading(true);
    const path = `${groupId}/${Date.now()}-${docFile.name}`;
    const { error: upErr } = await supabase.storage.from("documents").upload(path, docFile);
    if (upErr) { setError(upErr.message); setDocUploading(false); return; }
    const { data: userData } = await supabase.auth.getUser();
    const { error: err } = await supabase.from("documents").insert({
      group_id: groupId, uploaded_by: userData.user.id, file_path: path, file_name: docFile.name, categorie: docCategorie.trim() || null, taille_octets: docFile.size,
    });
    if (err) setError(err.message);
    setDocFile(null); setDocCategorie("");
    setDocUploading(false);
    loadAll();
  };

  const downloadDocument = async (doc) => {
    const { data, error: err } = await supabase.storage.from("documents").createSignedUrl(doc.file_path, 60);
    if (err) { setError(err.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  const deleteDocument = async (doc) => {
    await supabase.storage.from("documents").remove([doc.file_path]);
    await supabase.from("documents").delete().eq("id", doc.id);
    loadAll();
  };
  const exportPDF = () => {
    window.print();
  };

  const leaveGroup = async () => {
    if (!myActiveMembership) return;
    const { error: err } = await supabase.from("members").update({ active: false, left_at: new Date().toISOString() }).eq("id", myActiveMembership.id);
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

  const submitProposal = async (e) => {
    e.preventDefault();
    const montant = parseFloat(propMontant);
    if (!myActiveMembership || !montant || montant <= 0) return;
    if (propType === "depense" && !propLibelle.trim()) return;
    const { error: err } = await supabase.from("operation_proposals").insert({
      group_id: groupId,
      member_id: myActiveMembership.id,
      proposer_user_id: currentUserId,
      type: propType,
      libelle: propType === "depense" ? propLibelle.trim() : "Cotisation",
      montant,
      devise: propDevise,
    });
    if (err) { setError(err.message); return; }
    setPropLibelle(""); setPropMontant("");
    loadAll();
  };

  const approveProposal = async (id) => {
    const { error: err } = await supabase.rpc("approve_proposal", { pid: id });
    if (err) setError(err.message);
    loadAll();
  };

  const rejectProposal = async (id) => {
    const { error: err } = await supabase.rpc("reject_proposal", { pid: id });
    if (err) setError(err.message);
    loadAll();
  };

  if (!group || !displayDevise) return <p className="muted">{t("chargement", langue)}</p>;

  const totalCotise = sum(cotisations.map((c) => convert(c.montant, c.devise)));
  const totalDepenseCaisse = sum(depenses.filter((d) => !d.source).map((d) => convert(d.montant, d.devise)));
  const totalRembourse = sum(depenses.filter((d) => d.source && d.rembourse).map((d) => convert(d.montant, d.devise)));
  const totalARembourser = sum(depenses.filter((d) => d.source && !d.rembourse).map((d) => convert(d.montant, d.devise)));
  const soldeCaisse = totalCotise - totalDepenseCaisse - totalRembourse;
  const journal = buildJournal(cotisations, depenses, members, convert, langue).reverse();
  const eligibleCount = pendingRequest ? (pendingRequest.eligible_voters || []).length : 0;
  const iCanVote = pendingRequest && (pendingRequest.eligible_voters || []).includes(currentUserId);
  return (
    <div>
      <a className="link" onClick={onBack}>{t("retour", langue)}</a>
      <h1 style={{ marginTop: 10 }}>{group.name}</h1>
      <p className="muted" style={{ marginBottom: 16 }}>{typeLabel(group.type, langue)} · {t("deviseRef", langue)} {group.devise}</p>
      {error && <p className="error">{error}</p>}

      <div className="card">
        <label>{t("afficherMontantsEn", langue)}</label>
        <select value={displayDevise} onChange={(e) => setDisplayDevise(e.target.value)}>
          {DEVISES.map((d) => <option key={d}>{d}</option>)}
        </select>
        <p className="muted" style={{ marginTop: 6 }}>{t("choixPropre", langue)}</p>
      </div>

      {pendingRequest && (
        <div className="card" style={{ borderColor: "#B8894B" }}>
          <h2>{pendingRequest.action_type === "delete" ? t("demandeSuppression", langue) : t("demandeTransfert", langue)}</h2>
          <p className="muted" style={{ marginBottom: 10 }}>{t("votesRecus", langue)} : {votesCount}/{eligibleCount}. {t("tousDoiventApprouver", langue)}</p>
          {iCanVote && !hasVoted && <button onClick={castVote}>{t("approuver", langue)}</button>}
          {hasVoted && <p className="muted">{t("dejaApprouve", langue)}</p>}
          {isOwner && <button className="secondary" style={{ marginLeft: 8 }} onClick={cancelRequest}>{t("annulerLaDemande", langue)}</button>}
        </div>
      )}

      <div className="card row">
        <div><div className="muted">{t("totalCotise", langue)}</div><div className="money pos">{totalCotise.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {displayDevise}</div></div>
        <div><div className="muted">{t("soldeCaisse", langue)}</div><div className="money pos">{soldeCaisse.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {displayDevise}</div></div>
        <div><div className="muted">{t("aRembourser", langue)}</div><div className="money neg">{totalARembourser.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {displayDevise}</div></div>
      </div>

      {isOwner && (
        <div className="card">
          <h2>{t("inviterMembres", langue)}</h2>
          <p className="muted" style={{ marginBottom: 10 }}>{t("partagezCeLien", langue)}</p>
          <button className="secondary" onClick={copyLink}>{copied ? t("lienCopie", langue) : t("copierLeLien", langue)}</button>
        </div>
      )}

      {isOwner && !pendingRequest && (
        <div className="card">
          <h2>{t("gestionDuGroupe", langue)}</h2>
          <button className="danger" onClick={requestDeletion} style={{ marginBottom: 14 }}>{t("demanderSuppression", langue)}</button>
          {connectedOthers.length > 0 && (
            <>
              <label>{t("transfererA", langue)}</label>
              <select value={transferTarget} onChange={(e) => setTransferTarget(e.target.value)}>
                <option value="">{t("choisirMembre", langue)}</option>
                {connectedOthers.map((m) => <option key={m.id} value={m.user_id}>{m.name}</option>)}
              </select>
              <button className="secondary" onClick={requestTransfer} disabled={!transferTarget}>{t("demanderTransfert", langue)}</button>
            </>
          )}
          <p className="muted" style={{ marginTop: 10 }}>{t("accordUnanime", langue)}</p>
        </div>
      )}

      {myMembership && (
        <div className="card">
          <h2>{t("coffreFort", langue)}</h2>
          {documents.length >= FREE_MAX_DOCUMENTS && plan === "free" ? (
            <p className="error">{t("limiteDocuments", langue)} ({FREE_MAX_DOCUMENTS}).</p>
          ) : (
            <form onSubmit={uploadDocument}>
              <label>{t("choisirFichier", langue)}</label>
              <input type="file" id="fileInput" style={{ display: "none" }} onChange={(e) => setDocFile(e.target.files[0])} />
              <button type="button" className="secondary" onClick={() => document.getElementById("fileInput").click()}>
                {t("choisirUnFichier", langue)}
              </button>
              <p className="muted" style={{ marginTop: 6, marginBottom: 12 }}>{docFile ? docFile.name : t("aucunFichierChoisi", langue)}</p>
              <label>{t("categorieOptionnelle", langue)}</label>
              <input value={docCategorie} onChange={(e) => setDocCategorie(e.target.value)} placeholder={t("exCategorie", langue)} />
              <button type="submit" disabled={!docFile || docUploading}>{docUploading ? t("veuillezPatienter", langue) : t("deposer", langue)}</button>
            </form>
          )}
          {documents.length === 0 ? <p className="muted">{t("aucunDocument", langue)}</p> : documents.map((doc) => (
            <div key={doc.id} className="list-item">
              <div>
                <div>{doc.file_name}</div>
                <div className="muted">{doc.categorie || "—"} · {new Date(doc.created_at).toLocaleDateString("fr-FR")} · {t("deposePar", langue)} {members.find((m) => m.user_id === doc.uploaded_by)?.name || "—"}</div>
              </div>
              <div className="row" style={{ gap: 10, width: "auto" }}>
                <button className="secondary" onClick={() => downloadDocument(doc)}>{t("telecharger", langue)}</button>
                <button className="danger" onClick={() => deleteDocument(doc)}>{t("supprimer", langue)}</button>
              </div>
            </div>
          ))}
        </div>
      )}
{myMembership && (
        <div className="card">
          <h2>{t("rapportExports", langue)}</h2>
          {plan === "premium" ? (
            <>
              <p className="muted" style={{ marginBottom: 10 }}>{t("deviseExportNote", langue)} ({displayDevise}).</p>
              <div className="row" style={{ gap: 10, justifyContent: "flex-start" }}>
                <button onClick={exportExcel}>{t("exporterExcel", langue)}</button>
                <button className="secondary" onClick={exportPDF}>{t("exporterPDF", langue)}</button>
              </div>
            </>
          ) : (
            <p className="error">{t("exportsReserves", langue)}</p>
          )}
        </div>
      )}

      {!isOwner && myActiveMembership && !leaving && (
        <div className="card"><button className="danger" onClick={() => setLeaving(true)}>{t("quitterGroupe", langue)}</button></div>
      )}
      {!isOwner && myActiveMembership && leaving && (
        <div className="card">
          <p style={{ marginBottom: 10 }}>{t("confirmerQuitter", langue)}</p>
          <div className="row" style={{ justifyContent: "flex-start", gap: 10 }}>
            <button className="danger" onClick={leaveGroup}>{t("confirmer", langue)}</button>
            <button className="secondary" onClick={() => setLeaving(false)}>{t("annuler", langue)}</button>
          </div>
        </div>
      )}

      {!isOwner && myActiveMembership && (
        <div className="card">
          <h2>{t("proposerOperation", langue)}</h2>
          <form onSubmit={submitProposal}>
            <label>{t("type", langue)}</label>
            <select value={propType} onChange={(e) => setPropType(e.target.value)}>
              <option value="cotisation">{t("cotisationVersee", langue)}</option>
              <option value="depense">{t("avancePayee", langue)}</option>
            </select>
            {propType === "depense" && (
              <>
                <label>{t("libelle", langue)}</label>
                <input value={propLibelle} onChange={(e) => setPropLibelle(e.target.value)} placeholder={t("exLibelleDepense", langue)} />
              </>
            )}
            <label>{t("montant", langue)}</label>
            <input type="number" min="0" step="any" value={propMontant} onChange={(e) => setPropMontant(e.target.value)} />
            <label>{t("devise", langue)}</label>
            <select value={propDevise} onChange={(e) => setPropDevise(e.target.value)}>
              {DEVISES.map((d) => <option key={d}>{d}</option>)}
            </select>
            <button type="submit">{t("envoyerAuTresorier", langue)}</button>
          </form>
        </div>
      )}

      {pendingProposals.length > 0 && (
        <div className="card">
          <h2>{t("propositionsEnAttente", langue)}</h2>
          {pendingProposals.map((p) => {
            const m = members.find((x) => x.id === p.member_id);
            return (
              <div key={p.id} className="list-item">
                <div>
                  <div>{p.type === "cotisation" ? "Cotisation" : "Avance — " + p.libelle} · {m?.name || "—"}</div>
                  <div className="muted">{new Date(p.created_at).toLocaleDateString("fr-FR")}</div>
                </div>
                <div className="row" style={{ gap: 10, width: "auto" }}>
                  <span className="money pos">{p.montant} {p.devise}</span>
                  {isOwner && <button onClick={() => approveProposal(p.id)}>{t("valider", langue)}</button>}
                  {isOwner && <button className="danger" onClick={() => rejectProposal(p.id)}>{t("rejeter", langue)}</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card">
        <h2>{t("membresTitle", langue)} {plan === "free" && <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>({activeMembers.length}/{FREE_MAX_MEMBERS})</span>}</h2>
        {isOwner && (
          atMemberLimit ? (
            <p className="error">{t("limiteGratuite", langue)} ({FREE_MAX_MEMBERS}). {t("passezPremiumPour", langue)}</p>
          ) : (
            <form onSubmit={addMember} className="row" style={{ alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}><input placeholder={t("nomMembrePlaceholder", langue)} value={memberName} onChange={(e) => setMemberName(e.target.value)} /></div>
              <button type="submit">{t("ajouter", langue)}</button>
            </form>
          )
        )}
        {members.map((m) => {
          const stats = memberStats(m.id);
          return (
            <div key={m.id} className="list-item">
              <span>{m.name}{m.user_id === group.owner_id && <span className="muted" style={{ fontSize: 12 }}> · {t("tresorier", langue)}</span>}{!m.active && <span className="muted" style={{ fontSize: 12 }}> · {t("inactif", langue)}</span>}</span>
              <div className="row" style={{ gap: 10, width: "auto" }}>
                {m.user_id && m.user_id !== group.owner_id && m.active && <span className="muted" style={{ fontSize: 12 }}>{t("compteConnecte", langue)}</span>}
                {isOwner && m.active && m.user_id !== group.owner_id && confirmRemoveId !== m.id && (
                  <button className="danger" onClick={() => setConfirmRemoveId(m.id)}>{t("retirer", langue)}</button>
                )}
                {isOwner && confirmRemoveId === m.id && (
                  <>
                    <span className="muted" style={{ fontSize: 11 }}>{stats.nbCot} cotis., {stats.nbAv} avance(s)</span>
                    <button className="danger" onClick={() => removeMember(m.id)}>{t("confirmer", langue)}</button>
                    <button className="secondary" onClick={() => setConfirmRemoveId(null)}>{t("annuler", langue)}</button>
                  </>
                )}
                {isOwner && !m.active && <button className="secondary" onClick={() => reactivateMember(m.id)}>{t("reactiver", langue)}</button>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <h2>{t("cotisationsTitle", langue)}</h2>
        {isOwner && (
          activeMembers.length === 0 ? <p className="muted">{t("ajoutezDabordMembre", langue)}</p> : (
            <form onSubmit={addCotisation}>
              <label>{t("membre_", langue)}</label>
              <select value={cotMemberId} onChange={(e) => setCotMemberId(e.target.value)}>
                {activeMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <label>{t("montant", langue)}</label>
              <input type="number" min="0" step="any" value={cotMontant} onChange={(e) => setCotMontant(e.target.value)} />
              <label>{t("devise", langue)}</label>
              <select value={cotDevise} onChange={(e) => setCotDevise(e.target.value)}>
                {DEVISES.map((d) => <option key={d}>{d}</option>)}
              </select>
              <button type="submit">{t("enregistrerCotisation", langue)}</button>
            </form>
          )
        )}
        {cotisations.map((c) => {
          const m = members.find((x) => x.id === c.member_id);
          const conv = convert(c.montant, c.devise);
          return (
            <div key={c.id} className="list-item">
              <span>{m?.name || "—"} · {c.date}</span>
              <span className="money pos">+{c.montant} {c.devise}{c.devise !== displayDevise && <span className="muted" style={{ fontSize: 11 }}> (≈{conv.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {displayDevise})</span>}</span>
            </div>
          );
        })}
      </div>

      <div className="card">
        <h2>{t("depensesTitle", langue)}</h2>
        {isOwner && (
          <>
            <form onSubmit={addDepense}>
              <label>{t("libelle", langue)}</label>
              <input value={depLibelle} onChange={(e) => setDepLibelle(e.target.value)} placeholder={t("exLibelleDepense", langue)} />
              <label>{t("montant", langue)}</label>
              <input type="number" min="0" step="any" value={depMontant} onChange={(e) => setDepMontant(e.target.value)} />
              <label>{t("devise", langue)}</label>
              <select value={depDevise} onChange={(e) => setDepDevise(e.target.value)}>
                {DEVISES.map((d) => <option key={d}>{d}</option>)}
              </select>
              <label>{t("payePar", langue)}</label>
              <select value={depSource} onChange={(e) => setDepSource(e.target.value)}>
                <option value="">{t("laCaisse", langue)}</option>
                {activeMembers.map((m) => <option key={m.id} value={m.id}>{m.name} (avance)</option>)}
              </select>
              <button type="submit">{t("enregistrerDepense", langue)}</button>
            </form>
            <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>{t("avanceNote", langue)}</p>
          </>
        )}
        {depenses.map((d) => {
          const payeur = members.find((m) => m.id === d.source);
          const conv = convert(d.montant, d.devise);
          const statut = !d.rembourse ? "" : d.rembourse_confirme ? t("rembourseConfirmeText", langue) : t("rembourseSignaleText", langue);
          return (
            <div key={d.id} className="list-item">
              <div>
                <div>{d.libelle} · {d.date}</div>
                <div className="muted">{payeur ? `${payeur.name}${statut ? " · " + statut : ""}` : t("laCaisse", langue)}</div>
              </div>
              <div className="row" style={{ gap: 10 }}>
                <span className="money neg">-{d.montant} {d.devise}{d.devise !== displayDevise && <span className="muted" style={{ fontSize: 11 }}> (≈{conv.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {displayDevise})</span>}</span>
                {isOwner && payeur && (
                  <button className="secondary" onClick={() => toggleRembourse(d)}>{d.rembourse ? t("annulerSignalement", langue) : t("signalerRembourse", langue)}</button>
                )}
                {!isOwner && myActiveMembership && payeur && payeur.id === myActiveMembership.id && d.rembourse && !d.rembourse_confirme && (
                  <button onClick={() => confirmReimbursement(d.id)}>{t("confirmerReception", langue)}</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showAd && <AdBanner langue={langue} dismissible onDismiss={() => setShowAd(false)} />}
      <div className="card">
        <h2>{t("journalTitle", langue)} <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>({displayDevise})</span></h2>
        {journal.length === 0 ? <p className="muted">{t("aucuneOperation", langue)}</p> : journal.map((e) => (
          <div key={e.id} className="list-item">
            <div>
              <div>{e.libelle}</div>
              <div className="muted">{e.date} · {TYPE_LABEL[langue][e.type]}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className={e.montant > 0 ? "money pos" : e.montant < 0 ? "money neg" : "muted"}>{e.montant > 0 ? "+" : ""}{e.montant.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {displayDevise}</div>
              <div className="muted" style={{ fontSize: 11 }}>{t("solde", langue)}: {e.solde.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
          }
