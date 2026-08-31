/**
 * PROYEK: MUSTAKIM PHONE - Admin Logic (Supabase Version + Google Sheets Sync)
 * FULL RESTORED VERSION + DASHBOARD STATS + CATEGORIES, BANNER & BRAND MANAGEMENT
 * INTEGRASI KELOLA PESANAN, MODAL/LABA, STATUS NOTA VIA WHATSAPP & SINKRONISASI GOOGLE SHEETS
 */

// ==========================================
// KONEKSI SUPABASE & APPS SCRIPT WEBHOOK
// ==========================================
const SUPABASE_URL = 'https://btlxqbebbwtddcpzpaet.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0bHhxYmViYnd0ZGRjcHpwYWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyODc3NzksImV4cCI6MjEwMDg2Mzc3OX0.UTuPztP57dSbHwt5kJ2u30sSpcE3KQJ6vioPoEM7eEs';

const dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// URL Web App Apps Script untuk sinkronisasi otomatis ke Google Sheets
const APPS_SCRIPT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbyHOz_ro10lI_R_rUoedDA3K2PoN3uGL06stSFHsF6W0SD6rhdPlWjsKNldEJbnBpI-/exec';

// ==========================================
// STATE MANAGEMENT
// ==========================================
let currentPage = 1;
const rowsPerPage = 10;
let globalData = [];
let filteredData = [];
let globalOrders = [];
let filteredOrders = [];
let myChart = null; 
let searchChart = null;

// ==========================================
// INISIALISASI
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    setupSidebar();
    
    document.querySelectorAll('.section-content').forEach(s => s.style.display = 'none');
    const dashboard = document.getElementById('section-dashboard');
    if (dashboard) dashboard.style.display = 'block';
    
    const inputMerkHP = document.getElementById('inputMerkHP');
    if(inputMerkHP) {
        inputMerkHP.addEventListener('change', function() {
            const inputLainnya = document.getElementById('inputMerkLainnya');
            if (this.value === 'LAINNYA') {
                inputLainnya.style.display = 'block';
                inputLainnya.required = true;
            } else {
                inputLainnya.style.display = 'none';
                inputLainnya.required = false;
                inputLainnya.value = ''; 
            }
        });
    }

    const editMerkHP = document.getElementById('editMerkHP');
    if(editMerkHP) {
        editMerkHP.addEventListener('change', function() {
            const editLainnya = document.getElementById('editMerkLainnya');
            if (this.value === 'LAINNYA') {
                editLainnya.style.display = 'block';
            } else {
                editLainnya.style.display = 'none';
                editLainnya.value = '';
            }
        });
    }
    
    const filterService = document.getElementById('filterService');
    if(filterService) filterService.addEventListener('change', applyFilters);

    // Event Listener Filter & Search Orders
    const filterOrderStatus = document.getElementById('filterOrderStatus');
    if(filterOrderStatus) filterOrderStatus.addEventListener('change', applyOrderFilters);

    const searchOrderInput = document.getElementById('searchOrderInput');
    if(searchOrderInput) searchOrderInput.addEventListener('keyup', applyOrderFilters);

    // Event Listener Form
    const formKategori = document.getElementById('formUbahKategori');
    if(formKategori) formKategori.addEventListener('submit', simpanKategori);

    const formBanner = document.getElementById('formTambahBanner');
    if(formBanner) formBanner.addEventListener('submit', simpanBanner);

    const formBannerMp = document.getElementById('formUbahBannerMp');
    if(formBannerMp) formBannerMp.addEventListener('submit', simpanBannerMp);

    const formMerek = document.getElementById('formTambahMerek');
    if(formMerek) formMerek.addEventListener('submit', simpanMerek);

    loadData();
    loadOrders();
    loadCategories();
    loadBanners();
    loadBannerMp();
    loadBrands();
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
// SIDEBAR & NAVIGASI
// ==========================================
function setupSidebar() {
    const menuToggle = document.getElementById("menu-toggle");
    if (menuToggle) {
        menuToggle.addEventListener("click", (e) => {
            e.preventDefault();
            document.getElementById("wrapper").classList.toggle("toggled");
        });
    }

    const menuMapping = {
        'menu-dashboard': 'section-dashboard',
        'menu-orders': 'section-orders',
        'menu-data': 'section-table',
        'menu-tambah': 'section-form',
        'menu-kategori': 'section-kategori',
        'menu-banner': 'section-banner',
        'menu-bannermp': 'section-bannermp',
        'menu-merek': 'section-merek'
    };

    document.querySelectorAll('#sidebar-wrapper .list-group-item').forEach(item => {
        if (item.id === 'menu-logout') return; 

        item.addEventListener('click', function(e) {
            const targetId = menuMapping[this.id];
            if (targetId) {
                e.preventDefault();
                
                document.querySelectorAll('.list-group-item').forEach(i => {
                    i.classList.remove('active');
                    if (i.id !== 'menu-logout') i.classList.add('text-muted');
                });
                
                this.classList.add('active');
                this.classList.remove('text-muted');
                
                document.querySelectorAll('.section-content').forEach(s => {
                    s.style.display = 'none';
                    s.style.opacity = '0';
                });
                
                const targetSection = document.getElementById(targetId);
                if (targetSection) {
                    targetSection.style.display = 'block';
                    setTimeout(() => targetSection.style.opacity = '1', 50);
                }

                if (targetId === 'section-orders') {
                    loadOrders();
                }
                
                if (window.innerWidth < 992) {
                    document.getElementById('wrapper').classList.remove('toggled');
                }
            }
        });
    });
}

// ==========================================
// KELOLA PESANAN (ORDERS) MANAGEMENT
// ==========================================
async function loadOrders() {
    const grid = document.getElementById('ordersCardGrid');
    if (!grid) return;

    grid.innerHTML = `<div class="col-12 text-center text-muted py-5"><div class="spinner-border spinner-border-sm me-2"></div>Memuat data pesanan...</div>`;

    try {
        const { data, error } = await dbClient
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        globalOrders = data || [];
        applyOrderFilters();
        loadFinancialReport();
    } catch(err) {
        console.error("Gagal memuat orders:", err);
        grid.innerHTML = `<div class="col-12 text-center text-danger py-5"><i class="fa-solid fa-triangle-exclamation fa-2x mb-2"></i><p>Gagal memuat data pesanan: ${err.message}</p></div>`;
    }
}

function applyOrderFilters() {
    const statusVal = document.getElementById('filterOrderStatus') ? document.getElementById('filterOrderStatus').value : '';
    const searchVal = document.getElementById('searchOrderInput') ? document.getElementById('searchOrderInput').value.toLowerCase().trim() : '';

    filteredOrders = globalOrders.filter(order => {
        const matchStatus = statusVal === '' || order.status === statusVal;
        
        const itemsStr = Array.isArray(order.items) ? order.items.map(i => i.title).join(' ') : '';
        const searchTarget = `${order.order_id || ''} ${order.customer_name || ''} ${order.customer_phone || ''} ${order.note || ''} ${itemsStr}`.toLowerCase();
        const matchSearch = searchVal === '' || searchTarget.includes(searchVal);

        return matchStatus && matchSearch;
    });

    renderOrdersTable();
}

