import Link from 'next/link';

export default function NotFound() {
  return <section className="section"><div className="shell content-panel"><h1>404</h1><p>This page does not exist.</p><Link className="button" href="/">Home</Link></div></section>;
}
