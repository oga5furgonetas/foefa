#!/usr/bin/env node
/* LEER UNA ETIQUETA EN CADA PAÍS (11-10-2026).
   ══════════════════════════════════════════════════════════════════════════
   El texto que saca el OCR de la foto de una etiqueta se convierte en parada (teléfono, dirección, CP,
   localidad, cliente, código) con `interpretaTicket` de frontend/src/lib/interpretaEtiqueta.js. Hasta
   el 11-10 las reglas eran solo de España, y desde el giro a Latinoamérica la mayoría de altas son de
   allí. Aquí se ejecuta la función REAL con etiquetas escritas como las de cada país (y las de España,
   para que no empeore nada) y se comprueba campo a campo.

   Probado reintroduciendo los fallos: con las reglas de España para todos fallan México, Brasil,
   Colombia, Argentina, Portugal y EE. UU.; quitando el «sin cruzar líneas» del teléfono, el caso de
   España con el CP justo encima del teléfono.
*/
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const { interpretaTicket, telefonoDe } = await import(pathToFileURL(resolve('frontend/src/lib/interpretaEtiqueta.js')).href)
const { datosDeCodigos, geoGS1 } = await import(pathToFileURL(resolve('frontend/src/lib/codigoEtiqueta.js')).href)
const { paradasDeHoja, textoParaPegar, csvAPegar } = await import(pathToFileURL(resolve('frontend/src/lib/hojaReparto.js')).href)

const CASOS = [
  ['es', `SEUR
Destinatario: María López García
C/ Mayor 12
3º B
15001 A Coruña
Tel: 612 345 678
Pedido: AB123456`, { telefono: '612345678', direccion: 'C/ Mayor 12, 3º B', cp: '15001', localidad: 'A Coruña', cliente: 'María López García', codigo: 'AB123456' }],
  ['es', `Cliente: Pepe Pérez
Rúa do Vilar 5
15705 Santiago
+34 981 55 44 33`, { telefono: '981554433', direccion: 'Rúa do Vilar 5', cp: '15705', localidad: 'Santiago' }],
  ['es', `Entregar al vecino si no está
Avda. de Galicia 40
36202 Vigo
699112233`, { direccion: 'Avda. de Galicia 40', cp: '36202', localidad: 'Vigo', telefono: '699112233' }],
  ['mx', `Destinatario: Juan Pérez
Calle Hidalgo 245 Int. 3
Col. Centro
C.P. 64000 Monterrey, N.L.
Tel. 81 1234 5678
Guía: 1Z999AA10123456784`, { telefono: '8112345678', direccion: 'Calle Hidalgo 245 Int. 3, Col. Centro', cp: '64000', localidad: 'Monterrey, N.L.', cliente: 'Juan Pérez' }],
  ['mx', `DESTINATARIO JOSEFINA RUIZ
AV. INSURGENTES SUR 1602
COL. CREDITO CONSTRUCTOR
03940 CIUDAD DE MEXICO
+52 1 55 9876 5432`, { telefono: '5598765432', direccion: 'AV. INSURGENTES SUR 1602, COL. CREDITO CONSTRUCTOR', cp: '03940', localidad: 'CIUDAD DE MEXICO' }],
  ['br', `DESTINATÁRIO: João da Silva
Rua das Flores, 123 - Apto 45
Bairro Jardim América
01310-100 São Paulo - SP
Tel: (11) 98765-4321`, { telefono: '11987654321', direccion: 'Rua das Flores, 123 - Apto 45, Bairro Jardim América', cp: '01310-100', localidad: 'São Paulo - SP', cliente: 'João da Silva' }],
  ['br', `Nome: Ana Souza
Av. Brasil 2000 Bloco B
CEP 20040-002 Rio de Janeiro/RJ
+55 21 3456-7890`, { telefono: '2134567890', direccion: 'Av. Brasil 2000 Bloco B', cp: '20040-002', cliente: 'Ana Souza' }],
  ['co', `Destinatario: Ana Gómez
Carrera 7 # 32-16 Apto 501
Bogotá D.C.
Cel: 310 555 1234`, { telefono: '3105551234', direccion: 'Carrera 7 # 32-16 Apto 501', cliente: 'Ana Gómez' }],
  ['ar', `Destinatario: Lucas Fernández
Av. Corrientes 1234 Piso 5 Dto B
C1043AAZ CABA
Tel: 11 15 2345 6789`, { telefono: '1123456789', direccion: 'Av. Corrientes 1234 Piso 5 Dto B', cp: 'C1043AAZ', localidad: 'CABA' }],
  ['pe', `Cliente: Rosa Quispe
Jr. de la Unión 456
Lima 15001
987 654 321`, { telefono: '987654321', direccion: 'Jr. de la Unión 456', cp: '15001' }],
  ['pt', `Destinatário: Rui Costa
Rua Augusta 100, 2º Esq
1100-053 Lisboa
Telemóvel: 912 345 678`, { telefono: '912345678', direccion: 'Rua Augusta 100, 2º Esq', cp: '1100-053', localidad: 'Lisboa', cliente: 'Rui Costa' }],
  ['us', `SHIP TO: John Smith
123 Main St. Apt 4
Springfield, IL 62701
Phone: (217) 555-0123`, { telefono: '2175550123', direccion: '123 Main St. Apt 4', cp: '62701', localidad: 'Springfield, IL', cliente: 'John Smith' }],
  ['es', `Astelerios Triñanes Domínguez
IN : Ladeira, Chazo 33 AZ 00
Abanqueiro, Boiro
Boiro A Coruña
15938 Boiro A Coruña
ES263683 0253
CYCLE 1
0.10 kgs
636830253`, { direccion: 'Ladeira, Chazo 33', cp: '15938', localidad: 'Boiro A Coruña', telefono: '' }],
]

