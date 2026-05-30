import { jsxRenderer } from 'hono/jsx-renderer'

export default jsxRenderer(({ children, title }) => {
  return (
    <html lang="id">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <title>{title || 'Kedai Pangsit Kembar 88'}</title>
        
        {/* PWA Tags Khusus Pengguna Publik */}
        <link rel="manifest" href="/manifest-user.json" />
        <meta name="theme-color" content="#ee4d2d" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        
        <script src="https://cdn.tailwindcss.com"></script>
        
        <script dangerouslySetInnerHTML={{
          __html: `
            tailwind.config = {
              theme: {
                extend: {
                  colors: { primary: '#ee4d2d' }
                }
              }
            }
          `
        }} />
      </head>
      <body class="bg-gray-50 text-gray-900 font-sans antialiased selection:bg-[#ee4d2d] selection:text-white pb-safe">
        
        {children}

        {/* =========================================================
            PWA INSTALL BANNER (MUNCUL MENGAMBANG DI BAWAH)
            ========================================================= */}
        <div id="pwa-install-banner" class="fixed bottom-[80px] left-1/2 transform -translate-x-1/2 w-[90%] max-w-sm bg-gray-900 text-white p-3 rounded-2xl shadow-2xl flex items-center justify-between z-[100] transition-transform duration-500 translate-y-40 hidden border border-gray-700">
           <div class="flex items-center gap-3">
              <div class="bg-[#ee4d2d] p-2 rounded-xl text-white shadow-inner flex-shrink-0">
                 <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              </div>
              <div class="pr-2">
                 <p class="text-[11px] font-bold leading-snug">Install Pangsit Kembar 88 di HP anda.</p>
                 <p class="text-[9px] text-gray-300 mt-0.5 font-medium">Akses lebih cepat & tanpa browser!</p>
              </div>
           </div>
           
           <button id="pwa-install-btn" class="bg-[#ee4d2d] hover:bg-orange-700 text-white text-[11px] font-black px-4 py-2.5 rounded-xl shadow-md transition-transform active:scale-95 flex-shrink-0">
             Install
           </button>
           
           {/* Tombol Silang (Close) */}
           <button id="pwa-dismiss-btn" class="absolute -top-2 -right-2 bg-gray-800 text-gray-400 rounded-full p-1.5 border border-gray-600 shadow-md hover:text-white hover:bg-gray-700 transition-colors">
             <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>
           </button>
        </div>

        {/* LOGIKA PWA & SERVICE WORKER */}
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

          // Browser menembakkan event ini jika aplikasi memenuhi syarat di-install
          window.addEventListener('beforeinstallprompt', (e) => {
            // Cegah banner bawaan browser yang jelek muncul
            e.preventDefault();
            // Simpan event untuk kita picu nanti
            deferredPrompt = e;
            
            // Munculkan Banner Custom (Slide-up Animasi)
            installBanner.classList.remove('hidden');
            setTimeout(() => {
              installBanner.classList.remove('translate-y-40');
            }, 100);
          });

          // Saat User Klik Tombol Install di Banner Kita
          installBtn.addEventListener('click', async () => {
            // Sembunyikan banner perlahan
            installBanner.classList.add('translate-y-40');
            setTimeout(() => { installBanner.classList.add('hidden'); }, 500);
            
            if (deferredPrompt) {
               // Tampilkan prompt instalasi HP bawaan Android/OS
               deferredPrompt.prompt();
               const { outcome } = await deferredPrompt.userChoice;
               if (outcome === 'accepted') {
                 console.log('PWA berhasil di-install');
               }
               deferredPrompt = null;
            }
          });

          // Saat User Klik Tombol Silang (X)
          dismissBtn.addEventListener('click', () => {
            installBanner.classList.add('translate-y-40');
            setTimeout(() => { installBanner.classList.add('hidden'); }, 500);
          });

          // Jika aplikasi sukses diinstal, pastikan banner hilang permanen
          window.addEventListener('appinstalled', () => {
            installBanner.classList.add('hidden');
            deferredPrompt = null;
          });
        `}} />

      </body>
    </html>
  )
})
