# Valor

Buscador privado de apuestas con ventaja. No adivina resultados: busca dónde
una casa **paga más de lo que vale** un resultado y te dice cuánto meter.

## Qué te dice

Una apuesta, en una casa: «Métele 120 € a que gana el Sevilla en Bet365. Está
a 1,80 y debería estar a 1,65. Sale 6 de cada 10 veces».

- La cuota JUSTA sale de las casas afiladas (Pinnacle, exchanges) sin su margen.
- Solo cuotas de **1,70 o más** (`VALOR_CUOTA_MINIMA`), o de 1,50-1,69 si la ventaja
  es de un 5 % o más (`VALOR_CUOTA_MINIMA_VALOR`, `VALOR_EV_CUOTA_BAJA`), que se acierten al menos el 60 %
  de las veces (`VALOR_PROB_MINIMA`): juntas dejan solo apuestas con ≥ 2 % de ventaja.
- **Freno**: si hoy llevas perdido el 6 % de la banca (`VALOR_FRENO_DIA`), deja de
  recomendar importes hasta mañana.
- Si la referencia se ha movido y la casa no, lo dice: es el origen más común
  de una ventaja grande y real («Pinnacle la ha bajado de 1,90 a 1,62 en 25 min»).
- **En vivo**: lo mismo, con filtros más duros (cuotas de segundos).
- Las **seguras** (repartir entre casas para ganar pase lo que pase) existen
  pero van apagadas (`VALOR_SEGURAS=1` para verlas).

Cada apuesta sigue pudiendo perderse (4 de cada 10 a cuota 1,65): lo que gana
es la suma, a la larga.

## Cuánto meter

Kelly × ¼ con tope del 2 % de la banca por apuesta: es lo que evita arruinarse
en una mala racha. Para que salgan apuestas de ~100 € hace falta una banca de
unos 5.000-6.000 € (`VALOR_BANCA`).

Lo que **no** hace: prometer que una apuesta concreta se gana. Nadie puede.

## Puntos flacos de las casas (`valor/puntos_flacos.py`)

Cada aviso dice POR QUÉ la casa paga de más:
- **Casa lenta**: la referencia ha movido la cuota (entra dinero) y la casa no la ha tocado.
- **Casa desalineada**: paga claramente más que todas las demás casas a la vez.
- **Incoherencia interna**: la casa se contradice (p. ej. «más de 2,5» más probable que «más de 1,5»).

El aprendizaje mide cada punto flaco por separado.

## Registro y aprendizaje

- **Mis apuestas**: «La he metido» en cada aviso, o apuntar a mano cualquier
  apuesta («100 € a Sevilla gana, Bet365, 1,85»). Luego se marca ganada,
  perdida o nula y sale el beneficio real.
- **Aprendizaje** (`valor/aprendizaje.py`): cada aviso, se apueste o no, se
  compara con la cuota justa al empezar el partido (CLV). Por segmento (casa,
  tipo de apuesta, rango de cuota, vivo/prepartido) y con 30 avisos o más: lo
  que no bate el cierre con claridad se APAGA solo; lo que sí, se marca DE
  CONFIANZA en el aviso. No aprende de ganar o perder partidos sueltos (ruido).

## Cómo se sabe si funciona

El beneficio de pocas apuestas es casi todo suerte. La señal buena es el
**CLV**: si tu cuota fue mejor que la justa al empezar el partido. Si tras
100-200 apuestas el CLV medio es positivo, el método funciona.

## Arrancar

```
pip install -r requirements.txt
python -m pytest -q                      # las pruebas
python -m valor.demo valor-demo.db       # datos INVENTADOS para ver la pantalla
VALOR_DB=valor-demo.db VALOR_USUARIO=dani VALOR_CLAVE=... uvicorn valor.web:app --port 8100
```

Con datos reales: `VALOR_ESCANEAR=1` y al menos una clave de fuente.

## Variables de entorno

| Variable | Qué |
|---|---|
| `VALOR_CLAVE`, `VALOR_USUARIO` | acceso a la web (sin clave no arranca) |
| `VALOR_BANCA` | tu banca en euros (de ella salen los importes; 1000 por defecto) |
| `VALOR_PROB_MINIMA` | probabilidad mínima de acertar (0.60) |
| `VALOR_CUOTA_MINIMA` | cuota mínima (1.70) |
| `VALOR_FRENO_DIA` | pérdida del día, en parte de la banca, a partir de la cual para (0.06) |
| `VALOR_SEGURAS`, `VALOR_SEGURA_TOTAL` | activar las seguras (apagadas) y cuánto repartir (100) |
| `VALOR_NO_APOSTAR` | casas que solo sirven de referencia (`pinnacle`) |
| `ODDS_API_KEY` | The Odds API (500 créditos/mes gratis) |
| `APISPORTS_KEY` | API-Football (100 llamadas/día gratis) |
| `VALOR_LIGAS`, `VALOR_MERCADOS`, `VALOR_REGIONES` | qué pedir a The Odds API |
| `TELEGRAM_TOKEN`, `TELEGRAM_CHAT` | avisos al móvil (opcional) |

## Estructura

- `valor/nucleo/`: el cálculo, sin red. Quitar margen (`margen.py`), valor
  (`detector.py`), seguras (`seguras.py`), cuánto meter (`stake.py`).
- `valor/fuentes/`: una por API de cuotas, todas al mismo formato. `nombres.py`
  cruza el mismo partido entre fuentes.
- `valor/registro.py`: SQLite con histórico de cuotas, avisos, apuestas y CLV.
- `valor/aprendizaje.py`: apaga o marca de confianza cada segmento según su CLV.
- `valor/escaner.py`: el bucle, con presupuesto por fuente para no fundir los cupos gratis.
- `valor/web.py` + `pantalla.html`: la web privada.

## Pendiente

- Conectar y **verificar contra la API real** The Odds API y API-Football.
  Están escritos según su documentación; en la máquina donde se hicieron la
  red estaba bloqueada.
- Fuentes nuevas: OddsPapi (350+ casas con Pinnacle y Betfair, gratis 250/mes),
  pinnapi (Pinnacle en vivo, gratis 100/día) y la de pago (OpticOdds / OddsJam)
  para el vivo de verdad.
- Liquidar solas las apuestas con los resultados de la API.
