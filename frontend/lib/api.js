const API = process.env.API_URL || 'http://localhost:3001';
export async function get(path) {
  const r = await fetch(API + path, { cache: 'no-store' });
  return r.ok ? r.json() : null;
}
export const inr = n => '₹' + n.toLocaleString('en-IN');
