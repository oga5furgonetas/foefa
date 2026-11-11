import { useOutletContext } from 'react-router-dom'

/* ELEGIR EL CENTRO AHI MISMO (11-11-2026, revision de la flota propia, portal_inicio-9).

   Una docena de pantallas, con «Todos» elegido arriba, se quedaban en un parrafo: «Elige un centro arriba…». En el
   movil eso es subir hasta la cabecera, acertar con la pastilla y volver a bajar; y quien llega nuevo a la oficina no
   sabe que es «arriba». Esta pieza pinta, donde ya se esta mirando, un boton grande por cada centro que esa persona
   puede ver.

   · `texto`: la frase de esa pantalla (lo que antes decia el parrafo), ya traducida por quien la usa.
   · Los centros y el cambio salen del contexto del panel (el Outlet de PanelLayout). Donde no hay Outlet (la burbuja
     del asistente) se le pasan a mano con `centers` y `setCenter`.
   · Sin centros que ofrecer (o sin forma de cambiar) se queda en el texto, como antes: nunca un bloque vacio. */
export default function ElegirNave({ texto, centers: cs, setCenter: fijar, className = '' }) {
  const ctx = useOutletContext() || {}
  const centers = (cs || ctx.centers || []).filter((c) => c && c !== 'Todos')
  const setCenter = fijar || ctx.setCenter
  return (
    <div className={`card p-5 text-center ${className}`} data-testid="elegir-centro">
      {texto ? <p className="text-dark-200">{texto}</p> : null}
      {setCenter && centers.length > 0 ? (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {centers.map((c) => (
            <button key={c} type="button" onClick={() => setCenter(c)}
              className="btn-secondary min-h-[44px] min-w-[96px] justify-center px-5 text-base font-semibold">
              {c}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
