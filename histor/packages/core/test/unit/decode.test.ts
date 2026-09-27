/**
 * Juego de caracteres de los feeds: el BOE sirve ISO-8859-1 y se leía como
 * UTF-8, así que los titulares salían con «�» (visto el 27-09-2026).
 */
import { describe, expect, it } from 'vitest';
import { decodeBody } from '../../src/ingest/fetcher';

const latin1 = (s: string) => new Uint8Array(Buffer.from(s, 'latin1'));

describe('decodificación del cuerpo', () => {
  const boe = '<?xml version="1.0" encoding="ISO-8859-1"?><rss><channel><title>Resolución de la Secretaría General Técnica</title></channel></rss>';

  it('respeta el charset de la cabecera Content-Type', () => {
    expect(decodeBody(latin1(boe), 'text/xml; charset=ISO-8859-1')).toContain('Resolución de la Secretaría General Técnica');
  });

  it('sin charset en la cabecera, usa la declaración XML', () => {
    expect(decodeBody(latin1(boe), 'text/xml')).toContain('Resolución');
    expect(decodeBody(latin1(boe), null)).not.toContain('�');
  });

  it('usa <meta charset> en HTML', () => {
    const html = '<html><head><meta charset="windows-1252"></head><body>Año €</body></html>';
    expect(decodeBody(new Uint8Array(Buffer.from([...Buffer.from(html.replace('€', ''), 'latin1'), 0x80])), 'text/html')).toContain('Año');
  });

  it('por defecto, UTF-8 (y un charset desconocido no rompe)', () => {
    const utf8 = new Uint8Array(Buffer.from('Ação – Straße', 'utf8'));
    expect(decodeBody(utf8, 'application/rss+xml')).toBe('Ação – Straße');
    expect(decodeBody(utf8, 'text/xml; charset=x-desconocido')).toBe('Ação – Straße');
  });
});
