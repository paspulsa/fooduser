import { createRoute } from 'honox/factory'

export default createRoute(async (c) => {
  // Ambil parameter jika tamu mengakses melalui QR Code Meja atau Link Takeaway
  const tableId = c.req.query('table_id') || '';
  const tableName = c.req.query('table_name') || '';
  const isTakeaway = c.req.query('takeaway') || '';

  // TARIK DATA MEJA DARI DATABASE UNTUK DROPDOWN
  let tables: any[] = [];
  try {
    const res = await c.env.DB.prepare("SELECT id, name, status FROM tables ORDER BY name ASC").all();
    tables = res.results || [];
  } catch (e) {
    console.error("Gagal mengambil data meja:", e);
  }

  let skipUrl = '/';
  if (tableId) {
     skipUrl = `/?table_id=${tableId}&table_name=${encodeURIComponent(tableName)}`;
  } else if (isTakeaway) {
     skipUrl = `/?takeaway=true`;
  }

  const safeTablesJson = JSON.stringify(tables).replace(/</g, '\\u003c');

  return c.render(
    <div class="bg-gray-100 min-h-screen font-sans">
      {/* Dependency SweetAlert untuk Prompt Nomor Meja */}
      <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>

      <div class="max-w-md mx-auto bg-white min-h-screen relative shadow-2xl overflow-x-hidden flex flex-col">
        
        {/* HEADER / BACK BUTTON */}
        <div class="absolute top-0 left-0 w-full p-4 z-10 flex justify-between items-center">
          <a href={skipUrl} class="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors shadow-sm border border-gray-100">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
          </a>
          <a href={skipUrl} class="text-[11px] font-bold text-gray-400 hover:text-[#ee4d2d] transition-colors uppercase tracking-wider">Lewati</a>
        </div>

        {/* ILUSTRASI & TEKS PENYAMBUTAN */}
        <div class="pt-16 px-6 pb-6 bg-gradient-to-b from-orange-50 to-white">
          <div class="w-16 h-16 bg-[#ee4d2d] rounded-2xl shadow-lg shadow-orange-500/30 flex items-center justify-center mb-6 transform -rotate-6">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
          </div>
          <h1 class="text-3xl font-black text-gray-800 tracking-tight leading-tight">Selamat Datang!</h1>
          <p class="text-gray-500 text-sm mt-1.5 font-medium">Masuk untuk menikmati promo, atau pilih mode pesanan cepat di bawah.</p>
        </div>

        {/* FORM LOGIN (UNTUK MEMBER) */}
        <div class="px-6 flex-1 flex flex-col">
          <form id="loginForm" class="space-y-4" onsubmit="event.preventDefault(); submitLogin();">
            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 ml-1">Alamat Email</label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"></path></svg>
                </div>
                <input type="email" id="email" required placeholder="nama@email.com" class="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#ee4d2d] transition-all font-medium placeholder-gray-400" />
              </div>
            </div>

            <div>
              <div class="flex justify-between items-center mb-1.5 mx-1">
                <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide">Kata Sandi</label>
                <a href="#" class="text-[11px] font-bold text-[#ee4d2d] hover:underline">Lupa Sandi?</a>
              </div>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                </div>
                <input type="password" id="password" required placeholder="••••••••" class="w-full pl-11 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#ee4d2d] transition-all font-medium placeholder-gray-400" />
                <button type="button" onclick="togglePassword()" class="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600">
                  <svg id="eye-icon" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                </button>
              </div>
            </div>

            <div class="pt-2">
              <button id="btnSubmit" type="submit" class="w-full bg-[#ee4d2d] text-white font-bold text-sm py-4 rounded-2xl shadow-lg shadow-orange-500/30 hover:bg-orange-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                <span>Masuk Sebagai Member</span>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
              </button>
            </div>
          </form>

          {/* DIVIDER */}
          <div class="mt-8 mb-5 flex items-center justify-center gap-4">
            <div class="h-px bg-gray-200 flex-1"></div>
            <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Atau Pesan Cepat (Tamu)</span>
            <div class="h-px bg-gray-200 flex-1"></div>
          </div>

          {/* PILIHAN MODE PESANAN TAMU (GUEST) */}
          <div class="grid grid-cols-2 gap-3 mb-3">
             <button onclick="setGuestMode('TAKEAWAY')" class="bg-orange-50 border border-orange-100 text-orange-700 hover:bg-orange-100 font-bold py-3.5 rounded-xl shadow-sm active:scale-95 transition-all text-xs flex flex-col items-center justify-center gap-1.5">
                <span class="text-xl">🥡</span> Bawa Pulang
             </button>
             
             {tableId ? (
               <button onclick={`setGuestMode('DINE_IN', '${tableId}', '${tableName.replace(/'/g, "\\'")}')`} class="bg-green-50 border border-green-100 text-green-700 hover:bg-green-100 font-bold py-3.5 rounded-xl shadow-sm active:scale-95 transition-all text-xs flex flex-col items-center justify-center gap-1.5">
                  <span class="text-xl">🍽️</span> Meja: {tableName}
               </button>
             ) : (
               <button onclick="promptTable()" class="bg-blue-50 border border-blue-100 text-blue-700 hover:bg-blue-100 font-bold py-3.5 rounded-xl shadow-sm active:scale-95 transition-all text-xs flex flex-col items-center justify-center gap-1.5">
                  <span class="text-xl">🍽️</span> Makan di Tempat
               </button>
             )}
          </div>
          
          <button onclick="setGuestMode('DELIVERY')" class="w-full bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100 font-bold py-3.5 rounded-xl shadow-sm active:scale-95 transition-all text-xs flex items-center justify-center gap-2 mb-8">
             <span class="text-xl">🛵</span> Pesan Antar (Delivery)
          </button>

          <div class="text-center pb-8 mt-auto border-t border-gray-100 pt-5">
            <p class="text-sm text-gray-500 font-medium">Belum punya akun? <a href="/register" class="text-[#ee4d2d] font-bold hover:underline">Daftar di sini</a></p>
          </div>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
        // Data Meja dari Server
        const DB_TABLES = ${safeTablesJson};

        // URL Parameter untuk disimpan setelah login berhasil
        const P_TABLE_ID = "${tableId}";
        const P_TABLE_NAME = "${tableName.replace(/"/g, '&quot;')}";
        const P_TAKEAWAY = "${isTakeaway}";

        function togglePassword() {
          const input = document.getElementById('password');
          const icon = document.getElementById('eye-icon');
          if (input.type === 'password') {
            input.type = 'text';
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"></path>';
          } else {
            input.type = 'password';
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>';
          }
        }

        function showToast(message, isError = false) {
          const toast = document.createElement('div');
          toast.className = \`fixed top-6 left-1/2 transform -translate-x-1/2 backdrop-blur-md text-white px-5 py-3 rounded-full text-xs font-bold z-[100] shadow-2xl flex items-center gap-2 transition-all duration-300 opacity-0 -translate-y-4 \${isError ? 'bg-red-600/95 border border-red-500' : 'bg-gray-900/95 border border-gray-800'}\`;
          toast.innerHTML = isError 
            ? '<svg class="w-4 h-4 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> ' + message
            : '<svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg> ' + message;
          
          document.body.appendChild(toast);
          setTimeout(() => { toast.classList.remove('opacity-0', '-translate-y-4'); toast.classList.add('opacity-100', 'translate-y-0'); }, 10);
          setTimeout(() => { toast.classList.remove('opacity-100', 'translate-y-0'); toast.classList.add('opacity-0', '-translate-y-4'); setTimeout(() => toast.remove(), 300); }, 3000);
        }

        // --- FUNGSI KLIK GUEST ---
        function setGuestMode(mode, tid = '', tname = '') {
            if (mode === 'TAKEAWAY') {
               localStorage.setItem('spos_takeaway', 'true');
               localStorage.removeItem('spos_table_id');
               localStorage.removeItem('spos_table_name');
            } else if (mode === 'DINE_IN') {
               localStorage.setItem('spos_takeaway', 'false');
               localStorage.setItem('spos_table_id', tid);
               localStorage.setItem('spos_table_name', tname);
            } else {
               // DELIVERY
               localStorage.removeItem('spos_takeaway');
               localStorage.removeItem('spos_table_id');
               localStorage.removeItem('spos_table_name');
            }
            window.location.href = '/';
        }

        function promptTable() {
           // Buat opsi dropdown khusus meja yang IDLE
           let optionsHtml = '';
           let availableCount = 0;
           
           DB_TABLES.forEach(t => {
               if(t.status === 'IDLE') {
                   optionsHtml += \`<option value="\${t.id}">\${t.name}</option>\`;
                   availableCount++;
               }
           });

           if (availableCount === 0) {
               Swal.fire({
                   title: 'Mohon Maaf',
                   text: 'Saat ini semua meja sedang penuh atau belum dibersihkan. Mohon tunggu sebentar.',
                   icon: 'info',
                   confirmButtonColor: '#ee4d2d'
               });
               return;
           }

           Swal.fire({
              title: 'Pilih Meja Anda',
              html: \`
                 <select id="swal-table-select" class="swal2-select w-full max-w-[80%] mx-auto mt-4 p-3 rounded-xl border border-gray-300 focus:outline-none focus:border-[#ee4d2d] text-sm">
                    <option value="" disabled selected>-- Ketuk untuk memilih meja --</option>
                    \${optionsHtml}
                 </select>
              \`,
              showCancelButton: true,
              confirmButtonText: 'Pilih & Pesan',
              cancelButtonText: 'Batal',
              confirmButtonColor: '#ee4d2d',
              preConfirm: () => {
                 const selectEl = document.getElementById('swal-table-select');
                 const val = selectEl.value;
                 if (!val) {
                    Swal.showValidationMessage('Anda harus memilih meja terlebih dahulu!');
                 }
                 return { id: val, name: selectEl.options[selectEl.selectedIndex].text };
              }
           }).then(res => {
              if (res.isConfirmed && res.value) {
                 setGuestMode('DINE_IN', res.value.id, res.value.name);
              }
           });
        }

        async function submitLogin() {
          const btn = document.getElementById('btnSubmit');
          const originalText = btn.innerHTML;
          btn.disabled = true;
          btn.innerHTML = '<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
          
          const email = document.getElementById('email').value;
          const password = document.getElementById('password').value;

          try {
            const res = await fetch('/api/v1/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password, role: 'USER' })
            });
            const data = await res.json();
            
            if (data.success && data.token) {
              document.cookie = \`token=\${data.token}; path=/; max-age=86400; SameSite=Lax\`;
              showToast('Berhasil masuk! Mengalihkan...');
              
              // Simpan preferensi URL ke localStorage sebelum Redirect ke Home
              if (P_TABLE_ID) {
                 localStorage.setItem('spos_takeaway', 'false');
                 localStorage.setItem('spos_table_id', P_TABLE_ID);
                 localStorage.setItem('spos_table_name', P_TABLE_NAME);
              } else if (P_TAKEAWAY === 'true') {
                 localStorage.setItem('spos_takeaway', 'true');
                 localStorage.removeItem('spos_table_id');
                 localStorage.removeItem('spos_table_name');
              }

              setTimeout(() => { window.location.href = '/'; }, 800);
            } else {
              showToast(data.message || 'Email atau password salah!', true);
              btn.disabled = false;
              btn.innerHTML = originalText;
            }
          } catch (e) {
            showToast('Gangguan koneksi ke server.', true);
            btn.disabled = false;
            btn.innerHTML = originalText;
          }
        }
      `}} />
    </div>
  , { title: 'Masuk - SPOS Mobile' })
})
