import { api } from '../services/api'

// Capa de API del panel de administración (reusa el axios con token).
// Centro: 'Todos' | 'OGA5' | 'DGA1' | 'DGA2' … (filtro global del panel)
const centerParam = (center) => (center && center !== 'Todos' ? { center } : {})

/* ── Peritaje firmado (S1) ── */
export const getForensicStatus = (inspId) => api.get(`/inspections/${inspId}/forensic`)
export const signInspectionAdmin = (inspId, signatureText) =>
  api.post(`/inspections/${inspId}/sign`, { signature_text: signatureText })

/* ── Fraud Guard (S3) ── */
export const recheckFraud = (inspId) => api.post(`/inspections/${inspId}/recheck-fraud`)

/* ── Checklist operativo ── */
export const getChecklist = (center, date) => api.get('/checklist', { params: { center, date } })
export const upsertChecklist = (body) => api.put('/checklist', body)
export const toggleChecklistItem = (body) => api.post('/checklist/toggle', body)

/* ── Chat por centro ── */
export const getChat = (center, since) => api.get(`/chat/${center}`, { params: since ? { since } : {} })
export const postChat = (center, text) => api.post(`/chat/${center}`, { text })
export const deleteChatMessage = (center, messageId) => api.delete(`/chat/${center}/${messageId}`)

