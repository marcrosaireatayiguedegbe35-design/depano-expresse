'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { api, qs } from '@/lib/api';
import { Icon } from '@/components/icons';
import { Blob, PageHead } from '@/components/ds';
import { useSession } from '@/components/session';
import { SignaturePad, SignaturePadHandle } from '@/components/signature-pad';
import { ErrorBox, Loading, useFetch, useToast } from '@/components/ui';

interface ContractDoc { title: string; version: string; reference: string; parties: string[]; articles: { title: string; paras: string[] }[]; closing: string }

const dateTime = (d: string) => new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Texte intégral du contrat, tel qu'il sera signé et repris dans le PDF. */
function ContractText({ doc }: { doc: ContractDoc }) {
  return (
    <article className="ct-doc">
      <h2>{doc.title}</h2>
      <p className="ct-ref">Version {doc.version} · Réf. {doc.reference}</p>
      {doc.parties.map((p, i) => <p key={i} className={i === 0 || p === 'ET' ? 'ct-strong' : undefined}>{p}</p>)}
      {doc.articles.map((a) => (
        <section key={a.title}>
          <h3>{a.title}</h3>
          {a.paras.map((p, i) => <p key={i}>{p}</p>)}
        </section>
      ))}
      <p className="ct-strong">{doc.closing}</p>
    </article>
  );
}

/** Contrat signé : récapitulatif, téléchargement du PDF et relecture. */
function Signed({ c, fresh }: { c: any; fresh: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <section className="ct-done">
        <span className="ic"><Icon name="checkCircle" /></span>
        <h2>{fresh ? 'Contrat signé, merci !' : 'Votre contrat est signé'}</h2>
        <p>Signé le {dateTime(c.signedAt)} par {c.signedName}.</p>
        <dl>
          <div><dt>Référence</dt><dd>{c.reference}</dd></div>
          <div><dt>Version</dt><dd>{c.version}</dd></div>
          <div><dt>Empreinte</dt><dd className="mono">{c.textHash.slice(0, 24)}…</dd></div>
        </dl>
        <a className="btn btn-primary btn-block" href="/api/contract/pdf" download><Icon name="doc" />Télécharger le contrat (PDF)</a>
        <button type="button" className="btn btn-light btn-block btn-md" onClick={() => setShow((v) => !v)}>{show ? 'Masquer le contrat' : 'Relire le contrat signé'}</button>
      </section>
      {fresh && (
        <section className="section fcard ct-next">
          <div className="fcard-head"><Icon name="shieldFill" /><label>Étape suivante : vos pièces</label></div>
          <p className="small text-2">Déposez maintenant les pièces demandées. Votre compte sera validé par notre équipe dès qu’elles seront toutes acceptées.</p>
          <Link href="/profil/documents" className="btn btn-primary btn-block btn-md" style={{ marginTop: 12 }}>Déposer mes pièces<Icon name="arrow" /></Link>
        </section>
      )}
      {show && c.doc && (
        <section className="section">
          <ContractText doc={c.doc} />
          <div className="ct-sigview"><span>Signature du Partenaire</span><img src={c.signatureDataUrl} alt={`Signature de ${c.signedName}`} /></div>
        </section>
      )}
    </>
  );
}

