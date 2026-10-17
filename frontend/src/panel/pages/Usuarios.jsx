import { useEffect, useRef, useState } from 'react'
import { Loader2, UserPlus, Trash2, Save, ShieldCheck, Mail, KeyRound, ChevronDown, Users as UsersIcon, X, Check, ImagePlus, CornerDownRight, Lock, Table2, List } from 'lucide-react'
import { getAdmins, createAdmin, updateAdmin, deleteAdmin, subirFotoAdmin } from '../api'
import { getAdmin, isSuperAdmin, SIEMPRE_VISIBLES, esPlataforma } from '../auth'
import { useT } from '../../i18n'
import { lista } from '../../lib/lista'

// Catálogo de módulos asignables (la clave = último segmento de la ruta del panel)
/* Los permisos, con los MISMOS grupos, el MISMO orden y los MISMOS nombres que
   el menú (`NAV_DEF` en PanelLayout.jsx): la etiqueta es la misma clave de
   traducción, así que lo que se marca aquí es lo que sale allí. El 30-09-2026
   esta lista iba en otros grupos y otro orden, y no salían ni el Cuadrante ni
   las Órdenes de taller («actualízame usuarios para ver quién puede ver cada
   cosa»). Antes aún, siete pantallas del menú no tenían casilla y no se le
   podían dar a nadie.

   Las que TODO admin ve pase lo que pase (las de la operación diaria) salen de
   `SIEMPRE_VISIBLES`, en auth.js, que es la MISMA lista que usan el menú y el
   guardián de ruta. Se enseñan igual, con candado: una casilla que no hace
   nada al pulsarla es peor que no tenerla. `aprobar-dias` no es una pantalla:
   es poder aprobar o rechazar días libres (lo comprueba el servidor). */
const MODULES = [
  { g: 'nav.g.today', items: [
    ['dashboard', 'nav.dashboard'], ['mi-dia', 'nav.miDia'], ['chat', 'nav.chat'],
  ]},
  { g: 'nav.g.fleet', items: [
    ['vehiculos', 'nav.vehicles'], ['inspecciones', 'nav.inspections'], ['revision', 'nav.revision'],
    ['origen-danos', 'nav.origen'],
    // «Vencimientos» es UNA entrada del menú con tres partes: sale en cuanto
    // se marca cualquiera de las tres.
    ['avisos-itv', 'nav.itvalerts'], ['renting', 'nav.renting'], ['casas-alquiler', 'nav.rental'],
    ['aparcamiento', 'nav.parking'],
  ]},
  { g: 'nav.g.taller', items: [
    ['incidencias', 'nav.incidents'], ['talleres', 'nav.workshops'],
  ]},
  { g: 'nav.g.reparto', items: [
    ['reparto', 'nav.reparto'], ['asignacion', 'nav.assign'], ['plantilla', 'nav.template'], ['diarios', 'nav.dnr'], ['horas', 'nav.horas'],
    // Con casilla propia desde el 30-09-2026 (antes iba con Días libres).
    ['cuadrante', 'nav.cuadrante'],
    ['turnos', 'nav.shifts'], ['aprobar-dias', 'Aprobar días libres'], ['checklist-operativo', 'nav.checklist'],
  ]},
  { g: 'nav.g.personas', items: [
    ['conductores', 'nav.drivers'], ['incorporaciones', 'nav.incorporaciones'], ['empleo', 'nav.empleo'],
    ['contactos', 'nav.contacts'], ['conversaciones', 'nav.conversaciones'],
  ]},
  { g: 'nav.g.system', items: [
    ['actividad', 'nav.activity'], ['importaciones', 'nav.imports'], ['ia-peritaje', 'nav.ai'],
    // Sin esta casilla la pantalla no la ve NADIE con permisos definidos,
    // y el menu no dice por que (gotcha 27). Solo existe en la plataforma.
    ['tienda', 'nav.tienda'], ['configuracion', 'nav.settings'],
  ]},
]
/* Pantallas SIN casilla propia: van con otra, igual que en el menú y en la ruta
   (`itemVisible` y `routeAllowed` de PanelLayout). Se enseñan detrás de la
   suya para que se vea quién las tiene sin buscarlo. */
