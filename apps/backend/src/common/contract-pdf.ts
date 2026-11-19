import { readFileSync } from 'fs';
import { join } from 'path';
import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { ContractDoc, ID_KINDS } from './contract';

const A4: [number, number] = [595.28, 841.89];
const M = 56; // marges
const ORANGE = rgb(1, 0.478, 0.071);
const INK = rgb(0.13, 0.15, 0.2);
const GREY = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.86, 0.87, 0.9);

let logoBytes: Buffer | null | undefined;
function logo() {
  if (logoBytes !== undefined) return logoBytes;
  try { logoBytes = readFileSync(join(__dirname, '..', '..', 'assets', 'logo-depanno-expresse.png')); } catch { logoBytes = null; }
  return logoBytes;
}

export interface SignedContract {
  doc: ContractDoc;
  textHash: string;
  signatureDataUrl: string;
  signedName: string;
  signedAt: Date;
  ip?: string;
  userAgent?: string;
  idKind: string;
  idNumber: string;
  contractId: string;
  companyStamp?: Uint8Array | null;
  companyName: string;
  companyRepresentative?: string;
}

const dt = (d: Date) => d.toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Africa/Porto-Novo' });

/** Les polices standard du PDF ne couvrent que le jeu WinAnsi : tout autre caractère est translittéré. */
function safe(font: PDFFont, s: string) {
  const set = new Set(font.getCharacterSet());
  let out = '';
  for (const ch of s.replace(/ | /g, ' ')) {
    if (set.has(ch.codePointAt(0)!)) { out += ch; continue; }
    const plain = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    out += [...plain].every((c) => set.has(c.codePointAt(0)!)) ? plain : '?';
  }
  return out;
}

function wrap(font: PDFFont, text: string, size: number, width: number) {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue; }
      if (line) lines.push(line);
      // mot plus long que la ligne (empreinte, adresse…) : coupé
      let w = word;
      while (font.widthOfTextAtSize(w, size) > width) {
        let n = w.length;
        while (n > 1 && font.widthOfTextAtSize(w.slice(0, n), size) > width) n--;
        lines.push(w.slice(0, n));
        w = w.slice(n);
      }
      line = w;
    }
    lines.push(line);
  }
  return lines;
}

