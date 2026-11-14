import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { config } from '../config';

const BREVO_API = 'https://api.brevo.com/v3';

/**
 * Envois transactionnels via Brevo (e-mail et SMS).
 * En développement sans clé API, le contenu est écrit dans la console du serveur.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('Brevo');

  get emailReady() {
    return !!(config.brevo.apiKey && config.brevo.senderEmail);
  }

  get smsReady() {
    return !!(config.brevo.apiKey && config.brevo.smsSender);
  }

  private async post(path: string, body: unknown) {
    const res = await fetch(`${BREVO_API}${path}`, {
      method: 'POST',
      headers: { 'api-key': config.brevo.apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Échec Brevo ${path} (${res.status}) : ${text.slice(0, 300)}`);
      throw new ServiceUnavailableException("L'envoi du message a échoué. Réessayez dans un instant.");
    }
  }

  async sendEmail(to: { email: string; name?: string }, subject: string, html: string, text: string) {
    // Domaines réservés (RFC 2606) : jamais envoyés, pour ne pas générer de rebonds pendant les tests.
    if (!config.isProd && /@([\w-]+\.)*(test|local|example|invalid|localhost)$|@example\.(com|org|net)$/i.test(to.email)) {
      this.logger.warn(`[DEV – domaine réservé, non envoyé] E-mail à ${to.email} : ${subject} — ${text}`);
      return;
    }
    if (!this.emailReady) {
      if (config.isProd) throw new ServiceUnavailableException('Envoi d’e-mails non configuré');
      this.logger.warn(`[DEV – Brevo non configuré] E-mail à ${to.email} : ${subject} — ${text}`);
      return;
    }
    await this.post('/smtp/email', {
      sender: { email: config.brevo.senderEmail, name: config.brevo.senderName },
      to: [to],
      subject,
      htmlContent: html,
      textContent: text,
      tags: ['transactionnel'],
    });
  }

  async sendSms(phone: string, content: string) {
    const recipient = phone.replace(/[^\d]/g, '');
    if (!this.smsReady) {
      if (config.isProd) throw new ServiceUnavailableException('Envoi de SMS non configuré');
      this.logger.warn(`[DEV – SMS Brevo non configuré] SMS à +${recipient} : ${content}`);
      return;
    }
    await this.post('/transactionalSMS/sms', { sender: config.brevo.smsSender, recipient, content, type: 'transactional' });
  }
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Gabarit d'e-mail sobre, compatible avec les clients mail courants. */
export function emailLayout(title: string, bodyHtml: string) {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1a1f29">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;padding:28px">
<tr><td><div style="font-weight:700;font-size:16px;margin-bottom:16px"><span style="display:inline-block;background:#f2a900;color:#111;border-radius:6px;padding:2px 7px;margin-right:6px">PA</span>${escapeHtml(config.brevo.senderName)}</div>
<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1>${bodyHtml}
<p style="font-size:12px;color:#667085;margin-top:24px">Vous recevez cet e-mail suite à une action sur votre compte. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.</p>
</td></tr></table></td></tr></table></body></html>`;
}
