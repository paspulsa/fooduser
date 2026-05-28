import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { Bindings } from '../types';

export const authRouter = new Hono<{ Bindings: Bindings }>();

// --- FUNGSI UTILITY HASHING (Native Web Crypto) ---
const PBKDF2_ITERATIONS = 100000;

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw", encoder.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey, 256
  );
  
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw", encoder.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey, 256
  );
  const newHashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  return newHashHex === hashHex;
}

// --- ROUTER ---

authRouter.post('/login', async (c) => {
  const { email, password } = await c.req.json();
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<any>();

  if (!user || !(await verifyPassword(password, user.password))) {
    return c.json({ success: false, message: 'Email atau password salah!' }, 401);
  }

  const token = await sign({ id: user.id, role: user.role }, c.env.JWT_SECRET, 'HS256');
  return c.json({ success: true, token, currentAuthority: user.role });
});

authRouter.post('/register', async (c) => {
  const { name, email, password } = await c.req.json();
  const hashedPassword = await hashPassword(password);
  const id = crypto.randomUUID();

  try {
    await c.env.DB.prepare(
      `INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)`
    ).bind(id, name, email, hashedPassword).run();
    
    return c.json({ success: true, message: 'Registrasi berhasil.' }, 201);
  } catch (e) {
    return c.json({ success: false, message: 'Email sudah terdaftar.' }, 400);
  }
});
