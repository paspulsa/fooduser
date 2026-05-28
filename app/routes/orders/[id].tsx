import { createRoute } from 'honox/factory'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'

export default createRoute(async (c) => {
  let isUserLoggedIn = false;
  let userId = '';

  const token = getCookie(c, 'token');
  if (token) {
    try {
      const payload = await verify(token, c.env.JWT_SECRET, 'HS256');
      if (payload && payload.id) {
        userId = payload.id as string;
        isUserLoggedIn = true;
      }
    } catch (e) {}
  }

  // URL sudah di-fix ke root
  if (!isUserLoggedIn) return c.redirect('/login');

  const orderId = c.req.param('id');

  // Tarik Data Order Utama
  const order: any = await c.env.DB.prepare(
    'SELECT * FROM orders WHERE id = ? AND user_id = ?'
  ).bind(orderId, userId).first();

  if (!order) return c.notFound();

  // Tarik Data Item Pesanan
  const { results: orderItems } = await c.env.DB.prepare(`
    SELECT od.quantity, od.price, m.name 
    FROM order_details od 
    JOIN menu_items m ON od.menu_item_id = m.id 
    WHERE od.order_id = ?
  `).bind(orderId).all();

  // Tarik Data Transaksi / Pembayaran (Termasuk unique_code)
  const transaction: any = await c.env.DB.prepare(
    'SELECT final_amount, status, raw_qris, unique_code FROM transactions WHERE order_id = ?'
  ).bind(orderId).first();

  const formatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
  const grandTotal = order.total_price || order.total_amount || 0; 
  const orderDate = new Date(order.created_at).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });

  return c.render(
    <div class="bg-gray-100 dark:bg-gray-900 min-h-screen font-sans print:bg-white print:min-h-0">
      <style dangerouslySetInnerHTML={{
        __html: `
          .hide-scrollbar::-webkit-scrollbar { display: none; }
          .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          
          @media print {
            @page { margin: 0; padding: 0; }
            body { background: white; margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
            .print\\:hidden { display: none !important; }
            .print\\:block { display: block !important; }
            .thermal-receipt {
              width: 58mm; 
              padding: 2mm;
              font-family: 'Courier New', Courier, monospace;
              font-size: 11px;
              line-height: 1.2;
              color: black;
              background: white;
              margin: 0 auto;
            }
            .thermal-border { border-bottom: 1px dashed black; margin: 4px 0; }
          }
        `
      }} />

      {/* 1. UI APLIKASI WEB */}
      <div class="print:hidden max-w-md mx-auto bg-gray-50 dark:bg-gray-800 min-h-screen relative shadow-2xl pb-24 transition-colors duration-300">
        
        <div class="bg-white dark:bg-gray-800 px-4 pt-6 pb-4 shadow-sm sticky top-0 z-30 flex justify-between items-center border-b border-gray-100 dark:border-gray-700">
          <div class="flex items-center gap-3">
            {/* URL sudah di-fix ke root */}
            <a href="/orders" class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-200 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
            </a>
            <h1 class="text-lg font-black text-gray-900 dark:text-white">Detail Pesanan</h1>
          </div>
          
          <button onclick="window.print()" class="text-xs font-bold bg-[#ee4d2d]/10 text-[#ee4d2d] px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-[#ee4d2d]/20 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
            Struk
          </button>
        </div>

        <div class="p-4 space-y-4">
          
          <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 text-center relative overflow-hidden">
            <div class="absolute top-0 left-0 w-full h-1 bg-[#ee4d2d]"></div>
            <p class="text-xs text-gray-500 dark:text-gray-400 font-bold mb-1">Status Pesanan</p>
            <h2 class="text-2xl font-black text-[#ee4d2d] mb-2">{order.status}</h2>
            <div class="text-[11px] bg-gray-100 dark:bg-gray-700 inline-block px-3 py-1 rounded-full font-mono text-gray-600 dark:text-gray-300">
              ID: {order.id}
            </div>
            <p class="text-xs text-gray-400 mt-3">{orderDate}</p>
          </div>

          <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 class="text-sm font-black text-gray-900 dark:text-white mb-3 border-b border-gray-100 dark:border-gray-700 pb-2">Daftar Menu</h3>
            <div class="space-y-3">
              {orderItems.length === 0 ? (
                <p class="text-xs text-gray-400 italic">Rincian menu sedang disinkronisasi...</p>
              ) : orderItems.map((item: any) => (
                <div class="flex justify-between items-start text-sm">
                  <div class="flex gap-2">
                    <span class="font-black text-[#ee4d2d]">{item.quantity}x</span>
                    <div>
                      <p class="font-bold text-gray-800 dark:text-gray-200">{item.name}</p>
                      <p class="text-[10px] text-gray-400">{formatter.format(item.price)} / porsi</p>
                    </div>
                  </div>
                  <span class="font-bold text-gray-900 dark:text-white">{formatter.format(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 class="text-sm font-black text-gray-900 dark:text-white mb-3 border-b border-gray-100 dark:border-gray-700 pb-2">Ringkasan Biaya</h3>
            <div class="space-y-2 text-xs font-medium text-gray-600 dark:text-gray-400">
              {order.coupon_discount > 0 && (
                <div class="flex justify-between text-green-500">
                  <span>Diskon Kupon</span>
                  <span class="font-bold">- {formatter.format(order.coupon_discount)}</span>
                </div>
              )}
              {order.points_used > 0 && (
                <div class="flex justify-between text-[#ee4d2d]">
                  <span>Potongan Poin</span>
                  <span class="font-bold">- {formatter.format(order.points_used)}</span>
                </div>
              )}
              
              <div class="flex justify-between pt-2 border-t border-dashed border-gray-200 dark:border-gray-700 mt-2">
                <span class="font-black text-sm text-gray-900 dark:text-white">Total Tagihan</span>
                <span class="font-black text-lg text-[#ee4d2d]">{formatter.format(grandTotal)}</span>
              </div>
            </div>
          </div>

          {transaction && transaction.status === 'UNPAID' && transaction.raw_qris && (
            <div class="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-4 rounded-2xl text-center shadow-sm">
              <h3 class="text-sm font-black text-[#ee4d2d] mb-2">Selesaikan Pembayaran</h3>
              <p class="text-xs text-orange-800 dark:text-orange-200 mb-4">Silakan bayar sejumlah <strong class="font-black">{formatter.format(transaction.final_amount)}</strong> dengan menscan QRIS di bawah ini.</p>
              
              <div class="inline-block p-4 bg-white rounded-2xl shadow-sm border border-orange-100 dark:border-gray-700">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(transaction.raw_qris)}`} 
                  alt="QR Code Pembayaran QRIS" 
                  class="w-48 h-48 object-contain mx-auto mix-blend-multiply"
                />
              </div>

              {/* FITUR KODE UNIK & TOMBOL CEK STATUS */}
              <div class="mt-4 pt-4 border-t border-orange-200 dark:border-orange-800/50">
                <div class="flex justify-between items-center bg-orange-100 dark:bg-orange-900/30 px-3 py-2 rounded-lg">
                   <span class="text-xs font-bold text-orange-800 dark:text-orange-200">Kode Unik:</span>
                   <span class="text-sm font-black text-[#ee4d2d]">+{transaction.unique_code || 0}</span>
                </div>
                
                <button onclick="document.getElementById('modal-info').classList.remove('hidden')" class="text-[10px] text-[#ee4d2d] underline mt-3 font-bold w-full text-center block">
                   Kenapa ada kode unik dan biaya lainnya?
                </button>

                <button onclick="location.reload()" class="mt-4 w-full bg-[#ee4d2d] text-white font-bold py-3 rounded-xl shadow-md hover:bg-orange-700 transition active:scale-95 flex items-center justify-center gap-2">
                   <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                   Cek Status Pembayaran
                </button>
              </div>

              <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-4 leading-relaxed max-w-[80%] mx-auto">
                <span class="font-bold block text-gray-700 dark:text-gray-300">Cara Bayar di HP yang sama:</span>
                Screenshot gambar QRIS di atas, buka aplikasi M-Banking/E-Wallet Anda, pilih menu Scan QR, lalu buka gambar dari Galeri.
              </p>
            </div>
          )}

        </div>
        
        {/* MODAL INFORMASI KODE UNIK & MDR */}
        <div id="modal-info" class="fixed inset-0 z-[100] hidden items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
          <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 class="font-black text-gray-900 dark:text-white mb-4 text-sm flex items-center gap-2">
              <svg class="w-5 h-5 text-[#ee4d2d]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Informasi Pembayaran
            </h3>
            <div class="space-y-4 text-xs text-gray-600 dark:text-gray-300 leading-relaxed text-justify">
               <p><strong class="text-gray-800 dark:text-gray-100 block mb-0.5">1. Angka Unik</strong> Angka ini dibuat secara otomatis untuk mengidentifikasi pembayaran order secara otomatis dan menjadi bagian dari biaya pemrosesan pembayaran.</p>
               <p class="bg-orange-50 dark:bg-orange-900/20 p-2.5 rounded-lg border border-orange-100 dark:border-orange-800/50">Jika Anda adalah member terdaftar, maka angka unik itu akan menjadi point. Ketika Anda belanja selanjutnya, point itu otomatis akan digunakan sebagai potongan pembayaran.</p>
               <p><strong class="text-gray-800 dark:text-gray-100 block mb-0.5">2. Biaya Layanan QRIS (MDR)</strong> Jika orderan Anda di atas <strong>Rp 500.000 - Rp 999.999</strong>, maka akan dikenakan MDR sebesar <strong>0.3%</strong> dari total pesanan dan jika di atas itu dikenakan MDR <strong>0.7%</strong> dari nilai total pembayaran.</p>
            </div>
            <button onclick="document.getElementById('modal-info').classList.add('hidden')" class="mt-6 w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white font-bold py-3 rounded-xl hover:bg-gray-200 transition active:scale-95">Tutup</button>
          </div>
        </div>

      </div>

      {/* 2. STRUK PRINTER THERMAL (HANYA MUNCUL SAAT DI-PRINT) */}
      <div class="hidden print:block thermal-receipt">
        <div style="text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 4px;">KEDAI PANGSIT KEMBAR 88</div>
        <div style="text-align: center; margin-bottom: 8px;">
          Food Court Modern<br/>
          Telp: 0812-xxxx-xxxx
        </div>
        
        <div class="thermal-border"></div>
        <table style="width: 100%; text-align: left; margin-bottom: 4px;">
          <tr><td style="width: 35%;">No. Ord</td><td style="width: 5%;">:</td><td>{order.id}</td></tr>
          <tr><td>Tanggal</td><td>:</td><td>{new Date(order.created_at).toLocaleString('id-ID')}</td></tr>
          <tr><td>Status</td><td>:</td><td>{order.status}</td></tr>
          <tr><td style="vertical-align: top;">Cust</td><td style="vertical-align: top;">:</td><td>{order.address || 'Walk-in'}</td></tr>
        </table>
        <div class="thermal-border"></div>

        <table style="width: 100%; text-align: left; margin-bottom: 8px;">
          {orderItems.length === 0 ? (
            <tr><td colspan="3" style="text-align: center; font-style: italic;">Rincian disinkronisasi...</td></tr>
          ) : orderItems.map((item: any) => (
            <tr>
              <td style="width: 15%; vertical-align: top;">{item.quantity}x</td>
              <td style="width: 55%; vertical-align: top;">{item.name}</td>
              <td style="width: 30%; text-align: right; vertical-align: top;">{formatter.format(item.price * item.quantity).replace('Rp', '')}</td>
            </tr>
          ))}
        </table>

        <div class="thermal-border"></div>
        
        <table style="width: 100%; font-weight: bold;">
          {order.coupon_discount > 0 && (
            <tr><td style="padding-bottom: 2px;">Kupon</td><td style="text-align: right;">-{formatter.format(order.coupon_discount).replace('Rp', '')}</td></tr>
          )}
          {order.points_used > 0 && (
            <tr><td style="padding-bottom: 2px;">Poin</td><td style="text-align: right;">-{formatter.format(order.points_used).replace('Rp', '')}</td></tr>
          )}
          <tr>
            <td style="font-size: 13px; padding-top: 4px;">TOTAL</td>
            <td style="text-align: right; font-size: 13px; padding-top: 4px;">{formatter.format(grandTotal).replace('Rp', '')}</td>
          </tr>
        </table>
        
        <div class="thermal-border" style="margin-top: 8px;"></div>
        
        <div style="text-align: center; margin-top: 10px; font-size: 10px;">
          Terima kasih atas<br/>pesanan Anda!<br/>
          <span style="font-style: italic;">Powered by SPOS</span>
        </div>
      </div>

    </div>
  , { title: 'Detail Pesanan - Kedai Pangsit Kembar 88' })
})