/* ── FlotaDSP AI: el asistente de cada centro ── */
export const getAiHistorial = (center) => api.get('/ai/asistente/historial', { params: { center } })
export const enviarMensajeIA = (mensaje, center) => api.post('/ai/asistente', { mensaje, center })
export const ejecutarAccionIA = (tipo, campos, center) => api.post('/ai/asistente/ejecutar', { tipo, campos, center })
export const subirFichasTecnicasIA = (files, center) => {
  const fd = new FormData()
  fd.append('center', center)
  for (const f of files) fd.append('files', f)
  return api.post('/ai/asistente/fichas-tecnicas', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}
export const confirmarFichasTecnicasIA = (lote_id) => api.post('/ai/asistente/fichas-tecnicas/confirmar', { lote_id })
export const saveChecklistTemplate = (body) => api.post('/checklist/template', body) // {center, shift, items}
// Cierre de turno: sale solo a su hora, esto lo dispara ahora para probarlo.
export const enviarResumenTurno = (body) => api.post('/checklist/enviar-resumen', body)

/* ── Quién recibe el resumen de cada centro ──
   Los teléfonos viven en la BD, nunca en el código: son datos de personas
   reales y el repositorio acaba en GitHub. */
export const listarDestinatarios = () => api.get('/avisos/destinatarios')
export const guardarDestinatario = (body) => api.post('/avisos/destinatarios', body)
export const borrarDestinatario = (id) => api.delete(`/avisos/destinatarios/${id}`)
export const enviarResumenDiario = (body) => api.post('/avisos/enviar-resumen-diario', body)
export const getHorariosAvisos = () => api.get('/avisos/horarios')
export const setHorariosAvisos = (body) => api.put('/avisos/horarios', body)
export const chatToChecklist = (center, messageId, body = {}) =>
  api.post(`/chat/${center}/${messageId}/to-checklist`, body)

/* ── Dashboard ── */
export const getDashboardStats = (center) => api.get('/stats/dashboard', { params: centerParam(center) })
export const getDamageCosts = (center) => api.get('/stats/damage-costs', { params: centerParam(center) })
export const getStatsHoy = (center) => api.get('/stats/hoy', { params: centerParam(center) })
export const getAttention = () => api.get('/stats/attention')

/* ── Vehículos / Flota ── */
export const getOnboarding = () => api.get('/onboarding')
// `estado: 'baja'` es la ÚNICA forma de ver las furgonetas devueltas: por
// defecto no salen ni cuentan en ninguna parte (están fuera de la operación).
export const getVehicles = (center, estado) =>
  api.get('/vehicles', { params: { ...centerParam(center), ...(estado ? { estado } : {}) } })
export const createVehicle = (body) => api.post('/vehicles', body)
export const getVehicle = (id) => api.get(`/vehicles/${id}`)
export const getVehicleHistory = (id) => api.get(`/vehicles/${id}/history`)
export const getLastInspections = (center) => api.get('/vehicles/last-inspections', { params: centerParam(center) })
export const getSpareWheels = () => api.get('/vehicles/spare-wheel')
export const getVehicleDriver = (id) => api.get(`/vehicles/${id}/driver`)
export const getVehicleInspections = (id) => api.get(`/inspections/vehicle/${id}`)
export const getVehicleDamageLedger = (id) => api.get(`/vehicles/${id}/damage-ledger`)
export const repairVehicleLedger = (id, body) => api.post(`/vehicles/${id}/ledger/repair`, body)
export const resolveVehicleModel = (brand, model, year, version) =>
  api.get('/vehicle-models/resolve', { params: { brand: brand || '', model: model || '', ...(year ? { year } : {}), ...(version ? { version } : {}) } })
export const identifyVehicleModel = (id) => api.post(`/vehicles/${id}/identify-model`)
export const updateVehicle = (id, body) => api.patch(`/vehicles/${id}`, body)
export const getVehicleMaintenance = (id) => api.get(`/vehicles/${id}/maintenance`)
export const registerOilChange = (id, body) => api.post(`/vehicles/${id}/oil/change`, body)
export const registerMaintenanceChange = (id, kind, body) => api.post(`/vehicles/${id}/maintenance/${kind}/change`, body)
export const getVehicleDocuments = (id) => api.get(`/vehicles/${id}/documents`)
export const uploadVehicleDocument = (id, formData) => api.post(`/vehicles/${id}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const deleteVehicleDocument = (vehicleId, docId) => api.delete(`/vehicles/${vehicleId}/documents/${docId}`)
// Toda la documentacion subida alguna vez, este como este la furgoneta. La
// pantalla de una furgoneta devuelta ya no se abre, y su papeleo se sigue
// necesitando meses despues.
export const getAllDocuments = (q = '') => api.get('/documents', { params: q ? { q } : {} })
export const deleteVehicle = (vehicleId) => api.delete(`/vehicles/${vehicleId}`)

/* ── Conductores ── */
export const getDrivers = (center) => api.get('/drivers', { params: centerParam(center) })
export const getDriverRanking = () => api.get('/drivers/ranking')
export const getDriverScore = (id) => api.get(`/drivers/${id}/score`)
export const getDriversScoring = (month, year) => api.get('/scoring/drivers', { params: { ...(month ? { month } : {}), ...(year ? { year } : {}) } })
export const getScoringLeaderboard = (month, year) => api.get('/scoring/leaderboard', { params: { ...(month ? { month } : {}), ...(year ? { year } : {}) } })
export const createDriver = (data, params) => api.post('/drivers', data, { params })
export const updateDriver = (id, data) => api.patch(`/drivers/${id}`, data)
// Cambio de centro programado: la ficha pasa a `centro` el día `desde` (lo
// aplica el servidor ese día; si ya ha llegado, en el acto).
export const programarTraslado = (id, centro, desde) => api.post(`/drivers/${id}/traslado`, { centro, desde })
export const cancelarTraslado = (id) => api.delete(`/drivers/${id}/traslado`)
// Apoyo en ruta: quien le quita paradas a quien, con mapa por WhatsApp
/* Empleo: ofertas, cuestionario y candidatos. La oferta va SIEMPRE atada a un
   centro y el candidato hereda el suyo, para que no se mezclen las naves. */
export const getOfertas = (params) => api.get('/empleo/ofertas', { params })
export const crearOferta = (body) => api.post('/empleo/ofertas', body)
export const editarOferta = (id, body) => api.patch(`/empleo/ofertas/${id}`, body)
export const getCandidatos = (params) => api.get('/empleo/candidatos', { params })
export const moverCandidato = (id, body) => api.patch(`/empleo/candidatos/${id}`, body)
export const contratarCandidato = (id) => api.post(`/empleo/candidatos/${id}/contratar`)
export const getEtts = () => api.get('/empleo/etts')
export const crearEtt = (body) => api.post('/empleo/etts', body)
export const editarEtt = (id, body) => api.patch(`/empleo/etts/${id}`, body)
export const borrarEtt = (id) => api.delete(`/empleo/etts/${id}`)
export const enviarCandidatoAEtt = (candId, ett) =>
  api.post(`/empleo/candidatos/${candId}/ett`, { ett })
export const deshacerEnvioEtt = (candId, ettId) =>
  api.delete(`/empleo/candidatos/${candId}/ett/${ettId}`)
export const borrarCandidato = (id) => api.delete(`/empleo/candidatos/${id}`)
// JOIN (join.com): el token es de cada empresa y nunca vuelve entero.
export const getJoin = () => api.get('/empleo/join')
export const guardarTokenJoin = (token) => api.put('/empleo/join/token', { token })
export const getOfertasJoin = () => api.get('/empleo/join/ofertas')
export const sincronizarJoin = (body) => api.post('/empleo/join/sincronizar', body)
export const importarCsvJoin = (file, ofertaId) => {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('oferta_id', ofertaId)
  return api.post('/empleo/join/csv', fd, { timeout: 120000 })
}
/* Por contactar: gente de Indeed a la que hay que escribir para que se apunte.
   El enlace de WhatsApp lo arma el backend y viaja en `wa` (gotcha 47). */
export const getInvitados = () => api.get('/empleo/invitados')

/* Incorporaciones: quien esta entrando, que le falta y el WhatsApp para
   pedirselo. El texto y el enlace `wa.me` los monta el BACKEND (gotcha 47);
   `marcarAvisoOnboarding` es aparte porque abrir WhatsApp no es haber enviado. */
/* `centerParam` y no `{ center }` a pelo: con el selector en «Todos» el panel
   manda la CADENA 'Todos' y el backend buscaria un centro que se llama asi —
   cero resultados, sin error y con 26 personas en la base (gotcha 12). */
export const getIncorporaciones = (center) => api.get('/incorporaciones/personas', { params: centerParam(center) })
// Las cuentas de Amazon y QUE le falta a cada una, de la pantalla de Asociados.
// Por defecto solo las cuentas de la gente que esta entrando (la del listado
// de la ETT). `todas` las trae todas, para buscar a alguien que no este.
export const altaIncorporacion = (body) => api.post('/incorporaciones/personas', body)
export const importarIncorporaciones = (body) => api.post('/incorporaciones/personas/importar', body)
export const editarIncorporacion = (id, body) => api.patch(`/incorporaciones/personas/${id}`, body)
export const mensajeIncorporacion = (id, body) => api.post(`/incorporaciones/personas/${id}/mensaje`, body)
export const marcarAvisoIncorporacion = (id, body) => api.post(`/incorporaciones/personas/${id}/enviado`, body)
export const guardarPlantillaIncorporaciones = (body) => api.put('/incorporaciones/plantillas', body)
/* La descarga va como `blob`: sin esto axios intenta leerlo como texto y
   el fichero llega con los acentos rotos. */
export const exportarIncorporaciones = (center) =>
  api.get('/incorporaciones/export', { params: centerParam(center), responseType: 'blob' })
export const crearInvitado = (body) => api.post('/empleo/invitados', body)
export const marcarInvitadoEscrito = (id, escrito) =>
  api.post(`/empleo/invitados/${id}/escrito`, { escrito })
export const borrarInvitado = (id) => api.delete(`/empleo/invitados/${id}`)
export const guardarPlantillaInvitacion = (texto) =>
  api.put('/empleo/invitados/plantilla', { texto })
export const deleteDriver = (id) => api.delete(`/drivers/${id}`)
export const uploadDriverPhoto = (id, file) => { const fd = new FormData(); fd.append('file', file); return api.post(`/drivers/${id}/photo`, fd) }

/* ── Cuentas de conductor (acceso con contraseña) ── */
/* Salud de las fichas: duplicadas por correo y Transporter IDs que faltan. */
export const getDriversDuplicados = () => api.get('/drivers/duplicados')
export const fusionarConductores = (body) => api.post('/drivers/fusionar', body)
export const repasarFusiones = () => api.post('/drivers/fusiones/repasar')
/* Los IDs que salen a ruta y no tienen ficha, con sus rutas para reconocerlos. */
/* Alta de un tiron del que conduce un id, con el nombre que da Cortex: sin
   teclear el nombre no hay fichas duplicadas por un espacio de mas. */
/* Fichas activas sin centro: salen en el total y en ningun centro, o sea que
   con un centro elegido —como se trabaja siempre— no las ve nadie. */
/* Solo el numero de candidaturas sin mirar, para el aviso del menu: la lista
   devuelve hasta 500 candidatos con DNI y telefono y esto se pide cada 2 min. */
export const contarCandidatosNuevos = (center) =>
  api.get('/empleo/candidatos/nuevos', { params: centerParam(center) })
export const getDriverAccounts = () => api.get('/auth/driver-accounts')
export const setDriverPassword = (driverId, password) => api.post('/auth/set-driver-password', { driver_id: driverId, password })
/* Da acceso al portal a todos los que aun no lo tienen. Devuelve las claves
   UNA vez: en la base solo queda el hash. */
export const generarAccesosConductores = () => api.post('/auth/driver-accounts/generar')
export const deleteDriverAccount = (driverId) => api.delete(`/auth/driver-account/${driverId}`)

/* ── Inspecciones ── */
export const getInspections = (params = {}) => api.get('/inspections', { params })
/* Al reves: que furgonetas NO se han mirado. */
export const getCoberturaInspecciones = (center) =>
  api.get('/inspections/cobertura', { params: centerParam(center) })
export const getInspection = (id) => api.get(`/inspections/${id}`)
export const getReviewQueue = (center) => api.get('/inspections/review-queue', { params: centerParam(center) })
export const getAiDatasetStats = () => api.get('/ai-dataset/stats')
// Como de bien lo esta haciendo la IA, medido con las validaciones humanas.
export const autoexamenIA = () => api.get('/ai/autoexamen')
export const modeloIA = () => api.get('/ai/modelo')
export const entrenarModeloIA = () => api.post('/ai/modelo/entrenar')
/* Lo que la IA ha aprendido sobre si misma: en que piezas se calla y por que.
   Existe para que el filtro no sea una caja negra. */
export const fiabilidadIA = () => api.get('/ai/fiabilidad')
// Daños sueltos pendientes de validar, ordenados por lo que enseñan.
export const iaParaRevisar = (center, limit) =>
  api.get('/ai/para-revisar', { params: { ...centerParam(center), ...(limit ? { limit } : {}) } })
export const markReviewed = (id) => api.post(`/inspections/${id}/mark-reviewed`)
export const autorrevisarIA = (limite) => api.post('/ai/autorrevisar', { limite }) // la IA cierra sola lo que puede
export const damageFeedback = (id, body) => api.post(`/inspections/${id}/damage-feedback`, body)
export const missedDamage = (id, body) => api.post(`/inspections/${id}/missed-damage`, body)

// Descarga autenticada (PDF/anotada): el endpoint exige Bearer, un <a href> no lo envía.
export const fetchAuthedBlob = async (path) => {
  const res = await api.get(path, { responseType: 'blob' })
  return URL.createObjectURL(res.data)
}

/* ── Talleres ── */
export const getWorkshops = () => api.get('/workshops')
/* Bucle del daño: mandar a taller, apuntar el coste real y cerrarlo.
   El backend ya lo soportaba; lo que faltaba era llamarlo desde algún sitio. */
export const getSuggestedWorkshops = (inspectionId, damageIndex) =>
  api.get(`/inspections/${inspectionId}/damages/${damageIndex}/suggested-workshops`)
export const updateDamage = (inspectionId, damageIndex, body) =>
  api.patch(`/inspections/${inspectionId}/damages/${damageIndex}`, body)
export const getWorkshopsNearby = (lat, lng, { provider, category, maxKm = 80 } = {}) =>
  api.get('/workshops/nearby', { params: { lat, lng, max_km: maxKm, ...(provider ? { provider } : {}), ...(category ? { category } : {}) } })

/* ── Avisos / Alertas ── */
export const getAlerts = (center, kind) => api.get('/alerts', { params: { ...centerParam(center), ...(kind ? { kind } : {}) } })
export const getItvAlerts = (center) => api.get('/alerts/itv', { params: centerParam(center) })
/* Todo lo que vence en un mes (ITV, renting y los cambios previstos por km),
   ya filtrado por centro en el servidor. */
export const fleetCalendar = (params) => api.get('/fleet/calendar', { params })
export const crearCitaFlota = (body) => api.post('/fleet/calendar/citas', body)
export const editarCitaFlota = (id, body) => api.patch(`/fleet/calendar/citas/${id}`, body)
export const borrarCitaFlota = (id) => api.delete(`/fleet/calendar/citas/${id}`)
// Resolver ≠ marcar hecho: además de cerrar la cita, pone a cero el contador de
// km de ese cambio y lo apunta en el historial de la furgoneta.
export const resolverCitaFlota = (id, body) => api.post(`/fleet/calendar/citas/${id}/resolver`, body)
export const getMaintenanceLog = (id) => api.get(`/vehicles/${id}/maintenance-log`)
// Borrar un apunte DESHACE lo que hizo (devuelve el contador de km a como
// estaba y la cita a pendiente); si no, sería peor que no poder borrarlo.
export const borrarApunteMantenimiento = (id, entryId) =>
  api.delete(`/vehicles/${id}/maintenance-log/${entryId}`)
export const getMaintenanceAlerts = () => api.get('/alerts/maintenance')
export const getRentingAlerts = () => api.get('/alerts/renting')

/* ── Renting / Casas de alquiler ── */
export const getRentals = () => api.get('/rentals')
export const getRentalsNearby = (lat, lng, maxKm = 80) =>
  api.get('/rentals/nearby', { params: { lat, lng, max_km: maxKm } })

/* ── Bandeja super-admin (inbox append-only + fallback leads) ── */
export const getInbox = () => api.get('/inbox')

/* ── Asistente: pregúntale a tu flota (Gemini sobre datos reales de la org) ── */
export const askAssistant = (question) => api.post('/assistant/ask', { question }, { timeout: 45000 })

/* ── Incidencias ── */
export const getIncidents = (params = {}) => api.get('/incidents', { params })
export const createIncident = (body) => api.post('/incidents', body)
export const updateIncident = (id, body) => api.patch(`/incidents/${id}`, body)
export const deleteIncident = (id) => api.delete(`/incidents/${id}`)
export const resolveIncident = (id) => api.put(`/incidents/${id}/resolve`)
export const reopenIncident = (id) => api.put(`/incidents/${id}/reopen`)

/* ── Scorecard (baremos y subida POR CENTRO) ── */
// De dónde salen los umbrales de esta nave: si el DSP no ha subido ninguna
// scorecard suya, los tiers son orientativos y hay que decírselo.

/* ── Org / Config ── */
export const getOrgCenters = () => api.get('/org/centers')
export const getCentrosGeo = () => api.get('/org/centros-geo') // {centros: {OGA5: {lat, lng, origen}}}
export const enlaceTaller = (workshopId) => api.post(`/workshops/${workshopId}/enlace`) // enlace fijo por taller
export const addOrgCenter = (name) => api.post('/org/centers', { name })
/* WhatsApp Business. Las credenciales NO pasan por aqui: viven en los secretos
   de Fly. Estos endpoints solo dicen que falta, encienden cada aviso y prueban. */
export const getWhatsappEstado = () => api.get('/whatsapp/estado')
export const getWhatsappPendientes = () => api.get('/whatsapp/pendientes')
export const marcarWhatsappHecho = (ids) => api.post('/whatsapp/pendientes/hecho', { ids })
export const setWhatsappConfig = (body) => api.post('/whatsapp/config', body)
export const probarWhatsapp = (body) => api.post('/whatsapp/prueba', body)
// Conversaciones: lo que escriben y lo que se les manda. `no-leidas` alimenta el menu.
export const getConversaciones = (q) =>
  api.get('/whatsapp/conversaciones', { params: q ? { q } : {} })
export const getConversacion = (tel) =>
  api.get(`/whatsapp/conversaciones/${encodeURIComponent(tel)}`)
export const marcarConversacionLeida = (tel) =>
  api.post(`/whatsapp/conversaciones/${encodeURIComponent(tel)}/leido`)
export const responderConversacion = (tel, texto) =>
  api.post(`/whatsapp/conversaciones/${encodeURIComponent(tel)}/responder`, { texto })
export const contarConversacionesSinLeer = () => api.get('/whatsapp/conversaciones/no-leidas')
export const crearPlantillasWhatsapp = () => api.post('/whatsapp/plantillas/crear')
export const avisarItvWhatsapp = () => api.post('/whatsapp/avisar-itv')
export const getTelegramConfig = () => api.get('/telegram/config')
export const getOrgBilling = () => api.get('/org/billing')
export const getBillingUso = () => api.get('/billing/uso')
export const revisarFacturacion = () => api.post('/billing/revisar')
// Cuánto sitio queda antes de que algo se rompa. Atlas M0 y una máquina de 1 GB
// no avisan: se ponen lentos primero y dejan de aceptar escrituras después.
export const getCorreoEstado = () => api.get('/admin/correo')
export const enviarCorreo = (body) => api.post('/admin/correo', body)
export const getSaludSistema = () => api.get('/admin/salud')
export const getMe = () => api.get('/auth/me')

/* ── IA Peritaje / Métricas / Importaciones ── */
export const getHealth = () => api.get('/health')
export const reanalyzeFailed = () => api.post('/inspections/reanalyze-failed')
export const rebuildFleetDamages = () => api.post('/inspections/rebuild-fleet-damages')
export const rebuildStatus = () => api.get('/inspections/rebuild-status')
export const reanalyzeInspection = (id) => api.post(`/inspections/${id}/reanalyze?silent=true`, {}, { timeout: 120000 })
export const submitAiFeedback = (body) => api.post('/ai-feedback', body)
export const importVehicles = (file, center, crear, eleccion) => {
  const fd = new FormData()
  fd.append('file', file, file.name)
  if (center && center !== 'Todos') fd.append('center_filter', center)
  if (crear) fd.append('crear', 'true')
  // Con la vista previa hecha: que centros del fichero y a donde va cada uno.
  if (eleccion?.centros) fd.append('centros', JSON.stringify(eleccion.centros))
  if (eleccion?.mapa) fd.append('mapa', JSON.stringify(eleccion.mapa))
  if (eleccion?.columnas) fd.append('columnas', JSON.stringify(eleccion.columnas))
  return api.post('/import/vehicles', fd, { timeout: 120000, headers: { 'Content-Type': undefined } })
}
// Que trae el fichero, por centro, SIN importar nada.
export const previsualizarVehiculos = (file, columnas) => {
  const fd = new FormData()
  fd.append('file', file, file.name)
  if (columnas && Object.keys(columnas).length) fd.append('columnas', JSON.stringify(columnas))
  return api.post('/import/vehicles/previsualizar', fd, { timeout: 120000, headers: { 'Content-Type': undefined } })
}

/* ── Turnos ── */
export const getShifts = (center, desde, hasta) => api.get('/shifts', { params: { center, desde, hasta } })
export const getShiftCoverage = (center, desde, hasta) => api.get('/shifts/coverage', { params: { center, desde, hasta } })
export const saveShiftsBulk = (items) => api.post('/shifts/bulk', { items })
export const setShiftSettings = (center, min_cobertura) => api.post('/shifts/settings', { center, min_cobertura })
// Cuadrante pegado desde Sheets: mas fiable que el Excel porque lo que se ve es
// lo que entra, sin depender de donde este cada cosa en el fichero.
export const importShiftsPegado = (body) => api.post('/shifts/import-pegado', body, { timeout: 120000 })
export const getAliasNombres = () => api.get('/shifts/alias-nombres')
export const setAliasNombres = (mapa) => api.put('/shifts/alias-nombres', { mapa })

// Bloqueos: dias en los que no se pueden pedir libres.
export const getShiftBlocks = (center) => api.get('/shift-blocks', { params: { center } })
export const createShiftBlock = (body) => api.post('/shift-blocks', body)
export const deleteShiftBlock = (id) => api.delete(`/shift-blocks/${id}`)

export const generateShiftsAuto = (center, desde, hasta) => api.post('/shifts/generate-auto', { center, desde, hasta }, { timeout: 120000 })

/* ── Cuadrante con motor (+2 sobre la máxima) ──
   Los turnos son los mismos de arriba; esto añade el motor, las personas con
   su nota, las propuestas que se aceptan aparte, deshacer y el chat. */
export const getCuadrante = (center, desde, hasta) => api.get('/cuadrante', { params: { center, desde, hasta } })
export const cuadranteCeldas = (center, cambios) => api.post('/cuadrante/celdas', { center, cambios })
export const cuadranteMaximas = (center, maximas) => api.put('/cuadrante/maximas', { center, maximas })
export const cuadranteConfig = (center, body) => api.put('/cuadrante/config', { center, ...body })
export const cuadrantePersona = (driverId, center, body) =>
  api.put(`/cuadrante/personas/${driverId}`, { center, ...body })
export const cuadrantePersonaNueva = (body) => api.post('/cuadrante/personas', body)
export const cuadranteFichas = (center) => api.get('/cuadrante/fichas', { params: { center } })
export const cuadranteNota = (texto) => api.post('/cuadrante/nota', { texto })
export const cuadranteAjuste = (body) => api.post('/cuadrante/ajustes', body)
export const cuadranteAjusteBorrar = (id) => api.delete(`/cuadrante/ajustes/${id}`)
export const cuadranteProponer = (body) => api.post('/cuadrante/proponer', body, { timeout: 240000 })
export const cuadranteAceptar = (id) => api.post(`/cuadrante/propuestas/${id}/aceptar`, {}, { timeout: 120000 })
export const cuadranteDescartar = (id) => api.post(`/cuadrante/propuestas/${id}/descartar`, {})
// `soloSi`: el id del cambio que se quiere deshacer. Si lo último lo hizo otra
// persona, el servidor dice que no (Ctrl+Z en la hoja no pisa lo de nadie).
export const cuadranteDeshacer = (center, soloSi) =>
  api.post('/cuadrante/deshacer', { center, ...(soloSi ? { solo_si: soloSi } : {}) }, { timeout: 120000 })
// La hoja del cuadrante: los apuntes del DIARIO y el registro de DEBER HORAS.
export const getDiario = (center, fecha) => api.get('/cuadrante/diario', { params: { center, fecha } })
export const guardarDiario = (center, fecha, cambios, notas) =>
  api.put('/cuadrante/diario', { center, fecha, cambios: cambios || [], ...(notas !== undefined ? { notas } : {}) })
export const getDeberHoras = (center) => api.get('/cuadrante/deber-horas', { params: { center } })
export const anadirDeberHoras = (body) => api.post('/cuadrante/deber-horas', body)
export const editarDeberHoras = (id, body) => api.patch(`/cuadrante/deber-horas/${id}`, body)
export const borrarDeberHoras = (id) => api.delete(`/cuadrante/deber-horas/${id}`)
export function importarDeberHoras(file, center, confirmar) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('center', center)
  if (confirmar) fd.append('confirmar', '1')
  return api.post('/cuadrante/deber-horas/importar', fd, { timeout: 120000, headers: { 'Content-Type': undefined } })
}
export const cuadranteChatVer = (center) => api.get('/cuadrante/chat', { params: { center } })
export const cuadranteChat = (body) => api.post('/cuadrante/chat', body, { timeout: 120000 })
export const cuadranteChatConfirmar = (id, quitar) =>
  api.post(`/cuadrante/chat/${id}/confirmar`, { quitar }, { timeout: 240000 })
export const cuadranteChatCancelar = (id) => api.post(`/cuadrante/chat/${id}/cancelar`, {})
export const cuadranteEstudio = (center) => api.get('/cuadrante/estudio', { params: { center } })
export const cuadranteExportar = (center, desde, hasta) =>
  api.get('/cuadrante/exportar', { params: { center, desde, hasta }, responseType: 'blob', timeout: 120000 })
export function cuadranteImportar(file, center, confirmar, crearFichas, emparejar, forzarCentro) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('center', center)
  if (confirmar) fd.append('confirmar', '1')
  if (crearFichas) fd.append('crear_fichas', '1')
  // La hoja parece de otro centro y aun así se importa aquí (un centro nuevo
  // que arranca con gente de otro). Sin esto el servidor dice que no.
  if (forzarCentro) fd.append('forzar_centro', '1')
  // {nombre en la hoja: id de ficha | '__nueva__' | '__fuera__'}: lo que se
  // eligió para los nombres que no casaban solos. Queda guardado como alias.
  if (emparejar && Object.keys(emparejar).length) fd.append('emparejar', JSON.stringify(emparejar))
  return api.post('/cuadrante/importar', fd, { timeout: 180000, headers: { 'Content-Type': undefined } })
}
export const getRouteDemand = (center, desde, hasta) => api.get('/route-demand', { params: { center, desde, hasta } })
export const setRouteDemand = (center, items) => api.post('/route-demand', { center, items })
export const getShiftRequests = (center, status, extra = {}) =>
  api.get('/shift-requests', { params: { ...centerParam(center), ...(status ? { status } : {}), ...extra } })
// Solo el numero, para el aviso del menu: la lista de arriba devuelve hasta
// mil documentos enteros y esto lo pide el panel cada dos minutos.
export const contarPeticionesPendientes = (center) =>
  api.get('/shift-requests/pendientes', { params: centerParam(center) })
// Rechazar exige motivo: lo lee el conductor tal cual.
export const resolveShiftRequest = (id, action, motivo) =>
  api.post(`/shift-requests/${id}/resolve`, { action, motivo })
/* Importar el cuadrante mensual. El MES lo pone quien importa, no el fichero:
   el Excel de Amazon arrastra en la cabecera el texto del mes anterior cuando
   se reutiliza la plantilla. Sin `confirmar` sólo devuelve el resumen. */
export function importShifts(file, center, mes, confirmar) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('center', center)
  fd.append('mes', mes)
  if (confirmar) fd.append('confirmar', '1')
  return api.post('/shifts/import', fd, { timeout: 120000, headers: { 'Content-Type': undefined } })
}
/* El cuadrante en .xlsx. Se pide como blob porque el endpoint exige Bearer:
   un <a href> normal no manda la cabecera y devolveria un 401. */
/* ── Reportes diarios de Cortex (DNR, RTS, POD, CC) ── */
/* Sube los .html tal cual se descargan de Cortex. Multipart porque son
   ficheros de verdad; con `confirmar` en falso solo se enseña lo que entraría. */
/* ── Órdenes de trabajo ── */
// Alta rapida desde el formulario de la orden: el taller nuevo aparece
// cuando hace falta, que es justo cuando descubres que no estaba.
export const ordenesPorTaller = (center) =>
  api.get('/work-orders/por-taller', { params: centerParam(center) })
export const exportarOrdenes = (params) =>
  api.get('/work-orders/export', { params, responseType: 'blob' })
export const crearTaller = (body) => api.post('/workshops', body)
export const editarTaller = (id, body) => api.put(`/workshops/${id}`, body)
export const getOrdenes = (params) => api.get('/work-orders', { params })
export const getResumenOrdenes = (center) =>
  api.get('/work-orders/resumen', { params: centerParam(center) })
export const getOrden = (id) => api.get(`/work-orders/${id}`)
export const crearOrden = (body) => api.post('/work-orders', body)
/* Todo lo que le pasa a UNA furgoneta, con las fotos del golpe, para armar
   el parte antes de mandarla. Es la otra mitad de `danos-pendientes`:
   aquella dice a quien mandar, esta dice que mandar. */
export const getParteFurgoneta = (vehicleId) => api.get(`/work-orders/parte/${vehicleId}`)
/* Dispara AHORA el recordatorio a los talleres que llevan dias sin decir nada.
   Normalmente sale solo a media manana; esto es para no esperar. */
export const dispararSeguimientoTalleres = () => api.post('/work-orders/seguimiento')
/* De cada golpe, la ultima foto en la que la furgoneta estaba limpia: con eso
   se acota que dia aparecio y quien la llevaba. Señala a personas, asi que el
   backend solo pone certeza 'alta' con un unico conductor y un dia de ventana. */
/* Las furgonetas ordenadas por lo que arrastran. Los golpes y los dias son
   HECHOS; los euros los estima la IA sobre las fotos y no estan calibrados con
   ninguna factura — la pantalla lo dice. */
/* El DCR real de esta semana contado desde Cortex, contra el umbral de la nave.
   NO predice: la scorecard oficial llega con semanas de retraso y esto cuenta
   lo que ya ha pasado. */
/* Revisa el ultimo dia cerrado y avisa si se sale de lo normal. Sale solo con
   el resumen del dia; esto es para no esperar. */
/* Las direcciones que fallan una y otra vez. El fallo se ve paquete a paquete
   y asi no se repite nunca: lo que se repite es la direccion. */
/* Guarda el recuento por direccion ANTES de que el TTL de Cortex borre los
   paquetes: sin esto el analisis empieza de cero cada dos meses. Corre solo
   cada tarde; esto es para no esperar. */
/* Matriculas dadas de alta dos veces. El dano no es el duplicado: es que el
   historial se parte entre las dos fichas y ninguna es cierta. */
/* Todo lo que le ha pasado a una furgoneta en una sola linea de tiempo: cada
   revision con quien la hizo, cada golpe con quien la llevaba, cada averia,
   cada entrada y salida de taller. */
export const getExpedienteVehiculo = (id) => api.get(`/vehicles/${id}/expediente`)
/* Las que no tienen fecha de ITV y las que la tienen pasada, para arreglarlas
   de una vez. Rellenarlas de una en una cuesta dos minutos por furgoneta, y un
   dato que cuesta eso no se rellena nunca. */
export const getItvPendientes = () => api.get('/vehicles/itv/pendientes')
export const guardarItvLote = (body) => api.put('/vehicles/itv/lote', body)
/* Lecturas de kilometraje que no pueden ser: un digito de mas o de menos, o el
   cuentakilometros PARCIAL en vez del total. Con esos picos dentro no se puede
   predecir nada. */
/* Que dato le falta a cada furgoneta y cuantas lo tienen vacio. Un dato que
   cuesta dos minutos por unidad no se rellena nunca de una en una. */
/* Estados que no cuadran con lo que hay detras: una furgoneta en taller sin
   fecha o sin orden. Detecta y clasifica; corregir es otra llamada, y la
   clasificacion se recalcula en el servidor. */
export const getCheckerEstados = () => api.get('/checkers/estados-vehiculo')
export const corregirEstados = (body) => api.post('/checkers/estados-vehiculo/corregir', body || {})
export const getDatosQueFaltan = (campo) =>
  api.get('/vehicles/faltan', { params: campo ? { campo } : {} })
export const rellenarDatosLote = (body) => api.put('/vehicles/faltan/lote', body)
export const getOdometroSospechosas = () => api.get('/vehicles/odometro/sospechosas')
export const sanearOdometro = (body) => api.post('/vehicles/odometro/sanear', body || {})
export const getVehiculosDuplicados = () => api.get('/vehicles/duplicados')
export const fusionarVehiculos = (body) => api.post('/vehicles/fusionar', body)
export const getExposicionVehiculos = (center) =>
  api.get('/vehicles/exposicion', { params: centerParam(center) })
export const getAtribucionDanos = (center, dias) =>
  api.get('/damages/atribucion', { params: { ...centerParam(center), ...(dias ? { dias } : {}) } })
export const editarOrden = (id, body) => api.patch(`/work-orders/${id}`, body)
// Rehace el enlace y REVOCA el anterior: es la forma de arreglar un envío
// al taller equivocado.
export const enlaceOrden = (id, dias) =>
  api.post(`/work-orders/${id}/enlace`, null, { params: dias ? { dias } : {} })

export const exportarCuadrante = (center, desde, hasta) =>
  api.get('/shifts/export', { params: { center, desde, hasta }, responseType: 'blob' })

export const getCodigosCuadrante = () => api.get('/shifts/codigos')
export const setCodigosCuadrante = (codigos) => api.put('/shifts/codigos', { codigos })

/* ── DNR diaria: los Daily Report de Amazon, subidos a mano ── */
export const subirDiarios = (files, center, confirmar) => {
  const fd = new FormData()
  for (const f of files) fd.append('files', f)
  if (center && center !== 'Todos') fd.append('center', center)
  if (confirmar) fd.append('confirmar', '1')
  return api.post('/diarios/subir', fd, { timeout: 180000 })
}
export const pegarDiario = (body) => api.post('/diarios/pegar', body)
export const diariosPorConductor = (center, desde, hasta) =>
  api.get('/diarios/conductores', { params: { center, desde, hasta } })
export const asignarIdConductor = (body) => api.post('/diarios/id-conductor', body)
export const verificarTransporterIds = (center, todo = false) =>
  api.get('/transporter-ids/verificar', { params: { center, todo: todo ? 'true' : undefined } })
export const confirmarParTransporter = (body) => api.post('/transporter-ids/confirmar-par', body)
export const vincularTransporterIds = (body) => api.post('/diarios/ids', body)

/* ── Plantilla del día (la hoja de salida) y su historial ── */
export const getPlantillas = (center) => api.get('/plantillas', { params: centerParam(center) })
export const downloadPlantilla = (id) => api.get(`/plantillas/${id}/download`, { responseType: 'blob' })
export const deletePlantilla = (id) => api.delete(`/plantillas/${id}`)
export const plantillaDesdeAsignacion = (center, date) =>
  api.get('/tools/plantilla-desde-asignacion', { params: { center, ...(date ? { date } : {}) } })

/* ── Furgonetas fijas: quién lleva qué furgoneta (backend/afinidad.py) ── */
export const getAfinidad = (center) => api.get('/afinidad', { params: { center } })
export const guardarFijaConductor = (driverId, body) => api.put(`/afinidad/conductor/${driverId}`, body)
export const guardarTratoFurgo = (vehicleId, trato) => api.put(`/afinidad/furgo/${vehicleId}`, { trato })
export const getPropuestaFijas = (center) => api.get('/afinidad/propuesta', { params: { center } })
export const aplicarPropuestaFijas = (cambios) => api.post('/afinidad/propuesta/aplicar', { cambios })
export const getAQuien = (center, furgo) => api.get('/afinidad/a-quien', { params: { center, furgo } })
export const getFilaAparcamiento = (center) => api.get('/afinidad/fila', { params: { center } })
export const guardarFilaAparcamiento = (center, filas) => api.put('/afinidad/fila', { center, filas })
export const plantillaFurgos = (body) => api.post('/tools/plantilla-furgos', body)
// «Poner móviles»: el de la ficha de cada conductor, para los móviles vacíos.
export const plantillaMoviles = (body) => api.post('/tools/plantilla-moviles', body)
// Móviles de empresa (pestaña «Móviles» de la plantilla): la extensión de cada
// uno y, por conductor, el suyo y el de reserva.
export const getMoviles = (center) => api.get('/moviles', { params: { center } })
export const anadirMoviles = (center, extensiones) => api.post('/moviles', { center, extensiones })
export const editarMovil = (id, body) => api.patch(`/moviles/${id}`, body)
export const borrarMovil = (id) => api.delete(`/moviles/${id}`)
export const guardarMovilesDe = (driverId, center, suyo, reserva) =>
  api.put(`/moviles/conductor/${driverId}`, { center, suyo: suyo || null, reserva: reserva || null })
export const pegarMoviles = (center, texto, aplicar) => api.post('/moviles/pegar', { center, texto, aplicar: !!aplicar })

/* ── Asignación diaria (qué conductor lleva qué furgo) ── */
export const getDailyAssignment = (center, date) => api.get('/assignments/daily', { params: { center, date } })
export const putDailyAssignment = (body) => api.put('/assignments/daily', body) // {center, date, slots:[{vehicle_id,vehicle_plate,driver_id,driver_name}]}

/* ── Negocio (super-admin) ── */
export const getAdminOverview = () => api.get('/admin/overview')
/* Quien esta conectado de tu empresa y los mensajes privados 1 a 1. El
   prefijo es `/mensajes` y no `/chat` a proposito: `GET /chat/{center}` es
   un comodin y se comeria cualquier ruta que colgara de el. */
export const chatIaEstado = (center) => api.get(`/chat/${encodeURIComponent(center)}/ia`)
export const getMensajesGente = () => api.get('/mensajes/gente')
export const getMensajesCon = (id, since) => api.get(`/mensajes/con/${id}`, { params: { since } })
export const postMensaje = (id, texto, center) => api.post(`/mensajes/con/${id}`, { texto, center })
export const postMensajeArchivo = (id, file, texto) => {
  const fd = new FormData()
  fd.append('file', file)
  if (texto) fd.append('texto', texto)
  return api.post(`/mensajes/con/${encodeURIComponent(id)}/archivo`, fd, { timeout: 120000 })
}

export const getAnalitica = (dias, seg) => api.get('/admin/analitica', { params: { dias, seg } })

// Gastos: de que son las facturas y cuanto sale al mes. Solo super-admin: el
// backend lo exige con `require_superadmin`, esto solo es la puerta.
export const getGastos = (params) => api.get('/gastos', { params })
export const crearGasto = (body) => api.post('/gastos', body)
export const borrarGasto = (id) => api.delete(`/gastos/${id}`)
export const analizarGastos = (body) => api.post('/gastos/analizar', body)
export const importarGastos = (body) => api.post('/gastos/importar', body)
export const ensenarProveedor = (body) => api.post('/gastos/proveedor', body)
export const gastosDesdeTaller = () => api.post('/gastos/taller')
export const getGastosBuzon = () => api.get('/gastos/buzon')

// Valor: SOLO Dani. El backend lo exige con `require_valor` (más estricto que
// super-admin); esto solo es la puerta.
export const getValorEstado = () => api.get('/valor/estado')
export const getValorOportunidades = (vivo) => api.get('/valor/oportunidades', { params: vivo ? { vivo: true } : {} })
export const getValorSeguras = () => api.get('/valor/seguras')
export const getValorApuestas = () => api.get('/valor/apuestas')
export const apuntarApuestaValor = (body) => api.post('/valor/apuestas', body)
export const apuntarApuestaValorAMano = (body) => api.post('/valor/apuestas/manual', body)
export const liquidarApuestaValor = (id, resultado) => api.post(`/valor/apuestas/${id}/resultado`, { resultado })
export const getValorAprendizaje = () => api.get('/valor/aprendizaje')
export const getValorHistorial = (id) => api.get(`/valor/oportunidades/${id}/historial`)
export const getValorCasas = () => api.get('/valor/casas')
export const guardarValorCasas = (casas) => api.post('/valor/casas', { casas })
export const getValorCasi = () => api.get('/valor/casi')
export const buscarValorAhora = () => api.post('/valor/buscar', {})
export const getValorReglas = () => api.get('/valor/reglas')
export const guardarValorReglas = (body) => api.post('/valor/reglas', body)
export const getAdminOrgs = () => api.get('/admin/orgs')
export const updateOrg = (body) => api.post('/admin/org', body) // {id, status?, plan?, extend_trial_days?, add_center?, max_centers?, modulos?}
export const getAdminModulos = () => api.get('/admin/modulos')
export const impersonateOrg = (id) => api.post('/admin/impersonate', { id })
export const deleteOrg = (id) => api.delete(`/admin/org/${id}`)
export const getLeads = () => api.get('/leads')
export const getBillingConfig = () => api.get('/billing/config')
/* Catálogo de planes: editable sin desplegar. */
export const adminGetPlanes = () => api.get('/admin/planes')
export const adminSetPlanes = (body) => api.put('/admin/planes', body)
/* Cobros: qué facturar cada mes y quién ha pagado. Sin pasarela. */
/* Datos de quien emite las facturas. */
export const adminGetEmisor = () => api.get('/admin/emisor')
export const adminSetEmisor = (body) => api.put('/admin/emisor', body)
export const adminGetCobros = (mes) => api.get('/admin/cobros', { params: mes ? { mes } : {} })
export const adminMarcarCobro = (id, estado, referencia) =>
  api.post(`/admin/cobros/${id}`, { estado, ...(referencia ? { referencia } : {}) })
export function adminConciliar(file, mes) {
  const fd = new FormData()
  fd.append('file', file)
  if (mes) fd.append('mes', mes)
  return api.post('/admin/cobros/conciliar', fd, { timeout: 120000, headers: { 'Content-Type': undefined } })
}
export const backupNow = () => api.post('/admin/backup-now')
/* Monetización: ofertas del portal conductor + reservas fundador */
export const adminGetDriverOffers = () => api.get('/admin/driver-offers')
export const adminCreateDriverOffer = (body) => api.post('/admin/driver-offers', body)
export const adminToggleDriverOffer = (id, active) => api.patch(`/admin/driver-offers/${id}`, { active })
export const adminDeleteDriverOffer = (id) => api.delete(`/admin/driver-offers/${id}`)
export const adminGetFounderReservations = () => api.get('/admin/founder-reservations')

/* ── Campaña de bienvenida a candidatos (cupón tienda + suscripción empleo) ── */
export const crearEnlaceTienda = () => api.post('/tienda/enlace')
export const getSuscripcionesEmpleo = () => api.get('/empleo/suscripciones')
export const enviarCampanaCandidatos = (body) => api.post('/admin/candidatos/campana-bienvenida', body)

/* ── Usuarios (RBAC) ── */
export const getAdmins = () => api.get('/auth/admins')
export const createAdmin = (body) => api.post('/auth/create-admin', body) // {username, password, name, permissions:[]}
export const updateAdmin = (id, body) => api.patch(`/auth/admins/${id}`, body) // {permissions?, name?}
export const deleteAdmin = (id) => api.delete(`/auth/admins/${id}`)
export const subirFotoAdmin = (id, file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post(`/auth/admins/${id}/photo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}

/* ── Perfil / cuenta ── */
export const changeMyPassword = (current_password, new_password) =>
  api.post('/auth/change-my-password', { current_password, new_password })
// `extra`: { tambien_usuario, password } cuando se entra con el correo y el usuario cambia con él.
export const setMyEmail = (email, extra = {}) => api.post('/auth/my-email', { email, ...extra })
export const pedirEnlaceClave = (email) => api.post('/auth/forgot-password', { email })
export const forgotPassword = (email) => api.post('/auth/forgot-password', { email })

/* ── Package Intelligence Center (Cortex) ── */

// Tienda de ropa y material (preparacion del negocio, vive en Perfil).
export const tiendaPreparacion = () => api.get('/tienda/preparacion')
export const tiendaMarcarPaso = (paso, hecho, nota = '') =>
  api.post('/tienda/preparacion', { paso, hecho, nota })
export const tiendaPrendas = () => api.get('/tienda/prendas')
export const tiendaCrearPrenda = (body) => api.post('/tienda/prendas', body)
export const tiendaEditarPrenda = (id, body) => api.patch(`/tienda/prendas/${id}`, body)
export const tiendaArchivarPrenda = (id) => api.delete(`/tienda/prendas/${id}`)
export const tiendaInterpretar = (texto) => api.post('/tienda/prendas/interpretar', { texto })
export const tiendaFicha = (prenda, unidades) => api.post('/tienda/prendas/ficha', { prenda, unidades })
export const tiendaLogos = () => api.get('/tienda/logos')
export const tiendaSubirLogo = (variante, archivo) => {
  const fd = new FormData()
  fd.append('variante', variante)
  fd.append('file', archivo)
  return api.post('/tienda/logos', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}
export const tiendaBorrarLogo = (variante) => api.delete(`/tienda/logos/${variante}`)
export const tiendaPedidos = () => api.get('/tienda/pedidos')
export const tiendaConfig = (body) => api.post('/tienda/config', body)
export const tiendaBorrarPedido = (id) => api.delete(`/tienda/pedidos/${id}`)
export const tiendaEstadoPedido = (id, estado) =>
  api.post(`/tienda/pedidos/${id}/estado`, { estado })
export const tiendaSubirFoto = (id, archivo) => {
  const fd = new FormData()
  fd.append('file', archivo)
  return api.post(`/tienda/prendas/${id}/foto`, fd,
    { headers: { 'Content-Type': 'multipart/form-data' } })
}
export const tiendaBorrarFoto = (id) => api.delete(`/tienda/prendas/${id}/foto`)
// La foto pide sesion, asi que un <img src> normal no vale: el navegador no
// manda el token en la peticion de una imagen. Se baja con el cliente que si
// lo lleva y se pinta como blob.
export const tiendaFotoBlob = (id) =>
  api.get(`/tienda/prendas/${id}/foto`, { responseType: 'blob' })
// Que hay en una coordenada. Para los paquetes en los que Cortex manda el punto
// pero no el texto de la direccion: sin esto la pantalla se rendia teniendo un
// dato en la mano.
// Reparto automático por geografía. Sin `aplicar` solo propone: se puede mirar
// antes de que toque nada.
/* La llave es UNA POR CENTRO y la misma para todo el equipo: quien la pida
   para OGA5 recibe siempre la misma cadena (backend, gotcha 66). */
/* Las llaves de la extension: que equipos escriben y como apagar el que sobre.
   Antes la llave era un JWT de un año sin rastro y no se podia revocar. */
/* Rellena el catalogo de direcciones con lo que ya esta guardado en los
   paquetes: no hay que esperar a que vuelvan a pasar. */
/* Las de antes de las llaves por nave, de una vez. */

/* Calidad de entrega en vivo: el scorecard calculado desde Cortex, sin subir
   nada y sin esperar al viernes de Amazon. */
/* Libreta de portales: direcciones que fallan una y otra vez. */
/* Dónde está DE VERDAD la dirección, buscada por texto en varios geocodificadores
   a la vez. Guarda sólo lo confirmado por dos familias de fuentes distintas. */
/* Los "no puedo encontrar la dirección" de HOY, uno a uno y en vivo. */
/* Los MISSING de hoy, con el conductor ya resuelto. Pestaña propia: un paquete
   perdido se atiende llamando a alguien, no buscando en un mapa. */
/* IDs de Amazon que reparten sin ficha de conductor, con sugerencia de a quien
   corresponden. La asignacion reutiliza updateDriver: driver_id ya esta en la
   whitelist del PATCH. */

/* WHC: horas de trabajo. Se pega el plan del portal y devuelve el margen que le
   queda a cada conductor antes del limite semanal. */
export const whcAnalizar = (body) => api.post('/whc/analizar', body)
// El plan pegado se guarda por (centro, semana) para no tener que repegarlo.
export const getWhcPlan = (center) => api.get('/whc/plan', { params: { center } })
export const deleteWhcPlan = (center) => api.delete('/whc/plan', { params: { center } })
/* Que nave tiene plan de esta semana y cual no. Sin esto, una nave sin plan
   se ve igual que una pantalla rota: un hueco no dice si falta el dato o si
   no hay nada que contar. */
export const getWhcEstado = () => api.get('/whc/estado')

/* Investigaciones de DNR: Amazon pregunta donde se entrego un paquete que el
   cliente dice no haber recibido. `responder` PREPARA el correo (no lo manda) y
   `marcarDnrEnviada` lo confirma despues, cuando ya se le ha dado a enviar:
   abrir el correo no es haberlo enviado. */
/* Solo el numero, para el aviso del menu y del notificador en vivo: pedir la
   lista completa (con el contexto de Cortex de cada una) cada dos minutos
   desde todas las pantallas sería tirar trabajo para acabar mirando `.length`. */
/* Lo manda el servidor. `responder` solo PREPARA (abre tu correo); esto lo
   envía de verdad, que es lo único que funciona con más de 3 paquetes: el
   `mailto` pasa de 2.000 caracteres y Windows lo corta. */
/* Crea (o reutiliza) el enlace que se le manda al conductor y devuelve el
   WhatsApp ya escrito. El texto y el `wa.me` los arma el backend. */

// ── Aparcamiento: plano por centro + trazabilidad diaria ──
export const parkingLayout = (center) => api.get('/parking/layout', { params: { center } })
export const parkingSaveLayout = (body) => api.put('/parking/layout', body)
export const parkingState = (center, day) => api.get('/parking/state', { params: { center, day } })
export const parkingAssign = (body) => api.post('/parking/assign', body)
export const parkingReport = (body) => api.post('/parking/report', body)
export const parkingResolve = (body) => api.post('/parking/resolve', body)
export const parkingLastKnown = (center) => api.get('/parking/last-known', { params: { center } })
export const parkingZoneImage = (formData) => api.post('/parking/zone-image', formData)

/* Cuadre del debrief. `center` se manda crudo, como el resto del panel: el
   backend filtra por regex porque el centro esta guardado de cuatro formas
   distintas (gotcha 6). */
/* Daños abiertos que aun no han ido al taller. */
export const getDanosPendientes = (params) =>
  api.get('/work-orders/danos-pendientes', { params })
/* Las furgonetas que no estan trabajando, con los dias que llevan paradas. */
export const getFurgonetasParadas = (center) =>
  api.get('/work-orders/paradas', { params: centerParam(center) })
export const getCheckerCentros = () => api.get('/checkers/centros')
export const corregirCentros = () => api.post('/checkers/centros/corregir')
export const prepararOrden = (vehicleId) =>
  api.get(`/work-orders/preparar/${encodeURIComponent(vehicleId)}`)
export const getDisponibilidadFlota = (center) =>
  api.get('/fleet/disponibilidad', { params: centerParam(center) })
export const getPautaTaller = () => api.get('/taller/pauta')
export const setPautaTaller = (body) => api.patch('/taller/pauta', body)
export const setPlantillaTaller = (clave, body) =>
  api.patch(`/taller/plantillas/${encodeURIComponent(clave)}`, body)
export const getBandejaTaller = (soloSinLeer) =>
  api.get('/taller/bandeja', { params: soloSinLeer ? { solo_sin_leer: true } : {} })
export const marcarLeidoTaller = (id) =>
  api.post(`/taller/bandeja/${encodeURIComponent(id)}/leido`)
export const asignarMensajeTaller = (id, ordenId) =>
  api.post(`/taller/bandeja/${encodeURIComponent(id)}/asignar`, { orden_id: ordenId })
export const getInformeFlota = (params) => api.get('/taller/export', { params })
export const descargarInformeFlota = (params) =>
  api.get('/taller/export', { params: { ...params, formato: 'csv' }, responseType: 'blob' })
/* El mismo informe en PDF, con tabla y cabecera: es el que se imprime o se
   manda por correo. El CSV es para que Amazon lo abra y lo cruce; el PDF, para
   enseñarlo. Existia desde hacia meses y no lo llamaba ninguna pantalla. */
/* Bolsas de reparto de una furgoneta. La ficha ya ENSEÑABA el stock —un chip
   "Bolsas" en la cabecera— pero no habia forma de cambiarlo: las dos rutas
   llevaban sin boton desde siempre, asi que el numero se quedaba en 0 para
   todo el mundo. Un dato que se enseña y no se puede rellenar es peor que no
   enseñarlo: parece que la furgoneta no tiene bolsas. */
export const fijarBolsas = (vehicleId, bags, note) =>
  api.post(`/vehicles/${encodeURIComponent(vehicleId)}/bags/set`, { bags, note })
export const gastarBolsas = (vehicleId, used, note) =>
  api.post(`/vehicles/${encodeURIComponent(vehicleId)}/bags/consume`, { used, note })

export const descargarInformeFlotaPdf = (params) =>
  api.get('/reports/fleet-pdf', { params, responseType: 'blob' })
export const getLlavesPartner = () => api.get('/partner/tokens')
export const crearLlavePartner = (body) => api.post('/partner/tokens', body)
export const revocarLlavePartner = (id) =>
  api.delete(`/partner/tokens/${encodeURIComponent(id)}`)
export const getAccesosPartner = () => api.get('/partner/accesos')
export const previsualizarConductores = (fd) =>
  api.post('/drivers/importar/previsualizar', fd,
    { headers: { 'Content-Type': 'multipart/form-data' } })
export const importarConductores = (fd) =>
  api.post('/drivers/importar', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
// Moviles personales desde la agenda del telefono: analizar NO guarda nada.
export const analizarMoviles = (fd) =>
  api.post('/drivers/moviles/analizar', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
export const aplicarMoviles = (body) => api.post('/drivers/moviles/aplicar', body)

// ── Reparto a domicilio y a negocios ──
export const getRepartoAjustes = () => api.get('/reparto/ajustes')
export const guardarRepartoAjustes = (body) => api.put('/reparto/ajustes', body)
export const getRepartoPedidos = (fecha) => api.get('/reparto/pedidos', { params: { fecha } })
export const opinionEstado = () => api.get('/opinion/estado')
export const opinionEnviar = (d) => api.post('/opinion', d)
export const crearRepartoPedido = (body) => api.post('/reparto/pedidos', body)
export const pegarRepartoPedidos = (body) => api.post('/reparto/pegar', body)
export const editarRepartoPedido = (id, body) => api.patch(`/reparto/pedidos/${id}`, body)
export const borrarRepartoPedido = (id) => api.delete(`/reparto/pedidos/${id}`)
export const repartirPorZonas = (fecha) => api.post('/reparto/repartir', { fecha })
export const ordenarRutas = (fecha, conductorId) => api.post('/reparto/ordenar', { fecha, conductor_id: conductorId || '' })
export const getRepartoVivo = () => api.get('/reparto/vivo')
export const enlaceSeguimiento = (id) => api.post(`/reparto/pedidos/${id}/enlace`)
export const fotoEntrega = (id) => api.get(`/reparto/pedidos/${id}/foto`)
export const stripeSuscripcion = (plan, anual) => api.post('/billing/stripe/suscripcion', { plan, anual })
export const stripePortal = () => api.post('/billing/stripe/portal')
export const getRepartoEstadisticas = (dias = 14) => api.get('/reparto/estadisticas', { params: { dias } })
export const stripeCambiarPlan = (anual) => api.post('/billing/stripe/cambiar-plan', { anual })
export const comprarRegalo = (meses, paraMi = false) => api.post('/billing/regalos', { meses, ...(paraMi ? { para_mi: true } : {}) })
export const misRegalos = () => api.get('/billing/regalos')
export const canjearRegalo = (codigo) => api.post('/billing/regalos/canjear', { codigo })
export const playVerificar = (token) => api.post('/billing/play/verificar', { token })
