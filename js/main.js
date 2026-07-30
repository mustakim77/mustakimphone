// ==========================================
// KONEKSI SUPABASE
// ==========================================
console.log("File main.js berhasil dimuat dan siap digunakan!");

const SUPABASE_URL = 'https://btlxqbebbwtddcpzpaet.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__dVwgg315z2OT5UkioK9zw_gRdhxPP5';
const dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let globalData = [];
let currentFilteredData = [];
let currentViewedProduct = null;
let currentSlide = 0;
const totalSlides = 4; // Jumlah banner
let autoSlideTimer;
const nomorWhatsAppAdmin = "6285799860406"; 

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    startAutoSlide();

    // ==========================================
    // INJEKSI EFEK ANIMASI PINDAH HALAMAN
    // ==========================================
    const styleAnimasi = document.createElement('style');
    styleAnimasi.innerHTML = `
        .animasi-smooth {
            animation: fadeSlideUp 0.35s ease-out forwards;
        }
        @keyframes fadeSlideUp {
            0% { opacity: 0; transform: translateY(15px); }
            100% { opacity: 1; transform: none; }
        }
    `;
    document.head.appendChild(styleAnimasi);

    const daftarLayar = [
        'homeView', 'searchView', 'kategoriView', 'merekView', 
        'keranjangView', 'memberView', 'detailWorkspace', 
        'akunContainer', 'tampilanProfilTamu'
    ];
    
    daftarLayar.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('animasi-smooth');
    });

    const searchInput = document.getElementById('liveSearch');
    const clearBtn = document.getElementById('clearSearch');
    const filterService = document.getElementById('filterService');
    const filterStatus = document.getElementById('filterStatus');
    const sortPrice = document.getElementById('sortPrice');

    window.addEventListener('scroll', () => {
       const btn = document.getElementById('scrollTopBtn');
       if(btn) {
           if(window.scrollY > 200) btn.style.display = 'flex';
           else btn.style.display = 'none';
       }
    });

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const val = e.target.value;
            if (val.length > 0) {
                if (clearBtn) clearBtn.classList.remove('d-none');
            } else {
                if (clearBtn) clearBtn.classList.add('d-none');
            }
            filterAndDisplay(val);
        });
    }

    if (clearBtn) clearBtn.addEventListener('click', clearAndGoHome);

    if (filterService) {
        filterService.addEventListener('change', () => {
            if (searchInput) searchInput.value = '';
            if (clearBtn) clearBtn.classList.add('d-none');
            filterAndDisplay('');
        });
    }

    [filterStatus, sortPrice].forEach(el => {
        if (el) { 
            el.addEventListener('change', () => {
                const val = searchInput ? searchInput.value : '';
                filterAndDisplay(val);
            });
        }
    });
});

// ==========================================
// FUNGSI HELPER: PARSER TANGGAL INDONESIA
// ==========================================
function parseIndonesianDate(dateStr) {
    if (!dateStr) return 0;
    try {
        const parts = dateStr.split(', ');
        if (parts.length < 3) return 0;
        
        const dateParts = parts[1].split(' ');
        const day = parseInt(dateParts[0], 10);
        const monthName = dateParts[1];
        const year = parseInt(dateParts[2], 10);
        
        const timeParts = parts[2].split('.');
        const hour = parseInt(timeParts[0], 10) || 0;
        const minute = parseInt(timeParts[1], 10) || 0;

        const months = {
            'Januari': 0, 'Februari': 1, 'Maret': 2, 'April': 3,
            'Mei': 4, 'Juni': 5, 'Juli': 6, 'Agustus': 7,
            'September': 8, 'Oktober': 9, 'November': 10, 'Desember': 11
        };

        return new Date(year, months[monthName] || 0, day, hour, minute).getTime();
    } catch (e) {
        return 0;
    }
}

// ==========================================
// FUNGSI NOTIFIKASI (TOAST)
// ==========================================
function showToast(message) {
    const toast = document.getElementById('toastMessage');
    if(toast) {
        toast.innerText = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
    }
}