const fallos = []
for (const [pais, texto, esperado] of CASOS) {
  const r = interpretaTicket(texto, pais)
  for (const [k, v] of Object.entries(esperado)) {
    if (r[k] !== v) fallos.push(`${pais} · ${k}: esperaba «${v}» y salió «${r[k]}»   (${texto.split('\n')[1]})`)
  }
}

// Un número de seguimiento no es un teléfono, y el teléfono no se arma juntando cifras de dos líneas.
if (telefonoDe('Guía: 1Z999AA10123456784', 'mx') !== '') fallos.push('mx: un número de seguimiento salió como teléfono')
if (telefonoDe('15001\n612 345', 'es') !== '') fallos.push('es: el teléfono juntó el CP de una línea con cifras de la siguiente')
// Sin país conocido, se busca un teléfono de 9 a 11 cifras.
if (telefonoDe('Tel 0612 345 6789', 'xx') !== '06123456789') fallos.push('país desconocido: el teléfono de 11 cifras tenía que salir')

/* LOS CÓDIGOS DE LA ETIQUETA (13-10-2026), con datosDeCodigos de frontend/src/lib/codigoEtiqueta.js.
   Los textos son EXACTAMENTE lo que devuelve el lector de la app (zxing-wasm 3.1.3, textMode «Plain»):
   se generaron los códigos con su escritor y se leyeron con su lector. Las coordenadas 4309 son las de
   la Gran Vía de Madrid pasadas por la fórmula del conversor de GS1 (github.com/gs1/geocode). */
const GS = '\x1d'
const CODIGOS = [
  ['GS1 DataMatrix (Scan4Transport)', 'es',
    [`0038412345000000001742028013${GS}4301Maria Lopez${GS}4302Gran Via 32 3B${GS}4305Madrid${GS}4308+34612345678${GS}430913042030003562950000`],
    { codigo: '384123450000000017', cliente: 'Maria Lopez', telefono: '612345678', direccion: 'Gran Via 32 3B', cp: '28013', localidad: 'Madrid', lat: 40.4203, lng: -3.705, completa: true }],
  ['GS1 legible con paréntesis', 'es',
    ['(00)384123450000000017(420)15001(4302)Rúa Real 5(4305)A Coruña'],
    { codigo: '384123450000000017', direccion: 'Rúa Real 5', cp: '15001', localidad: 'A Coruña' }],
  // GLS pone la dirección en su SEGUNDO código 2D: antes solo se leía el primero (la barra).
  ['barra + 2D con los datos separados', 'es',
    ['ZX81234567', 'ES|28013|MADRID|MARIA LOPEZ|GRAN VIA 32|612345678'],
    { codigo: 'ZX81234567', cliente: 'MARIA LOPEZ', telefono: '612345678', direccion: 'GRAN VIA 32', cp: '28013', localidad: 'MADRID', completa: true }],
  ['ANSI MH10.8.3 (UPS/FedEx)', 'us',
    [`[)>\x1e01${GS}96841706672${GS}840${GS}001${GS}1Z12345675${GS}UPSN${GS}12345E${GS}089${GS}${GS}1/1${GS}10.1${GS}Y${GS}634 MAIN ST${GS}YORK${GS}PA\x1e\x04`],
    { direccion: '634 MAIN ST', cp: '84170', localidad: 'YORK, PA' }],
  ['solo la barra: sin dirección, que la complete la foto', 'es', ['ZX81234567'],
    { codigo: 'ZX81234567', direccion: '', completa: false }],
  ['un EAN de producto no se toma por GS1', 'es', ['8412345678905'], { codigo: '8412345678905', direccion: '' }],
]
for (const [nombre, pais, valores, esperado] of CODIGOS) {
  const r = datosDeCodigos(valores, pais)
  for (const [k, v] of Object.entries(esperado)) {
    if (r[k] !== v) fallos.push(`códigos · ${nombre} · ${k}: esperaba «${v}» y salió «${r[k]}»`)
  }
}
// 4309 al oeste de Greenwich: longitud negativa (la norma la guarda sumándole 360).
const g = geoGS1('13042030003562950000')
if (!g || g.lat !== 40.4203 || g.lng !== -3.705) fallos.push(`códigos · 4309: esperaba 40.4203,-3.705 y salió ${JSON.stringify(g)}`)

