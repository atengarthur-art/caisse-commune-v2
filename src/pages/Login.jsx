import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { t } from "../i18n";

export default function Login() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [langue, setLangue] = useState(() => localStorage.getItem("langue") || "fr");

  useEffect(() => { localStorage.setItem("langue", langue); }, [langue]);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        setInfo(t("compteCree", langue));
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err) {
      setError(err.message || "Une erreur est survenue.");
    }
    setLoading(false);
  };

  return (
    <div className="app-shell" style={{ maxWidth: 380, paddingTop: 80 }}>
      <div className="row" style={{ marginBottom: 10 }}>
        <h1 style={{ marginBottom: 0 }}>Caisse Commune</h1>
        <select value={langue} onChange={(e) => setLangue(e.target.value)} style={{ width: "auto", marginBottom: 0 }}>
          <option value="fr">FR</option>
          <option value="en">EN</option>
        </select>
      </div>
      <p className="muted" style={{ marginBottom: 20 }}>
        {mode === "signup" ? t("creerUnCompte", langue) : t("seConnecter", langue)}
      </p>
      <form onSubmit={submit} className="card">
        <label>{t("adresseEmail", langue)}</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" />
        <label>{t("motDePasse", langue)}</label>
        <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("motDePassePlaceholder", langue)} />
        {error && <p className="error">{error}</p>}
        {info && <p className="muted">{info}</p>}
        <button type="submit" disabled={loading} style={{ width: "100%" }}>
          {loading ? t("veuillezPatienter", langue) : mode === "signup" ? t("creerMonCompte", langue) : t("seConnecter", langue)}
        </button>
      </form>
      <a className="link" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); setInfo(""); }}>
        {mode === "signup" ? t("dejaUnCompte", langue) : t("pasEncoreDeCompte", langue)}
      </a>
    </div>
  );
}
