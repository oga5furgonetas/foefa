/* global process */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* EL MARCO DEL PANEL (14-11-2026, tanda de diseño, zona «marco»): el menú, la barra de abajo del móvil, la burbuja del
   asistente, las ventanas y el botón desactivado. Lo que se vigila aquí es lo que se ve y se puede medir:
   · M1 · el menú sin cuadraditos de colores: el icono de cada grupo va sin fondo y en gris; el del grupo activo, en tinta.
   · M2 · sin la tarjeta «Acceso Fundador»; «Portal Conductor» es una línea más del menú, sin caja de color.
   · M3 · el asistente (desde la tanda 6, un botón de la barra de arriba y no una burbuja) no sale en «Repaso», y su
     ventana no se ve mientras haya otra ventana abierta.
   · M4 · la barra de abajo: sin «Revisión rápida» (las empresas nuevas), «Repaso» va segundo; con ella, la de siempre.
   · M5 · el selector de sede, sin mono ni mayúsculas espaciadas.
   · M6 · la ventana «El acceso de…»: opaca, borde de 1 px, sin sombra, por encima de la barra de abajo.
   · M7 · un botón desactivado: hueco y tinta apagada, sin opacidad (nunca un cian lavado).
   Con FOTOS_MARCO=<carpeta>, la prueba de fotos guarda las de cada tema. */

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const ACCESOS = JSON.parse(fs.readFileSync(path.join(AQUI, 'fixtures', 'alta-accesos.json'), 'utf8'))
const FOTOS = process.env.FOTOS_MARCO || ''
const TEMAS = ['hibrido', 'dark', 'light']
// Lo que trae una empresa nueva con Esencial (server.py, MODULOS_ESTANDAR menos `_MODULOS_SOLO_PRO`): sin «revision».
const ESENCIAL = ['dashboard', 'mi-dia', 'vehiculos', 'repaso', 'inspecciones', 'incidencias', 'talleres', 'ordenes',
  'vencimientos', 'importaciones', 'conductores', 'chat', 'configuracion']

async function montar(page, { tema = 'hibrido', modulos, escenario = 'lleno' } = {}) {
  await entrarComoAdmin(page)
  await page.addInitScript((t) => {
    localStorage.setItem('panel_theme', t)
    localStorage.setItem('panel_theme_elegido', '1')
  }, tema)
  await simularApi(page, escenario)
  await page.route(/\/api\/org\/billing(\?|$)/, (r) => r.fulfill({ json: { plan: 'esencial', status: 'active', ...(modulos ? { modulos } : {}) } }))
  await page.route(/\/api\/repaso\/pendientes(\?|$)/, (r) => r.fulfill({ json: { fecha: '2026-11-14', pendientes: 2 } }))
  await page.route(/\/api\/conductores\/accesos/, (r) => r.fulfill({ json: ACCESOS }))
  await page.route(/\/api\/drivers(\?|$)/, (r) => r.fulfill({ json: ACCESOS.conductores.map((c) => ({
    id: c.driver_id, name: c.nombre, center: 'NORTE', active: true, phone: c.movil, email: c.email })) }))
}

async function foto(page, nombre, opciones = {}) {
  if (!FOTOS) return
  fs.mkdirSync(FOTOS, { recursive: true })
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(FOTOS, `${nombre}.png`), ...opciones })
}

const barraAbajo = (page) => page.locator('nav.fixed.bottom-0')
const burbuja = (page) => page.getByTitle(/IA$/)

/* ── M1 · M2 · M5 ──────────────────────────────────────────────────────────────────────────────────────────────── */
test('Menú · iconos sin cuadradito de color, sin «Acceso Fundador», y «Portal Conductor» como una línea más', async ({ page, isMobile }) => {
  test.skip(isMobile, 'el menú lateral es del escritorio')
  await montar(page)
  await page.goto('/panel/repaso', { waitUntil: 'domcontentloaded' })
  const menu = page.locator('aside:has(.rail)')
  await expect(menu.locator('a[href="/panel/repaso"]')).toBeVisible()
  // Ningún fondo de color detrás de los iconos de grupo, ni clases de color en ellos.
  const cabeceras = menu.locator('.nav-ghead')
  expect(await cabeceras.count()).toBeGreaterThan(3)
  const html = await menu.innerHTML()
  expect(html).not.toMatch(/bg-(amber|emerald|orange|sky|violet)-500\/10|text-(amber|emerald|orange|sky|violet)-400/)
  // Sin la tarjeta del fundador.
  await expect(page.getByText('Acceso Fundador')).toHaveCount(0)
  // «Portal Conductor», una línea del menú (nav-item), sin borde ni fondo de color.
  const portal = menu.locator('a[href="/panel/portal-conductor"]')
  await expect(portal).toHaveClass(/nav-item/)
  await expect(portal).toHaveCSS('border-top-width', '0px')
  // El grupo de la pantalla abierta, en tinta; los demás, en gris.
  const activo = menu.locator('.nav-ghead', { hasText: 'Flota' }).locator('svg').first()
  const otro = menu.locator('.nav-ghead', { hasText: 'Taller' }).locator('svg').first()
  expect(await activo.evaluate((e) => getComputedStyle(e).color)).not.toBe(await otro.evaluate((e) => getComputedStyle(e).color))
  // M5 · el selector de sede, con la letra de la casa (sin mono, sin interletra).
  const sede = page.locator('header').getByText('NORTE', { exact: true }).first()
  await expect(sede).toBeVisible()
  expect(await sede.evaluate((e) => getComputedStyle(e).fontFamily)).not.toMatch(/mono/i)
  expect(await sede.evaluate((e) => getComputedStyle(e).letterSpacing)).toMatch(/^(normal|0px|-)/)
})

