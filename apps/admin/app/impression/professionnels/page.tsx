'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api, qs } from '@/lib/api';
import { dateTime, personName, STATUS, TRADES } from '@/lib/format';

const AVAIL: Record<string, string> = { available: 'Disponible', busy: 'Occupé', unavailable: 'Indisponible' };

/** Liste imprimable des prestataires (enregistrée en PDF depuis la fenêtre d'impression du navigateur). */
function PrintList() {
  const sp = useSearchParams();
  const status = sp.get('status') ?? '';
  const trade = sp.get('trade') ?? '';
  const availability = sp.get('availability') ?? '';
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api(`/professionals/export${qs({ status: status || undefined, trade: trade || undefined, availability: availability || undefined })}`)
      .then((d) => { setData(d); setTimeout(() => window.print(), 600); })
      .catch((e) => setError(e.message));
  }, [status, trade, availability]);

  const filters = [
    status ? `Vérification : ${STATUS[status]?.[0] ?? status}` : 'Toutes vérifications',
    trade ? `Métier : ${TRADES[trade] ?? trade}` : 'Tous métiers',
    availability ? `Disponibilité : ${AVAIL[availability]}` : 'Toutes disponibilités',
  ].join(' · ');

  if (error) return <div className="pr-page"><p className="pr-err">{error}. Connectez-vous au back-office puis réessayez.</p></div>;
  if (!data) return <div className="pr-page"><p className="pr-wait">Préparation de la liste…</p></div>;

  return (
    <div className="pr-page">
      <div className="pr-actions">
        <button onClick={() => window.print()}>Imprimer / Enregistrer en PDF</button>
        <button className="ghost" onClick={() => window.close()}>Fermer</button>
      </div>
      <header className="pr-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-depanno-expresse.png" alt="Depanno Expresse" />
        <div>
          <h1>Liste des prestataires</h1>
          <p>{filters}</p>
          <p>Éditée le {dateTime(data.generatedAt)} · <b>{data.total}</b> prestataire{data.total > 1 ? 's' : ''}</p>
        </div>
      </header>
      <table className="pr-table">
        <thead>
          <tr><th>#</th><th>Prestataire</th><th>Métier</th><th>Contact</th><th>Localisation</th><th>Position GPS</th><th>Zone · horaires</th><th>Statut</th><th>Note</th></tr>
        </thead>
        <tbody>
          {data.items.length === 0 ? <tr><td colSpan={9} className="pr-empty">Aucun prestataire pour ces critères.</td></tr> : data.items.map((p: any, i: number) => {
            const [lng, lat] = p.location?.coordinates ?? [];
            return (
              <tr key={p._id}>
                <td>{i + 1}</td>
                <td><b>{[p.firstName, p.lastName].filter(Boolean).join(" ") || personName(p)}</b>{p.businessName && <div className="pr-sub">{p.businessName}</div>}</td>
                <td>{TRADES[p.trade] ?? p.trade}{p.services?.length ? <div className="pr-sub">{p.services.slice(0, 4).join(', ')}</div> : null}</td>
                <td><b>{p.phone ?? '—'}</b><div className="pr-sub">{p.email ?? ''}</div></td>
                <td>{[p.quartier, p.commune].filter(Boolean).join(', ') || '—'}{p.address && <div className="pr-sub">{p.address}</div>}</td>
                <td>{lat !== undefined ? <><span className="pr-mono">{Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}</span><div className="pr-sub"><a href={`https://maps.google.com/?q=${lat},${lng}`}>Voir sur la carte</a></div></> : '—'}</td>
                <td>{p.zoneRadiusKm ? `${p.zoneRadiusKm} km` : '—'}{p.hours && <div className="pr-sub">{p.hours}</div>}</td>
                <td>{STATUS[p.verificationStatus]?.[0] ?? p.verificationStatus}<div className="pr-sub">{AVAIL[p.availability] ?? ''}</div></td>
                <td>{p.reviewsCount ? `★ ${Number(p.rating).toFixed(1)} (${p.reviewsCount})` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <footer className="pr-foot">Document interne Depanno Expresse — contient des données personnelles : ne pas diffuser.</footer>
    </div>
  );
}

export default function Page() {
  return <Suspense><PrintList /></Suspense>;
}
