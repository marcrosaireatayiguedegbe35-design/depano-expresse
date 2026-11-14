'use client';

import { useState } from 'react';
import { qs } from '@/lib/api';
import { date, fcfa } from '@/lib/format';
import { useCan } from '@/components/admin-context';
import { Card, ErrorBox, PageHeader, Stat, Table, useFetch } from '@/components/ui';
import { Icon } from '@/components/icons';

const JOURNALS: Record<string, string> = { BQ: 'Banque', VT: 'Ventes', OD: 'Opérations diverses' };

const startOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-CA'); };
const today = () => new Date().toLocaleDateString('en-CA');

export default function AccountingPage() {
  const can = useCan();
  const [range, setRange] = useState({ from: '', to: '' });
  const [page, setPage] = useState(1);
  const { data, error } = useFetch<any>(`/accounting/ledger${qs({ ...range, page, limit: 50 })}`);
  const s = data?.summary;
  const pages = data ? Math.ceil(data.total / data.limit) : 1;
  const preset = (from: string, to: string) => { setRange({ from, to }); setPage(1); };

  return (
    <>
      <PageHeader title="Comptabilité" subtitle="Journal comptable en partie double, soldes par compte et export pour votre expert-comptable."
        actions={can('finance.export') && <a className="btn btn-primary" href={`/api/accounting/export${qs(range)}`}><Icon name="doc" /> Exporter le journal (CSV)</a>} />

      <Card>
        <div className="filters" style={{ marginBottom: 0 }}>
          <label className="hstack gap small" style={{ margin: 0 }}>Du <input type="date" value={range.from} onChange={(e) => preset(e.target.value, range.to)} style={{ width: 'auto' }} /></label>
          <label className="hstack gap small" style={{ margin: 0 }}>au <input type="date" value={range.to} onChange={(e) => preset(range.from, e.target.value)} style={{ width: 'auto' }} /></label>
          <div className="tabs">
            <button className={`tab ${!range.from && !range.to ? 'active' : ''}`} onClick={() => preset('', '')}>Tout</button>
            <button className={`tab ${range.from === startOfMonth() ? 'active' : ''}`} onClick={() => preset(startOfMonth(), today())}>Ce mois</button>
            <button className={`tab ${range.from === `${new Date().getFullYear()}-01-01` ? 'active' : ''}`} onClick={() => preset(`${new Date().getFullYear()}-01-01`, today())}>Cette année</button>
          </div>
        </div>
      </Card>

      <ErrorBox error={error} />
      {s && (
        <>
          <div className="stats">
            <Stat label="Chiffre d’affaires plateforme" value={fcfa(s.platformRevenue)} icon="coins" tone="success" hint="Commissions + marketplace + publicité" />
            <Stat label="Commissions sur interventions" value={fcfa(s.commissions)} icon="percent" />
            <Stat label="Ventes marketplace" value={fcfa(s.marketplace)} icon="cart" />
            <Stat label="Recettes publicitaires" value={fcfa(s.advertising)} icon="megaphone" />
            <Stat label="Dû aux professionnels" value={fcfa(s.dueToProfessionals)} icon="users" tone={s.dueToProfessionals > 0 ? 'warning' : undefined} hint="Solde à reverser (compte 4011)" />
            <Stat label="Trésorerie (mouvements)" value={fcfa(s.treasury)} icon="cash" hint="Solde du compte 5211 sur la période" />
          </div>
          <div className={`alert ${s.balanced ? 'alert-success' : 'alert-danger'}`}>
            {s.balanced
              ? `Journal équilibré : total débit = total crédit = ${fcfa(s.totalDebit)}.`
              : `Déséquilibre détecté : débit ${fcfa(s.totalDebit)} ≠ crédit ${fcfa(s.totalCredit)}.`}
          </div>

          <div className="grid grid-2" style={{ alignItems: 'start' }}>
            <Card icon="layers" title="Balance des comptes" subtitle="Plan de comptes indicatif (SYSCOHADA) – à valider avec l’expert-comptable">
              <Table rows={data.balances} columns={[
                { key: 'account', label: 'Compte', render: (b: any) => <strong className="mono">{b.account}</strong> },
                { key: 'label', label: 'Intitulé' },
                { key: 'debit', label: 'Débit', align: 'right', render: (b: any) => fcfa(b.debit) },
                { key: 'credit', label: 'Crédit', align: 'right', render: (b: any) => fcfa(b.credit) },
                { key: 'balance', label: 'Solde', align: 'right', render: (b: any) => <strong>{b.balance >= 0 ? `D ${fcfa(b.balance)}` : `C ${fcfa(-b.balance)}`}</strong> },
              ]} />
            </Card>
            <Card icon="bulb" title="Règles appliquées">
              <ul className="small" style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.7 }}>
                <li>Encaissement d’une intervention : <b>5211</b> au débit ; commission <b>7061</b> et part du professionnel <b>4011</b> au crédit.</li>
                <li>Seule la commission est un produit de la plateforme : les fonds des professionnels transitent pour leur compte.</li>
                <li>Remboursement : écritures inverses au prorata (commission et part du professionnel).</li>
                <li>Reversement : <b>4011</b> au débit, <b>5211</b> au crédit.</li>
                <li>Marketplace : vente reconnue à la livraison (<b>7011</b>). Publicité : à la date de début de campagne (<b>7062</b>).</li>
              </ul>
            </Card>
          </div>

          <Card icon="doc" title="Journal comptable" subtitle={`${data.total} écriture(s) – les plus récentes d’abord`}>
            <Table rows={data.items} empty="Aucune écriture sur la période" columns={[
              { key: 'date', label: 'Date', render: (e: any) => <span className="nowrap">{date(e.date)}</span> },
              { key: 'journal', label: 'Journal', render: (e: any) => JOURNALS[e.journal] ?? e.journal },
              { key: 'piece', label: 'Pièce', render: (e: any) => <span className="mono">{e.piece}</span> },
              { key: 'account', label: 'Compte', render: (e: any) => <span title={data.accounts[e.account]}><strong className="mono">{e.account}</strong> <span className="small muted">{data.accounts[e.account]}</span></span> },
              { key: 'label', label: 'Libellé' },
              { key: 'debit', label: 'Débit', align: 'right', render: (e: any) => (e.debit ? fcfa(e.debit) : '') },
              { key: 'credit', label: 'Crédit', align: 'right', render: (e: any) => (e.credit ? fcfa(e.credit) : '') },
            ]} />
            {pages > 1 && (
              <div className="pager">
                <span className="muted small">Page {page} / {pages}</span>
                <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Précédent</button>
                <button className="btn btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Suivant →</button>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
