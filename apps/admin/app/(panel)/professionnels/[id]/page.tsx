'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { date, dateTime, fcfa, personName, statusLabel, TRADES } from '@/lib/format';
import { useCan } from '@/components/admin-context';
import { Badge, Card, ErrorBox, KV, PageHeader, ReasonModal, Table, useFetch, useToast } from '@/components/ui';

const ACTIONS: Record<string, { to: string; label: string; needsReason?: boolean; danger?: boolean }[]> = {
  pending: [{ to: 'in_review', label: 'Démarrer la vérification' }, { to: 'validated', label: 'Valider' }, { to: 'rejected', label: 'Refuser', needsReason: true, danger: true }],
  in_review: [{ to: 'validated', label: 'Valider' }, { to: 'rejected', label: 'Refuser', needsReason: true, danger: true }],
  validated: [{ to: 'suspended', label: 'Suspendre', needsReason: true, danger: true }],
  rejected: [{ to: 'in_review', label: 'Réexaminer' }],
  suspended: [{ to: 'validated', label: 'Réactiver' }, { to: 'rejected', label: 'Refuser', needsReason: true, danger: true }],
};

export default function ProfessionalDetail({ params }: { params: { id: string } }) {
  const can = useCan();
  const toast = useToast();
  const { data, error, reload } = useFetch<any>(`/professionals/${params.id}`);
  const [pending, setPending] = useState<{ to: string; label: string } | null>(null);

  if (error) return <ErrorBox error={error} />;
  if (!data) return <p className="muted">Chargement…</p>;
  const p = data.professional;

  const setStatus = async (status: string, reason?: string) => {
    await api(`/professionals/${p._id}/verification`, { method: 'POST', body: { status, reason } });
    reload();
  };
  const setDoc = async (docId: string, status: string) => {
    await api(`/professionals/${p._id}/documents/${docId}`, { method: 'PATCH', body: { status } });
    toast('Document mis à jour');
    reload();
  };

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

      <Card title="Documents justificatifs">
        <Table
          rows={data.documents}
          empty="Aucun document fourni"
          columns={[
            { key: 'label', label: 'Document' },
            { key: 'url', label: 'Fichier', render: (d: any) => <a href={d.url} target="_blank" rel="noopener noreferrer">Ouvrir</a> },
            { key: 'status', label: 'Statut', render: (d: any) => <Badge status={d.status === 'accepted' ? 'validated' : d.status === 'rejected' ? 'rejected' : 'pending'}>{{ accepted: 'Accepté', rejected: 'Refusé', pending: 'À examiner' }[d.status as string]}</Badge> },
            {
              key: 'a', label: '', render: (d: any) => can('pros.verify') && (
                <div className="hstack gap">
                  <button className="btn btn-sm" onClick={() => setDoc(d._id, 'accepted')}>Accepter</button>
                  <button className="btn btn-sm" onClick={() => setDoc(d._id, 'rejected')}>Refuser</button>
                </div>
              ),
            },
          ]}
        />
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
            { key: 'reference', label: 'Réf.', render: (i: any) => <Link href={`/interventions/${i._id}`}>{i.reference}</Link> },
            { key: 'problem', label: 'Problème' },
            { key: 'status', label: 'Statut', render: (i: any) => <Badge status={i.status} /> },
            { key: 'createdAt', label: 'Date', render: (i: any) => date(i.createdAt) },
          ]}
        />
      </Card>

      {pending && (
        <ReasonModal title={pending.label} confirm={pending.label} onClose={() => setPending(null)} onConfirm={(reason) => setStatus(pending.to, reason)} />
      )}
    </>
  );
}
