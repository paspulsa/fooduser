import { jsxRenderer } from 'hono/jsx-renderer'

export default jsxRenderer(({ children, title }) => {
  return (
    <html lang="id">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <title>{title || 'Kedai Pangsit Kembar 88'}</title>
        
        {/* PWA Tags untuk Aplikasi Pengguna */}
        <link rel="manifest" href="/manifest-user.json" />
        <meta name="theme-color" content="#ee4d2d" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <script src="https://cdn.tailwindcss.com"></script>
        
        <style dangerouslySetInnerHTML={{
          __html: `
            body { font-family: 'Inter', sans-serif; -webkit-tap-highlight-color: transparent; }
            .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `
        }} />
        
        <script dangerouslySetInnerHTML={{
          __html: `
            tailwind.config = {
              darkMode: 'class',
              theme: {
                extend: {
                  colors: {
                    primary: '#ee4d2d',
                  }
                }
              }
            }
          `
        }} />
      </head>
      <body class="bg-gray-100 antialiased selection:bg-[#ee4d2d] selection:text-white">
        
        {children}

        {/* =========================================================
            PWA INSTALL BANNER (MUNCUL DI BAWAH)
            ========================================================= */}
        <div id="pwa-install-banner" class="fixed bottom-[80px] left-1/2 transform -translate-x-1/2 w-[90%] max-w-sm bg-gray-900 text-white p-3 rounded-2xl shadow-2xl flex items-center justify-between z-[100] transition-transform duration-500 translate-y-40 hidden">
           <div class="flex items-center gap-3">
              <div class="bg-[#ee4d2d] p-2 rounded-xl text-white shadow-inner flex-shrink-0">
                 <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              </div>
              <div class="pr-2">
                 <p class="text-[11px] font-bold leading-snug">Install Pangsit Kembar 88 di HP anda.</p>
                 <p class="text-[9px] text-gray-300 mt-0.5 font-medium">Lebih cepat, hemat kuota & tanpa buka browser</p>
              </div>
           </div>
           <button id="pwa-install-btn" class="bg-[#ee4d2d] hover:bg-orange-700 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-md transition-transform active:scale-95 flex-shrink-0 border border-orange-500/50">
             Install
           </button>
           
           {/* Tombol Close */}
           <button id="pwa-dismiss-btn" class="absolute -top-2 -right-2 bg-gray-800 text-gray-400 rounded-full p-1.5 border border-gray-600 shadow-md hover:text-white hover:bg-gray-700 transition-colors">
             <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>
           </button>
        </div>

        {/* Script PWA & Service Worker */}
        <script dangerouslySetInnerHTML={{ __html: `
          // 1. Registrasi Service Worker
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => { 
               navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW Reg Failed', err)); 
            });
          }

          // 2. Logika Banner Install PWA
          let deferredPrompt;
          const installBanner = document.getElementById('pwa-install-banner');
          const installBtn = document.getElementById('pwa-install-btn');
          const dismissBtn = document.getElementById('pwa-dismiss-btn');

          window.addEventListener('beforeinstallprompt', (e) => {
            // Mencegah mini-infobar bawaan browser muncul
            e.preventDefault();
            
            // Simpan event untuk dipicu saat tombol diklik
            deferredPrompt = e;
            
            // Tampilkan Banner Custom kita (Animasi muncul dari bawah)
            installBanner.classList.remove('hidden');
            // Sedikit delay agar transisi CSS jalan
            setTimeout(() => {
              installBanner.classList.remove('translate-y-40');
            }, 100);
          });

          // Aksi ketika tombol Install diklik
          installBtn.addEventListener('click', async () => {
            // Sembunyikan banner
            installBanner.classList.add('translate-y-40');
            setTimeout(() => { installBanner.classList.add('hidden'); }, 500);
            
            if (deferredPrompt) {
               // Tampilkan prompt instalasi native dari Browser
               deferredPrompt.prompt();
               // Tunggu respon pengguna (Di-install atau batal)
               const { outcome } = await deferredPrompt.userChoice;
               if (outcome === 'accepted') {
                 console.log('User menginstall PWA Pangsit Kembar 88');
               }
               // Reset prompt
               deferredPrompt = null;
            }
          });

          // Aksi ketika tombol silang (Tutup) diklik
          dismissBtn.addEventListener('click', () => {
            installBanner.classList.add('translate-y-40');
            setTimeout(() => { installBanner.classList.add('hidden'); }, 500);
          });

          // Sembunyikan banner secara permanen di sesi tersebut jika PWA berhasil terinstal 
          window.addEventListener('appinstalled', () => {
            installBanner.classList.add('hidden');
            deferredPrompt = null;
          });
        `}} />

      </body>
    </html>
  )
})
