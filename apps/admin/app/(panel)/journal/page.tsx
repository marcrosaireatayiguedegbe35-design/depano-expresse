'use client';

import { useState } from 'react';
import { api, qs } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { Badge, Card, ErrorBox, Filters, Modal, PageHeader, Pager, Table, useList } from '@/components/ui';

export default function AuditPage() {
  const { data, error, params, set, setPage } = useList('/audit-logs', { limit: 50 });
  const [open, setOpen] = useState<any>(null);
  const [check, setCheck] = useState<any>(null);
  const [checking, setChecking] = useState(false);

  const verify = async () => {
    setChecking(true);
    try { setCheck(await api('/audit-logs/verify')); } finally { setChecking(false); }
  };

  return (
    <>
      <PageHeader title="Journal d’activité" subtitle="Actions des administrateurs. Chaque entrée est numérotée et scellée (HMAC) : toute modification ou suppression est détectable."
        actions={<>
          <button className="btn" onClick={verify} disabled={checking}>{checking ? 'Vérification…' : 'Vérifier l’intégrité'}</button>
          <a className="btn btn-primary" href={`/api/audit-logs/export${qs({ admin: params.admin, action: params.action, from: params.from, to: params.to, result: params.result })}`}>Exporter (CSV)</a>
        </>} />
      {check && (
        <div className={`alert ${check.intact ? 'alert-success' : 'alert-danger'}`}>
          {check.intact ? `Journal intact : ${check.checked} entrées vérifiées.` : `Anomalies détectées (${check.problems.length}) :`}
          {!check.intact && <ul>{check.problems.map((p: any, i: number) => <li key={i}>n° {p.seq} — {p.issue}</li>)}</ul>}
        </div>
      )}
      <div className="filters">
        <input placeholder="Administrateur (e-mail)" aria-label="Administrateur" onChange={(e) => set({ admin: e.target.value })} style={{ maxWidth: 240 }} />
        <input placeholder="Action (ex. finance, auth.login)" aria-label="Action" onChange={(e) => set({ action: e.target.value })} style={{ maxWidth: 240 }} />
        <input type="date" aria-label="Du" onChange={(e) => set({ from: e.target.value })} style={{ maxWidth: 170 }} />
        <input type="date" aria-label="Au" onChange={(e) => set({ to: e.target.value })} style={{ maxWidth: 170 }} />
      </div>
      <Filters params={params} set={set} selects={[{ key: 'result', label: 'Résultat', options: [['success', 'Succès'], ['failure', 'Échec']] }]} />
      <ErrorBox error={error} />
      <Card>
        <Table rows={data?.items} onRowClick={setOpen} columns={[
          { key: 'seq', label: 'N°', render: (e: any) => <span className="mono">{e.seq}</span> },
          { key: 'at', label: 'Date et heure', render: (e: any) => dateTime(e.at) },
          { key: 'adminEmail', label: 'Administrateur' },
          { key: 'action', label: 'Action', render: (e: any) => <span className="mono">{e.action}</span> },
          { key: 'target', label: 'Objet', render: (e: any) => (e.targetType ? <>{e.targetType}<div className="mono">{e.targetId}</div></> : '—') },
          { key: 'ip', label: 'IP', render: (e: any) => <span className="mono">{e.ip}</span> },
          { key: 'result', label: 'Résultat', render: (e: any) => <Badge status={e.result === 'success' ? 'validated' : 'rejected'}>{e.result === 'success' ? 'Succès' : 'Échec'}</Badge> },
        ]} />
        <Pager data={data} onPage={setPage} />
      </Card>
      {open && (
        <Modal title={`Entrée n° ${open.seq}`} onClose={() => setOpen(null)} wide>
          <p className="small">{dateTime(open.at)} · {open.adminEmail} · {open.userAgent}</p>
          <pre className="mono" style={{ whiteSpace: 'pre-wrap', background: 'var(--surface-2)', padding: 12, borderRadius: 8 }}>{JSON.stringify(open.details ?? {}, null, 2)}</pre>
          <p className="small muted mono">Sceau : {open.hmac}</p>
        </Modal>
      )}
    </>
  );
}
