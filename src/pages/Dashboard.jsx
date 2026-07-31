import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { t, typeLabel } from "../i18n";
import { AdBanner } from "../ads";

const FREE_MAX_GROUPS = 3;
const DEVISES = ["EUR", "USD", "XOF", "XAF", "GBP", "CAD", "MAD", "NGN", "GHS", "CHF"];

export default function Dashboard({ userId, onOpenGroup, langue }) {
  const [groups, setGroups] = useState([]);
  const [visits, setVisits] = useState({});
  const [plan, setPlan] = useState("free");
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [type, setType] = useState("Association");
  const [devise, setDevise] = useState("EUR");
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
      .insert({ name: name.trim(), type, owner_id: userId, devise })
      .select()
      .single();
    if (err) { setError(err.message); return; }
    const displayName = userData.user.email?.split("@")[0] || "Moi";
    const { error: memErr } = await supabase.from("members").insert({ group_id: newGroup.id, name: displayName, user_id: userId });
    if (memErr) setError("Erreur membre : " + memErr.message);
    setName("");
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
          <div className="muted">{t("votrePlan", langue)}</div>
          <strong>{plan === "premium" ? t("premium", langue) : t("gratuit", langue)}</strong>
          {plan === "free" && <span className="muted"> ({ownedGroups.length}/{FREE_MAX_GROUPS} {t("groupesCrees", langue)})</span>}
        </div>
        <button className="secondary" onClick={togglePlan}>
          {plan === "premium" ? t("repasserGratuit", langue) : t("passerPremium", langue)}
        </button>
      </div>

      <div className="card">
        <h2>{langue === "en" ? "News" : "Actualités"}</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          {langue === "en"
            ? "Tip: mark an advance as reimbursed once the fund has paid the member back, to keep your balance accurate."
            : "Astuce : marquez une avance comme remboursée dès que la caisse a rendu l'argent au membre, pour garder un solde toujours exact."}
        </p>
        {plan === "free" && <AdBanner langue={langue} compact />}
      </div>

      <div className="card">
        <h2>{t("nouveauGroupe", langue)}</h2>
        {error && <p className="error">{error}</p>}
        {atLimit ? (
          <p className="error">Limite du plan gratuit atteinte ({FREE_MAX_GROUPS} groupes). Passez Premium pour en créer davantage.</p>
        ) : (
          <form onSubmit={createGroup}>
            <label>{t("nomDuGroupe", langue)}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("exGroupName", langue)} />
            <label>{t("type", langue)}</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {["Association", "Tontine", "Famille", "Colocation", "Équipe / Entreprise", "Projet ponctuel"].map((tp) => (
              <option key={tp} value={tp}>{typeLabel(tp, langue)}</option>
            ))}
            </select>
            <label>{t("deviseReference", langue)}</label>
            <select value={devise} onChange={(e) => setDevise(e.target.value)}>
              {DEVISES.map((d) => <option key={d}>{d}</option>)}
            </select>
            <button type="submit">{t("creerLeGroupe", langue)}</button>
          </form>
        )}
      </div>

      <div className="card">
        <h2>{t("vosGroupes", langue)}</h2>
        {loading ? (
          <p className="muted">{t("chargement", langue)}</p>
        ) : groups.length === 0 ? (
          <p className="muted">{t("aucunGroupe", langue)}</p>
        ) : (
          groups.map((g) => (
            <div key={g.id} className="list-item">
              <div style={{ cursor: "pointer" }} onClick={() => onOpenGroup(g.id)}>
                <strong>{g.name}</strong> {isNew(g) && <span style={{ background: "#B8894B", color: "#241B0B", fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 3, marginLeft: 6 }}>{t("nouveau", langue)}</span>}
                <div className="muted">{typeLabel(g.type, langue)} · {g.devise}{g.owner_id !== userId && " · " + t("membre", langue)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
