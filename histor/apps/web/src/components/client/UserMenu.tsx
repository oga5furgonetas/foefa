'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type Me = { user: { name: string | null; email: string; role: string } | null; premium: boolean };

export function UserMenu({ labels, loginHref, accountHref, subscribeHref }: { lang: string; labels: { login: string; account: string; subscribe: string }; loginHref: string; accountHref: string; subscribeHref: string }) {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    fetch('/api/v1/me', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setMe({ user: null, premium: false }));
  }, []);
  return (
    <>
      {me?.user && (me.user.role === 'admin' || me.user.role === 'editor') && (
        <Link className="btn btn-small" href="/admin">
          Panel
        </Link>
      )}
      {me?.user ? (
        <Link className="btn btn-small" href={accountHref}>
          {labels.account}
        </Link>
      ) : (
        <Link className="btn btn-small" href={loginHref}>
          {labels.login}
        </Link>
      )}
      {!me?.premium && (
        <Link className="btn btn-small btn-solid" href={subscribeHref}>
          {labels.subscribe}
        </Link>
      )}
    </>
  );
}
