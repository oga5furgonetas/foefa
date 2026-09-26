import { test } from '@playwright/test'
import path from 'node:path'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* REVISIÓN VISUAL — no comprueba nada: saca una foto de cada pantalla con la
   API simulada «lleno», en escritorio, para MIRARLAS después de un cambio de
   diseño. Las pruebas de humo dicen si una pantalla revienta; esto enseña si
   se ve bien, que es otra cosa.

   Uso:  REVISION_DIR=/ruta npx playwright test revision-visual --project=escritorio
   Sin REVISION_DIR no hace nada (no corre en el CI). */
const DIR = process.env.REVISION_DIR
const PANTALLAS = (process.env.REVISION_PANTALLAS || ',conductores,configuracion,incorporaciones,ordenes,vehiculos').split(',')

test.describe('revisión visual', () => {
  test.skip(!DIR, 'solo a mano, con REVISION_DIR')
  for (const ruta of PANTALLAS) {
    test(`foto de /panel/${ruta}`, async ({ page }) => {
      await entrarComoAdmin(page)
      await simularApi(page, 'lleno')
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(`/panel/${ruta}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1800)
      await page.screenshot({ path: path.join(DIR, `panel-${ruta || 'portada'}.png`), fullPage: true })
    })
  }
})
