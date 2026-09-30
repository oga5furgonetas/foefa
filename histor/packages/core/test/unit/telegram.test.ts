/**
 * Promoción automática en Telegram (30-09-2026): titular en negrita, entradilla y enlace, con los
 * caracteres especiales escapados, y un canal por idioma.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { resetEnvCache } from '../../src/env';
import { socialText, telegramChannel } from '../../src/social/index';

afterEach(() => {
  delete process.env.TELEGRAM_CHANNELS;
  resetEnvCache();
});

describe('Telegram', () => {
  it('titular en negrita, entradilla y enlace, con < > & escapados', () => {
    const t = socialText('España gana 4-1 a Croacia & sigue líder <Nations League>', 'https://histor.es/es/2026/09/30/espana', 'telegram', 'La selección goleó en Sevilla.');
    expect(t).toBe('<b>España gana 4-1 a Croacia &amp; sigue líder &lt;Nations League&gt;</b>\n\nLa selección goleó en Sevilla.\n\nhttps://histor.es/es/2026/09/30/espana');
  });

  it('un canal por idioma; sin canal para ese idioma, no se publica', () => {
    process.env.TELEGRAM_CHANNELS = 'es=@histor_es, en=@histor_en';
    resetEnvCache();
    expect(telegramChannel('es')).toBe('@histor_es');
    expect(telegramChannel('en')).toBe('@histor_en');
    expect(telegramChannel('fr')).toBeNull();
  });
});