const VAN_CON = {
  talleres: [['ordenes', 'nav.ordenes']],
  vehiculos: [['estado-flota', 'nav.estadoFlota']],
}
const DE_VENCIMIENTOS = new Set(['avisos-itv', 'renting', 'casas-alquiler'])
const CAPACIDADES = new Set(['aprobar-dias'])
const ALL_KEYS = MODULES.flatMap((g) => g.items.map(([k]) => k))
const FIJOS = SIEMPRE_VISIBLES
const hayTienda = () => esPlataforma()
const gruposVisibles = () => MODULES.map((g) => ({
  ...g, items: g.items.filter(([k]) => k !== 'tienda' || hayTienda()),
}))

/* ¿Ve este usuario esta pantalla? La MISMA cuenta que el menú: el super-admin
   y quien no tiene lista lo ven todo; las fijas, siempre; las que van con otra,
   si tiene esa. Devuelve 'si' | 'no' | 'siempre'. */
function veLaPantalla(u, k) {
  if (u.super_admin || u.account_type === 'owner') return 'si'
  const perms = Array.isArray(u.permissions) ? u.permissions : null
  if (!perms) return 'si'
  if (FIJOS.has(k)) return 'siempre'
  const padre = Object.keys(VAN_CON).find((p) => VAN_CON[p].some(([h]) => h === k))
  return perms.includes(padre || k) ? 'si' : 'no'
}

/* Las pantallas del menú, una vez cada una (Vencimientos cuenta como una), para
   el «ve N de M». Las capacidades no son pantallas. */
function cuentaPantallas(perms) {
  const u = { permissions: perms }
  const claves = gruposVisibles().flatMap((g) => g.items.map(([k]) => k))
    .filter((k) => !CAPACIDADES.has(k) && !DE_VENCIMIENTOS.has(k))
  const derivadas = Object.values(VAN_CON).flat().map(([k]) => k)
  let ve = [...claves, ...derivadas].filter((k) => veLaPantalla(u, k) !== 'no').length
  const total = claves.length + derivadas.length + 1
  if (!Array.isArray(perms) || [...DE_VENCIMIENTOS].some((k) => perms.includes(k))) ve += 1
  return { ve, total }
}

/* ── Piezas de UI ── */

function Avatar({ name, photo, onUpload, subiendo }) {
  const initials = (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const fileRef = useRef(null)
  const base = (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500/30 to-brand-600/10 font-bold text-[13px] text-brand-200 ring-1 ring-brand-500/30">
      {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : initials}
    </div>
  )
  // Sin onUpload (super-admin, o quien no puede gestionar a este usuario) el
  // avatar es solo decorativo — el mismo permiso que ya manda para editarlo.
  if (!onUpload) return base
  return (
    <button type="button" title="Cambiar foto"
      onClick={() => fileRef.current?.click()}
      className="group relative h-9 w-9 shrink-0 rounded-full">
      {base}
      <input ref={fileRef} type="file" accept="image/*" hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onUpload(f) }} />
      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
        {subiendo ? <Loader2 size={13} className="animate-spin text-white" /> : <ImagePlus size={13} className="text-white" />}
      </span>
    </button>
  )
}

function RoleBadge({ u, t }) {
  if (u.super_admin || u.account_type === 'owner')
    return <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-semibold text-brand-300"><ShieldCheck size={10} /> Super-admin</span>
  if (u.admin_role === 'center_manager')
    return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">{t('usr.role.center')}</span>
  if (u.admin_role === 'dispatcher')
    return <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-300">Dispatcher</span>
  return <span className="rounded-full bg-dark-700 px-2 py-0.5 text-[10px] font-semibold text-dark-300">Admin</span>
}

/* El nombre de una casilla: el del menú, traducido. Las partes de Vencimientos
   llevan delante «Vencimientos ·», que es donde salen. */
function nombreDe(t, k, lbl) {
  const n = t(lbl)
  return DE_VENCIMIENTOS.has(k) ? `${t('nav.grp.expiry')} · ${n}` : n
}

/* Selector de pantallas: por grupos como el menú, con "todos" por grupo; las
   fijas con candado y las que van con otra detrás de la suya. */
