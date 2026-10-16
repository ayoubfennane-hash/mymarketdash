import {
  Cloud,
  LogIn,
  LogOut,
  Download,
  RefreshCw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import type { CloudAccount, CloudWorkbookMeta } from "./cloudClient";
type Props = {
  account: CloudAccount | null;
  pending: boolean;
  error: string;
  ready: boolean;
  workbook: CloudWorkbookMeta | null;
  currentSource: string;
  localImport: boolean;
  onLogout: () => void;
  onReload: () => void;
  onUploadLocal: () => void;
  onDownload: () => void;
  onReturnDefault: () => void;
};
export default function AccountPanel(p: Props) {
  return (
    <section
      className={"account-panel " + (p.account ? "connected" : "guest")}
      aria-label="Compte et sauvegarde cloud"
    >
      <div className="account-intro">
        <span className="account-icon">
          <Cloud size={21} />
        </span>
        <div>
          <strong>
            {p.account
              ? "Votre espace privé MYMARKET"
              : "Retrouvez votre Excel sur tous vos appareils"}
          </strong>
          <p>
            {p.account
              ? `${p.account.user.name}${p.account.user.email ? " · " + p.account.user.email : ""}`
              : "Connectez-vous avec Manus pour conserver votre dernier classeur en ligne. Sans connexion, les imports restent sur cet appareil."}
          </p>
        </div>
      </div>
      <div className="account-actions">
        {p.account ? (
          <button
            className="text-button"
            disabled={p.pending}
            onClick={p.onLogout}
          >
            <LogOut size={14} />
            Déconnexion
          </button>
        ) : (
          <a
            className="btn primary"
            href={`/api/auth/login?origin=${encodeURIComponent(window.location.origin)}`}
            target="_top"
            aria-disabled={p.pending}
            onClick={(e) => {
              if (p.pending) e.preventDefault();
            }}
          >
            <LogIn size={16} />
            Se connecter avec Manus
          </a>
        )}
      </div>
      {p.account && (
        <div className="cloud-file-status" role="status">
          <ShieldCheck size={17} />
          <div>
            <strong>
              {!p.ready
                ? "Vérification de votre espace cloud…"
                : p.workbook
                  ? "Classeur enregistré dans votre espace privé"
                  : "Aucun classeur cloud enregistré pour ce compte"}
            </strong>
            {p.workbook && (
              <p>
                {p.workbook.name} ·{" "}
                {(p.workbook.size / 1024).toLocaleString("fr-FR", {
                  maximumFractionDigits: 0,
                })}{" "}
                Ko · {new Date(p.workbook.savedAt).toLocaleString("fr-FR")}
              </p>
            )}
            <small>
              {p.currentSource === "cloud"
                ? "L’analyse utilise votre classeur cloud. Il sera retrouvé après connexion au même compte sur un autre appareil."
                : "L’analyse affichée n’est pas votre fichier cloud. Restaurez-le ou importez un Excel pour enregistrer un nouveau classeur dans ce compte."}
            </small>
          </div>
        </div>
      )}
      {p.account && (
        <div className="cloud-actions">
          {p.workbook && (
            <>
              <button className="btn" disabled={p.pending} onClick={p.onReload}>
                <RefreshCw size={14} />
                Restaurer mon fichier cloud
              </button>
              <button
                className="btn"
                disabled={p.pending}
                onClick={p.onDownload}
              >
                <Download size={14} />
                Télécharger mon Excel
              </button>
              {p.currentSource === "cloud" && (
                <button
                  className="text-button"
                  disabled={p.pending}
                  onClick={p.onReturnDefault}
                >
                  Voir le fichier initial
                </button>
              )}
            </>
          )}
          {p.localImport && (
            <button
              className="btn primary"
              disabled={p.pending || !p.ready}
              onClick={p.onUploadLocal}
            >
              <Upload size={14} />
              Enregistrer cet import local dans mon compte
            </button>
          )}
          {!p.ready && (
            <button className="btn" disabled={p.pending} onClick={p.onReload}>
              Réessayer l’espace cloud
            </button>
          )}
        </div>
      )}
      {p.error && (
        <p className="account-error" role="alert">
          {p.error}
        </p>
      )}
    </section>
  );
}
