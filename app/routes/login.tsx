import { createRoute } from 'honox/factory'

export default createRoute(async (c) => {
  const { results: availableTables } = await c.env.DB.prepare("SELECT id, name FROM tables WHERE status = 'IDLE' ORDER BY name ASC").all();

  return c.render(
    <div class="bg-gray-100 min-h-screen font-sans">
      <div class="max-w-md mx-auto bg-white min-h-screen relative shadow-2xl flex flex-col">
        
        <div class="absolute top-0 left-0 w-full p-4 z-10 flex justify-between items-center">
          <a href="/" class="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors shadow-sm border border-gray-100">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
          </a>
        </div>

        <div class="pt-20 px-6 pb-6 bg-gradient-to-b from-orange-50 to-white flex-shrink-0">
          <div class="w-16 h-16 bg-[#ee4d2d] rounded-2xl shadow-lg shadow-orange-500/30 flex items-center justify-center mb-6 transform -rotate-6">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
          </div>
          <h1 class="text-3xl font-black text-gray-800 tracking-tight leading-tight">Makan Apa<br/>Hari Ini?</h1>
          <p class="text-gray-500 text-sm mt-2 font-medium">Pilih cara pesan yang paling nyaman untukmu.</p>
        </div>

        <div class="px-6 flex w-full mb-6 flex-shrink-0">
            <button onclick="switchMode('member')" id="tab-member" class="flex-1 pb-3 text-sm font-black border-b-2 border-[#ee4d2d] text-[#ee4d2d] transition-colors">Pelanggan Member</button>
            <button onclick="switchMode('guest')" id="tab-guest" class="flex-1 pb-3 text-sm font-black border-b-2 border-transparent text-gray-400 hover:text-gray-600 transition-colors">Pesan Cepat (Guest)</button>
        </div>

        <div class="px-6 flex-1 flex flex-col relative w-full overflow-y-auto hide-scrollbar pb-6">
          
          {/* MODE 1: MEMBER LOGIN */}
          <div id="form-member-container" class="flex flex-col flex-1 w-full animate-fade-in">
            <form id="loginForm" class="space-y-4" onsubmit="event.preventDefault(); submitLogin();">
              <div>
                <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 ml-1">Alamat Email</label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"></path></svg></div>
                  <input type="email" id="email" required placeholder="nama@email.com" class="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-800 focus:bg-white focus:outline-none focus:border-[#ee4d2d] transition-all font-medium placeholder-gray-400" />
                </div>
              </div>
              <div>
                <div class="flex justify-between items-center mb-1.5 mx-1">
                  <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide">Kata Sandi</label>
                </div>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg></div>
                  <input type="password" id="password" required placeholder="••••••••" class="w-full pl-11 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-800 focus:bg-white focus:outline-none focus:border-[#ee4d2d] transition-all font-medium placeholder-gray-400" />
                  <button type="button" onclick="togglePassword()" class="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"><svg id="eye-icon" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg></button>
                </div>
              </div>
              <div class="pt-2">
                <button id="btnSubmit" type="submit" class="w-full bg-[#ee4d2d] text-white font-bold text-sm py-4 rounded-2xl shadow-lg shadow-orange-500/30 hover:bg-orange-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                  <span>Masuk Akun</span><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                </button>
              </div>
            </form>
            <div class="mt-6 flex items-center justify-center gap-4">
              <div class="h-px bg-gray-200 flex-1"></div><span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Baru Pertama Kali?</span><div class="h-px bg-gray-200 flex-1"></div>
            </div>
            <div class="pt-4 mt-auto">
               <a href="/register" class="w-full bg-orange-50 text-[#ee4d2d] border border-orange-200 font-bold text-sm py-3.5 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-orange-100">Daftar Menjadi Member</a>
            </div>
          </div>

          {/* MODE 2: GUEST / PESAN CEPAT */}
          <div id="form-guest-container" class="hidden flex-col flex-1 w-full animate-fade-in">
             <form id="guestForm" class="space-y-4" onsubmit="event.preventDefault(); submitGuestSession();">
              
              <div class="flex gap-3 mb-2">
                 <label class="flex-1 cursor-pointer">
                    <input type="radio" name="guest_order_type" value="DINE_IN" checked onchange="toggleGuestTable(this.value)" class="peer sr-only" />
                    <div class="text-center py-3 rounded-xl border-2 border-gray-100 peer-checked:border-[#ee4d2d] peer-checked:bg-orange-50 peer-checked:text-[#ee4d2d] text-gray-500 font-bold text-xs transition-all">🍽️ Makan di Tempat</div>
                 </label>
                 <label class="flex-1 cursor-pointer">
                    <input type="radio" name="guest_order_type" value="TAKEAWAY" onchange="toggleGuestTable(this.value)" class="peer sr-only" />
                    <div class="text-center py-3 rounded-xl border-2 border-gray-100 peer-checked:border-[#ee4d2d] peer-checked:bg-orange-50 peer-checked:text-[#ee4d2d] text-gray-500 font-bold text-xs transition-all">🛍️ Bawa Pulang</div>
                 </label>
              </div>

              <div>
                <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 ml-1">Nama Panggilan</label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg></div>
                  <input type="text" id="guestName" required placeholder="Cth: Budi" class="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-800 focus:bg-white focus:outline-none focus:border-[#ee4d2d] transition-all font-medium placeholder-gray-400" />
                </div>
              </div>

              <div id="table-selection-block">
                <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 ml-1">Pilih Nomor Meja</label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg></div>
                  <select id="guestTable" class="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-800 focus:bg-white focus:outline-none focus:border-[#ee4d2d] transition-all font-bold appearance-none cursor-pointer">
                     <option value="" disabled selected>-- Pilih Meja Kosong --</option>
                     {availableTables.length === 0 ? (
                        <option disabled>Semua meja sedang penuh/dipesan</option>
                     ) : availableTables.map((t: any) => (
                        <option value={t.id}>{t.name}</option>
                     ))}
                  </select>
                  <div class="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none"><svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path></svg></div>
                </div>
              </div>

              <div class="pt-4 mt-auto">
                <button id="btnGuest" type="submit" class="w-full bg-[#ee4d2d] text-white font-bold text-sm py-4 rounded-2xl shadow-lg shadow-orange-500/30 hover:bg-orange-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                  <span>Mulai Pesan</span><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                </button>
              </div>
             </form>
          </div>

        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: ' \
        function switchMode(mode) { \
           const formMember = document.getElementById("form-member-container"); \
           const formGuest = document.getElementById("form-guest-container"); \
           const tabMember = document.getElementById("tab-member"); \
           const tabGuest = document.getElementById("tab-guest"); \
           if(mode === "member") { \
              formGuest.classList.add("hidden"); formGuest.classList.remove("flex"); \
              formMember.classList.remove("hidden"); formMember.classList.add("flex"); \
              tabMember.className = "flex-1 pb-3 text-sm font-black border-b-2 border-[#ee4d2d] text-[#ee4d2d] transition-colors"; \
              tabGuest.className = "flex-1 pb-3 text-sm font-black border-b-2 border-transparent text-gray-400 hover:text-gray-600 transition-colors"; \
           } else { \
              formMember.classList.add("hidden"); formMember.classList.remove("flex"); \
              formGuest.classList.remove("hidden"); formGuest.classList.add("flex"); \
              tabGuest.className = "flex-1 pb-3 text-sm font-black border-b-2 border-[#ee4d2d] text-[#ee4d2d] transition-colors"; \
              tabMember.className = "flex-1 pb-3 text-sm font-black border-b-2 border-transparent text-gray-400 hover:text-gray-600 transition-colors"; \
           } \
        } \
        \
        function toggleGuestTable(type) { \
           const tableBlock = document.getElementById("table-selection-block"); \
           if (type === "TAKEAWAY") { \
              tableBlock.style.display = "none"; \
              document.getElementById("guestTable").required = false; \
           } else { \
              tableBlock.style.display = "block"; \
              document.getElementById("guestTable").required = true; \
           } \
        } \
        \
        function togglePassword() { \
          const input = document.getElementById("password"); \
          const icon = document.getElementById("eye-icon"); \
          if (input.type === "password") { \
            input.type = "text"; \
            icon.innerHTML = "<path stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18\\"></path>"; \
          } else { \
            input.type = "password"; \
            icon.innerHTML = "<path stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M15 12a3 3 0 11-6 0 3 3 0 016 0z\\"></path><path stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z\\"></path>"; \
          } \
        } \
        \
        function showToast(message, isError = false) { \
          const toast = document.createElement("div"); \
          toast.className = "fixed top-6 left-1/2 transform -translate-x-1/2 backdrop-blur-md text-white px-5 py-3 rounded-full text-xs font-bold z-[100] shadow-2xl flex items-center gap-2 transition-all duration-300 opacity-0 -translate-y-4 " + (isError ? "bg-red-600/95 border border-red-500" : "bg-gray-900/95 border border-gray-800"); \
          toast.innerHTML = isError ? "<svg class=\\"w-4 h-4 text-red-300\\" fill=\\"none\\" stroke=\\"currentColor\\" viewBox=\\"0 0 24 24\\"><path stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z\\"></path></svg> " + message : "<svg class=\\"w-4 h-4 text-green-400\\" fill=\\"none\\" stroke=\\"currentColor\\" viewBox=\\"0 0 24 24\\"><path stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"3\\" d=\\"M5 13l4 4L19 7\\"></path></svg> " + message; \
          document.body.appendChild(toast); \
          setTimeout(() => { toast.classList.remove("opacity-0", "-translate-y-4"); toast.classList.add("opacity-100", "translate-y-0"); }, 10); \
          setTimeout(() => { toast.classList.remove("opacity-100", "translate-y-0"); toast.classList.add("opacity-0", "-translate-y-4"); setTimeout(() => toast.remove(), 300); }, 3000); \
        } \
        \
        async function submitLogin() { \
          const btn = document.getElementById("btnSubmit"); \
          const originalText = btn.innerHTML; \
          btn.disabled = true; btn.innerHTML = "<svg class=\\"animate-spin h-5 w-5 text-white\\" xmlns=\\"http://www.w3.org/2000/svg\\" fill=\\"none\\" viewBox=\\"0 0 24 24\\"><circle class=\\"opacity-25\\" cx=\\"12\\" cy=\\"12\\" r=\\"10\\" stroke=\\"currentColor\\" stroke-width=\\"4\\"></circle><path class=\\"opacity-75\\" fill=\\"currentColor\\" d=\\"M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z\\"></path></svg>"; \
          try { \
            const res = await fetch("/api/v1/auth/login", { \
              method: "POST", headers: { "Content-Type": "application/json" }, \
              body: JSON.stringify({ email: document.getElementById("email").value, password: document.getElementById("password").value }) \
            }); \
            const data = await res.json(); \
            if (data.success && data.token) { \
              document.cookie = "token=" + data.token + "; path=/; max-age=86400; SameSite=Lax"; \
              showToast("Berhasil masuk! Mengalihkan..."); \
              setTimeout(() => { window.location.href = "/"; }, 800); \
            } else { \
              showToast(data.message || "Email atau password salah!", true); \
              btn.disabled = false; btn.innerHTML = originalText; \
            } \
          } catch (e) { \
            showToast("Gangguan koneksi.", true); btn.disabled = false; btn.innerHTML = originalText; \
          } \
        } \
        \
        async function submitGuestSession() { \
           const btn = document.getElementById("btnGuest"); \
           const originalText = btn.innerHTML; \
           btn.disabled = true; btn.innerHTML = "Memproses..."; \
           \
           const guestName = document.getElementById("guestName").value; \
           const orderType = document.querySelector("input[name=\\"guest_order_type\\"]:checked").value; \
           const tableId = document.getElementById("guestTable") ? document.getElementById("guestTable").value : ""; \
           \
           try { \
             const res = await fetch("/api/v1/auth/guest-login", { \
               method: "POST", headers: { "Content-Type": "application/json" }, \
               body: JSON.stringify({ guest_name: guestName, table_id: tableId, order_type: orderType }) \
             }); \
             const data = await res.json(); \
             if (data.success && data.token) { \
               document.cookie = "token=" + data.token + "; path=/; max-age=43200; SameSite=Lax"; \
               showToast("Sesi berhasil dibuat!"); \
               setTimeout(() => { window.location.href = "/"; }, 800); \
             } else { \
               showToast(data.message || "Gagal membuat sesi.", true); \
               btn.disabled = false; btn.innerHTML = originalText; \
             } \
           } catch (e) { \
             showToast("Gangguan koneksi.", true); btn.disabled = false; btn.innerHTML = originalText; \
           } \
        } \
      ' }} />
    </div>
  , { title: 'Masuk / Pesan Cepat - Kedai Pangsit Kembar 88' })
})