// ==========================================
// FUNGSI NAVIGASI BAWAH
// ==========================================
function switchNav(tabName, element) {
    try {
        closeDetail();
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        if (element) element.classList.add('active');

        const views = ['homeView', 'searchView', 'kategoriView', 'merekView', 'keranjangView', 'memberView'];
        views.forEach(viewId => {
            const v = document.getElementById(viewId);
            if (v) v.classList.add('d-none');
        });

        const ft = document.getElementById('filterToolbar');
        if (ft) ft.classList.add('d-none');
        
        const backBtn = document.getElementById('backToHomeBtn');
        if (backBtn) backBtn.classList.add('d-none');
        
        const appLogo = document.getElementById('appLogo');
        if (appLogo) appLogo.classList.remove('d-none');

        if (tabName === 'home') {
            clearAndGoHome();
        } else if (tabName === 'Kategori') {
            const kv = document.getElementById('kategoriView');
            if(kv) kv.classList.remove('d-none');
            window.scrollTo(0, 0);
        } else if (tabName === 'Merek') {
            const mv = document.getElementById('merekView');
            if(mv) mv.classList.remove('d-none');
            if (typeof generateMerekList === 'function') generateMerekList(); 
            window.scrollTo(0, 0);
        } else if (tabName === 'Keranjang') {
            const cv = document.getElementById('keranjangView');
            if(cv) cv.classList.remove('d-none');
            if (typeof renderCart === 'function') renderCart(); 
            window.scrollTo(0, 0);
        } else if (tabName === 'Member') {
            const memv = document.getElementById('memberView');
            if(memv) memv.classList.remove('d-none');
            window.scrollTo(0, 0);
        }
    } catch (error) {
        console.error("Error Navigasi: ", error);
        clearAndGoHome(); 
        showToast("Kembali ke Beranda.");
    }
}

function closeDetail() {
    const dh = document.getElementById('detailHeader');
    if(dh) dh.classList.add('d-none');
    
    const dw = document.getElementById('detailWorkspace');
    if(dw) dw.classList.add('d-none');
    
    const ah = document.getElementById('appHeader');
    if(ah) ah.classList.remove('d-none');
    
    const mw = document.getElementById('mainWorkspace');
    if(mw) mw.classList.remove('d-none');
    
    const bn = document.getElementById('bottomNav');
    if(bn) bn.classList.remove('d-none');
}

function generateMerekList() {
    const container = document.getElementById('merekContainer');
    if (!container) return;
    
    if (!globalData || globalData.length === 0) {
        container.innerHTML = '<div class="col-12 p-5 text-center text-muted">Data belum tersedia</div>';
        return;
    }

    const merekSet = new Set();
    globalData.forEach(row => {
        if (row[1]) merekSet.add(String(row[1]).trim().toUpperCase());
    });
    
    const mereks = Array.from(merekSet).sort();
    let html = '';
    
    mereks.forEach(m => {
        html += `
        <div class="col-4 p-3 border-end border-bottom text-center" onclick="searchCategory('${m}')" style="cursor:pointer;">
            <div class="cat-circle mx-auto mb-2 bg-white text-dark shadow-sm border" style="width:70px; max-height:70px; font-size:1.5rem;">
               <img src="https://i.ibb.co/TqHz30ng/logo-default.png" alt="DEFAULT" class="img-fluid pointer-events-none" style="max-height: 94%; width: auto; object-fit: contain;">
            </div>
            <span class="fw-bold text-dark" style="font-size:0.8rem;">${m}</span>
        </div>
        `;
    });
    container.innerHTML = html;
}

function searchCategory(keyword) {
    const input = document.getElementById('liveSearch');
    const clearBtn = document.getElementById('clearSearch');
    const filterService = document.getElementById('filterService');
    
    if (input) input.value = keyword;
    if (clearBtn) {
        if (keyword.trim() !== '') clearBtn.classList.remove('d-none');
        else clearBtn.classList.add('d-none');
    }
    
    if (filterService) {
        if (keyword.includes('LCD')) filterService.value = 'LCD';
        else if (keyword.includes('BAT')) filterService.value = 'BAT';
        else if (keyword.includes('SERVICE')) filterService.value = 'SERVICE';
        else filterService.value = 'ALL';
    }
    
    const kv = document.getElementById('kategoriView');
    if(kv) kv.classList.add('d-none');
    
    const mv = document.getElementById('merekView');
    if(mv) mv.classList.add('d-none');

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const firstNav = document.querySelector('.nav-item');
    if(firstNav) firstNav.classList.add('active');
    
    filterAndDisplay(keyword);
    window.scrollTo({top: 0, behavior: 'smooth'});
}

