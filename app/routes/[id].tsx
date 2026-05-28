import { createRoute } from 'honox/factory'

export default createRoute(async (c) => {
  const restoId = c.req.param('id');

  // 1. Ambil Data Gerai
  const resto = await c.env.DB.prepare('SELECT * FROM restaurants WHERE id = ?').bind(restoId).first<any>();
  if (!resto) return c.notFound();

  // 2. Ambil Kategori Menu Gerai (Tabel menu_categories)
  const { results: categories } = await c.env.DB.prepare(
    'SELECT * FROM menu_categories WHERE restaurant_id = ? AND is_active = 1 ORDER BY sort_order ASC'
  ).bind(restoId).all();

  // 3. Ambil Item Produk Kuliner Gerai (Tersedia saja)
  const { results: items } = await c.env.DB.prepare(`
    SELECT i.* FROM menu_items i
    JOIN menu_categories c ON i.category_id = c.id
    WHERE c.restaurant_id = ? AND i.is_available = 1
  `).bind(restoId).all();

  // 4. Kelompokkan Data
  const promoItems = items.filter((item: any) => item.is_promo === 1);
  const itemsByCategory = items.reduce((acc: any, item: any) => {
    if (!acc[item.category_id]) acc[item.category_id] = [];
    acc[item.category_id].push(item);
    return acc;
  }, {});

  const themeColor = resto.theme_color || '#ee4d2d'; // Default ke orange ShopeeFood jika kosong
  const currencyFormatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

  return c.render(
    <div class="bg-slate-50 min-h-screen font-sans">
      {/* Injeksi Tema Warna & Utilitas CSS */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root { --theme-color: ${themeColor}; }
        .bg-theme { background-color: var(--theme-color); }
        .text-theme { color: var(--theme-color); }
        .border-theme { border-color: var(--theme-color); }
        .ring-theme { --tw-ring-color: var(--theme-color); }
        
        /* Smooth Scrollbar Hider */
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      {/* Container Layar Mobile */}
      <div class="max-w-md mx-auto bg-white min-h-screen shadow-2xl relative pb-28 overflow-x-hidden">
        
        {/* HEADER GERAI IMMERSIVE */}
        <div class="relative h-64 bg-slate-200">
          <img 
            src={resto.image || `https://ui-avatars.com/api/?name=${resto.name}&background=${themeColor.replace('#','')}&color=fff&size=400`} 
            class="w-full h-full object-cover" 
            alt={resto.name} 
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10"></div>
          
          {/* Tombol Back & Share */}
          <div class="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
            <a href="/users" class="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/40 transition-colors shadow-sm">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
            </a>
            <button class="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/40 transition-colors shadow-sm">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
            </button>
          </div>

          {/* Info Gerai Detail */}
          <div class="absolute bottom-4 left-4 right-4">
            <div class="flex items-center gap-2 mb-2">
              <span class="bg-white/20 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                <svg class="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                {resto.rating || '4.8'}
              </span>
              <span class="bg-green-500/80 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                <div class="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div> Buka
              </span>
              <span class="bg-white/20 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                {resto.open_time || '08:00'} - {resto.close_time || '22:00'}
              </span>
            </div>
            <h1 class="text-white text-3xl font-black shadow-sm drop-shadow-md tracking-tight leading-tight mb-1">{resto.name}</h1>
            <p class="text-slate-200 text-xs drop-shadow flex items-center gap-1.5 line-clamp-1 font-medium">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path></svg>
              {resto.address}
            </p>
          </div>
        </div>

        {/* MENU STICKY (KATEGORI NAV) */}
        <div id="sticky-nav" class="sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-[0_4px_10px_-5px_rgba(0,0,0,0.05)] overflow-x-auto hide-scrollbar whitespace-nowrap py-3 px-4 flex gap-2.5">
          {promoItems.length > 0 && (
            <a href="#section-promo" class="nav-pill px-4 py-1.5 rounded-full text-sm font-bold bg-theme text-white shadow-md shadow-[var(--theme-color)]/30 border border-transparent transition-all flex items-center gap-1.5">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"></path></svg>
              Deals
            </a>
          )}
          {categories.map((cat: any, index: number) => (
            <a href={`#section-${cat.id}`} class={`nav-pill px-4 py-1.5 rounded-full text-sm font-bold transition-all ${promoItems.length === 0 && index === 0 ? 'bg-theme text-white shadow-md shadow-[var(--theme-color)]/30 border-transparent' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
              {cat.name}
            </a>
          ))}
        </div>

        {/* KONTEN KATALOG */}
        <div class="bg-slate-50 min-h-screen pb-10">
          
          {/* WIDGET: PROMO SPESIAL (HORIZONTAL SCROLL SEPERTI ASTRO) */}
          {promoItems.length > 0 && (
            <div id="section-promo" class="category-section pt-5 mb-2 bg-white pb-6 shadow-sm border-b border-slate-100">
              <div class="px-4 mb-3 flex justify-between items-center">
                <h2 class="text-lg font-black text-slate-800 flex items-center gap-2">
                  Spesial Promo <span class="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider">Terbatas</span>
                </h2>
              </div>
              
              {/* Slider Horizontal */}
              <div class="flex overflow-x-auto snap-x snap-mandatory gap-3 px-4 hide-scrollbar pb-2">
                {promoItems.map((item: any) => {
                  const discountPercent = Math.round(((item.price - item.promo_price) / item.price) * 100);
                  return (
                    <div class="snap-start shrink-0 w-40 bg-white rounded-2xl shadow-sm border border-slate-100 relative flex flex-col overflow-hidden group">
                      {/* Badge Diskon Absolute */}
                      <div class="absolute top-0 left-0 bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-br-lg z-10 shadow-sm">
                        {discountPercent}% OFF
                      </div>
                      
                      <div class="h-32 bg-slate-100 relative overflow-hidden">
                        <img src={item.image || 'https://via.placeholder.com/200'} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      </div>
                      
                      <div class="p-3 flex flex-col flex-1 justify-between">
                        <div>
                          <h3 class="text-xs font-bold text-slate-800 line-clamp-2 leading-snug mb-1">{item.name}</h3>
                          <div class="flex flex-col mt-1">
                            <span class="text-[10px] font-semibold text-slate-400 line-through decoration-slate-400">{currencyFormatter.format(item.price)}</span>
                            <span class="text-sm font-black text-theme leading-none mt-0.5">{currencyFormatter.format(item.promo_price)}</span>
                          </div>
                        </div>
                        
                        <button class="mt-3 w-full rounded-xl bg-theme/10 text-theme font-bold py-1.5 text-xs flex items-center justify-center gap-1 hover:bg-theme hover:text-white transition-colors" onclick={`addToCart('${item.id}', '${item.name.replace(/'/g, "\\'")}', ${item.promo_price})`}>
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
                          Tambah
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* DAFTAR MENU BERDASARKAN KATEGORI (LIST VERTIKAL) */}
          <div class="px-4">
            {categories.length === 0 ? (
              <div class="text-center py-10 bg-white rounded-2xl mt-4 border border-slate-100 shadow-sm">
                <p class="text-slate-400 font-medium text-sm">Katalog menu sedang disiapkan.</p>
              </div>
            ) : categories.map((cat: any) => (
              <div id={`section-${cat.id}`} class="category-section pt-6 mb-2">
                <h2 class="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                  {cat.name}
                </h2>
                
                <div class="flex flex-col gap-3">
                  {(!itemsByCategory[cat.id] || itemsByCategory[cat.id].length === 0) ? (
                    <p class="text-xs text-slate-400 italic px-2">Belum ada item untuk kategori ini.</p>
                  ) : itemsByCategory[cat.id].map((item: any) => {
                    const currentPrice = item.is_promo === 1 ? item.promo_price : item.price;
                    
                    return (
                      <div class="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex gap-4 cursor-pointer hover:border-theme transition-all relative overflow-hidden group">
                        
                        {/* Gambar Kiri */}
                        <div class="w-24 h-24 bg-slate-100 rounded-xl relative overflow-hidden flex-shrink-0">
                          <img src={item.image || 'https://via.placeholder.com/200'} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          {item.stock > 0 && item.stock <= 5 && (
                            <span class="absolute bottom-1 left-1 right-1 bg-white/90 backdrop-blur text-yellow-600 text-[9px] font-black px-1 py-0.5 rounded text-center shadow-sm truncate">Sisa {item.stock}</span>
                          )}
                          {item.stock === 0 && (
                            <div class="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
                              <span class="bg-slate-800 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm">HABIS</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Detail Kanan */}
                        <div class="flex flex-col flex-1 justify-between py-0.5">
                          <div class="pr-2">
                            <h3 class="text-sm font-bold text-slate-800 line-clamp-2 leading-tight">{item.name}</h3>
                            <p class="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed pr-6">{item.description || 'Pilihan menu favorit yang lezat dan bergizi.'}</p>
                          </div>
                          
                          <div class="mt-2 flex items-end justify-between">
                            <span class="text-sm font-black text-slate-900">{currencyFormatter.format(currentPrice)}</span>
                            
                            {/* Tombol Tambah Bundar Modern */}
                            <button 
                              disabled={item.stock === 0}
                              class={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${item.stock === 0 ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-theme text-white shadow-md shadow-[var(--theme-color)]/30 hover:scale-110 active:scale-95'}`}
                              onclick={item.stock > 0 ? `addToCart('${item.id}', '${item.name.replace(/'/g, "\\'")}', ${currentPrice})` : undefined}
                            >
                              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* WIDGET: FLOATING CART BUTTON (BOTTOM) - GAYA MODERN */}
        <div class="fixed bottom-6 left-1/2 transform -translate-x-1/2 w-full max-w-[420px] px-4 z-50 pointer-events-none hidden" id="floating-cart-container">
          <button class="w-full bg-theme text-white rounded-[20px] p-3 shadow-2xl shadow-[var(--theme-color)]/40 flex items-center justify-between pointer-events-auto transform hover:scale-[1.02] transition-all active:scale-95">
            <div class="flex items-center gap-3">
              <div class="relative bg-white/20 p-2.5 rounded-2xl backdrop-blur-md">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                <span id="cart-badge" class="absolute -top-2 -right-2 bg-slate-900 border-2 border-white text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full shadow-sm">0</span>
              </div>
              <div class="text-left flex flex-col justify-center">
                <p class="text-base font-black leading-none drop-shadow-sm" id="cart-total">Rp 0</p>
                <p class="text-[10px] font-medium text-white/80 mt-0.5">Sudah termasuk pajak</p>
              </div>
            </div>
            <div class="flex items-center gap-1 font-bold text-sm bg-white text-theme px-4 py-2.5 rounded-[14px] shadow-sm">
              Checkout
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg>
            </div>
          </button>
        </div>
      </div>

      {/* SCRIPT INTERAKTIF (CLIENT-SIDE) */}
      <script dangerouslySetInnerHTML={{ __html: `
        let cartTotal = 0;
        let cartItems = 0;
        
        // Logika Keranjang Belanja
        function addToCart(id, name, price) {
          cartTotal += price;
          cartItems += 1;
          
          // Update UI Keranjang
          document.getElementById('cart-total').innerText = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(cartTotal);
          document.getElementById('cart-badge').innerText = cartItems;
          
          // Tampilkan keranjang dengan animasi melayang jika belum terlihat
          const cartContainer = document.getElementById('floating-cart-container');
          if(cartContainer.classList.contains('hidden')) {
            cartContainer.classList.remove('hidden');
            cartContainer.style.animation = 'fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';
          } else {
            // Beri efek detak kecil saat diklik lagi
            const btn = cartContainer.querySelector('button');
            btn.style.transform = 'scale(0.96)';
            setTimeout(() => btn.style.transform = 'scale(1)', 150);
          }
          
          // Notifikasi Snackbar Premium
          const notif = document.createElement('div');
          notif.className = 'fixed top-6 left-1/2 transform -translate-x-1/2 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-full text-[11px] font-medium z-[100] shadow-2xl flex items-center gap-2 transition-all duration-300 opacity-0 -translate-y-4 border border-slate-700';
          notif.innerHTML = '<div class="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center"><svg class="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg></div> <span class="font-bold">' + name + '</span> ke keranjang';
          document.body.appendChild(notif);
          
          // Animasi masuk
          setTimeout(() => {
            notif.classList.remove('opacity-0', '-translate-y-4');
            notif.classList.add('opacity-100', 'translate-y-0');
          }, 10);
          
          // Animasi keluar
          setTimeout(() => {
            notif.classList.remove('opacity-100', 'translate-y-0');
            notif.classList.add('opacity-0', '-translate-y-4');
            setTimeout(() => notif.remove(), 300);
          }, 2000);
        }

        // SCROLLSPY LOGIC: Animasi Menu Sticky
        document.addEventListener('DOMContentLoaded', () => {
          // Tambah style keyframes untuk Cart
          const style = document.createElement('style');
          style.innerHTML = '@keyframes fadeInUp { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }';
          document.head.appendChild(style);

          const sections = document.querySelectorAll('.category-section');
          const navPills = document.querySelectorAll('.nav-pill');
          const stickyNav = document.getElementById('sticky-nav');
          const headerHeight = stickyNav.offsetHeight + 20;

          // Smooth Scroll saat klik kategori
          navPills.forEach(pill => {
            pill.addEventListener('click', (e) => {
              e.preventDefault();
              const targetId = pill.getAttribute('href').substring(1);
              const targetSection = document.getElementById(targetId);
              if (targetSection) {
                window.scrollTo({
                  top: targetSection.offsetTop - headerHeight,
                  behavior: 'smooth'
                });
              }
            });
          });

          // Deteksi posisi scroll
          window.addEventListener('scroll', () => {
            let current = '';
            
            sections.forEach(section => {
              const sectionTop = section.offsetTop;
              // Offset toleransi 15px agar pas
              if (window.pageYOffset >= (sectionTop - headerHeight - 15)) {
                current = section.getAttribute('id');
              }
            });

            navPills.forEach(pill => {
              // Reset State
              pill.classList.remove('bg-theme', 'text-white', 'shadow-md', 'shadow-[var(--theme-color)]/30', 'border-transparent');
              pill.classList.add('bg-slate-50', 'text-slate-600', 'border-slate-200');
              
              // Set Active State
              if (pill.getAttribute('href') === '#' + current) {
                pill.classList.add('bg-theme', 'text-white', 'shadow-md', 'shadow-[var(--theme-color)]/30', 'border-transparent');
                pill.classList.remove('bg-slate-50', 'text-slate-600', 'border-slate-200');
                
                // Geser menu otomatis ke tengah
                pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
              }
            });
          });
        });
      `}} />
    </div>
  , { title: `${resto.name} - Pesan Sekarang` })
})
