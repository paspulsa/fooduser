import { Hono } from 'hono';
import { Bindings, Variables } from '../types';

export const orderRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ==========================================
// FUNGSI HELPER: GENERATOR QRIS DINAMIS
// ==========================================
function crc16_ccitt(data: string) {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
        let x = ((crc >> 8) ^ data.charCodeAt(i)) & 0xFF;
        x ^= x >> 4;
        crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

function parseTlv(tlv: string) {
    const tags: any = {};
    let i = 0;
    while (i < tlv.length) {
        const tag = tlv.substring(i, i + 2);
        const lenStr = tlv.substring(i + 2, i + 4);
        const len = parseInt(lenStr, 10);
        if (isNaN(len)) break;
        const val = tlv.substring(i + 4, i + 4 + len);
        tags[tag] = val;
        i += 4 + len;
    }
    return tags;
}

function injectAmount(qrisRaw: string, amount: number) {
    if (!qrisRaw) return null;
    try {
        const tags = parseTlv(qrisRaw);
        delete tags['63']; 
        tags['53'] = '360'; 
        tags['54'] = amount.toFixed(2); 
        tags['58'] = 'ID'; 
        
        const sortedKeys = Object.keys(tags).sort();
        let newTlv = '';
        for (const tag of sortedKeys) {
            const val = tags[tag];
            const len = String(val.length).padStart(2, '0');
            newTlv += tag + len + val;
        }
        const withCrcHeader = newTlv + '6304';
        return withCrcHeader + crc16_ccitt(withCrcHeader);
    } catch (e) {
        console.error("QRIS Inject Error:", e);
        return null;
    }
}

// ==========================================
// ENDPOINT CHECKOUT (MEMPROSES PESANAN & QRIS)
// ==========================================
orderRouter.post('/checkout', async (c) => {
  const db = c.env.DB;
  const user = c.get('jwtPayload'); 
  const body = await c.req.json();
  
  if (!user || !user.id) return c.json({ success: false, message: 'Harap login terlebih dahulu.' }, 401);
  if (!body.cart || body.cart.length === 0) return c.json({ success: false, message: 'Keranjang kosong.' }, 400);

  try {
    // 1. Ambil Pengaturan Biaya & Config QRIS
    const settings: any = await db.prepare('SELECT * FROM delivery_settings WHERE id = "default-settings"').first();
    const config: any = await db.prepare('SELECT * FROM config WHERE id = 1').first();
    
    if (!config || !config.master_raw_qris) {
      return c.json({ success: false, message: 'Sistem pembayaran sedang tidak tersedia (Master QRIS belum diset admin).' }, 500);
    }

    // 2. Kalkulasi Subtotal dari Database & Ekstrak Resto ID
    let subtotal = 0;
    let fallbackRestoId = 'default_resto';
    for (const item of body.cart) {
      const dbItem: any = await db.prepare(`
        SELECT m.price, m.promo_price, m.is_promo, c.restaurant_id 
        FROM menu_items m
        LEFT JOIN menu_categories c ON m.category_id = c.id
        WHERE m.id = ?
      `).bind(item.id).first();
      
      if (dbItem) {
        const itemPrice = dbItem.is_promo === 1 ? dbItem.promo_price : dbItem.price;
        subtotal += (itemPrice + (item.additional_price || 0)) * item.qty;
        if(dbItem.restaurant_id) fallbackRestoId = dbItem.restaurant_id;
      }
    }

    const finalRestoId = body.restaurant_id || fallbackRestoId;
    await db.prepare(`INSERT OR IGNORE INTO restaurants (id, name, address) VALUES (?, 'Cabang Utama', 'Otomatis dibuat oleh sistem')`).bind(finalRestoId).run();

    // 3. Kalkulasi Total Dasar (Sebelum Diskon)
    const ongkir = typeof body.ongkir === 'number' ? body.ongkir : (settings?.mid_range_price || 10000);
    const serviceFee = 3000;
    const totalBeforeDiscount = subtotal + ongkir + serviceFee;

    // 4. Kalkulasi Diskon Kupon & Eksekusi Sisa Kupon ke Poin
    let rawCouponDiscount = 0;
    let appliedCouponDiscount = 0;
    let excessCouponValue = 0; 

    if (body.coupon_code) {
      const coupon: any = await db.prepare('SELECT * FROM coupons WHERE code = ? AND is_active = 1').bind(body.coupon_code).first();
      if (coupon && subtotal >= coupon.min_purchase) {
        if (coupon.discount_type === 'PERCENTAGE') {
          rawCouponDiscount = Math.floor(subtotal * (coupon.discount_value / 100));
          if (coupon.max_discount > 0 && rawCouponDiscount > coupon.max_discount) {
             rawCouponDiscount = coupon.max_discount;
          }
        } else {
          rawCouponDiscount = coupon.discount_value; 
        }

        if (rawCouponDiscount > totalBeforeDiscount) {
          appliedCouponDiscount = totalBeforeDiscount; 
          excessCouponValue = rawCouponDiscount - totalBeforeDiscount; 
        } else {
          appliedCouponDiscount = rawCouponDiscount;
        }
        
        await db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?').bind(coupon.code).run();
      }
    }

    // 5. Total Sementara Setelah Kupon
    let baseTotal = totalBeforeDiscount - appliedCouponDiscount;

    // KALKULASI BIAYA MDR (MERCHANT DISCOUNT RATE)
    let mdrFee = 0;
    if (baseTotal >= 1000000) {
        mdrFee = Math.floor(baseTotal * 0.007); // 0.7%
    } else if (baseTotal >= 500000) {
        mdrFee = Math.floor(baseTotal * 0.003); // 0.3%
    }
    baseTotal += mdrFee;

    // 6. Cek Saldo Point User
    const pointData: any = await db.prepare('SELECT balance FROM points WHERE user_id = ?').bind(user.id).first();
    const userPoints = pointData ? pointData.balance : 0;

    // ==========================================
    // 7. LOGIKA INTI: KODE UNIK vs POTONG POINT
    // ==========================================
    let finalAmount = baseTotal;
    let pointsUsed = 0;
    let uniqueCodeGenerated = 0;

    if (baseTotal > 0) {
        if (userPoints > 0) {
          // SKENARIO A: USER PUNYA POINT
          pointsUsed = Math.min(userPoints, baseTotal);
          finalAmount = baseTotal - pointsUsed;
        } else {
          // SKENARIO B: USER TIDAK PUNYA POINT
          const min = config.unique_min || 1;
          const max = config.unique_max || 999;
          const now = Math.floor(Date.now() / 1000);
          
          let isCollision = true;
          let attempts = 0;
          
          while (isCollision && attempts < 15) {
            uniqueCodeGenerated = Math.floor(Math.random() * (max - min + 1)) + min;
            finalAmount = baseTotal + uniqueCodeGenerated;
            
            const exists = await db.prepare("SELECT id FROM transactions WHERE final_amount = ? AND status = 'UNPAID' AND expired_at > ?").bind(finalAmount, now).first();
            if (!exists) isCollision = false;
            attempts++;
          }
          
          if (isCollision) return c.json({ success: false, message: 'Server pembayaran sedang sibuk.' }, 503);
        }
    }

    const orderId = 'ORD-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000);
    
    // Gabungkan info alamat, notes, dan MDR ke satu field
    const mdrNote = mdrFee > 0 ? `| Termasuk MDR: Rp ${mdrFee}` : '';
    const finalAddress = body.notes ? `${body.address || '-'} (Catatan: ${body.notes}) ${mdrNote}` : `${body.address || '-'} ${mdrNote}`;

    // ==========================================
    // 8A. SKENARIO AUTO-LUNAS (TAGIHAN RP 0)
    // ==========================================
    if (finalAmount === 0) {
        await db.prepare(
          `INSERT INTO orders (id, user_id, restaurant_id, total_price, status, address, order_type, payment_method, points_used, coupon_code, coupon_discount) 
           VALUES (?, ?, ?, ?, 'PROCESSING', ?, 'DELIVERY', 'POINTS', ?, ?, ?)`
        ).bind(orderId, user.id, finalRestoId, baseTotal, finalAddress, pointsUsed, body.coupon_code || null, appliedCouponDiscount).run();

        for (const item of body.cart) {
          const odId = crypto.randomUUID();
          const dbItem: any = await db.prepare('SELECT price, promo_price, is_promo FROM menu_items WHERE id = ?').bind(item.id).first();
          const itemPrice = dbItem ? (dbItem.is_promo === 1 ? dbItem.promo_price : dbItem.price) : 0;
          const finalItemPrice = itemPrice + (item.additional_price || 0);
          
          await db.prepare('INSERT INTO order_details (id, order_id, menu_item_id, quantity, price, note) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(odId, orderId, item.id, item.qty, finalItemPrice, item.note || '').run();
        }

        const netPointsChange = excessCouponValue - pointsUsed;
        if (netPointsChange !== 0) {
            await db.prepare(`
                INSERT INTO points (user_id, balance) VALUES (?, ?)
                ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?
            `).bind(user.id, Math.max(0, netPointsChange), netPointsChange).run();
        }

        return c.json({ 
          success: true, 
          message: 'Pesanan berhasil dibuat dan Otomatis Lunas!', 
          data: { order_id: orderId, final_amount: 0 } 
        });
    }

    // ==========================================
    // 8B. SKENARIO BAYAR QRIS (TAGIHAN > RP 0)
    // ==========================================
    await db.prepare(
      `INSERT INTO orders (id, user_id, restaurant_id, total_price, status, address, order_type, payment_method, points_used, coupon_code, coupon_discount) 
       VALUES (?, ?, ?, ?, 'PENDING', ?, 'DELIVERY', 'QRIS', ?, ?, ?)`
    ).bind(orderId, user.id, finalRestoId, baseTotal, finalAddress, pointsUsed, body.coupon_code || null, appliedCouponDiscount).run();

    for (const item of body.cart) {
        const odId = crypto.randomUUID();
        const dbItem: any = await db.prepare('SELECT price, promo_price, is_promo FROM menu_items WHERE id = ?').bind(item.id).first();
        const itemPrice = dbItem ? (dbItem.is_promo === 1 ? dbItem.promo_price : dbItem.price) : 0;
        const finalItemPrice = itemPrice + (item.additional_price || 0);
        
        await db.prepare('INSERT INTO order_details (id, order_id, menu_item_id, quantity, price, note) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(odId, orderId, item.id, item.qty, finalItemPrice, item.note || '').run();
    }

    if (excessCouponValue > 0) {
        await db.prepare(`
            INSERT INTO points (user_id, balance) VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?
        `).bind(user.id, excessCouponValue, excessCouponValue).run();
    }

    const nowTimestamp = Math.floor(Date.now() / 1000);
    const expiredAt = nowTimestamp + (30 * 60); 
    
    const rawQris = injectAmount(config.master_raw_qris, finalAmount);
    if (!rawQris) {
        return c.json({ success: false, message: 'Gagal membuat QRIS dinamis.' }, 500);
    }
    
    await db.prepare(
      `INSERT INTO transactions (order_id, amount, unique_code, final_amount, raw_qris, status, created_at, expired_at) 
       VALUES (?, ?, ?, ?, ?, 'UNPAID', ?, ?)`
    ).bind(orderId, baseTotal, uniqueCodeGenerated, finalAmount, rawQris, nowTimestamp, expiredAt).run();

    return c.json({ 
      success: true, 
      message: 'Pesanan berhasil dibuat!', 
      data: { order_id: orderId, final_amount: finalAmount } 
    });

  } catch (error: any) {
    return c.json({ success: false, message: 'Gagal memproses pesanan: ' + error.message }, 500);
  }
});

// ==========================================
// ENDPOINT CHECKOUT VOUCHER (NON-FOOD)
// ==========================================
orderRouter.post('/checkout-voucher', async (c) => {
  const db = c.env.DB;
  const user = c.get('jwtPayload'); 
  const body = await c.req.json();
  
  if (!user || !user.id) return c.json({ success: false, message: 'Harap login.' }, 401);

  try {
    const config: any = await db.prepare('SELECT * FROM config WHERE id = 1').first();
    if (!config || !config.master_raw_qris) {
      return c.json({ success: false, message: 'Sistem pembayaran belum siap.' }, 500);
    }

    let baseTotal = 0;
    let voucherValue = 0;
    let bulkQty = 1;

    if (body.package_id) {
        const pkg: any = await db.prepare('SELECT * FROM voucher_packages WHERE id = ? AND is_active = 1').bind(body.package_id).first();
        if (!pkg) return c.json({ success: false, message: 'Paket voucher tidak valid' }, 400);
        baseTotal = pkg.sell_price;
        voucherValue = pkg.voucher_value;
        bulkQty = pkg.bulk_qty;
    } else if (body.custom_amount) {
        if (body.custom_amount < 10000) return c.json({ success: false, message: 'Minimal custom voucher Rp 10.000' }, 400);
        baseTotal = body.custom_amount;
        voucherValue = body.custom_amount;
    } else {
        return c.json({ success: false, message: 'Parameter tidak valid' }, 400);
    }

    await db.prepare(`INSERT OR IGNORE INTO restaurants (id, name, address) VALUES ('SYSTEM', 'Sistem Pembelian Voucher', 'Digital')`).run();

    // KALKULASI BIAYA MDR (MERCHANT DISCOUNT RATE) UNTUK VOUCHER
    let mdrFee = 0;
    if (baseTotal >= 1000000) {
        mdrFee = Math.floor(baseTotal * 0.007); // 0.7%
    } else if (baseTotal >= 500000) {
        mdrFee = Math.floor(baseTotal * 0.003); // 0.3%
    }
    baseTotal += mdrFee;

    const pointData: any = await db.prepare('SELECT balance FROM points WHERE user_id = ?').bind(user.id).first();
    const userPoints = pointData ? pointData.balance : 0;

    let finalAmount = baseTotal;
    let pointsUsed = 0;
    let uniqueCode = 0;

    if (baseTotal > 0 && userPoints > 0) {
      pointsUsed = Math.min(userPoints, baseTotal);
      finalAmount = baseTotal - pointsUsed;
    } else if (baseTotal > 0) {
      const min = config.unique_min || 1;
      const max = config.unique_max || 999;
      uniqueCode = Math.floor(Math.random() * (max - min + 1)) + min;
      finalAmount = baseTotal + uniqueCode;
    }

    const orderId = 'VCH-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 100);
    
    // Notes digabungkan ke address agar sesuai dengan skema tabel
    const notesJson = JSON.stringify({ is_voucher: true, voucher_value: voucherValue, bulk_qty: bulkQty, mdr_fee: mdrFee });
    const finalAddress = `DIGITAL VOUCHER | Catatan: ${notesJson}`;

    await db.prepare(
      `INSERT INTO orders (id, user_id, restaurant_id, total_price, status, address, order_type, payment_method, points_used) 
       VALUES (?, ?, 'SYSTEM', ?, 'PENDING', ?, 'VOUCHER', ?, ?)`
    ).bind(
      orderId, user.id, 'SYSTEM', baseTotal, 
      finalAddress, 
      finalAmount === 0 ? 'POINTS' : 'QRIS', 
      pointsUsed
    ).run();

    if (finalAmount > 0) {
        const now = Math.floor(Date.now() / 1000);
        const rawQris = injectAmount(config.master_raw_qris, finalAmount);
        
        await db.prepare(
          `INSERT INTO transactions (order_id, amount, unique_code, final_amount, raw_qris, status, created_at, expired_at) 
           VALUES (?, ?, ?, ?, ?, 'UNPAID', ?, ?)`
        ).bind(orderId, baseTotal, uniqueCode, finalAmount, rawQris, now, now + 1800).run();
    }

    return c.json({ success: true, data: { order_id: orderId, final_amount: finalAmount } });
  } catch (e: any) {
    return c.json({ success: false, message: e.message }, 500);
  }
});

// ROUTE PUT /:id/status TELAH DIHAPUS KARENA INI REPOSITORI KHUSUS USER
