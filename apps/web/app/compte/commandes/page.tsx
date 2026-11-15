'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { dateTime, fcfa } from '@/lib/format';
import { PageTitle } from '@/components/chrome';
import { Icon } from '@/components/icons';
import { Badge, Empty, ErrorBox, Loading, Modal, useFetch, useToast } from '@/components/ui';

const STEPS: [string, string][] = [['pending', 'Commandée'], ['confirmed', 'Confirmée'], ['preparing', 'Préparée'], ['shipped', 'En route'], ['delivered', 'Reçue']];
const REASONS = ['Je n’ai rien reçu', 'Il manque des articles', 'Article abîmé ou différent'];

export default function OrdersPage() {
  const toast = useToast();
  const { data, error, reload } = useFetch<any>('/orders?limit=50');
  const [issue, setIssue] = useState<any>(null);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const received = async (o: any) => {
    setBusy(o._id);
    try { await api(`/orders/${o._id}/received`, { method: 'POST' }); toast('Merci ! Réception confirmée'); reload(); }
    catch (e: any) { toast(e.message, 'danger'); }
    finally { setBusy(null); }
  };
  const sendIssue = async () => {
    setBusy(issue._id);
    try {
      await api(`/orders/${issue._id}/not-received`, { method: 'POST', body: { reason: details.trim() ? `${reason} – ${details.trim()}` : reason } });
      toast('Problème signalé : notre équipe vous recontacte');
      setIssue(null); setDetails(''); reload();
    } catch (e: any) { toast(e.message, 'danger'); }
    finally { setBusy(null); }
  };

  return (
    <>
      <PageTitle title="Mes commandes" back="/compte" />
      <ErrorBox error={error} />
      {!data ? <Loading /> : data.items.length === 0 ? (
        <Empty icon="cart" title="Aucune commande"><Link href="/marketplace" className="btn btn-primary btn-md" style={{ marginTop: 14 }}>Voir la boutique</Link></Empty>
      ) : data.items.map((o: any) => {
        const cancelled = o.status === 'cancelled';
        const reached = STEPS.findIndex(([k]) => k === o.status);
        const awaiting = ['shipped', 'delivered'].includes(o.status) && !o.receivedAt;
        return (
          <div key={o._id} className="card ord">
            <div className="hstack between"><h3>{o.number}</h3>{cancelled ? <Badge status="cancelled" /> : o.receivedAt ? <span className="ord-ok"><Icon name="checkCircle" />Reçue</span> : <Badge status={o.status} />}</div>
            <p className="xs muted" style={{ margin: '4px 0 10px' }}>{dateTime(o.createdAt)} · {o.paymentMethod === 'cash_on_delivery' ? 'Paiement à la livraison' : 'Mobile Money'}</p>

            {!cancelled && (
              <ol className="ord-steps" aria-label="Suivi de la commande">
                {STEPS.map(([k, label], i) => {
                  const done = k === 'delivered' ? !!o.receivedAt : i <= reached;
                  return <li key={k} className={done ? 'done' : i === reached + 1 ? 'next' : ''}><span className="dot">{done && <Icon name="check" />}</span><small>{label}</small></li>;
                })}
              </ol>
            )}

            {o.items.map((i: any) => (
              <div key={i.productId} className="hstack between small" style={{ padding: '4px 0' }}><span>{i.quantity} × {i.name}</span><span>{fcfa(i.unitPrice * i.quantity)}</span></div>
            ))}
            <div className="total-line" style={{ paddingBottom: 4 }}><span>Total</span><span className="price">{fcfa(o.total)}</span></div>
            <p className="xs muted">Livraison : {o.delivery?.address}, {o.delivery?.commune}</p>

            {awaiting && (
              <div className="ord-confirm">
                {o.deliveryIssue ? (
                  <p className="small"><b>Problème signalé</b> le {dateTime(o.deliveryIssue.at)} : {o.deliveryIssue.reason}. Notre équipe vous recontacte. Si vous avez finalement reçu votre commande, confirmez-le ci-dessous.</p>
                ) : (
                  <p className="small"><b>Avez-vous reçu votre commande ?</b> Confirmez-le une fois les articles entre vos mains.</p>
                )}
                <div className="ord-btns">
                  <button className="btn btn-primary btn-md" disabled={busy === o._id} onClick={() => received(o)}><Icon name="check" />Oui, je l’ai reçue</button>
                  {!o.deliveryIssue && <button className="btn btn-light btn-md" disabled={busy === o._id} onClick={() => { setIssue(o); setReason(REASONS[0]); setDetails(''); }}>Pas reçue</button>}
                </div>
              </div>
            )}
            {o.receivedAt && <p className="xs ord-done">Réception confirmée le {dateTime(o.receivedAt)}.</p>}

            {o.status === 'pending' && (
              <button className="btn btn-sm btn-danger mt" onClick={async () => {
                if (!confirm('Annuler cette commande ?')) return;
                try { await api(`/orders/${o._id}/cancel`, { method: 'POST' }); toast('Commande annulée'); reload(); } catch (e: any) { toast(e.message, 'danger'); }
              }}>Annuler la commande</button>
            )}
          </div>
        );
      })}

      {issue && (
        <Modal title={`Problème avec ${issue.number}`} onClose={() => setIssue(null)}>
          <p className="small text-2" style={{ marginBottom: 10 }}>Dites-nous ce qui ne va pas : l’équipe Depanno Expresse vous recontacte.</p>
          {REASONS.map((r) => (
            <label key={r} className="radio-row"><input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} /><span className="grow">{r}</span></label>
          ))}
          <div className="field" style={{ marginTop: 10 }}><label htmlFor="det">Précisions (facultatif)</label><textarea id="det" rows={3} maxLength={400} value={details} onChange={(e) => setDetails(e.target.value)} /></div>
          <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={busy === issue._id} onClick={sendIssue}>{busy === issue._id ? 'Envoi…' : 'Signaler le problème'}</button>
        </Modal>
      )}
    </>
  );
}
