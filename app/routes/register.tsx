import { createRoute } from 'honox/factory'

export default createRoute((c) => {
  return c.render(
    <div class="bg-gray-100 min-h-screen font-sans">
      <div class="max-w-md mx-auto bg-white min-h-screen relative shadow-2xl overflow-hidden flex flex-col">
        
        {/* HEADER / BACK BUTTON */}
        <div class="absolute top-0 left-0 w-full p-4 z-10 flex justify-between items-center bg-white/80 backdrop-blur-md">
          <a href="/users/login" class="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors shadow-sm border border-gray-100">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
          </a>
          <h2 class="font-bold text-gray-800 text-sm">Daftar Akun Baru</h2>
          <div class="w-10"></div> {/* Spacer untuk keseimbangan flex */}
        </div>

        {/* KONTEN FORM */}
        <div class="pt-20 px-6 pb-6 overflow-y-auto flex-1">
          <div class="mb-8">
            <h1 class="text-2xl font-black text-gray-800 tracking-tight leading-tight">Mulai Perjalanan Kulinermu</h1>
            <p class="text-gray-500 text-xs mt-1.5 font-medium leading-relaxed">Lengkapi data diri di bawah ini untuk memudahkan proses pemesanan dan pengantaran.</p>
          </div>

          <form id="registerForm" class="space-y-4" onsubmit="event.preventDefault(); submitRegister();">
            <div>
              <label class="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5 ml-1">Nama Lengkap</label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                </div>
                <input type="text" id="name" required placeholder="Budi Santoso" class="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#ee4d2d] transition-all font-medium placeholder-gray-400" />
              </div>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5 ml-1">Alamat Email</label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                </div>
                <input type="email" id="email" required placeholder="budi@email.com" class="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#ee4d2d] transition-all font-medium placeholder-gray-400" />
              </div>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5 ml-1">Nomor WhatsApp / HP</label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span class="text-sm font-bold text-gray-500">+62</span>
                </div>
                <input type="tel" id="phone" required placeholder="81234567890" class="w-full pl-14 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#ee4d2d] transition-all font-medium placeholder-gray-400" />
              </div>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5 ml-1">Buat Kata Sandi</label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                </div>
                <input type="password" id="password" required minlength={6} placeholder="Minimal 6 karakter" class="w-full pl-11 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#ee4d2d] transition-all font-medium placeholder-gray-400" />
                <button type="button" onclick="togglePassword()" class="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600">
                  <svg id="eye-icon" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                </button>
              </div>
            </div>

            <div class="pt-6">
              <button id="btnSubmit" type="submit" class="w-full bg-[#ee4d2d] text-white font-bold text-sm py-4 rounded-xl shadow-lg shadow-orange-500/30 hover:bg-orange-700 active:scale-[0.98] transition-all">
                Buat Akun Baru
              </button>
              <p class="text-[10px] text-center text-gray-400 mt-3 font-medium">Dengan mendaftar, Anda menyetujui Syarat Ketentuan dan Kebijakan Privasi kami.</p>
            </div>
          </form>

          <div class="text-center pb-8 mt-10">
            <p class="text-sm text-gray-500 font-medium">Sudah punya akun? <a href="/users/login" class="text-[#ee4d2d] font-bold hover:underline">Masuk</a></p>
          </div>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
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

        async function submitRegister() {
          const btn = document.getElementById('btnSubmit');
          const originalText = btn.innerHTML;
          btn.disabled = true;
          btn.innerHTML = '<svg class="animate-spin h-5 w-5 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
          
          const name = document.getElementById('name').value;
          const email = document.getElementById('email').value;
          const phone = '0' + document.getElementById('phone').value; // Menggabungkan format +62/0 dengan input
          const password = document.getElementById('password').value;

          try {
            const res = await fetch('/api/v1/auth/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              // Data disesuaikan dengan struktur tabel users yang Anda tentukan sebelumnya
              body: JSON.stringify({ name, email, password, phone, role: 'USER' }) 
            });
            const data = await res.json();
            
            if (data.success || res.ok) {
              showToast('Pendaftaran sukses! Silakan masuk.');
              setTimeout(() => { window.location.href = '/users/login'; }, 1500);
            } else {
              showToast(data.message || 'Email mungkin sudah terdaftar.', true);
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
  , { title: 'Daftar - SPOS Mobile' })
})