/** Lecture et signature au doigt du contrat de partenariat (obligatoire avant d'utiliser l'espace pro). */
export default function ContractPage() {
  const router = useRouter();
  const toast = useToast();
  const { pro, refresh, logout } = useSession();
  const { data: fetched } = useFetch<any>('/contract');
  const [after, setAfter] = useState<any>(null);
  const data = after ?? fetched;
  const [idKind, setIdKind] = useState(pro?.identity?.kind ?? 'cip');
  const [idNumber, setIdNumber] = useState(pro?.identity?.number ?? '');
  const [preview, setPreview] = useState<{ doc: ContractDoc; textHash: string; issuedAt: string } | null>(null);
  const [accept, setAccept] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false);
  const pad = useRef<SignaturePadHandle>(null);

  if (!data) return <div className="screen"><Loading rows={3} /></div>;
  const signed = data.contract?.current ? data.contract : null;
  const kinds: Record<string, string> = data.idKinds ?? {};

  const head = <PageHead title="Contrat de partenariat" back={signed ? '/profil' : false} right={!signed && <button type="button" className="ct-logout" onClick={async () => { await logout(); router.replace('/connexion'); }}>Se déconnecter</button>} />;

  if (signed) return <div className="screen"><Blob soft />{head}<Signed c={signed} fresh={fresh} /></div>;

  return (
    <div className="screen">
      <Blob soft />
      {head}
      {data.contract && !data.contract.current && (
        <div className="verif-banner"><span className="ic"><Icon name="info" /></span><span className="grow"><b>Nouvelle version du contrat</b><small>Le contrat a été mis à jour : lisez-le et signez-le pour continuer à recevoir des demandes.</small></span></div>
      )}
      <ol className="ct-steps" aria-label="Étapes">
        <li className={!preview ? 'on' : 'ok'}><i>1</i>Identité</li>
        <li className={preview ? 'on' : ''}><i>2</i>Lecture</li>
        <li className={preview && accept ? 'on' : ''}><i>3</i>Signature</li>
      </ol>

      {!preview ? (
        <form className="section fcard" onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true); setErr(null);
          try {
            setPreview(await api(`/contract/preview${qs({ idKind, idNumber: idNumber.trim() })}`));
            window.scrollTo({ top: 0 });
          } catch (e2: any) { setErr(e2.message); } finally { setBusy(false); }
        }}>
          <div className="fcard-head"><Icon name="userFill" /><label htmlFor="kind">Votre pièce d’identité</label></div>
          <p className="small text-2" style={{ marginBottom: 12 }}>Votre contrat est établi à votre nom, {pro?.firstName} {pro?.lastName}. Indiquez la pièce d’identité qui y figurera : la même que celle que vous déposerez ensuite en photo.</p>
          <div className="finput"><select id="kind" value={idKind} onChange={(e) => setIdKind(e.target.value)}>{Object.entries(kinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="finput" style={{ marginTop: 10 }}><input aria-label="Numéro de la pièce" required minLength={4} maxLength={30} pattern="[A-Za-z0-9][A-Za-z0-9 \-/]{3,29}" placeholder="Numéro de la pièce" value={idNumber} onChange={(e) => setIdNumber(e.target.value.toUpperCase())} /></div>
          <ErrorBox error={err} />
          <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} disabled={busy}>{busy ? 'Préparation…' : <>Lire mon contrat<Icon name="arrow" /></>}</button>
        </form>
      ) : (
        <>
          <section className="section"><ContractText doc={preview.doc} /></section>
          <section className="section fcard ct-sign">
            <label className="ct-accept">
              <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
              <span>J’ai lu l’intégralité du contrat et j’accepte d’être engagé(e) par ses conditions.</span>
            </label>
            <div className={`ct-padwrap${accept ? '' : ' off'}`} aria-disabled={!accept}>
              <div className="ct-padhead"><b>Votre signature</b><button type="button" onClick={() => pad.current?.clear()}>Effacer</button></div>
              <SignaturePad ref={pad} onChange={setHasInk} />
              <p className="xs text-2">Signée électroniquement le {dateTime(new Date().toISOString())} · {pro?.firstName} {pro?.lastName}</p>
            </div>
            <ErrorBox error={err} />
            <button type="button" className="btn btn-primary btn-block" disabled={!accept || !hasInk || busy} onClick={async () => {
              const signature = pad.current?.toDataUrl();
              if (!signature) return setErr('Tracez votre signature dans le cadre avant de valider.');
              setBusy(true); setErr(null);
              try {
                await api('/contract/sign', { method: 'POST', body: { idKind, idNumber: idNumber.trim(), issuedAt: preview.issuedAt, textHash: preview.textHash, signature, accept: true } });
                setAfter(await api('/contract'));
                await refresh();
                setFresh(true); setPreview(null);
                toast('Contrat signé');
                window.scrollTo({ top: 0 });
              } catch (e2: any) {
                setErr(e2.message);
                // Texte modifié ou affiché depuis trop longtemps : on recharge la version à jour à relire.
                if (/changé|expiré/.test(e2.message)) {
                  try { setPreview(await api(`/contract/preview${qs({ idKind, idNumber: idNumber.trim() })}`)); setAccept(false); window.scrollTo({ top: 0 }); } catch {}
                }
              } finally { setBusy(false); }
            }}>{busy ? 'Signature…' : <><Icon name="check" />Signer le contrat</>}</button>
            <button type="button" className="btn btn-light btn-block btn-md" style={{ marginTop: 10 }} onClick={() => { setPreview(null); setAccept(false); }}>Modifier ma pièce d’identité</button>
          </section>
        </>
      )}
    </div>
  );
}
