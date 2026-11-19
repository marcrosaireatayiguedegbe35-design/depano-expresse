import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';
import { PushService } from './push.service';

const owner = '507f1f77bcf86cd799439011';

function models() {
  const store: any = {};
  const deleted: any[] = [];
  const settings = {
    updateOne: async (_q: any, u: any) => { store.value ??= u.$setOnInsert.value; },
    findOne: () => ({ lean: async () => ({ value: store.value }) }),
  };
  const subs = {
    find: () => ({ lean: async () => [
      { _id: 's1', endpoint: 'https://fcm.googleapis.com/fcm/send/1', keys: { p256dh: 'p', auth: 'a' } },
      { _id: 's2', endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/2', keys: { p256dh: 'p', auth: 'a' } },
    ] }),
    deleteOne: async (q: any) => { deleted.push(q); },
  };
  return { store, deleted, settings, subs };
}

test('les clés sont créées une seule fois et gardées en base sans variable d’environnement', async () => {
  delete process.env.VAPID_PUBLIC_KEY; delete process.env.VAPID_PRIVATE_KEY;
  const m = models();
  const svc = new PushService(m.subs as any, m.settings as any);
  svc.onModuleInit();
  assert.equal(await svc.publicKey(), m.store.value.publicKey);
  const again = new PushService(m.subs as any, m.settings as any);
  again.onModuleInit();
  assert.equal(await again.publicKey(), m.store.value.publicKey);
});

test('envoi à chaque appareil, abonnement expiré (410) oublié', async () => {
  const m = models();
  let n = 0;
  const calls: any[] = [];
  const send = mock.method(webpush, 'sendNotification', async (...args: any[]) => {
    calls.push(args);
    if (n++ === 1) throw Object.assign(new Error('gone'), { statusCode: 410 });
    return {} as any;
  });
  const svc = new PushService(m.subs as any, m.settings as any);
  svc.onModuleInit();
  await svc.send([{ recipientType: 'client', recipientId: owner, type: 'order.created', title: 'Commande enregistrée', body: 'CMD-1', link: '/compte/commandes' }]);
  assert.equal(calls.length, 2);
  assert.deepEqual(JSON.parse(calls[0][1]), { title: 'Commande enregistrée', body: 'CMD-1', url: '/compte/commandes', tag: 'order.created' });
  assert.deepEqual(m.deleted, [{ _id: 's2' }]);
  send.mock.restore();
});

test('seuls les services de notification des navigateurs sont acceptés (anti-SSRF)', async () => {
  const { isPushEndpoint } = await import('./push.service');
  for (const ok of ['https://fcm.googleapis.com/fcm/send/abc', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://web.push.apple.com/QK', 'https://wns2-par02p.notify.windows.com/w/?token=1']) assert.ok(isPushEndpoint(ok), ok);
  for (const bad of ['https://localhost/x', 'https://127.0.0.1/x', 'https://169.254.169.254/latest', 'http://fcm.googleapis.com/x', 'https://fcm.googleapis.com.evil.io/x', 'https://evil.io/fcm.googleapis.com', 'https://fcm.googleapis.com:8443/x', 'https://user@fcm.googleapis.com/x']) assert.ok(!isPushEndpoint(bad), bad);
});
