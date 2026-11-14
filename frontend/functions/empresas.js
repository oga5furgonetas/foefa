/* /empresas (14-11-2026): la misma portada que «/» (src/pages/Empresas.jsx), con las mismas etiquetas y la canónica en
 * «/», para que Google no la cuente como una página aparte. Los enlaces que ya se mandaron por correo a /empresas
 * siguen funcionando. Todo sale de functions/index.js. */
import { servirPortada } from './index.js'

export const onRequestGet = servirPortada