/* ── M3 ────────────────────────────────────────────────────────────────────────────────────────────────────────── */
/* El asistente, un botón de la barra de arriba (tanda 6, zona panel): flotando siempre tapaba algo. */
test('Asistente · un botón en la barra de arriba: sale en el Inicio, no en «Repaso», y su ventana se esconde con una ventana abierta', async ({ page, isMobile }) => {
  await montar(page)
  await page.goto('/panel', { waitUntil: 'domcontentloaded' })
  const boton = page.getByRole('button', { name: 'Asistente', exact: true })
  await expect(boton).toBeVisible()
  // En la barra de arriba (no flotando sobre la página), de 36 px, con borde de 1 px, sin relleno cian ni sombra.
  expect(await boton.evaluate((b) => !!b.closest('header') && !b.closest('main'))).toBe(true)
  const est = await boton.evaluate((b) => {
    const s = getComputedStyle(b)
    return { ancho: b.offsetWidth, alto: b.offsetHeight, borde: s.borderTopWidth, fondo: s.backgroundColor, sombra: s.boxShadow, pos: s.position }
  })
  expect(est).toMatchObject({ ancho: 36, alto: 36, borde: '1px', sombra: 'none' })
  expect(est.fondo).toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
  // Ya no hay burbuja flotante.
  await expect(page.getByTestId('burbuja-asistente')).toHaveCount(0)
  // Abre la ventana de siempre: arriba a la derecha en el ordenador, casi a pantalla entera en el móvil.
  await boton.click()
  const ventana = page.getByTestId('ventana-asistente')
  await expect(ventana).toBeVisible()
  await expect(ventana.getByPlaceholder('Escribe tu pregunta…')).toBeVisible()
  const v = await ventana.boundingBox()
  const vista = page.viewportSize()
  if (isMobile) {
    expect(v.width).toBeGreaterThanOrEqual(vista.width - 20)
    expect(v.height).toBeGreaterThanOrEqual(vista.height * 0.8)
  } else {
    expect(v.y).toBeLessThan(80)
    expect(vista.width - (v.x + v.width)).toBeLessThanOrEqual(24)
  }
  // Escape la cierra; el botón la vuelve a abrir.
  await page.keyboard.press('Escape')
  await expect(ventana).toBeHidden()
  // Sin recargar: con el menú de la propia app. En el Repaso no sale.
  await page.evaluate(() => { window.history.pushState({}, '', '/panel/repaso'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await expect(page).toHaveURL(/\/panel\/repaso/)
  await expect(boton).toHaveCount(0)
  await page.evaluate(() => { window.history.pushState({}, '', '/panel/conductores'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await expect(boton).toBeVisible()
  await boton.click()
  await expect(ventana).toBeVisible()
  // Con una ventana del panel abierta, la del asistente no se ve (el clic, por código: en el móvil la del asistente
  // tapa la lista).
  await page.getByTestId('boton-acceso').filter({ hasText: 'Mandar su acceso' }).first().evaluate((b) => b.click())
  await expect(page.getByRole('dialog', { name: /^El acceso de/ })).toBeVisible()
  await expect(ventana).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: /^El acceso de/ })).toHaveCount(0)
  await expect(boton).toBeVisible()
})

/* ── M4 ────────────────────────────────────────────────────────────────────────────────────────────────────────── */
test('Barra de abajo · una empresa sin «Revisión rápida» lleva «Repaso» segundo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await montar(page, { modulos: ESENCIAL })
  await page.goto('/panel', { waitUntil: 'domcontentloaded' })
  const barra = barraAbajo(page)
  await expect(barra.getByRole('link')).toHaveText(['Inicio', 'Repaso', 'Vehículos', 'Mi día'], { timeout: 30000 })
  await foto(page, 'barra-390-empresa-nueva')
})

test('Barra de abajo · una empresa con «Revisión rápida» la conserva exactamente como estaba', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await montar(page)
  await page.goto('/panel', { waitUntil: 'domcontentloaded' })
  const barra = barraAbajo(page)
  await expect(barra.getByRole('link')).toHaveText(['Inicio', 'Revisión rápida', 'Asignación diaria', 'Vehículos'], { timeout: 30000 })
  await expect(barra.getByRole('link', { name: 'Repaso' })).toHaveCount(0)
  await foto(page, 'barra-390-revision-rapida')
})

/* ── M6 ────────────────────────────────────────────────────────────────────────────────────────────────────────── */
for (const tema of TEMAS) {
  test(`Ventana · «El acceso de…» es opaca, con borde de 1 px, sin sombra y por encima de la barra (${tema})`, async ({ page }) => {
    await montar(page, { tema })
    await page.goto('/panel/conductores', { waitUntil: 'domcontentloaded' })
    await page.getByTestId('boton-acceso').filter({ hasText: 'Mandar su acceso' }).first().click()
    const ventana = page.getByRole('dialog', { name: /^El acceso de/ })
    await expect(ventana).toBeVisible()
    await expect(ventana).toHaveClass(/\bventana\b/)
    const estilo = await ventana.evaluate((e) => {
      const s = getComputedStyle(e)
      let capa = e
      while (capa && getComputedStyle(capa).position !== 'fixed') capa = capa.parentElement
      return { fondo: s.backgroundColor, borde: s.borderTopWidth, sombra: s.boxShadow, filtro: s.backdropFilter, z: Number(getComputedStyle(capa).zIndex) }
    })
    // Opaca: rgb(…), nunca rgba(…, <1).
    expect(estilo.fondo).toMatch(/^rgb\(/)
    expect(estilo.borde).toBe('1px')
    expect(estilo.sombra).toBe('none')
    expect(estilo.filtro === 'none' || !estilo.filtro).toBe(true)
    expect(estilo.z).toBeGreaterThanOrEqual(100)
    await foto(page, `ventana-acceso-${tema}-${page.viewportSize().width}`)
  })
}

/* ── M7 ────────────────────────────────────────────────────────────────────────────────────────────────────────── */
for (const tema of TEMAS) {
  test(`Desactivado · «.btn-primary» desactivado es hueco con tinta apagada, sin opacidad (${tema})`, async ({ page }) => {
    await montar(page, { tema })
    await page.goto('/panel', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main')).toBeVisible()
    // Un botón de verdad de la hoja de estilos, puesto dentro del contenido (el híbrido tiñe <main>) y en el menú.
    const medir = await page.evaluate(() => {
      const hacer = (padre) => {
        const b = document.createElement('button')
        b.className = 'btn-primary disabled:opacity-50'
        b.textContent = 'Guardar'
        b.disabled = true
        padre.appendChild(b)
        const s = getComputedStyle(b)
        const r = { fondo: s.backgroundColor, tinta: s.color, opacidad: s.opacity }
        b.remove()
        return r
      }
      const vivo = document.createElement('button')
      vivo.className = 'btn-primary'
      document.querySelector('main').appendChild(vivo)
      const cian = getComputedStyle(vivo).backgroundColor
      vivo.remove()
      return { main: hacer(document.querySelector('main')), cian }
    })
    expect(medir.main.opacidad).toBe('1')
    expect(medir.main.fondo).not.toBe(medir.cian)
    expect(medir.main.tinta).not.toBe('rgb(255, 255, 255)')
  })
}

/* ── Las fotos de los tres temas (FOTOS_MARCO) ─────────────────────────────────────────────────────────────────── */
test('Fotos · el menú, la ventana del acceso y un botón desactivado en los tres temas', async ({ page, isMobile }) => {
  test.skip(!FOTOS, 'solo con FOTOS_MARCO')
  test.setTimeout(180_000)
  const ancho = isMobile ? 390 : 1280
  for (const tema of TEMAS) {
    await page.setViewportSize({ width: ancho, height: isMobile ? 844 : 900 })
    await montar(page, { tema })
    await page.goto('/panel/repaso', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)
    await foto(page, `menu-${tema}-${ancho}`)
    await page.goto('/panel/conductores', { waitUntil: 'domcontentloaded' })
    await page.getByTestId('boton-acceso').filter({ hasText: 'Mandar su acceso' }).first().click()
    await expect(page.getByRole('dialog', { name: /^El acceso de/ })).toBeVisible()
    await foto(page, `acceso-${tema}-${ancho}`)
    await page.keyboard.press('Escape')
    // Un botón desactivado de verdad: «Enviar» del asistente, con la caja de escribir vacía.
    await page.goto('/panel', { waitUntil: 'domcontentloaded' })
    await burbuja(page).last().click()
    await expect(page.getByPlaceholder('Escribe tu pregunta…')).toBeVisible()
    await foto(page, `desactivado-${tema}-${ancho}`)
    await page.unrouteAll({ behavior: 'ignoreErrors' })
  }
})
