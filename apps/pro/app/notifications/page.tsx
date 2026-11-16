'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { Icon } from '@/components/icons';
import { PushSetting } from '@/components/push';
import { Blob, PageHead } from '@/components/ds';
import { useSession } from '@/components/session';
import { Empty, Loading, useFetch } from '@/components/ui';

const ICON: Record<string, string> = { 'request.new': 'clipboard', 'request.selected': 'checkCircle', 'request.closed': 'close', 'request.cancelled': 'close', 'quotation.accepted': 'checkCircle', 'quotation.rejected': 'close', 'invoice.confirmed': 'docFill', 'invoice.contested': 'info', 'payment.confirmed': 'cardFill' };

export default function NotificationsPage() {
  const { data } = useFetch<any>('/notifications?limit=50');
  const { refresh } = useSession();
  useEffect(() => { if (data?.unread) api('/notifications/read-all', { method: 'POST' }).then(refresh).catch(() => {}); }, [data?.unread, refresh]);
  return (
    <div className="screen">
      <Blob soft />
      <PageHead title="Notifications" back="/profil" />
      <PushSetting />
      {!data ? <Loading rows={4} height={64} /> : data.items.length === 0 ? <Empty icon="bell" title="Aucune notification" /> : (
        <div className="menu-list">
          {data.items.map((n: any) => {
            const inner = <><span className={`ic${n.readAt ? '' : ' violet'}`}><Icon name={ICON[n.type] ?? 'bell'} /></span><span className="grow"><b>{n.title}</b><span className="s">{n.body ? `${n.body} · ` : ''}{dateTime(n.createdAt)}</span></span></>;
            const href = n.link?.startsWith('/interventions/') || n.link?.startsWith('/demandes/') || ['/gains', '/profil/documents'].includes(n.link) ? n.link : n.type?.startsWith('request.') ? '/demandes' : null;
            return href ? <Link key={n._id} href={href} className="menu-card">{inner}<Icon name="chevR" className="chev" /></Link> : <div key={n._id} className="menu-card">{inner}</div>;
          })}
        </div>
      )}
    </div>
  );
}
