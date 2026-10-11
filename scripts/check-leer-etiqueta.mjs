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

if (fallos.length) {
  console.error(`\n[check-leer-etiqueta] ${fallos.length} problema(s):`)
  for (const f of fallos) console.error('  - ' + f)
  process.exit(1)
}
console.log(`[check-leer-etiqueta] ok — ${CASOS.length} etiquetas de ${new Set(CASOS.map((c) => c[0])).size} países`)
