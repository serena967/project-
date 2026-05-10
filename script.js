/* =====================================================
   script.js — Posyandu Remaja Digital
   Logika aplikasi: CRUD, IMT, Import, Export, LocalStorage
====================================================== */

/* -------------------------------------------------------
   BAGIAN 1: INISIALISASI & STATE GLOBAL (SEQUENCE)
   Dijalankan pertama kali saat halaman dimuat
------------------------------------------------------- */

// Ambil data dari LocalStorage; jika belum ada, mulai dengan array kosong
let data    = JSON.parse(localStorage.getItem('posyandu')) || [];
let editId  = null;   // ID data yang sedang diedit (null = mode tambah)
let delId   = null;   // ID data yang akan dihapus
let pending = [];     // Data import sementara sebelum dikonfirmasi

// Filter: hanya kelas ini yang ditampilkan di tabel
const FILTER = ['5 SD', '6 SD'];

/* -------------------------------------------------------
   BAGIAN 2: FUNGSI UTILITAS
------------------------------------------------------- */

// Shortcut getElementById
const $ = id => document.getElementById(id);

// SEQUENCE: Hitung IMT — Berat(kg) / Tinggi(m)^2
const calcIMT = (bb, tb) => parseFloat((bb / ((tb / 100) ** 2)).toFixed(2));

// IF/ELSE berantai: Tentukan status gizi dari nilai IMT (standar WHO/Kemenkes RI)
const calcStatus = v =>
  v < 17.5 ? 'Kurus'   :
  v < 25.0 ? 'Normal'  :
  v < 27.0 ? 'Gemuk'   : 'Obesitas';

// Mapping status gizi → class Tailwind badge warna
const badgeClass = s => ({
  Kurus:    'bg-yellow-100 text-yellow-800',
  Normal:   'bg-green-100 text-green-800',
  Gemuk:    'bg-orange-100 text-orange-800',
  Obesitas: 'bg-red-100 text-red-800'
})[s] || '';

// Simpan array data ke LocalStorage (persistensi data)
const save = () => localStorage.setItem('posyandu', JSON.stringify(data));

// Format tanggal ke format Indonesia (dd Mon yyyy)
const fmt = d => d
  ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  : '–';

/* -------------------------------------------------------
   BAGIAN 3: TOAST NOTIFIKASI (Respon Interaktif)
   Memberikan feedback visual kepada pengguna setelah aksi
------------------------------------------------------- */
function toast(icon, msg, ok = true) {
  $('toast-inner').innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  $('toast-inner').className =
    `flex items-center gap-3 bg-white border ` +
    `${ok ? 'border-green-200' : 'border-red-200'} ` +
    `rounded-2xl px-5 py-3 shadow-xl text-sm font-semibold text-gray-800 min-w-[260px]`;
  $('toast').classList.add('on');
  clearTimeout($('toast')._t);
  // Notifikasi otomatis hilang setelah 3.2 detik (setTimeout)
  $('toast')._t = setTimeout(() => $('toast').classList.remove('on'), 3200);
}

