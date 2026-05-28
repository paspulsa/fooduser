import { createRoute } from 'honox/factory'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'

export default createRoute(async (c) => {
  let isUserLoggedIn = false;
  let userId = '';
  const token = getCookie(c, 'token');
  
  if (token) {
    try {
      const payload = await verify(token, c.env.JWT_SECRET, 'HS256');
      if (payload && payload.id) {
          isUserLoggedIn = true;
          userId = payload.id as string;
      }
    } catch (e) {}
  }

  const { results: appPromos } = await c.env.DB.prepare("SELECT image, action_url FROM app_promos WHERE type = 'BANNER' AND is_active = 1 ORDER BY created_at DESC").all();
  const { results: promoItems } = await c.env.DB.prepare('SELECT id, category_id, name, description, price, promo_price, is_promo, image, stock, is_available, is_custom, custom_options FROM menu_items WHERE is_available = 1 AND is_promo = 1 ORDER BY created_at DESC').all();
  
  // Tarik Paket Voucher
  const { results: voucherPackages } = await c.env.DB.prepare("SELECT * FROM voucher_packages WHERE is_active = 1 ORDER BY sell_price ASC").all();
  
  // Tarik Riwayat Voucher User
  let myVouchers: any[] = [];
  if (isUserLoggedIn) {
      const res = await c.env.DB.prepare("SELECT code, discount_value, used_count, is_active, created_at FROM coupons WHERE purchaser_id = ? AND is_voucher = 1 ORDER BY created_at DESC").bind(userId).all();
      myVouchers = res.results;
  }

  const formatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
  const safeItemsJson = JSON.stringify(promoItems).replace(/</g, '\\u003c');

  return c.render(
    <div class="bg-gray-100 dark:bg-gray-900 min-h-screen font-sans">
      <style dangerouslySetInnerHTML={{
        __html: `
          .hide-scrollbar::-webkit-scrollbar { display: none; }
          .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          .pb-safe { padding-bottom: env(safe-area-inset-bottom, 20px); }
          details > summary { list-style: none; }
          details > summary::-webkit-details-marker { display: none; }
          .tab-active { border-bottom-color: #ee4d2d; color: #ee4d2d; }
          .tab-inactive { border-bottom-color: transparent; color: #6b7280; }
        `
      }} />

      <div class="max-w-md mx-auto bg-gray-50 dark:bg-gray-800 min-h-screen relative shadow-2xl pb-24 overflow-x-hidden transition-colors duration-300">
        
        {/* HEADER */}
        <div class="bg-white dark:bg-gray-800 px-4 pt-6 pb-2 shadow-sm sticky top-0 z-30 border-b border-gray-100 dark:border-gray-700">
          <div class="flex items-center gap-3 mb-2">
            <a href="/users" class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-200 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
            </a>
            <h1 class="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
              <svg class="w-6 h-6 text-[#ee4d2d]" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"></path></svg>
              Promo & Gift
            </h1>
          </div>
          {/* TAB SWITCHER */}
          <div class="flex w-full mt-2">
            <button onclick="switchTab('promo')" id="btn-tab-promo" class="flex-1 pb-3 text-sm font-black border-b-2 tab-active transition-colors">Menu Diskon</button>
            <button onclick="switchTab('voucher')" id="btn-tab-voucher" class="flex-1 pb-3 text-sm font-black border-b-2 tab-inactive transition-colors dark:text-gray-400">Beli Voucher</button>
          </div>
        </div>

        {/* ==============================================
            TAB 1: MENU PROMO
            ============================================== */}
        <div id="tab-promo" class="block animate-fade-in">
            {appPromos.length > 0 && (
            <div class="px-4 mt-5">
                <div class="relative w-full h-40 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 bg-gray-200 dark:bg-gray-700 group">
                {appPromos.map((promo: any, index: number) => (
                    <a href={promo.action_url || '#'} class={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${index === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} data-slide={index}>
                    <img src={promo.image} class="w-full h-full object-cover" alt="Promo Banner" />
                    </a>
                ))}
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

            <div class="mt-4 pb-8">
            <div class="px-4 flex justify-between items-center mb-4">
                <h3 class="text-base font-black text-gray-900 dark:text-white">Sedang Diskon Hari Ini</h3>
            </div>
            
            <div class="grid grid-cols-2 gap-3 px-4">
                {promoItems.length === 0 ? (
                <div class="col-span-2 text-center py-10 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                    <span class="text-gray-400 font-bold text-sm">Belum ada promo saat ini.</span>
                </div>
                ) : promoItems.map((item: any) => {
                const isOutOfStock = item.stock === 0;
                const discountPercent = Math.round(((item.price - item.promo_price) / item.price) * 100);

                return (
                    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-red-100 dark:border-gray-700 flex flex-col overflow-hidden group relative">
                    <div class="absolute top-0 left-0 bg-[#ee4d2d] text-white text-[10px] font-black px-2 py-0.5 rounded-br-lg z-10 shadow-sm">{discountPercent}% OFF</div>
                    <div class="relative h-36 w-full bg-gray-50 dark:bg-gray-700 overflow-hidden cursor-pointer" onclick={`openProductDetail('${item.id}')`}>
                        <img src={item.image || 'https://via.placeholder.com/150'} class={`w-full h-full object-cover transition-transform duration-500 ${isOutOfStock ? 'opacity-50 grayscale' : 'group-hover:scale-105'}`} />
                        {isOutOfStock && <div class="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-[2px] flex items-center justify-center"><span class="bg-gray-900 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-md">HABIS</span></div>}
                    </div>
                    <div class="p-3 flex flex-col flex-1 justify-between">
                        <div>
                        <h4 class="text-xs font-bold text-gray-900 dark:text-white line-clamp-2 leading-snug mb-1 cursor-pointer" onclick={`openProductDetail('${item.id}')`}>{item.name}</h4>
                        <div class="flex flex-col">
                            <span class="text-[10px] font-medium text-gray-400 line-through">{formatter.format(item.price)}</span>
                            <span class="text-sm font-black text-[#ee4d2d]">{formatter.format(item.promo_price)}</span>
                        </div>
                        </div>
                        <div class="mt-3 flex justify-between items-end">
                        <span class="text-[9px] font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">Sisa: {item.stock}</span>
                        {item.is_custom === 1 ? (
                            <button onclick={!isOutOfStock ? `openProductDetail('${item.id}')` : undefined} disabled={isOutOfStock} class={`text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm transition-colors ${isOutOfStock ? 'bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-500 cursor-not-allowed' : 'bg-orange-50 text-[#ee4d2d] hover:bg-[#ee4d2d] hover:text-white'}`}>Pilih</button>
                        ) : (
                            <button onclick={!isOutOfStock ? `addToCart('${item.id}', '${item.name.replace(/'/g, "\\'")}', ${item.promo_price})` : undefined} disabled={isOutOfStock} class={`w-7 h-7 rounded-full flex items-center justify-center shadow-sm transition-transform active:scale-90 ${isOutOfStock ? 'bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-500 cursor-not-allowed' : 'bg-[#ee4d2d] text-white hover:bg-orange-700'}`}><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg></button>
                        )}
                        </div>
                    </div>
                    </div>
                )
                })}
            </div>
            </div>
        </div>

        {/* ==============================================
            TAB 2: BELI VOUCHER DIGITAL
            ============================================== */}
        <div id="tab-voucher" class="hidden animate-fade-in p-4">
           <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4 rounded-xl mb-6">
              <h3 class="text-sm font-black text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-1.5">
                 <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm4.707 3.707a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L8.414 9H14a1 1 0 100-2H8.414l1.293-1.293z" clip-rule="evenodd"></path></svg>
                 Kirim Hadiah Praktis!
              </h3>
              <p class="text-[10px] text-blue-600 dark:text-blue-400">Beli e-Voucher ini untuk Anda gunakan sendiri atau berikan screenshot-nya ke teman dan keluarga sebagai traktiran!</p>
           </div>

           <h3 class="text-base font-black text-gray-900 dark:text-white mb-3">Paket Voucher Hemat</h3>
           <div class="grid grid-cols-2 gap-3">
              {voucherPackages.map((vp: any) => (
                <div class="bg-gradient-to-br from-[#ff7337] to-[#ee4d2d] rounded-2xl p-4 text-white shadow-md relative overflow-hidden group">
                   <div class="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full group-hover:scale-150 transition-transform"></div>
                   <h4 class="font-black text-lg leading-none">{formatter.format(vp.voucher_value)}</h4>
                   {vp.bulk_qty > 1 && <span class="bg-white text-[#ee4d2d] text-[9px] font-black px-1.5 py-0.5 rounded mt-1 inline-block">Isi {vp.bulk_qty} Kupon</span>}
                   <div class="mt-4 flex flex-col">
                      {vp.sell_price < (vp.voucher_value * vp.bulk_qty) && <span class="text-[9px] line-through opacity-70">{formatter.format(vp.voucher_value * vp.bulk_qty)}</span>}
                      <span class="text-sm font-bold">Harga: {formatter.format(vp.sell_price)}</span>
                   </div>
                   <button onclick={`buyVoucherTemplate('${vp.id}')`} class="mt-3 w-full bg-white text-[#ee4d2d] text-xs font-black py-2 rounded-xl shadow active:scale-95 transition-transform relative z-10">Beli Sekarang</button>
                </div>
              ))}
           </div>

           <div class="mt-6 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h4 class="font-bold text-sm text-gray-900 dark:text-white mb-1">Nominal Bebas (Custom)</h4>
              <p class="text-[10px] text-gray-500 mb-3">Buat voucher dengan nominal spesifik (Minimal Rp 10.000)</p>
              <div class="flex gap-2">
                 <input type="number" id="input-custom-vch" placeholder="Contoh: 150000" class="flex-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#ee4d2d] text-gray-900 dark:text-white" />
                 <button onclick="buyCustomVoucher()" class="bg-gray-800 dark:bg-gray-700 text-white font-bold px-5 rounded-xl text-sm shadow-sm active:scale-95 transition-transform">Beli</button>
              </div>
           </div>

           {/* RIWAYAT KUPON */}
           <div class="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 class="text-base font-black text-gray-900 dark:text-white mb-3 flex justify-between items-end">
                 Voucher Milik Saya
                 <span class="text-[10px] font-normal text-gray-500">Tap untuk cetak</span>
              </h3>
              
              <div class="space-y-3">
                 {!isUserLoggedIn ? (
                    <div class="text-center py-6"><a href="/users/login" class="text-xs font-bold text-[#ee4d2d] hover:underline">Login untuk melihat kupon Anda</a></div>
                 ) : myVouchers.length === 0 ? (
                    <div class="text-center text-xs text-gray-400 py-6 border border-dashed rounded-xl border-gray-200 dark:border-gray-700">Belum ada kupon yang dibeli.</div>
                 ) : myVouchers.map((v: any) => {
                    const isUsed = v.used_count >= 1 || v.is_active === 0;
                    // Masking: K12***89A
                    const maskedCode = v.code.substring(0, 3) + '****' + v.code.substring(7, 10);
                    return (
                        <div onclick={!isUsed ? `showVoucherModal('${v.code}', ${v.discount_value})` : undefined} class={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border flex justify-between items-center transition-transform ${isUsed ? 'opacity-60 border-gray-100 dark:border-gray-700 grayscale' : 'border-green-100 cursor-pointer active:scale-95 hover:border-green-300'}`}>
                           <div>
                              <p class="font-mono font-black text-lg tracking-widest text-gray-900 dark:text-white">{maskedCode}</p>
                              <p class="text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-0.5">Nilai: <span class="font-bold text-[#ee4d2d]">{formatter.format(v.discount_value)}</span></p>
                           </div>
                           <span class={`text-[10px] font-black px-2 py-1 rounded-full ${isUsed ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-600 border border-green-200'}`}>
                              {isUsed ? 'Terpakai' : 'Siap Pakai'}
                           </span>
                        </div>
                    )
                 })}
              </div>
           </div>
        </div>

        {/* =========================================================
            MODAL VOUCHER FULL UNTUK SCREENSHOT
            ========================================================= */}
        <div id="voucher-full-modal" class="fixed inset-0 z-[120] hidden items-center justify-center p-6 bg-black/80 backdrop-blur-sm opacity-0 transition-opacity">
           <div id="vfm-inner" class="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl transform scale-95 transition-transform text-center relative print:shadow-none print:w-[58mm] print:max-w-none print:m-0 print:rounded-none">
              <button onclick="closeVoucherModal()" class="absolute top-4 right-4 text-gray-400 hover:text-gray-700 print:hidden"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
              
              <div class="bg-[#ee4d2d] p-6 text-white pb-10">
                 <h2 class="font-black text-xl mb-1 tracking-tight">KEDAI PANGSIT KEMBAR 88</h2>
                 <p class="text-xs opacity-90">E-Voucher Digital Spesial</p>
              </div>
              <div class="bg-white mx-6 -mt-6 rounded-xl shadow-lg p-5 border border-gray-100 relative">
                 <p class="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Nilai Voucher</p>
                 <h3 id="vfm-value" class="text-3xl font-black text-[#ee4d2d] mb-4">Rp 0</h3>
                 
                 <div class="border-t border-dashed border-gray-300 pt-4 mb-2">
                    <p class="text-[10px] text-gray-500 mb-1">KODE KUPON (KASIR / APLIKASI)</p>
                    <p id="vfm-code" class="font-mono text-2xl font-black tracking-[0.2em] text-gray-900 bg-gray-50 py-2 rounded-lg border border-gray-200 select-all"></p>
                 </div>
              </div>
              <div class="p-6 bg-gray-50 mt-4 print:hidden">
                 <button onclick="window.print()" class="w-full bg-gray-900 text-white font-bold py-3 rounded-xl shadow-md active:scale-95 transition flex items-center justify-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                    Cetak / Simpan PDF
                 </button>
                 <p class="text-[9px] text-gray-400 mt-3">Silakan Screenshot halaman ini dan berikan ke kasir atau masukkan ke halaman keranjang.</p>
              </div>
           </div>
        </div>

        {/* MODAL BOTTOM SHEET DETAIL PRODUK & KUSTOMISASI (SPOILER) */}
        <div id="product-detail-modal" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] hidden flex flex-col justify-end opacity-0 transition-opacity duration-300">
          <div class="bg-white dark:bg-gray-800 w-full max-w-md mx-auto rounded-t-3xl max-h-[85vh] flex flex-col transform translate-y-full transition-transform duration-300 mb-[60px]" id="pdm-inner">
            <div class="relative h-56 bg-gray-100 dark:bg-gray-700 rounded-t-3xl flex-shrink-0">
              <img id="pdm-image" src="" class="w-full h-full object-cover rounded-t-3xl" />
              <button onclick="closeProductDetail()" class="absolute top-4 right-4 w-8 h-8 bg-black/40 text-white rounded-full flex items-center justify-center backdrop-blur-md hover:bg-black/60 transition-colors shadow-sm"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            </div>
            <div class="p-5 overflow-y-auto flex-1 hide-scrollbar pb-6">
              <h2 id="pdm-name" class="text-xl font-black text-gray-900 dark:text-white leading-tight"></h2>
              <p id="pdm-desc" class="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed"></p>
              <div class="mt-3 flex items-center gap-2">
                 <span id="pdm-price" class="text-lg font-black text-[#ee4d2d]"></span>
                 <span id="pdm-original-price" class="text-xs font-bold text-gray-400 dark:text-gray-500 line-through hidden"></span>
              </div>
              <div id="pdm-custom-container" class="mt-6 space-y-3"></div>
            </div>
            <div class="p-3 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center gap-3 flex-shrink-0 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.05)]">
              <div class="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg px-1 border border-gray-200 dark:border-gray-600">
                <button onclick="updateQty(-1)" class="w-8 h-8 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold text-lg hover:bg-gray-200 dark:hover:bg-gray-600 rounded-l-lg transition">-</button>
                <span id="pdm-qty" class="w-6 text-center font-bold text-sm text-gray-900 dark:text-white">1</span>
                <button onclick="updateQty(1)" class="w-8 h-8 flex items-center justify-center text-[#ee4d2d] font-bold text-lg hover:bg-gray-200 dark:hover:bg-gray-600 rounded-r-lg transition">+</button>
              </div>
              <button id="pdm-add-btn" class="flex-1 bg-[#ee4d2d] text-white py-2.5 px-3 rounded-lg text-sm font-bold shadow-sm shadow-[#ee4d2d]/30 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5" onclick="submitProductToCart()">
                <span>Tambah</span><span class="w-1 h-1 rounded-full bg-white/50"></span><span id="pdm-total-btn-price"></span>
              </button>
            </div>
          </div>
        </div>

        {/* BOTTOM NAVIGATION BAR */}
        <div class="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.08)] z-[40]">
          <div class="flex justify-around items-center h-[60px] px-2 pb-safe">
            <a href="/users" class="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-[#ee4d2d] transition-colors"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path></svg><span class="text-[10px] font-semibold">Home</span></a>
            <a href="/users/promos" class="flex flex-col items-center gap-1 text-[#ee4d2d]"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg><span class="text-[10px] font-bold">Promo</span></a>
            <a href="/users/cart" class="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-[#ee4d2d] transition-colors relative"><div id="nav-cart-badge" class="absolute -top-1 -right-1 bg-[#ee4d2d] text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 hidden">0</div><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg><span class="text-[10px] font-semibold">Keranjang</span></a>
            <a href="/users/orders" class="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-[#ee4d2d] transition-colors"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg><span class="text-[10px] font-semibold">Order</span></a>
            <a href="/users/profile" class="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-[#ee4d2d] transition-colors"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg><span class="text-[10px] font-semibold">Profile</span></a>
          </div>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
        const PRODUCTS = ${safeItemsJson};
        const formatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
        let cart = JSON.parse(localStorage.getItem('spos_cart')) || [];
        let currentActiveProduct = null;
        let currentQty = 1; let basePrice = 0; let additionalPrice = 0;

        // --- TAB SWITCHER ---
        function switchTab(tab) {
           document.getElementById('tab-promo').classList.add('hidden');
           document.getElementById('tab-voucher').classList.add('hidden');
           document.getElementById('btn-tab-promo').className = 'flex-1 pb-3 text-sm font-black border-b-2 tab-inactive transition-colors dark:text-gray-400';
           document.getElementById('btn-tab-voucher').className = 'flex-1 pb-3 text-sm font-black border-b-2 tab-inactive transition-colors dark:text-gray-400';
           
           document.getElementById('tab-'+tab).classList.remove('hidden');
           document.getElementById('btn-tab-'+tab).className = 'flex-1 pb-3 text-sm font-black border-b-2 tab-active transition-colors';
        }

        // --- VOUCHER LOGIC ---
        function getAuthToken() {
           const value = "; " + document.cookie;
           const parts = value.split("; token=");
           if (parts.length === 2) return parts.pop().split(";").shift();
           return null;
        }

        async function executeVoucherCheckout(payload) {
           const token = getAuthToken();
           if (!token) { window.location.href = '/users/login'; return; }
           
           showToast('Memproses request voucher...');
           try {
             const res = await fetch('/api/v1/protected/user/orders/checkout-voucher', {
               method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
               body: JSON.stringify(payload)
             });
             const data = await res.json();
             if (data.success) {
                window.location.href = '/users/orders/' + data.data.order_id;
             } else {
                showToast(data.message || 'Gagal membuat pesanan.', true);
             }
           } catch(e) { showToast('Gangguan Jaringan', true); }
        }

        function buyVoucherTemplate(pkgId) { executeVoucherCheckout({ package_id: pkgId }); }
        
        function buyCustomVoucher() {
           const val = parseInt(document.getElementById('input-custom-vch').value);
           if (!val || val < 10000) { showToast('Minimal custom voucher adalah Rp 10.000', true); return; }
           executeVoucherCheckout({ custom_amount: val });
        }

        function showVoucherModal(code, val) {
           document.getElementById('vfm-value').innerText = formatter.format(val);
           document.getElementById('vfm-code').innerText = code;
           const modal = document.getElementById('voucher-full-modal');
           modal.classList.remove('hidden');
           modal.classList.add('flex');
           setTimeout(() => {
              modal.classList.remove('opacity-0');
              document.getElementById('vfm-inner').classList.remove('scale-95');
           }, 10);
        }

        function closeVoucherModal() {
           const modal = document.getElementById('voucher-full-modal');
           modal.classList.add('opacity-0');
           document.getElementById('vfm-inner').classList.add('scale-95');
           setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
        }

        // --- EXISTING PROMO & CART LOGIC ---
        function initSlider() {
          let currentSlide = 0; const slides = document.querySelectorAll('[data-slide]'); const dots = document.querySelectorAll('[data-dot]');
          if(slides.length > 1) {
            setInterval(() => {
              slides[currentSlide].classList.replace('opacity-100', 'opacity-0'); slides[currentSlide].classList.replace('z-10', 'z-0');
              dots[currentSlide].classList.replace('bg-white', 'bg-white/50'); dots[currentSlide].classList.remove('scale-125');
              currentSlide = (currentSlide + 1) % slides.length;
              slides[currentSlide].classList.replace('opacity-0', 'opacity-100'); slides[currentSlide].classList.replace('z-0', 'z-10');
              dots[currentSlide].classList.replace('bg-white/50', 'bg-white'); dots[currentSlide].classList.add('scale-125');
            }, 3500);
          }
        }

        function showToast(msg, isError = false) {
          const toast = document.createElement('div');
          toast.className = \`fixed bottom-24 left-1/2 transform -translate-x-1/2 backdrop-blur-md text-white text-[11px] font-bold px-5 py-3 rounded-full shadow-2xl z-[150] flex items-center gap-2 transition-all duration-300 opacity-0 translate-y-4 border \${isError ? 'bg-red-600/95 border-red-500' : 'bg-gray-900/95 border-gray-800'}\`;
          toast.innerHTML = isError ? '<svg class="w-4 h-4 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> ' + msg : '<svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg> ' + msg;
          document.body.appendChild(toast);
          setTimeout(() => toast.classList.remove('opacity-0', 'translate-y-4'), 10);
          setTimeout(() => { toast.classList.add('opacity-0', 'translate-y-4'); setTimeout(() => toast.remove(), 300); }, 2500);
        }

        function saveCart() { localStorage.setItem('spos_cart', JSON.stringify(cart)); updateCartBadge(); }

        function updateCartBadge() {
          let totalItems = 0; cart.forEach(item => { totalItems += item.qty; });
          const badge = document.getElementById('nav-cart-badge');
          if (badge) {
            if (totalItems > 0) { badge.innerText = totalItems; badge.classList.remove('hidden'); badge.style.transform = 'scale(1.4)'; setTimeout(() => badge.style.transform = 'scale(1)', 200); } 
            else { badge.classList.add('hidden'); }
          }
        }

        function addToCart(id, name, price) {
          const product = PRODUCTS.find(p => p.id === id);
          if (!product) return;
          const existingIndex = cart.findIndex(item => item.id === id && !item.note);
          if (existingIndex > -1) cart[existingIndex].qty += 1;
          else cart.push({ id: id, name: name, price: price, image: product.image || 'https://via.placeholder.com/150', qty: 1, additional_price: 0, note: '' });
          saveCart(); showToast(name + ' ditambahkan ke pesanan!');
        }

        function submitProductToCart() {
           let noteArr = [];
           document.querySelectorAll('#pdm-custom-container input:checked').forEach(input => { const l = input.nextElementSibling; if(l) noteArr.push(l.innerText); });
           const noteStr = noteArr.join(', ');
           const existingIndex = cart.findIndex(item => item.id === currentActiveProduct.id && item.note === noteStr);
           if (existingIndex > -1) cart[existingIndex].qty += currentQty;
           else cart.push({ id: currentActiveProduct.id, name: currentActiveProduct.name, price: basePrice, image: currentActiveProduct.image || 'https://via.placeholder.com/150', qty: currentQty, additional_price: additionalPrice, note: noteStr });
           saveCart(); showToast(currentActiveProduct.name + ' ditambahkan ke pesanan!'); closeProductDetail();
        }

        function openProductDetail(id) {
          const item = PRODUCTS.find(p => p.id === id); if(!item) return;
          currentActiveProduct = item; currentQty = 1; document.getElementById('pdm-qty').innerText = currentQty;
          document.getElementById('pdm-image').src = item.image || 'https://via.placeholder.com/400';
          document.getElementById('pdm-name').innerText = item.name; document.getElementById('pdm-desc').innerText = item.description || '';
          basePrice = item.is_promo === 1 ? item.promo_price : item.price; document.getElementById('pdm-price').innerText = formatter.format(basePrice);
          const orig = document.getElementById('pdm-original-price');
          if(item.is_promo === 1) { orig.innerText = formatter.format(item.price); orig.classList.remove('hidden'); } else { orig.classList.add('hidden'); }
          const container = document.getElementById('pdm-custom-container'); container.innerHTML = ''; additionalPrice = 0;
          if(item.is_custom === 1 && item.custom_options) {
           try {
              const parsedData = JSON.parse(item.custom_options); const options = Array.isArray(parsedData) ? parsedData : (parsedData.builder || []);
              options.forEach((optGroup, groupIdx) => {
                 let html = \`<details class="group border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 transition-all duration-300 shadow-sm" open><summary class="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700/50 cursor-pointer select-none outline-none"><div class="flex items-center gap-2"><h4 class="font-black text-gray-900 dark:text-white text-sm">\${optGroup.title || optGroup.name}</h4>\${optGroup.is_required || optGroup.required ? '<span class="text-[9px] font-bold bg-orange-100 dark:bg-[#ee4d2d]/20 text-[#ee4d2d] px-1.5 py-0.5 rounded">Wajib</span>' : '<span class="text-[9px] font-medium text-gray-500 dark:text-gray-400">Opsional</span>'}</div><svg class="w-5 h-5 text-gray-400 dark:text-gray-500 transform group-open:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7-7-7-7"></path></svg></summary><div class="p-3 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">\`;
                 const choices = optGroup.choices || optGroup.options || [];
                 choices.forEach((opt, optIdx) => {
                   const inputType = optGroup.type === 'radio' ? 'radio' : 'checkbox'; const inputName = \`custom_\${groupIdx}\`; const priceText = opt.price > 0 ? \`+ \${formatter.format(opt.price)}\` : 'Gratis';
                   html += \`<label class="flex items-center justify-between py-3 px-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors rounded-lg"><div class="flex items-center gap-3"><input type="\${inputType}" name="\${inputName}" value="\${opt.price}" class="w-4 h-4 text-[#ee4d2d] bg-white dark:bg-gray-700 focus:ring-[#ee4d2d] border-gray-300 dark:border-gray-600 \${inputType==='radio'?'rounded-full':'rounded'}" onchange="recalculateModalPrice()"><span class="text-sm font-semibold text-gray-700 dark:text-gray-200">\${opt.name}</span></div><span class="text-xs font-bold text-gray-500 dark:text-gray-400">\${priceText}</span></label>\`;
                 });
                 html += '</div></details>'; container.innerHTML += html;
              });
             } catch(e) {}
          }
          recalculateModalPrice();
          const modal = document.getElementById('product-detail-modal'); const inner = document.getElementById('pdm-inner');
          modal.classList.remove('hidden'); modal.classList.add('flex');
          setTimeout(() => { modal.classList.remove('opacity-0'); inner.classList.remove('translate-y-full'); }, 10);
        }

        function closeProductDetail() {
          const modal = document.getElementById('product-detail-modal'); const inner = document.getElementById('pdm-inner');
          modal.classList.add('opacity-0'); inner.classList.add('translate-y-full');
          setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
        }

        function updateQty(delta) { if(currentQty + delta >= 1) { currentQty += delta; document.getElementById('pdm-qty').innerText = currentQty; recalculateModalPrice(); } }
        function recalculateModalPrice() { additionalPrice = 0; document.querySelectorAll('#pdm-custom-container input:checked').forEach(i => { additionalPrice += parseInt(i.value) || 0; }); const total = (basePrice + additionalPrice) * currentQty; document.getElementById('pdm-total-btn-price').innerText = formatter.format(total); }

        document.addEventListener('DOMContentLoaded', () => { updateCartBadge(); initSlider(); });
      ` }} />
    </div>
  , { title: 'Promo & Gift Voucher - Kedai Pangsit Kembar 88' })
})
