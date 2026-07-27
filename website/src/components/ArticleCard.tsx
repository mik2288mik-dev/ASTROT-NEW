import Link from 'next/link';

export function ArticleCard({ href, title, description, meta }: { href: string; title: string; description: string; meta?: string }) {
  return (
    <article className="article-card">
      {meta ? <p className="eyebrow">{meta}</p> : null}
      <h3><Link href={href}>{title}</Link></h3>
      <p>{description}</p>
      <Link className="text-link" href={href}>→</Link>
    </article>
  );
}
