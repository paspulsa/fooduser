import { createRoute } from 'honox/factory'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'

// ==========================================
// 1. API HANDLER (Menerima Form Update & Paginasi JS)
// ==========================================
export const POST = createRoute(async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ success: false, message: 'Harap login.' }, 401);

  let userId = '';
  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256');
    userId = payload.id as string;
  } catch (e) {
    return c.json({ success: false, message: 'Token tidak valid.' }, 401);
  }

  const db = c.env.DB;
  const body = await c.req.json();
  const action = body.action;

  try {
    // A. UPDATE PROFIL
    if (action === 'update_profile') {
      await db.prepare('UPDATE users SET name = ?, phone = ?, address = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(body.name, body.phone, body.address, userId).run();
      return c.json({ success: true, message: 'Profil berhasil diperbarui!' });
    }
    
    // B. UPDATE PASSWORD
    if (action === 'update_password') {
      const user: any = await db.prepare('SELECT password FROM users WHERE id = ?').bind(userId).first();
      // Asumsi menggunakan plain text sesuai skema sederhana awal (Jika pakai bcrypt, sesuaikan logic di sini)
      if (user.password !== body.old_password) {
        return c.json({ success: false, message: 'Password lama salah!' });
      }
      await db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(body.new_password, userId).run();
      return c.json({ success: true, message: 'Password berhasil diganti!' });
    }

    // C. AMBIL RIWAYAT POIN (PAGINASI)
    if (action === 'get_points_history') {
      const page = parseInt(body.page) || 1;
      const limit = 10;
      const offset = (page - 1) * limit;

      // Kueri cerdas menggabungkan transaksi Poin Keluar (Pesanan) dan Poin Masuk (Kode Unik / Kembalian)
      const query = `
        SELECT id as ref, created_at, points_used as amount, 'KELUAR' as type, 'Potongan Pesanan' as description
        FROM orders WHERE user_id = ? AND points_used > 0
        UNION ALL
        SELECT t.order_id as ref, t.created_at, t.unique_code as amount, 'MASUK' as type, 'Cashback Kode Unik' as description
        FROM transactions t JOIN orders o ON t.order_id = o.id
        WHERE o.user_id = ? AND t.unique_code > 0 AND t.status = 'PAID'
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      const history = await db.prepare(query).bind(userId, userId, limit, offset).all();
      
      return c.json({ success: true, data: history.results, page: page });
    }

    return c.json({ success: false, message: 'Aksi tidak dikenali.' }, 400);
  } catch (e: any) {
    return c.json({ success: false, message: 'DB Error: ' + e.message }, 500);
  }
});


// ==========================================
// 2. RENDER UI HALAMAN PROFIL
// ==========================================
export default createRoute(async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.redirect('/users/login'); // Tendang ke login jika belum ada sesi

  let userId = '';
  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256');
    userId = payload.id as string;
  } catch (e) {
    return c.redirect('/users/login');
  }

  const db = c.env.DB;
  
  // Tarik Data Utama User
  const user: any = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  if (!user) return c.redirect('/users/login');

  // Tarik Saldo Poin
  const pts: any = await db.prepare('SELECT balance FROM points WHERE user_id = ?').bind(userId).first();
  const userPoints = pts ? pts.balance : 0;

  // Hitung Voucher Aktif Milik User
  const vch: any = await db.prepare('SELECT COUNT(*) as count FROM coupons WHERE purchaser_id = ? AND is_active = 1 AND used_count = 0').bind(userId).first();
  const activeVouchers = vch ? vch.count : 0;

  const formatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

  return c.render(
    <div class="bg-gray-100 dark:bg-gray-900 min-h-screen font-sans pb-28">
      <style dangerouslySetInnerHTML={{
        __html: `
          .hide-scrollbar::-webkit-scrollbar { display: none; }
          .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          .pb-safe { padding-bottom: env(safe-area-inset-bottom, 20px); }
          .tab-active { border-bottom-color: #ee4d2d; color: #ee4d2d; }
          .tab-inactive { border-bottom-color: transparent; color: #6b7280; }
        `
      }} />

      <div class="max-w-md mx-auto bg-gray-50 dark:bg-gray-800 min-h-screen relative shadow-2xl overflow-x-hidden transition-colors duration-300">
        
        {/* HEADER */}
        <div class="bg-white dark:bg-gray-800 px-4 pt-6 pb-4 shadow-sm sticky top-0 z-30 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
          <div class="flex items-center gap-3">
            <a href="/users" class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-200 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
            </a>
            <h1 class="text-lg font-black text-gray-900 dark:text-white">Profil Saya</h1>
          </div>
          <button onclick="logout()" class="text-xs font-bold text-gray-500 hover:text-red-500 transition-colors">Keluar</button>
        </div>

        {/* HERO CARD (INFO SINGKAT) */}
        <div class="p-4">
          <div class="bg-gradient-to-br from-[#ff7337] to-[#ee4d2d] rounded-2xl p-5 text-white shadow-lg relative overflow-hidden flex items-center gap-4">
            <div class="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full"></div>
            
            <div class="w-16 h-16 rounded-full border-2 border-white/50 overflow-hidden flex-shrink-0 bg-white shadow-inner">
               <img src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}&background=f9f9f9&color=ee4d2d`} class="w-full h-full object-cover" />
            </div>
            <div class="relative z-10 flex-1">
               <h2 class="text-lg font-black leading-tight drop-shadow-sm line-clamp-1">{user.name}</h2>
               <p class="text-xs text-white/80 font-medium mb-3">{user.email}</p>
               
               <div class="flex gap-4">
                  <div class="flex flex-col">
                     <span class="text-[9px] text-white/70 font-bold uppercase tracking-wider">Saldo Poin</span>
                     <span class="text-sm font-black">{formatter.format(userPoints)}</span>
                  </div>
                  <div class="w-px h-6 bg-white/30 self-center"></div>
                  <div class="flex flex-col">
                     <span class="text-[9px] text-white/70 font-bold uppercase tracking-wider">Kupon Aktif</span>
                     <span class="text-sm font-black">{activeVouchers} Kupon</span>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* TAB SWITCHER */}
        <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 mt-2 sticky top-[72px] z-20">
          <div class="flex px-4">
            <button onclick="switchProfTab('diri')" id="btn-tab-diri" class="flex-1 py-3 text-[11px] font-black border-b-2 tab-active transition-colors uppercase tracking-wider">Data Diri</button>
            <button onclick="switchProfTab('sandi')" id="btn-tab-sandi" class="flex-1 py-3 text-[11px] font-black border-b-2 tab-inactive transition-colors dark:text-gray-400 uppercase tracking-wider">Keamanan</button>
            <button onclick="switchProfTab('poin')" id="btn-tab-poin" class="flex-1 py-3 text-[11px] font-black border-b-2 tab-inactive transition-colors dark:text-gray-400 uppercase tracking-wider">Riwayat</button>
          </div>
        </div>

        {/* ==============================================
            TAB 1: DATA DIRI
            ============================================== */}
        <div id="tab-diri" class="p-4 block animate-fade-in space-y-4">
           <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
             <form id="form-profile" onsubmit="handleUpdateProfile(event)">
                <div class="mb-4">
                   <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Nama Lengkap</label>
                   <input type="text" id="prof-name" value={user.name} class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#ee4d2d] text-gray-900 dark:text-white transition-colors" required />
                </div>
                <div class="mb-4">
                   <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Email (Hanya Baca)</label>
                   <input type="email" value={user.email} class="w-full bg-gray-100 dark:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm text-gray-500 dark:text-gray-400 cursor-not-allowed" readonly />
                </div>
                <div class="mb-4">
                   <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Nomor WhatsApp / HP</label>
                   <input type="tel" id="prof-phone" value={user.phone || ''} placeholder="Cth: 081234567890" class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#ee4d2d] text-gray-900 dark:text-white transition-colors" required />
                </div>
                <div class="mb-5">
                   <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Alamat Utama Pengiriman</label>
                   <textarea id="prof-address" rows={3} class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#ee4d2d] text-gray-900 dark:text-white transition-colors resize-none">{user.address || ''}</textarea>
                </div>
                <button type="submit" id="btn-save-prof" class="w-full bg-[#ee4d2d] text-white font-bold py-3 rounded-xl shadow-md active:scale-[0.98] transition-all">
                  Simpan Perubahan
                </button>
             </form>
           </div>
        </div>

        {/* ==============================================
            TAB 2: GANTI PASSWORD
            ============================================== */}
        <div id="tab-sandi" class="p-4 hidden animate-fade-in space-y-4">
           <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
             <form id="form-password" onsubmit="handleUpdatePassword(event)">
                <div class="mb-4">
                   <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Password Lama</label>
                   <input type="password" id="old-pass" class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#ee4d2d] text-gray-900 dark:text-white transition-colors" required />
                </div>
                <div class="mb-4">
                   <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Password Baru</label>
                   <input type="password" id="new-pass" class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#ee4d2d] text-gray-900 dark:text-white transition-colors" required />
                </div>
                <button type="submit" id="btn-save-pass" class="w-full bg-gray-900 dark:bg-gray-700 text-white font-bold py-3 rounded-xl shadow-md active:scale-[0.98] transition-all mt-2">
                  Update Keamanan
                </button>
             </form>
           </div>
        </div>

        {/* ==============================================
            TAB 3: RIWAYAT POIN (PAGINASI JS)
            ============================================== */}
        <div id="tab-poin" class="hidden animate-fade-in">
           <div class="px-4 py-2">
             <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 flex items-start gap-3 mb-4">
                <span class="text-xl">💡</span>
                <p class="text-[10px] text-blue-800 dark:text-blue-300 font-medium">Poin secara otomatis didapatkan dari kembalian kode unik transaksi dan dari sisa kupon yang tidak terpakai utuh.</p>
             </div>
             
             <div id="history-container" class="space-y-3">
                <div class="py-10 text-center text-xs text-gray-400 font-bold">Memuat riwayat...</div>
             </div>

             <div class="flex justify-between items-center mt-6 mb-4">
                <button onclick="changeHistoryPage(-1)" id="btn-prev" class="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold px-4 py-2 rounded-lg text-xs shadow-sm hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all">← Sebelumnya</button>
                <span id="page-indicator" class="text-xs font-black text-gray-700 dark:text-gray-300">Halaman 1</span>
                <button onclick="changeHistoryPage(1)" id="btn-next" class="bg-[#ee4d2d] text-white font-bold px-4 py-2 rounded-lg text-xs shadow-sm hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all">Selanjutnya →</button>
             </div>
           </div>
        </div>

        {/* =========================================================
            BOTTOM NAVIGATION BAR (FIXED)
            ========================================================= */}
        <div class="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.08)] z-[50]">
          <div class="flex justify-around items-center h-[60px] px-2 pb-safe">
            <a href="/users" class="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-[#ee4d2d] transition-colors"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path></svg><span class="text-[10px] font-semibold">Home</span></a>
            <a href="/users/promos" class="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-[#ee4d2d] transition-colors"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg><span class="text-[10px] font-semibold">Promo</span></a>
            <a href="/users/cart" class="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-[#ee4d2d] transition-colors relative">
               <div id="nav-cart-badge" class="absolute -top-1 -right-1 bg-[#ee4d2d] text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 hidden">0</div>
               <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg><span class="text-[10px] font-semibold">Keranjang</span>
            </a>
            <a href="/users/orders" class="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-[#ee4d2d] transition-colors"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg><span class="text-[10px] font-semibold">Order</span></a>
            <a href="/users/profile" class="flex flex-col items-center gap-1 text-[#ee4d2d]"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path></svg><span class="text-[10px] font-bold">Profile</span></a>
          </div>
        </div>

      </div>

      {/* SCRIPT CLIENT-SIDE LOGIC MENGGUNAKAN PENGGABUNGAN STRING KLASIK (ANTI-ERROR) */}
      <script dangerouslySetInnerHTML={{ __html: ' \
        const formatter = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }); \
        let currentPage = 1; \
        let isHistoryLoaded = false; \
        \
        function showToast(msg, isError = false) { \
          const toast = document.createElement("div"); \
          toast.className = "fixed bottom-24 left-1/2 transform -translate-x-1/2 backdrop-blur-md text-white text-[11px] font-bold px-5 py-3 rounded-full shadow-2xl z-[150] flex items-center gap-2 transition-all duration-300 opacity-0 translate-y-4 border " + (isError ? "bg-red-600/95 border-red-500" : "bg-gray-900/95 border-gray-800"); \
          toast.innerHTML = isError ? "<svg class=\\"w-4 h-4 text-red-300\\" fill=\\"none\\" stroke=\\"currentColor\\" viewBox=\\"0 0 24 24\\"><path stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z\\"></path></svg> " + msg : "<svg class=\\"w-4 h-4 text-green-400\\" fill=\\"none\\" stroke=\\"currentColor\\" viewBox=\\"0 0 24 24\\"><path stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"3\\" d=\\"M5 13l4 4L19 7\\"></path></svg> " + msg; \
          document.body.appendChild(toast); \
          setTimeout(() => toast.classList.remove("opacity-0", "translate-y-4"), 10); \
          setTimeout(() => { toast.classList.add("opacity-0", "translate-y-4"); setTimeout(() => toast.remove(), 300); }, 2500); \
        } \
        \
        function switchProfTab(tab) { \
           document.getElementById("tab-diri").classList.add("hidden"); \
           document.getElementById("tab-sandi").classList.add("hidden"); \
           document.getElementById("tab-poin").classList.add("hidden"); \
           document.getElementById("btn-tab-diri").className = "flex-1 py-3 text-[11px] font-black border-b-2 tab-inactive transition-colors dark:text-gray-400 uppercase tracking-wider"; \
           document.getElementById("btn-tab-sandi").className = "flex-1 py-3 text-[11px] font-black border-b-2 tab-inactive transition-colors dark:text-gray-400 uppercase tracking-wider"; \
           document.getElementById("btn-tab-poin").className = "flex-1 py-3 text-[11px] font-black border-b-2 tab-inactive transition-colors dark:text-gray-400 uppercase tracking-wider"; \
           \
           document.getElementById("tab-"+tab).classList.remove("hidden"); \
           document.getElementById("btn-tab-"+tab).className = "flex-1 py-3 text-[11px] font-black border-b-2 tab-active transition-colors uppercase tracking-wider"; \
           \
           if(tab === "poin" && !isHistoryLoaded) { fetchPointsHistory(1); isHistoryLoaded = true; } \
        } \
        \
        async function handleUpdateProfile(e) { \
           e.preventDefault(); \
           const btn = document.getElementById("btn-save-prof"); \
           btn.innerText = "Menyimpan..."; btn.disabled = true; \
           try { \
             const res = await fetch("/users/profile", { \
                method: "POST", headers: {"Content-Type": "application/json"}, \
                body: JSON.stringify({ \
                   action: "update_profile", \
                   name: document.getElementById("prof-name").value, \
                   phone: document.getElementById("prof-phone").value, \
                   address: document.getElementById("prof-address").value \
                }) \
             }); \
             const data = await res.json(); \
             showToast(data.message, !data.success); \
           } catch(err) { showToast("Gangguan jaringan", true); } \
           finally { btn.innerText = "Simpan Perubahan"; btn.disabled = false; } \
        } \
        \
        async function handleUpdatePassword(e) { \
           e.preventDefault(); \
           const btn = document.getElementById("btn-save-pass"); \
           btn.innerText = "Memeriksa..."; btn.disabled = true; \
           try { \
             const res = await fetch("/users/profile", { \
                method: "POST", headers: {"Content-Type": "application/json"}, \
                body: JSON.stringify({ \
                   action: "update_password", \
                   old_password: document.getElementById("old-pass").value, \
                   new_password: document.getElementById("new-pass").value \
                }) \
             }); \
             const data = await res.json(); \
             showToast(data.message, !data.success); \
             if(data.success) { \
                document.getElementById("old-pass").value = ""; \
                document.getElementById("new-pass").value = ""; \
             } \
           } catch(err) { showToast("Gangguan jaringan", true); } \
           finally { btn.innerText = "Update Keamanan"; btn.disabled = false; } \
        } \
        \
        function formatDateTime(val) { \
           const d = typeof val === "number" ? new Date(val * 1000) : new Date(val); \
           return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }); \
        } \
        \
        async function fetchPointsHistory(page) { \
           const container = document.getElementById("history-container"); \
           const btnPrev = document.getElementById("btn-prev"); \
           const btnNext = document.getElementById("btn-next"); \
           const indicator = document.getElementById("page-indicator"); \
           \
           container.innerHTML = "<div class=\\"py-10 text-center text-xs text-gray-400 font-bold animate-pulse\\">Mengambil data...</div>"; \
           btnPrev.disabled = true; btnNext.disabled = true; \
           \
           try { \
             const res = await fetch("/users/profile", { \
                method: "POST", headers: {"Content-Type": "application/json"}, \
                body: JSON.stringify({ action: "get_points_history", page: page }) \
             }); \
             const json = await res.json(); \
             if(json.success) { \
                currentPage = json.page; \
                indicator.innerText = "Halaman " + currentPage; \
                \
                if(json.data.length === 0) { \
                   container.innerHTML = "<div class=\\"py-10 text-center text-xs text-gray-400 font-bold border border-dashed border-gray-200 dark:border-gray-700 rounded-xl\\">" + (currentPage === 1 ? "Belum ada riwayat poin." : "Tidak ada riwayat lebih lanjut.") + "</div>"; \
                   if(currentPage > 1) btnPrev.disabled = false; \
                   return; \
                } \
                \
                let html = ""; \
                json.data.forEach(item => { \
                   const isKeluar = item.type === "KELUAR"; \
                   const icon = isKeluar ? "<div class=\\"w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-500\\"><svg class=\\"w-4 h-4\\" fill=\\"none\\" stroke=\\"currentColor\\" viewBox=\\"0 0 24 24\\"><path stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M19 14l-7 7m0 0l-7-7m7 7V3\\"></path></svg></div>" : "<div class=\\"w-8 h-8 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center text-green-500\\"><svg class=\\"w-4 h-4\\" fill=\\"none\\" stroke=\\"currentColor\\" viewBox=\\"0 0 24 24\\"><path stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M5 10l7-7m0 0l7 7m-7-7v18\\"></path></svg></div>"; \
                   const sign = isKeluar ? "-" : "+"; \
                   const colorClass = isKeluar ? "text-gray-900 dark:text-white" : "text-green-600 dark:text-green-400"; \
                   \
                   html += "<div class=\\"bg-white dark:bg-gray-800 p-3.5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center\\">"; \
                   html += "<div class=\\"flex items-center gap-3\\">" + icon; \
                   html += "<div><p class=\\"text-xs font-bold text-gray-900 dark:text-white\\">" + item.description + "</p>"; \
                   html += "<p class=\\"text-[10px] text-gray-400\\">" + formatDateTime(item.created_at) + " &bull; " + item.ref + "</p></div></div>"; \
                   html += "<div class=\\"font-black text-sm " + colorClass + "\\">" + sign + formatter.format(item.amount) + "</div>"; \
                   html += "</div>"; \
                }); \
                container.innerHTML = html; \
                \
                if(currentPage > 1) btnPrev.disabled = false; \
                if(json.data.length === 10) btnNext.disabled = false; \
             } \
           } catch(err) { \
              container.innerHTML = "<div class=\\"py-10 text-center text-xs text-red-500 font-bold\\">Gagal memuat jaringan.</div>"; \
              btnPrev.disabled = false; btnNext.disabled = false; \
           } \
        } \
        \
        function changeHistoryPage(delta) { \
           const targetPage = currentPage + delta; \
           if(targetPage >= 1) fetchPointsHistory(targetPage); \
        } \
        \
        function logout() { \
          document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"; \
          window.location.href = "/users/login"; \
        } \
        \
        document.addEventListener("DOMContentLoaded", () => { \
           let cart = JSON.parse(localStorage.getItem("spos_cart")) || []; \
           let totalItems = 0; cart.forEach(i => { totalItems += i.qty; }); \
           const badge = document.getElementById("nav-cart-badge"); \
           if(badge && totalItems > 0) { badge.innerText = totalItems; badge.classList.remove("hidden"); } \
        }); \
      ' }} />
    </div>
  , { title: 'Profil Saya - Kedai Pangsit Kembar 88' })
})
