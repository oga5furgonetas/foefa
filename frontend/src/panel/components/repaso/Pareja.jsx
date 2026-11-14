import CompareSlider from '../CompareSlider'
import SelloFoto from '../../../components/SelloFoto'
import Foto from './Foto'

/* EL CENTRO DEL REPASO: la foto anterior del mismo lado y la de hoy (14-11-2026). Una junto a otra (debajo una de otra
   en el móvil), enteras y del mismo tamaño, para que el ojo vaya de una a otra sin buscar; o, con el conmutador, una
   encima de otra con el deslizador de siempre (CompareSlider). Sin foto anterior, solo la de hoy. */
export default function Pareja({ t, lado, hoy, antes, modo, dibujar, caja, onCaja, onAmpliar }) {
  const comunes = {
    textoAbrir: t('repaso.ampliar'), textoFallo: t('repaso.foto.fallo'), onAbrir: onAmpliar,
  }
  const fotoHoy = (
    <Foto key={`h-${lado.photo_index}-${lado.foto_url}`} testId="foto-hoy" url={lado.foto_url} rotulo={t('repaso.hoy')} oscuro
      fecha={hoy.fecha} quien={hoy.quien} caja={caja} dibujar={dibujar} onCaja={onCaja}
      textoDibuja={t('repaso.golpe.dibuja')} alt={t('repaso.hoy')} {...comunes} />
  )
  if (!antes) {
    return <div className="mx-auto w-full max-w-[720px]">{fotoHoy}</div>
  }
  if (modo === 'deslizador' && !dibujar) {
    return (
      <div className="relative mx-auto w-full max-w-[860px] overflow-hidden rounded-xl bg-dark-800" data-testid="deslizador">
        <CompareSlider beforeUrl={antes.url} afterUrl={lado.foto_url} />
        <SelloFoto fecha={hoy.fecha} quien={hoy.quien} />
        <SelloFoto fecha={antes.fecha} quien={antes.quien} className="!left-auto right-2.5" />
      </div>
    )
  }
  return (
    <div className="grid gap-2 md:grid-cols-2 md:gap-1.5">
      <Foto key={`a-${lado.photo_index}-${antes.url}`} testId="foto-antes" url={antes.url} rotulo={t('repaso.antes')}
        fecha={antes.fecha} quien={antes.quien} alt={t('repaso.antes')} {...comunes} />
      {fotoHoy}
    </div>
  )
}
