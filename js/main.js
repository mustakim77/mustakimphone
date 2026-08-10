// ==========================================
// KONEKSI SUPABASE & INITIALIZATION
// ==========================================
console.log("File main.js berhasil dimuat dan siap digunakan!");

const SUPABASE_URL = 'https://btlxqbebbwtddcpzpaet.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0bHhxYmViYnd0ZGRjcHpwYWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyODc3NzksImV4cCI6MjEwMDg2Mzc3OX0.UTuPztP57dSbHwt5kJ2u30sSpcE3KQJ6vioPoEM7eEs';
const dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let globalData = [];
let currentFilteredData = [];
let currentViewedProduct = null;
let currentSlide = 0;
let totalSlides = 4;
let autoSlideTimer;
const nomorWhatsAppAdmin = "6285799860406"; 
const defaultImageFallback = "https://i.postimg.cc/sfk5KptM/logo-default.png";

// Mapping Gambar Kategori (Postimages CDN)
let categoryImagesMap = {
    'GANTI LCD': 'https://i.postimg.cc/ncmGtdvm/logo-lcd.png',
    'GANTI BAT': 'https://i.postimg.cc/wBwhknd2/logo-bat.png',
    'SERVICE': 'https://i.postimg.cc/brtkpJ2Z/logo-konektor.png'
};

document.addEventListener('DOMContentLoaded', () => {
    loadCategoriesDinamis();
    loadData();
    loadBannersDinamis();
    loadBrandsDinamis();
    startAutoSlide();
    updateCartBadge();

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
        'akunContainer'
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
// TEMPLATE SKELETON SHIMMER LOADING
// ==========================================
function getSkeletonHTML(count = 6) {
    let html = '<div class="row g-2 px-1">';
    for (let i = 0; i < count; i++) {
        html += `
        <div class="col-6 col-md-3 mb-2">
            <div class="card border-0 shadow-sm skeleton-card"></div>
        </div>`;
    }
    html += '</div>';
    return html;
}

// ==========================================
// HELPER BADGE STOK & PARSER TANGGAL
// ==========================================
function getBadgeClass(status) {
    const s = String(status || '').toLowerCase().trim();
    if (s === 'ready' || s === 'tersedia') return 'badge-stok-ready';
    if (s === 'preorder' || s === 'po') return 'badge-stok-preorder';
    return 'badge-stok-empty';
}

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
// NAVIGASI APLIKASI & NAV BAR
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
            generateMerekList(); 
            window.scrollTo(0, 0);
        } else if (tabName === 'Keranjang') {
            const cv = document.getElementById('keranjangView');
            if(cv) cv.classList.remove('d-none');
            renderCart(); 
            window.scrollTo(0, 0);
        } else if (tabName === 'Member') {
            const memv = document.getElementById('memberView');
            if(memv) memv.classList.remove('d-none');
            
            const userSession = JSON.parse(localStorage.getItem('mustakimUser'));
            if (userSession) {
                document.getElementById('akunContainer').style.display = 'none';
                document.getElementById('memberDashboardView').style.display = 'block';
            } else {
                document.getElementById('memberDashboardView').style.display = 'none';
                document.getElementById('akunContainer').style.display = 'block';
                tampilkanLogin();
            }
            window.scrollTo(0, 0);
        }
    } catch (error) {
        console.error("Error Navigasi: ", error);
        clearAndGoHome(); 
        showToast("Kembali ke Beranda.");
    }
}