function clearAndGoHome() {
    const input = document.getElementById('liveSearch');
    const clearBtn = document.getElementById('clearSearch');
    const filterService = document.getElementById('filterService');
    const filterStatus = document.getElementById('filterStatus');
    const sortPrice = document.getElementById('sortPrice');
    
    if(input) input.value = '';
    if(filterService) filterService.value = 'ALL';
    if(filterStatus) filterStatus.value = 'ALL';
    if(sortPrice) sortPrice.value = 'DEFAULT';
    if(clearBtn) clearBtn.classList.add('d-none');
    
    closeDetail(); 
    currentFilteredData = []; 
    
    const kv = document.getElementById('kategoriView');
    if(kv) kv.classList.add('d-none');
    const mv = document.getElementById('merekView');
    if(mv) mv.classList.add('d-none');
    const cv = document.getElementById('keranjangView');
    if(cv) cv.classList.add('d-none');
    const memv = document.getElementById('memberView');
    if(memv) memv.classList.add('d-none');
    
    filterAndDisplay(''); 
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const firstNav = document.querySelector('.nav-item');
    if(firstNav) firstNav.classList.add('active');
}

// ==========================================
// PENGAMBILAN DATA DARI SUPABASE
// ==========================================
async function loadData() {
    const loader = document.getElementById('loadingState');
    if (loader) loader.style.display = 'block';

    try {
        const { data, error } = await dbClient
            .from('data_service')
            .select('*'); // Tanpa order timestamp agar data lengkap dan tidak null

        if (error) throw error;

        globalData = data.map(item => [
            item.id,
            item.merk_hp,
            item.type_hp,
            item.jenis_service,
            item.harga,
            item.garansi,
            item.keterangan,
            item.status,
            item.update
        ]);

        if (loader) loader.style.display = 'none';
        filterAndDisplay('');
        renderLatestProducts();
    } catch (e) {
        showError("Gagal memuat data: " + e.message);
    }
}

function showError(msg) {
    const loader = document.getElementById('loadingState');
    if (loader) {
        loader.style.display = 'block';
        loader.innerHTML = `
        <div class="alert alert-danger mx-auto mt-3 border-0 shadow-sm" style="max-width: 90%; border-radius:8px;">
            <strong><i class="fa-solid fa-triangle-exclamation"></i> Kesalahan</strong><br>
            <span style="font-size: 0.85rem;">${msg}</span>
        </div>`;
    }
}