function renderOrdersTable() {
    const grid = document.getElementById('ordersCardGrid');
    if (!grid) return;

    // Update summary counters
    const allOrders = globalOrders;
    const elPending  = document.getElementById('countPending');
    const elDiproses = document.getElementById('countDiproses');
    const elSelesai  = document.getElementById('countSelesai');
    if (elPending)  elPending.textContent  = allOrders.filter(o => o.status === 'Pending').length;
    if (elDiproses) elDiproses.textContent = allOrders.filter(o => o.status === 'Diproses').length;
    if (elSelesai)  elSelesai.textContent  = allOrders.filter(o => o.status === 'Selesai').length;

    if (filteredOrders.length === 0) {
        grid.innerHTML = `
        <div class="col-12 text-center text-muted py-5">
            <i class="fa-solid fa-box-open fa-3x mb-3 opacity-25"></i>
            <h6 class="fw-semibold">Belum ada pesanan ditemukan</h6>
            <small>Coba ubah filter atau kata kunci pencarian.</small>
        </div>`;
        return;
    }

    grid.innerHTML = filteredOrders.map(order => {
        // Status config
        let statusColor = '#6c757d', statusBg = '#f8f9fa', statusIcon = 'fa-clock';
        if (order.status === 'Pending')  { statusColor = '#d97706'; statusBg = '#fffbeb'; statusIcon = 'fa-hourglass-half'; }
        if (order.status === 'Diproses') { statusColor = '#0ea5e9'; statusBg = '#e0f2fe'; statusIcon = 'fa-screwdriver-wrench'; }
        if (order.status === 'Selesai')  { statusColor = '#16a34a'; statusBg = '#dcfce7'; statusIcon = 'fa-circle-check'; }

        let tgl = order.created_at ? new Date(order.created_at).toLocaleString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : '-';

        let tipeHp = order.note ? order.note.trim() : '-';

        // Build items list
        let itemsHtml = '';
        if (Array.isArray(order.items) && order.items.length > 0) {
            itemsHtml = order.items.map(item => {
                let svcUp = String(item.service || item.title || '').toUpperCase();
                let iconCls = svcUp.includes('LCD') ? 'fa-mobile-screen text-primary'
                            : svcUp.includes('BAT') ? 'fa-battery-full text-success'
                            : svcUp.includes('SERVICE') ? 'fa-screwdriver-wrench text-warning'
                            : 'fa-wrench text-secondary';
                let ketBadge = (item.keterangan && item.keterangan !== '-')
                    ? `<span class="badge rounded-pill ms-1" style="background:#e0e7ff;color:#4338ca;font-size:0.6rem;">${item.keterangan}</span>` : '';
                return `<li class="d-flex align-items-center gap-1 mb-1" style="font-size:0.78rem;">
                    <i class="fa-solid ${iconCls} flex-shrink-0" style="width:14px;font-size:0.7rem;"></i>
                    <span class="text-dark fw-medium">${item.title}${ketBadge}</span>
                    <span class="ms-auto text-muted fw-semibold">${formatRupiah(item.price * item.qty)}</span>
                </li>`;
            }).join('');
        } else {
            itemsHtml = `<li class="text-muted small">Tidak ada item.</li>`;
        }

        let cleanPhone = String(order.customer_phone || '').replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);

        return `
        <div class="col-12 col-sm-6 col-xl-4">
            <div class="order-card h-100" onclick="bukaNotaDigitalAdmin('${order.order_id}')" style="cursor:pointer;">
                <!-- Header -->
                <div class="order-card-header d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <span class="fw-bold text-primary" style="font-size:0.85rem;">#${order.order_id}</span>
                        <div class="text-muted" style="font-size:0.68rem;">${tgl}</div>
                    </div>
                    <span class="badge rounded-pill fw-bold d-flex align-items-center gap-1" style="background:${statusBg}; color:${statusColor}; border:1px solid ${statusColor}; font-size:0.7rem; padding:5px 10px;">
                        <i class="fa-solid ${statusIcon}"></i> ${order.status}
                    </span>
                </div>

                <!-- Pelanggan -->
                <div class="d-flex align-items-center gap-2 mb-3 p-2 rounded-3" style="background:#f8fafc; border:1px dashed #e2e8f0;">
                    <div class="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0" style="width:36px;height:36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);font-size:0.85rem;">
                        ${(order.customer_name || 'X').charAt(0).toUpperCase()}
                    </div>
                    <div class="flex-grow-1 overflow-hidden">
                        <div class="fw-bold text-dark text-truncate" style="font-size:0.82rem;">${order.customer_name || '-'}</div>
                        <div class="text-muted" style="font-size:0.7rem;"><i class="fa-solid fa-mobile-screen me-1"></i>${tipeHp}</div>
                    </div>
                    <a href="https://wa.me/${cleanPhone}" target="_blank" onclick="event.stopPropagation()" class="btn btn-sm rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style="width:32px;height:32px;background:#25D366;color:#fff;border:none;" title="Chat WA">
                        <i class="fa-brands fa-whatsapp" style="font-size:0.9rem;"></i>
                    </a>
                </div>

                <!-- Item List -->
                <ul class="list-unstyled mb-2">
                    ${itemsHtml}
                </ul>

                <!-- Total & Ubah Status -->
                <div class="d-flex justify-content-between align-items-center pt-2 mt-auto" style="border-top:1px dashed #e2e8f0;">
                    <div>
                        <div class="text-muted" style="font-size:0.65rem;">TOTAL TAGIHAN</div>
                        <div class="fw-bolder text-primary" style="font-size:0.95rem;">${formatRupiah(order.total_price)}</div>
                    </div>
                    <select class="form-select form-select-sm fw-bold border-0 rounded-3 shadow-sm"
                        style="width:auto; background:${statusBg}; color:${statusColor}; font-size:0.75rem; cursor:pointer;"
                        onclick="event.stopPropagation()"
                        onchange="ubahStatusOrder(${order.id}, this.value)">
                        <option value="Pending"  ${order.status === 'Pending'  ? 'selected' : ''}>⏳ Pending</option>
                        <option value="Diproses" ${order.status === 'Diproses' ? 'selected' : ''}>🔧 Diproses</option>
                        <option value="Selesai"  ${order.status === 'Selesai'  ? 'selected' : ''}>✅ Selesai</option>
                    </select>
                </div>

                <!-- Aksi Bawah -->
                <div class="d-flex gap-2 mt-2" onclick="event.stopPropagation()">
                    <button onclick="bukaNotaDigitalAdmin('${order.order_id}')"
                        class="btn btn-sm fw-semibold flex-grow-1 rounded-3"
                        style="background:#1fa91c;color:#fff;font-size:0.75rem;padding:5px 0;">
                        <i class="fa-brands fa-whatsapp me-1"></i>Lihat & Kirim Nota
                    </button>
                    <button onclick="hapusOrder(${order.id})"
                        class="btn btn-sm btn-light text-danger rounded-3 border shadow-sm flex-shrink-0"
                        title="Hapus Pesanan" style="font-size:0.75rem;padding:5px 10px;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>`;
    }).join('');
}

async function ubahStatusOrder(orderDbId, statusBaru) {
    const order = globalOrders.find(o => o.id === orderDbId);
    if (!order) return;

    try {
        let updatePayload = { status: statusBaru };
        
        if (statusBaru.toLowerCase() === 'selesai') {
            updatePayload.completed_at = new Date().toISOString();
        }

        const { error } = await dbClient
            .from('orders')
            .update(updatePayload)
            .eq('id', orderDbId);

        if (error) throw error;

        order.status = statusBaru;

        // JIKA STATUS SELESAI -> KIRIM NOTA CANVAS DIGITAL KE WA PELANGGAN
        if (statusBaru.toLowerCase() === 'selesai') {
            Swal.fire({
                title: 'Pesanan Selesai!',
                text: `Status pesanan #${order.order_id} berhasil diubah ke SELESAI. Kirim Nota Canvas Digital (Gambar) ke WhatsApp pelanggan?`,
                icon: 'success',
                showCancelButton: true,
                confirmButtonColor: '#25D366',
                cancelButtonColor: '#6c757d',
                confirmButtonText: '<i class="fa-brands fa-whatsapp me-1"></i> Kirim Nota Canvas ke WA',
                cancelButtonText: 'Nanti Saja'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    await siapkanDanKirimNotaCanvas(order);
                }
            });
        } else {
            // Status lain (Diproses / Pending) -> kirim pesan teks notifikasi WA standar
            let tipeHp = order.note ? order.note.trim() : '-';
            let idPartsList = '-';
            let detailItemsText = '';

            if (Array.isArray(order.items) && order.items.length > 0) {
                idPartsList = order.items.map(i => {
                    let partId = i.id || '-';
                    let partKet = (i.keterangan && i.keterangan !== '-') ? ` (${i.keterangan})` : '';
                    return `${partId}${partKet}`;
                }).join(', ');

                detailItemsText = order.items.map((i, idx) => `${idx + 1}. *${i.title}* (${i.qty} Pcs)`).join('\n');
            }

            let cleanPhone = String(order.customer_phone || '').replace(/[^0-9]/g, '');
            if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);

            let pesanWA = `*UPDATE STATUS PESANAN - MUSTAKIM PHONE*\n`;
            pesanWA += `==============================\n`;
            pesanWA += `*No. Nota:* #${order.order_id || '-'}\n`;
            pesanWA += `*Nama Pelanggan:* ${order.customer_name || '-'}\n`;
            pesanWA += `*Tipe HP Pelanggan:* ${tipeHp}\n`;
            pesanWA += `*ID Part:* ${idPartsList}\n`;
            pesanWA += `==============================\n`;
            pesanWA += `*STATUS PESANAN:* *${statusBaru.toUpperCase()}*\n\n`;

            if (detailItemsText) {
                pesanWA += `*Detail Item:*\n${detailItemsText}\n\n`;
            }

            pesanWA += `==============================\n`;
            pesanWA += `*TOTAL TAGIHAN:* ${formatRupiah(order.total_price)}\n`;
            pesanWA += `==============================\n`;

            if (statusBaru.toLowerCase() === 'diproses') {
                pesanWA += `_Pesanan Anda saat ini sedang dalam pengerjaan oleh teknisi kami._`;
            } else {
                pesanWA += `_Pesanan Anda telah diterima dan dalam antrean pengerjaan._`;
            }

            let waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(pesanWA)}`;

            Swal.fire({
                title: 'Status Diperbarui!',
                text: `Status pesanan #${order.order_id} diubah menjadi "${statusBaru}". Kirim konfirmasi ke WhatsApp pelanggan?`,
                icon: 'success',
                showCancelButton: true,
                confirmButtonColor: '#25D366',
                cancelButtonColor: '#6c757d',
                confirmButtonText: '<i class="fa-brands fa-whatsapp me-1"></i> Kirim WA Pelanggan',
                cancelButtonText: 'Tutup'
            }).then((result) => {
                if (result.isConfirmed) {
                    window.open(waUrl, '_blank');
                }
            });
        }

        loadOrders();
    } catch(e) {
        Swal.fire('Gagal!', 'Gagal mengubah status: ' + e.message, 'error');
    }
}

