import { createRoute } from 'honox/factory'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'

// ==========================================
// HANDLER POST: SIMPAN RATING & ULASAN
// ==========================================
export const POST = createRoute(async (c) => {
  const db = c.env.DB;
  const orderId = c.req.param('id');
  const body = await c.req.json();
  const token = getCookie(c, 'token');

  if (!token) return c.json({ success: false, message: 'Sesi tidak valid' }, 401);

  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256');
    const userId = payload.id as string;
    const userName = (payload.name as string) || 'Tamu';

    if (body.action === 'submit_review') {
      await db.prepare(
        `INSERT INTO reviews (id, order_id, user_id, customer_name, rating, comment) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), orderId, userId, userName, body.rating, body.comment).run();
      
      return c.json({ success: true, message: 'Terima kasih atas ulasan Anda!' });
    }
    return c.json({ success: false }, 400);
  } catch (e: any) {
    return c.json({ success: false, message: e.message }, 500);
  }
});

// ==========================================
// RENDER UI: LACAK PESANAN & STRUK
// ==========================================
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

  if (!isUserLoggedIn) return c.redirect('/login');

  const orderId = c.req.param('id');

  const order: any = await c.env.DB.prepare(
    'SELECT * FROM orders WHERE id = ? AND user_id = ?'
  ).bind(orderId, userId).first();

  if (!order) return c.notFound();

  const { results: orderItems } = await c.env.DB.prepare(`
    SELECT od.quantity, od.price, od.note, m.name, m.image as item_image
    FROM order_details od 
    JOIN menu_items m ON od.menu_item_id = m.id 
    WHERE od.order_id = ?
  `).bind(orderId).all();

  const transaction: any = await c.env.DB.prepare(
    'SELECT amount, final_amount, status, raw_qris, unique_code FROM transactions WHERE order_id = ?'
  ).bind(orderId).first();

  // Cek apakah pesanan sudah di-review
  const reviewCheck: any = await c.env.DB.prepare('SELECT id, rating, comment FROM reviews WHERE order_id = ?').bind(orderId).first();
  const isReviewed = !!reviewCheck;

  const formatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
  const orderDate = new Date(order.created_at).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });

  // ==========================================
  // KALKULASI REVERSE ENGINEERING UNTUK FRONTEND
  // ==========================================
  let subtotal = 0;
  let ongkir = 0;

  if (order.order_type === 'VOUCHER') {
      subtotal = order.total_price;
      ongkir = 0;
  } else {
      subtotal = orderItems.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
      ongkir = Math.max(0, order.total_price - subtotal + order.coupon_discount);
  }

  const uniqueCode = transaction ? (transaction.unique_code || 0) : 0;
  
  // MDR Fee = Final Amount - Base Total (total_price) - Unique Code + Points Used
  let mdrFee = 0;
  let finalBayar = order.total_price;
  
  if (transaction) {
      finalBayar = transaction.final_amount;
      mdrFee = Math.max(0, finalBayar - order.total_price - uniqueCode + order.points_used);
  } else if (order.status === 'PROCESSING' || order.status === 'COMPLETED') {
      finalBayar = 0;
      mdrFee = 0; 
  }

  const totalTagihan = order.total_price + mdrFee;

  // ==========================================
  // LOGIKA KDS PROGRESS TRACKER
  // ==========================================
  const isCompleted = order.status === 'COMPLETED';
  const isCanceled = order.status === 'CANCELLED';
  const isPendingCash = order.status === 'PENDING' && order.payment_method === 'CASH';

  let progressStep = 1;
  let progressText = 'Menunggu Pembayaran';
  if (isPendingCash) progressText = 'Menunggu Pembayaran Kasir';
  else if (order.status === 'PROCESSING' || order.status === 'PREPARING') progressText = 'Pesanan Diterima';

  if (order.kitchen_status === 'COOKING') { progressStep = 3; progressText = 'Sedang Dimasak'; }
  if (order.kitchen_status === 'READY') { progressStep = 4; progressText = order.table_id === 'TAKEAWAY' ? 'Siap Diambil di Kasir' : 'Dalam Perjalanan ke Meja'; }
  if (isCompleted) { progressStep = 5; progressText = 'Pesanan Selesai'; }

  return c.render(
    <div class="bg-gray-100 dark:bg-gray-900 min-h-screen font-sans print:bg-white print:min-h-0 relative">
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
            <a href="/orders" class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-200 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
            </a>
            <div>
               <h1 class="text-lg font-black text-gray-900 dark:text-white leading-none">Detail Pesanan</h1>
               <p class="text-[10px] font-bold text-gray-400 mt-0.5 font-mono">#{order.id.substring(0,8)}</p>
            </div>
          </div>
          
          <button onclick="window.print()" class="text-xs font-bold bg-[#ee4d2d]/10 text-[#ee4d2d] px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-[#ee4d2d]/20 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
            Struk
          </button>
        </div>

        {/* PROGRESS TRACKER (KDS INTEGRATION) */}
        {!isCanceled && (
          <div class="bg-white dark:bg-gray-800 p-6 shadow-sm border-b border-gray-100 dark:border-gray-700 mb-2">
             <div class="flex items-center justify-between mb-4">
                <h3 class="font-black text-gray-900 dark:text-white">{progressText}</h3>
                {isPendingCash && <span class="bg-red-50 text-red-600 px-2 py-1 rounded text-[10px] font-bold animate-pulse">Menunggu Pembayaran</span>}
             </div>
             
             {/* Timeline Bar */}
             <div class="relative w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div class={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${isCompleted ? 'bg-green-500' : 'bg-[#ee4d2d]'}`} style={`width: ${(progressStep / 5) * 100}%`}></div>
             </div>
             
             <div class="flex justify-between mt-3 text-[9px] font-bold text-gray-400">
                <span class={progressStep >= 1 ? 'text-[#ee4d2d]' : ''}>Order</span>
                <span class={progressStep >= 3 ? 'text-[#ee4d2d]' : ''}>Dimasak</span>
                <span class={progressStep >= 4 ? 'text-[#ee4d2d]' : ''}>Diantar</span>
                <span class={progressStep >= 5 ? 'text-green-500' : ''}>Selesai</span>
             </div>
          </div>
        )}

        <div class="p-4 space-y-4">
          
          <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 text-center relative overflow-hidden">
            <div class="absolute top-0 left-0 w-full h-1 bg-[#ee4d2d]"></div>
            <div class="flex justify-between items-center mb-3 border-b border-gray-100 dark:border-gray-700 pb-2">
               <span class="text-xs font-bold text-gray-500">Tipe Pesanan</span>
               <span class="text-xs font-black text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{order.order_type}</span>
            </div>
            <div class="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-2 mb-3">
               <span class="text-xs font-bold text-gray-500">Lokasi / Meja</span>
               <span class="text-xs font-black text-[#ee4d2d]">{order.table_id || 'Pengiriman ke Alamat'}</span>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 font-bold mb-1">Status Sistem</p>
            <h2 class="text-2xl font-black text-[#ee4d2d] mb-2">{order.status}</h2>
            <p class="text-xs text-gray-400 mt-3">{orderDate}</p>
          </div>

          <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 class="text-sm font-black text-gray-900 dark:text-white mb-3 border-b border-gray-100 dark:border-gray-700 pb-2">Daftar Menu</h3>
            <div class="space-y-3">
              {orderItems.length === 0 ? (
                <p class="text-xs text-gray-400 italic">{order.order_type === 'VOUCHER' ? 'Pembelian Voucher Digital' : 'Rincian menu sedang disinkronisasi...'}</p>
              ) : orderItems.map((item: any) => (
                <div class="flex justify-between items-start text-sm">
                  <div class="flex gap-2">
                    <span class="font-black text-[#ee4d2d]">{item.quantity}x</span>
                    <div>
                      <p class="font-bold text-gray-800 dark:text-gray-200">{item.name}</p>
                      {item.note && <p class="text-[10px] text-gray-500 mt-0.5">{item.note}</p>}
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
              
              <div class="flex justify-between">
                <span>Subtotal Pesanan</span>
                <span class="font-bold text-gray-800 dark:text-gray-200">{formatter.format(subtotal)}</span>
              </div>
              
              {ongkir > 0 && (
                <div class="flex justify-between">
                  <span>Ongkos Kirim / Layanan</span>
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
            
            {order.notes && (
               <div class="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <p class="text-[10px] font-bold text-gray-500 uppercase mb-1">Catatan Tambahan:</p>
                  <p class="text-xs text-gray-700 dark:text-gray-300 italic">{order.notes}</p>
               </div>
            )}
          </div>

          {transaction && transaction.status === 'UNPAID' && transaction.raw_qris && (
            <div class="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-4 rounded-2xl text-center shadow-sm">
              <h3 class="text-sm font-black text-[#ee4d2d] mb-2">Selesaikan Pembayaran</h3>
              <p class="text-xs text-orange-800 dark:text-orange-200 mb-4">Silakan bayar sejumlah <strong class="font-black">{formatter.format(finalBayar)}</strong> dengan menscan QRIS di bawah ini.</p>
              
              <div class="inline-block p-4 bg-white rounded-2xl shadow-sm border border-orange-100 dark:border-gray-700">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(transaction.raw_qris)}`} 
                  alt="QR Code Pembayaran QRIS" 
                  class="w-48 h-48 object-contain mx-auto mix-blend-multiply"
                />
              </div>

              <div class="mt-4 pt-4 border-t border-orange-200 dark:border-orange-800/50">
                <button onclick="location.reload()" class="w-full bg-[#ee4d2d] text-white font-bold py-3 rounded-xl shadow-md hover:bg-orange-700 transition active:scale-95 flex items-center justify-center gap-2">
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
        <div id="modal-info" class="fixed inset-0 z-[100] hidden justify-center">
          <div class="w-full max-w-md relative flex items-center justify-center h-full p-4">
             <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="document.getElementById('modal-info').classList.replace('flex', 'hidden')"></div>
             <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full relative z-10 shadow-2xl">
               <h3 class="font-black text-gray-900 dark:text-white mb-4 text-sm flex items-center gap-2">
                 <svg class="w-5 h-5 text-[#ee4d2d]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                 Informasi Pembayaran
               </h3>
               <div class="space-y-4 text-xs text-gray-600 dark:text-gray-300 leading-relaxed text-justify">
                  <p><strong class="text-gray-800 dark:text-gray-100 block mb-0.5">1. Angka Unik</strong> Angka ini dibuat secara otomatis untuk mengidentifikasi pembayaran order secara otomatis dan menjadi bagian dari biaya pemrosesan pembayaran.</p>
                  <p class="bg-orange-50 dark:bg-orange-900/20 p-2.5 rounded-lg border border-orange-100 dark:border-orange-800/50">Jika Anda adalah member terdaftar, maka angka unik itu akan menjadi point. Ketika Anda belanja selanjutnya, point itu otomatis akan digunakan sebagai potongan pembayaran.</p>
                  <p><strong class="text-gray-800 dark:text-gray-100 block mb-0.5">2. Biaya Layanan QRIS (MDR)</strong> Jika orderan Anda di atas <strong>Rp 500.000 - Rp 999.999</strong>, maka akan dikenakan MDR sebesar <strong>0.3%</strong> dari total pesanan dan jika di atas itu dikenakan MDR <strong>0.7%</strong> dari nilai total pembayaran.</p>
               </div>
               <button onclick="document.getElementById('modal-info').classList.replace('flex', 'hidden')" class="mt-6 w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white font-bold py-3 rounded-xl hover:bg-gray-200 transition active:scale-95">Tutup Paham</button>
             </div>
          </div>
        </div>

        {/* MODAL RATING (Tampil ketika Selesai) */}
        {isCompleted && !isReviewed && (
          <div id="rating-modal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 transition-opacity">
            <div class="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center transform scale-100 transition-transform">
               <div class="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                 <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
               </div>
               <h2 class="text-xl font-black text-gray-900 dark:text-white mb-2">Pesanan Selesai!</h2>
               <p class="text-xs text-gray-500 dark:text-gray-400 mb-6">Bagaimana kualitas makanan dan pelayanan kami hari ini?</p>
               
               <form onsubmit="event.preventDefault(); submitReview();">
                 <div class="flex justify-center gap-2 mb-6" id="star-container">
                   {[1,2,3,4,5].map(star => (
                     <button type="button" onclick={`setStar(${star})`} class="star-btn text-gray-300 hover:text-yellow-400 focus:outline-none transition-colors" data-val={star}>
                       <svg class="w-10 h-10 fill-current" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                     </button>
                   ))}
                 </div>
                 <input type="hidden" id="rating-value" value="5" />
                 <textarea id="rating-comment" rows={3} placeholder="Ada masukan untuk kami? (Opsional)" class="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-xs focus:outline-none focus:border-[#ee4d2d] resize-none mb-4 text-gray-900 dark:text-white"></textarea>
                 
                 <button type="submit" id="btn-submit-review" class="w-full bg-[#ee4d2d] text-white font-bold py-3.5 rounded-xl shadow-md active:scale-95 transition-transform">Kirim Ulasan</button>
               </form>
               <button onclick="document.getElementById('rating-modal').style.display='none'" class="mt-4 text-[10px] font-bold text-gray-400 hover:underline">Tutup</button>
            </div>
          </div>
        )}

        {/* INFO SUDAH REVIEW */}
        {isReviewed && (
          <div class="px-4 pb-6">
            <div class="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-2xl border border-yellow-100 dark:border-yellow-800 text-center">
               <p class="text-xs font-bold text-yellow-600 dark:text-yellow-500 mb-1">Terima kasih atas ulasannya!</p>
               <div class="flex justify-center text-yellow-400 mb-2">
                 {Array.from({length: reviewCheck.rating}).map(() => <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>)}
               </div>
               {reviewCheck.comment && <p class="text-[10px] text-yellow-700 dark:text-yellow-400 italic">"{reviewCheck.comment}"</p>}
            </div>
          </div>
        )}

      </div>

      {/* 2. STRUK PRINTER THERMAL (UI CETAK) */}
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
            <tr><td colspan="3" style="text-align: center; font-style: italic;">{order.order_type === 'VOUCHER' ? 'Voucher Digital' : '-'}</td></tr>
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
          <tr><td style="padding-bottom: 2px;">Subtotal</td><td style="text-align: right;">{formatter.format(subtotal).replace('Rp', '')}</td></tr>
          {ongkir > 0 && <tr><td style="padding-bottom: 2px;">Ongkir</td><td style="text-align: right;">{formatter.format(ongkir).replace('Rp', '')}</td></tr>}
          {mdrFee > 0 && <tr><td style="padding-bottom: 2px;">MDR</td><td style="text-align: right;">{formatter.format(mdrFee).replace('Rp', '')}</td></tr>}
          {order.coupon_discount > 0 && <tr><td style="padding-bottom: 2px;">Kupon</td><td style="text-align: right;">-{formatter.format(order.coupon_discount).replace('Rp', '')}</td></tr>}
          
          <div class="thermal-border"></div>

          <tr><td style="padding-top: 2px;">Tagihan</td><td style="text-align: right; padding-top: 2px;">{formatter.format(totalTagihan).replace('Rp', '')}</td></tr>
          {order.points_used > 0 && <tr><td style="padding-bottom: 2px;">Pot. Poin</td><td style="text-align: right;">-{formatter.format(order.points_used).replace('Rp', '')}</td></tr>}
          {uniqueCode > 0 && <tr><td style="padding-bottom: 2px;">Kd. Unik</td><td style="text-align: right;">+{uniqueCode}</td></tr>}
          
          <tr>
            <td style="font-size: 13px; padding-top: 4px;">TOT. BAYAR</td>
            <td style="text-align: right; font-size: 13px; padding-top: 4px;">{formatter.format(finalBayar).replace('Rp', '')}</td>
          </tr>
        </table>
        
        <div class="thermal-border" style="margin-top: 8px;"></div>
        
        <div style="text-align: center; margin-top: 10px; font-size: 10px;">
          Terima kasih atas pesanan Anda!<br/>
          <span style="font-style: italic;">Powered by SPOS</span>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
        // Auto-refresh jika pesanan belum selesai/batal agar progress bar berjalan otomatis
        const isFinished = ${isCompleted || isCanceled};
        if (!isFinished) {
           setTimeout(() => { window.location.reload(); }, 15000); // Cek update tiap 15 detik
        }

        // Script Sistem Bintang
        let currentStar = 5;
        function setStar(val) {
           currentStar = val;
           document.getElementById('rating-value').value = val;
           const stars = document.querySelectorAll('.star-btn');
           stars.forEach((s, idx) => {
              if (idx < val) { s.classList.add('text-yellow-400'); s.classList.remove('text-gray-300'); }
              else { s.classList.add('text-gray-300'); s.classList.remove('text-yellow-400'); }
           });
        }
        
        setTimeout(() => setStar(5), 100);

        async function submitReview() {
          const btn = document.getElementById('btn-submit-review');
          btn.disabled = true; btn.innerText = 'Mengirim...';
          
          const payload = {
             action: 'submit_review',
             rating: currentStar,
             comment: document.getElementById('rating-comment').value
          };

          try {
            const res = await fetch('', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
            const data = await res.json();
            if(data.success) {
               document.getElementById('rating-modal').style.display = 'none';
               window.location.reload();
            } else { alert('Gagal mengirim ulasan'); btn.disabled = false; btn.innerText = 'Kirim Ulasan'; }
          } catch(e) { alert('Gangguan jaringan'); btn.disabled = false; btn.innerText = 'Kirim Ulasan'; }
        }
      `}} />

    </div>
  , { title: `Detail Pesanan #${orderId.substring(0,8)} - Kedai Pangsit` })
})
