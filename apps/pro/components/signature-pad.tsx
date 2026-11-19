'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

export interface SignaturePadHandle {
  clear: () => void;
  /** Image PNG (data URL) de la signature, ou null si le tracé est trop court. */
  toDataUrl: () => string | null;
}

/** Cadre de signature tracée au doigt (ou à la souris), net sur les écrans haute densité. */
export const SignaturePad = forwardRef<SignaturePadHandle, { onChange?: (hasInk: boolean) => void }>(function SignaturePad({ onChange }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const ink = useRef(0); // longueur totale tracée (px CSS)
  const [empty, setEmpty] = useState(true);

  const setup = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0b1a3c';
    ctx.lineWidth = 2.6;
    ink.current = 0;
    setEmpty(true);
    onChange?.(false);
  }, [onChange]);

  useEffect(() => {
    setup();
    // Rotation de l'écran : le cadre change de taille, la signature est effacée (évite un tracé déformé).
    const onResize = () => { if (ink.current === 0) setup(); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setup]);

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  useImperativeHandle(ref, () => ({
    clear: setup,
    toDataUrl: () => {
      const c = canvas.current;
      if (!c || ink.current < 60) return null;
      // Réduction à 900 px de large au plus : fichier léger, qualité suffisante pour le PDF.
      const scale = Math.min(1, 900 / c.width);
      const out = document.createElement('canvas');
      out.width = Math.round(c.width * scale);
      out.height = Math.round(c.height * scale);
      out.getContext('2d')!.drawImage(c, 0, 0, out.width, out.height);
      return out.toDataURL('image/png');
    },
  }), [setup]);

  return (
    <div className={`sig-pad${empty ? ' empty' : ''}`}>
      <canvas
        ref={canvas}
        aria-label="Zone de signature : tracez votre signature avec le doigt"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          last.current = point(e);
          const ctx = canvas.current!.getContext('2d')!;
          ctx.beginPath();
          ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2);
          ctx.fillStyle = '#0b1a3c';
          ctx.fill();
        }}
        onPointerMove={(e) => {
          if (!drawing.current || !last.current) return;
          const p = point(e);
          const ctx = canvas.current!.getContext('2d')!;
          ctx.beginPath();
          ctx.moveTo(last.current.x, last.current.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          ink.current += Math.hypot(p.x - last.current.x, p.y - last.current.y);
          last.current = p;
          if (empty && ink.current > 4) { setEmpty(false); }
          onChange?.(ink.current >= 60);
        }}
        onPointerUp={() => { drawing.current = false; last.current = null; }}
        onPointerCancel={() => { drawing.current = false; last.current = null; }}
      />
      <span className="sig-line" aria-hidden />
      {empty && <span className="sig-hint" aria-hidden>Signez ici avec le doigt</span>}
    </div>
  );
});
