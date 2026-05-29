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

// --- ROUTER AUTENTIKASI ---

authRouter.post('/login', async (c) => {
  const { email, password } = await c.req.json();
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<any>();

  if (!user || !(await verifyPassword(password, user.password))) {
    return c.json({ success: false, message: 'Email atau password salah!' }, 401);
  }

  // Menyimpan nama pengguna ke dalam payload JWT (Agar bisa ditampilkan di keranjang)
  const token = await sign({ id: user.id, role: user.role, name: user.name }, c.env.JWT_SECRET, 'HS256');
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
// ENDPOINT LOGIN GUEST (DINE-IN & TAKEAWAY)
// ==========================================
authRouter.post('/guest-login', async (c) => {
    const db = c.env.DB;
    const body = await c.req.json();
    
    if (!body.guest_name) {
        return c.json({ success: false, message: 'Nama panggilan wajib diisi.' }, 400);
    }

    const orderType = body.order_type || 'DINE_IN';
    let finalTableId = 'TAKEAWAY';

    try {
        // 1. Jika pelanggan memilih Dine-In, WAJIB validasi meja
        if (orderType === 'DINE_IN') {
            if (!body.table_id) return c.json({ success: false, message: 'Nomor meja wajib dipilih untuk Dine-In.' }, 400);
            
            // Cek ketersediaan meja
            const table: any = await db.prepare('SELECT status FROM tables WHERE id = ?').bind(body.table_id).first();
            if (!table) return c.json({ success: false, message: 'Meja tidak ditemukan.' }, 404);
            if (table.status !== 'IDLE') return c.json({ success: false, message: 'Meja sedang digunakan atau belum dibersihkan kasir.' }, 400);

            // Kunci Meja (Mencegah pelanggan lain scan QR yang sama di waktu bersamaan)
            await db.prepare("UPDATE tables SET status = 'OCCUPIED' WHERE id = ?").bind(body.table_id).run();
            finalTableId = body.table_id;
        }

        // 2. Buat Record "Bayangan" di Tabel Users (Agar Relasi Order & Transaksi Sah)
        const guestId = crypto.randomUUID();
        const dummyEmail = `guest_${guestId.substring(0,8)}@guest.local`;
        const dummyPassword = await hashPassword(guestId); // Menggunakan UUID sbg password agar aman

        await db.prepare(
            `INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, 'USER')`
        ).bind(guestId, body.guest_name, dummyEmail, dummyPassword).run();

        // 3. Terbitkan Token JWT Khusus Guest (Menyimpan Metadata Sesi)
        const payload = {
            id: guestId,
            role: 'USER', // Anggap sebagai USER biasa agar Middleware JWT mengizinkannya tembus
            name: body.guest_name,
            table_id: finalTableId,
            order_type: orderType, // Menyimpan Dine In atau Takeaway
            is_guest: true, // Tanda khusus
            exp: Math.floor(Date.now() / 1000) + (12 * 60 * 60) // Expired 12 Jam
        };

        const token = await sign(payload, c.env.JWT_SECRET, 'HS256');

        return c.json({
            success: true,
            token,
            message: 'Sesi Guest berhasil dibuat',
            data: { id: guestId, email: dummyEmail }
        });
    } catch (e: any) {
        return c.json({ success: false, message: 'Database Error: ' + e.message }, 500);
    }
});