function prosesLogout() {
    localStorage.removeItem('mustakimUser');
    const dash = document.getElementById('memberDashboardView');
    const akun = document.getElementById('akunContainer');
    if (dash) dash.style.display = 'none';
    if (akun) akun.style.display = 'block';
    tampilkanLogin();
    showToast('Berhasil Logout');
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

// ==========================================
// RENDER KATEGORI, BANNER & BRAND DINAMIS
// ==========================================
async function loadCategoriesDinamis() {
    try {
        const { data: categories, error } = await dbClient.from('categories').select('*');
        if (error || !categories || categories.length === 0) return;

        categories.forEach(cat => {
            if (cat.name && cat.image_url) {
                categoryImagesMap[cat.name.toUpperCase()] = cat.image_url;
            }
        });

        const lcdImgHome = document.querySelector(".category-item[onclick*='LCD'] img");
        if (lcdImgHome && categoryImagesMap['GANTI LCD']) lcdImgHome.src = categoryImagesMap['GANTI LCD'];

        const batImgHome = document.querySelector(".category-item[onclick*='BAT'] img");
        if (batImgHome && categoryImagesMap['GANTI BAT']) batImgHome.src = categoryImagesMap['GANTI BAT'];

        const srvImgHome = document.querySelector(".category-item[onclick*='SERVICE'] img");
        if (srvImgHome && categoryImagesMap['SERVICE']) srvImgHome.src = categoryImagesMap['SERVICE'];

        const lcdImgKat = document.querySelector("#kategoriView [onclick*='LCD'] img");
        if (lcdImgKat && categoryImagesMap['GANTI LCD']) lcdImgKat.src = categoryImagesMap['GANTI LCD'];

        const batImgKat = document.querySelector("#kategoriView [onclick*='BAT'] img");
        if (batImgKat && categoryImagesMap['GANTI BAT']) batImgKat.src = categoryImagesMap['GANTI BAT'];

        const srvImgKat = document.querySelector("#kategoriView [onclick*='SERVICE'] img");
        if (srvImgKat && categoryImagesMap['SERVICE']) srvImgKat.src = categoryImagesMap['SERVICE'];

    } catch (e) {
        console.log("Menggunakan gambar kategori bawaan.");
    }
}

async function loadBannersDinamis() {
    try {
        const { data: banners, error } = await dbClient.from('banners').select('*');
        if (error || !banners || banners.length === 0) return;

        const slider = document.getElementById('bannerSlider');
        const dots = document.getElementById('bannerDots');
        if (!slider || !dots) return;

        slider.innerHTML = banners.map(b => `
            <div class="banner-slide flex-shrink-0 w-100" style="aspect-ratio: 3/1; height: auto;">
                <img src="${b.image_url}" onerror="this.onerror=null; this.src='${defaultImageFallback}';" loading="lazy" alt="${b.title || 'Banner Promo'}" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
        `).join('');

        dots.innerHTML = banners.map((_, i) => `
            <div class="dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></div>
        `).join('');

        totalSlides = banners.length;
        currentSlide = 0;
    } catch (e) {
        console.log("Menggunakan banner bawaan.");
    }
}

async function loadBrandsDinamis() {
    try {
        const { data: brands, error } = await dbClient.from('brands').select('*');
        if (error || !brands || brands.length === 0) return;

        window.customBrandsData = brands;
    } catch (e) {
        console.log("Menggunakan daftar merek bawaan.");
    }
}

function generateMerekList() {
    const container = document.getElementById('merekContainer');
    if (!container) return;

    if (window.customBrandsData && window.customBrandsData.length > 0) {
        container.innerHTML = window.customBrandsData.map(m => `
            <div class="col-4 p-3 border-end border-bottom text-center d-flex flex-column align-items-center justify-content-center" onclick="searchCategory('${m.name}')" style="cursor:pointer;">
                <div class="brand-logo-box mb-2 bg-white shadow-sm border p-2 d-flex align-items-center justify-content-center">
                   <img src="${m.image_url}" onerror="this.onerror=null; this.src='${defaultImageFallback}';" loading="lazy" alt="${m.name}" class="img-fluid pointer-events-none">
                </div>
                <span class="fw-bold text-dark d-block" style="font-size:0.8rem;">${m.name}</span>
            </div>
        `).join('');
        return;
    }
    
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
        <div class="col-4 p-3 border-end border-bottom text-center d-flex flex-column align-items-center justify-content-center" onclick="searchCategory('${m}')" style="cursor:pointer;">
            <div class="brand-logo-box mb-2 bg-white shadow-sm border p-2 d-flex align-items-center justify-content-center">
               <img src="${defaultImageFallback}" onerror="this.onerror=null; this.src='${defaultImageFallback}';" loading="lazy" alt="DEFAULT" class="img-fluid pointer-events-none">
            </div>
            <span class="fw-bold text-dark d-block" style="font-size:0.8rem;">${m}</span>
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
            .select('*');

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
        container.innerHTML = getSkeletonHTML(6);
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
        const stokStatus = row[7] ? String(row[7]).trim() : 'Tersedia';
        const badgeClass = getBadgeClass(stokStatus);
        let imageUrl = getProductImage(service);

        html += `
        <div class="col-6 col-md-3">
            <div class="card h-100 border-0 shadow-sm product-card mb-2 me-2" style="border-radius: 12px; cursor: pointer;" onclick="showDetail(${idx})">
              <div class="bg-white position-relative d-flex justify-content-center align-items-center" style="height: 110px; border-bottom: 1px solid #f0f0f0;">
                    <span class="badge ${badgeClass} position-absolute top-0 start-0 m-2 shadow-sm" style="font-size: 0.6rem; padding: 4px 8px; border-radius: 6px;">${stokStatus.toUpperCase()}</span>
                    <img src="${imageUrl}" onerror="this.onerror=null; this.src='${defaultImageFallback}';" loading="lazy" style="max-height: 80px; max-width: 90%; object-fit: contain;">
                </div>
                <div class="card-body p-2 d-flex flex-column bg-white justify-content-between">
                    <div>
                        <h6 class="fw-bold text-dark text-truncate-2 mb-1" style="font-size: 0.8rem; line-height: 1.3;">${merk} ${type}</h6>
                        <h6 class="fw-bold text-secondary text-truncate-2 mb-1" style="font-size: 0.72rem;">${keterangan}</h6>
                    </div>
                    <span class="text-primary fw-bolder mt-1" style="font-size: 0.82rem;">${harga}</span>
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
    const garansi = row[5] ? String(row[5]).trim() : 'Garansi Test';
    const keterangan = row[6] ? String(row[6]).trim() : '';
    const stokStatus = row[7] ? String(row[7]).trim() : 'Tersedia';
    
    currentViewedProduct = { id: kodeBarang, title: `${merk} ${type}`, price: hargaNum, service: service };

    const elTitle = document.getElementById('detailTitle');
    if (elTitle) elTitle.innerText = `${merk} ${type}`;

    const elDesc = document.getElementById('detailFullDesc');
    if (elDesc) elDesc.innerText = `${service} ${merk} ${type}${keterangan ? ' (' + keterangan + ')' : ''}`;

    const elService = document.getElementById('detailService');
    if (elService) elService.innerText = service;

    const elTag = document.getElementById('detailTag');
    if (elTag) elTag.innerText = garansi;

    const elPrice = document.getElementById('detailPrice');
    if (elPrice) elPrice.innerText = harga;

    const elCross = document.getElementById('detailCrossPrice');
    if (elCross) elCross.innerText = hargaCoret;

    const elCode = document.getElementById('detailCode');
    if (elCode) elCode.innerText = kodeBarang;

    const elStock = document.getElementById('detailStock');
    if (elStock) elStock.innerText = stokStatus;

    const lcdImg = document.getElementById('detailLcdImg');
    const batImg = document.getElementById('detailBatImg');
    const srcImg = document.getElementById('detailSrcImg');
    
    if (lcdImg) lcdImg.classList.add('d-none');
    if (batImg) batImg.classList.add('d-none');
    if (srcImg) srcImg.classList.add('d-none');

    if (service.includes('LCD')) {
        if (lcdImg) {
            if (categoryImagesMap['GANTI LCD']) lcdImg.src = categoryImagesMap['GANTI LCD'];
            lcdImg.classList.remove('d-none');
        }
    } else if (service.includes('BAT')) {
        if (batImg) {
            if (categoryImagesMap['GANTI BAT']) batImg.src = categoryImagesMap['GANTI BAT'];
            batImg.classList.remove('d-none');
        }
    } else {
        if (srcImg) {
            if (categoryImagesMap['SERVICE']) srcImg.src = categoryImagesMap['SERVICE'];
            srcImg.classList.remove('d-none');
        }
    }

    document.getElementById('appHeader').classList.add('d-none');
    document.getElementById('mainWorkspace').classList.add('d-none');
    
    document.getElementById('detailHeader').classList.remove('d-none');
    document.getElementById('detailWorkspace').classList.remove('d-none');
    window.scrollTo(0, 0);
}

// ==========================================
// RENDER 6 PART TERBARU (LATEST PRODUCTS)
// ==========================================
function renderLatestProducts() {
    const container = document.getElementById('latestProductsContainer');
    if (!container) return;
    
    if (!globalData || globalData.length === 0) {
        container.innerHTML = getSkeletonHTML(6);
        return;
    }
    
    const sortedData = [...globalData].sort((a, b) => {
        const timeA = parseIndonesianDate(a[8]);
        const timeB = parseIndonesianDate(b[8]);
        return timeB - timeA;
    });
    
    let latestRows = sortedData.slice(0, 6);
    let html = '<div class="row g-2 px-1">';
    
    latestRows.forEach((row) => {
        const originalIndex = globalData.findIndex(item => item[0] === row[0]);

        const merk = row[1] || '';
        const type = row[2] || '';
        const service = row[3] ? row[3].toUpperCase() : '';
        const harga = formatRupiah(row[4] || 0);
        const stokStatus = row[7] ? String(row[7]).trim() : 'Tersedia';
        const badgeClass = getBadgeClass(stokStatus);
        let imageUrl = getProductImage(service);

        html += `
        <div class="col-6 col-md-4 mb-1">
            <div class="card border-0 shadow-sm product-card h-100" style="border-radius: 12px; cursor: pointer;" onclick="showDetail(${originalIndex})">
                <div class="bg-white position-relative d-flex justify-content-center align-items-center" style="height: 110px; border-bottom: 1px solid #f0f0f0;">
                    <span class="badge ${badgeClass} position-absolute top-0 start-0 m-2 shadow-sm" style="font-size: 0.58rem; padding: 3px 7px; border-radius: 6px;">${stokStatus.toUpperCase()}</span>
                    <img src="${imageUrl}" onerror="this.onerror=null; this.src='${defaultImageFallback}';" loading="lazy" style="max-height: 80px; max-width: 90%; object-fit: contain;">
                </div>
                <div class="card-body p-2 bg-white d-flex flex-column justify-content-between">
                    <h6 class="fw-bold text-dark text-truncate-2 mb-1" style="font-size: 0.78rem;">${merk} ${type}</h6>
                    <span class="text-primary fw-bolder" style="font-size: 0.82rem;">${harga}</span>
                </div>
            </div>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

// ==========================================
// ORDER LANGSUNG (TANPA MASUK KERANJANG)
// ==========================================
function orderSekarangLangsung() {
    if (!currentViewedProduct) return;

    // Set item sementara (Direct Order)
    window.directOrderItem = [{
        id: currentViewedProduct.id,
        title: currentViewedProduct.title,
        price: currentViewedProduct.price,
        service: currentViewedProduct.service,
        qty: 1
    }];

    const summaryQtyEl = document.getElementById('summaryTotalQty');
    if (summaryQtyEl) summaryQtyEl.innerText = '1 Pcs';

    const summaryPriceEl = document.getElementById('summaryTotalPrice');
    if (summaryPriceEl) summaryPriceEl.innerText = formatRupiah(currentViewedProduct.price);

    const orderCatatanEl = document.getElementById('orderCatatan');
    if (orderCatatanEl) orderCatatanEl.value = currentViewedProduct.title;

    // Auto-fill data member jika login
    const userSession = JSON.parse(localStorage.getItem('mustakimUser'));
    if (userSession) {
        if (userSession.username) document.getElementById('orderNama').value = userSession.username;
        if (userSession.no_hp) document.getElementById('orderNoHp').value = userSession.no_hp;
    }

    const modalEl = document.getElementById('checkoutModal');
    if (modalEl) {
        const checkoutModal = new bootstrap.Modal(modalEl);
        checkoutModal.show();
    }
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
    updateCartBadge();
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
                    <img src="${imageUrl}" onerror="this.onerror=null; this.src='${defaultImageFallback}';" loading="lazy" style="width: 100%; height: 100%; object-fit: contain;">
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
        updateCartBadge();
        renderCart(); 
    }
}

function removeFromCart(index) {
    let cart = JSON.parse(localStorage.getItem('mustakimCart')) || [];
    cart.splice(index, 1);
    localStorage.setItem('mustakimCart', JSON.stringify(cart));
    updateCartBadge();
    renderCart();
}

// ==========================================
// FUNGSI BANNER SLIDER
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
    const s = (serviceName || '').toUpperCase();
    if (s.includes('LCD') && categoryImagesMap['GANTI LCD']) return categoryImagesMap['GANTI LCD'];
    if (s.includes('BAT') && categoryImagesMap['GANTI BAT']) return categoryImagesMap['GANTI BAT'];
    if (s.includes('SERVICE') && categoryImagesMap['SERVICE']) return categoryImagesMap['SERVICE'];
    return defaultImageFallback;
}

