import CompareSlider from '../CompareSlider'
import SelloFoto from '../../../components/SelloFoto'
import Foto from './Foto'

/* EL CENTRO DEL REPASO: la foto anterior del mismo lado y la de hoy (14-11-2026). Una junto a otra (debajo una de otra
   en el móvil), enteras y llenando el ancho de la mesa, para que el ojo vaya de una a otra sin buscar; o, con el
   conmutador, una encima de otra con el deslizador (CompareSlider). En los dos modos la anterior va a la izquierda y la
   de hoy a la derecha, y la caja de un golpe ya marcado se ve sobre la de hoy. Sin foto anterior, solo la de hoy. */
const chapa = 'pointer-events-none absolute top-2.5 rounded px-2 py-1 text-[13px] font-bold leading-none'

export default function Pareja({ t, idioma, lado, hoy, antes, modo, dibujar, caja, onCaja, onAmpliar, onFallo }) {
  const comunes = {
    textoAbrir: t('repaso.ampliar'), textoFallo: t('repaso.foto.fallo'), onAbrir: onAmpliar, idioma,
  }
  const fotoHoy = (
    <Foto key={`h-${lado.photo_index}-${lado.foto_url}`} testId="foto-hoy" url={lado.foto_url} rotulo={t('repaso.hoy')} oscuro
      fecha={hoy.fecha} quien={hoy.quien} caja={caja} dibujar={dibujar} onCaja={onCaja} onFallo={onFallo}
      alt={t('repaso.alt.hoy')} {...comunes} />
  )
  if (!antes) {
    return <div className="mx-auto w-full max-w-[760px]">{fotoHoy}</div>
  }
  if (modo === 'deslizador' && !dibujar) {
    return (
      <div className="relative mx-auto w-full max-w-[860px] overflow-hidden rounded-xl bg-dark-800" data-testid="deslizador">
        <CompareSlider antesIzquierda rotulos={false} beforeUrl={antes.url} afterUrl={lado.foto_url} caja={caja}
          altAntes={t('repaso.alt.antes')} altAhora={t('repaso.alt.hoy')} />
        <span className={`${chapa} left-2.5 bg-white text-[#10181a]`}>{t('repaso.antes')}</span>
        <span className={`${chapa} right-2.5 bg-[#10181a] text-white`}>{t('repaso.hoy')}</span>
        <SelloFoto fecha={antes.fecha} quien={antes.quien} idioma={idioma} className="!max-w-[calc(50%-1rem)] !whitespace-normal" />
        <SelloFoto fecha={hoy.fecha} quien={hoy.quien} idioma={idioma} className="!left-auto right-2.5 !max-w-[calc(50%-1rem)] !whitespace-normal" />
      </div>
    )
  }
  return (
    <div className="grid items-start gap-2 md:grid-cols-2 md:gap-1.5">
      <Foto key={`a-${lado.photo_index}-${antes.url}`} testId="foto-antes" url={antes.url} rotulo={t('repaso.antes')}
        fecha={antes.fecha} quien={antes.quien} alt={t('repaso.alt.antes')} {...comunes} />
      {fotoHoy}
    </div>
  )
}