/* LA HOJA DE REPARTO (13-10-2026): qué líneas del texto leído son paradas (hojaReparto.js). */
const HOJA_ES = `HOJA DE REPARTO  13/10/2026   Ruta 4
N° Código Destinatario Dirección CP Población Teléfono
1 ZX812345 María López C/ Mayor 12 3ºB 15001 A Coruña 612 345 678
2 ZX812346 Bar Pepe Rúa Real 5 15003 A Coruña 981 22 33 44
3 ZX812347 Ana Ruiz Avda. de Finisterre 100 15004 A Coruña
Total bultos: 3
Firma del conductor:`
const hoja = paradasDeHoja(HOJA_ES, 'es')
const esperadaHoja = [
  { codigo: 'ZX812345', cliente: 'María López', direccion: 'C/ Mayor 12 3ºB 15001 A Coruña', telefono: '612345678' },
  { codigo: 'ZX812346', cliente: 'Bar Pepe', direccion: 'Rúa Real 5 15003 A Coruña', telefono: '981223344' },
  { codigo: 'ZX812347', cliente: 'Ana Ruiz', direccion: 'Avda. de Finisterre 100 15004 A Coruña', telefono: '' },
]
if (JSON.stringify(hoja) !== JSON.stringify(esperadaHoja)) fallos.push(`hoja · España: salió ${JSON.stringify(hoja)}`)
// El nombre en la línea de arriba y el CP con la población en la de abajo (México).
const hojaMx = paradasDeHoja(`Juan Pérez\nCalle Hidalgo 245 Int. 3\n64000 Monterrey\n81 1234 5678\nJosefina Ruiz\nAv. Insurgentes Sur 1602\n03940 Ciudad de Mexico`, 'mx')
const esperadaMx = [
  { codigo: '', cliente: 'Juan Pérez', direccion: 'Calle Hidalgo 245 Int. 3, 64000 Monterrey', telefono: '8112345678' },
  { codigo: '', cliente: 'Josefina Ruiz', direccion: 'Av. Insurgentes Sur 1602, 03940 Ciudad de Mexico', telefono: '' },
]
if (JSON.stringify(hojaMx) !== JSON.stringify(esperadaMx)) fallos.push(`hoja · México: salió ${JSON.stringify(hojaMx)}`)
if (!textoParaPegar(hoja).startsWith('codigo; cliente; direccion; telefono\nZX812345; María López;')) fallos.push('hoja: el texto para pegar no lleva la cabecera')
// Un CSV con comas y comillas pasa a «;» sin romper «López, María».
const csv = csvAPegar('codigo,cliente,direccion\nZX1,"López, María","Calle Mayor 12, 15001 A Coruña"\n')
if (csv !== 'codigo; cliente; direccion\nZX1; López, María; Calle Mayor 12, 15001 A Coruña') fallos.push(`csv: salió ${JSON.stringify(csv)}`)

if (fallos.length) {
  console.error(`\n[check-leer-etiqueta] ${fallos.length} problema(s):`)
  for (const f of fallos) console.error('  - ' + f)
  process.exit(1)
}
console.log(`[check-leer-etiqueta] ok — ${CASOS.length} etiquetas de ${new Set(CASOS.map((c) => c[0])).size} países y ${CODIGOS.length} etiquetas por sus códigos`)
