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

  // Jika tidak login, kembalikan ke halaman login
  if (!isUserLoggedIn) return c.redirect('/login');

  const orderId = c.req.param('id');

  // 1. PERBAIKAN BUGS ERROR 500: Gunakan 'id = ?' pada tabel orders
  const order: any = await c.env.DB.prepare(
    'SELECT * FROM orders WHERE id = ? AND user_id = ?'
  ).bind(orderId, userId).first();

  if (!order) {
    return c.render(
      <div class="p-10 text-center font-sans bg-gray-100 dark:bg-gray-900 min-h-screen">
        <h2 class="text-2xl font-bold text-gray-800 dark:text-white">Pesanan Tidak Ditemukan</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Mungkin pesanan ini bukan milik Anda atau sudah dihapus.</p>
        <a href="/orders" class="text-white bg-[#ee4d2d] px-5 py-2.5 rounded-xl mt-6 inline-block font-bold hover:bg-orange-700 transition">Kembali ke Daftar Pesanan</a>
      </div>, { title: 'Not Found' }
    );
  }

  // Ambil Nama Restoran
  const restaurant: any = await c.env.DB.prepare(
      'SELECT name FROM restaurants WHERE id = ?'
  ).bind(order.restaurant_id).first();

  // 2. Ambil Data Anak (Detail Item) + Harga Master untuk Kalkulasi Custom Addon
  const { results: items } = await c.env.DB.prepare(`
    SELECT od.*, m.name as item_name, m.image as item_image, m.price as base_price, m.promo_price, m.is_promo
    FROM order_details od
    JOIN menu_items m ON od.menu_item_id = m.id
    WHERE od.order_id = ?
  `).bind(orderId).all();

  // 3. Ambil Data Transaksi (Untuk MDR, Kode Unik, dan Total Bayar Real)
  const transaction: any = await c.env.DB.prepare(
    'SELECT amount, final_amount, status, raw_qris, unique_code FROM transactions WHERE order_id = ?'
  ).bind(orderId).first();

  const formatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
  const orderDate = new Date(order.created_at).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });

  // ==========================================
  // KALKULASI REVERSE ENGINEERING BIAYA
  // ==========================================
  let subtotal = 0;
  let ongkir = 0;

  if (order.order_type === 'VOUCHER') {
      subtotal = order.total_price;
      ongkir = 0;
  } else {
      subtotal = items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
      ongkir = Math.max(0, order.total_price - subtotal + (order.coupon_discount || 0));
  }

  const uniqueCode = transaction ? (transaction.unique_code || 0) : 0;
  
  // Rumus Ekstrak MDR yang akurat (Final Bayar - Total Tagihan Asli - Kode Unik + Poin Dipakai)
  let mdrFee = 0;
  let finalBayar = order.total_price;
  
  if (transaction) {
      finalBayar = transaction.final_amount;
      mdrFee = Math.max(0, finalBayar - order.total_price - uniqueCode + (order.points_used || 0));
  } else if (order.status === 'PROCESSING' || order.status === 'COMPLETED') {
      finalBayar = 0;
      mdrFee = 0; 
  }

  const totalTagihan = order.total_price + mdrFee;

  return c.render(
    <div class="bg-gray-100 dark:bg-gray-900 min-h-screen font-sans pb-28">
      <style dangerouslySetInnerHTML={{
        __html: `
          .hide-scrollbar::-webkit-scrollbar { display: none; }
          .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          .pb-safe { padding-bottom: env(safe-area-inset-bottom, 20px); }
        `
      }} />

      <div class="max-w-md mx-auto bg-gray-50 dark:bg-gray-800 min-h-screen relative shadow-2xl transition-colors duration-300">
        
        {/* HEADER PAGE */}
        <div class="bg-white dark:bg-gray-800 px-4 pt-6 pb-4 shadow-sm sticky top-0 z-30 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
          <div class="flex items-center gap-3">
            <a href="/orders" class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-200 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
            </a>
            <h1 class="text-lg font-black text-gray-900 dark:text-white">Detail Pesanan</h1>
          </div>
        </div>

        <div class="p-4 space-y-4">
          
          {/* KARTU STATUS PESANAN */}
          <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 text-center relative overflow-hidden">
            <div class="absolute top-0 left-0 w-full h-1 bg-[#ee4d2d]"></div>
            <p class="text-xs text-gray-500 dark:text-gray-400 font-bold mb-1">Status Saat Ini</p>
            <h2 class="text-2xl font-black text-[#ee4d2d] mb-2">{order.status}</h2>
            <div class="text-[11px] bg-gray-100 dark:bg-gray-700 inline-block px-3 py-1 rounded-full font-mono text-gray-600 dark:text-gray-300">
              #{order.id.substring(0,8).toUpperCase()}
            </div>
            <p class="text-xs text-gray-400 mt-3">{orderDate}</p>
          </div>

          {/* DAFTAR ITEM PESANAN */}
          <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 class="text-sm font-black text-gray-900 dark:text-white mb-3 border-b border-gray-100 dark:border-gray-700 pb-2">Rincian Item</h3>
            <div class="space-y-4">
              {items.length === 0 ? (
                <p class="text-xs text-gray-400 italic text-center py-2">{order.order_type === 'VOUCHER' ? 'Pembelian Voucher Digital' : 'Tidak ada rincian item.'}</p>
              ) : items.map((item: any) => {
                const currentBasePrice = item.is_promo ? item.promo_price : item.base_price;
                const addonPrice = item.price - currentBasePrice;

                return (
                  <div class="flex items-start gap-3">
                    <img src={item.item_image || 'https://via.placeholder.com/150'} class="w-12 h-12 rounded-xl object-cover border border-gray-100 dark:border-gray-700 flex-shrink-0" />
                    <div class="flex-1 min-w-0">
                      <div class="flex justify-between items-start">
                        <p class="text-sm font-bold text-gray-800 dark:text-gray-200 line-clamp-2 leading-snug pr-2">{item.item_name}</p>
                        <span class="font-black text-sm text-gray-900 dark:text-white shrink-0">{formatter.format(item.price * item.quantity)}</span>
                      </div>
                      
                      <div class="mt-1 flex items-center justify-between">
                         <div class="flex items-center gap-1.5">
                            <span class="font-black text-[#ee4d2d] text-xs">{item.quantity}x</span>
                            <span class="text-[10px] text-gray-500 dark:text-gray-400">@ {formatter.format(item.price)}</span>
                         </div>
                      </div>

                      {/* RINCIAN ADDON CUSTOM */}
                      {item.note && addonPrice > 0 && (
                         <div class="mt-1.5 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-700 text-[10px]">
                            <p class="text-gray-700 dark:text-gray-300 font-semibold mb-0.5 text-[#ee4d2d]">Custom: {item.note}</p>
                            <div class="flex justify-between text-gray-500 dark:text-gray-400">
                               <span>Harga Dasar:</span><span>{formatter.format(currentBasePrice)}</span>
                            </div>
                            <div class="flex justify-between text-orange-500">
                               <span>Tambahan:</span><span>+{formatter.format(addonPrice)}</span>
                            </div>
                         </div>
                      )}
                      {item.note && addonPrice === 0 && (
                         <p class="text-[10px] font-semibold text-orange-500 mt-1">Catatan: {item.note}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* RINGKASAN BIAYA & PEMBAYARAN */}
          <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 class="text-sm font-black text-gray-900 dark:text-white mb-3 border-b border-gray-100 dark:border-gray-700 pb-2">Ringkasan Pembayaran</h3>
            <div class="space-y-2 text-xs font-medium text-gray-600 dark:text-gray-400">
              
              <div class="flex justify-between">
                <span>Subtotal Pesanan</span>
                <span class="font-bold text-gray-800 dark:text-gray-200">{formatter.format(subtotal)}</span>
              </div>
              
              {ongkir > 0 && (
                <div class="flex justify-between">
                  <span>Ongkos Kirim</span>
                  <span class="font-bold text-gray-800 dark:text-gray-200">{formatter.format(ongkir)}</span>
                </div>
              )}

              {mdrFee > 0 && (
                <div class="flex justify-between text-yellow-600 dark:text-yellow-500">
                  <span class="flex items-center gap-1">Biaya Layanan (MDR) <button onclick="document.getElementById('modal-info').classList.replace('hidden', 'flex')" class="text-gray-400 hover:text-[#ee4d2d]"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button></span>
                  <span class="font-bold">{formatter.format(mdrFee)}</span>
                </div>
              )}

              {order.coupon_discount > 0 && (
                <div class="flex justify-between text-green-500">
                  <span>Diskon Kupon</span>
                  <span class="font-bold">- {formatter.format(order.coupon_discount)}</span>
                </div>
              )}

              <div class="flex justify-between pt-2 border-t border-dashed border-gray-200 dark:border-gray-700 mt-2">
                <span class="font-black text-sm text-gray-900 dark:text-white">Total Tagihan</span>
                <span class="font-black text-sm text-gray-900 dark:text-white">{formatter.format(totalTagihan)}</span>
              </div>

              {order.points_used > 0 && (
                <div class="flex justify-between text-[#ee4d2d] pt-1">
                  <span>Potongan Saldo Poin</span>
                  <span class="font-bold">- {formatter.format(order.points_used)}</span>
                </div>
              )}

              {uniqueCode > 0 && (
                <div class="flex justify-between text-[#ee4d2d] pt-1">
                  <span class="flex items-center gap-1">Kode Unik <button onclick="document.getElementById('modal-info').classList.replace('hidden', 'flex')" class="text-gray-400 hover:text-[#ee4d2d]"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button></span>
                  <span class="font-bold">+{uniqueCode}</span>
                </div>
              )}

              <div class="flex justify-between pt-3 border-t border-gray-200 dark:border-gray-700 mt-2">
                <span class="font-black text-base text-gray-900 dark:text-white">Total Bayar</span>
                <span class="font-black text-xl text-[#ee4d2d]">{formatter.format(finalBayar)}</span>
              </div>

            </div>
          </div>

          {/* KARTU QRIS JIKA BELUM BAYAR */}
          {transaction && transaction.status === 'UNPAID' && transaction.raw_qris && (
            <div class="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-5 rounded-2xl text-center shadow-sm">
              <h3 class="text-sm font-black text-[#ee4d2d] mb-2">Selesaikan Pembayaran</h3>
              <p class="text-xs text-orange-800 dark:text-orange-200 mb-4">Silakan bayar sejumlah <strong class="font-black text-sm">{formatter.format(finalBayar)}</strong> dengan menscan QRIS di bawah ini.</p>
              
              <div class="inline-block p-4 bg-white rounded-2xl shadow-sm border border-orange-100 dark:border-gray-700">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(transaction.raw_qris)}`} 
                  alt="QR Code Pembayaran QRIS" 
                  class="w-48 h-48 object-contain mx-auto mix-blend-multiply"
                />
              </div>

              <div class="mt-5">
                <div class="flex justify-between items-center bg-orange-100 dark:bg-orange-900/30 px-4 py-2.5 rounded-lg border border-orange-200/50 dark:border-orange-800/50">
                   <span class="text-xs font-bold text-orange-800 dark:text-orange-200">Kode Unik:</span>
                   <span class="text-sm font-black text-[#ee4d2d]">+{uniqueCode}</span>
                </div>
                
                <button onclick="document.getElementById('modal-info').classList.replace('hidden', 'flex')" class="text-[10px] text-[#ee4d2d] underline mt-3 font-bold w-full text-center block">
                   Kenapa ada kode unik dan biaya layanan?
                </button>

                <button onclick="location.reload()" class="mt-5 w-full bg-[#ee4d2d] text-white font-black py-3.5 rounded-xl shadow-lg shadow-[#ee4d2d]/20 hover:bg-orange-700 transition active:scale-95 flex items-center justify-center gap-2">
                   <svg class="w-4 h-4 animate-spin-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                   Cek Status Pembayaran
                </button>
              </div>

              <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-4 leading-relaxed px-2">
                <span class="font-bold block text-gray-700 dark:text-gray-300">Cara Bayar di HP yang sama:</span>
                Screenshot gambar QRIS di atas, buka aplikasi M-Banking/E-Wallet Anda, pilih menu Scan QR, lalu unggah gambar dari Galeri.
              </p>
            </div>
          )}

        </div>
        
        {/* =========================================================
            MODAL INFORMASI KODE UNIK & MDR (BERADA TEPAT DI TENGAH)
            ========================================================= */}
        <div id="modal-info" class="fixed inset-0 z-[100] hidden justify-center">
          <div class="w-full max-w-md relative flex items-center justify-center h-full p-4">
             {/* Backdrop */}
             <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="document.getElementById('modal-info').classList.replace('flex', 'hidden')"></div>
             
             {/* Modal Content */}
             <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full relative z-10 shadow-2xl transform transition-transform">
               <h3 class="font-black text-gray-900 dark:text-white mb-4 text-base flex items-center gap-2">
                 <svg class="w-5 h-5 text-[#ee4d2d]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                 Informasi Biaya
               </h3>
               <div class="space-y-4 text-xs text-gray-600 dark:text-gray-300 leading-relaxed text-justify">
                  <p><strong class="text-gray-800 dark:text-gray-100 block mb-0.5 text-sm">1. Angka Unik</strong> Angka acak ini dibuat secara otomatis untuk membantu sistem memverifikasi pembayaran Anda secara instan tanpa perlu konfirmasi manual kasir.</p>
                  <p class="bg-orange-50 dark:bg-orange-900/20 p-2.5 rounded-lg border border-orange-100 dark:border-orange-800/50">
                    <span class="text-[#ee4d2d] font-bold block mb-1">🎁 Poin Cashback!</span>
                    Sebagai member, angka unik ini tidak hangus melainkan dikonversi menjadi saldo poin. Pada pesanan berikutnya, poin ini otomatis digunakan sebagai diskon potongan harga.
                  </p>
                  <p><strong class="text-gray-800 dark:text-gray-100 block mb-0.5 text-sm mt-2">2. Biaya Layanan QRIS (MDR)</strong> Jika nominal transaksi Anda di atas <strong>Rp 500.000 - Rp 999.999</strong>, maka dikenakan MDR Bank sebesar <strong>0.3%</strong>. Untuk transaksi di atas Rp 1.000.000 dikenakan <strong>0.7%</strong>.</p>
               </div>
               <button onclick="document.getElementById('modal-info').classList.replace('flex', 'hidden')" class="mt-6 w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white font-bold py-3.5 rounded-xl hover:bg-gray-200 transition active:scale-95 shadow-sm">Tutup Paham</button>
             </div>
          </div>
        </div>

        {/* BOTTOM NAVIGATION BAR (FIXED) */}
        <div class="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.08)] z-[40]">
          <div class="flex justify-around items-center h-[60px] px-2 pb-safe">
            <a href="/" class="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-[#ee4d2d] transition-colors">
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path></svg>
              <span class="text-[10px] font-semibold">Home</span>
            </a>
            <a href="/promos" class="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-[#ee4d2d] transition-colors">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>
              <span class="text-[10px] font-semibold">Promo</span>
            </a>
            <a href="/cart" class="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-[#ee4d2d] transition-colors relative">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              <span class="text-[10px] font-semibold">Keranjang</span>
            </a>
            <a href="/orders" class="flex flex-col items-center gap-1 text-[#ee4d2d] transition-colors">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
              <span class="text-[10px] font-bold">Order</span>
            </a>
            <a href="/profile" class="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-[#ee4d2d] transition-colors">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
              <span class="text-[10px] font-semibold">Profile</span>
            </a>
          </div>
        </div>

      </div>
    </div>
  , { title: `Detail Pesanan #${orderId.substring(0,8)} - Kedai Pangsit Kembar` })
})