// ==========================================
// FUNGSI MEMBER & AUTHENTICATION
// ==========================================
function cekSecretLogin(url) { window.location.href = url; }

function bukaMenuDaftar() {
    const akun = document.getElementById('akunContainer');
    if (akun) akun.style.display = 'block';
    tampilkanDaftar();
}

function bukaMenuLogin() {
    const akun = document.getElementById('akunContainer');
    if (akun) akun.style.display = 'block';
    tampilkanLogin();
}

function kembaliKeProfilTamu() {
    clearAndGoHome();
}

// FUNGSI SHOW / HIDE PASSWORD
function togglePassword(inputId, icon) {
    const input = document.getElementById(inputId);
    if (!input) return;

    if (input.type === "password") {
        input.type = "text";
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
    } else {
        input.type = "password";
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
    }
}

// FUNGSI SLIDING TAB SWITCHER
function tampilkanLogin() {
    const slider = document.getElementById('authFormsSlider');
    const viewport = document.querySelector('.auth-forms-viewport');
    const formReset = document.getElementById('formResetContainer');
    const indicator = document.getElementById('tabIndicator');

    if (viewport) viewport.style.display = 'block';
    if (formReset) formReset.style.display = 'none';
    if (slider) slider.style.transform = 'translateX(0%)';
    if (indicator) indicator.style.transform = 'translateX(0%)';

    const tabLogin = document.getElementById('tabBtnLogin');
    const tabDaftar = document.getElementById('tabBtnDaftar');
    if (tabLogin) tabLogin.classList.add('active');
    if (tabDaftar) tabDaftar.classList.remove('active');
}