/** PDF officiel du contrat signé : en-tête, texte intégral, bloc de signatures et certificat de signature. */
export async function contractPdf(s: SignedContract): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${s.doc.title} – ${s.doc.reference}`);
  pdf.setAuthor(s.companyName);
  pdf.setSubject(`Contrat signé par ${s.signedName}`);
  pdf.setCreator('Depanno Expresse');
  pdf.setCreationDate(s.signedAt);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const lb = logo();
  const logoImg: PDFImage | null = lb ? await pdf.embedPng(lb).catch(() => null) : null;
  const sigImg = await pdf.embedPng(Buffer.from(s.signatureDataUrl.split(',')[1] ?? '', 'base64')).catch(() => null);
  let stampImg: PDFImage | null = null;
  if (s.companyStamp) stampImg = await pdf.embedPng(s.companyStamp).catch(() => pdf.embedJpg(s.companyStamp!).catch(() => null));

  const W = A4[0] - 2 * M;
  let page!: PDFPage;
  let y = 0;

  const header = () => {
    page = pdf.addPage(A4);
    y = A4[1] - M + 14;
    if (logoImg) {
      const h = 30; const w = (logoImg.width / logoImg.height) * h;
      page.drawImage(logoImg, { x: M, y: y - h + 6, width: w, height: h });
    } else {
      page.drawText('Depanno Expresse', { x: M, y: y - 14, size: 15, font: bold, color: ORANGE });
    }
    const t1 = safe(bold, s.doc.title); const t2 = safe(font, `Réf. ${s.doc.reference} · version ${s.doc.version}`);
    page.drawText(t1, { x: A4[0] - M - bold.widthOfTextAtSize(t1, 9), y: y - 6, size: 9, font: bold, color: INK });
    page.drawText(t2, { x: A4[0] - M - font.widthOfTextAtSize(t2, 8), y: y - 18, size: 8, font, color: GREY });
    y -= 34;
    page.drawLine({ start: { x: M, y }, end: { x: A4[0] - M, y }, thickness: 1.5, color: ORANGE });
    y -= 22;
  };
  const ensure = (h: number) => { if (y - h < M + 24) header(); };
  const text = (str: string, o: { size?: number; f?: PDFFont; color?: any; gap?: number; indent?: number; center?: boolean } = {}) => {
    const size = o.size ?? 10; const f = o.f ?? font; const lh = size * 1.42; const indent = o.indent ?? 0;
    for (const line of wrap(f, safe(f, str), size, W - indent)) {
      ensure(lh);
      const x = o.center ? (A4[0] - f.widthOfTextAtSize(line, size)) / 2 : M + indent;
      page.drawText(line, { x, y: y - size, size, font: f, color: o.color ?? INK });
      y -= lh;
    }
    y -= o.gap ?? 6;
  };

  header();
  text(s.doc.title.toUpperCase(), { size: 16, f: bold, center: true, gap: 2 });
  text(`Version ${s.doc.version} – Référence ${s.doc.reference}`, { size: 9, color: GREY, center: true, gap: 16 });
  s.doc.parties.forEach((p, i) => text(p, { f: i === 0 || p === 'ET' ? bold : font, gap: 8 }));
  y -= 4;
  for (const a of s.doc.articles) {
    ensure(40);
    text(a.title, { size: 11, f: bold, color: ORANGE, gap: 3 });
    a.paras.forEach((p) => text(p, { gap: 5 }));
    y -= 4;
  }
  text(s.doc.closing, { f: bold, gap: 14 });

  // Bloc des signatures
  ensure(150);
  const colW = (W - 20) / 2;
  const top = y;
  const box = (x: number, title: string, lines: string[], img: PDFImage | null) => {
    page.drawRectangle({ x, y: top - 140, width: colW, height: 140, borderColor: LINE, borderWidth: 1, color: rgb(0.985, 0.985, 0.99) });
    page.drawText(safe(bold, title), { x: x + 10, y: top - 18, size: 10, font: bold, color: INK });
    lines.forEach((l, i) => page.drawText(safe(font, l).slice(0, 60), { x: x + 10, y: top - 32 - i * 11, size: 8, font, color: GREY }));
    if (img) {
      const maxW = colW - 20; const maxH = 62;
      const r = Math.min(maxW / img.width, maxH / img.height);
      page.drawImage(img, { x: x + 10, y: top - 132, width: img.width * Math.min(r, 1.5), height: img.height * Math.min(r, 1.5) });
    }
  };
  box(M, 'Pour la Plateforme', [s.companyName, s.companyRepresentative ? `Représentée par ${s.companyRepresentative}` : 'Signature et cachet'], stampImg);
  box(M + colW + 20, 'Le Partenaire', [`${s.signedName} – « Lu et approuvé »`, `Signé le ${dt(s.signedAt)}`], sigImg);
  y = top - 156;

  // Certificat de signature électronique
  header();
  text('CERTIFICAT DE SIGNATURE ÉLECTRONIQUE', { size: 14, f: bold, gap: 4 });
  text('Ce certificat atteste des conditions dans lesquelles le contrat ci-dessus a été signé. Il fait partie intégrante du contrat.', { color: GREY, gap: 14 });
  const rows: [string, string][] = [
    ['Document', `${s.doc.title} – version ${s.doc.version}`],
    ['Référence', s.doc.reference],
    ['Identifiant de signature', s.contractId],
    ['Signataire', s.signedName],
    ['Pièce d’identité', `${ID_KINDS[s.idKind] ?? s.idKind} n° ${s.idNumber}`],
    ['Date et heure de signature', `${dt(s.signedAt)} (heure du Bénin)`],
    ['Moyen de signature', 'Signature manuscrite tracée au doigt sur écran, après acceptation expresse du texte'],
    ['Adresse IP', s.ip || 'non disponible'],
    ['Appareil', (s.userAgent || 'non disponible').slice(0, 180)],
    ['Empreinte SHA-256 du texte signé', s.textHash],
  ];
  for (const [k, v] of rows) {
    const lines = wrap(font, safe(font, v), 9, W - 170);
    ensure(lines.length * 13 + 8);
    page.drawText(safe(bold, k), { x: M, y: y - 9, size: 9, font: bold, color: INK });
    lines.forEach((l, i) => page.drawText(l, { x: M + 170, y: y - 9 - i * 13, size: 9, font, color: INK }));
    y -= lines.length * 13 + 6;
    page.drawLine({ start: { x: M, y }, end: { x: A4[0] - M, y }, thickness: 0.5, color: LINE });
    y -= 8;
  }
  y -= 6;
  text('L’empreinte SHA-256 est calculée sur le texte intégral du contrat au moment de la signature. Toute modification du texte, même d’un seul caractère, produirait une empreinte différente. La Plateforme conserve le texte original, la signature et ces éléments de preuve.', { size: 8.5, color: GREY });

  // Pied de page numéroté
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const f = safe(font, `${s.doc.reference} · Empreinte ${s.textHash.slice(0, 16)}… · Page ${i + 1}/${pages.length}`);
    p.drawText(f, { x: (A4[0] - font.widthOfTextAtSize(f, 7.5)) / 2, y: M - 26, size: 7.5, font, color: GREY });
  });
  return pdf.save();
}
