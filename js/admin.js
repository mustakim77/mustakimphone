/**
 * PROYEK: MUSTAKIM PHONE - Admin Logic (Supabase Version)
 * FULL VERSION (COMPREHENSIVE) + LOGOUT FUNCTION + DASHBOARD SHORTCUTS
 * UI/UX Premium Enhanced (Using dbClient)
 */

// ==========================================
// KONEKSI SUPABASE
// ==========================================
const SUPABASE_URL = 'https://btlxqbebbwtddcpzpaet.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__dVwgg315z2OT5UkioK9zw_gRdhxPP5';

const dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// STATE MANAGEMENT
// ==========================================
let currentPage = 1;
const rowsPerPage = 10;
let globalData = [];
let filteredData = [];
let searchTimer; 
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
    if(filterService) {
        filterService.addEventListener('change', applyFilters);
    }

    loadData();
});

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
        'menu-data': 'section-table',
        'menu-tambah': 'section-form'
    };

    document.querySelectorAll('#sidebar-wrapper .list-group-item').forEach(item => {
        if(item.id === 'menu-logout') return; 

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
                
                if (window.innerWidth <= 768) document.getElementById('wrapper').classList.remove('toggled');
            }
        });
    });
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
    // Ambil SEMUA data tanpa .limit(5) agar tabel utama tidak terpotong
    const { data, error } = await dbClient
        .from('data_service')
        .select('*');

    if (error) throw error;

    globalData = (data || []).map(item => [
        item.id,
        item.merk_hp,
        item.type_hp,
        item.jenis_service,
        item.harga,
        item.garansi,
        item.keterangan,
        item.status,
        item.update,
        item.timestamp_asli // Simpan juga timestamp jika diperlukan untuk sorting
    ]);
    
    // Jika ingin tabel utama terurut rapi secara abjad (Merk & Type), biarkan sort di sini:
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
    renderTable();
    
    // Untuk "5 Data Terakhir Ditambahkan", buat fungsi terpisah yang mengambil data tersendiri berdasarkan waktu/id terbaru
    renderRecentActivity(globalData);
    renderChart(globalData);
    
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
    merkSet.add(row[1]); typeSet.add(row[2]);
    const service = String(row[3]).toUpperCase();
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

// --- MODAL MERK ---
function showMerkModal() {
    const merkCounts = {}; 
    globalData.forEach(row => {
        let m = String(row[1]).toUpperCase().trim();
        if(m) { merkCounts[m] = (merkCounts[m] || 0) + 1; }
    });

    const container = document.getElementById('containerGridMerk');
    if (!container) return;
    container.innerHTML = '';

    const divSemua = document.createElement('div');
    divSemua.className = 'col-6 col-md-3';
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
        const div = document.createElement('div');
        div.className = 'col-6 col-md-3';
        div.innerHTML = `
            <div class="brand-box" onclick="filterBySpecificMerk('${merk}')">
                <div class="brand-card-img-wrap"><i class="fa-solid fa-mobile-screen-button text-dark fs-4"></i></div>
                <h5>${merk}</h5>
                <div class="brand-badge">${count} Tipe</div>
            </div>
        `;
        container.appendChild(div);
    });

    new bootstrap.Modal(document.getElementById('modalPilihMerk')).show();
}

window.filterBySpecificMerk = function(merkName) {
    const modalEl = document.getElementById('modalPilihMerk');
    if (modalEl) {
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();
    }

    document.getElementById('searchInput').value = '';
    document.getElementById('filterService').value = '';

    if (merkName === 'SEMUA') {
        filteredData = [...globalData];
    } else {
        filteredData = globalData.filter(row => String(row[1]).toUpperCase().trim() === merkName);
    }

    currentPage = 1;
    renderTable();
    document.getElementById('menu-data').click();
}

// --- MODAL TYPE ---
function showTypeModal() {
    const typeCounts = {};
    globalData.forEach(row => {
        let t = String(row[2]).toUpperCase().trim();
        if(t) { typeCounts[t] = (typeCounts[t] || 0) + 1; }
    });

    const container = document.getElementById('containerGridType');
    if (!container) return;
    container.innerHTML = '';

    const divSemua = document.createElement('div');
    divSemua.className = 'col-6 col-md-3';
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
        const div = document.createElement('div');
        div.className = 'col-6 col-md-3';
        div.innerHTML = `
            <div class="brand-box" onclick="filterBySpecificType('${type}')">
                <div class="brand-card-img-wrap"><i class="fa-solid fa-mobile-screen text-dark fs-4"></i></div>
                <h5>${type}</h5>
                <div class="brand-badge">${count} Item</div>
            </div>
        `;
        container.appendChild(div);
    });

    new bootstrap.Modal(document.getElementById('modalPilihType')).show();
}