async function siapkanDanKirimNotaCanvas(order) {
    if (!order) return;

    Swal.fire({
        title: 'Menyiapkan Nota Canvas...',
        text: 'Sedang memproses gambar nota resmi...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        let tgl = order.created_at ? new Date(order.created_at).toLocaleString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : '-';

        let statusUpper = (order.status || 'SELESAI').toUpperCase();
        let statusBadgeClass = 'bg-success text-white';

        let itemsHtml = '';
        if (Array.isArray(order.items)) {
            order.items.forEach((item, idx) => {
                let subtotal = (Number(item.price) || 0) * (Number(item.qty) || 1);
                let ketItem = (item.keterangan && item.keterangan !== '-') ? ` <span style="font-size:0.68rem; background:#e2e8f0; border-radius:4px; padding:1px 5px;">${item.keterangan}</span>` : '';
                let garansiItem = (item.garansi && item.garansi !== '-') ? item.garansi : '';
                if (!garansiItem) {
                    let svcUp = String(item.service || item.title || '').toUpperCase();
                    garansiItem = svcUp.includes('BAT') ? '1 Bulan' : svcUp.includes('LCD') ? '1 Minggu' : '';
                }
                let garansiBadge = garansiItem
                    ? `<br><span style="font-size:0.68rem; color:#555;">🛡 Garansi: ${garansiItem}</span>`
                    : '';
                itemsHtml += `
                <tr style="border-bottom: 1px dashed #dee2e6;">
                    <td style="padding: 6px 0; font-size: 0.8rem;">${idx + 1}. ${item.title}${ketItem}${garansiBadge}</td>
                    <td style="padding: 6px 0; font-size: 0.8rem; text-align: center;">${item.qty || 1}</td>
                    <td style="padding: 6px 0; font-size: 0.8rem; text-align: right;">${formatRupiah(subtotal)}</td>
                </tr>`;
            });
        }

        const printableArea = document.getElementById('printableNotaArea');
        if (printableArea) {
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
                    <span>Tipe HP: <strong>${order.note || '-'}</strong></span>
                </div>
                <hr style="border-top: 1.5px dashed #000; margin: 8px 0;">
                <table class="w-100 mb-2">
                    <thead>
                        <tr style="border-bottom: 1px solid #000; font-size: 0.75rem;">
                            <th class="py-1">Item Layanan / Part</th>
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
                    <span class="badge ${statusBadgeClass} shadow-sm" style="padding: 5px 12px; font-size: 0.72rem; font-weight: 800; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; line-height: 1;">
                        ${statusUpper}
                    </span>
                </div>

                <div class="text-center mt-4 pt-2 border-top">
                    <small class="text-muted d-block" style="font-size: 0.7rem;">Terima Kasih atas Kepercayaan Anda!</small>
                    <small class="text-muted d-block" style="font-size: 0.65rem;">Garansi berlaku sesuai ketentuan syarat nota.</small>
                </div>`;
        }

        await new Promise(resolve => setTimeout(resolve, 150));

        const canvas = await html2canvas(printableArea, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false
        });

        canvas.toBlob(async (blob) => {
            Swal.close();
            if (!blob) {
                Swal.fire('Gagal', 'Gagal memproses gambar nota.', 'error');
                return;
            }

            const fileName = `Nota-${order.order_id}.png`;
            const file = new File([blob], fileName, { type: 'image/png' });

            let noHpPelanggan = order.customer_phone ? String(order.customer_phone).replace(/[^0-9]/g, '') : '';
            if (noHpPelanggan.startsWith('0')) {
                noHpPelanggan = '62' + noHpPelanggan.slice(1);
            }

            let textChat = `Halo Kak ${order.customer_name}, pesanan/servis HP Anda #${order.order_id} telah SELESAI dikerjakan. Berikut kami lampirkan Nota Digital resmi dari MUSTAKIM PHONE.`;

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: `Nota ${order.order_id}`,
                        text: textChat
                    });
                } catch (err) {
                    console.log('User cancel share:', err);
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
            }
        }, 'image/png');

    } catch (err) {
        Swal.fire('Error', 'Gagal membuat nota canvas: ' + err.message, 'error');
    }
}

async function hapusOrder(id) {
    Swal.fire({
        title: 'Hapus Pesanan ini?',
        text: 'Data pesanan yang dihapus tidak dapat dikembalikan!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Ya, Hapus'
    }).then(async (res) => {
        if (res.isConfirmed) {
            try {
                const { error } = await dbClient.from('orders').delete().eq('id', id);
                if (error) throw error;
                Swal.fire('Terhapus!', 'Pesanan berhasil dihapus.', 'success');
                loadOrders();
            } catch(e) {
                Swal.fire('Gagal!', e.message, 'error');
            }
        }
    });
}

// ==========================================
// HITUNG & MUAT REKAP KEUANGAN (OMZET, MODAL, PROFIT)
// ==========================================
async function loadFinancialReport() {
    const elOmset = document.getElementById('statTotalOmset');
    const elModal = document.getElementById('statTotalModal');
    const elProfit = document.getElementById('statTotalProfit');
    const filterPeriode = document.getElementById('filterPeriodeKeuangan') ? document.getElementById('filterPeriodeKeuangan').value : 'bulan_ini';

    if (!elOmset || !elModal || !elProfit) return;

    try {
        const { data: orders, error } = await dbClient
            .from('orders')
            .select('*')
            .ilike('status', 'Selesai');

        if (error) throw error;

        let totalOmset = 0;
        let totalModal = 0;

        const sekarang = new Date();
        const bulanSekarang = sekarang.getMonth();
        const tahunSekarang = sekarang.getFullYear();
        const tanggalSekarangStr = sekarang.toDateString();

        const mapModalCatalog = {};
        if (Array.isArray(globalData)) {
            globalData.forEach(row => {
                const idItem = String(row[0] || '').trim();
                const hppNum = parseInt(String(row[5] || '0').replace(/[^0-9]/g, '')) || 0;
                if (idItem) {
                    mapModalCatalog[idItem] = hppNum;
                }
            });
        }

        orders.forEach(order => {
            const tglOrder = new Date(order.created_at || order.updated_at);

            if (filterPeriode === 'hari_ini') {
                if (tglOrder.toDateString() !== tanggalSekarangStr) return;
            } else if (filterPeriode === 'bulan_ini') {
                if (tglOrder.getMonth() !== bulanSekarang || tglOrder.getFullYear() !== tahunSekarang) return;
            }

            const omsetOrder = parseInt(order.total_price) || 0;
            totalOmset += omsetOrder;

            if (Array.isArray(order.items)) {
                order.items.forEach(item => {
                    const itemId = item.id ? String(item.id).trim() : '';
                    const qty = parseInt(item.qty) || 1;

                    let modalSatuan = item.modal || mapModalCatalog[itemId] || 0;
                    if (!modalSatuan && item.price) {
                        modalSatuan = Math.round(item.price * 0.7);
                    }

                    totalModal += (modalSatuan * qty);
                });
            }
        });

        const totalProfit = totalOmset - totalModal;

        elOmset.innerText = formatRupiahAdmin(totalOmset);
        elModal.innerText = formatRupiahAdmin(totalModal);
        elProfit.innerText = formatRupiahAdmin(totalProfit);

    } catch (err) {
        console.error("Gagal memuat rekap keuangan:", err);
    }
}

function formatRupiah(angka) {
    let cleanNumber = String(angka || 0).replace(/[^0-9]/g, '');
    if (!cleanNumber || cleanNumber === '') return 'Rp0';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(cleanNumber).replace(/\s/g, '');
}

function formatRupiahAdmin(angka) {
    return formatRupiah(angka);
}

// ==========================================
// DATA LOADING & DASHBOARD
// ==========================================
async function loadData() {
  Swal.fire({ 
      title: 'Memuat Data...', 
      allowOutsideClick: false, 
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
      customClass: { popup: 'rounded-4 shadow-sm border-0' }
  });

  try {
    const { data, error } = await dbClient
        .from('data_service')
        .select('*');

    if (error) throw error;

    globalData = (data || []).map(item => [
        item.id,             // 0
        item.merk_hp,        // 1
        item.type_hp,        // 2
        item.jenis_service,  // 3
        item.harga,          // 4
        item.modal || 0,     // 5
        item.garansi,        // 6
        item.keterangan,     // 7
        item.status,         // 8
        item.update,         // 9
        item.timestamp_asli  // 10
    ]);
    
    globalData.sort((a, b) => {
        let merkA = String(a[1] || '').toUpperCase();
        let merkB = String(b[1] || '').toUpperCase();
        if (merkA !== merkB) return merkA.localeCompare(merkB);

        let typeA = String(a[2] || '').toUpperCase();
        let typeB = String(b[2] || '').toUpperCase();
        if (typeA !== typeB) return typeA.localeCompare(typeB);

        let serviceA = String(a[3] || '').toUpperCase();
        let serviceB = String(b[3] || '').toUpperCase();
        return serviceA.localeCompare(serviceB);
    });

    filteredData = [...globalData];

    updateDashboard();
    setupDashboardShortcuts(); 
    renderBrandFilterBoxes();
    if (currentDataViewMode === 'box') {
        renderGroupedBrandBoxes();
    } else {
        renderTable();
    }
    renderRecentActivity(globalData);
    renderChart(globalData);
    loadFinancialReport();
    
    renderTopSearchesChart([['LCD', 5], ['Baterai', 3], ['Infinix', 2]]);
    const visitorEl = document.getElementById('stat-visitors');
    if(visitorEl) visitorEl.textContent = '120';

    Swal.close();
  } catch(e) { 
      Swal.fire({ title: 'Error', text: e.message, icon: 'error', customClass: { popup: 'rounded-4 shadow-sm border-0' } }); 
  }
}

function updateDashboard() {
  if (!globalData || globalData.length === 0) return;
  const merkSet = new Set(), typeSet = new Set();
  let countLCD = 0, countBattery = 0;
  globalData.forEach(row => {
    if (row[1]) merkSet.add(row[1]); 
    if (row[2]) typeSet.add(row[2]);
    const service = String(row[3] || '').toUpperCase();
    if(service.includes('LCD')) countLCD++;
    if(service.includes('BAT')) countBattery++;
  });
  if(document.getElementById('stat-merk')) document.getElementById('stat-merk').textContent = merkSet.size;
  if(document.getElementById('stat-type')) document.getElementById('stat-type').textContent = typeSet.size;
  if(document.getElementById('stat-lcd')) document.getElementById('stat-lcd').textContent = countLCD;
  if(document.getElementById('stat-battery')) document.getElementById('stat-battery').textContent = countBattery;
  if(document.getElementById('stat-total-data')) document.getElementById('stat-total-data').textContent = globalData.length;
}

function setupDashboardShortcuts() {
    const cards = [
        { id: 'card-merk', filter: 'merk' },
        { id: 'card-type', filter: 'type' },
        { id: 'card-lcd', filter: 'lcd' },
        { id: 'card-bat', filter: 'battery' }
    ];
    
    cards.forEach(c => {
        const el = document.getElementById(c.id);
        if (el) {
            el.style.cursor = 'pointer';
            el.setAttribute('title', 'Klik untuk melihat detail data');
            el.onclick = () => filterFromDashboard(c.filter);
        }
    });
}

function filterFromDashboard(category) {
    if (category === 'merk') { showMerkModal(); return; } 
    else if (category === 'type') { showTypeModal(); return; } 
    else if (category === 'lcd') { showLcdModal(); return; } 
    else if (category === 'battery') { showBatModal(); return; }
}

