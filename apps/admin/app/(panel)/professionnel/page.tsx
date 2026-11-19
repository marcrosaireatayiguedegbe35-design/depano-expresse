'use client';

import { useSearchParams } from 'next/navigation';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { api } from '@/lib/api';
import { date, dateTime, fcfa, personName, statusLabel, TRADES } from '@/lib/format';
import { useCan } from '@/components/admin-context';
import { Badge, Card, ErrorBox, KV, PageHeader, ReasonModal, Table, useFetch, useToast, Loading } from '@/components/ui';

const ACTIONS: Record<string, { to: string; label: string; needsReason?: boolean; danger?: boolean }[]> = {
  pending: [{ to: 'in_review', label: 'Démarrer la vérification' }, { to: 'validated', label: 'Valider' }, { to: 'rejected', label: 'Refuser', needsReason: true, danger: true }],
  in_review: [{ to: 'validated', label: 'Valider' }, { to: 'rejected', label: 'Refuser', needsReason: true, danger: true }],
  validated: [{ to: 'suspended', label: 'Suspendre', needsReason: true, danger: true }],
  rejected: [{ to: 'in_review', label: 'Réexaminer' }],
  suspended: [{ to: 'validated', label: 'Réactiver' }, { to: 'rejected', label: 'Refuser', needsReason: true, danger: true }],
};

