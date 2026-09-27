# Seguridad y privacidad

## Autenticación y sesiones

- Contraseñas con **scrypt** (sal por usuario); mínimo 10 caracteres.
- Bloqueo progresivo tras 8 intentos fallidos (hasta 60 min) y límite de ritmo por IP y por correo.
- Sesiones de servidor: la cookie `histor_session` (HttpOnly, Secure, SameSite=Lax) guarda un token aleatorio; en la base solo está su SHA-256. Caducidad deslizante de 30 días.
- Recuperar la contraseña cierra todas las sesiones. Las respuestas no revelan si un correo existe.
- **2FA (TOTP, RFC 6238)**; el secreto se guarda cifrado con AES-256-GCM (`DATA_ENCRYPTION_KEY`). Obligatorio para editores y administradores en producción (`ADMIN_REQUIRE_2FA`).
- Google y Apple por **OpenID Connect** con `state`, `nonce` y PKCE; la firma del `id_token` se verifica con las claves públicas (JWKS) del proveedor y se exige correo verificado.

## Peticiones

- **CSRF:** doble envío firmado (cookie `histor_csrf` + cabecera `x-csrf-token`) y comprobación de `Origin`/`Referer` en toda petición que cambia datos. El webhook de Stripe se valida por firma; el callback de Apple, por `state`.
- **Límites de ritmo** por IP seudonimizada (memoria o Redis).
- **Validación** de toda entrada con zod; tamaños máximos en cuerpos y campos.
- **RBAC** (`domain.ts`): lector, editor, administrador. Cada acción del panel comprueba su permiso en el servidor, y cada página del panel vuelve a pasar la guardia (no se confía en el layout).
- **Lista de IPs** opcional para el panel (`ADMIN_IP_ALLOWLIST`).
- **Auditoría:** toda acción editorial y administrativa queda en `audit_log`.

## Cabeceras

- CSP estricta con *nonce* y `strict-dynamic` en `/admin` y `/api`; CSP restrictiva sin nonce en páginas públicas (cacheables), sin scripts de terceros.
- `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restrictiva, `Cross-Origin-Opener-Policy: same-origin`, HSTS con preload en producción, `X-Powered-By` desactivado.
- El JSON-LD se serializa escapando `<`, `>` y `&`; React escapa todo el texto.

## Rastreo responsable (SSRF y editores)

- `PoliteFetcher`: solo http/https a **hosts públicos**; con la red real comprueba la **IP resuelta por DNS** de cada salto y sigue las redirecciones a mano (máx. 5), así un dominio o una redirección no pueden apuntar a la red interna ni a los metadatos de la nube. Tiempo máximo, tamaño máximo, ritmo por dominio y `Crawl-delay`.
- Respeta `robots.txt` (401/403 = no permitido) y la reserva de minería de textos (`tdm-reservation`): si el editor la declara, no se guarda el texto.
- User-Agent identificado con URL de contacto. No se saltan muros de pago.
- El texto de las fuentes solo se usa para contrastar y se poda a los 30 días.

## Datos personales (RGPD)

- Minimización: correo y, opcionalmente, nombre; nada más es obligatorio.
- **La IP nunca se guarda**: se usa un hash diario con sal para límites y auditoría.
- Analítica propia, sin terceros: sin consentimiento, eventos sin identificador; con consentimiento de medición, identificador seudónimo (hash con sal).
- Personalización solo con consentimiento (o la opción de la cuenta).
- Consentimiento granular (necesarias, preferencias, medición, personalización, publicidad), revocable desde el pie.
- Derechos: **descargar mis datos** (JSON completo) y **eliminar mi cuenta** (borra perfil, sesiones, historial, perfiles de interés, analítica asociada; las facturas se conservan desvinculadas por obligación fiscal).
- Retención: analítica en bruto 13 meses; trabajos terminados 14 días; texto de fuentes 30 días.

## Secretos

- Ningún secreto en el código: todo por entorno (`.env.example` documenta cada variable).
- `scripts/check-secrets.mjs` (también en CI) falla si se versiona algo con forma de clave o un `.env`.
- Rotación de `SESSION_SECRETS` sin cerrar sesiones: varias claves separadas por comas (ver `docs/OPERATIONS.md`).
- Logs con redacción de cabeceras `authorization` y `cookie`.

## Contenido

- Control legal antes de publicar: fragmentos literales largos, solapamiento con una fuente, datos personales (teléfonos, correos, DNI…) y expresiones difamatorias.
- Las imágenes deben tener licencia registrada; nunca se presentan imágenes generadas por IA como fotografías.
- Los avisos de lectores (copyright, privacidad, errores) se convierten en tareas de revisión con prioridad.

## Informar de una vulnerabilidad

Escribe a `CONTACT_EMAIL` (configurable) con «Seguridad» en el asunto. Pendiente
del propietario: publicar `/.well-known/security.txt` con el contacto definitivo.