function showMerkModal() {
    const merkCounts = {}; 
    globalData.forEach(row => {
        let m = String(row[1] || '').toUpperCase().trim();
        if(m) { merkCounts[m] = (merkCounts[m] || 0) + 1; }
    });

    const container = document.getElementById('containerGridMerk');
    if (!container) return;
    container.innerHTML = '';

    const divSemua = document.createElement('div');
    divSemua.className = 'col-6 col-sm-4 col-md-3';
    divSemua.innerHTML = `
        <div class="brand-box" onclick="filterBySpecificMerk('SEMUA')">
            <div class="brand-card-img-wrap"><i class="fa-solid fa-layer-group text-primary fs-4"></i></div>
            <h5>SEMUA</h5>
            <div class="brand-badge">${globalData.length} Data</div>
        </div>
    `;
    container.appendChild(divSemua);

    Object.keys(merkCounts).sort().forEach(merk => {
        const count = merkCounts[merk];
        const safeMerk = merk.replace(/'/g, "\\'");
        const div = document.createElement('div');
        div.className = 'col-6 col-sm-4 col-md-3';
        div.innerHTML = `
            <div class="brand-box" onclick="filterBySpecificMerk('${safeMerk}')" title="${merk}">
                <div class="brand-card-img-wrap"><i class="fa-solid fa-mobile-screen-button text-dark fs-4"></i></div>
                <h5>${merk}</h5>
                <div class="brand-badge">${count} Tipe</div>
            </div>
        `;
        container.appendChild(div);
    });

    new bootstrap.Modal(document.getElementById('modalPilihMerk')).show();
}

function showTypeModal() {
    const typeCounts = {};
    globalData.forEach(row => {
        let t = String(row[2] || '').toUpperCase().trim();
        if(t) { typeCounts[t] = (typeCounts[t] || 0) + 1; }
    });

    const container = document.getElementById('containerGridType');
    if (!container) return;
    container.innerHTML = '';

    const divSemua = document.createElement('div');
    divSemua.className = 'col-6 col-sm-4 col-md-3';
    divSemua.innerHTML = `
        <div class="brand-box" onclick="filterBySpecificType('SEMUA')">
            <div class="brand-card-img-wrap"><i class="fa-solid fa-layer-group text-primary fs-4"></i></div>
            <h5>SEMUA</h5>
            <div class="brand-badge">${globalData.length} Data</div>
        </div>
    `;
    container.appendChild(divSemua);

    Object.keys(typeCounts).sort().forEach(type => {
        const count = typeCounts[type];
        const safeType = type.replace(/'/g, "\\'");
        const div = document.createElement('div');
        div.className = 'col-6 col-sm-4 col-md-3';
        div.innerHTML = `
            <div class="brand-box" onclick="filterBySpecificType('${safeType}')" title="${type}">
                <div class="brand-card-img-wrap"><i class="fa-solid fa-mobile-screen text-dark fs-4"></i></div>
                <h5>${type}</h5>
                <div class="brand-badge">${count} Item</div>
            </div>
        `;
        container.appendChild(div);
    });

    new bootstrap.Modal(document.getElementById('modalPilihType')).show();
}

function showLcdModal() {
    const lcdData = globalData.filter(row => String(row[3] || '').toUpperCase().includes('LCD'));
    const merkCounts = {};
    lcdData.forEach(row => {
        let m = String(row[1] || '').toUpperCase().trim();
        if(m) { merkCounts[m] = (merkCounts[m] || 0) + 1; }
    });

    const container = document.getElementById('containerGridLcd');
    if (!container) return;
    container.innerHTML = '';

    const divSemua = document.createElement('div');
    divSemua.className = 'col-6 col-sm-4 col-md-3';
    divSemua.innerHTML = `
        <div class="brand-box" onclick="filterBySpecificLcdMerk('SEMUA')">
            <div class="brand-card-img-wrap"><i class="fa-solid fa-layer-group text-success fs-4"></i></div>
            <h5>SEMUA LCD</h5>
            <div class="brand-badge">${lcdData.length} Data</div>
        </div>
    `;
    container.appendChild(divSemua);

    Object.keys(merkCounts).sort().forEach(merk => {
        const count = merkCounts[merk];
        const safeMerk = merk.replace(/'/g, "\\'");
        const div = document.createElement('div');
        div.className = 'col-6 col-sm-4 col-md-3';
        div.innerHTML = `
            <div class="brand-box" onclick="filterBySpecificLcdMerk('${safeMerk}')" title="${merk}">
                <div class="brand-card-img-wrap"><i class="fa-solid fa-mobile-screen-button text-success fs-4"></i></div>
                <h5>${merk}</h5>
                <div class="brand-badge">${count} LCD</div>
            </div>
        `;
        container.appendChild(div);
    });

    new bootstrap.Modal(document.getElementById('modalPilihLcd')).show();
}

function showBatModal() {
    const batData = globalData.filter(row => String(row[3] || '').toUpperCase().includes('BAT'));
    const merkCounts = {};
    batData.forEach(row => {
        let m = String(row[1] || '').toUpperCase().trim();
        if(m) { merkCounts[m] = (merkCounts[m] || 0) + 1; }
    });

    const container = document.getElementById('containerGridBat');
    if (!container) return;
    container.innerHTML = '';

    const divSemua = document.createElement('div');
    divSemua.className = 'col-6 col-sm-4 col-md-3';
    divSemua.innerHTML = `
        <div class="brand-box" onclick="filterBySpecificBatMerk('SEMUA')">
            <div class="brand-card-img-wrap"><i class="fa-solid fa-battery-full text-warning fs-4"></i></div>
            <h5>SEMUA BAT</h5>
            <div class="brand-badge">${batData.length} Data</div>
        </div>
    `;
    container.appendChild(divSemua);

    Object.keys(merkCounts).sort().forEach(merk => {
        const count = merkCounts[merk];
        const safeMerk = merk.replace(/'/g, "\\'");
        const div = document.createElement('div');
        div.className = 'col-6 col-sm-4 col-md-3';
        div.innerHTML = `
            <div class="brand-box" onclick="filterBySpecificBatMerk('${safeMerk}')" title="${merk}">
                <div class="brand-card-img-wrap"><i class="fa-solid fa-battery-full text-warning fs-4"></i></div>
                <h5>${merk}</h5>
                <div class="brand-badge">${count} Bat</div>
            </div>
        `;
        container.appendChild(div);
    });

    new bootstrap.Modal(document.getElementById('modalPilihBat')).show();
}

window.filterBySpecificMerk = function(merkName) {
    const modalEl = document.getElementById('modalPilihMerk');
    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }
    const searchInput = document.getElementById('searchInput');
    const filterService = document.getElementById('filterService');
    if (searchInput) searchInput.value = merkName === 'SEMUA' ? '' : merkName;
    if (filterService) filterService.value = '';

    if (merkName === 'SEMUA') {
        filteredData = [...globalData];
    } else {
        filteredData = globalData.filter(row => String(row[1] || '').toUpperCase().trim() === merkName);
    }
    currentPage = 1;
    renderTable();
    const menuData = document.getElementById('menu-data');
    if (menuData) menuData.click();
};

window.filterBySpecificType = function(typeName) {
    const modalEl = document.getElementById('modalPilihType');
    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }
    const searchInput = document.getElementById('searchInput');
    const filterService = document.getElementById('filterService');
    if (searchInput) searchInput.value = typeName === 'SEMUA' ? '' : typeName;
    if (filterService) filterService.value = '';

    if (typeName === 'SEMUA') {
        filteredData = [...globalData];
    } else {
        filteredData = globalData.filter(row => String(row[2] || '').toUpperCase().trim() === typeName);
    }
    currentPage = 1;
    renderTable();
    const menuData = document.getElementById('menu-data');
    if (menuData) menuData.click();
};

window.filterBySpecificLcdMerk = function(merkName) {
    const modalEl = document.getElementById('modalPilihLcd');
    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }
    const searchInput = document.getElementById('searchInput');
    const filterService = document.getElementById('filterService');
    if (searchInput) searchInput.value = '';
    if (filterService) filterService.value = 'GANTI LCD';

    if (merkName === 'SEMUA') {
        filteredData = globalData.filter(row => String(row[3] || '').toUpperCase().includes('LCD'));
    } else {
        filteredData = globalData.filter(row => String(row[3] || '').toUpperCase().includes('LCD') && String(row[1] || '').toUpperCase().trim() === merkName);
    }
    currentPage = 1;
    renderTable();
    const menuData = document.getElementById('menu-data');
    if (menuData) menuData.click();
};

window.filterBySpecificBatMerk = function(merkName) {
    const modalEl = document.getElementById('modalPilihBat');
    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }
    const searchInput = document.getElementById('searchInput');
    const filterService = document.getElementById('filterService');
    if (searchInput) searchInput.value = '';
    if (filterService) filterService.value = 'GANTI BAT';

    if (merkName === 'SEMUA') {
        filteredData = globalData.filter(row => String(row[3] || '').toUpperCase().includes('BAT'));
    } else {
        filteredData = globalData.filter(row => String(row[3] || '').toUpperCase().includes('BAT') && String(row[1] || '').toUpperCase().trim() === merkName);
    }
    currentPage = 1;
    renderTable();
    const menuData = document.getElementById('menu-data');
    if (menuData) menuData.click();
};

