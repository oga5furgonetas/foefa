import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { tx, useIdioma } from '../lib/idioma'
import { MARCA } from '../marca'
import DocumentoExpediente from '../panel/components/expediente/DocumentoExpediente'
import { EXPEDIENTE_EJEMPLO, EMPRESA_EJEMPLO } from '../lib/expedienteEjemplo'

/* EL EXPEDIENTE DE EJEMPLO (/expediente-ejemplo, 14-11-2026): el MISMO documento que saca el panel de cada
   furgoneta, con datos inventados (lib/expedienteEjemplo.js), para que quien llega desde la portada vea lo que se
   lleva antes de darse de alta. Arriba, una franja que dice que es un ejemplo y la única acción: probarlo con sus
   furgonetas (la misma alta que /empresas). La franja no se imprime; la hoja sí, igual que en el panel. */

const ALTA = '/registro?sector=otra&plan=completo'

export default function ExpedienteEjemplo() {
  useIdioma()   // los textos de la franja llegan un instante después en otro idioma: se repinta al tenerlos
  useEffect(() => {
    const antes = document.title
    document.title = `${tx('Ejemplo con datos inventados')} · ${MARCA.nombre}`
    return () => { document.title = antes }
  }, [])
  return (
    <div className="exp-publico">
      <div className="exp-franja exp-no-imprimir" data-testid="franja-ejemplo">
        <div>
          <Link to="/" className="exp-franja-marca">
            <img src="/favicon.svg" alt="" width="24" height="24" />
            {MARCA.nombre}
          </Link>
          <b className="mt-3">{tx('Ejemplo con datos inventados')}</b>
          <p>{tx('Así sale el expediente de cada furgoneta: el documento que pones encima de la mesa cuando la devuelves al renting o te pasan un cargo.')}</p>
        </div>
        <Link to={ALTA} className="exp-boton exp-boton-firma">{tx('Probar con mis furgonetas')}</Link>
      </div>
      <DocumentoExpediente datos={EXPEDIENTE_EJEMPLO} empresa={EMPRESA_EJEMPLO} />
    </div>
  )
}
