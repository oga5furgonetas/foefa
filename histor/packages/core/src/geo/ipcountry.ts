/**
 * País del lector por su IP, para abrir la portada con las noticias de su país cuando
 * la web no está detrás de una CDN que lo diga (en Fly no hay `cf-ipcountry`).
 * Base: DB-IP Country Lite (CC BY 4.0, https://db-ip.com), descargada al construir la
 * imagen (`scripts/fetch-geoip.mjs`). La consulta es en memoria y la IP NUNCA se guarda.
 * Sin base (p. ej. en desarrollo), devuelve null y la edición sale del idioma del navegador.
 */
import { existsSync, readFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { Reader, type CountryResponse } from 'mmdb-lib';

type CountryRecord = CountryResponse;

let reader: Reader<CountryRecord> | null | undefined;

function load(): Reader<CountryRecord> | null {
  if (reader !== undefined) return reader;
  const path = process.env.GEOIP_DB_PATH || 'geo/dbip-country-lite.mmdb';
  try {
    reader = existsSync(path) ? new Reader<CountryRecord>(readFileSync(path)) : null;
  } catch {
    reader = null;
  }
  return reader;
}

/** Código ISO del país de una IP pública, o null. */
export function countryFromIp(ip: string | null | undefined): string | null {
  const addr = (ip ?? '').split(',')[0].trim();
  if (!addr || !isIP(addr)) return null;
  const db = load();
  if (!db) return null;
  try {
    const code = db.get(addr)?.country?.iso_code;
    return code && /^[A-Z]{2}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

/** Solo para pruebas: otra base o ninguna. */
export function setGeoIpReaderForTests(buf: Buffer | null) {
  reader = buf ? new Reader<CountryRecord>(buf) : null;
}
