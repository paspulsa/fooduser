import { createRoute } from 'honox/factory'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'

export default createRoute(async (c) => {
  // ==========================================
  // 1. CEK SESI USER & AMBIL ALAMAT DARI DATABASE
  // ==========================================
  let userAddress = '';
  let userName = '';
  let isUserLoggedIn = false;

  const token = getCookie(c, 'token');
  
  if (token) {
    try {
      const payload = await verify(token, c.env.JWT_SECRET, 'HS256');
      if (payload && payload.id) {
        const user = await c.env.DB.prepare(
          'SELECT name, address FROM users WHERE id = ?'
        ).bind(payload.id).first<any>();
        
        if (user) {
          isUserLoggedIn = true;
          userName = user.name || '';
          userAddress = user.address || '';
        }
      }
    } catch (e) {
      console.log("Token user invalid atau tidak ada");
    }
  }

  // ==========================================
  // 2. TARIK DATA DARI DATABASE (Katalog, Menu, dan Promo Banner)
  // ==========================================
  const { results: categories } = await c.env.DB.prepare(
    'SELECT id, name, image FROM menu_categories WHERE is_active = 1 ORDER BY sort_order ASC LIMIT 12'
  ).all();

  const { results: appPromos } = await c.env.DB.prepare(
    "SELECT image, action_url FROM app_promos WHERE type = 'BANNER' AND is_active = 1 ORDER BY created_at DESC"
  ).all();

  const modalPromo = await c.env.DB.prepare(
    "SELECT image, action_url FROM app_promos WHERE type = 'MODAL' AND is_active = 1 ORDER BY created_at DESC"
  ).first<any>();

  const { results: promoItems } = await c.env.DB.prepare(
    'SELECT id, category_id, name, description, price, promo_price, is_promo, image, stock, is_available, is_custom, custom_options FROM menu_items WHERE is_available = 1 AND is_promo = 1 ORDER BY created_at DESC LIMIT 6'
  ).all();

  // Best Sellers (Data untuk Tab Paling Laku)
  const { results: bestSellers } = await c.env.DB.prepare(
    'SELECT id, category_id, name, description, price, promo_price, is_promo, image, stock, is_available, is_custom, custom_options, sold_count FROM menu_items WHERE is_available = 1 ORDER BY sold_count DESC, created_at DESC LIMIT 10'
  ).all();

  const { results: recommendedItems } = await c.env.DB.prepare(
    'SELECT id, category_id, name, description, price, promo_price, is_promo, image, stock, is_available, is_custom, custom_options FROM menu_items WHERE is_available = 1 AND is_promo = 0 ORDER BY created_at DESC LIMIT 10'
  ).all();

  // TARIK SEMUA PRODUK: Digunakan untuk fungsi filter & detail produk di keranjang
  const { results: allAvailableItems } = await c.env.DB.prepare(
    'SELECT id, category_id, name, description, price, promo_price, is_promo, image, stock, is_available, is_custom, custom_options FROM menu_items WHERE is_available = 1 ORDER BY created_at DESC'
  ).all();

  const formatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
  const safeItemsJson = JSON.stringify(allAvailableItems).replace(/</g, '\\u003c');

  return c.render(
    <div class="bg-gray-100 dark:bg-gray-900 min-h-screen font-sans">
      <style dangerouslySetInnerHTML={{
        __html: `
          .hide-scrollbar::-webkit-scrollbar { display: none; }
          .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          html { scroll-behavior: smooth; }
          .pb-safe { padding-bottom: env(safe-area-inset-bottom, 20px); }
          /* Kustomisasi Akordeon/Spoiler */
          details > summary { list-style: none; }
          details > summary::-webkit-details-marker { display: none; }
        `
      }} />

      <div class="max-w-md mx-auto bg-gray-50 dark:bg-gray-800 min-h-screen relative shadow-2xl pb-24 overflow-x-hidden transition-colors duration-300">
        
        {/* =========================================================
            HEADER & SEARCH BAR (DENGAN LIVE SEARCH)
            ========================================================= */}
        <div class="bg-gradient-to-b from-[#ee4d2d] to-[#ff7337] px-4 pt-6 pb-4 rounded-b-2xl shadow-sm text-white relative z-50">
          <div class="flex justify-between items-center mb-4">
            <div class="max-w-[80%] cursor-pointer group" onclick="promptManualLocation()">
              <p class="text-[10px] font-medium opacity-90 uppercase tracking-wider mb-0.5">
                {isUserLoggedIn ? `Hai, ${userName.split(' ')[0]}! Diantar ke` : 'Diantar ke'}
              </p>
              <h2 id="user-location" class="text-sm font-bold flex items-center gap-1.5 line-clamp-1 group-hover:text-gray-200 transition-colors">
                <div class="w-32 h-4 bg-white/20 rounded animate-pulse"></div>
              </h2>
            </div>
            <button class="bg-white/20 hover:bg-white/30 p-2 rounded-full backdrop-blur-sm transition flex-shrink-0">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
            </button>
          </div>
          
          <div class="relative z-[60]">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
            <input type="text" id="search-input" class="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-700 rounded-xl text-sm text-gray-900 dark:text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-white/50 placeholder-gray-400 dark:placeholder-gray-300" placeholder="Cari menu, promo, atau resto..." autocomplete="off" onkeyup="handleSearch(this.value)" onfocus="handleSearch(this.value)" />
            
            {/* DROPDOWN LIVE SEARCH */}
            <div id="search-results" class="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden hidden max-h-72 overflow-y-auto z-[70]">
               {/* Konten akan di-inject lewat JS */}
            </div>
          </div>
        </div>

        <div class="w-full">
          
          {/* =========================================================
              BANNER PROMO SLIDER DINAMIS (KINI MENJADI HERO SLIDER)
              ========================================================= */}
          {appPromos.length > 0 && (
            <div class="px-4 mt-5">
              <div class="relative w-full h-40 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 bg-gray-200 dark:bg-gray-700 group">
                {appPromos.map((promo: any, index: number) => (
                  <a href={promo.action_url || '#'} class={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${index === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} data-slide={index}>
                    <img src={promo.image} class="w-full h-full object-cover" alt="Promo Banner" />
                  </a>
                ))}
                
                {/* Slider Dots */}
                {appPromos.length > 1 && (
                  <div class="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-20">
                    {appPromos.map((_: any, index: number) => (
                      <span class={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${index === 0 ? 'bg-white scale-125' : 'bg-white/50'}`} data-dot={index}></span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================
              KATEGORI GRID
              ========================================================= */}
          <div class="px-4 mt-4">
            <div class="grid grid-cols-6 gap-y-4 gap-x-1 sm:gap-x-2">
              {categories.length > 0 ? categories.map((cat: any) => (
                <div class="flex flex-col items-center gap-1.5 cursor-pointer group relative z-10 hover:z-50" onclick={`showCategory('${cat.id}', '${cat.name.replace(/'/g, "\\'")}')`}>
                  <div class="w-[46px] h-[46px] sm:w-[50px] sm:h-[50px] bg-white dark:bg-gray-700 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-600 flex items-center justify-center p-1.5 transition-all duration-300 transform group-hover:scale-[1.75] group-hover:shadow-xl group-hover:bg-orange-50 dark:group-hover:bg-gray-600 overflow-hidden">
                    <img src={cat.image || `https://ui-avatars.com/api/?name=${cat.name}&background=ee4d2d&color=fff`} class="w-full h-full object-contain" alt={cat.name} />
                  </div>
                  <span class="text-[9px] text-center font-bold text-gray-700 dark:text-gray-300 leading-tight line-clamp-2 px-0.5 group-hover:text-[#ee4d2d] transition-colors">{cat.name}</span>
                </div>
              )) : (
                <div class="col-span-6 text-center text-xs text-gray-400 py-2">Belum ada kategori.</div>
              )}
            </div>
          </div>

          <div class="h-2 bg-gray-100 dark:bg-gray-900 mt-6 w-full"></div>

          {/* =========================================================
              WADAH DINAMIS KATEGORI (SPA FILTER)
              ========================================================= */}
          <div id="dynamic-category-container" class="mt-4 pb-8 hidden animate-fade-in bg-orange-50/30 dark:bg-gray-800 rounded-xl mx-2 border border-orange-100/50 dark:border-gray-700 p-2">
            <div class="px-2 flex justify-between items-center mb-4 pt-2">
              <h3 id="dynamic-category-title" class="text-base font-black text-[#ee4d2d] flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>
                <span id="dynamic-category-name">Kategori Pilihan</span>
              </h3>
              <button onclick="document.getElementById('dynamic-category-container').classList.add('hidden')" class="text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-200/50 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-1.5 rounded-full transition shadow-sm">
                Tutup x
              </button>
            </div>
            <div id="dynamic-category-items" class="grid grid-cols-2 gap-3 px-2"></div>
          </div>

          {/* =========================================================
              PALING LAKU DI SEKITARMU (BEST SELLERS) - DIPERBAIKI (TIDAK FULL WIDTH LAGI)
              ========================================================= */}
          {bestSellers.length > 0 && (
            <div class="px-4 mt-4 pb-2 w-full">
              <div class="flex justify-between items-center mb-3">
                <h3 class="text-base font-black text-gray-900 dark:text-white flex items-center gap-1.5">
                  <span class="text-xl">🔥</span> Paling Laku di Sekitarmu
                </h3>
              </div>
              
              <div class="flex overflow-x-auto snap-x snap-mandatory gap-3 hide-scrollbar pb-4 pt-1">
                {bestSellers.map((item: any, index: number) => {
                  const isOutOfStock = item.stock === 0;
                  const currentPrice = item.is_promo ? item.promo_price : item.price;

                  return (
                    <div class="snap-start shrink-0 w-28 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-orange-100 dark:border-gray-700 relative flex flex-col overflow-hidden group">
                      <div class="absolute top-0 left-0 bg-gradient-to-r from-orange-500 to-[#ee4d2d] text-white text-[8px] font-black px-1.5 py-0.5 rounded-br-lg z-10 shadow-sm flex items-center gap-0.5">
                        TOP {index + 1}
                      </div>
                      
                      <div class="relative h-24 w-full bg-gray-50 dark:bg-gray-700 overflow-hidden cursor-pointer" onclick={`openProductDetail('${item.id}')`}>
                        <img src={item.image || 'https://via.placeholder.com/150'} class={`w-full h-full object-cover transition-transform duration-500 ${isOutOfStock ? 'opacity-50 grayscale' : 'group-hover:scale-110'}`} />
                        {isOutOfStock && (
                          <div class="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                            <span class="bg-gray-900 text-white text-[8px] font-black px-2 py-0.5 rounded-full shadow-md">HABIS</span>
                          </div>
                        )}
                      </div>
                      
                      <div class="p-2 flex flex-col flex-1 justify-between">
                        <div>
                          <h4 class="text-[10px] font-bold text-gray-900 dark:text-white line-clamp-2 leading-tight mb-1 cursor-pointer" onclick={`openProductDetail('${item.id}')`}>{item.name}</h4>
                          <span class="text-[11px] font-black text-[#ee4d2d] block">{formatter.format(currentPrice)}</span>
                        </div>
                        <div class="mt-2 flex justify-between items-center">
                          <span class="text-[8px] font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded flex items-center gap-0.5">
                            <svg class="w-2 h-2 text-orange-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"></path></svg>
                            {item.sold_count}
                          </span>
                          {item.is_custom === 1 ? (
                            <button onclick={!isOutOfStock ? `openProductDetail('${item.id}')` : undefined} disabled={isOutOfStock} class={`text-[8px] font-bold px-2 py-1 rounded-full shadow-sm transition-colors ${isOutOfStock ? 'bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-500 cursor-not-allowed' : 'bg-orange-50 text-[#ee4d2d] hover:bg-[#ee4d2d] hover:text-white dark:bg-[#ee4d2d]/20 dark:hover:bg-[#ee4d2d]'}`}>
                              Pilih
                            </button>
                          ) : (
                            <button onclick={!isOutOfStock ? `addToCart('${item.id}', '${item.name.replace(/'/g, "\\'")}', ${currentPrice})` : undefined} disabled={isOutOfStock} class={`w-5 h-5 rounded-full flex items-center justify-center shadow-sm transition-transform active:scale-90 ${isOutOfStock ? 'bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-500 cursor-not-allowed' : 'bg-[#ee4d2d] text-white'}`}>
                              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4"></path></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div class="h-2 bg-gray-100 dark:bg-gray-900 w-full"></div>

          {/* =========================================================
              FLASH SALE / PROMO GERCEP (CARD LEBIH BESAR) - DIPERBAIKI (TIDAK FULL WIDTH LAGI)
              ========================================================= */}
          {promoItems.length > 0 && (
            <div class="px-4 mt-4 w-full">
              <div class="flex justify-between items-center mb-3">
                <h3 class="text-base font-black text-gray-900 dark:text-white italic flex items-center gap-1">
                  <svg class="w-5 h-5 text-[#ee4d2d]" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"></path></svg>
                  PROMO GERCEP
                </h3>
                <a href="/users/promos" class="text-[11px] font-bold text-[#ee4d2d] hover:underline bg-orange-50 dark:bg-[#ee4d2d]/10 px-2 py-1 rounded transition-colors">Lihat semua</a>
              </div>

              <div class="flex overflow-x-auto snap-x snap-mandatory gap-3 hide-scrollbar pb-4 pt-1">
                {promoItems.map((item: any) => {
                  const discountPercent = Math.round(((item.price - item.promo_price) / item.price) * 100);
                  const isOutOfStock = item.stock === 0;

                  return (
                    <div class="snap-start shrink-0 w-36 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 relative flex flex-col overflow-hidden group">
                      <div class="absolute top-0 left-0 bg-[#ee4d2d] text-white text-[10px] font-black px-2 py-0.5 rounded-br-lg z-10 shadow-sm">{discountPercent}% OFF</div>
                      
                      <div class="relative h-32 w-full bg-gray-50 dark:bg-gray-700 overflow-hidden cursor-pointer" onclick={`openProductDetail('${item.id}')`}>
                        <img src={item.image || 'https://via.placeholder.com/150'} class={`w-full h-full object-cover transition-transform ${isOutOfStock ? 'opacity-50 grayscale' : 'group-hover:scale-105'}`} />
                        {isOutOfStock && (
                          <div class="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                            <span class="bg-gray-900 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-md">HABIS</span>
                          </div>
                        )}
                      </div>
                      
                      <div class="p-2.5 flex flex-col flex-1 justify-between">
                        <div>
                          <h4 class="text-xs font-bold text-gray-900 dark:text-white line-clamp-2 leading-snug cursor-pointer" onclick={`openProductDetail('${item.id}')`}>{item.name}</h4>
                          <div class="mt-1.5 flex flex-col">
                            <span class="text-[10px] text-gray-400 dark:text-gray-500 line-through decoration-gray-400">{formatter.format(item.price)}</span>
                            <span class="text-sm font-black text-[#ee4d2d] leading-none mt-0.5">{formatter.format(item.promo_price)}</span>
                          </div>
                        </div>
                        <div class="mt-3 flex justify-between items-center">
                          <span class="text-[9px] font-medium text-gray-500 dark:text-gray-400">Stok: {item.stock}</span>
                          {item.is_custom === 1 ? (
                            <button onclick={!isOutOfStock ? `openProductDetail('${item.id}')` : undefined} disabled={isOutOfStock} class={`text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm transition-colors ${isOutOfStock ? 'bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-500 cursor-not-allowed' : 'bg-orange-50 text-[#ee4d2d] hover:bg-[#ee4d2d] hover:text-white dark:bg-[#ee4d2d]/20 dark:hover:bg-[#ee4d2d]'}`}>
                              Pilih
                            </button>
                          ) : (
                            <button onclick={!isOutOfStock ? `addToCart('${item.id}', '${item.name.replace(/'/g, "\\'")}', ${item.promo_price})` : undefined} disabled={isOutOfStock} class={`w-6 h-6 rounded-full flex items-center justify-center shadow-sm transition-transform active:scale-90 ${isOutOfStock ? 'bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-500 cursor-not-allowed' : 'bg-[#ee4d2d] text-white hover:bg-orange-700'}`}>
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {promoItems.length > 0 && <div class="h-2 bg-gray-100 dark:bg-gray-900 w-full"></div>}

          {/* =========================================================
              REKOMENDASI (EXPLORE)
              ========================================================= */}
          <div class="mt-4 pb-8">
            <div class="px-4 flex justify-between items-center mb-3">
              <h3 class="text-base font-black text-gray-900 dark:text-white">Eksplor Menu Lainnya</h3>
            </div>
            <div class="grid grid-cols-2 gap-3 px-4">
              {recommendedItems.map((item: any) => {
                const isOutOfStock = item.stock === 0;
                return (
                  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden group">
                    <div class="relative h-32 w-full bg-gray-50 dark:bg-gray-700 overflow-hidden cursor-pointer" onclick={`openProductDetail('${item.id}')`}>
                      <img src={item.image || 'https://via.placeholder.com/150'} class={`w-full h-full object-cover transition-transform duration-500 ${isOutOfStock ? 'opacity-50 grayscale' : 'group-hover:scale-105'}`} />
                      {isOutOfStock && (
                        <div class="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                          <span class="bg-gray-900 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-md">HABIS</span>
                        </div>
                      )}
                    </div>
                    
                    <div class="p-3 flex flex-col flex-1 justify-between">
                      <div>
                        <h4 class="text-xs font-bold text-gray-900 dark:text-white line-clamp-2 leading-snug mb-1 cursor-pointer" onclick={`openProductDetail('${item.id}')`}>{item.name}</h4>
                        <span class="text-sm font-black text-gray-900 dark:text-white">{formatter.format(item.price)}</span>
                      </div>
                      <div class="mt-3 flex justify-between items-end">
                        <span class="text-[9px] font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">Stok: {item.stock}</span>
                        {item.is_custom === 1 ? (
                          <button onclick={!isOutOfStock ? `openProductDetail('${item.id}')` : undefined} disabled={isOutOfStock} class={`text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm transition-colors ${isOutOfStock ? 'bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-500 cursor-not-allowed' : 'bg-orange-50 text-[#ee4d2d] hover:bg-[#ee4d2d] hover:text-white dark:bg-[#ee4d2d]/20 dark:hover:bg-[#ee4d2d]'}`}>
                            Pilih
                          </button>
                        ) : (
                          <button onclick={!isOutOfStock ? `addToCart('${item.id}', '${item.name.replace(/'/g, "\\'")}', ${item.price})` : undefined} disabled={isOutOfStock} class={`w-7 h-7 rounded-full flex items-center justify-center shadow-sm transition-transform active:scale-90 ${isOutOfStock ? 'bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-500 cursor-not-allowed' : 'bg-[#ee4d2d] text-white hover:bg-orange-700'}`}>
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* =========================================================
            MODAL BOTTOM SHEET LOKASI
            ========================================================= */}
        <div id="location-modal" class="fixed inset-0 z-[100] hidden items-end justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 opacity-0">
          <div id="location-modal-inner" class="w-full max-w-md bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl transform translate-y-full transition-transform duration-300 p-6 pb-safe border-t border-gray-100 dark:border-gray-700">
            <div class="flex justify-between items-center mb-6">
               <h3 class="font-black text-gray-900 dark:text-white text-lg">Alamat Pengiriman</h3>
               <button onclick="closeLocationModal()" class="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                 <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
               </button>
            </div>
            
            <div class="space-y-5">
               <button id="btn-gps" onclick="detectGPSLocation()" class="w-full flex justify-center items-center gap-2.5 p-3.5 bg-orange-50 dark:bg-[#ee4d2d]/10 text-[#ee4d2d] rounded-2xl font-bold text-sm border border-orange-100 dark:border-transparent hover:bg-orange-100 transition-colors">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                  Gunakan Lokasi Saat Ini (GPS)
               </button>
               
               <div class="relative">
                  <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-gray-200 dark:border-gray-700"></div></div>
                  <div class="relative flex justify-center"><span class="bg-white dark:bg-gray-800 px-4 text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">Atau Ketik Manual</span></div>
               </div>
               
               <div>
                  <textarea id="manual-address-input" rows={3} class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl p-4 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ee4d2d]/50 focus:border-[#ee4d2d] transition-all font-medium placeholder-gray-400 dark:placeholder-gray-500 resize-none" placeholder="Cth: Jl. Sudirman No. 12, RT 01/RW 02, Jakarta Barat..."></textarea>
               </div>
               
               <button onclick="saveManualLocation()" class="w-full bg-[#ee4d2d] text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-[#ee4d2d]/30 hover:bg-orange-700 active:scale-[0.98] transition-all">
                  Simpan Lokasi
               </button>
            </div>
          </div>
        </div>

        {/* =========================================================
            MODAL BANNER POPUP DINAMIS
            ========================================================= */}
        {modalPromo && (
          <div id="promo-modal" class="fixed inset-0 z-[100] hidden items-center justify-center p-6 bg-black/60 backdrop-blur-sm transition-opacity duration-300 opacity-0">
            <div class="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden transform scale-95 transition-transform duration-300" id="promo-modal-inner">
              <button onclick="closePromoModal()" class="absolute top-3 right-3 w-8 h-8 bg-black/40 backdrop-blur rounded-full flex items-center justify-center text-white hover:bg-black/60 transition z-10">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
              <a href={modalPromo.action_url || '#'}>
                <img src={modalPromo.image} class="w-full object-cover" alt="Spesial Promo" />
              </a>
            </div>
          </div>
        )}

        {/* =========================================================
            MODAL BOTTOM SHEET DETAIL PRODUK & KUSTOMISASI (SPOILER)
            ========================================================= */}
        <div id="product-detail-modal" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] hidden flex flex-col justify-end opacity-0 transition-opacity duration-300">
          <div class="bg-white dark:bg-gray-800 w-full max-w-md mx-auto rounded-t-3xl max-h-[85vh] flex flex-col transform translate-y-full transition-transform duration-300 mb-[60px]" id="pdm-inner">
            
            <div class="relative h-56 bg-gray-100 dark:bg-gray-700 rounded-t-3xl flex-shrink-0">
              <img id="pdm-image" src="" class="w-full h-full object-cover rounded-t-3xl" />
              <button onclick="closeProductDetail()" class="absolute top-4 right-4 w-8 h-8 bg-black/40 text-white rounded-full flex items-center justify-center backdrop-blur-md hover:bg-black/60 transition-colors shadow-sm">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div class="p-5 overflow-y-auto flex-1 hide-scrollbar pb-6">
              <h2 id="pdm-name" class="text-xl font-black text-gray-900 dark:text-white leading-tight"></h2>
              <p id="pdm-desc" class="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed"></p>
              <div class="mt-3 flex items-center gap-2">
                 <span id="pdm-price" class="text-lg font-black text-[#ee4d2d]"></span>
                 <span id="pdm-original-price" class="text-xs font-bold text-gray-400 dark:text-gray-500 line-through hidden"></span>
              </div>
              
              {/* Tempat Injeksi Opsi Custom HTML (SPOILER / ACCORDION) */}
              <div id="pdm-custom-container" class="mt-6 space-y-3"></div>
            </div>

            <div class="p-3 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center gap-3 flex-shrink-0 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.05)]">
              <div class="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg px-1 border border-gray-200 dark:border-gray-600">
                <button onclick="updateQty(-1)" class="w-8 h-8 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold text-lg hover:bg-gray-200 dark:hover:bg-gray-600 rounded-l-lg transition">-</button>
                <span id="pdm-qty" class="w-6 text-center font-bold text-sm text-gray-900 dark:text-white">1</span>
                <button onclick="updateQty(1)" class="w-8 h-8 flex items-center justify-center text-[#ee4d2d] font-bold text-lg hover:bg-gray-200 dark:hover:bg-gray-600 rounded-r-lg transition">+</button>
              </div>
              <button id="pdm-add-btn" class="flex-1 bg-[#ee4d2d] text-white py-2.5 px-3 rounded-lg text-sm font-bold shadow-sm shadow-[#ee4d2d]/30 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5" onclick="submitProductToCart()">
                <span>Tambah</span>
                <span class="w-1 h-1 rounded-full bg-white/50"></span>
                <span id="pdm-total-btn-price"></span>
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================
            BOTTOM NAVIGATION BAR (FIXED)
            ========================================================= */}
        <div class="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.08)] z-[40]">
          <div class="flex justify-around items-center h-[60px] px-2 pb-safe">
            <a href="/users" class="flex flex-col items-center gap-1 text-[#ee4d2d]">
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path></svg>
              <span class="text-[10px] font-bold">Home</span>
            </a>
            <a href="/users/promos" class="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-[#ee4d2d] transition-colors">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>
              <span class="text-[10px] font-semibold">Promo</span>
            </a>
            <a href="/users/cart" class="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-[#ee4d2d] transition-colors relative">
              <div id="nav-cart-badge" class="absolute -top-1 -right-1 bg-[#ee4d2d] text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 hidden">0</div>
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              <span class="text-[10px] font-semibold">Keranjang</span>
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

      {/* =========================================================
          SCRIPT INTERAKTIF LENGKAP PENGELOLA KERANJANG (LOCALSTORAGE)
          ========================================================= */}
      <script dangerouslySetInnerHTML={{ __html: `
        // DATA GLOBAL
        const DB_ADDRESS = \`${userAddress}\`;
        const PRODUCTS = ${safeItemsJson};
        const formatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
        
        // ARRAY KERANJANG SESUNGGUHNYA (TERHUBUNG KE LOCALSTORAGE)
        let cart = JSON.parse(localStorage.getItem('spos_cart')) || [];
        
        let currentActiveProduct = null;
        let currentQty = 1;
        let basePrice = 0;
        let additionalPrice = 0;

        // --- INIT HERO SLIDER ---
        function initSlider() {
          let currentSlide = 0;
          const slides = document.querySelectorAll('[data-slide]');
          const dots = document.querySelectorAll('[data-dot]');
          if(slides.length > 1) {
            setInterval(() => {
              slides[currentSlide].classList.remove('opacity-100', 'z-10');
              slides[currentSlide].classList.add('opacity-0', 'z-0');
              dots[currentSlide].classList.remove('bg-white', 'scale-125');
              dots[currentSlide].classList.add('bg-white/50');
              
              currentSlide = (currentSlide + 1) % slides.length;
              
              slides[currentSlide].classList.remove('opacity-0', 'z-0');
              slides[currentSlide].classList.add('opacity-100', 'z-10');
              dots[currentSlide].classList.remove('bg-white/50');
              dots[currentSlide].classList.add('bg-white', 'scale-125');
            }, 3500);
          }
        }
        
        // --- 1. TOAST NOTIFIKASI ELEGAN ---
        function showToast(msg, isError = false) {
          const toast = document.createElement('div');
          toast.className = \`fixed bottom-24 left-1/2 transform -translate-x-1/2 backdrop-blur-md text-white text-[11px] font-bold px-5 py-3 rounded-full shadow-2xl z-[150] flex items-center gap-2 transition-all duration-300 opacity-0 translate-y-4 border \${isError ? 'bg-red-600/95 border-red-500' : 'bg-gray-900/95 border-gray-800'}\`;
          toast.innerHTML = isError 
            ? '<svg class="w-4 h-4 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> ' + msg
            : '<svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg> ' + msg;
          document.body.appendChild(toast);
          setTimeout(() => toast.classList.remove('opacity-0', 'translate-y-4'), 10);
          setTimeout(() => { toast.classList.add('opacity-0', 'translate-y-4'); setTimeout(() => toast.remove(), 300); }, 2500);
        }

        // --- 2. PENYIMPANAN & UPDATE BADGE KERANJANG ---
        function saveCart() {
          localStorage.setItem('spos_cart', JSON.stringify(cart));
          updateCartBadge();
        }

        function updateCartBadge() {
          let totalItems = 0;
          cart.forEach(item => { totalItems += item.qty; });
          const badge = document.getElementById('nav-cart-badge');
          if (badge) {
            if (totalItems > 0) {
              badge.innerText = totalItems;
              badge.classList.remove('hidden');
              badge.style.transform = 'scale(1.4)';
              setTimeout(() => badge.style.transform = 'scale(1)', 200);
            } else {
              badge.classList.add('hidden');
            }
          }
        }

        // --- 3. FUNGSI KERANJANG STANDAR (DARI TOMBOL LANGSUNG) ---
        function addToCart(id, name, price) {
          const product = PRODUCTS.find(p => p.id === id);
          if (!product) return;

          // Cek apakah item tanpa varian (note kosong) sudah ada di keranjang
          const existingIndex = cart.findIndex(item => item.id === id && !item.note);
          
          if (existingIndex > -1) {
              cart[existingIndex].qty += 1;
          } else {
              cart.push({
                  id: id,
                  name: name,
                  price: price,
                  image: product.image || 'https://via.placeholder.com/150',
                  qty: 1,
                  additional_price: 0,
                  note: ''
              });
          }
          
          saveCart();
          showToast(name + ' ditambahkan ke pesanan!');
        }

        // --- 4. FUNGSI KERANJANG MODAL (PRODUK DENGAN OPSI CUSTOM) ---
        function submitProductToCart() {
           // Kumpulkan catatan dari input radio/checkbox yang dipilih
           let noteArr = [];
           const inputs = document.querySelectorAll('#pdm-custom-container input:checked');
           inputs.forEach(input => { 
               const labelSpan = input.nextElementSibling;
               if(labelSpan) noteArr.push(labelSpan.innerText);
           });
           const noteStr = noteArr.join(', ');

           // Cek apakah produk dengan varian kustom yang SAMA PERSIS sudah ada di keranjang
           const existingIndex = cart.findIndex(item => item.id === currentActiveProduct.id && item.note === noteStr);
           
           if (existingIndex > -1) {
               cart[existingIndex].qty += currentQty;
           } else {
               cart.push({
                   id: currentActiveProduct.id,
                   name: currentActiveProduct.name,
                   price: basePrice,
                   image: currentActiveProduct.image || 'https://via.placeholder.com/150',
                   qty: currentQty,
                   additional_price: additionalPrice, // Harga tambahan per item dari custom options
                   note: noteStr
               });
           }
           
           saveCart();
           showToast(currentActiveProduct.name + ' ditambahkan ke pesanan!');
           closeProductDetail();
        }

        // --- 5. LOGIKA LOKASI, PROMO, LIVE SEARCH, DLL (TETAP SAMA SEPERTI ASLINYA) ---
        function initLocation() {
          const locElement = document.getElementById('user-location');
          const arrowIcon = '<svg class="w-4 h-4 ml-1 flex-shrink-0 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>';
          
          if (DB_ADDRESS && DB_ADDRESS.trim() !== '') {
            locElement.innerHTML = \`<span class="truncate">\${DB_ADDRESS}</span> \${arrowIcon}\`;
            return;
          }
          const savedAddress = localStorage.getItem('user_saved_address');
          if (savedAddress) {
            locElement.innerHTML = \`<span class="truncate">\${savedAddress}</span> \${arrowIcon}\`;
            return;
          }
          locElement.innerHTML = '<span class="truncate">Mendeteksi...</span> <svg class="animate-spin w-4 h-4 ml-1 flex-shrink-0 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
          
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                try {
                  const res = await fetch(\`https://nominatim.openstreetmap.org/reverse?format=json&lat=\${lat}&lon=\${lon}&zoom=16\`);
                  const data = await res.json();
                  let streetName = data.address.road || data.address.village || data.address.suburb || data.display_name.split(',')[0];
                  locElement.innerHTML = \`<span class="truncate">\${streetName}</span> \${arrowIcon}\`;
                  localStorage.setItem('user_saved_address', streetName);
                } catch(e) {
                  locElement.innerHTML = \`<span class="truncate">Gagal melacak, ketuk untuk isi</span> \${arrowIcon}\`;
                }
              }, () => {
                locElement.innerHTML = \`<span class="truncate text-yellow-100">Ketuk untuk set alamat manual</span> \${arrowIcon}\`;
              });
          } else {
            locElement.innerHTML = \`<span class="truncate">Pilih lokasi pengiriman</span> \${arrowIcon}\`;
          }
        }

        function promptManualLocation() {
          const modal = document.getElementById('location-modal');
          const inner = document.getElementById('location-modal-inner');
          const input = document.getElementById('manual-address-input');
          const currentAddress = localStorage.getItem('user_saved_address') || '';
          input.value = (DB_ADDRESS && DB_ADDRESS.trim() !== '') ? DB_ADDRESS : currentAddress;
          
          modal.classList.remove('hidden');
          modal.classList.add('flex');
          setTimeout(() => { modal.classList.remove('opacity-0'); inner.classList.remove('translate-y-full'); }, 10);
        }

        function closeLocationModal() {
          const modal = document.getElementById('location-modal');
          const inner = document.getElementById('location-modal-inner');
          modal.classList.add('opacity-0');
          inner.classList.add('translate-y-full');
          setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
        }

        function saveManualLocation() {
          const val = document.getElementById('manual-address-input').value;
          if (val && val.trim() !== '') {
            localStorage.setItem('user_saved_address', val);
            document.getElementById('user-location').innerHTML = \`<span class="truncate">\${val}</span> <svg class="w-4 h-4 ml-1 flex-shrink-0 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>\`;
            closeLocationModal();
            showToast('Alamat berhasil disimpan');
          } else {
            showToast('Harap isi alamat dengan lengkap!', true);
          }
        }

        function detectGPSLocation() {
          const btn = document.getElementById('btn-gps');
          const originalHtml = btn.innerHTML;
          btn.innerHTML = '<svg class="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Melacak posisi...';
          
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              async (position) => {
                try {
                  const res = await fetch(\`https://nominatim.openstreetmap.org/reverse?format=json&lat=\${position.coords.latitude}&lon=\${position.coords.longitude}&zoom=16\`);
                  const data = await res.json();
                  let streetName = data.address.road || data.address.suburb || data.display_name.split(',')[0];
                  localStorage.setItem('user_saved_address', streetName);
                  document.getElementById('user-location').innerHTML = \`<span class="truncate">\${streetName}</span> <svg class="w-4 h-4 ml-1 flex-shrink-0 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>\`;
                  closeLocationModal();
                  showToast('Lokasi akurat ditemukan!');
                } catch(e) {
                  showToast('Gagal memuat alamat dari GPS.', true);
                } finally { btn.innerHTML = originalHtml; }
              }, 
              (error) => { 
                showToast('Akses GPS ditolak.', true);
                btn.innerHTML = originalHtml; 
              }
            );
          }
        }

        function initPromoModal() {
          const modal = document.getElementById('promo-modal');
          if (!modal) return;
          if (!sessionStorage.getItem('promo_seen')) {
            setTimeout(() => {
              modal.classList.remove('hidden');
              modal.classList.add('flex');
              setTimeout(() => {
                modal.classList.remove('opacity-0');
                document.getElementById('promo-modal-inner').classList.remove('scale-95');
              }, 10);
            }, 1000);
          }
        }

        function closePromoModal() {
          const modal = document.getElementById('promo-modal');
          sessionStorage.setItem('promo_seen', 'true');
          modal.classList.add('opacity-0');
          document.getElementById('promo-modal-inner').classList.add('scale-95');
          setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
        }

        function handleSearch(query) {
          const resultsContainer = document.getElementById('search-results');
          
          if (!query || query.length < 3) {
            resultsContainer.classList.add('hidden');
            return;
          }

          const lowerQuery = query.toLowerCase();
          const filtered = PRODUCTS.filter(p => p.name.toLowerCase().includes(lowerQuery));

          if (filtered.length === 0) {
            resultsContainer.innerHTML = '<div class="p-4 text-center text-xs text-gray-500 font-medium">Menu tidak ditemukan.</div>';
          } else {
            resultsContainer.innerHTML = filtered.map(item => {
              const currentPrice = item.is_promo ? item.promo_price : item.price;
              const isOutOfStock = item.stock === 0;
              
              return \`
                <div class="flex items-center gap-3 p-3 border-b border-gray-50 dark:border-gray-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors" onclick="\${!isOutOfStock ? \`openProductDetail('\${item.id}'); document.getElementById('search-results').classList.add('hidden');\` : ''}">
                  <div class="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex-shrink-0 overflow-hidden relative border border-gray-200 dark:border-gray-600">
                    <img src="\${item.image || 'https://via.placeholder.com/150'}" class="w-full h-full object-cover \${isOutOfStock ? 'opacity-50 grayscale' : ''}" alt="\${item.name}" />
                    \${isOutOfStock ? '<div class="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-[1px] flex items-center justify-center"><span class="text-[8px] font-black text-white bg-gray-900 px-1 py-0.5 rounded">HABIS</span></div>' : ''}
                  </div>
                  <div class="flex-1 overflow-hidden">
                    <h4 class="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">\${item.name}</h4>
                    <span class="text-xs font-black text-[#ee4d2d] mt-0.5 block">\${formatter.format(currentPrice)}</span>
                  </div>
                </div>
              \`;
            }).join('');
          }
          
          resultsContainer.classList.remove('hidden');
        }

        document.addEventListener('click', (e) => {
          const searchInput = document.getElementById('search-input');
          const searchResults = document.getElementById('search-results');
          if (searchInput && searchResults && !searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.add('hidden');
          }
        });

        function showCategory(categoryId, categoryName) {
          const container = document.getElementById('dynamic-category-container');
          const titleName = document.getElementById('dynamic-category-name');
          const itemsBox = document.getElementById('dynamic-category-items');

          const filtered = PRODUCTS.filter(p => p.category_id === categoryId);
          titleName.innerText = categoryName;

          if (filtered.length === 0) {
             itemsBox.innerHTML = '<div class="col-span-2 text-center py-10 bg-white dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600 shadow-sm"><p class="text-sm font-bold text-gray-400">Belum ada menu di kategori ini.</p></div>';
          } else {
             itemsBox.innerHTML = filtered.map(item => {
               const isOutOfStock = item.stock === 0;
               const currentPrice = item.is_promo ? item.promo_price : item.price;
               const imgClass = isOutOfStock ? 'opacity-50 grayscale' : 'group-hover:scale-105';
               const outOfStockOverlay = isOutOfStock ? '<div class="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-[2px] flex items-center justify-center"><span class="bg-gray-900 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-md">HABIS</span></div>' : '';

               const btnHtml = item.is_custom === 1
                 ? \`<button onclick="\${!isOutOfStock ? \`openProductDetail('\${item.id}')\` : ''}" \${isOutOfStock ? 'disabled' : ''} class="text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm transition-colors \${isOutOfStock ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed' : 'bg-orange-50 dark:bg-[#ee4d2d]/20 text-[#ee4d2d] hover:bg-[#ee4d2d] hover:text-white'}">Pilih</button>\`
                 : \`<button onclick="\${!isOutOfStock ? \`addToCart('\${item.id}', '\${item.name.replace(/'/g, "\\\\'")}', \${currentPrice})\` : ''}" \${isOutOfStock ? 'disabled' : ''} class="w-7 h-7 rounded-full flex items-center justify-center shadow-sm transition-transform active:scale-90 \${isOutOfStock ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed' : 'bg-[#ee4d2d] text-white hover:bg-orange-700'}"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg></button>\`;

               return \`
                 <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden group">
                   <div class="relative h-32 w-full bg-gray-50 dark:bg-gray-700 overflow-hidden cursor-pointer" onclick="openProductDetail('\${item.id}')">
                     <img src="\${item.image || 'https://via.placeholder.com/150'}" class="w-full h-full object-cover transition-transform duration-500 \${imgClass}" />
                     \${outOfStockOverlay}
                   </div>
                   <div class="p-3 flex flex-col flex-1 justify-between">
                     <div>
                       <h4 class="text-xs font-bold text-gray-900 dark:text-white line-clamp-2 leading-snug mb-1 cursor-pointer" onclick="openProductDetail('\${item.id}')">\${item.name}</h4>
                       <span class="text-sm font-black text-gray-900 dark:text-white">\${formatter.format(currentPrice)}</span>
                     </div>
                     <div class="mt-3 flex justify-between items-end">
                       <span class="text-[9px] font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">Sisa: \${item.stock}</span>
                       \${btnHtml}
                     </div>
                   </div>
                 </div>
               \`;
             }).join('');
          }

          container.classList.remove('hidden');
          setTimeout(() => { container.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
        }

        function openProductDetail(id) {
          const item = PRODUCTS.find(p => p.id === id);
          if(!item) return;

          currentActiveProduct = item;
          currentQty = 1;
          document.getElementById('pdm-qty').innerText = currentQty;

          document.getElementById('pdm-image').src = item.image || 'https://via.placeholder.com/400';
          document.getElementById('pdm-name').innerText = item.name;
          document.getElementById('pdm-desc').innerText = item.description || '';
          
          basePrice = item.is_promo === 1 ? item.promo_price : item.price;
          document.getElementById('pdm-price').innerText = formatter.format(basePrice);
          
          const orig = document.getElementById('pdm-original-price');
          if(item.is_promo === 1) {
             orig.innerText = formatter.format(item.price);
             orig.classList.remove('hidden');
          } else {
             orig.classList.add('hidden');
          }

          const container = document.getElementById('pdm-custom-container');
          container.innerHTML = '';
          additionalPrice = 0;

          if(item.is_custom === 1 && item.custom_options) {
           try {
              const parsedData = JSON.parse(item.custom_options);     
              const options = Array.isArray(parsedData) ? parsedData : (parsedData.builder || []);
                  options.forEach((optGroup, groupIdx) => {
                   let html = \`
                     <details class="group border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 transition-all duration-300 shadow-sm" open>
                       <summary class="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700/50 cursor-pointer select-none outline-none">
                         <div class="flex items-center gap-2">
                           <h4 class="font-black text-gray-900 dark:text-white text-sm">\${optGroup.title || optGroup.name}</h4>
                           \${optGroup.is_required || optGroup.required ? '<span class="text-[9px] font-bold bg-orange-100 dark:bg-[#ee4d2d]/20 text-[#ee4d2d] px-1.5 py-0.5 rounded">Wajib</span>' : '<span class="text-[9px] font-medium text-gray-500 dark:text-gray-400">Opsional</span>'}
                         </div>
                         <svg class="w-5 h-5 text-gray-400 dark:text-gray-500 transform group-open:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                       </summary>
                       <div class="p-3 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                   \`;

                   const choices = optGroup.choices || optGroup.options || [];
                   choices.forEach((opt, optIdx) => {
                     const inputType = optGroup.type === 'radio' ? 'radio' : 'checkbox';
                     const inputName = \`custom_\${groupIdx}\`;
                     const priceText = opt.price > 0 ? \`+ \${formatter.format(opt.price)}\` : 'Gratis';
                     
                     html += \`
                       <label class="flex items-center justify-between py-3 px-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors rounded-lg">
                         <div class="flex items-center gap-3">
                           <input type="\${inputType}" name="\${inputName}" value="\${opt.price}" class="w-4 h-4 text-[#ee4d2d] bg-white dark:bg-gray-700 focus:ring-[#ee4d2d] border-gray-300 dark:border-gray-600 \${inputType==='radio'?'rounded-full':'rounded'}" onchange="recalculateModalPrice()">
                           <span class="text-sm font-semibold text-gray-700 dark:text-gray-200">\${opt.name}</span>
                         </div>
                         <span class="text-xs font-bold text-gray-500 dark:text-gray-400">\${priceText}</span>
                       </label>
                     \`;
                   });
                   html += '</div></details>';
                   container.innerHTML += html;
                });
             } catch(e) { console.error("Gagal parsing custom JSON", e); }
          }

          recalculateModalPrice();

          const modal = document.getElementById('product-detail-modal');
          const inner = document.getElementById('pdm-inner');
          modal.classList.remove('hidden');
          modal.classList.add('flex');
          setTimeout(() => {
            modal.classList.remove('opacity-0');
            inner.classList.remove('translate-y-full');
          }, 10);
        }

        function closeProductDetail() {
          const modal = document.getElementById('product-detail-modal');
          const inner = document.getElementById('pdm-inner');
          modal.classList.add('opacity-0');
          inner.classList.add('translate-y-full');
          setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
        }

        function updateQty(delta) {
          if(currentQty + delta >= 1) {
            currentQty += delta;
            document.getElementById('pdm-qty').innerText = currentQty;
            recalculateModalPrice();
          }
        }

        function recalculateModalPrice() {
           additionalPrice = 0;
           const inputs = document.querySelectorAll('#pdm-custom-container input:checked');
           inputs.forEach(input => { additionalPrice += parseInt(input.value) || 0; });
           const total = (basePrice + additionalPrice) * currentQty;
           document.getElementById('pdm-total-btn-price').innerText = formatter.format(total);
        }

        // INIT LOAD
        document.addEventListener('DOMContentLoaded', () => {
          initLocation();
          initPromoModal();
          updateCartBadge();
          initSlider(); // Memulai Hero Slider
        });
      `}} />
    </div>
  , { title: 'Home - Kedai Pangsit Kembar 88' })
})
