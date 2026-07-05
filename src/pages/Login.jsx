import React, { useState } from "react";
import { supabase } from "../supabaseClient";

export default function Login() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        setInfo("Compte créé. Vérifiez votre e-mail si une confirmation est demandée.");
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
      <h1>Caisse Commune</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        {mode === "signup" ? "Créer un compte" : "Se connecter"}
      </p>
      <form onSubmit={submit} className="card">
        <label>Adresse e-mail</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" />
        <label>Mot de passe</label>
        <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 caractères minimum" />
        {error && <p className="error">{error}</p>}
        {info && <p className="muted">{info}</p>}
        <button type="submit" disabled={loading} style={{ width: "100%" }}>
          {loading ? "Veuillez patienter…" : mode === "signup" ? "Créer mon compte" : "Se connecter"}
        </button>
      </form>
      <a className="link" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); setInfo(""); }}>
        {mode === "signup" ? "J'ai déjà un compte — me connecter" : "Pas encore de compte — en créer un"}
      </a>
    </div>
  );
}
