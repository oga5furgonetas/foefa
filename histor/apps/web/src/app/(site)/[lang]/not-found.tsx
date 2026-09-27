import Link from 'next/link';
import { headers } from 'next/headers';
import { isActiveLanguage } from '@histor/core/config/languages';
import { dict } from '@histor/core/i18n/dictionaries';
import { href } from '@histor/core/i18n/routes';

export default async function NotFound() {
  const p = (await headers()).get('x-pathname') ?? '';
  const seg = p.split('/')[1];
  const lang = isActiveLanguage(seg) ? seg : 'en';
  const d = dict(lang);
  return (
    <section className="page" style={{ textAlign: 'center' }}>
      <p className="kicker">404</p>
      <h1>{d.notFound.title}</h1>
      <p>{d.notFound.text}</p>
      <form role="search" action={href.search(lang)} method="get" className="form" style={{ margin: '20px auto', gridTemplateColumns: 'minmax(0,1fr) auto' }}>
        <input type="search" name="q" placeholder={d.search.placeholder} aria-label={d.search.title} />
        <button className="btn btn-solid">{d.search.submit}</button>
      </form>
      <Link className="btn" href={href.home(lang)}>
        {d.notFound.back}
      </Link>
    </section>
  );
}