// ==========================================
// CRUD LOGIC SERVICE DATA
// ==========================================
document.getElementById('formTambahData').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  let merkSelect = document.getElementById('inputMerkHP').value;      
  let merk = (merkSelect === 'LAINNYA') ? document.getElementById('inputMerkLainnya').value.trim() : merkSelect;
  let type = document.getElementById('inputTypeHP').value;      
  let service = document.getElementById('inputJenisService').value; 
  
  let baseMerkType = `${merk.toUpperCase()}${type.split(/[,\/]+/)[0].trim().toUpperCase().replace(/\s+/g, '')}`;
  let baseService = service.toUpperCase().replace('GANTI ', '').trim();

  let ketInput = (document.getElementById('inputKeterangan').value || '').trim().toUpperCase();
  let ketClean = ketInput.replace(/[^A-Z0-9]/g, '');
  
  let suffix = '';
  if (ketClean.length > 0 && ketClean !== '-') {
      suffix = ketClean.substring(0, 3);
  } else {
      suffix = Math.floor(1000 + Math.random() * 9000);
  }

  let id = `${baseMerkType}-${baseService}-${suffix}`;

  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  let waktuUpdate = new Date().toLocaleDateString('id-ID', options).replace(' pukul', ',');

  let modalInput = document.getElementById('inputModal') ? parseInt(document.getElementById('inputModal').value) : 0;
  let hargaJualInput = parseInt(document.getElementById('inputHarga').value) || 0;

  const payload = {
    id: id, 
    merk_hp: merk.toUpperCase(), 
    type_hp: type.toUpperCase(), 
    jenis_service: service,
    modal: modalInput || 0,
    harga: hargaJualInput,
    garansi: document.getElementById('inputGaransi').value,
    status: document.getElementById('inputStatus').value,
    keterangan: document.getElementById('inputKeterangan').value || '-',
    update: waktuUpdate
  };
  
  Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
  
  try {
      const { error } = await dbClient.from('data_service').insert([payload]);
      if (error) throw error;

      try {
          await fetch(APPS_SCRIPT_WEBHOOK_URL, {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });
      } catch (sheetErr) {
          console.error('Gagal sinkron ke Google Sheets:', sheetErr);
      }

      Swal.fire({ title: 'Berhasil!', text: 'Data baru berhasil disimpan ke Database dan Google Sheets.', icon: 'success' });
      document.getElementById('formTambahData').reset();
      document.getElementById('inputMerkLainnya').style.display = 'none'; 
      loadData();
      document.getElementById('menu-data').click();
  } catch (err) {
      Swal.fire({ title: 'Gagal Menyimpan', text: err.message, icon: 'error' });
  }
});

window.openEditModal = function(id) {
  const row = globalData.find(r => r[0] == id);
  if (!row) return;
  document.getElementById('editDataId').value = row[0];
  document.getElementById('editMerkHP').value = row[1];
  document.getElementById('editTypeHP').value = row[2];
  document.getElementById('editJenisService').value = row[3];
  
  if (document.getElementById('editModal')) {
      document.getElementById('editModal').value = String(row[5] || 0).replace(/[^0-9]/g, '');
  }
  document.getElementById('editHarga').value = String(row[4] || 0).replace(/[^0-9]/g, '');
  document.getElementById('editGaransi').value = row[6];
  
  let statusData = String(row[8] || '').toLowerCase().trim();
  let selectStatus = document.getElementById('editStatus');
  for (let i = 0; i < selectStatus.options.length; i++) {
    if (selectStatus.options[i].value.toLowerCase() === statusData) { selectStatus.selectedIndex = i; break; }
  }
  document.getElementById('editKeterangan').value = row[7] || "";
  new bootstrap.Modal(document.getElementById('modalEdit')).show();
};

document.getElementById('btnUpdateData').addEventListener('click', async function() {
  let editMerkSelect = document.getElementById('editMerkHP').value;
  let editMerkFinal = (editMerkSelect === 'LAINNYA') ? document.getElementById('editMerkLainnya').value.trim() : editMerkSelect;
  let recordId = document.getElementById('editDataId').value;

  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  let waktuUpdate = new Date().toLocaleDateString('id-ID', options).replace(' pukul', ',');

  let editModalInput = document.getElementById('editModal') ? parseInt(document.getElementById('editModal').value) : 0;
  let editHargaInput = parseInt(document.getElementById('editHarga').value) || 0;

  const payload = {
    merk_hp: editMerkFinal.toUpperCase(), 
    type_hp: document.getElementById('editTypeHP').value.toUpperCase(), 
    jenis_service: document.getElementById('editJenisService').value,
    modal: editModalInput || 0,
    harga: editHargaInput, 
    garansi: document.getElementById('editGaransi').value,
    status: document.getElementById('editStatus').value, 
    keterangan: document.getElementById('editKeterangan').value || '-',
    update: waktuUpdate
  };

  try {
      const { error } = await dbClient.from('data_service').update(payload).eq('id', recordId);
      if (error) throw error;

      try {
          await fetch(APPS_SCRIPT_WEBHOOK_URL, {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: recordId, ...payload })
          });
      } catch (sheetErr) {
          console.error('Gagal sinkron update ke Google Sheets:', sheetErr);
      }

      Swal.fire({ title: 'Berhasil!', text: 'Data telah diperbarui di Database & Google Sheets.', icon: 'success' });
      bootstrap.Modal.getInstance(document.getElementById('modalEdit')).hide();
      loadData();
  } catch (err) {
      Swal.fire({ title: 'Gagal Update', text: err.message, icon: 'error' });
  }
});

window.deleteRecord = function(id) {
  Swal.fire({ 
      title: 'Yakin ingin menghapus?', 
      text: "Data akan dihapus dari Supabase Database dan Google Sheets!", 
      icon: 'warning', 
      showCancelButton: true, 
      confirmButtonColor: '#ef4444', 
      cancelButtonColor: '#f1f5f9',
      confirmButtonText: 'Ya, Hapus', 
      cancelButtonText: '<span class="text-dark">Batal</span>'
  }).then(async (result) => {
    if (result.isConfirmed) { 
        try {
            const { error } = await dbClient.from('data_service').delete().eq('id', id);
            if (error) throw error;

            try {
                await fetch(APPS_SCRIPT_WEBHOOK_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'delete', id: id })
                });
            } catch (sheetErr) {
                console.error('Gagal hapus di Google Sheets:', sheetErr);
            }

            Swal.fire({ title: 'Terhapus!', text: 'Data berhasil dihapus dari Supabase & Google Sheets.', icon: 'success', timer: 1500, showConfirmButton: false });
            loadData();
        } catch(err) {
            Swal.fire({ title: 'Gagal', text: err.message, icon: 'error' });
        }
    }
  });
}

// ==========================================
// CATEGORIES MANAGEMENT
// ==========================================
async function loadCategories() {
    const container = document.getElementById('containerListKategori');
    if (!container) return;

    try {
        const { data, error } = await dbClient.from('categories').select('*');
        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = `<div class="col-12 text-center text-muted py-3">Belum ada gambar kategori tersimpan.</div>`;
            return;
        }

        container.innerHTML = data.map(c => `
            <div class="col-6 col-md-3 text-center">
                <div class="p-3 border rounded-3 bg-white shadow-sm">
                    <img src="${c.image_url}" loading="lazy" class="img-fluid mb-2" style="max-height: 60px; object-fit: contain;">
                    <div class="fw-bold text-uppercase" style="font-size:0.8rem;">${c.name}</div>
                </div>
            </div>
        `).join('');
    } catch(err) {
        if (container) container.innerHTML = `<div class="col-12 text-center text-danger py-3">Gagal memuat gambar kategori.</div>`;
    }
}

async function simpanKategori(e) {
    e.preventDefault();
    const name = document.getElementById('selectKategoriName').value;
    const imageUrl = document.getElementById('inputKategoriUrl').value.trim();

    if (!imageUrl) {
        Swal.fire('Peringatan', 'URL Gambar Kategori wajib diisi!', 'warning');
        return;
    }

    try {
        const { error } = await dbClient
            .from('categories')
            .upsert({ name: name, image_url: imageUrl }, { onConflict: 'name' });

        if (error) throw error;

        Swal.fire('Berhasil!', `Gambar untuk kategori ${name} telah diperbarui.`, 'success');
        document.getElementById('inputKategoriUrl').value = '';
        loadCategories();
    } catch(err) {
        Swal.fire('Gagal', err.message, 'error');
    }
}

// ==========================================
// BANNER MANAGEMENT
// ==========================================
async function loadBanners() {
    const container = document.getElementById('containerListBanner');
    if (!container) return;

    try {
        const { data, error } = await dbClient.from('banners').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = `<div class="col-12 text-center text-muted py-3">Belum ada banner tersimpan.</div>`;
            return;
        }

        container.innerHTML = data.map(b => `
            <div class="col-6 col-md-4">
                <div class="card border-0 shadow-sm overflow-hidden position-relative rounded-3">
                    <img src="${b.image_url}" loading="lazy" class="w-100" style="aspect-ratio: 3/1; object-fit: cover;">
                    <button onclick="deleteBanner(${b.id})" class="btn btn-danger btn-sm position-absolute top-0 end-0 m-2 rounded-circle" title="Hapus Banner">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } catch(err) {
        if (container) container.innerHTML = `<div class="col-12 text-center text-danger py-3">Gagal memuat banner.</div>`;
    }
}

async function simpanBanner(e) {
    e.preventDefault();
    const title = document.getElementById('inputBannerTitle').value.trim();
    const imageUrl = document.getElementById('inputBannerUrl').value.trim();

    if (!imageUrl) {
        Swal.fire('Peringatan', 'URL Gambar Banner wajib diisi!', 'warning');
        return;
    }

    try {
        const { error } = await dbClient.from('banners').insert([{ title: title || 'Banner Promo', image_url: imageUrl }]);
        if (error) throw error;

        Swal.fire('Berhasil!', 'Banner promo berhasil ditambahkan.', 'success');
        document.getElementById('formTambahBanner').reset();
        loadBanners();
    } catch(err) {
        Swal.fire('Gagal', err.message, 'error');
    }
}

async function deleteBanner(id) {
    if (confirm("Hapus banner ini?")) {
        try {
            const { error } = await dbClient.from('banners').delete().eq('id', id);
            if (error) throw error;
            loadBanners();
        } catch(err) {
            alert("Gagal menghapus: " + err.message);
        }
    }
}

// ==========================================
// BANNER MP MANAGEMENT
// ==========================================
async function loadBannerMp() {
    const container = document.getElementById('containerListBannerMp');
    if (!container) return;

    try {
        const { data, error } = await dbClient.from('banner_mp').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = `<div class="col-12 text-center text-muted py-3">Belum ada Banner MP tersimpan.</div>`;
            return;
        }

        container.innerHTML = data.map(b => `
            <div class="col-6 col-md-4">
                <div class="card border-0 shadow-sm overflow-hidden position-relative rounded-3">
                    <img src="${b.image_url}" loading="lazy" class="w-100" style="aspect-ratio: 3/1; object-fit: cover;">
                    <button onclick="deleteBannerMp(${b.id})" class="btn btn-danger btn-sm position-absolute top-0 end-0 m-2 rounded-circle" title="Hapus Banner MP">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } catch(err) {
        if (container) container.innerHTML = `<div class="col-12 text-center text-danger py-3">Gagal memuat Banner MP.</div>`;
    }
}