function ModulePicker({ perms, onChange }) {
  const { t } = useT()
  const set = new Set(perms)
  const grupos = gruposVisibles()
  const toggle = (k) => {
    if (FIJOS.has(k)) return
    onChange(set.has(k) ? perms.filter(p => p !== k) : [...perms, k])
  }
  const toggleGroup = (g) => {
    const keys = g.items.map(([k]) => k).filter((k) => !FIJOS.has(k))
    const allOn = keys.every(k => set.has(k))
    onChange(allOn ? perms.filter(p => !keys.includes(p)) : [...new Set([...perms, ...keys])])
  }
  const { ve, total } = cuentaPantallas(perms)
  return (
    <div className="space-y-2.5">
      <p className="text-[12px] text-dark-300">Ve <b className="text-dark-100">{ve} de {total}</b> pantallas del menú.</p>
      {grupos.map((g) => {
        const keys = g.items.map(([k]) => k)
        const onCount = keys.filter(k => set.has(k) || FIJOS.has(k)).length
        return (
          <div key={g.g}>
            <button type="button" onClick={() => toggleGroup(g)}
              className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-dark-400 hover:text-dark-200">
              <span className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${onCount === keys.length ? 'border-brand-500 bg-brand-600 text-brand-tinta' : 'border-dark-600'}`}>
                {onCount === keys.length && <Check size={10} />}
              </span>
              {t(g.g)} <span className="font-normal text-dark-500">{onCount}/{keys.length}</span>
            </button>
            <div className="flex flex-wrap gap-1.5">
              {g.items.flatMap(([k, lbl]) => {
                const on = set.has(k) || FIJOS.has(k)
                const chip = (
                  <button key={k} type="button" onClick={() => toggle(k)} aria-pressed={on}
                    title={FIJOS.has(k)
                      ? 'Esta pantalla la ve todo el mundo aunque no la marques: es de la operación diaria.'
                      : CAPACIDADES.has(k) ? 'No es una pantalla: poder aprobar o rechazar los días libres que piden.' : undefined}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                      on ? 'bg-brand-500/20 text-brand-200 ring-1 ring-brand-500/40'
                        : 'bg-dark-800 text-dark-300 hover:text-dark-100'} ${FIJOS.has(k) ? 'cursor-default' : ''}`}>
                    {/* Se dice que da igual desmarcarla. Callarlo hace que alguien
                        la quite, crea que la ha quitado, y no sea verdad. */}
                    {FIJOS.has(k) && <Lock size={10} className="opacity-70" />}
                    {nombreDe(t, k, lbl)}
                    {FIJOS.has(k) && <span className="text-[9.5px] text-dark-500">·siempre</span>}
                  </button>
                )
                const hijas = (VAN_CON[k] || []).map(([h, hl]) => (
                  <span key={h} title={`Va con ${t(lbl)}: la ve quien tenga esa marcada.`}
                    className={`flex items-center gap-1 rounded-lg border border-dashed px-2.5 py-1 text-xs ${
                      on ? 'border-brand-500/40 text-brand-200' : 'border-dark-700 text-dark-500'}`}>
                    <CornerDownRight size={11} /> {t(hl)} <span className="text-[9.5px] opacity-80">· va con {t(lbl)}</span>
                  </span>
                ))
                return [chip, ...hijas]
              })}
            </div>
          </div>
        )
      })}
      <div className="flex gap-3 pt-0.5 text-[11px]">
        <button type="button" onClick={() => onChange(ALL_KEYS)} className="font-semibold text-dark-400 hover:text-dark-200">Marcar todo</button>
        <button type="button" onClick={() => onChange([])} className="font-semibold text-dark-400 hover:text-dark-200">Quitar todo</button>
      </div>
    </div>
  )
}

/* QUIÉN VE CADA PANTALLA: las pantallas en filas, como el menú, y cada usuario
   en una columna. La misma cuenta que el menú (`veLaPantalla`), así que lo
   que dice la tabla es lo que cada uno tiene en su barra. */
