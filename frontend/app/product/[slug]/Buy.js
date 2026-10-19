'use client';
import { useState } from 'react';
import AddButton from '../../../components/AddButton';
import { useCart } from '../../../components/CartProvider';
import { useRouter } from 'next/navigation';
export default function Buy({ p }) {
  const [sel, setSel] = useState(Object.fromEntries(Object.entries(p.options).map(([k, v]) => [k, v[0]])));
  const [pin, setPin] = useState(''), [res, setRes] = useState(null), { add } = useCart(), router = useRouter();
  const variant = Object.values(sel).join(' · ');
  const check = async () => { const r = await fetch('/api/pincode/' + pin); setRes(await r.json()); };
  return (<>
    {Object.entries(p.options).map(([k, vals]) => <div key={k}><div className="lbl">{k}</div>
      <div className="chips">{vals.map(v => <button key={v} className={`chip ${sel[k] === v ? 'on' : ''}`} onClick={() => setSel({ ...sel, [k]: v })}>{v}</button>)}</div></div>)}
    <div className="lbl">Delivery</div>
    <div className="pin"><input value={pin} maxLength={6} inputMode="numeric" placeholder="Enter pincode" onChange={e => setPin(e.target.value.replace(/\D/g, ''))} /><button className="btn ghost" onClick={check}>Check</button></div>
    {res && (res.ok ? <div className="ok">✓ Delivery by {res.eta} · COD available</div> : <div className="bad">{res.message}</div>)}
    <div className="pdp-actions">
      <AddButton product={p} variant={variant} className="btn ghost" /><button className="btn alt" onClick={() => { add(p, variant); router.push('/checkout'); }}>Buy now</button>
    </div>
    <div className="sticky"><AddButton product={p} variant={variant} /></div>
  </>);
}