async function simpanBannerMp(e) {
    e.preventDefault();
    const title = document.getElementById('inputBannerMpTitle').value.trim();
    const imageUrl = document.getElementById('inputBannerMpUrl').value.trim();

    if (!imageUrl) {
        Swal.fire('Peringatan', 'URL Gambar Banner MP wajib diisi!', 'warning');
        return;
    }

    try {
        const { error } = await dbClient.from('banner_mp').insert([{ title: title || 'Banner MP', image_url: imageUrl }]);
        if (error) throw error;

        Swal.fire('Berhasil!', 'Banner MP berhasil disimpan.', 'success');
        document.getElementById('formUbahBannerMp').reset();
        loadBannerMp();
    } catch(err) {
        Swal.fire('Gagal', err.message, 'error');
    }
}

async function deleteBannerMp(id) {
    if (confirm("Hapus Banner MP ini?")) {
        try {
            const { error } = await dbClient.from('banner_mp').delete().eq('id', id);
            if (error) throw error;
            loadBannerMp();
        } catch(err) {
            alert("Gagal menghapus: " + err.message);
        }
    }
}

// ==========================================
// BRAND MANAGEMENT
// ==========================================
async function loadBrands() {
    const container = document.getElementById('containerListMerek');
    if (!container) return;

    try {
        const { data, error } = await dbClient.from('brands').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = `<div class="col-12 text-center text-muted py-3">Belum ada merek tersimpan.</div>`;
            return;
        }

        container.innerHTML = data.map(m => `
            <div class="col-4 col-md-3 text-center">
                <div class="p-3 border rounded-3 bg-white position-relative shadow-sm">
                    <img src="${m.image_url}" loading="lazy" class="img-fluid mb-2" style="max-height: 50px; object-fit: contain;">
                    <div class="fw-bold text-uppercase" style="font-size:0.8rem;">${m.name}</div>
                    <button onclick="deleteBrand(${m.id})" class="btn btn-sm btn-outline-danger mt-2 w-100 rounded-2"><i class="fa-solid fa-trash me-1"></i>Hapus</button>
                </div>
            </div>
        `).join('');
    } catch(err) {
        if (container) container.innerHTML = `<div class="col-12 text-center text-danger py-3">Gagal memuat data merek.</div>`;
    }
}

async function simpanMerek(e) {
    e.preventDefault();
    const name = document.getElementById('inputMerekName').value.trim().toUpperCase();
    const imageUrl = document.getElementById('inputMerekUrl').value.trim();

    if (!name || !imageUrl) {
        Swal.fire('Peringatan', 'Nama Merek dan URL Logo wajib diisi!', 'warning');
        return;
    }

    try {
        const { error } = await dbClient.from('brands').insert([{ name: name, image_url: imageUrl }]);
        if (error) throw error;

        Swal.fire('Berhasil!', 'Merek baru berhasil ditambahkan.', 'success');
        document.getElementById('formTambahMerek').reset();
        loadBrands();
    } catch(err) {
        Swal.fire('Gagal', err.message, 'error');
    }
}

async function deleteBrand(id) {
    if (confirm("Hapus merek ini?")) {
        try {
            const { error } = await dbClient.from('brands').delete().eq('id', id);
            if (error) throw error;
            loadBrands();
        } catch(err) {
            alert("Gagal menghapus: " + err.message);
        }
    }
}

// ==========================================
// TAMPILAN BOX PER MERK & TABEL DATA
// ==========================================
let currentDataViewMode = 'box';
let activeSelectedBrand = 'SEMUA';

function switchDataViewMode(mode) {
    currentDataViewMode = mode;
    const btnBox = document.getElementById('btnViewBox');
    const btnTable = document.getElementById('btnViewTable');
    const viewModeBox = document.getElementById('viewModeBox');
    const viewModeTable = document.getElementById('viewModeTable');

    if (mode === 'box') {
        if (btnBox) {
            btnBox.className = 'btn btn-sm btn-primary fw-semibold px-3';
        }
        if (btnTable) {
            btnTable.className = 'btn btn-sm btn-outline-secondary fw-semibold px-3';
        }
        if (viewModeBox) viewModeBox.style.display = 'block';
        if (viewModeTable) viewModeTable.style.display = 'none';
        renderGroupedBrandBoxes();
    } else {
        if (btnBox) {
            btnBox.className = 'btn btn-sm btn-outline-secondary fw-semibold px-3';
        }
        if (btnTable) {
            btnTable.className = 'btn btn-sm btn-primary fw-semibold px-3';
        }
        if (viewModeBox) viewModeBox.style.display = 'none';
        if (viewModeTable) viewModeTable.style.display = 'block';
        renderTable();
    }
}

function selectBrandFromBox(brandName) {
    activeSelectedBrand = brandName;
    applyFilters();
}

function getBrandLogoUrl(brandName) {
    const bName = String(brandName || '').trim().toUpperCase();
    if (window.customBrandsData && Array.isArray(window.customBrandsData)) {
        const found = window.customBrandsData.find(b => b.name && b.name.toUpperCase() === bName);
        if (found && found.image_url) return found.image_url;
    }
    return null;
}

