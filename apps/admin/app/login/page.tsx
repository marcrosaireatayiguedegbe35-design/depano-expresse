'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import './login.css';

type Step =
  | { kind: 'password' }
  | { kind: 'mfa'; ticket: string; channel: 'email' | 'totp'; emailHint?: string; alreadySent?: boolean }
  | { kind: 'enroll'; ticket: string; qrDataUrl: string; secret: string };

const REMEMBER_KEY = 'pa-admin-remember-email';

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      {!open && <path d="m4 20 16-16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />}
    </svg>
  );
}

/** Marque de la plateforme : dépanneuse stylisée. */
function Mark() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#0f1b2d" />
      <path d="M10 40V26h18v14M28 30h9l6 6v4H28" fill="none" stroke="#f2a900" strokeWidth="3" strokeLinejoin="round" />
      <path d="M43 36h11" stroke="#f2a900" strokeWidth="3" strokeLinecap="round" />
      <circle cx="18" cy="42" r="4" fill="#fff" />
      <circle cx="38" cy="42" r="4" fill="#fff" />
      <rect x="14" y="20" width="10" height="3" rx="1.5" fill="#f2a900" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState<Step>({ kind: 'password' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [help, setHelp] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) { setEmail(saved); setRemember(true); }
    } catch {}
  }, []);

  const fail = (msg: string) => {
    setError(msg);
    const f = formRef.current;
    if (f) { f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (step.kind === 'password') {
        const r = await api('/auth/login', { method: 'POST', body: { email, password } });
        try { if (remember) localStorage.setItem(REMEMBER_KEY, email.trim()); else localStorage.removeItem(REMEMBER_KEY); } catch {}
        setPassword('');
        setCode('');
        setInfo(null);
        setCooldown(r.resendInSeconds ?? 60);
        setStep(r.step === 'enroll'
          ? { kind: 'enroll', ticket: r.ticket, qrDataUrl: r.qrDataUrl, secret: r.secret }
          : { kind: 'mfa', ticket: r.ticket, channel: r.channel ?? 'totp', emailHint: r.emailHint, alreadySent: r.alreadySent });
      } else {
        const path = step.kind === 'enroll' ? '/auth/2fa/enroll' : '/auth/2fa/verify';
        const r = await api(path, { method: 'POST', body: { ticket: step.ticket, code } });
        router.replace(r.admin?.mustChangePassword ? '/compte?first=1' : '/');
        return;
      }
    } catch (err: any) {
      fail(err.message);
    }
    setBusy(false);
  };

  const restart = () => { setStep({ kind: 'password' }); setCode(''); setError(null); setInfo(null); };

  const resend = async () => {
    if (step.kind !== 'mfa') return;
    setError(null);
    try {
      const r = await api('/auth/2fa/resend', { method: 'POST', body: { ticket: step.ticket } });
      setInfo('Un nouveau code vient d’être envoyé.');
      setCooldown(r.resendInSeconds ?? 60);
    } catch (err: any) { fail(err.message); }
  };

  const title = step.kind === 'password' ? <>Bon<br />retour</> : step.kind === 'enroll' ? <>Sécurisez<br />votre accès</> : <>Code de<br />vérification</>;
  const sub = step.kind === 'password'
    ? 'Connectez-vous pour piloter les professionnels, les interventions et les finances de la plateforme.'
    : step.kind === 'enroll'
      ? 'Double authentification obligatoire : scannez ce QR code avec Google Authenticator, Microsoft Authenticator ou 2FAS, puis saisissez le code à 6 chiffres.'
      : step.channel === 'email'
        ? `${step.alreadySent ? 'Un code vous a été envoyé il y a moins d’une minute' : 'Nous venons d’envoyer un code à 6 chiffres'} à ${step.emailHint}. Il est valable 10 minutes.`
        : 'Saisissez le code à 6 chiffres affiché dans votre application d’authentification.';

  return (
    <div className="lg4">
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
        <defs>
          <clipPath id="lg4wave" clipPathUnits="objectBoundingBox">
            <path d="M0 0H0.6C0.57 0.1 0.5 0.22 0.5 0.34C0.5 0.46 0.585 0.51 0.58 0.6C0.572 0.69 0.49 0.76 0.5 0.86C0.505 0.93 0.54 0.98 0.56 1H0Z" />
          </clipPath>
        </defs>
      </svg>
      <div className="lg4-photo" aria-hidden="true" />
      <h2 className="lg4-slogan">Chaque panne a sa solution,<br />chaque franc sa trace</h2>
      <header className="lg4-top">
        <span className="lg4-logo"><Mark /></span>
        <span className="lg4-brand">PLATEFORME AUTO<small>ADMINISTRATION</small></span>
      </header>

      <main className="lg4-main">
        <h1 className="lg4-title">{title}</h1>
        <p className="lg4-sub">{sub}</p>

        <form className="lg4-form" ref={formRef} onSubmit={submit} noValidate>
          <div aria-live="assertive">
            {error && <p className="login-error" role="alert"><span className="login-error-mark" aria-hidden="true">!</span>{error}</p>}
          </div>

          {step.kind === 'password' ? (
            <>
              <label className="lg4-field">
                <span>Adresse e-mail</span>
                <input name="email" type="email" placeholder="vous@exemple.bj" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  enterKeyHint="next" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <div className="lg4-field">
                <label htmlFor="pw"><span>Mot de passe</span></label>
                <div className="lg4-pw">
                  <input id="pw" name="password" type={showPw ? 'text' : 'password'} placeholder="Votre mot de passe" autoComplete="current-password"
                    autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="go" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" className="lg4-eye" onClick={() => setShowPw((s) => !s)} aria-pressed={showPw}
                    aria-label={showPw ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}><EyeIcon open={showPw} /></button>
                </div>
              </div>
              <div className="lg4-meta">
                <label className="lg4-remember"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span>Se souvenir de moi</span></label>
                <button type="button" className="lg4-forgot" onClick={() => setHelp((h) => !h)}>Mot de passe oublié ?</button>
              </div>
              {help && <p className="lg4-help">Contactez un super administrateur : il peut réinitialiser votre mot de passe depuis la page « Administrateurs ».</p>}
            </>
          ) : (
            <>
              {step.kind === 'enroll' && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="lg4-qr" src={step.qrDataUrl} alt="QR code de configuration de la double authentification" />
                  <details className="lg4-secret">
                    <summary>Saisie manuelle de la clé</summary>
                    <code>{step.secret}</code>
                  </details>
                </>
              )}
              <label className="lg4-field">
                <span>Code à 6 chiffres</span>
                <input className="lg4-code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} placeholder="••••••"
                  required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
              </label>
            </>
          )}

          <button type="submit" className={`lg4-go ${busy ? 'busy' : ''}`} disabled={busy || (step.kind !== 'password' && code.length !== 6)}>
            <i className="lg4-spin" aria-hidden="true" />
            <span>{busy ? 'Vérification…' : step.kind === 'password' ? 'Connexion' : 'Valider'}</span>
          </button>
          {step.kind === 'mfa' && step.channel === 'email' && (
            <p className="lg4-or" style={{ marginTop: '.8rem' }}>
              {info ?? 'Pas reçu ? Vérifiez vos courriers indésirables.'}{' '}
              {cooldown > 0 ? <span>Renvoi possible dans {cooldown} s</span> : <button type="button" className="lg4-forgot" onClick={resend}>Renvoyer le code</button>}
            </p>
          )}
          {step.kind !== 'password' && <button type="button" className="lg4-back" onClick={restart}>← Recommencer la connexion</button>}

          <p className="lg4-or">Accès réservé aux administrateurs habilités</p>
          <p className="lg4-copy">© {new Date().getFullYear()} Plateforme Auto · Bénin</p>
        </form>
      </main>

      <svg className="lg4-deco" viewBox="0 0 300 300" aria-hidden="true">
        <circle cx="185" cy="185" r="150" fill="none" stroke="#f2a900" strokeWidth="1.2" />
        <circle cx="198" cy="198" r="150" fill="none" stroke="#1673cc" strokeWidth="1.2" />
        <circle cx="212" cy="215" r="150" fill="#0b5cad" />
        <circle cx="262" cy="262" r="78" fill="#f2a900" opacity=".92" />
      </svg>
    </div>
  );
}
