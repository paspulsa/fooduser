import { createRoute } from 'honox/factory'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'

export default createRoute(async (c) => {
  let userAddress = '';
  let userName = '';
  let userPhone = '';
  let isUserLoggedIn = false;
  let userPoints = 0;
  
  let isGuest = false;
  let guestOrderType = 'DINE_IN';
  let tableId = '';

  const token = getCookie(c, 'token');
  
  if (token) {
    try {
      const payload = await verify(token, c.env.JWT_SECRET, 'HS256');
      if (payload && payload.id) {
        if (payload.role === 'GUEST') {
           isUserLoggedIn = true;
           isGuest = true;
           userName = (payload.name as string) || 'Tamu';
           tableId = (payload.table_id as string) || '';
           guestOrderType = (payload.order_type as string) || 'DINE_IN';
           userAddress = guestOrderType === 'TAKEAWAY' ? 'Bawa Pulang (Takeaway)' : `Makan di Tempat (Meja: ${tableId})`;
           userPoints = 0; 
        } else {
           const user = await c.env.DB.prepare('SELECT name, address, phone FROM users WHERE id = ?').bind(payload.id).first<any>();
           const pts = await c.env.DB.prepare('SELECT balance FROM points WHERE user_id = ?').bind(payload.id).first<any>();
           if (user) {
             isUserLoggedIn = true;
             userName = user.name || '';
             userAddress = user.address || '';
             userPhone = user.phone || '';
             userPoints = pts ? pts.balance : 0;
           }
        }
      }
    } catch (e) {}
  }

  const deliverySettings = await c.env.DB.prepare('SELECT * FROM delivery_settings LIMIT 1').first<any>() || {
    free_range_max: 2, mid_range_max: 3, mid_range_price: 8000, max_range_price: 10000, max_radius_limit: 5, resto_lat: -6.8183497, resto_lng: 107.2972743
  };

  const formatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

  return c.render(
    <div class="bg-gray-100 dark:bg-gray-900 min-h-screen font-sans pb-28">
      <style dangerouslySetInnerHTML={{
        __html: `
          .hide-scrollbar::-webkit-scrollbar { display: none; }
          .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          .pb-safe { padding-bottom: env(safe-area-inset-bottom, 20px); }
        `
      }} />

      <div class="max-w-md mx-auto bg-gray-50 dark:bg-gray-800 min-h-screen relative shadow-2xl overflow-x-hidden transition-colors duration-300">
        
        {/* HEADER */}
        <div class="bg-white dark:bg-gray-800 px-4 pt-6 pb-4 shadow-sm sticky top-0 z-30 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
          <div class="flex items-center gap-3">
            <a href="/" class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-200 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
            </a>
            <h1 class="text-lg font-black text-gray-900 dark:text-white">Keranjang Saya</h1>
          </div>
          <button onclick="clearCart()" class="text-sm font-bold text-[#ee4d2d] hover:underline transition-all">Hapus Semua</button>
        </div>

        {/* INFO PENGIRIMAN / MEJA / TAKEAWAY */}
        <div class="p-4 mt-2">
          {isGuest ? (
             guestOrderType === 'TAKEAWAY' ? (
               <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-purple-100 dark:border-purple-900/30 flex items-start gap-4 relative overflow-hidden">
                  <div class="absolute top-0 left-0 w-1.5 h-full bg-purple-500"></div>
                  <div class="bg-purple-50 dark:bg-purple-900/30 p-2.5 rounded-full text-purple-500 flex-shrink-0 mt-0.5">
                     <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                  </div>
                  <div class="flex-1">
                     <h3 class="text-sm font-black text-gray-900 dark:text-white mb-1">Bawa Pulang (Takeaway)</h3>
                     <p class="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">Nama Pemesan: <span class="text-gray-900 dark:text-white">{userName}</span></p>
                     <div class="inline-block bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-3 py-1.5 rounded-lg text-xs font-bold border border-purple-200 dark:border-purple-800/50">
                        Ambil pesanan di Kasir saat selesai.
                     </div>
                     <input type="hidden" id="cart-address-input" value="Takeaway (Ambil di Kasir)" />
                  </div>
               </div>
             ) : (
               <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-900/30 flex items-start gap-4 relative overflow-hidden">
                  <div class="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
                  <div class="bg-blue-50 dark:bg-blue-900/30 p-2.5 rounded-full text-blue-500 flex-shrink-0 mt-0.5">
                     <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>
                  </div>
                  <div class="flex-1">
                     <h3 class="text-sm font-black text-gray-900 dark:text-white mb-1">Makan di Tempat (Dine-In)</h3>
                     <p class="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">Tamu: <span class="text-gray-900 dark:text-white">{userName}</span></p>
                     <div class="inline-block bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-200 dark:border-blue-800/50">
                        Pesanan akan diantar ke Meja: {tableId}
                     </div>
                     <input type="hidden" id="cart-address-input" value={`Dine-in (Meja: ${tableId})`} />
                  </div>
               </div>
             )
          ) : (
             <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-orange-100 dark:border-gray-700 flex items-start gap-3 relative overflow-hidden">
               <div class="absolute top-0 left-0 w-1.5 h-full bg-[#ee4d2d]"></div>
               <div class="bg-orange-50 dark:bg-[#ee4d2d]/10 p-2 rounded-full text-[#ee4d2d] flex-shrink-0 mt-0.5">
                 <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
               </div>
               <div class="flex-1">
                 <div class="flex justify-between items-center mb-1">
                   <h3 class="text-sm font-black text-gray-900 dark:text-white">Alamat Pengantaran</h3>
                   <button onclick="detectGPSLocation()" class="text-[10px] font-bold text-[#ee4d2d] bg-orange-50 dark:bg-[#ee4d2d]/10 px-2 py-1.5 rounded-lg hover:bg-orange-100 transition-colors shadow-sm active:scale-95" id="btn-gps-refresh">📍 Hitung Jarak</button>
                 </div>
                 <p class="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">{userName}</p>
                 <textarea id="cart-address-input" rows={2} class="w-full text-xs text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 p-2.5 rounded-xl focus:outline-none focus:border-[#ee4d2d] focus:ring-1 focus:ring-[#ee4d2d] resize-none transition-all shadow-inner" placeholder="Ketik alamat lengkap & patokan Anda di sini...">{userAddress}</textarea>
                 
                 <div class="mt-2 text-[10px] font-bold text-orange-500 bg-orange-50 dark:bg-orange-900/30 p-2 rounded-lg border border-orange-100 dark:border-orange-900/50 flex items-center gap-1.5" id="cart-distance-display">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <span>Status Jarak: Silakan klik 'Hitung Jarak'</span>
                 </div>
               </div>
             </div>
          )}
        </div>

        {/* LIST ITEM KERANJANG */}
        <div class="px-4">
          <h3 class="text-sm font-black text-gray-900 dark:text-white mb-3">Pesanan Anda</h3>
          <div id="cart-items-container" class="space-y-4"></div>
        </div>

        <div id="checkout-section">
          <div class="px-4 mt-6">
            <textarea id="order-notes" rows={2} class="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#ee4d2d] transition-colors resize-none shadow-sm" placeholder="Ada pesan tambahan untuk restoran? (Cth: Minta banyakin saus)"></textarea>
          </div>

          {/* OPSI TIPE PESANAN & PEMBAYARAN */}
          <div class="px-4 mt-6">
            <h3 class="text-sm font-black text-gray-900 dark:text-white mb-3">Opsi Pesanan & Pembayaran</h3>
            <div class="space-y-3">
               {!isGuest && (
                 <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">Tipe Pesanan</label>
                    <select id="order-type" onchange="handleOrderTypeChange()" class="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm text-gray-900 dark:text-white font-bold focus:outline-none focus:border-[#ee4d2d]">
                       <option value="DELIVERY">Pesan Antar (Delivery)</option>
                       <option value="TAKEAWAY">Ambil Sendiri (Takeaway)</option>
                    </select>
                 </div>
               )}
               <div>
                  <label class="block text-xs font-bold text-gray-500 mb-1">Metode Pembayaran</label>
                  <select id="payment-method" class="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm text-gray-900 dark:text-white font-bold focus:outline-none focus:border-[#ee4d2d]">
                     <option value="QRIS">Bayar Online (QRIS / E-Wallet)</option>
                     <option value="CASH">Bayar Tunai di Kasir</option>
                  </select>
               </div>
            </div>
          </div>

          <div class="px-4 mt-6">
             <h3 class="text-sm font-black text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
               <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"></path></svg>
               Makin Hemat Pakai Kupon
             </h3>
             <div class="flex gap-2">
                <input type="text" id="coupon-input" class="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm text-gray-900 dark:text-white uppercase focus:outline-none focus:border-[#ee4d2d]" placeholder="Masukkan kode promo" />
                <button onclick="applyCoupon()" id="btn-apply-coupon" class="bg-gray-800 dark:bg-gray-700 text-white font-bold px-5 rounded-xl shadow-sm hover:bg-gray-900 transition-colors">Pakai</button>
             </div>
             <p id="coupon-message" class="text-[11px] font-bold mt-2 hidden"></p>
          </div>

          <div class="px-4 mt-6">
            <h3 class="text-sm font-black text-gray-900 dark:text-white mb-3">Ringkasan Pembayaran</h3>
            <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-3 text-xs font-medium text-gray-600 dark:text-gray-400">
              <div class="flex justify-between">
                <span id="summary-item-count">Subtotal Harga</span>
                <span id="summary-subtotal" class="font-bold text-gray-900 dark:text-white">Rp 0</span>
              </div>
              
              <div class="flex justify-between border-b border-dashed border-gray-200 dark:border-gray-600 pb-3">
                <span id="summary-ongkir-label">Ongkos Kirim {isGuest ? (guestOrderType === 'TAKEAWAY' ? '(Takeaway)' : '(Dine-In)') : ''}</span>
                <span id="summary-ongkir" class="font-bold text-gray-900 dark:text-white">{isGuest ? 'Gratis' : 'Rp 0'}</span>
              </div>
              
              <div id="row-coupon" class="flex justify-between text-green-500 hidden">
                <span id="coupon-label">Potongan Kupon</span>
                <span id="summary-coupon" class="font-bold">- Rp 0</span>
              </div>
              <div id="row-points" class="flex justify-between text-[#ee4d2d] hidden">
                <span>Potongan Saldo Poin Cashback</span>
                <span id="summary-points" class="font-bold">- Rp 0</span>
              </div>

              <div class="flex justify-between pt-1">
                <span class="font-black text-sm text-gray-900 dark:text-white">Total Pembayaran</span>
                <span id="summary-grandtotal" class="font-black text-lg text-[#ee4d2d]">Rp 0</span>
              </div>
            </div>
          </div>

          <div class="fixed bottom-[60px] left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 p-4 z-40 pb-safe">
            <button id="btn-checkout-master" onclick="processCheckout()" class="w-full bg-[#ee4d2d] text-white font-black py-4 rounded-2xl shadow-lg shadow-[#ee4d2d]/30 active:scale-[0.98] transition-transform flex justify-between px-5 items-center disabled:opacity-50 disabled:cursor-not-allowed">
              <span class="text-sm">Pesan & Bayar Sekarang</span>
              <span id="checkout-btn-price" class="text-sm bg-white/20 px-3 py-1 rounded-lg">Rp 0</span>
            </button>
          </div>
        </div>

        {/* BOTTOM NAV */}
        <div class="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.08)] z-[50]">
          <div class="flex justify-around items-center h-[60px] px-2 pb-safe">
            <a href="/" class="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-[#ee4d2d] transition-colors"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path></svg><span class="text-[10px] font-semibold">Home</span></a>
            <a href="/promos" class="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-[#ee4d2d] transition-colors"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg><span class="text-[10px] font-semibold">Promo</span></a>
            <a href="/cart" class="flex flex-col items-center gap-1 text-[#ee4d2d] relative"><div id="nav-cart-badge" class="absolute -top-1 -right-1 bg-[#ee4d2d] text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 hidden">0</div><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg><span class="text-[10px] font-bold">Keranjang</span></a>
            <a href="/orders" class="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-[#ee4d2d] transition-colors"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg><span class="text-[10px] font-semibold">Order</span></a>
            <a href="/profile" class="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-[#ee4d2d] transition-colors"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg><span class="text-[10px] font-semibold">Profile</span></a>
          </div>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: ' \
        const DB_POINTS = ' + userPoints + '; \
        const deliverySettings = ' + JSON.stringify(deliverySettings) + '; \
        const formatter = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }); \
        \
        const IS_GUEST = ' + (isGuest ? 'true' : 'false') + '; \
        const GUEST_ORDER_TYPE = "' + guestOrderType + '"; \
        let isGpsDetected = IS_GUEST ? true : false; \
        let calculatedOngkir = IS_GUEST ? 0 : (deliverySettings.max_range_price || 10000); \
        let isOutOfRange = false; \
        let userLat = 0, userLng = 0; \
        \
        let cart = JSON.parse(localStorage.getItem("spos_cart")) || []; \
        let appliedCouponCode = ""; let discountCouponValue = 0; let discountPointValue = 0; let calculatedSubtotal = 0; \
        \
        function showToast(msg, isError = false) { \
          const toast = document.createElement("div"); \
          toast.className = "fixed bottom-24 left-1/2 transform -translate-x-1/2 backdrop-blur-md text-white text-[11px] font-bold px-5 py-3 rounded-full shadow-2xl z-[100] flex items-center gap-2 transition-all duration-300 opacity-0 translate-y-4 " + (isError ? "bg-red-600" : "bg-gray-900"); \
          toast.innerHTML = msg; document.body.appendChild(toast); \
          setTimeout(() => toast.classList.remove("opacity-0", "translate-y-4"), 10); \
          setTimeout(() => { toast.classList.add("opacity-0", "translate-y-4"); setTimeout(() => toast.remove(), 300); }, 2500); \
        } \
        \
        function calculateDistance(lat1, lon1, lat2, lon2) { \
          const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180; \
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2); \
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); return R * c; \
        } \
        \
        function determineOngkir(distanceKm) { \
          if(distanceKm > deliverySettings.max_radius_limit) return "OUT"; \
          if(distanceKm <= deliverySettings.free_range_max) return 0; \
          if(distanceKm <= deliverySettings.mid_range_max) return deliverySettings.mid_range_price; \
          return deliverySettings.max_range_price; \
        } \
        \
        function handleOrderTypeChange() { \
          const type = document.getElementById("order-type")?.value; \
          if (type === "TAKEAWAY") { \
            calculatedOngkir = 0; isOutOfRange = false; isGpsDetected = true; \
            document.getElementById("cart-distance-display").innerHTML = "<span>Takeaway: Bebas Ongkir (Ambil ke Kasir)</span>"; \
            document.getElementById("cart-distance-display").className = "mt-2 text-[10px] font-bold text-green-600 bg-green-50 p-2 rounded-lg border border-green-200"; \
            document.getElementById("summary-ongkir").innerText = "Gratis"; \
          } else if (type === "DELIVERY" && !IS_GUEST) { \
            isGpsDetected = false; calculatedOngkir = deliverySettings.max_range_price || 10000; \
            document.getElementById("cart-distance-display").innerHTML = "<span>Status Jarak: Silakan klik Hitung Jarak</span>"; \
            document.getElementById("cart-distance-display").className = "mt-2 text-[10px] font-bold text-orange-500 bg-orange-50 p-2 rounded-lg border border-orange-200 flex items-center gap-1.5"; \
            document.getElementById("summary-ongkir").innerText = "Sedang dihitung..."; \
          } \
          calculateGrandTotal(); \
        } \
        \
        function detectGPSLocation() { \
          const btn = document.getElementById("btn-gps-refresh"); \
          const originalText = btn.innerText; btn.innerText = "Melacak..."; btn.disabled = true; \
          if(navigator.geolocation) { \
            navigator.geolocation.getCurrentPosition( \
              (pos) => { \
                userLat = pos.coords.latitude; userLng = pos.coords.longitude; isGpsDetected = true; \
                try { \
                  const restoLat = parseFloat(deliverySettings.resto_lat) || -6.8183497; \
                  const restoLng = parseFloat(deliverySettings.resto_lng) || 107.2972743; \
                  const dist = calculateDistance(restoLat, restoLng, userLat, userLng); \
                  const resultOngkir = determineOngkir(dist); \
                  if (resultOngkir === "OUT") { \
                    isOutOfRange = true; \
                    document.getElementById("cart-distance-display").innerHTML = "<span>Jarak: " + dist.toFixed(1) + "KM (Di luar jangkauan)</span>"; \
                    document.getElementById("cart-distance-display").className = "mt-2 text-[10px] font-bold text-red-500 bg-red-50 p-2 rounded-lg border border-red-200"; \
                    document.getElementById("summary-ongkir-label").innerText = "Ongkos Kirim"; \
                    document.getElementById("summary-ongkir").innerText = "Tidak Tersedia"; \
                    calculatedOngkir = 0; \
                  } else { \
                    isOutOfRange = false; \
                    document.getElementById("cart-distance-display").innerHTML = "<span>Jarak: " + dist.toFixed(1) + "KM (Bisa Dikirim)</span>"; \
                    document.getElementById("cart-distance-display").className = "mt-2 text-[10px] font-bold text-green-600 bg-green-50 p-2 rounded-lg border border-green-200"; \
                    calculatedOngkir = resultOngkir; \
                    document.getElementById("summary-ongkir-label").innerText = "Ongkos Kirim (" + dist.toFixed(1) + "KM)"; \
                    document.getElementById("summary-ongkir").innerText = calculatedOngkir === 0 ? "Gratis" : formatter.format(calculatedOngkir); \
                  } \
                  calculateGrandTotal(); btn.innerText = "Hitung Ulang"; btn.disabled = false; \
                } catch(e) { showToast("Gagal menghitung jarak.", true); btn.innerText = originalText; btn.disabled = false; } \
              }, \
              (err) => { showToast("Akses GPS ditolak!", true); btn.innerText = originalText; btn.disabled = false; }, \
              { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 } \
            ); \
          } else { showToast("GPS tidak didukung perangkat Anda.", true); btn.innerText = originalText; btn.disabled = false; } \
        } \
        \
        async function applyCoupon() { \
           const codeInput = document.getElementById("coupon-input").value.trim(); \
           const msgBox = document.getElementById("coupon-message"); \
           if (!codeInput) return; \
           const btn = document.getElementById("btn-apply-coupon"); btn.disabled = true; btn.innerText = "Cek..."; \
           try { \
             const res = await fetch("/api/v1/public/coupons/validate", { \
               method: "POST", headers: { "Content-Type": "application/json" }, \
               body: JSON.stringify({ code: codeInput, subtotal: calculatedSubtotal }) \
             }); \
             const data = await res.json(); msgBox.classList.remove("hidden"); \
             if(data.success) { \
               appliedCouponCode = data.data.code; discountCouponValue = data.data.discount_amount; \
               msgBox.innerText = "✓ Kupon dipakai!"; msgBox.className = "text-[11px] font-bold mt-2 text-green-500 block"; calculateGrandTotal(); \
             } else { \
               appliedCouponCode = ""; discountCouponValue = 0; \
               msgBox.innerText = "✕ " + data.message; msgBox.className = "text-[11px] font-bold mt-2 text-red-500 block"; calculateGrandTotal(); \
             } \
           } catch(e) { msgBox.innerText = "Gangguan jaringan."; msgBox.className = "text-[11px] font-bold mt-2 text-red-500 block"; } \
           finally { btn.disabled = false; btn.innerText = "Pakai"; } \
        } \
        \
        function saveCart() { localStorage.setItem("spos_cart", JSON.stringify(cart)); renderCart(); } \
        function clearCart() { if(cart.length === 0) return; if(confirm("Yakin ingin mengosongkan keranjang?")) { cart = []; appliedCouponCode = ""; discountCouponValue = 0; document.getElementById("coupon-input").value = ""; document.getElementById("coupon-message").classList.add("hidden"); saveCart(); } } \
        function updateQty(index, delta) { if (cart[index].qty + delta <= 0) { if(confirm("Hapus item ini?")) cart.splice(index, 1); } else { cart[index].qty += delta; } appliedCouponCode = ""; discountCouponValue = 0; document.getElementById("coupon-message").classList.add("hidden"); saveCart(); } \
        \
        function renderCart() { \
          const container = document.getElementById("cart-items-container"); \
          const checkoutSection = document.getElementById("checkout-section"); \
          const badge = document.getElementById("nav-cart-badge"); \
          if (cart.length === 0) { \
            container.innerHTML = "<div class=\\"text-center py-10 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700\\"><div class=\\"text-5xl mb-4\\">🛒</div><h4 class=\\"font-bold text-gray-900 dark:text-white\\">Keranjang masih kosong</h4><a href=\\"/\\" class=\\"mt-5 inline-block bg-[#ee4d2d] text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-orange-500/30\\">Pesan Sekarang</a></div>"; \
            checkoutSection.classList.add("hidden"); if(badge) badge.classList.add("hidden"); return; \
          } \
          checkoutSection.classList.remove("hidden"); \
          let html = ""; calculatedSubtotal = 0; let totalItems = 0; \
          cart.forEach((item, index) => { \
            const unitPrice = item.price + (item.additional_price || 0); const itemTotal = unitPrice * item.qty; \
            calculatedSubtotal += itemTotal; totalItems += item.qty; \
            html += "<div class=\\"bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex gap-3\\"><img src=\\"" + (item.image || 'https://via.placeholder.com/150') + "\\" class=\\"w-16 h-16 rounded-xl object-cover flex-shrink-0\\" /><div class=\\"flex flex-col justify-between flex-1\\"><div><h4 class=\\"text-sm font-bold text-gray-900 dark:text-white leading-tight line-clamp-2\\">" + item.name + "</h4>" + (item.note ? "<p class=\\"text-[10px] text-gray-500 mt-1\\">Pilihan: " + item.note + "</p>" : "") + "</div><div class=\\"flex justify-between items-end mt-2\\"><span class=\\"text-sm font-black text-[#ee4d2d]\\">" + formatter.format(itemTotal) + "</span><div class=\\"flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg px-0.5 border border-gray-200 dark:border-gray-600\\"><button onclick=\\"updateQty(" + index + ", -1)\\" class=\\"w-7 h-7 flex items-center justify-center font-black hover:bg-gray-200 dark:hover:bg-gray-600 rounded-l-lg\\">-</button><span class=\\"w-6 text-center font-black text-xs\\">" + item.qty + "</span><button onclick=\\"updateQty(" + index + ", 1)\\" class=\\"w-7 h-7 flex items-center justify-center text-[#ee4d2d] font-black hover:bg-gray-200 dark:hover:bg-gray-600 rounded-r-lg\\">+</button></div></div></div></div>"; \
          }); \
          container.innerHTML = html; document.getElementById("summary-item-count").innerText = "Subtotal Harga (" + totalItems + " Barang)"; \
          if(badge) { badge.innerText = totalItems; badge.classList.remove("hidden"); } \
          calculateGrandTotal(); \
        } \
        \
        function calculateGrandTotal() { \
          document.getElementById("summary-subtotal").innerText = formatter.format(calculatedSubtotal); \
          let grandTotal = calculatedSubtotal + calculatedOngkir; \
          const masterBtn = document.getElementById("btn-checkout-master"); \
          if(isOutOfRange) { masterBtn.disabled = true; masterBtn.innerHTML = "<span class=\\"text-sm\\">Jarak Terlalu Jauh</span>"; return; } \
          \
          const rowCoupon = document.getElementById("row-coupon"); \
          if (discountCouponValue > 0) { \
             rowCoupon.classList.remove("hidden"); document.getElementById("coupon-label").innerText = "Diskon (" + appliedCouponCode + ")"; \
             document.getElementById("summary-coupon").innerText = "- " + formatter.format(discountCouponValue); grandTotal -= discountCouponValue; \
          } else { rowCoupon.classList.add("hidden"); } \
          \
          const rowPoints = document.getElementById("row-points"); discountPointValue = 0; \
          if (DB_POINTS > 0 && grandTotal > 0) { \
             discountPointValue = Math.min(DB_POINTS, grandTotal); grandTotal -= discountPointValue; \
             rowPoints.classList.remove("hidden"); document.getElementById("summary-points").innerText = "- " + formatter.format(discountPointValue); \
          } else { rowPoints.classList.add("hidden"); } \
          \
          if(grandTotal < 0) grandTotal = 0; document.getElementById("summary-grandtotal").innerText = formatter.format(grandTotal); \
          masterBtn.disabled = false; masterBtn.innerHTML = "<span class=\\"text-sm\\">Pesan & Bayar Sekarang</span><span class=\\"text-sm bg-white/20 px-3 py-1 rounded-lg\\">" + formatter.format(grandTotal) + "</span>"; \
        } \
        \
        async function processCheckout() { \
           if (!isGpsDetected) { showToast("Harap tentukan pesanan (GPS/Takeaway) dengan benar!", true); return; } \
           if (isOutOfRange) { showToast("Maaf, lokasi di luar jangkauan.", true); return; } \
           \
           const addressInput = document.getElementById("cart-address-input").value.trim(); \
           if (!addressInput) { showToast("Mohon lengkapi info alamat / meja!", true); return; } \
           \
           const paymentMethod = document.getElementById("payment-method").value; \
           let orderType = IS_GUEST ? GUEST_ORDER_TYPE : document.getElementById("order-type").value; \
           \
           const btn = document.getElementById("btn-checkout-master"); const originalHtml = btn.innerHTML; \
           btn.innerHTML = "<span class=\\"text-sm\\">Memproses...</span>"; btn.disabled = true; \
           \
           const getCookie = (name) => { const value = "; " + document.cookie; const parts = value.split("; " + name + "="); if (parts.length === 2) return parts.pop().split(";").shift(); }; \
           const token = getCookie("token"); if (!token) { window.location.href = "/login"; return; } \
           \
           const payload = { \
             cart: cart.map(item => ({ id: item.id, qty: item.qty, additional_price: item.additional_price || 0, note: item.note || "" })), \
             coupon_code: appliedCouponCode || null, address: addressInput, notes: document.getElementById("order-notes").value, \
             ongkir: calculatedOngkir, order_type: orderType, payment_method: paymentMethod \
           }; \
           \
           try { \
             const res = await fetch("/api/v1/protected/user/orders/checkout", { \
               method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token }, \
               body: JSON.stringify(payload) \
             }); \
             if (res.status === 401) { window.location.href = "/login"; return; } \
             const data = await res.json(); \
             if (data.success) { \
               localStorage.removeItem("spos_cart"); showToast("Pesanan berhasil dikirim ke dapur!"); \
               setTimeout(() => { window.location.href = "/orders/" + data.data.order_id; }, 1500); \
             } else { showToast(data.message || "Gagal membuat pesanan.", true); } \
           } catch (error) { showToast("Terjadi kesalahan jaringan.", true); } \
           finally { btn.innerHTML = originalHtml; btn.disabled = false; } \
        } \
        \
        document.addEventListener("DOMContentLoaded", () => { renderCart(); }); \
      ' }} />
    </div>
  , { title: 'Keranjang - Kedai Pangsit Kembar 88' })
})
