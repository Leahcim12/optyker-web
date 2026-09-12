const encoder = new TextEncoder();
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const ORIGINS = new Set(['https://optyker.it', 'https://www.optyker.it', 'https://optyker-web.vercel.app', 'https://leahcim12.github.io']);
function decode(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid token');
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}
// Interoperates with the existing billing-admin HMAC session; no new login/password copy.
export async function verifyAdmin(authorization, key, now = Date.now() / 1000) {
  try {
    if (!key || typeof authorization !== 'string' || authorization.length > 2048 || !authorization.startsWith('Bearer ')) return null;
    const parts = authorization.slice(7).split('.');
    if (parts.length !== 2) return null;
    const signing = await crypto.subtle.importKey('raw', encoder.encode(key), {name:'HMAC', hash:'SHA-256'}, false, ['verify']);
    if (!await crypto.subtle.verify('HMAC', signing, decode(parts[1]), encoder.encode(parts[0]))) return null;
    const p = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    if (p.scope !== 'billing_admin' || String(p.sub || '').trim().replace(/\s+/g, ' ').toUpperCase() !== 'OTTICA VISUAL CARE') return null;
    if (!Number.isInteger(p.iat) || !Number.isInteger(p.exp) || p.exp <= now || p.iat > now + 30 || p.exp - p.iat > 28800 || p.exp <= p.iat) return null;
    return p;
  } catch { return null; }
}
export async function readLimited(request, limit) {
  if (Number(request.headers.get('content-length')) > limit) throw new Error('TS_TOO_LARGE');
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader(), chunks = []; let length = 0;
  try {
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      length += value.length;
      if (length > limit) { await reader.cancel(); throw new Error('TS_TOO_LARGE'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
export function validateTechnicalFile(name, bytes) {
  if (typeof name !== 'string' || name.length < 1 || name.length > 180 || /[\x00-\x1f\x7f/\\]/.test(name) || !bytes.length || bytes.length > MAX_FILE_SIZE) throw new Error('TS_INVALID_FILE');
  const extension = name.split('.').pop().toLowerCase();
  const text = new TextDecoder().decode(bytes.slice(0, 16384));
  const valid = extension === 'zip' ? bytes[0] === 80 && bytes[1] === 75 && [3,5,7].includes(bytes[2])
    : extension === 'pdf' ? text.startsWith('%PDF-')
    : ['wsdl','xsd','xml'].includes(extension) ? /<(?:[\w.-]+:)?(?:definitions|description|schema)(?:\s|>)/.test(text) && !/<!DOCTYPE|<!ENTITY/i.test(text)
    : ['cer','crt','pem'].includes(extension) ? bytes[0] === 0x30 || text.startsWith('-----BEGIN CERTIFICATE-----')
    : false;
  if (!valid) throw new Error('TS_INVALID_FILE');
  // Stored unopened, never executed or interpreted as verified documentation.
  return extension;
}
