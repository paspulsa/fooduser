import { Hono } from 'hono';
import { Bindings, Variables } from '../types';

export const couponRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ==========================================
// 1. PUBLIC API (Validasi Kupon di Cart)
// ==========================================
couponRouter.post('/validate', async (c) => {
  const { code, subtotal } = await c.req.json();
  const subtotalValue = parseInt(subtotal) || 0;

  const coupon = await c.env.DB.prepare(
    'SELECT * FROM coupons WHERE code = ? AND is_active = 1 COLLATE NOCASE'
  ).bind(code).first<any>();

  if (!coupon) return c.json({ success: false, message: 'Kupon tidak valid atau tidak ditemukan.' });
  
  // Cek Kuota
  if (coupon.usage_limit > 0 && coupon.used_count >= coupon.usage_limit) {
    return c.json({ success: false, message: 'Kupon sudah habis (kuota penuh).' });
  }

  // Cek Tanggal Kedaluwarsa
  if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
    return c.json({ success: false, message: 'Kupon ini sudah kedaluwarsa.' });
  }

  // Cek Minimal Belanja
  if (subtotalValue < coupon.min_purchase) {
    return c.json({ success: false, message: `Minimal belanja Rp ${coupon.min_purchase.toLocaleString('id-ID')} untuk menggunakan kupon ini.` });
  }

  // Hitung Diskon
  let discountAmount = 0;
  if (coupon.discount_type === 'PERCENTAGE') {
    discountAmount = Math.floor(subtotalValue * (coupon.discount_value / 100));
    if (coupon.max_discount > 0 && discountAmount > coupon.max_discount) {
      discountAmount = coupon.max_discount;
    }
  } else {
    discountAmount = coupon.discount_value;
  }

  // Cegah diskon melebihi subtotal (Bayar full dengan voucher)
  if (discountAmount > subtotalValue) discountAmount = subtotalValue;

  return c.json({ 
    success: true, 
    data: { code: coupon.code, discount_amount: discountAmount } 
  });
});