function tampilkanDaftar() {
    const slider = document.getElementById('authFormsSlider');
    const viewport = document.querySelector('.auth-forms-viewport');
    const formReset = document.getElementById('formResetContainer');
    const indicator = document.getElementById('tabIndicator');

    if (viewport) viewport.style.display = 'block';
    if (formReset) formReset.style.display = 'none';
    if (slider) slider.style.transform = 'translateX(-50%)';
    if (indicator) indicator.style.transform = 'translateX(100%)';

    const tabLogin = document.getElementById('tabBtnLogin');
    const tabDaftar = document.getElementById('tabBtnDaftar');
    if (tabDaftar) tabDaftar.classList.add('active');
    if (tabLogin) tabLogin.classList.remove('active');
}

function tampilkanResetPassword() {
    const viewport = document.querySelector('.auth-forms-viewport');
    const formReset = document.getElementById('formResetContainer');

    if (viewport) viewport.style.display = 'none';
    if (formReset) formReset.style.display = 'block';
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

// FUNGSI CEK KEKUATAN SANDI
function cekKekuatanSandi(password) {
    const bar = document.getElementById('pwStrengthBar');
    if (!bar) return;

    if (password.length === 0) {
        bar.style.width = '0%';
        bar.className = 'progress-bar';
    } else if (password.length < 6) {
        bar.style.width = '33%';
        bar.className = 'progress-bar bg-danger';
    } else if (password.length >= 6 && /\d/.test(password) && /[a-zA-Z]/.test(password)) {
        bar.style.width = '100%';
        bar.className = 'progress-bar bg-success';
    } else {
        bar.style.width = '66%';
        bar.className = 'progress-bar bg-warning';
    }
}

// VERIFIKASI LOGIN
async function verifikasiLogin() {
    const inputUser = document.getElementById('username').value.trim();
    const passwordInput = document.getElementById('password').value.trim();
    const pesanLogin = document.getElementById('pesanLogin');

    if (!inputUser || !passwordInput) {
        pesanLogin.style.color = 'red';
        pesanLogin.innerText = 'Username/No HP dan Password harus diisi!';
        return;
    }

    pesanLogin.style.color = '#007aff';
    pesanLogin.innerText = 'Memeriksa akun...';

    try {
        const { data, error } = await dbClient
            .from('admin_users')
            .select('*')
            .or(`username.eq.${inputUser},no_hp.eq.${inputUser}`)
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
            pesanLogin.innerText = 'Username/No HP atau Password salah!';
        }
    } catch (err) {
        console.error('Error Login:', err.message);
        pesanLogin.style.color = 'red';
        pesanLogin.innerText = 'Terjadi kesalahan koneksi database.';
    }
}