function ProfessionalDetail({ params }: { params: { id: string } }) {
  const can = useCan();
  const toast = useToast();
  const { data, error, reload } = useFetch<any>(`/professionals/${params.id}`);
  const [pending, setPending] = useState<{ to: string; label: string } | null>(null);
  const [rejecting, setRejecting] = useState<any>(null);
  const [showContract, setShowContract] = useState(false);

  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading minHeight={320} />;
  const p = data.professional;

  const setStatus = async (status: string, reason?: string) => {
    await api(`/professionals/${p._id}/verification`, { method: 'POST', body: { status, reason } });
    reload();
  };
  const setDoc = async (docId: string, status: string, reason?: string) => {
    await api(`/professionals/${p._id}/documents/${docId}`, { method: 'PATCH', body: { status, reason } });
    toast('Document mis à jour');
    reload();
  };
  const list = data.checklist;
  const contract = data.contract;
  const DOC_ST: Record<string, [string, string]> = { missing: ['Manquant', 'rejected'], pending: ['À examiner', 'pending'], accepted: ['Accepté', 'validated'], rejected: ['Refusé', 'rejected'], expired: ['Expiré', 'rejected'] };

  return (
    <>
      <PageHeader
        title={personName(p)}
        subtitle={`${TRADES[p.trade]} · ${p.commune ?? ''}`}
        actions={
          can('pros.verify') &&
          ACTIONS[p.verificationStatus]?.map((a) => (
            <button key={a.to} className={`btn ${a.danger ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => (a.needsReason ? setPending(a) : setStatus(a.to).then(() => toast('Statut mis à jour')).catch((e) => toast(e.message, 'danger')))}>
              {a.label}
            </button>
          ))
        }
      />
      <div className="grid grid-2">
        <Card title="Profil" actions={<Badge status={p.verificationStatus} />}>
          <KV items={[
            ['Téléphone', p.phone], ['E-mail', p.email], ['Adresse', p.address], ['Quartier', p.quartier],
            ['Localisation détectée', p.area?.commune ? [p.area.quartier, p.area.arrondissement, p.area.commune, p.area.departement && `département ${p.area.departement}`].filter(Boolean).join(', ') : '—'],
            ['GPS', p.location?.coordinates ? `${p.location.coordinates[1].toFixed(5)}, ${p.location.coordinates[0].toFixed(5)}` : '—'],
            ['Zone d’intervention', p.zoneRadiusKm ? `${p.zoneRadiusKm} km` : '—'], ['Horaires', p.hours], ['Tarifs indicatifs', p.indicativeRates],
            ['Disponibilité', <Badge key="a" status={p.availability} />], ['Note', p.reviewsCount ? `★ ${p.rating} (${p.reviewsCount} avis)` : '—'],
            ['Inscrit le', date(p.createdAt)], ['Compte de reversement', p.payoutAccount?.msisdn ? `${p.payoutAccount.operator} · ${p.payoutAccount.msisdn}` : '—'],
          ]} />
          {p.description && <p>{p.description}</p>}
          {p.services?.length > 0 && <p className="small"><strong>Services :</strong> {p.services.join(', ')}</p>}
        </Card>
        <Card title="Revenus sur la plateforme">
          <KV items={[
            ['Interventions payées', data.finance.count], ['Total encaissé', fcfa(data.finance.billed)],
            ['Commissions prélevées', fcfa(data.finance.commission)], ['Net professionnel', fcfa(data.finance.net)],
          ]} />
          {can('finance.read') && <p><Link href={`/finance?tab=payouts&pro=${p._id}`}>Gérer les reversements →</Link></p>}
        </Card>
      </div>

      <Card title="Vérification : éléments exigés" actions={<Badge status={list.complete ? 'validated' : 'pending'}>{list.complete ? 'Complet' : `${list.missing.length} manquant(s)`}</Badge>}>
        {!list.complete && <div className="alert alert-warning small">Le compte ne peut pas être validé tant que ces éléments ne sont pas acceptés : {list.missing.map((m: any) => m.label).join(', ')}.</div>}
        {list.qualified && <div className="alert alert-info small">Badge « Qualifié » : diplôme ou assurance RC professionnelle acceptés.</div>}
        <Table
          rows={list.items.filter((i: any) => i.required || i.doc)}
          columns={[
            { key: 'label', label: 'Élément', render: (i: any) => <><strong>{i.label}</strong>{!i.required && <span className="muted small"> · facultatif</span>}</> },
            { key: 'info', label: 'Détails', render: (i: any) => i.doc ? <span className="small">{[i.doc.number && `N° ${i.doc.number}`, i.doc.issuedAt && `délivré le ${date(i.doc.issuedAt)}`, i.doc.expiresAt && `expire le ${date(i.doc.expiresAt)}`, `déposé le ${date(i.doc.createdAt)}`].filter(Boolean).join(' · ')}{i.doc.rejectReason && i.status === 'rejected' && <div className="muted">Motif : {i.doc.rejectReason}</div>}</span> : i.key === 'contract' && contract ? <span className="small">{contract.reference} · signé le {dateTime(contract.signedAt)}</span> : <span className="muted small">—</span> },
            { key: 'file', label: 'Photo', render: (i: any) => i.doc?.url ? <a href={i.doc.url} target="_blank" rel="noopener noreferrer">Ouvrir</a> : '' },
            { key: 'status', label: 'Statut', render: (i: any) => <Badge status={DOC_ST[i.status][1]}>{DOC_ST[i.status][0]}</Badge> },
            {
              key: 'a', label: '', render: (i: any) => can('pros.verify') && i.doc && (
                <div className="hstack gap">
                  {i.doc.status !== 'accepted' && <button className="btn btn-sm" onClick={() => setDoc(i.doc._id, 'accepted')}>Accepter</button>}
                  {i.doc.status !== 'rejected' && <button className="btn btn-sm" onClick={() => setRejecting(i)}>Refuser</button>}
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Card title="Contrat de partenariat" actions={contract && <a className="btn btn-sm btn-primary" href={`/api/professionals/${p._id}/contract/pdf`} download>Télécharger le PDF</a>}>
        {!contract ? <p className="muted">Aucun contrat signé pour l’instant.</p> : (
          <>
            <KV items={[
              ['Référence', contract.reference], ['Version', `${contract.version}${contract.current ? ' (en vigueur)' : ' — à signer à nouveau'}`],
              ['Signé le', dateTime(contract.signedAt)], ['Signataire', contract.signedName],
              ['Pièce déclarée', `${({ cip: 'CIP', cni: 'Carte d’identité', passport: 'Passeport', resident: 'Carte de séjour' } as Record<string, string>)[contract.idKind] ?? contract.idKind} n° ${contract.idNumber}`],
              ['Adresse IP', contract.ip || '—'], ['Empreinte SHA-256', <code key="h" className="small" style={{ wordBreak: 'break-all' }}>{contract.textHash}</code>],
            ]} />
            <p className="small muted" style={{ marginBottom: 4 }}>Signature</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={contract.signatureDataUrl} alt="Signature du professionnel" style={{ maxWidth: 320, maxHeight: 110, border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, background: '#fff' }} />
            <p><button className="btn btn-sm" onClick={() => setShowContract((v) => !v)}>{showContract ? 'Masquer le texte' : 'Lire le texte signé'}</button></p>
            {showContract && contract.doc && (
              <div className="small" style={{ maxHeight: 420, overflow: 'auto', padding: 12, border: '1px solid var(--border, #e5e7eb)', borderRadius: 8 }}>
                {contract.doc.parties.map((x: string, i: number) => <p key={i}>{x}</p>)}
                {contract.doc.articles.map((a: any) => <div key={a.title}><strong>{a.title}</strong>{a.paras.map((x: string, i: number) => <p key={i}>{x}</p>)}</div>)}
                <p><strong>{contract.doc.closing}</strong></p>
              </div>
            )}
          </>
        )}
      </Card>

      <div className="grid grid-2">
        <Card title="Historique de vérification">
          <ul className="timeline">
            {[...(p.verificationHistory ?? [])].reverse().map((h: any, i: number) => (
              <li key={i}><strong>{statusLabel(h.status)}</strong> <span className="muted small">· {dateTime(h.at)} · {h.byEmail}</span>{h.reason && <div className="small">{h.reason}</div>}</li>
            ))}
          </ul>
        </Card>
        <Card title="Derniers avis">
          {data.reviews.length === 0 && <p className="muted">Aucun avis.</p>}
          {data.reviews.map((r: any) => (
            <p key={r._id} className="small">★ {r.rating} · {r.comment} {r.hidden && <Badge status="archived">Masqué</Badge>}</p>
          ))}
        </Card>
      </div>

      <Card title="Dernières interventions">
        <Table
          rows={data.interventions}
          columns={[
            { key: 'reference', label: 'Réf.', render: (i: any) => <Link href={`/intervention?id=${i._id}`}>{i.reference}</Link> },
            { key: 'problem', label: 'Problème' },
            { key: 'status', label: 'Statut', render: (i: any) => <Badge status={i.status} /> },
            { key: 'createdAt', label: 'Date', render: (i: any) => date(i.createdAt) },
          ]}
        />
      </Card>

      {rejecting && (
        <ReasonModal title={`Refuser : ${rejecting.label}`} confirm="Refuser la pièce" onClose={() => setRejecting(null)} onConfirm={(reason) => setDoc(rejecting.doc._id, 'rejected', reason)} />
      )}
      {pending && (
        <ReasonModal title={pending.label} confirm={pending.label} onClose={() => setPending(null)} onConfirm={(reason) => setStatus(pending.to, reason)} />
      )}
    </>
  );
}

/** Adresse statique (hébergement Cloudflare Pages) : l'identifiant arrive dans l'adresse sous la forme ?id=… */
function FromQuery() {
  const id = useSearchParams().get('id') ?? '';
  return <ProfessionalDetail key={id} params={{ id }} />;
}

export default function Page() {
  return <Suspense><FromQuery /></Suspense>;
}