/* -------------------------------------------------------
   BAGIAN 4: RENDER TABEL (DOM Manipulation + LOOPING)
   SEQUENCE: Filter → Loop → Buat DOM → Append → Update stat
------------------------------------------------------- */
function render() {
  // FILTER: Hanya tampilkan data kelas yang ada di FILTER
  const rows = data.filter(s => FILTER.includes(s.kelas));
  const tb = $('tbody');
  tb.innerHTML = ''; // Kosongkan tabel sebelum render ulang

  // Penghitung statistik per kategori
  let k = 0, n = 0, g = 0, o = 0;

  // IF/ELSE: Tampilkan empty state jika tidak ada data terfilter
  if (!rows.length) {
    $('empty').classList.remove('hidden');
    $('fstat').classList.add('hidden');
  } else {
    $('empty').classList.add('hidden');
    $('fstat').classList.remove('hidden');

    // LOOPING (forEach): Render setiap siswa menjadi satu baris <tr>
    rows.forEach((s, i) => {
      // IF/ELSE: Akumulasi statistik per kategori gizi
      if (s.status === 'Kurus')    k++;
      if (s.status === 'Normal')   n++;
      if (s.status === 'Gemuk')    g++;
      if (s.status === 'Obesitas') o++;

      const tr = document.createElement('tr');
      tr.className = 'row-in border-b border-gray-50 transition-colors';
      tr.innerHTML = `
        <td class="px-3 py-2.5 text-gray-400">${i + 1}</td>
        <td class="px-3 py-2.5 font-semibold text-gray-800">${s.nama}</td>
        <td class="px-3 py-2.5">
          <span class="bg-teal-100 text-teal-800 text-xs font-bold px-2 py-0.5 rounded-full">${s.kelas}</span>
        </td>
        <td class="px-3 py-2.5 text-gray-600">${s.bb}</td>
        <td class="px-3 py-2.5 text-gray-600">${s.tb}</td>
        <td class="px-3 py-2.5 font-mono font-bold text-teal-700">${s.imt}</td>
        <td class="px-3 py-2.5 text-gray-500">${s.td || '–'}</td>
        <td class="px-3 py-2.5 text-gray-400 whitespace-nowrap">${fmt(s.tgl)}</td>
        <td class="px-3 py-2.5">
          <span class="badge ${badgeClass(s.status)}">${s.status}</span>
        </td>
        <td class="px-3 py-2.5">
          <div class="flex gap-1.5 justify-center">
            <button onclick="editData(${s.id})"
              class="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700
                     text-xs font-bold px-2.5 py-1 rounded-lg transition">Edit</button>
            <button onclick="openModal(${s.id})"
              class="bg-red-50 hover:bg-red-100 border border-red-200 text-red-600
                     text-xs font-bold px-2.5 py-1 rounded-lg transition">Hapus</button>
          </div>
        </td>`;
      tb.appendChild(tr);
    });

    // Update statistik footer tabel
    $('s-tot').textContent = rows.length;
    $('s-k').textContent   = k;
    $('s-n').textContent   = n;
    $('s-g').textContent   = g;
    $('s-o').textContent   = o;
  }

  // Update counter header & kartu export
  $('cnt').textContent    = rows.length;
  $('es-tot').textContent = rows.length;
  $('es-n').textContent   = n;
  $('es-k').textContent   = k;
  $('es-a').textContent   = g + o;
}

/* -------------------------------------------------------
   BAGIAN 5: VALIDASI & SUBMIT FORM
   SEQUENCE: Ambil input → Validasi (IF/ELSE) → Hitung →
             Simpan/Update → LocalStorage → Render → Reset
------------------------------------------------------- */
function submitForm() {
  const nama  = $('f-nama').value.trim();
  const kelas = $('f-kelas').value;
  const bb    = parseFloat($('f-bb').value);
  const tb    = parseFloat($('f-tb').value);
  const td    = $('f-td').value.trim();

  // IF/ELSE VALIDASI: Cek field wajib kosong
  if (!nama || !kelas || isNaN(bb) || isNaN(tb))
    return showErr('Semua field wajib (Nama, Kelas, BB, TB) harus diisi!');

  // IF/ELSE VALIDASI: Cek range berat badan
  if (bb < 10 || bb > 200)
    return showErr('Berat badan harus antara 10–200 kg.');

  // IF/ELSE VALIDASI: Cek range tinggi badan
  if (tb < 50 || tb > 250)
    return showErr('Tinggi badan harus antara 50–250 cm.');

  hideErr();
  const imt    = calcIMT(bb, tb);
  const status = calcStatus(imt);

  // IF: Mode edit → update data yang ada
  // ELSE: Mode tambah → push objek baru ke array
  if (editId) {
    const idx = data.findIndex(x => x.id === editId);
    if (idx > -1) data[idx] = { ...data[idx], nama, kelas, bb, tb, td, imt, status };
  } else {
    // Tambah data baru — DOM akan diperbarui oleh render()
    data.push({
      id: Date.now(),
      nama, kelas, bb, tb, td, imt, status,
      tgl: new Date().toISOString()
    });
  }

  save();
  render();
  resetForm();
  toast('✅', `Data <b>${nama}</b> berhasil disimpan!`);
}

