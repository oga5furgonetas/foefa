/* La región del móvil para el alta: su zona horaria (así «hoy» y las horas de
   llegada salen en su hora) y, como pista del país, la región de su idioma
   («es-MX» -> «mx»). El servidor decide: si no conoce el país, lo deduce de
   la zona horaria. */
export function regionDelMovil() {
  const fuera = {}
  try { fuera.zona_horaria = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined } catch { /* sin Intl */ }
  try {
    const r = new Intl.Locale(navigator.language || '').maximize().region
    if (r && /^[A-Z]{2}$/.test(r)) fuera.pais = r.toLowerCase()
  } catch { /* idioma raro */ }
  return fuera
}
