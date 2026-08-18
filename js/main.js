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

// VARIABEL BANNER SLIDER INFINITE LOOP
let realBannerCount = 0;
let bannerIndex = 1; // Index 1 = Banner pertama asli
let autoSlideTimer = null;
let rAFId = null; 

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
    checkDeepLinkProduk();
    loadBannersDinamis();
    loadBrandsDinamis();
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
        'homeView', 'searchView', 'cekservisView', 'merekView', 
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
        // 1. Munculkan modal saat kolom pencarian diklik / difokuskan
        searchInput.addEventListener('focus', () => {
            if (!checkAuthOrShowModal()) {
                searchInput.blur(); // Batalkan fokus pada kolom pencarian
            }
        });

        // 2. Cegah pengetikan jika belum login
        searchInput.addEventListener('input', (e) => {
            if (!checkAuthOrShowModal()) {
                searchInput.value = ''; // Kosongkan teks yang sempat terketik
                searchInput.blur();
                if (clearBtn) clearBtn.classList.add('d-none');
                return;
            }

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
        <div class="col-6 mb-2">
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
// NAVIGASI APLIKASI & NAV BAR (FULL FIXED)
// ==========================================
function switchNav(tabName, element) {
    try {
        // Bersihkan sisa bayangan modal agar tidak menghitamkan layar saat pindah menu
        cleanupModalBackdrop();

        closeDetail();
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        if (element) element.classList.add('active');

        const views = ['homeView', 'searchView', 'cekservisView', 'merekView', 'keranjangView', 'memberView'];
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
        } else if (tabName === 'CekServis' || tabName === 'Kategori') {
            const sv = document.getElementById('cekservisView');
            if(sv) sv.classList.remove('d-none');
            if(typeof loadCekPesananOtomatis === 'function') loadCekPesananOtomatis();
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
            
            // Cek data login di localStorage atau sessionStorage
            const userSession = JSON.parse(localStorage.getItem('mustakimUser') || sessionStorage.getItem('mustakimUser'));
            
            if (userSession) {
                document.getElementById('akunContainer').style.display = 'none';
                document.getElementById('memberDashboardView').style.display = 'block';
                
                // --- INJEKSI NAMA & BADGE ROLE SECARA DINAMIS ---
                const namaMember = document.getElementById('namaMemberLogin');
                if (namaMember && userSession.username) {
                    const capitalizedName = userSession.username.charAt(0).toUpperCase() + userSession.username.slice(1);
                    const badgeRole = (userSession.role && userSession.role.toLowerCase() === 'admin') ? 'Admin' : 'Member';
                    
                    namaMember.innerHTML = `${capitalizedName} <span class="badge bg-white text-primary ms-2" style="font-size: 0.65rem; font-weight: 600; vertical-align: middle;">${badgeRole}</span>`;
                }
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
    sessionStorage.removeItem('mustakimUser');
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
// RENDER KATEGORI & BRAND DINAMIS
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

    } catch (e) {
        console.log("Menggunakan gambar kategori bawaan.");
    }
}

// ==========================================
// BANNER SLIDER (LUNCTURAN HALUS 1.8 DETIK, JEDA 5 DETIK)
// ==========================================
async function loadBannersDinamis() {
    try {
        const { data: banners, error } = await dbClient.from('banners').select('*');
        const slider = document.getElementById('bannerSlider');
        const dots = document.getElementById('bannerDots');
        if (!slider || !dots) return;

        if (error || !banners || banners.length === 0) {
            startAutoSlide();
            initBannerSwipe();
            return;
        }

        realBannerCount = banners.length;

        // Render Dots
        dots.innerHTML = banners.map((_, i) => `
            <div class="dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></div>
        `).join('');

        if (realBannerCount === 1) {
            slider.innerHTML = `
                <div class="banner-slide">
                    <img src="${banners[0].image_url}" onerror="this.onerror=null; this.src='${defaultImageFallback}';" loading="lazy">
                </div>`;
            return;
        }

        // BUAT SLIDE KLON UNTUK INFINITE LOOP
        const firstClone = banners[0];
        const lastClone = banners[realBannerCount - 1];

        let slidesHtml = `
            <div class="banner-slide">
                <img src="${lastClone.image_url}" onerror="this.onerror=null; this.src='${defaultImageFallback}';" loading="lazy">
            </div>
        `;

        slidesHtml += banners.map(b => `
            <div class="banner-slide">
                <img src="${b.image_url}" onerror="this.onerror=null; this.src='${defaultImageFallback}';" loading="lazy" alt="${b.title || 'Banner Promo'}">
            </div>
        `).join('');

        slidesHtml += `
            <div class="banner-slide">
                <img src="${firstClone.image_url}" onerror="this.onerror=null; this.src='${defaultImageFallback}';" loading="lazy">
            </div>
        `;

        slider.innerHTML = slidesHtml;
        bannerIndex = 1;

        updateSliderView(false);

        slider.removeEventListener('transitionend', handleBannerTransitionEnd);
        slider.addEventListener('transitionend', handleBannerTransitionEnd);

        startAutoSlide();
        initBannerSwipe();
    } catch (e) {
        console.log("Menggunakan slider bawaan.");
        startAutoSlide();
        initBannerSwipe();
    }
}

function updateSliderView(animated = true) {
    const slider = document.getElementById('bannerSlider');
    const dots = document.querySelectorAll('#bannerDots .dot');
    if (!slider) return;

    if (animated) {
        // Durasi 1.8 detik dengan kurva meluncur pelan & lembut
        slider.style.transition = 'transform 1.8s cubic-bezier(0.16, 1, 0.3, 1)';
    } else {
        slider.style.transition = 'none';
    }

    // Pergeseran posisi banner menggunakan GPU 3D
    slider.style.transform = `translate3d(-${bannerIndex * 100}%, 0, 0)`;

    // Update Indikator Titik (Dots)
    if (dots.length > 0 && realBannerCount > 0) {
        let activeDot = (bannerIndex - 1 + realBannerCount) % realBannerCount;

        dots.forEach((dot, idx) => {
            if (idx === activeDot) dot.classList.add('active');
            else dot.classList.remove('active');
        });
    }
}

function handleBannerTransitionEnd() {
    if (bannerIndex >= realBannerCount + 1) {
        bannerIndex = 1;
        updateSliderView(false);
    } else if (bannerIndex <= 0) {
        bannerIndex = realBannerCount;
        updateSliderView(false);
    }
}

function startAutoSlide() {
    clearInterval(autoSlideTimer);
    autoSlideTimer = setInterval(() => {
        bannerIndex++;
        updateSliderView(true);
    }, 5000); 
}

function goToSlide(realIndex) {
    bannerIndex = realIndex + 1;
    updateSliderView(true);
    startAutoSlide();
}

// LOGIKA SWIPE SENTUHAN HP & MOUSE DRAG SMOOTH
function initBannerSwipe() {
    const sliderBox = document.querySelector('.banner-box');
    const slider = document.getElementById('bannerSlider');
    if (!slider || !sliderBox || sliderBox.dataset.swipeInitialized) return;

    sliderBox.dataset.swipeInitialized = "true";

    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    const getX = (e) => e.touches ? e.touches[0].clientX : e.clientX;

    const onStart = (e) => {
        isDragging = true;
        startX = getX(e);
        currentX = startX;
        clearInterval(autoSlideTimer);
        slider.style.transition = 'none';
    };

    const onMove = (e) => {
        if (!isDragging) return;
        currentX = getX(e);

        if (rAFId) cancelAnimationFrame(rAFId);
        rAFId = requestAnimationFrame(() => {
            const diffX = currentX - startX;
            const containerWidth = sliderBox.clientWidth;
            const currentTranslate = -bannerIndex * containerWidth + diffX;
            slider.style.transform = `translate3d(${currentTranslate}px, 0, 0)`;
        });
    };

    const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        if (rAFId) cancelAnimationFrame(rAFId);

        const diffX = currentX - startX;

        if (diffX < -35) {
            bannerIndex++;
        } else if (diffX > 35) {
            bannerIndex--;
        }

        updateSliderView(true);
        startAutoSlide();
    };

    sliderBox.addEventListener('touchstart', onStart, { passive: true });
    sliderBox.addEventListener('touchmove', onMove, { passive: true });
    sliderBox.addEventListener('touchend', onEnd);

    sliderBox.addEventListener('mousedown', onStart);
    sliderBox.addEventListener('mousemove', onMove);
    sliderBox.addEventListener('mouseup', onEnd);
    sliderBox.addEventListener('mouseleave', () => { if (isDragging) onEnd(); });
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
    if (!checkAuthOrShowModal()) return;
    
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
    
    const kv = document.getElementById('cekservisView');
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
    cleanupModalBackdrop();

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
    
    const kv = document.getElementById('cekservisView');
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
            .from('katalog_publik')
            .select('*');

        if (error) throw error;

        globalData = data.map(item => [
            item.id,
            item.merk_hp,
            item.type_hp,
            item.jenis_service,
            item.harga,
            item.garansi,
            item.keterangan || item.merk_part || item.ket || '',
            item.status,
            item.update || item.created_at || ''
        ]);

        if (loader) loader.style.display = 'none';
        filterAndDisplay('');
        renderLatestProducts();
        checkDeepLinkProduk();
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
        const searchString = `${row[0] || ''} ${row[1] || ''} ${row[2] || ''} ${row[3] || ''} ${row[6] || ''}`.toLowerCase();
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

        let ketBadgeTopHtml = keterangan 
            ? `<span class="badge border position-absolute top-0 end-0 m-2 shadow-sm fw-bold" style="background-color: #e0f2fe; color: #0369a1; border-color: #bae6fd !important; font-size: 0.58rem; padding: 3px 7px; border-radius: 6px;">${keterangan.toUpperCase()}</span>` 
            : '';

        html += `
        <div class="col-6 mb-2">
            <div class="card h-100 border-0 shadow-sm product-card" style="border-radius: 12px; cursor: pointer;" onclick="showDetail(${idx})">
              <div class="bg-white position-relative d-flex justify-content-center align-items-center" style="height: 110px; border-bottom: 1px solid #f0f0f0;">
                    <span class="badge ${badgeClass} position-absolute top-0 start-0 m-2 shadow-sm" style="font-size: 0.6rem; padding: 4px 8px; border-radius: 6px;">${stokStatus.toUpperCase()}</span>
                    ${ketBadgeTopHtml}
                    <img src="${imageUrl}" onerror="this.onerror=null; this.src='${defaultImageFallback}';" loading="lazy" style="max-height: 80px; max-width: 90%; object-fit: contain;">
                </div>
                <div class="card-body p-2 d-flex flex-column bg-white justify-content-between">
                    <h6 class="fw-bold text-dark text-truncate-2 mb-1" style="font-size: 0.8rem; line-height: 1.3;">${merk} ${type}</h6>
                    <span class="text-primary fw-bolder mt-1" style="font-size: 0.82rem;">${harga}</span>
                </div>
            </div>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

function showDetail(idx) {
    if (!checkAuthOrShowModal()) return;
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
    
    currentViewedProduct = { 
        id: kodeBarang, 
        title: `${service} ${merk} ${type}`, 
        price: hargaNum, 
        service: service,
        merk: merk,
        type: `${merk} ${type}`,
        keterangan: keterangan || '-'
    };

    const elTitle = document.getElementById('detailTitle');
    if (elTitle) elTitle.innerText = `${merk} ${type}`;

    const elDesc = document.getElementById('detailFullDesc');
    if (elDesc) elDesc.innerText = `${service} ${merk} ${type}`;

    const elService = document.getElementById('detailService');
    if (elService) elService.innerText = service;

    const elTag = document.getElementById('detailTag');
    if (elTag) elTag.innerText = garansi;

    let ketBadgeEl = document.getElementById('detailKetBadge');
    if (!ketBadgeEl && elTag && elTag.parentElement) {
        ketBadgeEl = document.createElement('span');
        ketBadgeEl.id = 'detailKetBadge';
        ketBadgeEl.className = 'badge border px-2 py-1 rounded-2 fw-bold ms-2';
        ketBadgeEl.style.cssText = 'background-color: #e0f2fe; color: #0369a1; border-color: #bae6fd !important; font-size: 0.72rem; letter-spacing: 0.3px;';
        elTag.parentElement.appendChild(ketBadgeEl);
    }
    if (ketBadgeEl) {
        if (keterangan) {
            ketBadgeEl.innerHTML = `<i class="fa-solid fa-tag me-1"></i>${keterangan.toUpperCase()}`;
            ketBadgeEl.style.display = 'inline-block';
        } else {
            ketBadgeEl.style.display = 'none';
        }
    }

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
        const keterangan = row[6] ? String(row[6]).trim() : ''; 
        const stokStatus = row[7] ? String(row[7]).trim() : 'Tersedia';
        const badgeClass = getBadgeClass(stokStatus);
        let imageUrl = getProductImage(service);

        let ketBadgeTopHtml = keterangan 
            ? `<span class="badge border position-absolute top-0 end-0 m-2 shadow-sm fw-bold" style="background-color: #e0f2fe; color: #0369a1; border-color: #bae6fd !important; font-size: 0.58rem; padding: 3px 7px; border-radius: 6px;">${keterangan.toUpperCase()}</span>` 
            : '';

        html += `
        <div class="col-6 mb-2">
            <div class="card border-0 shadow-sm product-card h-100" style="border-radius: 12px; cursor: pointer;" onclick="showDetail(${originalIndex})">
                <div class="bg-white position-relative d-flex justify-content-center align-items-center" style="height: 110px; border-bottom: 1px solid #f0f0f0;">
                    <span class="badge ${badgeClass} position-absolute top-0 start-0 m-2 shadow-sm" style="font-size: 0.58rem; padding: 3px 7px; border-radius: 6px;">${stokStatus.toUpperCase()}</span>
                    ${ketBadgeTopHtml}
                    <img src="${imageUrl}" onerror="this.onerror=null; this.src='${defaultImageFallback}';" loading="lazy" style="max-height: 80px; max-width: 90%; object-fit: contain;">
                </div>
                <div class="card-body p-2 bg-white d-flex flex-column justify-content-between">
                    <h6 class="fw-bold text-dark text-truncate-2 mb-1" style="font-size: 0.78rem;">${merk} ${type}</h6>
                    <span class="text-primary fw-bolder mt-1" style="font-size: 0.82rem;">${harga}</span>
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

    window.directOrderItem = [{
        id: currentViewedProduct.id,
        title: currentViewedProduct.title,
        price: currentViewedProduct.price,
        service: currentViewedProduct.service,
        merk: currentViewedProduct.merk || '',
        keterangan: currentViewedProduct.keterangan || '-',
        qty: 1
    }];

    const summaryQtyEl = document.getElementById('summaryTotalQty');
    if (summaryQtyEl) summaryQtyEl.innerText = '1 Pcs';

    const summaryPriceEl = document.getElementById('summaryTotalPrice');
    if (summaryPriceEl) summaryPriceEl.innerText = formatRupiah(currentViewedProduct.price);

    const orderCatatanEl = document.getElementById('orderCatatan');
    if (orderCatatanEl) {
        let merkHP = currentViewedProduct.merk ? currentViewedProduct.merk.trim() : '';
        orderCatatanEl.value = merkHP ? `${merkHP} ` : '';
    }

    const userSession = JSON.parse(localStorage.getItem('mustakimUser') || sessionStorage.getItem('mustakimUser'));
    if (userSession) {
        if (userSession.username) document.getElementById('orderNama').value = userSession.username;
        if (userSession.no_hp) document.getElementById('orderNoHp').value = userSession.no_hp;
    }

    const modalEl = document.getElementById('checkoutModal');
    if (modalEl) {
        const checkoutModal = bootstrap.Modal.getOrCreateInstance(modalEl);
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

async function simpanPasswordBaru() {
    const passLama = document.getElementById('passLama').value.trim();
    const passBaru = document.getElementById('passBaru').value.trim();
    const pesanGantiPass = document.getElementById('pesanGantiPass');

    if (!passLama || !passBaru) {
        pesanGantiPass.style.color = 'red';
        pesanGantiPass.innerText = 'Semua kolom harus diisi!';
        return;
    }

    const userSession = JSON.parse(localStorage.getItem('mustakimUser') || sessionStorage.getItem('mustakimUser'));
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
// FITUR BAGIKAN PRODUK
// ==========================================
function shareProduct() {
    if (!currentViewedProduct) return;
    
    const baseUrl = window.location.origin + window.location.pathname;
    const productId = currentViewedProduct.id || ''; 
    const productUrl = `${baseUrl}?id=${encodeURIComponent(productId)}`;

    const shareData = {
        title: currentViewedProduct.title,
        text: `Cek ${currentViewedProduct.title} di Mustakim Phone! Harga ${formatRupiah(currentViewedProduct.price)} (Sudah termasuk jasa pasang).`,
        url: productUrl
    };

    if (navigator.share) {
        navigator.share(shareData).catch(() => {});
    } else {
        navigator.clipboard.writeText(`${shareData.text}\n${productUrl}`);
        showToast('Link produk berhasil disalin!');
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

    const userSession = JSON.parse(localStorage.getItem('mustakimUser') || sessionStorage.getItem('mustakimUser'));
    if (userSession) {
        if (userSession.username) document.getElementById('orderNama').value = userSession.username;
        if (userSession.no_hp) document.getElementById('orderNoHp').value = userSession.no_hp;
    }

    const orderCatatanEl = document.getElementById('orderCatatan');
    if (orderCatatanEl) {
        let listMerk = [...new Set(cart.map(item => item.merk).filter(Boolean))].join('/ ');
        orderCatatanEl.value = listMerk ? `${listMerk.trim()} ` : '';
    }

    const modalEl = document.getElementById('checkoutModal');
    if (modalEl) {
        const checkoutModal = bootstrap.Modal.getOrCreateInstance(modalEl);
        checkoutModal.show();
    }
}

async function prosesCheckoutForm() {
    let cart = window.directOrderItem || JSON.parse(localStorage.getItem('mustakimCart')) || [];
    if (cart.length === 0) return;

    const nama = document.getElementById('orderNama').value.trim();
    const noHp = document.getElementById('orderNoHp').value.trim();
    const catatan = document.getElementById('orderCatatan').value.trim();

    let daftarMerk = cart.map(item => item.merk ? item.merk.trim().toUpperCase() : '').filter(Boolean);
    let cumaIsiMerk = daftarMerk.some(m => m === catatan.toUpperCase());

    if (!nama || !noHp || !catatan || cumaIsiMerk) {
        showToast('Mohon lengkapi Tipe HP Pelanggan (Contoh: VIVO Y21)!');
        return;
    }

    let total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    try {
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

        const orderId = 'MP-' + String(data.id).padStart(5, '0');
        await dbClient.from('orders').update({ order_id: orderId }).eq('id', data.id);

        let idPartsList = cart.map(item => {
            let partId = item.id || '-';
            let partKet = (item.keterangan && item.keterangan !== '-') ? ` (${item.keterangan})` : '';
            return `${partId}${partKet}`;
        }).join(', ');

        let text = `*PESANAN BARU - MUSTAKIM PHONE*\n`;
        text += `==============================\n`;
        text += `*No. Nota:* #${orderId}\n`;
        text += `*Nama:* ${nama}\n`;
        text += `*No. HP:* ${noHp}\n`;
        text += `*Tipe HP Pelanggan:* ${catatan}\n`;
        text += `*ID Part:* ${idPartsList}\n`;
        text += `==============================\n`;
        text += `*DETAIL ITEM (Part + Jasa Pasang):*\n\n`;

        cart.forEach((item, idx) => {
            let subtotal = item.price * item.qty;
            let namaLengkap = item.title;
            if (item.service && !namaLengkap.toUpperCase().includes(item.service.toUpperCase())) {
                namaLengkap = `${item.service} ${item.title}`;
            }

            text += `${idx + 1}. *${namaLengkap}*\n   • ${item.qty} Pcs x ${formatRupiah(item.price)} = ${formatRupiah(subtotal)}\n\n`;
        });

        text += `==============================\n`;
        text += `*TOTAL PEMBAYARAN:* ${formatRupiah(total)}\n`;
        text += `==============================\n`;
        text += `_Mohon konfirmasi ketersediaan stok & jadwal pengerjaan._`;

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

        window.open(`https://wa.me/${nomorWhatsAppAdmin}?text=${encodeURIComponent(text)}`, '_blank');

    } catch (e) {
        console.error("Gagal memproses checkout: ", e);
        showToast("Gagal menyimpan pesanan. Coba lagi!");
    }
}

// ==========================================
// HELPER HITUNG SISA GARANSI
// ==========================================
function renderBadgeGaransi(order) {
    if (order.status.toLowerCase() !== 'selesai') return '';

    let tglMulaiStr = order.completed_at || order.updated_at || order.created_at;
    if (!tglMulaiStr) return '';
    
    let tglSelesai = new Date(tglMulaiStr);

    let isBaterai = false;
    let isLcd = false;
    
    if (order.items && Array.isArray(order.items)) {
        let textGabungan = order.items.map(i => `${i.title} ${i.service} ${i.id}`).join(" ").toUpperCase();
        if (textGabungan.includes("BAT") || textGabungan.includes("BATERAI")) isBaterai = true;
        if (textGabungan.includes("LCD")) isLcd = true;
    }

    let lamaHari = 7; 
    if (isBaterai) lamaHari = 30; 
    else if (isLcd) lamaHari = 7;  

    let tglKedaluwarsa = new Date(tglSelesai);
    tglKedaluwarsa.setDate(tglSelesai.getDate() + lamaHari);

    let hariIni = new Date();
    let selisihWaktu = tglKedaluwarsa.getTime() - hariIni.getTime();
    let sisaHari = Math.ceil(selisihWaktu / (1000 * 3600 * 24));

    if (sisaHari > 0) {
        return `
        <div class="mt-3 p-2 rounded-3 d-flex align-items-center" style="background-color: #ecfdf5; border: 1px solid #a7f3d0;">
            <i class="fa-solid fa-shield-halved text-success me-2 fs-4 ms-1"></i>
            <div class="ms-1">
                <div class="text-success fw-bold" style="font-size: 0.72rem; text-transform: uppercase;">Masa Garansi Aktif (${lamaHari} Hari)</div>
                <div class="text-dark fw-bold" style="font-size: 0.85rem;">Tersisa <span class="text-success">${sisaHari} Hari</span> Lagi</div>
            </div>
        </div>`;
    } else {
        return `
        <div class="mt-3 p-2 rounded-3 d-flex align-items-center" style="background-color: #fef2f2; border: 1px solid #fecaca;">
            <i class="fa-solid fa-shield-virus text-danger me-2 fs-4 ms-1"></i>
            <div class="ms-1">
                <div class="text-danger fw-bold" style="font-size: 0.72rem; text-transform: uppercase;">Garansi Berakhir</div>
                <div class="text-muted fw-bold" style="font-size: 0.85rem;">Masa klaim sudah habis</div>
            </div>
        </div>`;
    }
}

// ==========================================
// MEMUAT PESANAN OTOMATIS DI CEK SERVIS
// ==========================================
async function loadCekPesananOtomatis() {
    const secOtomatis = document.getElementById('sectionPesananOtomatis');
    const containerOtomatis = document.getElementById('containerPesananOtomatis');
    const badgeCount = document.getElementById('badgeMemberOrderCount');
    
    if (!secOtomatis || !containerOtomatis) return;

    const userSession = JSON.parse(localStorage.getItem('mustakimUser') || sessionStorage.getItem('mustakimUser'));
    if (!userSession) {
        secOtomatis.classList.add('d-none');
        return;
    }

    let userPhone = userSession.no_hp ? String(userSession.no_hp).trim() : '';
    let username = userSession.username ? String(userSession.username).trim() : '';

    if (!userPhone && !username) {
        secOtomatis.classList.add('d-none');
        return;
    }

    secOtomatis.classList.remove('d-none');
    containerOtomatis.innerHTML = `
        <div class="text-center py-3 bg-white rounded-4 border shadow-sm">
            <div class="spinner-border spinner-border-sm text-primary"></div>
            <span class="ms-2 text-muted small">Memuat data pesanan Anda...</span>
        </div>`;

    try {
        let queryConditions = [];
        if (userPhone) queryConditions.push(`customer_phone.eq.${userPhone}`);
        if (username) queryConditions.push(`customer_name.eq.${username}`);

        const { data, error } = await dbClient
            .from('orders')
            .select('*')
            .or(queryConditions.join(','))
            .order('created_at', { ascending: false });

        if (error || !data || data.length === 0) {
            if (badgeCount) badgeCount.innerText = '0';
            containerOtomatis.innerHTML = `
                <div class="bg-white p-3 rounded-4 text-center border shadow-sm">
                    <p class="text-muted small mb-0"><i class="fa-solid fa-circle-info text-primary me-1"></i> Belum ada riwayat pesanan untuk akun Anda.</p>
                </div>`;
            return;
        }

        if (badgeCount) badgeCount.innerText = data.length;

        let html = '';
        data.forEach(order => {
            let statusBadge = 'bg-secondary';
            if (order.status === 'Pending') statusBadge = 'bg-warning text-dark';
            if (order.status === 'Diproses') statusBadge = 'bg-info text-dark';
            if (order.status === 'Selesai') statusBadge = 'bg-success';

            let tipeHp = order.note ? order.note.trim() : '-';

            let jenisServiceList = '-';
            if (Array.isArray(order.items) && order.items.length > 0) {
                let services = order.items.map(item => item.service || item.title || '').filter(Boolean);
                let uniqueServices = [...new Set(services.map(s => s.toUpperCase()))];
                jenisServiceList = uniqueServices.join(', ');
            }

            let garansiInfo = renderBadgeGaransi(order);
            let waText = `Halo admin MustakimPhone, saya mau tanya status pesanan saya #${order.order_id}...`;

            html += `
            <div class="card border-0 mb-3 shadow-sm" style="border-radius:14px; overflow:hidden;">
                <div class="bg-light px-3 py-2 border-bottom d-flex justify-content-between align-items-center">
                    <span class="fw-bolder text-primary fs-6">#${order.order_id}</span>
                    <span class="badge ${statusBadge} px-2 py-1 shadow-sm" style="font-size: 0.72rem;">${order.status.toUpperCase()}</span>
                </div>
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between border-bottom pb-2 mb-2">
                        <span class="small text-muted">Pemesan:</span>
                        <strong class="text-dark small">${order.customer_name}</strong>
                    </div>
                    <div class="d-flex justify-content-between border-bottom pb-2 mb-2">
                        <span class="small text-muted">Jenis Service:</span>
                        <strong class="text-primary small text-end fw-bold">${jenisServiceList}</strong>
                    </div>
                    <div class="d-flex justify-content-between border-bottom pb-2 mb-2">
                        <span class="small text-muted">Tipe HP:</span>
                        <strong class="text-dark small text-end">${tipeHp}</strong>
                    </div>
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="small fw-bold text-dark">Total Biaya:</span>
                        <strong class="text-primary fs-6">${formatRupiah(order.total_price)}</strong>
                    </div>

                    ${garansiInfo}

                    <div class="d-flex gap-2 mt-3">
                        <button onclick="bukaNotaDigital('${order.order_id}')" class="btn btn-outline-primary flex-grow-1 fw-bold py-2 rounded-3" style="font-size: 0.8rem;">
                            <i class="fa-solid fa-file-invoice me-1"></i> Nota Digital
                        </button>
                        <a href="https://wa.me/${nomorWhatsAppAdmin}?text=${encodeURIComponent(waText)}" target="_blank" class="btn btn-success flex-grow-1 fw-bold py-2 rounded-3 text-center" style="font-size: 0.8rem; background-color:#1fa91c; border-color:#1fa91c;">
                            <i class="fa-brands fa-whatsapp me-1"></i> Tanya Admin
                        </a>
                    </div>
                </div>
            </div>`;
        });
        containerOtomatis.innerHTML = html;
    } catch (e) {
        containerOtomatis.innerHTML = '<p class="text-danger small text-center">Gagal memuat pesanan otomatis.</p>';
    }
}

// ==========================================
// LACAK PESANAN MANUAL
// ==========================================
async function cariLacakPesanan() {
    const query = document.getElementById('inputLacakNota').value.trim();
    const container = document.getElementById('hasilLacakContainer');
    if (!query) {
        container.innerHTML = '<p class="text-danger small text-center mt-3 fw-bold">Masukkan Kode Nota atau No. HP Anda!</p>';
        return;
    }

    container.innerHTML = '<div class="text-center mt-4"><div class="spinner-border spinner-border-sm text-primary"></div><span class="ms-2 text-muted small">Mencari data servis...</span></div>';

    try {
        const { data, error } = await dbClient
            .from('orders')
            .select('*')
            .or(`order_id.ilike.%${query}%,customer_phone.eq.${query}`)
            .order('created_at', { ascending: false });

        if (error || !data || data.length === 0) {
            container.innerHTML = '<div class="alert alert-warning py-3 small text-center mt-3 rounded-4 shadow-sm border-0"><strong>Tidak ditemukan.</strong><br>Pastikan Nomor WA atau Nota sudah benar.</div>';
            return;
        }

        let html = '';
        data.forEach(order => {
            let statusBadge = 'bg-secondary';
            if (order.status === 'Pending') statusBadge = 'bg-warning text-dark';
            if (order.status === 'Diproses') statusBadge = 'bg-info text-dark';
            if (order.status === 'Selesai') statusBadge = 'bg-success';

            let tipeHp = order.note ? order.note.trim() : '-';

            let jenisServiceList = '-';
            let idPartsList = '-';
            if (Array.isArray(order.items) && order.items.length > 0) {
                let services = order.items.map(item => item.service || item.title || '').filter(Boolean);
                let uniqueServices = [...new Set(services.map(s => s.toUpperCase()))];
                jenisServiceList = uniqueServices.join(', ');

                idPartsList = order.items.map(item => {
                    let partId = item.id || '-';
                    let partKet = (item.keterangan && item.keterangan !== '-') ? ` (${item.keterangan})` : '';
                    return `${partId}${partKet}`;
                }).join(', ');
            }

            let garansiInfo = renderBadgeGaransi(order);
            let waText = `Halo admin MustakimPhone, saya mau tanya detail pesanan untuk nota *#${order.order_id}* atas nama *${order.customer_name}*. Statusnya saat ini *${order.status}*...`;

            html += `
            <div class="card border-0 mb-4 shadow-sm" style="border-radius:14px; overflow:hidden;">
                <div class="bg-light px-3 py-2 border-bottom d-flex justify-content-between align-items-center">
                    <span class="fw-bolder text-primary fs-6">#${order.order_id}</span>
                    <span class="badge ${statusBadge} px-2 py-1 shadow-sm" style="font-size: 0.72rem; letter-spacing: 0.5px;">${order.status.toUpperCase()}</span>
                </div>
                
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between border-bottom pb-2 mb-2">
                        <span class="small text-muted">Pemesan:</span>
                        <strong class="text-dark small">${order.customer_name}</strong>
                    </div>
                    <div class="d-flex justify-content-between border-bottom pb-2 mb-2">
                        <span class="small text-muted">Jenis Service:</span>
                        <strong class="text-primary small text-end fw-bold">${jenisServiceList}</strong>
                    </div>
                    <div class="d-flex justify-content-between border-bottom pb-2 mb-2">
                        <span class="small text-muted">Tipe HP:</span>
                        <strong class="text-dark small text-end" style="max-width: 65%;">${tipeHp}</strong>
                    </div>
                    <div class="d-flex justify-content-between border-bottom pb-2 mb-2">
                        <span class="small text-muted">Part ID:</span>
                        <strong class="text-dark small text-end" style="max-width: 65%;">${idPartsList}</strong>
                    </div>
                    <div class="d-flex justify-content-between align-items-center mt-3">
                        <span class="small fw-bold text-dark">Total Biaya:</span>
                        <strong class="text-primary fs-6">${formatRupiah(order.total_price)}</strong>
                    </div>
                    
                    ${garansiInfo}
                    
                    <div class="d-flex gap-2 mt-3">
                        <button onclick="bukaNotaDigital('${order.order_id}')" class="btn btn-outline-primary flex-grow-1 fw-bold py-2 rounded-3" style="font-size: 0.85rem;">
                            <i class="fa-solid fa-file-invoice me-1"></i> Nota Digital
                        </button>
                        <a href="https://wa.me/${nomorWhatsAppAdmin}?text=${encodeURIComponent(waText)}" 
                           target="_blank" 
                           class="btn btn-success flex-grow-1 fw-bold py-2 rounded-3 text-center" 
                           style="font-size: 0.85rem; background-color:#1fa91c; border-color:#1fa91c;">
                           <i class="fa-brands fa-whatsapp me-1"></i> Tanya Admin
                        </a>
                    </div>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<p class="text-danger small text-center mt-3">Gagal memuat status pesanan. Coba sesaat lagi.</p>';
    }
}

// ==========================================
// MODAL TAMPILAN NOTA DIGITAL UNTUK DICETAK
// ==========================================
async function bukaNotaDigital(orderId) {
    try {
        const { data: order, error } = await dbClient
            .from('orders')
            .select('*')
            .eq('order_id', orderId)
            .single();

        if (error || !order) {
            showToast('Gagal memuat detail nota.');
            return;
        }

        let tgl = order.created_at ? new Date(order.created_at).toLocaleString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : '-';

        let statusUpper = (order.status || 'PENDING').toUpperCase();
        let statusBadgeClass = 'bg-secondary text-white';
        if (statusUpper === 'PENDING') statusBadgeClass = 'bg-warning text-dark';
        if (statusUpper === 'DIPROSES') statusBadgeClass = 'bg-info text-dark';
        if (statusUpper === 'SELESAI') statusBadgeClass = 'bg-success text-white';

        let itemsHtml = '';
        if (Array.isArray(order.items)) {
            order.items.forEach((item, idx) => {
                let subtotal = item.price * item.qty;
                itemsHtml += `
                <tr style="border-bottom: 1px dashed #dee2e6;">
                    <td style="padding: 6px 0; font-size: 0.8rem;">${idx + 1}. ${item.title}</td>
                    <td style="padding: 6px 0; font-size: 0.8rem; text-align: center;">${item.qty}</td>
                    <td style="padding: 6px 0; font-size: 0.8rem; text-align: right;">${formatRupiah(subtotal)}</td>
                </tr>`;
            });
        }

        const printableArea = document.getElementById('printableNotaArea');
        printableArea.innerHTML = `
            <div class="text-center mb-3">
                <h5 class="fw-bolder mb-0 text-primary">MUSTAKIM PHONE</h5>
                <small class="text-muted d-block" style="font-size: 0.72rem;">Service HP & Mini ATM</small>
                <small class="text-muted d-block" style="font-size: 0.7rem;">WA: 0857-9986-0406</small>
            </div>
            <hr style="border-top: 1.5px dashed #000; margin: 8px 0;">
            <div class="d-flex justify-content-between small text-muted mb-1">
                <span>No. Nota: <strong>#${order.order_id}</strong></span>
                <span>${tgl}</span>
            </div>
            <div class="d-flex justify-content-between small text-muted mb-2">
                <span>Pelanggan: <strong>${order.customer_name}</strong></span>
                <span>Tipe: <strong>${order.note || '-'}</strong></span>
            </div>
            <hr style="border-top: 1.5px dashed #000; margin: 8px 0;">
            <table class="w-100 mb-2">
                <thead>
                    <tr style="border-bottom: 1px solid #000; font-size: 0.75rem;">
                        <th class="py-1">Item</th>
                        <th class="py-1 text-center">Qty</th>
                        <th class="py-1 text-end">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
            <hr style="border-top: 1.5px dashed #000; margin: 8px 0;">
            <div class="d-flex justify-content-between fw-bold fs-6 text-dark mt-2">
                <span>TOTAL BAYAR:</span>
                <span class="text-primary">${formatRupiah(order.total_price)}</span>
            </div>
            
            <div class="d-flex justify-content-between align-items-center small text-muted mt-2">
                <span style="font-size: 0.8rem; font-weight: 600;">Status:</span>
                <span class="badge ${statusBadgeClass} shadow-sm" style="padding: 5px 12px; font-size: 0.72rem; font-weight: 800; border-radius: 6px; letter-spacing: 0.5px; display: inline-flex; align-items: center; justify-content: center; line-height: 1;">
                    ${statusUpper}
                </span>
            </div>

            <div class="text-center mt-4 pt-2 border-top">
                <small class="text-muted d-block" style="font-size: 0.7rem;">Terima Kasih atas Kepercayaan Anda!</small>
                <small class="text-muted d-block" style="font-size: 0.65rem;">Garansi berlaku sesuai ketentuan syarat nota.</small>
            </div>`;

        const btnCanvasWA = document.getElementById('btnShareNotaCanvasWA');
        if (btnCanvasWA) {
            btnCanvasWA.onclick = () => kirimNotaCanvasKeWA(order);
        }

        const modalNota = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNotaDigital'));
        modalNota.show();
    } catch (e) {
        showToast('Terjadi kesalahan membuka nota.');
    }
}

// ==========================================
// SHARE NOTA DIGITAL KE WHATSAPP
// ==========================================
function kirimNotaKeWA(order) {
    if (!order) return;

    let tgl = order.created_at ? new Date(order.created_at).toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : '-';

    let text = `*MUSTAKIM PHONE - NOTA DIGITAL*\n`;
    text += `==============================\n`;
    text += `*No. Nota:* #${order.order_id}\n`;
    text += `*Tanggal:* ${tgl}\n`;
    text += `*Pelanggan:* ${order.customer_name}\n`;
    text += `*Tipe HP:* ${order.note || '-'}\n`;
    text += `==============================\n`;
    text += `*DETAIL ITEM:*\n`;

    if (Array.isArray(order.items)) {
        order.items.forEach((item, idx) => {
            let subtotal = item.price * item.qty;
            text += `${idx + 1}. *${item.title}*\n   ${item.qty} x ${formatRupiah(item.price)} = ${formatRupiah(subtotal)}\n`;
        });
    }

    text += `==============================\n`;
    text += `*TOTAL BAYAR:* *${formatRupiah(order.total_price)}*\n`;
    text += `*STATUS:* *${order.status.toUpperCase()}*\n`;
    text += `==============================\n`;
    text += `_Terima kasih atas kepercayaan Anda di MUSTAKIM PHONE!_`;

    let noHpPelanggan = order.customer_phone ? String(order.customer_phone).replace(/[^0-9]/g, '') : '';
    if (noHpPelanggan.startsWith('0')) {
        noHpPelanggan = '62' + noHpPelanggan.slice(1);
    }

    let urlWA = noHpPelanggan 
        ? `https://wa.me/${noHpPelanggan}?text=${encodeURIComponent(text)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

    window.open(urlWA, '_blank');
}

// ==========================================
// ELEMEN NOTA MENJADI CANVAS & KIRIM KE WA
// ==========================================
async function kirimNotaCanvasKeWA(order) {
    const notaElement = document.getElementById('printableNotaArea');
    const btnCanvasWA = document.getElementById('btnShareNotaCanvasWA');

    if (!notaElement || !order) return;

    const originalBtnText = btnCanvasWA ? btnCanvasWA.innerHTML : '';
    if (btnCanvasWA) {
        btnCanvasWA.disabled = true;
        btnCanvasWA.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Memproses...`;
    }

    try {
        const canvas = await html2canvas(notaElement, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false
        });

        canvas.toBlob(async (blob) => {
            if (!blob) {
                showToast('Gagal memproses gambar nota.');
                if (btnCanvasWA) {
                    btnCanvasWA.disabled = false;
                    btnCanvasWA.innerHTML = originalBtnText;
                }
                return;
            }

            const fileName = `Nota-${order.order_id}.png`;
            const file = new File([blob], fileName, { type: 'image/png' });

            let noHpPelanggan = order.customer_phone ? String(order.customer_phone).replace(/[^0-9]/g, '') : '';
            if (noHpPelanggan.startsWith('0')) {
                noHpPelanggan = '62' + noHpPelanggan.slice(1);
            }

            let textChat = `Halo, berikut adalah Nota Digital resmi untuk pesanan #${order.order_id} di MUSTAKIM PHONE.`;

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: `Nota ${order.order_id}`,
                        text: textChat
                    });
                    showToast('Nota berhasil dibagikan!');
                } catch (err) {
                    console.log('User membatalkan share atau error:', err);
                }
            } else {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = fileName;
                link.click();
                URL.revokeObjectURL(link.href);

                let urlWA = noHpPelanggan 
                    ? `https://wa.me/${noHpPelanggan}?text=${encodeURIComponent(textChat)}`
                    : `https://api.whatsapp.com/send?text=${encodeURIComponent(textChat)}`;

                window.open(urlWA, '_blank');
                showToast('Gambar nota diunduh! Silakan lampirkan gambar di chat WA.');
            }

            if (btnCanvasWA) {
                btnCanvasWA.disabled = false;
                btnCanvasWA.innerHTML = originalBtnText;
            }
        }, 'image/png');

    } catch (error) {
        console.error('Error saat membuat Canvas Nota:', error);
        showToast('Gagal membuat gambar nota.');
        if (btnCanvasWA) {
            btnCanvasWA.disabled = false;
            btnCanvasWA.innerHTML = originalBtnText;
        }
    }
}

// ==========================================
// CEK URL PARAMETER SAAT HALAMAN DIMUAT (DEEP LINK)
// ==========================================
function checkDeepLinkProduk() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId || !globalData || globalData.length === 0) return;

    const targetIdClean = String(productId).trim().toLowerCase();
    
    const targetIndex = globalData.findIndex(row => row && String(row[0] || '').trim().toLowerCase() === targetIdClean);

    if (targetIndex !== -1) {
        showDetail(targetIndex);
    }
}

// ==========================================
// FUNGSI PROTEKSI LOGIN & KELOLA MODAL (FIX BACKDROP)
// ==========================================
function checkAuthOrShowModal(actionCallback) {
    const userSession = JSON.parse(localStorage.getItem('mustakimUser') || sessionStorage.getItem('mustakimUser'));
    
    if (!userSession) {
        const modalEl = document.getElementById('modalAuthRequired');
        if (modalEl) {
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            modal.show();
        }
        return false;
    }
    
    if (typeof actionCallback === 'function') actionCallback();
    return true;
}

// Navigasi Otomatis ke Menu Member/Login dari Modal
function keHalamanLogin() {
    const modalEl = document.getElementById('modalAuthRequired');
    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }
    cleanupModalBackdrop();
    switchNav('Member');
}

// Pembersih sisa bayangan modal (modal-backdrop)
function cleanupModalBackdrop() {
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');
}