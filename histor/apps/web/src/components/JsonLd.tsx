import { jsonLdString } from '@histor/core/seo/index';

export function JsonLd({ data }: { data: unknown }) {
  // jsonLdString escapa <, > y & para que el contenido no pueda cerrar la etiqueta.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}