function renderBrandFilterBoxes() {
    const grid = document.getElementById('brandFilterGrid');
    if (!grid) return;

    const brandCounts = {};
    globalData.forEach(row => {
        const m = String(row[1] || '').trim().toUpperCase();
        if (m) {
            brandCounts[m] = (brandCounts[m] || 0) + 1;
        }
    });

    const sortedBrands = Object.keys(brandCounts).sort();

    let html = `
        <div class="col-auto">
            <div class="brand-filter-card ${activeSelectedBrand === 'SEMUA' ? 'active' : ''}" onclick="selectBrandFromBox('SEMUA')">
                <div class="brand-icon-mini"><i class="fa-solid fa-layer-group"></i></div>
                <div>
                    <span class="brand-name-text d-block">SEMUA</span>
                    <span class="brand-count-pill">${globalData.length} item</span>
                </div>
            </div>
        </div>
    `;

    sortedBrands.forEach(brand => {
        const isActive = activeSelectedBrand === brand;
        const logoUrl = getBrandLogoUrl(brand);
        const iconHtml = logoUrl 
            ? `<img src="${logoUrl}" width="24" height="24" alt="${brand}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`
            : (brand.includes('IPHONE') || brand.includes('APPLE') ? '<i class="fa-brands fa-apple"></i>' : '<i class="fa-solid fa-mobile-screen"></i>');

        html += `
            <div class="col-auto">
                <div class="brand-filter-card ${isActive ? 'active' : ''}" onclick="selectBrandFromBox('${brand}')">
                    <div class="brand-icon-mini">${iconHtml}</div>
                    <div>
                        <span class="brand-name-text d-block">${brand}</span>
                        <span class="brand-count-pill">${brandCounts[brand]} item</span>
                    </div>
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;
}

function renderGroupedBrandBoxes() {
    const container = document.getElementById('groupedBrandContainer');
    if (!container) return;

    if (!filteredData || filteredData.length === 0) {
        container.innerHTML = `
            <div class="premium-card text-center py-5">
                <i class="fa-solid fa-box-open text-muted fs-1 mb-2"></i>
                <h6 class="fw-bold text-dark">Tidak Ada Data Ditemukan</h6>
                <p class="text-muted small mb-0">Coba ubah kata kunci pencarian atau pilih merk lainnya.</p>
            </div>
        `;
        return;
    }

    const groups = {};
    filteredData.forEach(row => {
        const brand = String(row[1] || 'LAINNYA').trim().toUpperCase();
        if (!groups[brand]) groups[brand] = [];
        groups[brand].push(row);
    });

    const sortedGroupKeys = Object.keys(groups).sort();
    let html = '';

    sortedGroupKeys.forEach((brand, groupIndex) => {
        const items = groups[brand];
        const logoUrl = getBrandLogoUrl(brand);
        const iconHtml = logoUrl 
            ? `<img src="${logoUrl}" width="32" height="32" alt="${brand}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`
            : (brand.includes('IPHONE') || brand.includes('APPLE') ? '<i class="fa-brands fa-apple text-dark"></i>' : '<i class="fa-solid fa-mobile-screen text-primary"></i>');

        let countLcd = 0;
        let countBat = 0;
        let countOther = 0;
        let totalModalBrand = 0;
        let totalJualBrand = 0;

        items.forEach(item => {
            const srv = String(item[3] || '').toUpperCase();
            if (srv.includes('LCD')) countLcd++;
            else if (srv.includes('BAT')) countBat++;
            else countOther++;

            const modalVal = Number(item[5]) || 0;
            const jualVal = Number(item[4]) || 0;
            totalModalBrand += modalVal;
            totalJualBrand += jualVal;
        });

        const totalProfitBrand = totalJualBrand - totalModalBrand;
        const collapseId = `collapseBrand_${groupIndex}`;

        html += `
        <div class="brand-group-box mb-4 shadow-sm">
            <div class="brand-group-header" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="true" aria-controls="${collapseId}">
                <div class="brand-group-title">
                    <div class="brand-group-logo shadow-sm">${iconHtml}</div>
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <h5 class="fw-extrabold text-dark m-0" style="letter-spacing: -0.3px;">${brand}</h5>
                            <span class="badge bg-primary text-white rounded-pill px-2 py-1" style="font-size: 0.7rem; font-weight: 700;">${items.length} Box Data</span>
                        </div>
                        <div class="d-flex flex-wrap align-items-center gap-2 mt-1" style="font-size: 0.75rem;">
                            ${countLcd > 0 ? `<span class="text-primary fw-bold"><i class="fa-solid fa-mobile-screen-button me-1"></i>${countLcd} LCD</span>` : ''}
                            ${countBat > 0 ? `<span class="text-warning fw-bold"><i class="fa-solid fa-battery-full me-1"></i>${countBat} BAT</span>` : ''}
                            ${countOther > 0 ? `<span class="text-secondary fw-bold"><i class="fa-solid fa-screwdriver-wrench me-1"></i>${countOther} Service/Part</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-3">
                    <div class="text-end d-none d-md-block">
                        <small class="text-muted d-block" style="font-size: 0.68rem; text-transform: uppercase;">Estimasi Untung</small>
                        <span class="fw-bold text-success" style="font-size: 0.88rem;">${formatRupiah(totalProfitBrand)}</span>
                    </div>
                    <i class="fa-solid fa-chevron-down text-muted fs-6 transition-transform"></i>
                </div>
            </div>
            
            <div class="collapse show" id="${collapseId}">
                <div class="p-3 bg-light-subtle">
                    <div class="row g-3">
        `;

        // Grouping items within this brand by Phone Model (Tipe HP)
        const modelGroups = {};
        items.forEach(row => {
            const tipeKey = String(row[2] || 'TIPE UMUM').trim();
            if (!modelGroups[tipeKey]) modelGroups[tipeKey] = [];
            modelGroups[tipeKey].push(row);
        });

        const sortedModelKeys = Object.keys(modelGroups).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        sortedModelKeys.forEach(tipeHP => {
            const modelItems = modelGroups[tipeHP];
            const safeTipe = encodeURIComponent(tipeHP);
            const safeBrand = encodeURIComponent(brand);

            let tipeTampil = tipeHP;
            if (tipeHP.includes(',') || tipeHP.includes('/')) {
                let daftarTipe = tipeHP.split(/[,\/]+/);
                tipeTampil = `<span class="fw-extrabold text-dark">${daftarTipe[0].trim()}</span> <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 ms-1 rounded-pill" style="font-size: 0.65rem;">+${daftarTipe.length - 1} Seri</span>`;
            } else {
                tipeTampil = `<span class="fw-extrabold text-dark">${tipeHP}</span>`;
            }

            html += `
            <div class="col-12 col-md-6 col-xl-4">
                <div class="model-card-box shadow-sm">
                    <!-- Header Box Tipe HP -->
                    <div class="model-card-header">
                        <div class="d-flex align-items-center gap-2 text-truncate pe-2">
                            <div class="model-icon-wrap shadow-2xs">
                                <i class="fa-solid fa-mobile-screen text-primary"></i>
                            </div>
                            <div class="text-truncate">
                                <h6 class="m-0 text-truncate" style="font-size: 0.92rem;" title="${tipeHP}">${tipeTampil}</h6>
                                <small class="text-muted" style="font-size: 0.7rem;"><span class="badge bg-light text-dark border px-1 py-0 me-1">${brand}</span>${modelItems.length} Layanan Service</small>
                            </div>
                        </div>
                        <button onclick="openTambahUntukTipe('${safeBrand}', '${safeTipe}')" class="btn btn-sm btn-light text-primary border rounded-pill px-2 py-1 fw-bold flex-shrink-0 shadow-2xs" style="font-size: 0.7rem;" title="Tambah Layanan Baru untuk ${tipeHP}">
                            <i class="fa-solid fa-plus me-1"></i> Tambah
                        </button>
                    </div>

                    <!-- Body Box: Daftar Layanan & Harga untuk Tipe HP Ini -->
                    <div class="model-card-body">
            `;

            modelItems.forEach(row => {
                const modalVal = Number(row[5]) || 0;
                const jualVal = Number(row[4]) || 0;
                const labaVal = jualVal - modalVal;

                const statusText = row[8] ? String(row[8]).trim() : 'Kosong';
                const badgeClass = statusText === 'Tersedia' ? 'status-ready' : (statusText === 'Preorder' ? 'status-preorder' : 'status-kosong');

                const serviceName = String(row[3] || 'SPAREPART').toUpperCase();
                let serviceBadgeClass = 'badge-service-sparepart';
                let serviceIcon = 'fa-solid fa-wrench';
                if (serviceName.includes('LCD')) {
                    serviceBadgeClass = 'badge-service-lcd';
                    serviceIcon = 'fa-solid fa-mobile-screen';
                } else if (serviceName.includes('BAT')) {
                    serviceBadgeClass = 'badge-service-bat';
                    serviceIcon = 'fa-solid fa-battery-full';
                } else if (serviceName.includes('SERVICE')) {
                    serviceBadgeClass = 'badge-service-service';
                    serviceIcon = 'fa-solid fa-screwdriver-wrench';
                }

                const ketVal = row[7] ? String(row[7]).trim() : '';
                const ketBadge = ketVal 
                    ? `<span class="badge bg-info-subtle text-info border border-info-subtle px-2 py-1 rounded-2 fw-bold" style="font-size: 0.68rem; letter-spacing: 0.5px;">${ketVal.toUpperCase()}</span>` 
                    : '';

                const garansiVal = row[6] ? String(row[6]).trim() : 'Garansi Test';

                html += `
                <div class="model-service-item shadow-2xs" onclick="openEditModal('${row[0]}')" style="cursor: pointer;">
                    <!-- Baris Atas: Service, Part, Status & Tombol Aksi -->
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <div class="d-flex align-items-center gap-1 flex-wrap">
                            <span class="badge ${serviceBadgeClass} px-2 py-1 rounded-2">
                                <i class="${serviceIcon} me-1"></i>${serviceName}
                            </span>
                            ${ketBadge}
                            <span class="status-badge ${badgeClass}" style="font-size: 0.65rem;">${statusText}</span>
                        </div>
                        <div class="d-flex gap-1" onclick="event.stopPropagation()">
                            <button onclick="openEditModal('${row[0]}')" class="btn btn-sm btn-light text-primary p-1 rounded-2 border shadow-2xs" title="Edit ${serviceName}">
                                <i class="fa-solid fa-pen" style="font-size: 0.72rem;"></i>
                            </button>
                            <button onclick="deleteRecord('${row[0]}')" class="btn btn-sm btn-light text-danger p-1 rounded-2 border shadow-2xs btn-delete" title="Hapus">
                                <i class="fa-solid fa-trash" style="font-size: 0.72rem;"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Baris Harga: Modal, Untung & Harga Jual -->
                    <div class="d-flex justify-content-between align-items-center p-2 rounded-2 mb-1" style="background: #f8fafc; border: 1px dashed #e2e8f0; font-size: 0.75rem;">
                        <div>
                            <span class="text-muted d-block" style="font-size: 0.65rem;">Modal (HPP)</span>
                            <span class="text-secondary fw-semibold">${formatRupiah(modalVal)}</span>
                        </div>
                        <div class="text-center">
                            <span class="text-success d-block fw-semibold" style="font-size: 0.65rem;">Estimasi Untung</span>
                            <span class="fw-bold text-success">+${formatRupiah(labaVal)}</span>
                        </div>
                        <div class="text-end">
                            <span class="text-muted d-block" style="font-size: 0.65rem;">Harga Jual</span>
                            <span class="fw-extrabold text-primary" style="font-size: 0.88rem;">${formatRupiah(jualVal)}</span>
                        </div>
                    </div>

                    <!-- Baris Bawah: Kode Barang & Garansi -->
                    <div class="d-flex justify-content-between align-items-center text-muted" style="font-size: 0.68rem;">
                        <span><i class="fa-solid fa-barcode text-muted me-1"></i>Kode: <strong class="text-dark">${row[0] || '-'}</strong></span>
                        <span><i class="fa-solid fa-shield-halved text-warning me-1"></i>${garansiVal}</span>
                    </div>
                </div>
                `;
            });

            html += `
                    </div>
                </div>
            </div>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
        </div>
        `;
    });

    container.innerHTML = html;
}

window.openTambahUntukTipe = function(brandEnc, tipeEnc) {
    const brand = decodeURIComponent(brandEnc);
    const tipe = decodeURIComponent(tipeEnc);
    const menuTambah = document.getElementById('menu-tambah');
    if (menuTambah) menuTambah.click();
    setTimeout(() => {
        const merkInput = document.getElementById('inputMerk');
        const typeInput = document.getElementById('inputType');
        if (merkInput) merkInput.value = brand;
        if (typeInput) typeInput.value = tipe;
    }, 150);
};

function applyFilters() {
    let searchVal = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toLowerCase().trim() : '';
    let serviceVal = document.getElementById('filterService') ? document.getElementById('filterService').value.toUpperCase() : '';
    
    filteredData = globalData.filter(row => {
        let matchSearch = searchVal === '' || row.join(' ').toLowerCase().includes(searchVal);
        let matchService = serviceVal === '' || String(row[3] || '').toUpperCase().includes(serviceVal);
        let matchBrand = activeSelectedBrand === 'SEMUA' || String(row[1] || '').toUpperCase().trim() === activeSelectedBrand;
        return matchSearch && matchService && matchBrand;
    });
    
    currentPage = 1;
    renderBrandFilterBoxes();
    if (currentDataViewMode === 'box') {
        renderGroupedBrandBoxes();
    } else {
        renderTable();
    }
}

const searchInputEl = document.getElementById('searchInput');
if (searchInputEl) {
    searchInputEl.addEventListener('keyup', function() {
        applyFilters();
    });
}