window.filterBySpecificType = function(typeName) {
    bootstrap.Modal.getInstance(document.getElementById('modalPilihType')).hide();
    document.getElementById('searchInput').value = '';
    document.getElementById('filterService').value = '';

    if (typeName === 'SEMUA') {
        filteredData = [...globalData];
    } else {
        filteredData = globalData.filter(row => String(row[2]).toUpperCase().trim() === typeName);
    }
    currentPage = 1;
    renderTable();
    document.getElementById('menu-data').click();
}

// --- MODAL LCD ---
function showLcdModal() {
    const lcdData = globalData.filter(row => String(row[3]).toUpperCase().includes('LCD'));
    const merkCounts = {};
    lcdData.forEach(row => {
        let m = String(row[1]).toUpperCase().trim();
        if(m) { merkCounts[m] = (merkCounts[m] || 0) + 1; }
    });

    const container = document.getElementById('containerGridLcd');
    if (!container) return;
    container.innerHTML = '';

    const divSemua = document.createElement('div');
    divSemua.className = 'col-6 col-md-3';
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
        const div = document.createElement('div');
        div.className = 'col-6 col-md-3';
        div.innerHTML = `
            <div class="brand-box" onclick="filterBySpecificLcdMerk('${merk}')">
                <div class="brand-card-img-wrap"><i class="fa-solid fa-mobile-screen-button text-success fs-4"></i></div>
                <h5>${merk}</h5>
                <div class="brand-badge">${count} LCD</div>
            </div>
        `;
        container.appendChild(div);
    });

    new bootstrap.Modal(document.getElementById('modalPilihLcd')).show();
}

window.filterBySpecificLcdMerk = function(merkName) {
    bootstrap.Modal.getInstance(document.getElementById('modalPilihLcd')).hide();
    document.getElementById('searchInput').value = '';
    document.getElementById('filterService').value = 'GANTI LCD';

    if (merkName === 'SEMUA') {
        filteredData = globalData.filter(row => String(row[3]).toUpperCase().includes('LCD'));
    } else {
        filteredData = globalData.filter(row => String(row[3]).toUpperCase().includes('LCD') && String(row[1]).toUpperCase().trim() === merkName);
    }
    currentPage = 1;
    renderTable();
    document.getElementById('menu-data').click();
}

// --- MODAL BATTERY ---
function showBatModal() {
    const batData = globalData.filter(row => String(row[3]).toUpperCase().includes('BAT'));
    const merkCounts = {};
    batData.forEach(row => {
        let m = String(row[1]).toUpperCase().trim();
        if(m) { merkCounts[m] = (merkCounts[m] || 0) + 1; }
    });

    const container = document.getElementById('containerGridBat');
    if (!container) return;
    container.innerHTML = '';

    const divSemua = document.createElement('div');
    divSemua.className = 'col-6 col-md-3';
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
        const div = document.createElement('div');
        div.className = 'col-6 col-md-3';
        div.innerHTML = `
            <div class="brand-box" onclick="filterBySpecificBatMerk('${merk}')">
                <div class="brand-card-img-wrap"><i class="fa-solid fa-battery-full text-warning fs-4"></i></div>
                <h5>${merk}</h5>
                <div class="brand-badge">${count} Bat</div>
            </div>
        `;
        container.appendChild(div);
    });

    new bootstrap.Modal(document.getElementById('modalPilihBat')).show();
}

window.filterBySpecificBatMerk = function(merkName) {
    bootstrap.Modal.getInstance(document.getElementById('modalPilihBat')).hide();
    document.getElementById('searchInput').value = '';
    document.getElementById('filterService').value = 'GANTI BAT';

    if (merkName === 'SEMUA') {
        filteredData = globalData.filter(row => String(row[3]).toUpperCase().includes('BAT'));
    } else {
        filteredData = globalData.filter(row => String(row[3]).toUpperCase().includes('BAT') && String(row[1]).toUpperCase().trim() === merkName);
    }
    currentPage = 1;
    renderTable();
    document.getElementById('menu-data').click();
}

