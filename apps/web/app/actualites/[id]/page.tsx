'use client';

import { useEffect } from 'react';
import { api } from '@/lib/api';
import { date } from '@/lib/format';
import { Icon } from '@/components/icons';
import { BackButton } from '@/components/ds';
import { ErrorBox, Loading, useFetch } from '@/components/ui';

/** Détail d'une actualité ou d'une offre partenaire. */
export default function NewsDetail({ params }: { params: { id: string } }) {
  const { data: a, error } = useFetch<any>(`/ads/${params.id}`);
  useEffect(() => { if (a?._id && a.status !== 'ended') api(`/ads/${a._id}/impression`, { method: 'POST' }).catch(() => {}); }, [a?._id, a?.status]);
  if (error) return <div className="screen"><div className="page-head"><BackButton href="/actualites" /></div><ErrorBox error={error} /></div>;
  if (!a) return <div className="screen"><Loading rows={3} /></div>;
  const href = a.link || a.website || a.companyId?.website;
  return (
    <div className="screen">
      <div className="cover-hero">
        {a.imageUrl ? <img className="bg" src={a.imageUrl} alt="" /> : <div className="ph"><Icon name="megaphone" /></div>}
        <div className="cover-tools"><BackButton href="/actualites" /></div>
      </div>
      <span className="tagpill-o">{a.sponsoredLabel || (a.kind === 'news' ? 'Actualité' : 'Publicité')}</span>
      <h1 className="pro-title" style={{ fontSize: 24 }}>{a.title}</h1>
      <p className="meta" style={{ marginTop: 8 }}><span><Icon name="calendar" />{date(a.startAt)}</span>{a.companyId?.name && <><i className="sep" /><span><Icon name="buildingFill" />{a.companyId.name}</span></>}</p>
      {a.status === 'ended' && <div className="alert alert-info small" style={{ marginTop: 12 }}>Cette offre est terminée.</div>}
      {a.description && <p className="about expanded section">{a.description}</p>}
      {href && a.status !== 'ended' && (
        <div className="sticky-actions single">
          <a className="btn btn-primary" href={href} target="_blank" rel="sponsored noopener noreferrer" onClick={() => api(`/ads/${a._id}/click`, { method: 'POST' }).catch(() => {})}>En savoir plus<Icon name="arrow" /></a>
        </div>
      )}
    </div>
  );
}
