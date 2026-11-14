'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { dateTime, fcfa, personName, STATUS } from '@/lib/format';
import { useCan } from '@/components/admin-context';
import { Badge, Card, ErrorBox, Filters, KV, Modal, PageHeader, Pager, Table, useList, useToast } from '@/components/ui';

const NEXT: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'], preparing: ['shipped', 'cancelled'], shipped: ['delivered'],
};
const PAY: Record<string, string> = { mobile_money: 'Mobile Money', card: 'Carte bancaire', cash_on_delivery: 'À la livraison' };

function OrderModal({ order, onClose, onDone }: { order: any; onClose: () => void; onDone: () => void }) {
  const can = useCan();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const move = async (status: string) => {
    try {
      await api(`/orders/${order._id}/status`, { method: 'POST', body: { status, note: note || undefined } });
      toast('Commande mise à jour');
      onDone();
      onClose();
    } catch (e: any) { setError(e.message); }
  };
  return (
    <Modal title={`Commande ${order.number}`} onClose={onClose} wide>
      <KV items={[
        ['Client', personName(order.clientId)], ['Téléphone', order.delivery?.phone], ['Livraison', order.delivery?.address],
        ['Paiement', `${PAY[order.paymentMethod] ?? '—'} · ${order.paymentStatus}`], ['Statut', <Badge key="s" status={order.status} />],
      ]} />
      <div style={{ marginTop: 12 }}>
        <Table rows={order.items} columns={[
          { key: 'name', label: 'Article' }, { key: 'quantity', label: 'Qté', align: 'right' },
          { key: 'unitPrice', label: 'P.U.', align: 'right', render: (i: any) => fcfa(i.unitPrice) },
          { key: 't', label: 'Total', align: 'right', render: (i: any) => fcfa(i.unitPrice * i.quantity) },
        ]} />
        <p className="right"><strong>Total : {fcfa(order.total)}</strong></p>
      </div>
      <h3>Suivi</h3>
      <ul className="timeline small">{order.history?.map((h: any, i: number) => <li key={i}>{STATUS[h.status]?.[0]} · {dateTime(h.at)} · {h.by}{h.note && ` — ${h.note}`}</li>)}</ul>
      {can('orders.write') && NEXT[order.status] && (
        <>
          <div className="field"><label htmlFor="note">Note de suivi (facultatif)</label><input id="note" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <ErrorBox error={error} />
          <div className="hstack gap end">
            {NEXT[order.status].map((s) => (
              <button key={s} className={`btn ${s === 'cancelled' ? 'btn-danger' : 'btn-primary'}`} onClick={() => move(s)}>{STATUS[s][0]}</button>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

export default function OrdersPage() {
  const { data, error, params, set, setPage, reload } = useList('/orders');
  const [open, setOpen] = useState<any>(null);
  return (
    <>
      <PageHeader title="Commandes" subtitle="Commandes de la marketplace (paiements gérés séparément des interventions, sans commission de 20 %)." />
      <Filters params={params} set={set} search="N° de commande, téléphone…" selects={[{ key: 'status', label: 'Statut', options: ['pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'].map((s) => [s, STATUS[s][0]]) }]} />
      <ErrorBox error={error} />
      <Card>
        <Table rows={data?.items} onRowClick={setOpen} columns={[
          { key: 'number', label: 'N°', render: (o: any) => <strong>{o.number}</strong> },
          { key: 'createdAt', label: 'Date', render: (o: any) => dateTime(o.createdAt) },
          { key: 'client', label: 'Client', render: (o: any) => personName(o.clientId) },
          { key: 'items', label: 'Articles', render: (o: any) => o.items.map((i: any) => `${i.quantity}× ${i.name}`).join(', ') },
          { key: 'total', label: 'Total', align: 'right', render: (o: any) => fcfa(o.total) },
          { key: 'pay', label: 'Paiement', render: (o: any) => PAY[o.paymentMethod] },
          { key: 'status', label: 'Statut', render: (o: any) => <Badge status={o.status} /> },
        ]} />
        <Pager data={data} onPage={setPage} />
      </Card>
      {open && <OrderModal order={open} onClose={() => setOpen(null)} onDone={reload} />}
    </>
  );
}
