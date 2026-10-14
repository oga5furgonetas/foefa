import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

test('Empleo · archivar una columna conserva el candidato y permite restaurarlo', async ({ page }) => {
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  const oferta = {
    id: 'oferta-1', titulo: 'Repartidor/a de prueba', centro: 'NORTE', ciudad: 'Santiago',
    jornada: 'Jornada completa', activa: true, candidatos: 1, por_fase: { nuevo: 1 },
    por_origen: {}, slug: 'repartidor-prueba', url: 'https://example.test/oferta',
  }
  let archivado = false
  const candidato = () => ({
    id: 'cand-1', oferta_id: 'oferta-1', nombre: 'Sergio Pérez', ciudad: 'Santiago',
    origen: 'directo', fase: 'nuevo', creado_en: '2026-10-13T08:00:00Z',
    historial: [], respuestas: {}, respuestas_join: [], etts: [], archivado,
  })

  await page.route('**/api/empleo/ofertas**', (route) => route.fulfill({ json: { ofertas: [oferta] } }))
  await page.route('**/api/empleo/candidatos**', async (route) => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    if (url.pathname.endsWith('/archivar-fase')) {
      archivado = true
      return route.fulfill({ json: { archivados: 1 } })
    }
    if (method === 'PATCH') {
      const datos = route.request().postDataJSON()
      archivado = datos.archivado
      return route.fulfill({ json: candidato() })
    }
    return route.fulfill({ json: { candidatos: [candidato()], fases: ['nuevo', 'llamado', 'ett', 'otra_estacion', 'contratado', 'descartado'] } })
  })

  page.on('dialog', (dialog) => dialog.accept())
  await page.goto('/panel/empleo', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Repartidor\/a de prueba/ }).click()
  await expect(page.getByRole('button', { name: /Sergio Pérez/ })).toBeVisible()
  await page.getByRole('button', { name: 'Limpiar columna Por contactar' }).click()
  await expect(page.getByRole('button', { name: /Sergio Pérez/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Ocultos (1)' }).click()
  await page.getByRole('button', { name: /Sergio Pérez/ }).click()
  await page.getByRole('button', { name: 'Restaurar al tablero' }).click()
  await expect(page.getByRole('button', { name: /Sergio Pérez/ })).toBeVisible()
})