/* -------------------------------------------------------
   BAGIAN 6: EDIT DATA
------------------------------------------------------- */
function editData(id) {
  const s = data.find(x => x.id === id);
  if (!s) return; // IF: data tidak ditemukan → berhenti

  // Isi form dengan data yang dipilih (DOM Manipulation)
  $('f-nama').value  = s.nama;
  $('f-kelas').value = s.kelas;
  $('f-bb').value    = s.bb;
  $('f-tb').value    = s.tb;
  $('f-td').value    = s.td || '';

  $('form-title').textContent = '✏ Edit Data Remaja';
  $('btn-txt').textContent    = 'Simpan Perubahan';
  $('btn-batal').classList.remove('hidden');

  editId = id;
  $('f-nama').scrollIntoView({ behavior: 'smooth' });
  $('f-nama').focus();
}

/* -------------------------------------------------------
   BAGIAN 7: RESET FORM
------------------------------------------------------- */
function resetForm() {
  // LOOPING: Kosongkan semua field form sekaligus
  ['f-nama', 'f-kelas', 'f-bb', 'f-tb', 'f-td'].forEach(id => $(id).value = '');

  $('form-title').textContent = '＋ Tambah Data Remaja';
  $('btn-txt').textContent    = '＋ Tambah Data';
  $('btn-batal').classList.add('hidden');

  editId = null;
  hideErr();
}

/* -------------------------------------------------------
   BAGIAN 8: HAPUS DATA + MODAL KONFIRMASI
------------------------------------------------------- */
function openModal(id) {
  delId = id;
  $('m-nama').textContent = data.find(x => x.id === id)?.nama || '';
  $('modal').classList.add('on');
}

function closeModal() {
  $('modal').classList.remove('on');
  delId = null;
}

function doDelete() {
  const nama = data.find(x => x.id === delId)?.nama || '';
  // FILTER: Hapus item dengan id yang cocok dari array
  data = data.filter(x => x.id !== delId);
  save();
  render();
  closeModal();
  toast('🗑️', `Data <b>${nama}</b> telah dihapus.`, false);
}

// Tutup modal jika pengguna klik di luar area modal
document.addEventListener('DOMContentLoaded', () => {
  $('modal').addEventListener('click', e => {
    if (e.target === $('modal')) closeModal();
  });
});

/* -------------------------------------------------------
   BAGIAN 9: UTILITAS ERROR FORM
------------------------------------------------------- */
function showErr(msg) {
  $('err-txt').textContent = msg;
  $('err').classList.remove('hidden');
}

function hideErr() {
  $('err').classList.add('hidden');
}

/* -------------------------------------------------------
   BAGIAN 10: PROGRESS BAR IMPORT
------------------------------------------------------- */
function setProgress(pct, lbl) {
  $('prog-fill').style.width = pct + '%';
  $('prog-pct').textContent  = pct + '%';
  if (lbl) $('prog-lbl').textContent = lbl;
}

/* -------------------------------------------------------
   BAGIAN 11: IMPORT EXCEL (SheetJS + FileReader API)
   SEQUENCE: Validasi ekstensi → Baca FileReader →
             Parse SheetJS → Validasi kolom wajib →
             Loop baris → Konfirmasi → Gabung data[]
------------------------------------------------------- */
function evDrag(e, on) {
  e.preventDefault();
  $('drop').classList.toggle('over', !!on);
}

function evDrop(e) {
  e.preventDefault();
  $('drop').classList.remove('over');
  const f = e.dataTransfer.files[0];
  if (f) parseExcel(f);
}

function importFile(e) {
  parseExcel(e.target.files[0]);
  e.target.value = ''; // Reset agar file yang sama bisa dipilih lagi
}

