import { createRoute } from 'honox/factory'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'

export default createRoute(async (c) => {
  let userAddress = '';
  let userName = '';
  let userPhone = '';
  let isUserLoggedIn = false;
  let userPoints = 0;

  const token = getCookie(c, 'token');
  
  if (token) {
    try {
      const payload = await verify(token, c.env.JWT_SECRET, 'HS256');
      if (payload && payload.id) {
        // Tarik profil user
        const user = await c.env.DB.prepare('SELECT name, address, phone FROM users WHERE id = ?').bind(payload.id).first<any>();
        
        // Tarik saldo point user (Jika kosong, defaults to 0)
        const pts = await c.env.DB.prepare('SELECT balance FROM points WHERE user_id = ?').bind(payload.id).first<any>();
        
        if (user) {
          isUserLoggedIn = true;
          userName = user.name || '';
          userAddress = user.address || '';
          userPhone = user.phone || '';
          userPoints = pts ? pts.balance : 0;
        }
      }
    } catch (e) {}
  }

  // Tarik Pengaturan Ongkos Kirim & Lokasi Resto
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
        
        {/* HEADER KERANJANG */}
        <div class="bg-white dark:bg-gray-800 px-4 pt-6 pb-4 shadow-sm sticky top-0 z-30 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
          <div class="flex items-center gap-3">
            <a href="/users" class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-200 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
            </a>
            <h1 class="text-lg font-black text-gray-900 dark:text-white">Keranjang Saya</h1>
          </div>
          <button onclick="clearCart()" class="text-sm font-bold text-[#ee4d2d] hover:underline transition-all">Hapus Semua</button>
        </div>

        {/* ALAMAT PENGANTARAN */}
        <div class="p-4 mt-2">
          <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-orange-100 dark:border-gray-700 flex items-start gap-3 relative overflow-hidden">
            <div class="absolute top-0 left-0 w-1.5 h-full bg-[#ee4d2d]"></div>
            <div class="bg-orange-50 dark:bg-[#ee4d2d]/10 p-2 rounded-full text-[#ee4d2d] flex-shrink-0 mt-0.5">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            </div>
            <div class="flex-1">
              <div class="flex justify-between items-center mb-1">
                <h3 class="text-sm font-black text-gray-900 dark:text-white">Alamat Pengantaran</h3>
                <button onclick="detectGPSLocation()" class="text-[11px] font-bold text-[#ee4d2d] bg-orange-50 dark:bg-[#ee4d2d]/10 px-2 py-1 rounded hover:bg-orange-100 transition-colors" id="btn-gps-refresh">Deteksi GPS</button>
              </div>
              <p class="text-xs font-bold text-gray-700 dark:text-gray-300 mb-0.5">{userName || 'Tamu'}</p>
              <p class="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed" id="cart-address-display">
                {userAddress || 'Ketuk deteksi GPS untuk menghitung ongkir...'}
              </p>
              <div class="mt-2 text-[10px] font-bold text-orange-500 bg-orange-50 dark:bg-orange-900/30 p-1.5 rounded" id="cart-distance-display">
                 Status Jarak: Belum Dihitung
              </div>
            </div>
          </div>
        </div>

        {/* LIST ITEM KERANJANG */}
        <div class="px-4">
          <h3 class="text-sm font-black text-gray-900 dark:text-white mb-3">Pesanan Anda</h3>
          <div id="cart-items-container" class="space-y-4"></div>
        </div>

        {/* BUNGKUSAN CHECKOUT */}
        <div id="checkout-section">
          {/* CATATAN TAMBAHAN UNTUK RESTO */}
          <div class="px-4 mt-6">
            <textarea id="order-notes" rows={2} class="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#ee4d2d] transition-colors resize-none shadow-sm" placeholder="Ada pesan tambahan untuk restoran? (Cth: Minta banyakin saus)"></textarea>
          </div>

          {/* WIDGET KUPON & VOUCHER */}
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

          {/* RINGKASAN PEMBAYARAN */}
          <div class="px-4 mt-6">
            <h3 class="text-sm font-black text-gray-900 dark:text-white mb-3">Ringkasan Pembayaran</h3>
            <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-3 text-xs font-medium text-gray-600 dark:text-gray-400">
              <div class="flex justify-between">
                <span id="summary-item-count">Subtotal Harga</span>
                <span id="summary-subtotal" class="font-bold text-gray-900 dark:text-white">Rp 0</span>
              </div>
              
              <div class="flex justify-between border-b border-dashed border-gray-200 dark:border-gray-600 pb-3">
                <span id="summary-ongkir-label">Ongkos Kirim (Sedang dihitung)</span>
                <span id="summary-ongkir" class="font-bold text-gray-900 dark:text-white">Rp 0</span>
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
              <span class="text-sm">Pesan & Antar Sekarang</span>
              <span id="checkout-btn-price" class="text-sm bg-white/20 px-3 py-1 rounded-lg">Rp 0</span>
            </button>
          </div>
        </div>

        {/* BOTTOM NAVIGATION BAR (FIXED) */}
        <div class="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.08)] z-[50]">
          <div class="flex justify-around items-center h-[60px] px-2 pb-safe">
            <a href="/users" class="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-[#ee4d2d] transition-colors">
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path></svg>
              <span class="text-[10px] font-semibold">Home</span>
            </a>
            <a href="/users/promos" class="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-[#ee4d2d] transition-colors">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>
              <span class="text-[10px] font-semibold">Promo</span>
            </a>
            <a href="/users/cart" class="flex flex-col items-center gap-1 text-[#ee4d2d] relative">
              <div id="nav-cart-badge" class="absolute -top-1 -right-1 bg-[#ee4d2d] text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 hidden">0</div>
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              <span class="text-[10px] font-bold">Keranjang</span>
            </a>
            <a href="/users/orders" class="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-[#ee4d2d] transition-colors">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
              <span class="text-[10px] font-semibold">Order</span>
            </a>
            <a href="/users/profile" class="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-[#ee4d2d] transition-colors">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
              <span class="text-[10px] font-semibold">Profile</span>
            </a>
          </div>
        </div>

      </div>

      <script dangerouslySetInnerHTML={{ __html: `
        const DB_ADDRESS = \`${userAddress}\`;
        const DB_POINTS = ${userPoints};
        const deliverySettings = ${JSON.stringify(deliverySettings)};
        const formatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
        
        let calculatedOngkir = 10000;
        let isOutOfRange = false;
        let userLat = 0, userLng = 0;

        let cart = JSON.parse(localStorage.getItem('spos_cart')) || [];
        
        let appliedCouponCode = '';
        let discountCouponValue = 0;
        let discountPointValue = 0;
        let calculatedSubtotal = 0;

        function showToast(msg, isError = false) {
          const toast = document.createElement('div');
          toast.className = \`fixed bottom-24 left-1/2 transform -translate-x-1/2 backdrop-blur-md text-white text-[11px] font-bold px-5 py-3 rounded-full shadow-2xl z-[100] flex items-center gap-2 transition-all duration-300 opacity-0 translate-y-4 \${isError ? 'bg-red-600' : 'bg-gray-900'}\`;
          toast.innerHTML = msg;
          document.body.appendChild(toast);
          setTimeout(() => toast.classList.remove('opacity-0', 'translate-y-4'), 10);
          setTimeout(() => { toast.classList.add('opacity-0', 'translate-y-4'); setTimeout(() => toast.remove(), 300); }, 2500);
        }

        // --- HAVERSINE LOKASI ---
        function calculateDistance(lat1, lon1, lat2, lon2) {
          const R = 6371; 
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLon = (lon2 - lon1) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          return R * c; 
        }

        function determineOngkir(distanceKm) {
          if(distanceKm > deliverySettings.max_radius_limit) return 'OUT';
          if(distanceKm <= deliverySettings.free_range_max) return 0;
          if(distanceKm <= deliverySettings.mid_range_max) return deliverySettings.mid_range_price;
          return deliverySettings.max_range_price;
        }

        function detectGPSLocation() {
          const btn = document.getElementById('btn-gps-refresh');
          const originalText = btn.innerText;
          btn.innerText = 'Melacak...';
          btn.disabled = true;

          if(navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              async (pos) => {
                userLat = pos.coords.latitude;
                userLng = pos.coords.longitude;
                
                try {
                  const res = await fetch(\`https://nominatim.openstreetmap.org/reverse?format=json&lat=\${userLat}&lon=\${userLng}&zoom=16\`);
                  const data = await res.json();
                  
                  let streetName = "Lokasi Tidak Diketahui";
                  if (data && data.address) {
                     streetName = data.address.road || data.address.town || data.address.village || data.address.suburb || data.display_name.split(',')[0];
                  }
                  
                  document.getElementById('cart-address-display').innerText = streetName;
                  
                  const restoLat = parseFloat(deliverySettings.resto_lat) || -6.8183497;
                  const restoLng = parseFloat(deliverySettings.resto_lng) || 107.2972743;
                  
                  const dist = calculateDistance(restoLat, restoLng, userLat, userLng);
                  const resultOngkir = determineOngkir(dist);

                  if (resultOngkir === 'OUT') {
                    isOutOfRange = true;
                    document.getElementById('cart-distance-display').innerText = \`Jarak: \${dist.toFixed(1)}KM (Di luar jangkauan pengiriman)\`;
                    document.getElementById('cart-distance-display').classList.replace('text-orange-500', 'text-red-500');
                    document.getElementById('summary-ongkir-label').innerText = 'Ongkos Kirim';
                    document.getElementById('summary-ongkir').innerText = 'Tidak Tersedia';
                    calculatedOngkir = 0;
                  } else {
                    isOutOfRange = false;
                    document.getElementById('cart-distance-display').innerText = \`Jarak: \${dist.toFixed(1)}KM (Masuk jangkauan)\`;
                    document.getElementById('cart-distance-display').classList.replace('text-red-500', 'text-orange-500');
                    calculatedOngkir = resultOngkir;
                    document.getElementById('summary-ongkir-label').innerText = \`Ongkos Kirim (\${dist.toFixed(1)}KM)\`;
                    document.getElementById('summary-ongkir').innerText = calculatedOngkir === 0 ? 'Gratis' : formatter.format(calculatedOngkir);
                  }
                  
                  calculateGrandTotal();
                  btn.innerText = 'Deteksi Ulang';
                  btn.disabled = false;
                } catch(e) {
                   showToast('Gagal memuat alamat GPS.', true);
                   btn.innerText = originalText; btn.disabled = false;
                }
              }, 
              (err) => {
                showToast('Akses GPS ditolak, harap izinkan dari browser!', true);
                btn.innerText = originalText; btn.disabled = false;
              }
            );
          } else {
            showToast('GPS tidak didukung oleh perangkat.', true);
            btn.innerText = originalText; btn.disabled = false;
          }
        }

        async function applyCoupon() {
           const codeInput = document.getElementById('coupon-input').value.trim();
           const msgBox = document.getElementById('coupon-message');
           
           if (!codeInput) return;

           const btn = document.getElementById('btn-apply-coupon');
           btn.disabled = true;
           btn.innerText = 'Cek...';

           try {
             const res = await fetch('/api/v1/public/coupons/validate', {
               method: 'POST', headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ code: codeInput, subtotal: calculatedSubtotal })
             });
             const data = await res.json();
             msgBox.classList.remove('hidden');

             if(data.success) {
               appliedCouponCode = data.data.code;
               discountCouponValue = data.data.discount_amount;
               msgBox.innerText = '✓ Kupon berhasil dipakai!';
               msgBox.className = "text-[11px] font-bold mt-2 text-green-500 block";
               calculateGrandTotal();
             } else {
               appliedCouponCode = '';
               discountCouponValue = 0;
               msgBox.innerText = '✕ ' + data.message;
               msgBox.className = "text-[11px] font-bold mt-2 text-red-500 block";
               calculateGrandTotal();
             }
           } catch(e) {
             msgBox.innerText = 'Gangguan jaringan. Coba lagi.';
             msgBox.className = "text-[11px] font-bold mt-2 text-red-500 block";
           } finally {
             btn.disabled = false;
             btn.innerText = 'Pakai';
           }
        }

        function saveCart() {
          localStorage.setItem('spos_cart', JSON.stringify(cart));
          renderCart();
        }

        function clearCart() {
          if(cart.length === 0) return;
          if(confirm('Apakah Anda yakin ingin mengosongkan keranjang?')) {
            cart = []; appliedCouponCode = ''; discountCouponValue = 0;
            document.getElementById('coupon-input').value = '';
            document.getElementById('coupon-message').classList.add('hidden');
            saveCart();
          }
        }

        function updateQty(index, delta) {
          if (cart[index].qty + delta <= 0) {
            if(confirm('Hapus item ini dari keranjang?')) cart.splice(index, 1);
          } else {
            cart[index].qty += delta;
          }
          appliedCouponCode = ''; discountCouponValue = 0;
          document.getElementById('coupon-message').classList.add('hidden');
          saveCart();
        }

        function renderCart() {
          const container = document.getElementById('cart-items-container');
          const checkoutSection = document.getElementById('checkout-section');
          const badge = document.getElementById('nav-cart-badge');

          if (cart.length === 0) {
            container.innerHTML = \`
              <div class="text-center py-10 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                 <div class="text-5xl mb-4">🛒</div>
                 <h4 class="font-bold text-gray-900 dark:text-white">Keranjang masih kosong</h4>
                 <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Yuk, cari makanan lezat sekarang!</p>
                 <a href="/users" class="mt-5 inline-block bg-[#ee4d2d] text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-orange-500/30 hover:bg-orange-700 transition-colors">Mulai Pesan</a>
              </div>
            \`;
            checkoutSection.classList.add('hidden');
            if(badge) badge.classList.add('hidden');
            return;
          }

          checkoutSection.classList.remove('hidden');
          
          let html = '';
          calculatedSubtotal = 0;
          let totalItems = 0;

          cart.forEach((item, index) => {
            // PERBAIKAN: Hitung harga dasar ditambah harga opsi custom
            const unitPrice = item.price + (item.additional_price || 0);
            const itemTotal = unitPrice * item.qty;
            
            calculatedSubtotal += itemTotal;
            totalItems += item.qty;

            html += \`
              <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex gap-3 relative transition-all">
                <img src="\${item.image || 'https://via.placeholder.com/150'}" class="w-16 h-16 rounded-xl object-cover border border-gray-100 dark:border-gray-600 flex-shrink-0" />
                <div class="flex flex-col justify-between flex-1">
                  <div>
                    <h4 class="text-sm font-bold text-gray-900 dark:text-white leading-tight line-clamp-2">\${item.name}</h4>
                    \${item.note ? \`<p class="text-[10px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">Pilihan: \${item.note}</p>\` : ''}
                  </div>
                  <div class="flex justify-between items-end mt-2">
                    <span class="text-sm font-black text-[#ee4d2d]">\${formatter.format(itemTotal)}</span>
                    <div class="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg px-0.5 border border-gray-200 dark:border-gray-600">
                      <button onclick="updateQty(\${index}, -1)" class="w-7 h-7 flex items-center justify-center text-gray-600 dark:text-gray-300 font-black text-lg hover:bg-gray-200 dark:hover:bg-gray-600 rounded-l-lg transition">-</button>
                      <span class="w-6 text-center font-black text-xs text-gray-900 dark:text-white">\${item.qty}</span>
                      <button onclick="updateQty(\${index}, 1)" class="w-7 h-7 flex items-center justify-center text-[#ee4d2d] font-black text-lg hover:bg-gray-200 dark:hover:bg-gray-600 rounded-r-lg transition">+</button>
                    </div>
                  </div>
                </div>
              </div>
            \`;
          });

          container.innerHTML = html;
          document.getElementById('summary-item-count').innerText = \`Subtotal Harga (\${totalItems} Barang)\`;
          
          if(badge) {
            badge.innerText = totalItems;
            badge.classList.remove('hidden');
          }

          calculateGrandTotal();
        }

        function calculateGrandTotal() {
          document.getElementById('summary-subtotal').innerText = formatter.format(calculatedSubtotal);
          
          let grandTotal = calculatedSubtotal + calculatedOngkir;
          const masterBtn = document.getElementById('btn-checkout-master');

          if(isOutOfRange) {
             masterBtn.disabled = true;
             masterBtn.innerHTML = '<span class="text-sm">Jarak Terlalu Jauh</span>';
             return;
          }

          const rowCoupon = document.getElementById('row-coupon');
          if (discountCouponValue > 0) {
             rowCoupon.classList.remove('hidden');
             document.getElementById('coupon-label').innerText = \`Diskon (\${appliedCouponCode})\`;
             document.getElementById('summary-coupon').innerText = \`- \${formatter.format(discountCouponValue)}\`;
             grandTotal -= discountCouponValue;
          } else {
             rowCoupon.classList.add('hidden');
          }

          const rowPoints = document.getElementById('row-points');
          discountPointValue = 0;
          if (DB_POINTS > 0 && grandTotal > 0) {
             discountPointValue = Math.min(DB_POINTS, grandTotal);
             grandTotal -= discountPointValue;
             rowPoints.classList.remove('hidden');
             document.getElementById('summary-points').innerText = \`- \${formatter.format(discountPointValue)}\`;
          } else {
             rowPoints.classList.add('hidden');
          }

          if(grandTotal < 0) grandTotal = 0;

          document.getElementById('summary-grandtotal').innerText = formatter.format(grandTotal);
          masterBtn.disabled = false;
          masterBtn.innerHTML = \`<span class="text-sm">Pesan & Antar Sekarang</span><span class="text-sm bg-white/20 px-3 py-1 rounded-lg">\${formatter.format(grandTotal)}</span>\`;
        }

        async function processCheckout() {
           if(isOutOfRange) {
              showToast('Maaf, lokasi Anda di luar batas pengiriman.', true);
              return;
           }

           const btn = document.getElementById('btn-checkout-master');
           const originalHtml = btn.innerHTML;
           btn.innerHTML = '<span class="text-sm">Memproses...</span>';
           btn.disabled = true;

           const getCookie = (name) => {
             const value = "; " + document.cookie;
             const parts = value.split("; " + name + "=");
             if (parts.length === 2) return parts.pop().split(";").shift();
           };
           const token = getCookie('token');

           if (!token) {
               window.location.href = '/users/login';
               return;
           }

           const address = document.getElementById('cart-address-display').innerText;
           const notes = document.getElementById('order-notes').value;
           
           const payload = {
             cart: cart.map(item => ({
               id: item.id,
               qty: item.qty,
               additional_price: item.additional_price || 0,
               note: item.note || ''
             })),
             coupon_code: appliedCouponCode || null,
             address: address,
             notes: notes,
             ongkir: calculatedOngkir
           };

           try {
             const res = await fetch('/api/v1/protected/user/orders/checkout', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
               body: JSON.stringify(payload)
             });
             
             if (res.status === 401) {
                 window.location.href = '/users/login';
                 return;
             }

             const data = await res.json();
             if (data.success) {
               localStorage.removeItem('spos_cart');
               showToast('Pesanan berhasil dibuat!');
               setTimeout(() => { window.location.href = '/users/orders/' + data.data.order_id; }, 1500);
             } else {
               showToast(data.message || 'Gagal membuat pesanan.', true);
             }
           } catch (error) {
             showToast('Terjadi kesalahan jaringan.', true);
           } finally {
             btn.innerHTML = originalHtml;
             btn.disabled = false;
           }
        }
        
        document.addEventListener('DOMContentLoaded', () => { renderCart(); });
      `}} />
    </div>
  , { title: 'Keranjang - Kedai Pangsit Kembar 88' })
})