// ==========================================
// LOGIKA PENCARIAN & TAMPILAN PRODUK
// ==========================================
function filterAndDisplay(keyword) {
    const container = document.getElementById('resultContainer');
    const homeView = document.getElementById('homeView');
    const searchView = document.getElementById('searchView');
    const filterToolbar = document.getElementById('filterToolbar');
    const backBtn = document.getElementById('backToHomeBtn');
    const appLogo = document.getElementById('appLogo');
    
    if (!container) return;
    
    const fs = document.getElementById('filterService');
    const filterServiceVal = fs ? fs.value : 'ALL';
    const fst = document.getElementById('filterStatus');
    const filterStatusVal = fst ? fst.value : 'ALL';
    const sp = document.getElementById('sortPrice');
    const sortPriceVal = sp ? sp.value : 'DEFAULT';
    
    const lowerKeyword = (keyword || '').toLowerCase().trim();
    
    if (lowerKeyword === '' && filterServiceVal === 'ALL' && filterStatusVal === 'ALL') {
        currentFilteredData = []; 
        if(homeView) homeView.classList.remove('d-none');
        if(searchView) searchView.classList.add('d-none');
        if(filterToolbar) filterToolbar.classList.add('d-none');
        if(backBtn) backBtn.classList.add('d-none');
        if(appLogo) appLogo.classList.remove('d-none');
        renderLatestProducts();
        return;
    } else {
        if(homeView) homeView.classList.add('d-none');
        if(searchView) searchView.classList.remove('d-none');
        if(filterToolbar) filterToolbar.classList.remove('d-none');
        if(backBtn) backBtn.classList.remove('d-none');
        if(appLogo) appLogo.classList.add('d-none');
    }

    if (!globalData || globalData.length === 0) {
        container.innerHTML = `
          <div class="text-center py-5">
             <div class="spinner-border text-primary mb-2" role="status"></div>
             <p class="text-secondary" style="font-size: 0.85rem;">Menyiapkan data...</p>
          </div>
        `;
        return;
    }
    
    let results = globalData.filter(row => {
        if(!row) return false;
        const searchString = `${row[1]} ${row[2]} ${row[3]} ${row[6]}`.toLowerCase();
        const service = String(row[3] || '').toUpperCase();
        const status = String(row[7] || '').trim().toLowerCase() || 'kosong';

        const isKeywordMatch = lowerKeyword === '' || searchString.includes(lowerKeyword);
        const isServiceMatch = filterServiceVal === 'ALL' || service.includes(filterServiceVal.toUpperCase());
        const isStatusMatch = filterStatusVal === 'ALL' || status === filterStatusVal.toLowerCase();
        
        return isKeywordMatch && isServiceMatch && isStatusMatch;
    });
    
    if (sortPriceVal !== 'DEFAULT') {
        results.sort((a, b) => {
            const hargaA = parseInt(String(a[4] || '0').replace(/[^0-9]/g, '')) || 0;
            const hargaB = parseInt(String(b[4] || '0').replace(/[^0-9]/g, '')) || 0;
            return sortPriceVal === 'LOW' ? (hargaA - hargaB) : (hargaB - hargaA);
        });
    }
    
    currentFilteredData = results; 

    if (results.length === 0) {
        container.innerHTML = `
          <div class="text-center py-5 mt-4">
                <i class="fa-solid fa-box-open fs-1 mb-2 text-secondary opacity-50"></i>
                <h6 class="fw-bold text-dark">Tidak Ditemukan</h6>
                <p class="text-secondary" style="font-size: 0.85rem;">Data belum tersedia.</p>
          </div>`;
        return;
    }
    
    let html = '<div class="row g-2 px-1">';
    results.forEach((row, idx) => {
        const merk = row[1] || '';
        const type = row[2] || '';
        const service = row[3] ? row[3].toUpperCase() : '';
        const harga = formatRupiah(row[4] || 0);
        const keterangan = row[6] ? String(row[6]).trim() : ''; 
        let imageUrl = getProductImage(service);

        html += `
        <div class="col-6 col-md-3">
            <div class="card h-100 border-0 shadow-sm product-card mb-2 me-2" style="border-radius: 8px; cursor: pointer;" onclick="showDetail(${idx})">
              <div class="bg-white position-relative d-flex justify-content-center align-items-center" style="height: 100px; border-bottom: 1px solid #f0f0f0;">
                    <img src="${imageUrl}" style="max-height: 70px; max-width: 90%; object-fit: contain;">
                </div>
                <div class="card-body p-2 d-flex flex-column bg-white">
                    <h6 class="fw-bold text-dark text-truncate-2 mb-1" style="font-size: 0.8rem; line-height: 1.3;">${merk} ${type}</h6>
                    <h6 class="fw-bold text-secondary text-truncate-2 mb-1" style="font-size: 0.75rem;">${keterangan}</h6>
                    <span class="text-primary fw-bolder" style="font-size: 0.8rem;">${harga}</span>
                </div>
            </div>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

function showDetail(idx) {
    let row;
    const homeView = document.getElementById('homeView');
    if (homeView && !homeView.classList.contains('d-none')) {
        row = globalData[idx];
    } else {
        row = currentFilteredData[idx] || globalData[idx];
    }
    if (!row) return;
    
    const kodeBarang = row[0] ? String(row[0]).trim() : '-';
    const merk = row[1] || '';
    const type = row[2] || '';
    const service = row[3] ? String(row[3]).toUpperCase() : 'SPAREPART';
    const hargaNum = parseInt(String(row[4] || '0').replace(/[^0-9]/g, '')) || 0;
    const harga = formatRupiah(hargaNum);
    const hargaCoret = hargaNum > 0 ? formatRupiah(hargaNum * 1.2) : '';
    
    currentViewedProduct = { id: kodeBarang, title: `${merk} ${type}`, price: hargaNum, service: service };

    const elTitle = document.getElementById('detailTitle');
    if(elTitle) elTitle.innerText = `${merk} ${type}`;
    const elDesc = document.getElementById('detailFullDesc');
    if(elDesc) elDesc.innerText = `${service} ${merk} ${type}`;
    const elPrice = document.getElementById('detailPrice');
    if(elPrice) elPrice.innerText = harga;
    const elCross = document.getElementById('detailCrossPrice');
    if(elCross) elCross.innerText = hargaCoret;
    
    const waText = `Halo MUSTAKIM PHONE, \n\n*${service}*\n*${merk} ${type}*\nHarga: ${harga}\n\nApakah tersedia?`;
    const elWa = document.getElementById('detailWaBtn');
    if(elWa) elWa.href = `https://wa.me/${nomorWhatsAppAdmin}?text=${encodeURIComponent(waText)}`;

    document.getElementById('appHeader').classList.add('d-none');
    document.getElementById('mainWorkspace').classList.add('d-none');
    document.getElementById('bottomNav').classList.add('d-none');
    
    document.getElementById('detailHeader').classList.remove('d-none');
    document.getElementById('detailWorkspace').classList.remove('d-none');
    window.scrollTo(0,0);
}

// ==========================================
// RENDER 6 PART TERBARU (DENGAN SORTING TANGGAL AKURAT)
// ==========================================
function renderLatestProducts() {
    const container = document.getElementById('latestProductsContainer');
    if (!container) return;
    
    if (!globalData || globalData.length === 0) {
        container.innerHTML = '<p class="text-muted small px-2">Data kosong atau sedang memuat dari Supabase...</p>';
        return;
    }
    
    // Urutkan data berdasarkan tanggal teks Indonesia terbaru (Descending)
    const sortedData = [...globalData].sort((a, b) => {
        const timeA = parseIndonesianDate(a[8]); // Kolom update berada di indeks ke-8
        const timeB = parseIndonesianDate(b[8]);
        return timeB - timeA;
    });
    
    let latestRows = sortedData.slice(0, 6); // Ambil 6 data teratas
    let html = '<div class="row g-2 px-1">';
    
    latestRows.forEach((row) => {
        // Cari indeks asli di globalData agar fungsi showDetail() membuka data yang tepat
        const originalIndex = globalData.findIndex(item => item[0] === row[0]);

        const merk = row[1] || '';
        const type = row[2] || '';
        const service = row[3] ? row[3].toUpperCase() : '';
        const harga = formatRupiah(row[4] || 0);
        let imageUrl = getProductImage(service);

        html += `
        <div class="col-6 col-md-4">
            <div class="card border-0 shadow-sm product-card h-100" style="border-radius: 8px; cursor: pointer;" onclick="showDetail(${originalIndex})">
                <div class="bg-white position-relative d-flex justify-content-center align-items-center" style="height: 100px; border-bottom: 1px solid #f0f0f0;">
                    <span class="badge bg-primary position-absolute top-0 start-0 m-1 shadow-sm" style="font-size: 0.55rem;">BARU</span>
                    <img src="${imageUrl}" style="max-height: 70px; max-width: 90%; object-fit: contain;">
                </div>
                <div class="card-body p-2 bg-white d-flex flex-column justify-content-between">
                    <h6 class="fw-bold text-dark text-truncate-2 mb-1" style="font-size: 0.75rem;">${merk} ${type}</h6>
                    <span class="text-primary fw-bolder" style="font-size: 0.8rem;">${harga}</span>
                </div>
            </div>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

// ==========================================
// FUNGSI KERANJANG (CART)
// ==========================================
function addToCart() {
    if(!currentViewedProduct) return;
    let cart = JSON.parse(localStorage.getItem('mustakimCart')) || [];
    let existingItem = cart.find(item => item.id === currentViewedProduct.id);
    if(existingItem) { existingItem.qty += 1; } 
    else { cart.push({...currentViewedProduct, qty: 1}); }
    localStorage.setItem('mustakimCart', JSON.stringify(cart));
    showToast('Produk ditambahkan ke keranjang!');
}

function renderCart() {
    let cart = JSON.parse(localStorage.getItem('mustakimCart')) || [];
    const container = document.getElementById('cartItemsContainer');
    const checkoutBar = document.getElementById('cartCheckoutBar');
    const totalPriceEl = document.getElementById('cartTotalPrice');
    
    if (!container) return;
    if (cart.length === 0) {
        container.innerHTML = `<div class="d-flex flex-column align-items-center pt-5">
              <h5 class="fw-bold text-dark mt-4">Keranjang Kosong</h5>
              <p class="text-muted" style="font-size:0.85rem;">Yuk, cari sparepart yang kamu butuhkan!</p>
          </div>`;
        if(checkoutBar) checkoutBar.classList.add('d-none');
        return;
    }
    
    let html = '';
    let total = 0;
    
    cart.forEach((item, index) => {
        total += (item.price * item.qty);
        let serviceName = item.service ? String(item.service).toUpperCase() : "SPAREPART";
        let imageUrl = getProductImage(serviceName);
        
        html += `
        <div class="card border-0 shadow-sm mb-2" style="border-radius:12px;">
            <div class="card-body p-2 d-flex align-items-center">
                <div class="bg-light rounded p-1 d-flex align-items-center justify-content-center me-2" style="width: 60px; height: 60px;">
                    <img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: contain;">
                </div>
                <div class="flex-grow-1">
                    <h6 class="fw-bold text-dark mb-1" style="font-size:0.75rem;">${item.title}</h6>
                    <div class="text-primary fw-bolder" style="font-size:0.85rem;">${formatRupiah(item.price)}</div>
                </div>
                <div class="d-flex flex-column align-items-end ms-2">
                    <i class="fa-solid fa-trash text-muted mb-2 p-1" style="cursor:pointer;" onclick="removeFromCart(${index})"></i>
                    <div class="d-flex align-items-center bg-light rounded-pill px-2 py-1 border shadow-sm">
                        <i class="fa-solid fa-minus text-dark" style="cursor:pointer; font-size:0.7rem;" onclick="updateCartQty(${index}, -1)"></i>
                        <span class="mx-2 fw-bold text-dark" style="font-size:0.8rem;">${item.qty}</span>
                        <i class="fa-solid fa-plus text-dark" style="cursor:pointer; font-size:0.7rem;" onclick="updateCartQty(${index}, 1)"></i>
                    </div>
                </div>
            </div>
        </div>`;
    });
    container.innerHTML = html;
    if(totalPriceEl) totalPriceEl.innerText = formatRupiah(total);
    if(checkoutBar) checkoutBar.classList.remove('d-none');
}

function updateCartQty(index, delta) {
    let cart = JSON.parse(localStorage.getItem('mustakimCart')) || [];
    if (cart[index]) {
        cart[index].qty += delta;
        if (cart[index].qty <= 0) cart.splice(index, 1);
        localStorage.setItem('mustakimCart', JSON.stringify(cart));
        renderCart(); 
    }
}

function removeFromCart(index) {
    let cart = JSON.parse(localStorage.getItem('mustakimCart')) || [];
    cart.splice(index, 1);
    localStorage.setItem('mustakimCart', JSON.stringify(cart));
    renderCart();
}

function checkoutWA() {
    let cart = JSON.parse(localStorage.getItem('mustakimCart')) || [];
    if(cart.length === 0) return;
    
    let text = "Halo MUSTAKIM PHONE, saya ingin memesan produk dari Keranjang:\n\n";
    let total = 0;
    cart.forEach((item, idx) => {
        text += `*${idx+1}. ${item.title}*\n • Jml: ${item.qty} Pcs x ${formatRupiah(item.price)}\n\n`;
        total += (item.price * item.qty);
    });
    text += `*Total Estimasi Harga: ${formatRupiah(total)}*`;
    window.open(`https://wa.me/${nomorWhatsAppAdmin}?text=${encodeURIComponent(text)}`, '_blank');
}

// ==========================================
// FUNGSI PENDUKUNG LAINNYA
// ==========================================
function startAutoSlide() {
    clearInterval(autoSlideTimer); 
    autoSlideTimer = setInterval(() => {
        currentSlide = (currentSlide >= totalSlides - 1) ? 0 : currentSlide + 1; 
        updateSliderView();
    }, 5000);
}

function goToSlide(index) {
    currentSlide = index;
    updateSliderView();
    startAutoSlide();
}

function updateSliderView() {
    const slider = document.getElementById('bannerSlider');
    const dots = document.querySelectorAll('#bannerDots .dot');
    if (slider) slider.style.transform = `translateX(-${currentSlide * 100}%)`;
    if (dots.length > 0) {
        dots.forEach(dot => dot.classList.remove('active'));
        if (dots[currentSlide]) dots[currentSlide].classList.add('active');
    }
}

function formatRupiah(angka) {
    let cleanNumber = String(angka).replace(/[^0-9]/g, '');
    if (!cleanNumber || cleanNumber === "") return "Rp0";
    return new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR', minimumFractionDigits: 0
    }).format(cleanNumber).replace(/\s/g, ''); 
}

function getProductImage(serviceName) {
    if (serviceName.includes('LCD')) return 'https://i.ibb.co/whtJ0CKy/logo-lcd.png';
    if (serviceName.includes('BAT')) return 'https://i.ibb.co/cXrYM3vL/logo-bat.png';
    if (serviceName.includes('SERVICE')) return 'https://i.ibb.co/ZRcxyg1m/logo-konektor.png';
    return 'https://i.ibb.co/TqHz30ng/logo-default.png';
}

// ==========================================
// FUNGSI MEMBER & AKUN
// ==========================================
function cekSecretLogin(url) { window.location.href = url; }
function bukaMenuDaftar() {
    document.getElementById('tampilanProfilTamu').style.display = 'none';
    document.getElementById('akunContainer').style.display = 'block';
    tampilkanDaftar();
}
function bukaMenuLogin() {
    document.getElementById('tampilanProfilTamu').style.display = 'none';
    document.getElementById('akunContainer').style.display = 'block';
    tampilkanLogin();
}
function tampilkanDaftar() {
    document.getElementById('formLoginContainer').style.display = 'none';
    document.getElementById('formDaftarContainer').style.display = 'block';
}
function tampilkanLogin() {
    document.getElementById('formDaftarContainer').style.display = 'none';
    document.getElementById('formLoginContainer').style.display = 'block';
}
function kembaliKeProfilTamu() {
    document.getElementById('akunContainer').style.display = 'none';
    document.getElementById('tampilanProfilTamu').style.display = 'block';
}

function cekEnter(event) {
    if (event.key === "Enter") {
        if (event.target.id === "username") {
            document.getElementById('password').focus();
        } else if (event.target.id === "password") {
            verifikasiLogin(); 
        }
    }
}

async function verifikasiLogin() {
    const usernameInput = document.getElementById('username').value.trim();
    const passwordInput = document.getElementById('password').value.trim();
    const pesanLogin = document.getElementById('pesanLogin');

    if (!usernameInput || !passwordInput) {
        pesanLogin.style.color = 'red';
        pesanLogin.innerText = 'Username dan Password harus diisi!';
        return;
    }

    pesanLogin.style.color = '#0d6efd';
    pesanLogin.innerText = 'Memeriksa akun...';

    try {
        const { data, error } = await dbClient
            .from('admin_users')
            .select('*')
            .eq('username', usernameInput)
            .eq('password', passwordInput)
            .maybeSingle();

        if (error) throw error;

        if (data) {
            pesanLogin.style.color = 'green';
            pesanLogin.innerText = 'Login Berhasil!';
            showToast('Selamat datang, ' + data.username + '!');

            localStorage.setItem('mustakimUser', JSON.stringify(data));

            setTimeout(() => {
                if (data.role && data.role.toLowerCase() === 'admin') {
                    window.location.href = 'admin.html';
                    return;
                }

                document.getElementById('akunContainer').style.display = 'none';
                document.getElementById('memberDashboardView').style.display = 'block';
                
                const namaMember = document.getElementById('namaMemberLogin');
                if (namaMember) {
                    const capitalizedName = data.username.charAt(0).toUpperCase() + data.username.slice(1);
                    const badgeRole = data.role.toLowerCase() === 'admin' ? 'Admin' : 'Member';
                    
                    namaMember.innerHTML = `${capitalizedName} <span class="badge bg-white text-primary ms-2" style="font-size: 0.65rem; font-weight: 600; vertical-align: middle;">${badgeRole}</span>`;
                }
                
                document.getElementById('username').value = '';
                document.getElementById('password').value = '';
                pesanLogin.innerText = '';
            }, 1000);
        } else {
            pesanLogin.style.color = 'red';
            pesanLogin.innerText = 'Username atau Password salah!';
        }
    } catch (err) {
        console.error('Error Login:', err.message);
        pesanLogin.style.color = 'red';
        pesanLogin.innerText = 'Terjadi kesalahan koneksi database.';
    }
}

async function prosesDaftar() {
    const regUsername = document.getElementById('regUsername').value.trim();
    const regPassword = document.getElementById('regPassword').value.trim();
    const pesanDaftar = document.getElementById('pesanDaftar');

    if (!regUsername || !regPassword) {
        pesanDaftar.style.color = 'red';
        pesanDaftar.innerText = 'Username dan Password harus diisi!';
        return;
    }

    pesanDaftar.style.color = '#0d6efd';
    pesanDaftar.innerText = 'Mendaftarkan akun...';

    try {
        const { data: existingUser } = await dbClient
            .from('admin_users')
            .select('username')
            .eq('username', regUsername)
            .maybeSingle();

        if (existingUser) {
            pesanDaftar.style.color = 'red';
            pesanDaftar.innerText = 'Username sudah digunakan, pilih yang lain!';
            return;
        }

        const { error } = await dbClient
            .from('admin_users')
            .insert([
                { username: regUsername, password: regPassword, role: 'member' }
            ]);

        if (error) throw error;

        pesanDaftar.style.color = 'green';
        pesanDaftar.innerText = 'Pendaftaran berhasil! Silakan login.';
        showToast('Akun berhasil dibuat!');

        setTimeout(() => {
            document.getElementById('regUsername').value = '';
            document.getElementById('regPassword').value = '';
            pesanDaftar.innerText = '';
            tampilkanLogin(); 
        }, 1500);

    } catch (err) {
        console.error('Error Daftar:', err.message);
        pesanDsilat.style.color = 'red';
        pesanDaftar.innerText = 'Gagal mendaftar: ' + err.message;
    }
}

function prosesLogout() {
    localStorage.removeItem('mustakimUser');
    document.getElementById('memberDashboardView').style.display = 'none';
    document.getElementById('tampilanProfilTamu').style.display = 'block';
    showToast('Berhasil Logout');
}

function bukaFormGantiPassword() {
    document.getElementById('memberDashboardView').style.display = 'none';
    document.getElementById('formGantiPassContainer').style.display = 'block';
}

function tutupFormGantiPassword() {
    document.getElementById('formGantiPassContainer').style.display = 'none';
    document.getElementById('memberDashboardView').style.display = 'block';
}

async function simpanPasswordBaru() {
    const passLama = document.getElementById('passLama').value.trim();
    const passBaru = document.getElementById('passBaru').value.trim();
    const pesanGantiPass = document.getElementById('pesanGantiPass');

    if (!passLama || !passBaru) {
        pesanGantiPass.style.color = 'red';
        pesanGantiPass.innerText = 'Semua kolom harus diisi!';
        return;
    }

    const userSession = JSON.parse(localStorage.getItem('mustakimUser'));
    if (!userSession) {
        showToast('Sesi habis, silakan login ulang.');
        return;
    }

    try {
        if (userSession.password !== passLama) {
            pesanGantiPass.style.color = 'red';
            pesanGantiPass.innerText = 'Password lama salah!';
            return;
        }

        const { error } = await dbClient
            .from('admin_users')
            .update({ password: passBaru })
            .eq('id', userSession.id);

        if (error) throw error;

        pesanGantiPass.style.color = 'green';
        pesanGantiPass.innerText = 'Password berhasil diubah!';
        showToast('Password berhasil diperbarui');

        userSession.password = passBaru;
        localStorage.setItem('mustakim`User', JSON.stringify(userSession));

        setTimeout(() => {
            tutupFormGantiPassword();
            document.getElementById('passLama').value = '';
            document.getElementById('passBaru').value = '';
            pesanGantiPass.innerText = '';
        }, 1200);

    } catch (err) {
        console.error('Error Ganti Password:', err.message);
        pesanGantiPass.style.color = 'red';
        pesanGantiPass.innerText = 'Gagal mengubah password.';
    }
}