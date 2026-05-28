import { Hono } from 'hono';
import { Bindings, Variables } from '../types';

export const userRouter = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET USER DETAIL (Hanya detail dirinya sendiri)
userRouter.get('/me', async (c) => {
  const user = c.get('jwtPayload'); // Ambil ID dari token JWT
  if (!user || !user.id) return c.json({ success: false, message: 'Harap login.' }, 401);

  const data: any = await c.env.DB.prepare(
    'SELECT id, name, email, age, gender, address, role, phone, avatar, isActive, accountType FROM users WHERE id = ?'
  ).bind(user.id).first();
  
  if (!data) return c.json({ success: false, message: 'Pengguna tidak ditemukan' }, 404);
  
  data.isActive = data.isActive === 1;
  return c.json({ success: true, data });
});

// UPDATE USER (Hanya profil dirinya sendiri, TANPA update role)
userRouter.put('/me', async (c) => {
  const user = c.get('jwtPayload');
  if (!user || !user.id) return c.json({ success: false, message: 'Harap login.' }, 401);

  const body = await c.req.json();
  
  // Perhatikan: Kami menghilangkan `role = ?` dan `isActive = ?` agar tidak bisa di-hack.
  const { success } = await c.env.DB.prepare(
    `UPDATE users 
     SET name = ?, age = ?, gender = ?, address = ?, phone = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`
  ).bind(
    body.name, 
    body.age || null, 
    body.gender || 'UNKNOWN', 
    body.address || null, 
    body.phone || null, 
    body.avatar || 'default-user.png', 
    user.id // Pastikan mengunci ke ID dari token
  ).run();

  if (!success) return c.json({ success: false, message: 'Gagal memperbarui profil' }, 500);
  return c.json({ success: true, message: 'Profil berhasil diperbarui' });
});