// PENDAFTARAN MEMBER BARU
async function prosesDaftar() {
    const regNoHpEl = document.getElementById('regNoHp');
    const regNoHp = regNoHpEl ? regNoHpEl.value.trim() : '';
    const regUsername = document.getElementById('regUsername').value.trim();
    const regPassword = document.getElementById('regPassword').value.trim();
    const pesanDaftar = document.getElementById('pesanDaftar');

    if (!regUsername || !regPassword) {
        pesanDaftar.style.color = 'red';
        pesanDaftar.innerText = 'Username dan Password wajib diisi!';
        return;
    }

    pesanDaftar.style.color = '#007aff';
    pesanDaftar.innerText = 'Mendaftarkan akun...';

    try {
        let filterOr = `username.eq.${regUsername}`;
        if (regNoHp) {
            filterOr += `,no_hp.eq.${regNoHp}`;
        }

        const { data: existingUser } = await dbClient
            .from('admin_users')
            .select('username, no_hp')
            .or(filterOr)
            .maybeSingle();

        if (existingUser) {
            pesanDaftar.style.color = 'red';
            if (regNoHp && existingUser.no_hp === regNoHp) {
                pesanDaftar.innerText = 'Nomor HP sudah terdaftar! Silakan login/reset.';
            } else {
                pesanDaftar.innerText = 'Username sudah digunakan, pilih yang lain!';
            }
            return;
        }

        const insertPayload = { username: regUsername, password: regPassword, role: 'member' };
        if (regNoHp) insertPayload.no_hp = regNoHp;

        const { error } = await dbClient
            .from('admin_users')
            .insert([insertPayload]);

        if (error) throw error;

        pesanDaftar.style.color = 'green';
        pesanDaftar.innerText = 'Pendaftaran berhasil! Silakan login.';
        showToast('Akun berhasil dibuat!');

        setTimeout(() => {
            if (regNoHpEl) regNoHpEl.value = '';
            document.getElementById('regUsername').value = '';
            document.getElementById('regPassword').value = '';
            pesanDaftar.innerText = '';
            tampilkanLogin(); 
        }, 1500);

    } catch (err) {
        console.error('Error Daftar:', err.message);
        pesanDaftar.style.color = 'red';
        pesanDaftar.innerText = 'Gagal mendaftar: ' + err.message;
    }
}

