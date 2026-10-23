import Link from 'next/link';
import { GOD_FRAME_SUBJECTS } from '../lib/catalog';
import { shopSubjectHref } from '../lib/shop-categories';

export default function DeityDirectory() {
  return (<section className="shop-deity-directory" aria-labelledby="deity-directory-heading">
    <span className="eyebrow">Devotional collection</span>
    <h2 id="deity-directory-heading">Browse by deity</h2>
    <p>Choose a deity to open its own dedicated catalogue page.</p>
    <nav aria-label="Browse devotional designs by deity">
      {GOD_FRAME_SUBJECTS.map(subject => <Link key={subject} href={shopSubjectHref('god-frames', subject)}>{subject}<span aria-hidden="true">→</span></Link>)}
    </nav>
  </section>);
}
