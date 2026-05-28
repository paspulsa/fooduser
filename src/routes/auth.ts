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

// ==========================================
// ENDPOINT LOGIN GUEST (MAKAN DI TEMPAT / DINE-IN)
// ==========================================
authRouter.post('/guest-login', async (c) => {
    const db = c.env.DB;
    const body = await c.req.json();
    
    if (!body.guest_name || !body.table_id) {
        return c.json({ success: false, message: 'Nama dan Meja wajib diisi.' }, 400);
    }

    try {
        // Cek apakah meja memang kosong
        const table: any = await db.prepare('SELECT status FROM tables WHERE id = ?').bind(body.table_id).first();
        if (!table) return c.json({ success: false, message: 'Meja tidak ditemukan.' }, 404);
        if (table.status !== 'IDLE') return c.json({ success: false, message: 'Meja sedang digunakan.' }, 400);

        // Buat ID User Sementara
        const guestId = 'GUEST-' + crypto.randomUUID().substring(0,8).toUpperCase();

        // Kunci Meja menjadi OCCUPIED
        await db.prepare("UPDATE tables SET status = 'OCCUPIED' WHERE id = ?").bind(body.table_id).run();

        // Terbitkan Token JWT Khusus Guest
        const payload = {
            id: guestId,
            role: 'GUEST',
            name: body.guest_name,
            table_id: body.table_id,
            exp: Math.floor(Date.now() / 1000) + (12 * 60 * 60) // Expire 12 Jam
        };

        const token = await sign(payload, c.env.JWT_SECRET, 'HS256');

        return c.json({
            success: true,
            token,
            message: 'Sesi Meja berhasil dibuat'
        });
    } catch (e: any) {
        return c.json({ success: false, message: 'Database Error: ' + e.message }, 500);
    }
});