function renderTable() {
    const tbody = document.getElementById('tableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    const paginatedData = filteredData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
    
    paginatedData.forEach((row, index) => {
        let modalVal = Number(row[5]) || 0;
        let jualVal = Number(row[4]) || 0;
        let labaVal = jualVal - modalVal;

        let statusText = row[8] ? String(row[8]).trim() : 'Kosong';
        let badgeClass = statusText === 'Tersedia' ? 'status-ready' : (statusText === 'Preorder' ? 'status-preorder' : 'status-kosong');
        
        let tipeLengkap = row[2] ? row[2].toString() : '';
        let tipeTampil = tipeLengkap;
        if (tipeLengkap.includes(',') || tipeLengkap.includes('/')) {
            let daftarTipe = tipeLengkap.split(/[,\/]+/);
            tipeTampil = `<span class="fw-medium">${daftarTipe[0].trim()}</span> <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 ms-1 rounded-pill" style="font-size: 0.65rem;">+${daftarTipe.length - 1} Seri</span>`;
        }

        let ketVal = row[7] ? String(row[7]).trim() : '';
        let ketBadge = ketVal 
            ? `<span class="badge bg-info-subtle text-info border border-info-subtle px-2 py-1 rounded-2 fw-bold" style="font-size: 0.72rem; letter-spacing: 0.5px;">${ketVal.toUpperCase()}</span>` 
            : `<span class="text-muted small">-</span>`;

        let garansiVal = row[6] ? String(row[6]).trim() : '-';

        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        
        tr.onclick = function(e) {
            if (!e.target.closest('.btn-delete')) {
                openEditModal(row[0]);
            }
        };

        tr.innerHTML = `
          <td class="text-center text-muted fw-medium">${((currentPage - 1) * rowsPerPage) + index + 1}</td>
          <td class="fw-semibold text-dark">${row[1] || ''}</td>
          <td>${tipeTampil}</td>
          <td><span class="badge bg-light text-dark border px-2 py-1 fw-medium">${row[3] || ''}</span></td>
          <td class="text-muted small">${formatRupiah(modalVal)}</td>
          <td class="fw-semibold text-dark">${formatRupiah(jualVal)}</td>
          <td class="fw-semibold text-success">${formatRupiah(labaVal)}</td>
          <td>${ketBadge}</td>
          <td><span class="badge bg-light text-secondary border px-2 py-1 small">${garansiVal}</span></td>
          <td><span class="status-badge ${badgeClass}">${statusText}</span></td>
          <td class="text-center">
            <button onclick="event.stopPropagation(); openEditModal('${row[0]}')" class="btn btn-sm btn-light text-primary border-0 me-1 rounded-3 shadow-sm" title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button onclick="event.stopPropagation(); deleteRecord('${row[0]}')" class="btn btn-sm btn-light text-danger border-0 rounded-3 shadow-sm btn-delete" title="Hapus"><i class="fa-solid fa-trash"></i></button>
          </td>
        `;
        tbody.appendChild(tr);
    });
    renderPagination();
}

function renderPagination() {
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const ul = document.getElementById('paginationControls');
  if(!ul) return;
  ul.innerHTML = '';
  for(let i=1; i<=totalPages; i++) {
    ul.innerHTML += `<li class="page-item ${i === currentPage ? 'active' : ''}"><a class="page-link border-0 rounded-3 mx-1 ${i === currentPage ? 'shadow-sm fw-bold' : 'text-muted'}" href="#" onclick="changePage(${i})">${i}</a></li>`;
  }
}
window.changePage = function(page) { currentPage = page; renderTable(); }

// ==========================================
// CHARTS & ACTIVITY
// ==========================================
function renderRecentActivity(data) {
    const tbody = document.getElementById('recentActivityBody');
    if (!tbody) return;

    const sortedData = [...data].sort((a, b) => {
        const timeA = parseIndonesianDate(a[9]);
        const timeB = parseIndonesianDate(b[9]);
        return timeB - timeA;
    });

    const recentData = sortedData.slice(0, 5);
    if (recentData.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Belum ada aktivitas data.</td></tr>`; return; }

    tbody.innerHTML = recentData.map(row => {
        let statusText = row[8] ? String(row[8]).trim() : 'Kosong';
        let badgeClass = statusText === 'Tersedia' ? 'status-ready' : (statusText === 'Preorder' ? 'status-preorder' : 'status-kosong');
        return `<tr>
            <td class="fw-bold text-primary" style="font-size: 0.85rem;"><i class="fa-solid fa-hashtag text-muted me-1" style="font-size: 0.75rem;"></i>${row[0]}</td>
            <td><span class="badge bg-light text-dark border px-2 py-1 fw-medium">${row[3] || ''}</span></td>
            <td><strong class="text-dark">${row[1] || ''}</strong> <span class="text-muted">- ${String(row[2] || '').split(/[,\/]+/)[0]}...</span></td>
            <td class="fw-semibold text-dark">${formatRupiah(row[4])}</td>
            <td><span class="status-badge ${badgeClass}" style="padding: 4px 10px; font-size: 0.75rem;">${statusText}</span></td>
        </tr>`;
    }).join('');
}

function renderChart(data) {
    let ready = 0, preorder = 0, kosong = 0;
    data.forEach(row => {
        let s = String(row[8] || '').trim();
        if (s === 'Tersedia') ready++; 
        else if (s === 'Preorder') preorder++; 
        else if (s === 'Kosong') kosong++;
    });
    
    if (myChart) myChart.destroy();
    const ctx = document.getElementById('statusChart').getContext('2d');
    Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
    
    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: { 
            labels: ['Tersedia', 'Preorder', 'Kosong'], 
            datasets: [{ data: [ready, preorder, kosong], backgroundColor: ['#10b981', '#f59e0b', '#ef4444'], borderWidth: 0, hoverOffset: 4 }] 
        },
        options: { cutout: '75%', responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true, pointStyle: 'circle', font: { size: 12, weight: '500' } } } } }
    });
}

function renderTopSearchesChart(data) {
    if (searchChart) searchChart.destroy();
    const ctx = document.getElementById('searchChart').getContext('2d');
    searchChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: data.map(i => i[0]), datasets: [{ data: data.map(i => i[1]), backgroundColor: '#4361ee', borderRadius: 8, barPercentage: 0.6 }] },
        options: { 
            indexAxis: 'y', responsive: true, maintainAspectRatio: false, 
            plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', padding: 12, cornerRadius: 8 } },
            scales: { x: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { display: false } }, y: { grid: { display: false }, ticks: { font: { weight: '500' } } } }
        }
    });
}

function formatRupiah(angka) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(String(angka).replace(/[^0-9]/g, '') || 0); }

// ==========================================
// BUKA MODAL NOTA DIGITAL SISI ADMIN
// ==========================================
async function bukaNotaDigitalAdmin(orderId) {
    try {
        const { data: order, error } = await dbClient
            .from('orders')
            .select('*')
            .eq('order_id', orderId)
            .single();

        if (error || !order) {
            Swal.fire('Error', 'Gagal memuat detail nota pesanan.', 'error');
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
                let serviceUp = String(item.service || item.title || '').toUpperCase();
                let garansiDefault = serviceUp.includes('BAT') ? '1 Bulan' : serviceUp.includes('LCD') ? '1 Minggu' : '';
                let garansiItem = (item.garansi && item.garansi !== '-') ? item.garansi : garansiDefault;
                let garansiBadge = garansiItem
                    ? `<br><span style="font-size:0.68rem; color:#555;"><i class="fa-solid fa-shield-halved" style="color:#f59e0b;"></i> Garansi: ${garansiItem}</span>`
                    : '';
                itemsHtml += `
                <tr style="border-bottom: 1px dashed #dee2e6;">
                    <td style="padding: 6px 0; font-size: 0.8rem;">${idx + 1}. ${item.title}${garansiBadge}</td>
                    <td style="padding: 6px 0; font-size: 0.8rem; text-align: center;">${item.qty}</td>
                    <td style="padding: 6px 0; font-size: 0.8rem; text-align: right;">${formatRupiahAdmin(subtotal)}</td>
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
                <span class="text-primary">${formatRupiahAdmin(order.total_price)}</span>
            </div>
            
            <div class="d-flex justify-content-between align-items-center small text-muted mt-2">
                <span style="font-size: 0.8rem; font-weight: 600;">Status:</span>
                <span class="badge ${statusBadgeClass} shadow-sm" style="padding: 5px 12px; font-size: 0.72rem; font-weight: 800; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; line-height: 1;">
                    ${statusUpper}
                </span>
            </div>

            <div class="text-center mt-4 pt-2 border-top">
                <small class="text-muted d-block" style="font-size: 0.7rem;">Terima Kasih atas Kepercayaan Anda!</small>
                <small class="text-muted d-block" style="font-size: 0.65rem;">Garansi berlaku sesuai ketentuan syarat nota.</small>
            </div>`;

        const btnCanvasWA = document.getElementById('btnShareNotaCanvasWA');
        if (btnCanvasWA) {
            btnCanvasWA.onclick = () => kirimNotaCanvasKeWAAdmin(order);
        }

        const modalNota = new bootstrap.Modal(document.getElementById('modalNotaDigital'));
        modalNota.show();

    } catch (e) {
        console.error("Error modal nota admin:", e);
    }
}

// ==========================================
// KONVERSI CANVAS & KIRIM KE WA PELANGGAN
// ==========================================
async function kirimNotaCanvasKeWAAdmin(order) {
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
                Swal.fire('Gagal', 'Gagal memproses gambar nota.', 'error');
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

            let textChat = `Halo Kak ${order.customer_name}, berikut adalah Nota Digital resmi perbaikan/pesanan #${order.order_id} di MUSTAKIM PHONE.`;

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: `Nota ${order.order_id}`,
                        text: textChat
                    });
                } catch (err) {
                    console.log('User cancel share:', err);
                }
            } 
            else {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = fileName;
                link.click();
                URL.revokeObjectURL(link.href);

                let urlWA = noHpPelanggan 
                    ? `https://wa.me/${noHpPelanggan}?text=${encodeURIComponent(textChat)}`
                    : `https://api.whatsapp.com/send?text=${encodeURIComponent(textChat)}`;

                window.open(urlWA, '_blank');
            }

            if (btnCanvasWA) {
                btnCanvasWA.disabled = false;
                btnCanvasWA.innerHTML = originalBtnText;
            }
        }, 'image/png');

    } catch (error) {
        console.error('Error Canvas Admin:', error);
        if (btnCanvasWA) {
            btnCanvasWA.disabled = false;
            btnCanvasWA.innerHTML = originalBtnText;
        }
    }
}

// ==========================================
// LOGOUT
// ==========================================
document.addEventListener('click', function(e) {
    const logoutBtn = e.target.closest('#menu-logout');
    if (logoutBtn) {
        e.preventDefault(); 
        Swal.fire({
            title: 'Yakin ingin keluar?', text: "Sesi Anda akan diakhiri.", icon: 'question',
            showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#f1f5f9',
            confirmButtonText: 'Ya, Logout', cancelButtonText: '<span class="text-dark">Batal</span>'
        }).then((result) => {
            if (result.isConfirmed) {
                sessionStorage.clear(); localStorage.clear();
                window.location.href = "./";
            }
        });
    }
});