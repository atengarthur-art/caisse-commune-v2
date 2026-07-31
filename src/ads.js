import React, { useMemo } from "react";

export const AD_POOL = [
  { categorie: { fr: "Banque", en: "Bank" }, titre: { fr: "Un compte pensé pour les groupes", en: "An account designed for groups" }, texte: { fr: "Comparez des offres bancaires adaptées à la gestion collective de fonds.", en: "Compare banking offers suited to collective fund management." } },
  { categorie: { fr: "Assurance", en: "Insurance" }, titre: { fr: "Protégez les fonds de votre groupe", en: "Protect your group's funds" }, texte: { fr: "Des solutions d'assurance pour sécuriser vos cotisations et projets communs.", en: "Insurance solutions to secure your contributions and joint projects." } },
  { categorie: { fr: "Paiement", en: "Payment" }, titre: { fr: "Collectez les cotisations plus simplement", en: "Collect contributions more easily" }, texte: { fr: "Découvrez des solutions de paiement pensées pour les groupes et associations.", en: "Discover payment solutions designed for groups and associations." } },
  { categorie: { fr: "Formation", en: "Training" }, titre: { fr: "Formez vos trésoriers", en: "Train your treasurers" }, texte: { fr: "Des formations courtes en gestion financière associative et collaborative.", en: "Short courses in collaborative financial management." } },
  { categorie: { fr: "Expertise comptable", en: "Accounting" }, titre: { fr: "Un œil d'expert sur vos comptes", en: "An expert eye on your accounts" }, texte: { fr: "Des cabinets comptables partenaires pour vos rapports annuels.", en: "Partner accounting firms for your annual reports." } },
  { categorie: { fr: "Services juridiques", en: "Legal services" }, titre: { fr: "Sécurisez le cadre juridique de votre groupe", en: "Secure your group's legal framework" }, texte: { fr: "Statuts, règlement intérieur, conformité : des juristes à votre écoute.", en: "Bylaws, internal rules, compliance: lawyers ready to help." } },
];

export function randomAd() {
  return AD_POOL[Math.floor(Math.random() * AD_POOL.length)];
}

export function AdBanner({ langue = "fr", compact, dismissible, onDismiss }) {
  const ad = useMemo(() => randomAd(), []);
  return (
    <div className="card" style={{ borderStyle: "dashed" }}>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div>
          <p className="muted" style={{ fontSize: 11, textTransform: "uppercase", marginBottom: 2 }}>
            {langue === "en" ? "Sponsored" : "Annonce"} · {ad.categorie[langue] || ad.categorie.fr}
          </p>
          <strong>{ad.titre[langue] || ad.titre.fr}</strong>
          {!compact && <p className="muted" style={{ marginTop: 2 }}>{ad.texte[langue] || ad.texte.fr}</p>}
        </div>
        {dismissible && (
          <button className="secondary" style={{ padding: "2px 8px" }} onClick={onDismiss}>×</button>
        )}
      </div>
    </div>
  );
  }