// ==========================================
// CRUD LOGIC
// ==========================================
document.getElementById('formTambahData').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  let merkSelect = document.getElementById('inputMerkHP').value;      
  let merk = (merkSelect === 'LAINNYA') ? document.getElementById('inputMerkLainnya').value.trim() : merkSelect;
  let type = document.getElementById('inputTypeHP').value;      
  let service = document.getElementById('inputJenisService').value; 
  
  let baseMerkType = `${merk.toUpperCase()}${type.split(/[,\/]+/)[0].trim().toUpperCase().replace(/\s+/g, '')}`;
  let baseService = service.toUpperCase().replace('GANTI ', '').trim();
  let uniqueCode = Math.floor(1000 + Math.random() * 9000); 
  let id = `${baseMerkType}-${baseService}-${uniqueCode}`;

  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  let waktuUpdate = new Date().toLocaleDateString('id-ID', options).replace(' pukul', ',');

  const payload = {
    id: id, 
    merk_hp: merk.toUpperCase(), 
    type_hp: type.toUpperCase(), 
    jenis_service: service,
    harga: parseInt(document.getElementById('inputHarga').value) || 0,
    garansi: document.getElementById('inputGaransi').value,
    status: document.getElementById('inputStatus').value,
    keterangan: document.getElementById('inputKeterangan').value || '-',
    update: waktuUpdate
  };
  
  Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
  
  try {
      const { error } = await dbClient.from('data_service').insert([payload]);
      if (error) throw error;

      Swal.fire({ title: 'Berhasil!', text: 'Data baru berhasil disimpan.', icon: 'success' });
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
  document.getElementById('editHarga').value = String(row[4]).replace(/[^0-9]/g, '');
  document.getElementById('editGaransi').value = row[5];
  
  let statusData = String(row[7]).toLowerCase().trim();
  let selectStatus = document.getElementById('editStatus');
  for (let i = 0; i < selectStatus.options.length; i++) {
    if (selectStatus.options[i].value.toLowerCase() === statusData) { selectStatus.selectedIndex = i; break; }
  }
  document.getElementById('editKeterangan').value = row[6] || "";
  new bootstrap.Modal(document.getElementById('modalEdit')).show();
};

document.getElementById('btnUpdateData').addEventListener('click', async function() {
  let editMerkSelect = document.getElementById('editMerkHP').value;
  let editMerkFinal = (editMerkSelect === 'LAINNYA') ? document.getElementById('editMerkLainnya').value.trim() : editMerkSelect;
  let recordId = document.getElementById('editDataId').value;

  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  let waktuUpdate = new Date().toLocaleDateString('id-ID', options).replace(' pukul', ',');

  const payload = {
    merk_hp: editMerkFinal.toUpperCase(), 
    type_hp: document.getElementById('editTypeHP').value.toUpperCase(), 
    jenis_service: document.getElementById('editJenisService').value,
    harga: parseInt(document.getElementById('editHarga').value) || 0, 
    garansi: document.getElementById('editGaransi').value,
    status: document.getElementById('editStatus').value, 
    keterangan: document.getElementById('editKeterangan').value || '-',
    update: waktuUpdate
  };

  try {
      const { error } = await dbClient.from('data_service').update(payload).eq('id', recordId);
      if (error) throw error;

      Swal.fire({ title: 'Berhasil!', text: 'Data telah diperbarui.', icon: 'success' });
      bootstrap.Modal.getInstance(document.getElementById('modalEdit')).hide();
      loadData();
  } catch (err) {
      Swal.fire({ title: 'Gagal Update', text: err.message, icon: 'error' });
  }
});

window.deleteRecord = function(id) {
  Swal.fire({ 
      title: 'Yakin ingin menghapus?', text: "Data yang dihapus tidak dapat dikembalikan!", icon: 'warning', 
      showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#f1f5f9',
      confirmButtonText: 'Ya, Hapus', cancelButtonText: '<span class="text-dark">Batal</span>'
  }).then(async (result) => {
    if (result.isConfirmed) { 
        try {
            const { error } = await dbClient.from('data_service').delete().eq('id', id);
            if (error) throw error;
            Swal.fire({ title: 'Terhapus!', text: 'Data berhasil dihapus.', icon: 'success', timer: 1500, showConfirmButton: false });
            loadData();
        } catch(err) {
            Swal.fire({ title: 'Gagal', text: err.message, icon: 'error' });
        }
    }
  });
}