function QuienVe({ users, onEditar }) {
  const { t } = useT()
  const grupos = gruposVisibles()
  const marca = (v) => (v === 'si'
    ? <Check size={14} className="mx-auto text-emerald-300" aria-label="la ve" />
    : v === 'siempre'
      ? <span className="text-[10px] text-dark-500" title="La ve todo el mundo">siempre</span>
      : <span className="text-dark-600" aria-label="no la ve">—</span>)
  const fila = (k, lbl, hija) => (
    <tr key={k} className="border-t border-dark-800/70">
      <td className="sticky left-0 z-10 bg-dark-900 py-1.5 pl-3 pr-2 text-[12.5px] text-dark-200">
        <span className={`flex items-center gap-1 ${hija ? 'pl-3 text-dark-400' : ''}`}>
          {hija && <CornerDownRight size={11} />}
          {hija ? t(lbl) : nombreDe(t, k, lbl)}
          {CAPACIDADES.has(k) && <span className="text-[10px] text-dark-500">(aprobar)</span>}
        </span>
      </td>
      {users.map((u) => <td key={u.id} className="px-2 py-1.5 text-center">{marca(veLaPantalla(u, k))}</td>)}
    </tr>
  )
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-2xl border border-dark-800 bg-dark-900">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 bg-dark-900 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-dark-500">Pantalla</th>
              {users.map((u) => {
                const sup = u.super_admin || u.account_type === 'owner'
                return (
                  <th key={u.id} className="min-w-[6.5rem] px-2 py-2 text-center align-bottom">
                    <span className="block truncate text-[12px] font-semibold text-dark-100">{u.name || u.username}</span>
                    <span className="block truncate text-[10px] font-normal text-dark-500">
                      {sup ? 'todo' : (u.allowed_centers?.length ? u.allowed_centers.join(' · ') : 'todos los centros')}
                    </span>
                    {!sup && (
                      <button type="button" onClick={() => onEditar(u)}
                        className="mt-1 rounded-md border border-dark-700 px-2 py-0.5 text-[10.5px] font-semibold text-dark-300 hover:border-dark-500 hover:text-dark-100">
                        Editar
                      </button>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => [
              <tr key={g.g} className="border-t border-dark-700">
                <td colSpan={users.length + 1} className="sticky left-0 bg-dark-950/60 px-3 pb-1 pt-2.5 text-[10.5px] font-bold uppercase tracking-wide text-dark-400">
                  {t(g.g)}
                </td>
              </tr>,
              ...g.items.flatMap(([k, lbl]) => [fila(k, lbl, false), ...(VAN_CON[k] || []).map(([h, hl]) => fila(h, hl, true))]),
            ])}
          </tbody>
        </table>
      </div>
      <p className="text-[11.5px] text-dark-500">
        Negocio, Gastos y Valor: solo el super-admin. Usuarios: el super-admin y los gestores de centro. Cada uno ve
        además solo sus centros.
      </p>
    </div>
  )
}

/* Selector de centros. null = todos. */
function CenterPicker({ centers, value, onChange, t }) {
  if (!centers.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" onClick={() => onChange(null)}
        className={`rounded-lg px-2.5 py-1 text-xs font-medium ${value === null ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40' : 'bg-dark-800 text-dark-300 hover:text-dark-300'}`}>
        {t('usr.all.centers')}
      </button>
      {centers.map((c) => {
        const active = Array.isArray(value) && value.includes(c)
        return (
          <button key={c} type="button"
            onClick={() => {
              const curr = Array.isArray(value) ? value : []
              onChange(active ? curr.filter((x) => x !== c) : [...curr, c])
            }}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium ${active ? 'bg-brand-500/20 text-brand-200 ring-1 ring-brand-500/40' : 'bg-dark-800 text-dark-300 hover:text-dark-300'}`}>
            {c}
          </button>
        )
      })}
    </div>
  )
}

function Section({ title, icon: Icon, children }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-dark-500">
        {Icon && <Icon size={12} />} {title}
      </div>
      {children}
    </div>
  )
}

/* ── Página ── */

export default function Usuarios() {
  const { t } = useT()
  const me = getAdmin()
  const sa = isSuperAdmin()
  const ROLE_LABELS = { center_manager: t('usr.role.center'), dispatcher: 'Dispatcher', null: 'Admin completo' }
  const ROLE_DESCS = {
    center_manager: t('usr.role.center.desc'),
    dispatcher: t('usr.role.dispatcher.desc'),
    null: t('usr.role.admin.desc'),
  }
  const [users, setUsers] = useState(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const allOrgCenters = sa ? (me?.centers || []) : (me?.allowed_centers || [])
  const emptyForm = { name: '', username: '', password: '', perms: ALL_KEYS, centers: null, admin_role: null }
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null) // {id, perms, centers, admin_role, email, newPassword}
  // «Por usuario» (la lista de siempre) o «Quién ve cada pantalla» (la tabla).
  const [vista, setVista] = useState('usuarios')
  const abrirEditor = (u) => setEditing({
    id: u.id, perms: Array.isArray(u.permissions) ? u.permissions : ALL_KEYS,
    centers: Array.isArray(u.allowed_centers) ? u.allowed_centers : null,
    admin_role: u.admin_role ?? null, email: u.email || '', newPassword: '',
  })
  // Desde la tabla: a la lista, con ese usuario abierto y a la vista.
  const editarDesdeTabla = (u) => {
    abrirEditor(u)
    setVista('usuarios')
    setTimeout(() => document.getElementById(`usuario-${u.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function load() {
    getAdmins().then((r) => setUsers(lista(r.data))).catch(() => setErr(t('usr.load.error')))
  }
  useEffect(load, [])

  // Pedido por Dani: "que pueda ponerle yo una a cada uno de primeras". Se
  // sube y se recarga la lista para ver la foto nueva sin más pasos.
  const [subiendoFotoId, setSubiendoFotoId] = useState(null)
  async function subirFoto(userId, file) {
    setSubiendoFotoId(userId)
    try {
      await subirFotoAdmin(userId, file)
      load()
    } catch (e) {
      setMsg({ ok: false, t: e?.response?.data?.detail || 'No se pudo subir la foto.' })
    } finally { setSubiendoFotoId(null) }
  }

  const roleOptions = sa ? [null, 'center_manager', 'dispatcher'] : ['dispatcher']

  async function create() {
    if (!form.name || !form.username || form.password.length < 6) {
      return setMsg({ ok: false, t: t('usr.form.req') })
    }
    setBusy(true); setMsg(null)
    try {
      await createAdmin({ name: form.name.trim(), username: form.username.trim(), password: form.password, permissions: form.perms, allowed_centers: form.centers, admin_role: form.admin_role })
      setMsg({ ok: true, t: t('usr.created.ok').replace('{u}', form.username) })
      setForm(emptyForm); setShowCreate(false)
      load()
    } catch (e) {
      setMsg({ ok: false, t: e?.response?.data?.detail || t('usr.create.err') })
    } finally { setBusy(false) }
  }

  async function savePerms(id, perms, centers, admin_role) {
    setBusy(true); setMsg(null)
    try {
      await updateAdmin(id, { permissions: perms, allowed_centers: centers, admin_role: admin_role ?? null })
      setMsg({ ok: true, t: t('usr.perms.ok') }); setEditing(null); load()
    }
    catch (e) { setMsg({ ok: false, t: e?.response?.data?.detail || t('usr.update.err') }) } finally { setBusy(false) }
  }

  async function saveAccount(id, email, newPassword) {
    const body = {}
    if (typeof email === 'string') body.email = email.trim()
    if (newPassword) {
      if (newPassword.length < 6) return setMsg({ ok: false, t: 'La contraseña debe tener al menos 6 caracteres' })
      body.new_password = newPassword
    }
    if (Object.keys(body).length === 0) return
    setBusy(true); setMsg(null)
    try {
      await updateAdmin(id, body)
      setMsg({ ok: true, t: newPassword ? 'Contraseña restablecida' : 'Email guardado' })
      setEditing((s) => s && s.id === id ? { ...s, newPassword: '' } : s)
      load()
    } catch (e) { setMsg({ ok: false, t: e?.response?.data?.detail || t('usr.update.err') }) }
    finally { setBusy(false) }
  }

  async function remove(u) {
    if (!window.confirm(t('usr.delete.confirm').replace('{u}', u.name || u.username))) return
    setBusy(true)
    try { await deleteAdmin(u.id); setMsg({ ok: true, t: t('usr.deleted.ok') }); load() }
    catch (e) { setMsg({ ok: false, t: e?.response?.data?.detail || t('usr.delete.err') }) } finally { setBusy(false) }
  }

  const permsSummary = (perms) => {
    if (perms === null) return t('usr.access.all')
    const { ve, total } = cuentaPantallas(perms)
    if (ve >= total) return t('usr.access.all')
    return `ve ${ve} de ${total} pantallas`
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Cabecera */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 rise font-display text-[clamp(26px,3vw,36px)] font-semibold leading-none tracking-[-0.03em] text-dark-50"><UsersIcon size={20} className="text-brand-400" /> {t('usr.title')}</h1>
          <p className="mt-0.5 text-sm text-dark-400">Cada usuario ve solo los módulos y centros que le asignes.</p>
        </div>
        <button onClick={() => setShowCreate(s => !s)}
          className={showCreate ? 'btn-secondary flex items-center gap-2' : 'btn-primary flex items-center gap-2'}>
          {showCreate ? <X size={15} /> : <UserPlus size={15} />} {showCreate ? t('ui.close') : t('usr.create')}
        </button>
      </div>

      {err && <p className="mb-3 text-red-400">{err}</p>}
      {msg && <div className={`mb-4 rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>{msg.t}</div>}

      {/* Crear usuario (plegado por defecto) */}
      {showCreate && (
        <div className="card mb-6 space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className="label">{t('usr.name')}</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">{t('usr.username')}</label><input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
            <div><label className="label">{t('usr.password')}</label><input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          </div>

          <Section title={t('usr.role')}>
            <div className="flex flex-wrap gap-2">
              {roleOptions.map((r) => (
                <button key={String(r)} type="button" onClick={() => setForm({ ...form, admin_role: r })}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${form.admin_role === r ? 'bg-brand-500/25 text-brand-200 ring-1 ring-brand-500/50' : 'bg-dark-800 text-dark-400 hover:text-dark-200'}`}>
                  {ROLE_LABELS[String(r)] ?? ROLE_LABELS[r] ?? 'Admin completo'}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-dark-500">{ROLE_DESCS[form.admin_role] ?? ROLE_DESCS[null]}</p>
          </Section>

          <Section title={t('usr.perms')}>
            <ModulePicker perms={form.perms} onChange={(perms) => setForm({ ...form, perms })} />
          </Section>

          {allOrgCenters.length > 0 && (
            <Section title={t('usr.centers')}>
              <CenterPicker centers={allOrgCenters} value={form.centers} onChange={(centers) => setForm({ ...form, centers })} t={t} />
            </Section>
          )}

          <button onClick={create} disabled={busy} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} {t('usr.create')}
          </button>
        </div>
      )}

      {/* Dos formas de mirarlo: cada usuario con lo suyo, o cada pantalla con quién la ve. */}
      {users && users.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[['usuarios', 'Por usuario', List], ['pantallas', 'Quién ve cada pantalla', Table2]].map(([k, txt, Icono]) => (
            <button key={k} type="button" onClick={() => setVista(k)} aria-pressed={vista === k}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold ${vista === k
                ? 'bg-brand-500/20 text-dark-50' : 'text-dark-400 hover:bg-dark-800 hover:text-dark-200'}`}>
              <Icono size={14} /> {txt}
            </button>
          ))}
        </div>
      )}

      {users && vista === 'pantallas' && <QuienVe users={users} onEditar={editarDesdeTabla} />}

      {/* Lista de usuarios */}
      {!users ? <div className="flex items-center gap-2 text-dark-400"><Loader2 className="animate-spin" size={16} /> {t('ui.loading')}</div> : vista === 'usuarios' && (
        <div className="overflow-hidden rounded-2xl border border-dark-800">
          {users.map((u, i) => {
            const isSuper = u.super_admin || u.account_type === 'owner'
            const perms = Array.isArray(u.permissions) ? u.permissions : null
            const isEd = editing?.id === u.id
            return (
              <div key={u.id} id={`usuario-${u.id}`} className={`${i > 0 ? 'border-t border-dark-800' : ''} scroll-mt-4 bg-dark-900/40`}>
                {/* Fila */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={u.name || u.username} photo={u.photo_url}
                    onUpload={isSuper ? undefined : (file) => subirFoto(u.id, file)}
                    subiendo={subiendoFotoId === u.id} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold text-dark-50">{u.name || u.username}</span>
                      <RoleBadge u={u} t={t} />
                      {u.id === me?.id && <span className="rounded-full bg-dark-700 px-2 py-0.5 text-[10px] text-dark-200">{t('usr.you')}</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-dark-500">
                      <span className="font-mono">/{u.username}</span>
                      {!isSuper && <span>{u.allowed_centers?.length ? u.allowed_centers.join(' · ') : t('usr.all.centers')}</span>}
                      {!isSuper && <span className="text-dark-400">{permsSummary(perms)}</span>}
                    </div>
                  </div>
                  {!isSuper && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => (isEd ? setEditing(null) : abrirEditor(u))}
                        className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${isEd ? 'border-brand-500/50 bg-brand-500/10 text-brand-300' : 'border-dark-700 text-dark-300 hover:border-dark-500'}`}>
                        {t('ui.edit')} <ChevronDown size={12} className={`transition-transform ${isEd ? 'rotate-180' : ''}`} />
                      </button>
                      <button onClick={() => remove(u)} title={t('ui.delete')}
                        className="rounded-lg border border-dark-700 p-1.5 text-dark-500 hover:border-red-500/40 hover:text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Panel de edición */}
                {isEd && (
                  <div className="space-y-5 border-t border-dark-800 bg-dark-950/40 px-4 py-4">
                    <Section title={t('usr.role')}>
                      <div className="flex flex-wrap gap-2">
                        {roleOptions.map((r) => (
                          <button key={String(r)} type="button" onClick={() => setEditing((s) => ({ ...s, admin_role: r }))}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${editing.admin_role === r ? 'bg-brand-500/25 text-brand-200 ring-1 ring-brand-500/50' : 'bg-dark-800 text-dark-400 hover:text-dark-200'}`}>
                            {ROLE_LABELS[String(r)] ?? 'Admin completo'}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1.5 text-[11px] text-dark-500">{ROLE_DESCS[editing.admin_role] ?? ROLE_DESCS[null]}</p>
                    </Section>

                    <Section title={t('usr.perms')}>
                      <ModulePicker perms={editing.perms} onChange={(perms) => setEditing((s) => ({ ...s, perms }))} />
                    </Section>

                    {allOrgCenters.length > 0 && (
                      <Section title={t('usr.centers.visible')}>
                        <CenterPicker centers={allOrgCenters} value={editing.centers} onChange={(centers) => setEditing((s) => ({ ...s, centers }))} t={t} />
                      </Section>
                    )}

                    <button onClick={() => savePerms(u.id, editing.perms, editing.centers, editing.admin_role)} disabled={busy}
                      className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
                      <Save size={14} /> {t('usr.save.perms')}
                    </button>

                    <div className="grid gap-4 border-t border-dark-800 pt-4 sm:grid-cols-2">
                      <Section title="Email de recuperación" icon={Mail}>
                        <div className="flex gap-2">
                          <input type="email" className="input flex-1" placeholder="correo@ejemplo.com"
                            value={editing.email}
                            onChange={(e) => setEditing((s) => ({ ...s, email: e.target.value }))} />
                          <button onClick={() => saveAccount(u.id, editing.email, '')} disabled={busy}
                            className="btn-secondary text-sm disabled:opacity-50">Guardar</button>
                        </div>
                      </Section>
                      <Section title="Restablecer contraseña" icon={KeyRound}>
                        <div className="flex gap-2">
                          <input type="text" className="input flex-1" placeholder="Nueva contraseña (mín. 6)"
                            value={editing.newPassword}
                            onChange={(e) => setEditing((s) => ({ ...s, newPassword: e.target.value }))} />
                          <button onClick={() => saveAccount(u.id, undefined, editing.newPassword)} disabled={busy || !editing.newPassword}
                            className="btn-secondary text-sm disabled:opacity-50">Cambiar</button>
                        </div>
                      </Section>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
