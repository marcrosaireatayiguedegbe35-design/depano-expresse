'use client';

import { api } from '@/lib/api';
import { dateTime, fcfa } from '@/lib/format';
import { PageTitle } from '@/components/chrome';
import { Badge, Empty, ErrorBox, Loading, useFetch, useToast } from '@/components/ui';

export default function OrdersPage() {
  const toast = useToast();
  const { data, error, reload } = useFetch<any>('/orders?limit=50');
  return (
    <>
      <PageTitle title="Mes commandes" back="/compte" />
      <ErrorBox error={error} />
      {!data ? <Loading /> : data.items.length === 0 ? <Empty icon="📦" title="Aucune commande" /> : data.items.map((o: any) => (
        <div key={o._id} className="card">
          <div className="hstack between"><h3>{o.number}</h3><Badge status={o.status} /></div>
          <p className="xs muted" style={{ margin: '4px 0 8px' }}>{dateTime(o.createdAt)} · {o.paymentMethod === 'cash_on_delivery' ? 'Paiement à la livraison' : 'Mobile Money'}</p>
          {o.items.map((i: any) => (
            <div key={i.productId} className="hstack between small" style={{ padding: '4px 0' }}><span>{i.quantity} × {i.name}</span><span>{fcfa(i.unitPrice * i.quantity)}</span></div>
          ))}
          <div className="total-line" style={{ paddingBottom: 4 }}><span>Total</span><span className="price">{fcfa(o.total)}</span></div>
          <p className="xs muted">Livraison : {o.delivery?.address}, {o.delivery?.commune}</p>
          {o.status === 'pending' && (
            <button className="btn btn-sm btn-danger mt" onClick={async () => {
              if (!confirm('Annuler cette commande ?')) return;
              try { await api(`/orders/${o._id}/cancel`, { method: 'POST' }); toast('Commande annulée'); reload(); } catch (e: any) { toast(e.message, 'danger'); }
            }}>Annuler la commande</button>
          )}
        </div>
      ))}
    </>
  );
}