// ==========================================
// TABLE & SEARCH
// ==========================================
function applyFilters() {
    let searchVal = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toLowerCase() : '';
    let serviceVal = document.getElementById('filterService') ? document.getElementById('filterService').value.toUpperCase() : '';
    
    filteredData = globalData.filter(row => {
        let matchSearch = row.join(' ').toLowerCase().includes(searchVal);
        let matchService = serviceVal === '' || String(row[3]).toUpperCase().includes(serviceVal);
        return matchSearch && matchService;
    });
    
    currentPage = 1;
    renderTable();
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
        let statusText = row[7] ? row[7].trim() : 'Kosong';
        let badgeClass = statusText === 'Tersedia' ? 'status-ready' : (statusText === 'Preorder' ? 'status-preorder' : 'status-kosong');
        
        let tipeLengkap = row[2] ? row[2].toString() : '';
        let tipeTampil = tipeLengkap;
        if (tipeLengkap.includes(',') || tipeLengkap.includes('/')) {
            let daftarTipe = tipeLengkap.split(/[,\/]+/);
            tipeTampil = `<span class="fw-medium">${daftarTipe[0].trim()}</span> <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 ms-1 rounded-pill" style="font-size: 0.65rem;">+${daftarTipe.length - 1} Seri</span>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="text-center text-muted fw-medium">${((currentPage - 1) * rowsPerPage) + index + 1}</td>
          <td class="fw-semibold text-dark">${row[1]}</td>
          <td>${tipeTampil}</td>
          <td><span class="badge bg-light text-dark border px-2 py-1 fw-medium">${row[3]}</span></td>
          <td class="fw-semibold text-dark">${formatRupiah(row[4])}</td>
          <td class="text-muted small">${row[5]}</td>
          <td><span class="status-badge ${badgeClass}">${statusText}</span></td>
          <td class="text-center">
            <button onclick="openEditModal('${row[0]}')" class="btn btn-sm btn-light text-primary border-0 me-1 rounded-3 shadow-sm" title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button onclick="deleteRecord('${row[0]}')" class="btn btn-sm btn-light text-danger border-0 rounded-3 shadow-sm" title="Hapus"><i class="fa-solid fa-trash"></i></button>
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
    const recentData = [...data].reverse().slice(0, 5);
    if (recentData.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Belum ada aktivitas data.</td></tr>`; return; }

    tbody.innerHTML = recentData.map(row => {
        let statusText = row[7] ? row[7].trim() : 'Kosong';
        let badgeClass = statusText === 'Tersedia' ? 'status-ready' : (statusText === 'Preorder' ? 'status-preorder' : 'status-kosong');
        return `<tr>
            <td class="fw-bold text-primary" style="font-size: 0.85rem;"><i class="fa-solid fa-hashtag text-muted me-1" style="font-size: 0.75rem;"></i>${row[0]}</td>
            <td><span class="badge bg-light text-dark border px-2 py-1 fw-medium">${row[3]}</span></td>
            <td><strong class="text-dark">${row[1]}</strong> <span class="text-muted">- ${row[2].split(/[,\/]+/)[0]}...</span></td>
            <td class="fw-semibold text-dark">${formatRupiah(row[4])}</td>
            <td><span class="status-badge ${badgeClass}" style="padding: 4px 10px; font-size: 0.75rem;">${statusText}</span></td>
        </tr>`;
    }).join('');
}

function renderChart(data) {
    let ready = 0, preorder = 0, kosong = 0;
    data.forEach(row => {
        let s = String(row[7]).trim();
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
// LOGOUT
// ==========================================
document.addEventListener('click', function(e) {
    const logoutBtn = e.target.closest('#menu-logout');
    if (logoutBtn) {
        e.preventDefault(); 
        Swal.fire({
            title: 'Yakin ingin keluar?', text: "Sesi Admin Anda akan diakhiri.", icon: 'question',
            showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#f1f5f9',
            confirmButtonText: 'Ya, Logout', cancelButtonText: '<span class="text-dark">Batal</span>'
        }).then((result) => {
            if (result.isConfirmed) {
                sessionStorage.clear(); localStorage.clear();
                window.location.href = "index.html";
            }
        });
    }
});