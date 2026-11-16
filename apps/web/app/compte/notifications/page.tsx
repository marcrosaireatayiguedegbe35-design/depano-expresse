'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { PageTitle } from '@/components/chrome';
import { Empty, ErrorBox, Loading, useFetch } from '@/components/ui';
import { Icon } from '@/components/icons';
import { PushSetting } from '@/components/push';

export default function NotificationsPage() {
  const { data, error } = useFetch<any>('/notifications?limit=50');
  useEffect(() => {
    if (data?.unread) api('/notifications/read-all', { method: 'POST' }).catch(() => {});
  }, [data?.unread]);
  return (
    <>
      <PageTitle title="Notifications" back="/compte" />
      <PushSetting />
      <ErrorBox error={error} />
      {!data ? <Loading /> : data.items.length === 0 ? <Empty icon="🔔" title="Aucune notification" /> : data.items.map((n: any) => {
        const body = (
          <>
            <span className="loc-pin" style={{ background: n.readAt ? 'var(--soft)' : 'var(--orange)', color: n.readAt ? 'var(--muted)' : '#fff' }}><Icon name="bell" /></span>
            <div className="grow"><h3 style={{ fontWeight: n.readAt ? 500 : 600 }}>{n.title}</h3>{n.body && <p className="small">{n.body}</p>}<p className="xs muted">{dateTime(n.createdAt)}</p></div>
          </>
        );
        return n.link?.startsWith('/') ? <Link key={n._id} href={n.link} className="list-row" style={{ color: 'var(--ink)' }}>{body}</Link> : <div key={n._id} className="list-row">{body}</div>;
      })}
    </>
  );
}