// RESET PASSWORD
async function prosesResetPassword() {
    const resetNoHpEl = document.getElementById('resetNoHp');
    const resetPassBaruEl = document.getElementById('resetPassBaru');
    const resetNoHp = resetNoHpEl ? resetNoHpEl.value.trim() : '';
    const resetPassBaru = resetPassBaruEl ? resetPassBaruEl.value.trim() : '';
    const pesanReset = document.getElementById('pesanReset');

    if (!resetNoHp || !resetPassBaru) {
        pesanReset.style.color = 'red';
        pesanReset.innerText = 'Nomor HP dan Password Baru wajib diisi!';
        return;
    }

    pesanReset.style.color = '#007aff';
    pesanReset.innerText = 'Mencari akun...';

    try {
        const { data: userAccount, error: fetchErr } = await dbClient
            .from('admin_users')
            .select('*')
            .eq('no_hp', resetNoHp)
            .maybeSingle();

        if (fetchErr) throw fetchErr;

        if (!userAccount) {
            pesanReset.style.color = 'red';
            pesanReset.innerText = 'Nomor HP tidak terdaftar! Periksa kembali.';
            return;
        }

        const { error: updateErr } = await dbClient
            .from('admin_users')
            .update({ password: resetPassBaru })
            .eq('id', userAccount.id);

        if (updateErr) throw updateErr;

        pesanReset.style.color = 'green';
        pesanReset.innerHTML = `Berhasil! Password diperbarui.<br><small class="text-dark">Username Anda: <strong>${userAccount.username}</strong></small>`;
        showToast('Password berhasil direset!');

        setTimeout(() => {
            if (resetNoHpEl) resetNoHpEl.value = '';
            if (resetPassBaruEl) resetPassBaruEl.value = '';
            pesanReset.innerText = '';
            tampilkanLogin();
        }, 2500);

    } catch (err) {
        console.error('Error Reset:', err.message);
        pesanReset.style.color = 'red';
        pesanReset.innerText = 'Gagal mereset password: ' + err.message;
    }
}

