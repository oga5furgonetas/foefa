# Métricas del plan 1000 usuarios

Scripts de solo lectura contra la base de producción (Mongo Atlas). Necesitan `MONGO_URL` en el entorno,
que se saca de Fly SIN imprimirla:

```bash
cd backend
export FLY_API_TOKEN=$(cat ~/.flotia-fly-token.txt)
export MONGO_URL="$(fly ssh console -a flota-backend -C 'printenv MONGO_URL' 2>/dev/null | tr -d '\r')"
PYTHONIOENCODING=utf-8 py -3 ../tools/metricas/usuarios_total.py
```

| Script | Qué dice |
|---|---|
| `usuarios_total.py` | Cuántas cuentas reales hay (sin demos, pruebas ni la propia) por sector. **La cifra del objetivo.** |
| `origen_altas.py [días]` | De dónde sale cada alta (anuncio, grupo, invitación, app de Play…) y visitas por canal. |
| `tras_alta.py` | Qué hace cada alta de las últimas 30 h después de registrarse, paso a paso. |
| `embudo_canal.py` | Embudo de /repartidores por canal (7 días): 10 s, mitad, formulario, alta. |

Ojo: TikTok precarga la portada (sus «visitas» casi nunca son personas) y el robot de Google Play abre la app
sin rellenar nada. No contarlos como usuarios.
