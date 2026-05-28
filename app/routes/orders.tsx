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
    } catch (e) {
      console.error("JWT Error:", e);
    }
  }

  // Proteksi Halaman: Wajib Login
  if (!isUserLoggedIn) {
    return c.redirect('/users/login');
  }

  let orders: any[] = [];
  
  try {
    // Kueri diperbaiki menggunakan 'total_price'
    const { results } = await c.env.DB.prepare(
      'SELECT id, status, total_price as grand_total, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(userId).all();
    
    orders = results;
  } catch (error) {
    console.error("Gagal menarik data pesanan:", error);
  }

  const formatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

  // Helper Warna Status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'PROCESSING': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'PREPARING': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'DELIVERING': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'COMPLETED': return 'bg-green-100 text-green-700 border-green-200';
      case 'CANCELLED': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING': return 'Menunggu Pembayaran';
      case 'PROCESSING': return 'Sedang Diproses';
      case 'PREPARING': return 'Disiapkan Resto';
      case 'DELIVERING': return 'Dalam Pengantaran';
      case 'COMPLETED': return 'Selesai';
      case 'CANCELLED': return 'Dibatalkan';
      default: return status;
    }
  };

  return c.render(
    <div class="bg-gray-100 dark:bg-gray-900 min-h-screen font-sans pb-24">
      <style dangerouslySetInnerHTML={{
        __html: `
          .hide-scrollbar::-webkit-scrollbar { display: none; }
          .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          .pb-safe { padding-bottom: env(safe-area-inset-bottom, 20px); }
        `
      }} />

      <div class="max-w-md mx-auto bg-gray-50 dark:bg-gray-800 min-h-screen relative shadow-2xl overflow-x-hidden transition-colors duration-300">
        
        {/* HEADER */}
        <div class="bg-white dark:bg-gray-800 px-4 pt-6 pb-4 shadow-sm sticky top-0 z-30 border-b border-gray-100 dark:border-gray-700">
          <h1 class="text-lg font-black text-gray-900 dark:text-white text-center">Riwayat Pesanan</h1>
        </div>

        {/* LIST PESANAN */}
        <div class="p-4 space-y-4">
          {orders.length === 0 ? (
            <div class="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
               <div class="text-5xl mb-4 opacity-50">🧾</div>
               <h4 class="font-bold text-gray-900 dark:text-white">Belum Ada Pesanan</h4>
               <p class="text-xs text-gray-500 mt-1">Pesanan Anda akan muncul di sini.</p>
               <a href="/users" class="mt-5 inline-block bg-[#ee4d2d] text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md">Pesan Sekarang</a>
            </div>
          ) : orders.map((order: any) => (
            <a href={`/users/orders/${order.id}`} class="block bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow active:scale-[0.98] transform relative overflow-hidden group">
              <div class="flex justify-between items-start mb-3">
                <div>
                  <span class="text-[10px] text-gray-400 dark:text-gray-500 font-bold tracking-wider">{new Date(order.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  <h3 class="text-sm font-black text-gray-900 dark:text-white mt-0.5">{order.id}</h3>
                </div>
                <span class={`text-[9px] font-black px-2 py-1 rounded-full border ${getStatusColor(order.status)}`}>
                  {getStatusText(order.status)}
                </span>
              </div>
              <div class="border-t border-dashed border-gray-200 dark:border-gray-700 pt-3 flex justify-between items-center">
                <span class="text-xs text-gray-500 dark:text-gray-400">Total Tagihan</span>
                <span class="text-base font-black text-[#ee4d2d]">{formatter.format(order.grand_total || 0)}</span>
              </div>
              <div class="absolute right-4 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
              </div>
            </a>
          ))}
        </div>

        {/* BOTTOM NAVIGATION BAR */}
        <div class="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.08)] z-[50]">
          <div class="flex justify-around items-center h-[60px] px-2 pb-safe">
            <a href="/users" class="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-[#ee4d2d] transition-colors">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
              <span class="text-[10px] font-semibold">Home</span>
            </a>
            <a href="/users/promos" class="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-[#ee4d2d] transition-colors">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>
              <span class="text-[10px] font-semibold">Promo</span>
            </a>
            <a href="/users/cart" class="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-[#ee4d2d] transition-colors">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              <span class="text-[10px] font-semibold">Keranjang</span>
            </a>
            <a href="/users/orders" class="flex flex-col items-center gap-1 text-[#ee4d2d]">
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"></path><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"></path></svg>
              <span class="text-[10px] font-bold">Order</span>
            </a>
            <a href="/users/profile" class="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-[#ee4d2d] transition-colors">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
              <span class="text-[10px] font-semibold">Profile</span>
            </a>
          </div>
        </div>

      </div>
    </div>
  , { title: 'Riwayat Pesanan - Kedai Pangsit Kembar 88' })
})
