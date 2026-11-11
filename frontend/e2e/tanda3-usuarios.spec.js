import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* Tanda 3, zona «usuarios» (11-11-2026): equipo-2 (un jefe de centro con naves no da «todos los centros») y equipo-10
   (añadir o quitar naves: solo el super-admin y quien tenga «Admin completo»). API simulada; cada caso pone encima las
   rutas que necesita. Se lanza en los dos proyectos (escritorio y movil). */

const json = (body, status = 200) => (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

function vigilar(page) {
  const fallos = []
  page.on('pageerror', (e) => fallos.push(`excepcion: ${String(e.message).slice(0, 200)}`))
  return fallos
}

/* El usuario de la sesión con su rol y sus naves: el panel los lee del blob `flota_admin` (la /auth/me simulada no
   trae `id`, así que no se guarda ningún acceso fresco que lo pise). */
async function entrarCon(page, { superAdmin = false, rol = null, mias = null, centros = ['OGA5', 'DGA1', 'DGA2'], arriba = 'Todos' } = {}) {
  await entrarComoAdmin(page, { superAdmin, centros })
  await page.addInitScript(({ rol, mias, centros, arriba, superAdmin }) => {
    localStorage.setItem('flota_admin', JSON.stringify({
      id: 'a1', name: 'Admin Test', role: 'admin', centers: centros, super_admin: superAdmin,
      admin_role: rol, allowed_centers: mias,
    }))
    localStorage.setItem('panel_center', arriba)
  }, { rol, mias, centros, arriba, superAdmin })
}

/* ── equipo-2 · Usuarios ── */
test.describe('Usuarios · un jefe de centro no da «todos los centros»', () => {
  const USUARIOS = [
    { id: 'a1', name: 'Jefe DGA1', username: 'jefe', admin_role: 'center_manager', allowed_centers: ['DGA1'] },
    { id: 'a2', name: 'Mery', username: 'mery', admin_role: 'dispatcher', allowed_centers: ['DGA1'], permissions: ['chat'] },
  ]

  async function abrir(page, opciones) {
    await entrarCon(page, opciones)
    await simularApi(page, 'vacio')
    await page.route(/\/api\/auth\/admins/, json(USUARIOS))
    await page.goto('/panel/usuarios', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Mery', { exact: true })).toBeVisible({ timeout: 45000 })
  }

  test('el jefe con naves crea con las suyas marcadas, sin «Todos los centros» y como dispatcher', async ({ page }) => {
    const fallos = vigilar(page)
    await abrir(page, { rol: 'center_manager', mias: ['DGA1'] })
    let enviado = null
    await page.route(/\/api\/auth\/create-admin/, (route) => {
      enviado = route.request().postDataJSON()
      return json({ success: true, id: 'n1', username: 'nuevo' })(route)
    })
    await page.getByRole('button', { name: 'Crear usuario' }).first().click()
    const nave = page.getByRole('main').getByRole('button', { name: 'DGA1', exact: true })
    await expect(nave).toBeVisible()
    await expect(page.getByRole('button', { name: 'Todos los centros', exact: true })).toHaveCount(0)
    await expect(page.getByText('Verá todos los centros', { exact: false })).toHaveCount(0)
    // Nombre, usuario y contraseña: las tres primeras cajas del formulario (sus etiquetas no van unidas a la caja).
    const cajas = page.locator('.card').first().locator('input')
    await cajas.nth(0).fill('Nuevo')
    await cajas.nth(1).fill('nuevo')
    await cajas.nth(2).fill('123456')
    await page.getByRole('button', { name: 'Crear usuario' }).last().click()
    await expect.poll(() => enviado).not.toBeNull()
    expect(enviado.allowed_centers).toEqual(['DGA1'])
    expect(enviado.admin_role).toBe('dispatcher')
    // Y al editar a uno suyo, tampoco.
    await page.getByRole('button', { name: 'Editar' }).last().click()
    await expect(page.getByRole('button', { name: 'Guardar permisos' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Todos los centros', exact: true })).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('el super-admin sí puede dar «todos», con el aviso, y parte de la nave elegida arriba', async ({ page }) => {
    const fallos = vigilar(page)
    await abrir(page, { superAdmin: true, arriba: 'OGA5' })
    await page.getByRole('button', { name: 'Crear usuario' }).first().click()
    const todos = page.getByRole('button', { name: 'Todos los centros', exact: true })
    await expect(todos).toBeVisible()
    // De partida, la nave de arriba y sin aviso.
    await expect(page.getByText('Verá todos los centros', { exact: false })).toHaveCount(0)
    await todos.click()
    await expect(page.getByText('Verá todos los centros', { exact: false })).toBeVisible()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('el super-admin con «Todos» arriba parte de todos los centros, con el aviso', async ({ page }) => {
    const fallos = vigilar(page)
    await abrir(page, { superAdmin: true })
    await page.getByRole('button', { name: 'Crear usuario' }).first().click()
    await expect(page.getByText('Verá todos los centros', { exact: false })).toBeVisible()
    await page.getByRole('main').getByRole('button', { name: 'DGA2', exact: true }).click()
    await expect(page.getByText('Verá todos los centros', { exact: false })).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

/* ── equipo-10 · Configuración: quitar naves, y añadir solo quien puede ── */
test.describe('Configuración · añadir o quitar centros', () => {
  async function abrir(page, opciones, naves = ['OGA5', 'DGA1', 'DGA2', 'OGA9']) {
    await entrarCon(page, opciones)
    await simularApi(page, 'vacio')
    await page.route(/\/api\/org\/centers(\?|$)/, json({ centers: naves, max_centers: 999, account_type: 'owner' }))
    await page.goto('/panel/configuracion', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible({ timeout: 45000 })
    await expect(page.getByRole('main').getByText('OGA9', { exact: true })).toBeVisible()
  }

  test('quien tiene «Admin completo» quita una nave vacía y ve por qué no puede quitar una con gente', async ({ page }) => {
    const fallos = vigilar(page)
    await abrir(page, { rol: null })
    const pedidas = []
    await page.route(/\/api\/org\/centers\/.+/, (route) => {
      const nave = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop())
      pedidas.push(`${route.request().method()} ${nave}`)
      if (nave === 'OGA5') {
        return json({ detail: { mensaje: 'OGA5 tiene 12 conductores y 9 furgonetas: muévelos a otro centro antes de quitarlo.',
          conductores: 12, furgonetas: 9, usuarios: 0 } }, 409)(route)
      }
      return json({ ok: true, centers: ['OGA5', 'DGA1', 'DGA2'] })(route)
    })
    page.on('dialog', (d) => d.accept())
    await expect(page.getByPlaceholder('Nuevo centro', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Quitar OGA5' }).click()
    await expect(page.getByText('OGA5 tiene 12 conductores y 9 furgonetas', { exact: false })).toBeVisible()
    await expect(page.getByRole('main').getByText('OGA5', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Quitar OGA9' }).click()
    await expect(page.getByText('Centro OGA9 quitado', { exact: false })).toBeVisible()
    await expect(page.getByRole('main').getByText('OGA9', { exact: true })).toHaveCount(0)
    expect(pedidas).toEqual(['DELETE OGA5', 'DELETE OGA9'])
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('flota_admin')).centers)).toEqual(['OGA5', 'DGA1', 'DGA2'])
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  for (const rol of ['dispatcher', 'center_manager']) {
    test(`un ${rol} no ve ni la caja de añadir ni la ×`, async ({ page }) => {
      const fallos = vigilar(page)
      await abrir(page, { rol, mias: ['DGA1'] })
      await expect(page.getByText('Solo un administrador completo puede añadir o quitar centros.')).toBeVisible()
      await expect(page.getByPlaceholder('Nuevo centro', { exact: false })).toHaveCount(0)
      await expect(page.getByRole('button', { name: /^Quitar / })).toHaveCount(0)
      expect(fallos, fallos.join(' | ')).toHaveLength(0)
    })
  }

  test('con un solo centro no sale la × (no se puede quedar sin ninguno)', async ({ page }) => {
    const fallos = vigilar(page)
    await abrir(page, { superAdmin: true }, ['OGA9'])
    await expect(page.getByPlaceholder('Nuevo centro', { exact: false })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Quitar / })).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

/* ── equipo-10 · Importaciones: «Añadir X a mi empresa», solo a quien puede ── */
test.describe('Importaciones · añadir una nave del fichero', () => {
  const VISTA = (empresa) => ({
    nombre: 'pegado-desde-excel.csv', matriculas: 3, repetidas: 0, sin_matricula: 0, flota_actual: 5,
    columnas: ['license_plate', 'center'], ignoradas: [], cabeceras: [], campos: [], centros_empresa: empresa,
    centros: [
      { clave: 'AMZL DGA1 CORUNA', texto: 'AMZL DGA1 CORUNA', sugerido: 'DGA1', conocido: true, filas: 1, nuevas: 0, ya_estan: 1, ejemplos: ['1111AAA'] },
      { clave: 'AMZL XYZ1 LUGO', texto: 'AMZL XYZ1 LUGO', sugerido: 'XYZ1', conocido: false, filas: 1, nuevas: 1, ya_estan: 0, ejemplos: ['2222BBB'] },
      { clave: 'AMZL OGA5 SANTIAGO', texto: 'AMZL OGA5 SANTIAGO', sugerido: 'OGA5', conocido: false, filas: 1, nuevas: 1, ya_estan: 0, ejemplos: ['3333CCC'] },
    ],
  })

  async function revisar(page, opciones, empresa) {
    await entrarCon(page, opciones)
    await simularApi(page, 'vacio')
    await page.route(/\/api\/import\/vehicles\/previsualizar/, json(VISTA(empresa)))
    await page.goto('/panel/importaciones', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Pegar desde Excel' }).click({ timeout: 45000 })
    await page.locator('textarea').fill('Matrícula\tCentro\n1111AAA\tAMZL DGA1 CORUNA')
    await page.getByRole('button', { name: 'Revisar' }).click()
    await expect(page.getByText('AMZL XYZ1 LUGO')).toBeVisible()
  }

  test('quien tiene «Admin completo» puede añadir la nave nueva, no una que la empresa ya tiene', async ({ page }) => {
    const fallos = vigilar(page)
    // Una persona que solo ve DGA1 en una empresa con OGA5: OGA5 no se le ofrece para añadir (ya existe).
    await revisar(page, { rol: null, mias: ['DGA1'] }, ['DGA1'])
    await expect(page.getByRole('button', { name: 'Añadir XYZ1 a mi empresa' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Añadir OGA5 a mi empresa' })).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('un dispatcher no ve «Añadir … a mi empresa»', async ({ page }) => {
    const fallos = vigilar(page)
    await revisar(page, { rol: 'dispatcher', mias: ['DGA1'] }, ['DGA1'])
    await expect(page.getByRole('button', { name: /a mi empresa/ })).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

/* ══ CORRECCIONES de la primera revisión (11-11-2026) ══ */

/* P34: sin ninguna nave marcada ([]) el servidor guarda «todos»; la pantalla lo dice y resalta «Todos». Un jefe con
   naves no puede crear así: «Marca al menos un centro». */
test.describe('Usuarios · sin ninguna nave marcada (P34)', () => {
  const USUARIOS = [
    { id: 'a1', name: 'Jefe DGA1', username: 'jefe', admin_role: 'center_manager', allowed_centers: ['DGA1'] },
    { id: 'a2', name: 'Mery', username: 'mery', admin_role: 'dispatcher', allowed_centers: ['DGA1'], permissions: ['chat'] },
  ]

  async function abrir(page, opciones) {
    await entrarCon(page, opciones)
    await simularApi(page, 'vacio')
    await page.route(/\/api\/auth\/admins/, json(USUARIOS))
    await page.goto('/panel/usuarios', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Mery', { exact: true })).toBeVisible({ timeout: 45000 })
    await page.getByRole('button', { name: 'Crear usuario' }).first().click()
  }

  test('el super-admin desmarca la nave de arriba: «Todos» resaltado y el aviso', async ({ page }) => {
    const fallos = vigilar(page)
    await abrir(page, { superAdmin: true, arriba: 'OGA5' })
    const todos = page.getByRole('button', { name: 'Todos los centros', exact: true })
    await expect(todos).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByText('Verá todos los centros', { exact: false })).toHaveCount(0)
    await page.getByRole('main').getByRole('button', { name: 'OGA5', exact: true }).click()
    await expect(page.getByText('Verá todos los centros', { exact: false })).toBeVisible()
    await expect(todos).toHaveAttribute('aria-pressed', 'true')
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('el jefe con naves no puede crear sin ninguna marcada', async ({ page }) => {
    const fallos = vigilar(page)
    let pedidas = 0
    await page.route(/\/api\/auth\/create-admin/, (route) => { pedidas += 1; return json({ success: true, id: 'n1' })(route) })
    await abrir(page, { rol: 'center_manager', mias: ['DGA1'] })
    const cajas = page.locator('.card').first().locator('input')
    await cajas.nth(0).fill('Nuevo')
    await cajas.nth(1).fill('nuevo')
    await cajas.nth(2).fill('123456')
    await page.getByRole('main').getByRole('button', { name: 'DGA1', exact: true }).click()
    await expect(page.getByText('Marca al menos un centro.')).toBeVisible()
    await expect(page.getByText('Verá todos los centros', { exact: false })).toHaveCount(0)
    const crear = page.getByRole('button', { name: 'Crear usuario' }).last()
    await expect(crear).toBeDisabled()
    // Y al volver a marcarla se puede.
    await page.getByRole('main').getByRole('button', { name: 'DGA1', exact: true }).click()
    await expect(page.getByText('Marca al menos un centro.')).toHaveCount(0)
    await expect(crear).toBeEnabled()
    expect(pedidas).toBe(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

/* P16 + P17: un jefe de centro ve la lista de siempre, pero a quien no puede gestionar (un «Admin completo», otro jefe,
   él mismo) sin «Editar» ni la papelera. El servidor lo dice con `puede_gestionar`. */
test.describe('Usuarios · el jefe no gestiona a quien puede más (P16/P17)', () => {
  const USUARIOS = [
    { id: 'a1', name: 'Jefe DGA1', username: 'jefe', admin_role: 'center_manager', allowed_centers: ['DGA1'], puede_gestionar: false },
    { id: 'a2', name: 'Mery', username: 'mery', admin_role: 'dispatcher', allowed_centers: ['DGA1'], permissions: ['chat'], puede_gestionar: true },
    { id: 'a3', name: 'Rosa Oficina', username: 'rosa', admin_role: null, allowed_centers: null, puede_gestionar: false },
  ]

  test('solo la fila del dispatcher lleva «Editar» y la papelera, también en «Quién ve cada pantalla»', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarCon(page, { rol: 'center_manager', mias: ['DGA1'] })
    await simularApi(page, 'vacio')
    await page.route(/\/api\/auth\/admins/, json(USUARIOS))
    await page.goto('/panel/usuarios', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Rosa Oficina', { exact: true })).toBeVisible({ timeout: 45000 })
    for (const [id, botones] of [['a1', 0], ['a2', 1], ['a3', 0]]) {
      const fila = page.locator(`#usuario-${id}`)
      await expect(fila.getByRole('button', { name: 'Editar' })).toHaveCount(botones)
      await expect(fila.getByRole('button', { name: 'Eliminar' })).toHaveCount(botones)
    }
    await page.getByRole('button', { name: 'Quién ve cada pantalla' }).click()
    await expect(page.getByRole('columnheader', { name: /Rosa Oficina/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Editar', exact: true })).toHaveCount(1)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('sin el campo (super-admin o un servidor de antes) todo sigue con sus botones', async ({ page }) => {
    const fallos = vigilar(page)
    await entrarCon(page, { superAdmin: true })
    await simularApi(page, 'vacio')
    await page.route(/\/api\/auth\/admins/, json(USUARIOS.map(({ puede_gestionar: _, ...u }) => u)))
    await page.goto('/panel/usuarios', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Rosa Oficina', { exact: true })).toBeVisible({ timeout: 45000 })
    for (const id of ['a1', 'a2', 'a3']) {
      await expect(page.locator(`#usuario-${id}`).getByRole('button', { name: 'Editar' })).toHaveCount(1)
    }
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})

/* V4 (tercera ronda): el usuario de rol vacío que un jefe dio de alta con el formulario de main («Admin completo» sin
   querer). El servidor le pone `puede_gestionar: true` al jefe que lo creó; la pantalla le dice que al guardar pasa a
   Dispatcher, y lo guarda como Dispatcher. */
test.describe('Usuarios · el jefe y la gente que él mismo dio de alta (V4)', () => {
  const USUARIOS = [
    { id: 'a1', name: 'Jefe DGA1', username: 'jefe', admin_role: 'center_manager', allowed_centers: ['DGA1'], puede_gestionar: false },
    { id: 'a2', name: 'Mery', username: 'mery', admin_role: 'dispatcher', allowed_centers: ['DGA1'], permissions: ['chat'], puede_gestionar: true },
    { id: 'a4', name: 'Pepe Alta', username: 'pepe', admin_role: null, allowed_centers: ['DGA1'], permissions: ['chat'], puede_gestionar: true },
    { id: 'a5', name: 'Rosa Oficina', username: 'rosa', admin_role: null, allowed_centers: ['DGA1'], puede_gestionar: false },
  ]
  const AVISO = 'Al guardar cualquier cambio pasa a Dispatcher'

  async function abrir(page, opciones, usuarios = USUARIOS) {
    await entrarCon(page, opciones)
    await simularApi(page, 'vacio')
    await page.route(/\/api\/auth\/admins$/, json(usuarios))
    await page.goto('/panel/usuarios', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Pepe Alta', { exact: true })).toBeVisible({ timeout: 45000 })
  }

  test('lo puede editar, se le dice que pasa a Dispatcher y se guarda como Dispatcher', async ({ page }) => {
    const fallos = vigilar(page)
    await abrir(page, { rol: 'center_manager', mias: ['DGA1'] })
    let enviado = null
    await page.route(/\/api\/auth\/admins\/a4$/, (route) => {
      enviado = route.request().postDataJSON()
      return json({ success: true })(route)
    })
    await expect(page.locator('#usuario-a5').getByRole('button', { name: 'Editar' })).toHaveCount(0)
    const fila = page.locator('#usuario-a4')
    await fila.getByRole('button', { name: 'Editar' }).click()
    await expect(fila.getByText(AVISO, { exact: false })).toBeVisible()
    await fila.getByRole('button', { name: 'Guardar permisos' }).click()
    await expect.poll(() => enviado).not.toBeNull()
    expect(enviado.admin_role).toBe('dispatcher')
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('a un dispatcher, y para el super-admin, sin el aviso', async ({ page }) => {
    const fallos = vigilar(page)
    await abrir(page, { rol: 'center_manager', mias: ['DGA1'] })
    await page.locator('#usuario-a2').getByRole('button', { name: 'Editar' }).click()
    await expect(page.locator('#usuario-a2').getByRole('button', { name: 'Guardar permisos' })).toBeVisible()
    await expect(page.getByText(AVISO, { exact: false })).toHaveCount(0)
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })

  test('el super-admin abre al de rol vacío como «Admin completo» y sin el aviso', async ({ page }) => {
    const fallos = vigilar(page)
    await abrir(page, { superAdmin: true }, USUARIOS.map(({ puede_gestionar: _, ...u }) => u))
    let enviado = null
    await page.route(/\/api\/auth\/admins\/a4$/, (route) => {
      enviado = route.request().postDataJSON()
      return json({ success: true })(route)
    })
    const fila = page.locator('#usuario-a4')
    await fila.getByRole('button', { name: 'Editar' }).click()
    await expect(fila.getByRole('button', { name: 'Guardar permisos' })).toBeVisible()
    await expect(page.getByText(AVISO, { exact: false })).toHaveCount(0)
    await fila.getByRole('button', { name: 'Guardar permisos' }).click()
    await expect.poll(() => enviado).not.toBeNull()
    expect(enviado.admin_role).toBeNull()
    expect(fallos, fallos.join(' | ')).toHaveLength(0)
  })
})