function bukaFormGantiPassword() {
    document.getElementById('memberDashboardView').style.display = 'none';
    document.getElementById('formGantiPassContainer').style.display = 'block';
}

function tutupFormGantiPassword() {
    document.getElementById('formGantiPassContainer').style.display = 'none';
    document.getElementById('memberDashboardView').style.display = 'block';
}

// ==========================================
// BADGE COUNTER KERANJANG
// ==========================================
function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    if (!badge) return;
    
    let cart = JSON.parse(localStorage.getItem('mustakimCart')) || [];
    let totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
    
    if (totalQty > 0) {
        badge.innerText = totalQty;
        badge.classList.remove('d-none');
    } else {
        badge.classList.add('d-none');
    }
}

// ==========================================
// FITUR BAGIKAN PRODUK (WEB SHARE API)
// ==========================================
function shareProduct() {
    if (!currentViewedProduct) return;
    
    const shareData = {
        title: currentViewedProduct.title,
        text: `Cek ${currentViewedProduct.title} di Mustakim Phone! Harga ${formatRupiah(currentViewedProduct.price)} (Sudah termasuk jasa pasang).`,
        url: window.location.href
    };

    if (navigator.share) {
        navigator.share(shareData).catch(() => {});
    } else {
        navigator.clipboard.writeText(shareData.text + ' ' + shareData.url);
        showToast('Link produk berhasil disalin!');
    }
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
        localStorage.setItem('mustakimUser', JSON.stringify(userSession));

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

// ==========================================
// UPDATE LINK WA HEADER SECARA DINAMIS
// ==========================================
function updateWaHeaderLink(customText) {
    const btn = document.getElementById('headerWaBtn');
    if (!btn) return;
    
    const defaultText = "Halo MUSTAKIM PHONE, saya mau tanya seputar sparepart dan service.";
    const textToSend = customText || defaultText;
    
    btn.href = `https://wa.me/${nomorWhatsAppAdmin}?text=${encodeURIComponent(textToSend)}`;
}

// ==========================================
// CHECKOUT WEB APP & SIMPAN TO SUPABASE
// ==========================================
function checkoutWA() {
    // Digunakan saat checkout via menu keranjang
    window.directOrderItem = null;
    let cart = JSON.parse(localStorage.getItem('mustakimCart')) || [];
    if (cart.length === 0) {
        showToast('Keranjang Anda masih kosong!');
        return;
    }

    let totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
    let totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    const summaryQtyEl = document.getElementById('summaryTotalQty');
    if (summaryQtyEl) summaryQtyEl.innerText = totalQty + ' Pcs';

    const summaryPriceEl = document.getElementById('summaryTotalPrice');
    if (summaryPriceEl) summaryPriceEl.innerText = formatRupiah(totalPrice);

    // Auto-fill Data Member Jika Sudah Login
    const userSession = JSON.parse(localStorage.getItem('mustakimUser'));
    if (userSession) {
        if (userSession.username) document.getElementById('orderNama').value = userSession.username;
        if (userSession.no_hp) document.getElementById('orderNoHp').value = userSession.no_hp;
    }

    // Auto-fill Catatan dengan Rincian Item dari Keranjang
    let detailItems = cart.map(item => item.title).join(', ');
    const orderCatatanEl = document.getElementById('orderCatatan');
    if (orderCatatanEl) orderCatatanEl.value = detailItems;

    const modalEl = document.getElementById('checkoutModal');
    if (modalEl) {
        const checkoutModal = new bootstrap.Modal(modalEl);
        checkoutModal.show();
    }
}

async function prosesCheckoutForm() {
    // Cek transaksi: Direct Order atau dari Keranjang Belanja
    let cart = window.directOrderItem || JSON.parse(localStorage.getItem('mustakimCart')) || [];
    if (cart.length === 0) return;

    const nama = document.getElementById('orderNama').value.trim();
    const noHp = document.getElementById('orderNoHp').value.trim();
    const catatan = document.getElementById('orderCatatan').value.trim();

    if (!nama || !noHp) {
        showToast('Nama dan Nomor WhatsApp wajib diisi!');
        return;
    }

    let total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    try {
        // 1. Simpan ke Supabase & ambil ID Auto-Increment
        const { data, error } = await dbClient
            .from('orders')
            .insert([{
                order_id: 'TEMP',
                customer_name: nama,
                customer_phone: noHp,
                note: catatan,
                items: cart,
                total_price: total,
                status: 'Pending'
            }])
            .select()
            .single();

        if (error) throw error;

        // 2. Format Order ID Urut (contoh: MP-00001, MP-00002)
        const orderId = 'MP-' + String(data.id).padStart(5, '0');
        await dbClient.from('orders').update({ order_id: orderId }).eq('id', data.id);

        // 3. Format Pesan Nota WA
        let text = `*PESANAN BARU - MUSTAKIM PHONE*\n`;
        text += `==============================\n`;
        text += `*No. Nota:* #${orderId}\n`;
        text += `*Nama:* ${nama}\n`;
        text += `*No. HP:* ${noHp}\n`;
        if (catatan) text += `*Item / Catatan:* ${catatan}\n`;
        text += `==============================\n`;
        text += `*DETAIL ITEM (Part + Free Jasa Pasang):*\n\n`;

        cart.forEach((item, idx) => {
            let subtotal = item.price * item.qty;
            text += `${idx + 1}. *${item.title}*\n   • ${item.qty} Pcs x ${formatRupiah(item.price)} = ${formatRupiah(subtotal)}\n\n`;
        });

        text += `==============================\n`;
        text += `*TOTAL PEMBAYARAN:* ${formatRupiah(total)}\n`;
        text += `==============================\n`;
        text += `_Mohon konfirmasi ketersediaan stok & jadwal pengerjaan outlet._`;

        // Reset state & keranjang jika transaksi dari keranjang
        if (window.directOrderItem) {
            window.directOrderItem = null;
        } else {
            localStorage.removeItem('mustakimCart');
            if (typeof updateCartBadge === 'function') updateCartBadge();
            renderCart();
        }

        const modalEl = document.getElementById('checkoutModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        // Buka WhatsApp Admin
        window.open(`https://wa.me/${nomorWhatsAppAdmin}?text=${encodeURIComponent(text)}`, '_blank');

    } catch (e) {
        console.error("Gagal memproses checkout: ", e);
        showToast("Gagal menyimpan pesanan. Coba lagi!");
    }
}

// ==========================================
// LACAK PESANAN BY KODE NOTA / NO HP
// ==========================================
function bukaModalLacak() {
    const modalEl = document.getElementById('lacakModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

async function cariLacakPesanan() {
    const query = document.getElementById('inputLacakNota').value.trim();
    const container = document.getElementById('hasilLacakContainer');
    if (!query) {
        container.innerHTML = '<p class="text-danger small">Masukkan Kode Nota atau No. HP!</p>';
        return;
    }

    container.innerHTML = '<div class="spinner-border spinner-border-sm text-primary"></div> Mencari data...';

    try {
        const { data, error } = await dbClient
            .from('orders')
            .select('*')
            .or(`order_id.ilike.%${query}%,customer_phone.eq.${query}`)
            .order('created_at', { ascending: false });

        if (error || !data || data.length === 0) {
            container.innerHTML = '<div class="alert alert-warning py-2 small">Pesanan tidak ditemukan. Periksa kembali input Anda.</div>';
            return;
        }

        let html = '';
        data.forEach(order => {
            let statusBadge = 'bg-secondary';
            if (order.status === 'Pending') statusBadge = 'bg-warning text-dark';
            if (order.status === 'Diproses') statusBadge = 'bg-info text-dark';
            if (order.status === 'Selesai') statusBadge = 'bg-success';

            html += `
            <div class="card border mb-2 shadow-sm" style="border-radius:10px;">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="fw-bold text-primary">#${order.order_id}</span>
                        <span class="badge ${statusBadge}">${order.status}</span>
                    </div>
                    <div class="small text-muted mb-1">Pemesan: <strong>${order.customer_name}</strong></div>
                    <div class="small text-muted mb-2">Total Tagihan: <strong class="text-dark">${formatRupiah(order.total_price)}</strong></div>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<p class="text-danger small">Gagal memuat status pesanan.</p>';
    }
}