function parseExcel(file) {
  // IF: Format file tidak valid → tampilkan toast error
  if (!/\.(xlsx|xls)$/i.test(file.name))
    return toast('❌', 'Format harus .xlsx atau .xls', false);

  $('prog-wrap').classList.remove('hidden');
  setProgress(10, 'Membaca file...');

  const reader = new FileReader();

  // Event handler: dipanggil setelah file selesai dibaca (async)
  reader.onload = e => {
    try {
      setProgress(40, 'Parsing Excel...');
      const wb   = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });

      // IF: File Excel kosong
      if (!rows.length) {
        $('prog-wrap').classList.add('hidden');
        return toast('⚠️', 'File Excel tidak memiliki data.', false);
      }

      setProgress(70, 'Validasi kolom...');

      // LOOPING: Validasi kolom wajib satu per satu (IF di dalam loop)
      for (const k of ['Nama', 'Kelas', 'BB', 'TB']) {
        if (!Object.keys(rows[0]).includes(k)) {
          $('prog-wrap').classList.add('hidden');
          return toast('❌', `Kolom "<b>${k}</b>" tidak ditemukan di file.`, false);
        }
      }

      setProgress(90, 'Memproses baris...');
      let err = 0;

      // LOOPING (reduce): Konversi setiap baris Excel → objek data
      pending = rows.reduce((acc, row, i) => {
        const nama  = String(row.Nama  || '').trim();
        const kelas = String(row.Kelas || '').trim();
        const bb    = parseFloat(row.BB);
        const tb    = parseFloat(row.TB);
        const td    = String(row.TekananDarah || '').trim();

        // IF: Baris tidak valid (field kosong/NaN) → lewati, hitung error
        if (!nama || !kelas || isNaN(bb) || isNaN(tb)) { err++; return acc; }

        const imt = calcIMT(bb, tb);
        acc.push({ id: Date.now() + i + Math.random(), nama, kelas, bb, tb, td, imt, status: calcStatus(imt) });
        return acc;
      }, []);

      setProgress(100, 'Selesai!');

      setTimeout(() => {
        $('prog-wrap').classList.add('hidden');

        // IF: Tidak ada data valid setelah diproses
        if (!pending.length) return toast('⚠️', 'Tidak ada baris data valid.', false);

        // Konfirmasi import dengan dialog browser (alert/notifikasi sederhana)
        if (confirm(`Import ${pending.length} data${err ? ` (${err} baris dilewati)` : ''}?`)) {
          const n = pending.length;
          data    = [...data, ...pending]; // Gabungkan data lama + data baru
          pending = [];
          save();
          render();
          toast('✅', `${n} data berhasil diimport!`);
        } else {
          pending = [];
        }
      }, 500);

    } catch (ex) {
      $('prog-wrap').classList.add('hidden');
      toast('❌', 'Gagal membaca file: ' + ex.message, false);
    }
  };

  // Mulai baca file sebagai ArrayBuffer (binary)
  reader.readAsArrayBuffer(file);
}

/* -------------------------------------------------------
   BAGIAN 12: EXPORT EXCEL (SheetJS)
   SEQUENCE: Filter → Validasi ada data →
             Buat header → Loop rows → writeFile
------------------------------------------------------- */
function exportExcel() {
  // FILTER: Hanya ekspor data kelas 5 & 6 SD
  const rows = data.filter(s => FILTER.includes(s.kelas));

  // IF: Tidak ada data untuk diekspor
  if (!rows.length) return toast('⚠️', 'Tidak ada data Kelas 5 & 6 SD.', false);

  // SEQUENCE: Buat array 2D — header + LOOPING data
  const ws = XLSX.utils.aoa_to_sheet([
    ['No', 'Nama', 'Kelas', 'BB(kg)', 'TB(cm)', 'IMT', 'T.Darah', 'Status Gizi', 'Tanggal'],
    ...rows.map((s, i) => [
      i + 1, s.nama, s.kelas, s.bb, s.tb, s.imt,
      s.td || '-', s.status, fmt(s.tgl)
    ])
  ]);

  // Atur lebar kolom agar rapi di Excel
  ws['!cols'] = [5, 22, 8, 8, 8, 8, 12, 14, 14].map(w => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data Posyandu');

  const f = `Posyandu_Remaja_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, f);
  toast('📥', `<b>${f}</b> berhasil diunduh!`);
}

/* -------------------------------------------------------
   BAGIAN 13: UNDUH TEMPLATE EXCEL KOSONG
------------------------------------------------------- */
function unduhTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([['Nama', 'Kelas', 'BB', 'TB', 'TekananDarah']]);
  ws['!cols'] = [22, 8, 6, 6, 14].map(w => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, 'Template_Posyandu_Remaja.xlsx');
  toast('📄', 'Template Excel kosong berhasil diunduh!');
}

/* -------------------------------------------------------
   ENTRY POINT — Render tabel saat halaman pertama dimuat
------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  render();
});