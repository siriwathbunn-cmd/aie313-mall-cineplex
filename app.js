const SUPABASE_URL = 'https://qzzdheolaekmbhwogjel.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_nRJrYQGI6y0nUqYK9C9G5A_18d80btt';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let showtimesData = [];
let concessionsData = [];
let couponsData = [];

// ภาพโปสเตอร์ประกอบสวยๆ ตามรหัสหนัง (movie_id 1-10)
const MOVIE_POSTERS = {
  1: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=500&q=80', // Joker
  2: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=500&q=80', // Titanic
  3: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=500&q=80', // Avatar
  4: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?auto=format&fit=crop&w=500&q=80', // Spider-Man
  5: 'https://images.unsplash.com/photo-1518709766631-a6a7f45921c3?auto=format&fit=crop&w=500&q=80', // Godzilla
  6: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=500&q=80', // Transformers
  7: 'https://images.unsplash.com/photo-1551269901-5c5e14c25df7?auto=format&fit=crop&w=500&q=80', // Harry potter
  8: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=500&q=80', // Star wars
  9: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?auto=format&fit=crop&w=500&q=80', // Alien: Romulus
  10: 'https://images.unsplash.com/photo-1516728778615-2d590ea1855e?auto=format&fit=crop&w=500&q=80' // Jurassic
};

window.addEventListener('DOMContentLoaded', () => {
  loadUserPortal();
  loadDashboardViews();
  loadProductsCRUD();
});

supabaseClient.auth.onAuthStateChange((event, session) => {
  const btnOpenAuth = document.getElementById('btn-open-auth');
  const loggedInBox = document.getElementById('user-logged-in-box');

  if (session) {
    btnOpenAuth.classList.add('hidden');
    loggedInBox.classList.remove('hidden');
    document.getElementById('user-badge').textContent = session.user.email;
    toggleAuthModal(false);
  } else {
    btnOpenAuth.classList.remove('hidden');
    loggedInBox.classList.add('hidden');
  }
});

// ==========================================
// 1. ระบบ Modal & สลับหน้าจอ User / Admin
// ==========================================
function toggleAuthModal(show) {
  const modal = document.getElementById('auth-modal');
  if (show) modal.classList.remove('hidden');
  else modal.classList.add('hidden');
}

function toggleBotModal() {
  document.getElementById('bot-modal').classList.toggle('hidden');
}

function switchRole(role) {
  const viewUser = document.getElementById('view-user');
  const viewAdmin = document.getElementById('view-admin');
  const btnUser = document.getElementById('btn-user-view');
  const btnAdmin = document.getElementById('btn-admin-view');

  if (role === 'user') {
    viewUser.classList.remove('hidden');
    viewAdmin.classList.add('hidden');
    btnUser.className = 'px-3.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-semibold transition';
    btnAdmin.className = 'px-3.5 py-1.5 rounded-lg text-slate-300 hover:bg-slate-700 font-medium transition';
  } else {
    viewUser.classList.add('hidden');
    viewAdmin.classList.remove('hidden');
    btnAdmin.className = 'px-3.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-semibold transition';
    btnUser.className = 'px-3.5 py-1.5 rounded-lg text-slate-300 hover:bg-slate-700 font-medium transition';
  }
}

async function handleRegister() {
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const msg = document.getElementById('auth-msg');

  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    msg.className = 'text-xs text-center text-rose-400 mt-2';
    msg.textContent = 'สมัครไม่สำเร็จ: ' + error.message;
  } else {
    msg.className = 'text-xs text-center text-emerald-400 mt-2';
    msg.textContent = 'สมัครสมาชิกสำเร็จ! กดเข้าสู่ระบบได้เลย';
  }
}

async function handleLogin() {
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const msg = document.getElementById('auth-msg');

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    msg.className = 'text-xs text-center text-rose-400 mt-2';
    msg.textContent = 'เข้าสู่ระบบไม่สำเร็จ: ' + error.message;
  }
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
}

// ==========================================
// 2. ฝั่งลูกค้า: แกลเลอรีโปสเตอร์ + จองตั๋ว + ใช้คูปอง
// ==========================================
// ==========================================
// 2. ฝั่งลูกค้า: หนัง 10 เรื่อง -> รอบฉาย -> ที่นั่ง -> ออก E-Ticket
// ==========================================
let allMoviesData = [];
let selectedMovieId = null;
let selectedDate = null;
let selectedShowtimeObj = null;
let selectedSeats = []; // เก็บ { code: 'H-12', type: 'Premium', price: 400 }

async function loadUserPortal() {
  // 1. ดึงหนังทั้งหมด 10 เรื่อง
  const { data: movies } = await supabaseClient.from('movies').select('*').order('movie_id').limit(10);
  allMoviesData = movies || [];

  // 2. ดึงรอบฉายทั้งหมด
  const { data: st } = await supabaseClient
    .from('showtimes')
    .select('showtime_id, movie_id, show_date, start_time, base_price, cinema_halls(name)')
    .order('show_date')
    .order('start_time');
  showtimesData = st || [];

  // 3. ดึงชุดป๊อปคอร์น & คูปอง
  const { data: cc } = await supabaseClient.from('concession_items').select('*');
  concessionsData = cc || [];
  document.getElementById('book-concession').innerHTML = `<option value="0" data-price="0">-- ไม่รับชุดของว่าง --</option>` +
    concessionsData.map(c => `<option value="${c.item_id}" data-price="${c.price}">🍿 ${c.name} (+${c.price}฿)</option>`).join('');

  const { data: cp } = await supabaseClient
    .from('customer_coupons')
    .select('coupon_id, coupon_code, mall_campaigns(title, discount_value)')
    .limit(10);
  couponsData = cp || [];
  document.getElementById('book-coupon').innerHTML = `<option value="0" data-discount="0">-- ไม่ใช้คูปองส่วนลด --</option>` +
    couponsData.map(c => `<option value="${c.coupon_id}" data-discount="${c.mall_campaigns?.discount_value || 0}">🎟️ ${c.coupon_code}: ${c.mall_campaigns?.title} (-${c.mall_campaigns?.discount_value}฿)</option>`).join('');

  // เลือกหนังเรื่องแรกเป็นค่าเริ่มต้น
  if (allMoviesData.length > 0 && !selectedMovieId) {
    selectedMovieId = allMoviesData[0].movie_id;
  }

  renderMovieGallery();
  renderShowtimeSelector();
  renderSeatMap();
  loadBookingHistory();
}

function renderMovieGallery() {
  const grid = document.getElementById('movie-poster-grid');
  document.getElementById('movie-count-badge').textContent = `${allMoviesData.length} เรื่อง`;

  grid.innerHTML = allMoviesData.map(m => {
    const isSelected = m.movie_id === selectedMovieId;
    const imgUrl = MOVIE_POSTERS[m.movie_id] || MOVIE_POSTERS[1];
    return `
      <div onclick="selectMovie(${m.movie_id})"
        class="snap-start shrink-0 w-32 rounded-xl overflow-hidden cursor-pointer transition relative border-2 ${isSelected ? 'border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.4)] scale-[1.02]' : 'border-slate-800 opacity-75 hover:opacity-100'}">
        <img src="${imgUrl}" alt="${m.title}" class="w-full h-44 object-cover" />
        <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
        <span class="absolute top-2 right-2 bg-black/80 text-amber-300 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-500/30">${m.age_rating || 'PG-13'}</span>
        <div class="absolute bottom-0 inset-x-0 p-2">
          <div class="font-bold text-xs text-white truncate">${m.title}</div>
          <div class="text-[10px] text-slate-400">⏱️ ${m.duration_min} นาที</div>
        </div>
      </div>
    `;
  }).join('');
}

function selectMovie(movieId) {
  selectedMovieId = movieId;
  selectedDate = null;
  selectedShowtimeObj = null;
  selectedSeats = [];
  renderMovieGallery();
  renderShowtimeSelector();
  renderSeatMap();
  calculateBookingTotal();
}

function renderShowtimeSelector() {
  const movieShowtimes = showtimesData.filter(s => s.movie_id === selectedMovieId);
  const dates = [...new Set(movieShowtimes.map(s => s.show_date))];

  if (dates.length > 0 && (!selectedDate || !dates.includes(selectedDate))) {
    selectedDate = dates[0];
  }

  // สร้างปุ่มเลือกวันที่
  const dateContainer = document.getElementById('date-pills-container');
  if (dates.length === 0) {
    dateContainer.innerHTML = '<span class="text-xs text-slate-400">ยังไม่มีรอบฉายสำหรับเรื่องนี้</span>';
    document.getElementById('showtime-slots-container').innerHTML = '';
    return;
  }

  dateContainer.innerHTML = dates.map(d => {
    const active = d === selectedDate;
    return `
      <button type="button" onclick="selectDate('${d}')"
        class="shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition ${active ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'}">
        📅 ${d}
      </button>
    `;
  }).join('');

  // กรองรอบฉายตามวันที่เลือก และจัดกลุ่มตามโรงภาพยนตร์
  const slots = movieShowtimes.filter(s => s.show_date === selectedDate);
  if (slots.length > 0 && (!selectedShowtimeObj || selectedShowtimeObj.movie_id !== selectedMovieId || selectedShowtimeObj.show_date !== selectedDate)) {
    selectedShowtimeObj = slots[0];
  }

  const byHall = {};
  slots.forEach(s => {
    const hallName = s.cinema_halls?.name || 'Cinema Hall';
    if (!byHall[hallName]) byHall[hallName] = [];
    byHall[hallName].push(s);
  });

  const slotsContainer = document.getElementById('showtime-slots-container');
  slotsContainer.innerHTML = Object.entries(byHall).map(([hall, items]) => `
    <div class="bg-slate-900/70 p-3 rounded-xl border border-slate-800">
      <div class="text-xs font-semibold text-amber-300 mb-2">🏛️ ${hall}</div>
      <div class="flex flex-wrap gap-2">
        ${items.map(s => {
    const isSelected = selectedShowtimeObj && selectedShowtimeObj.showtime_id === s.showtime_id;
    return `
            <button type="button" onclick="selectShowtime(${s.showtime_id})"
              class="px-3.5 py-1.5 rounded-lg text-xs font-bold border transition ${isSelected ? 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.3)]' : 'bg-slate-800 text-white border-slate-700 hover:border-amber-500/50'}">
              ${s.start_time.slice(0, 5)}
            </button>
          `;
  }).join('')}
      </div>
    </div>
  `).join('');

  calculateBookingTotal();
}

function selectDate(d) {
  selectedDate = d;
  selectedShowtimeObj = null;
  renderShowtimeSelector();
}

function selectShowtime(showtimeId) {
  selectedShowtimeObj = showtimesData.find(s => s.showtime_id === showtimeId);
  renderShowtimeSelector();
}

function renderSeatMap() {
  const grid = document.getElementById('seat-map-grid');
  const rows = [
    { row: 'S', type: 'Sofa Bed', price: 600, color: 'bg-rose-600/80 border-rose-400/50', cols: 4 },
    { row: 'A', type: 'Premium', price: 400, color: 'bg-amber-500/80 border-amber-300/50 text-slate-950', cols: 8 },
    { row: 'B', type: 'Premium', price: 400, color: 'bg-amber-500/80 border-amber-300/50 text-slate-950', cols: 8 },
    { row: 'C', type: 'Standard', price: 300, color: 'bg-sky-600/80 border-sky-400/50', cols: 8 },
    { row: 'D', type: 'Standard', price: 300, color: 'bg-sky-600/80 border-sky-400/50', cols: 8 }
  ];

  grid.innerHTML = rows.map(r => {
    let seatsHtml = '';
    for (let c = 1; c <= r.cols; c++) {
      const code = `${r.row}-${c}`;
      const isPicked = selectedSeats.some(s => s.code === code);
      seatsHtml += `
        <button type="button" onclick="toggleSeat('${code}', '${r.type}', ${r.price})"
          class="${r.cols === 4 ? 'w-12 h-7' : 'w-7 h-7'} rounded-md text-[10px] font-bold border transition flex items-center justify-center cursor-pointer ${isPicked ? 'bg-emerald-400 text-slate-950 border-white ring-2 ring-amber-400 scale-110' : r.color + ' hover:opacity-100 opacity-85'}">
          ${code}
        </button>
      `;
    }
    return `<div class="flex justify-center gap-1.5">${seatsHtml}</div>`;
  }).join('');
}

function toggleSeat(code, type, price) {
  const idx = selectedSeats.findIndex(s => s.code === code);
  if (idx >= 0) selectedSeats.splice(idx, 1);
  else selectedSeats.push({ code, type, price });

  renderSeatMap();
  calculateBookingTotal();
}

function calculateBookingTotal() {
  const movie = allMoviesData.find(m => m.movie_id === selectedMovieId);
  document.getElementById('summary-movie-title').textContent = movie ? movie.title : 'กรุณาเลือกภาพยนตร์';
  document.getElementById('summary-showtime-info').textContent = selectedShowtimeObj
    ? `${selectedShowtimeObj.cinema_halls?.name || 'Hall'} • ${selectedShowtimeObj.show_date} (${selectedShowtimeObj.start_time.slice(0, 5)} น.)`
    : 'รอบฉาย: -';

  const seatTotal = selectedSeats.reduce((sum, s) => sum + s.price, 0);
  const seatNames = selectedSeats.map(s => s.code).join(', ');

  document.getElementById('selected-seat-badge').textContent = selectedSeats.length > 0 ? `เลือกแล้ว ${selectedSeats.length} ที่นั่ง` : 'ยังไม่เลือกที่นั่ง';
  document.getElementById('summary-seat-label').textContent = selectedSeats.length > 0 ? `ตั๋วหนัง (${seatNames})` : 'ตั๋วหนัง (ยังไม่เลือกที่นั่ง)';

  const ccSelect = document.getElementById('book-concession');
  const cpSelect = document.getElementById('book-coupon');
  const snackPrice = Number(ccSelect.options[ccSelect.selectedIndex]?.dataset.price || 0);
  const discount = Number(cpSelect.options[cpSelect.selectedIndex]?.dataset.discount || 0);

  const original = seatTotal + snackPrice;
  const finalAmount = Math.max(0, original - discount);

  document.getElementById('calc-seat-price').textContent = seatTotal;
  document.getElementById('calc-snack-price').textContent = snackPrice;
  document.getElementById('calc-discount').textContent = discount;
  document.getElementById('calc-final').textContent = finalAmount;
}

async function submitUserBooking(e) {
  e.preventDefault();
  if (selectedSeats.length === 0) {
    alert('กรุณาคลิกเลือกที่นั่งบนผังโรงภาพยนตร์อย่างน้อย 1 ที่นั่งก่อนครับ');
    return;
  }

  const seatTotal = Number(document.getElementById('calc-seat-price').textContent);
  const snackPrice = Number(document.getElementById('calc-snack-price').textContent);
  const discount = Number(document.getElementById('calc-discount').textContent);
  const finalAmount = Number(document.getElementById('calc-final').textContent);

  const { data, error } = await supabaseClient.from('cinema_bookings').insert([{
    customer_id: 1,
    showtime_id: selectedShowtimeObj?.showtime_id || null,
    status: 'CONFIRMED',
    original_amount: seatTotal + snackPrice,
    discount_amount: discount,
    final_amount: finalAmount
  }]).select();

  if (error) {
    alert('เกิดข้อผิดพลาด: ' + error.message);
    return;
  }

  // แสดงหน้าสรุปตั๋ว E-Ticket Modal
  const movie = allMoviesData.find(m => m.movie_id === selectedMovieId);
  document.getElementById('ticket-movie').textContent = movie?.title || 'Movie Ticket';
  document.getElementById('ticket-showtime').textContent = `${selectedShowtimeObj?.cinema_halls?.name || 'Cinema'} • ${selectedShowtimeObj?.show_date} ${selectedShowtimeObj?.start_time?.slice(0, 5) || ''}`;
  document.getElementById('ticket-seats').textContent = selectedSeats.map(s => s.code).join(', ');
  document.getElementById('ticket-total').textContent = `${finalAmount} ฿`;
  document.getElementById('ticket-id').textContent = data?.[0]?.booking_id || 'NEW';
  document.getElementById('eticket-modal').classList.remove('hidden');

  selectedSeats = [];
  renderSeatMap();
  calculateBookingTotal();
  loadBookingHistory();
}

async function loadBookingHistory() {
  const { data: bookings } = await supabaseClient
    .from('cinema_bookings')
    .select('*')
    .order('booking_id', { ascending: false })
    .limit(6);

  const listDiv = document.getElementById('user-bookings-list');
  if (!bookings || bookings.length === 0) {
    listDiv.innerHTML = '<p class="text-slate-400">ยังไม่มีประวัติการจอง</p>';
    return;
  }
  listDiv.innerHTML = bookings.map(b => `
    <div class="p-3 border border-slate-700 rounded-xl bg-slate-900 flex justify-between items-center">
      <div>
        <div class="font-bold text-white">E-Ticket #${b.booking_id} <span class="text-emerald-400">[${b.status}]</span></div>
        <div class="text-slate-400">เต็ม ${b.original_amount}฿ • ลด ${b.discount_amount}฿</div>
      </div>
      <div class="font-extrabold text-sm text-amber-400">${b.final_amount} ฿</div>
    </div>
  `).join('');
}

// ==========================================
// 3. ฝั่งแอดมิน: Dashboard Views & CRUD (ธีม Dark)
// ==========================================
function renderHtmlTable(rows) {
  if (!rows || rows.length === 0) return '<p class="text-sm text-slate-400 p-4">ไม่พบข้อมูล</p>';
  const headers = Object.keys(rows[0]);
  let html = '<table class="min-w-full text-xs text-left border-collapse">';
  html += '<thead class="bg-slate-800 text-amber-300 font-semibold uppercase"><tr>';
  headers.forEach(h => html += `<th class="border-b border-slate-700 px-3.5 py-2.5">${h}</th>`);
  html += '</tr></thead><tbody class="divide-y divide-slate-800 bg-slate-900/60">';
  rows.forEach(row => {
    html += '<tr class="hover:bg-slate-800/70 transition">';
    headers.forEach(h => html += `<td class="px-3.5 py-2.5 text-slate-200">${row[h] ?? '-'}</td>`);
    html += '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

async function loadDashboardViews() {
  const { data: movies } = await supabaseClient.from('v_movie_box_office_summary').select('*');
  document.getElementById('view-movies-table').innerHTML = renderHtmlTable(movies);

  const { data: stores } = await supabaseClient.from('v_store_performance_summary').select('*').limit(10);
  document.getElementById('view-stores-table').innerHTML = renderHtmlTable(stores);

  const { data: redemptions } = await supabaseClient.from('v_cross_campaign_redemptions').select('*');
  document.getElementById('view-redemptions-table').innerHTML = renderHtmlTable(redemptions);
}

async function loadProductsCRUD() {
  const { data, error } = await supabaseClient
    .from('store_products')
    .select('*')
    .order('product_id', { ascending: false })
    .limit(15);

  if (error) return;

  let html = '<table class="min-w-full text-xs text-left border-collapse">';
  html += '<thead class="bg-slate-800 text-amber-300"><tr><th class="p-2.5">ID</th><th class="p-2.5">Store</th><th class="p-2.5">Code</th><th class="p-2.5">ชื่อสินค้า</th><th class="p-2.5">ราคา</th><th class="p-2.5 text-center">จัดการ</th></tr></thead><tbody class="divide-y divide-slate-800 bg-slate-900/60">';

  data.forEach(item => {
    html += `<tr class="hover:bg-slate-800/70">
      <td class="p-2.5">${item.product_id}</td>
      <td class="p-2.5">${item.store_id}</td>
      <td class="p-2.5 text-slate-400">${item.product_code || '-'}</td>
      <td class="p-2.5 font-medium text-white">${item.name}</td>
      <td class="p-2.5 text-emerald-400 font-semibold">${Number(item.price).toLocaleString()} ฿</td>
      <td class="p-2.5 text-center space-x-3">
        <button onclick='editProduct(${JSON.stringify(item)})' class="text-amber-400 hover:underline font-medium">แก้ไข</button>
        <button onclick="deleteProduct(${item.product_id})" class="text-rose-400 hover:underline font-medium">ลบ</button>
      </td>
    </tr>`;
  });
  html += '</tbody></table>';
  document.getElementById('crud-products-table').innerHTML = html;
}

async function saveProduct(e) {
  e.preventDefault();
  const id = document.getElementById('prod-id').value;
  const payload = {
    store_id: parseInt(document.getElementById('prod-store-id').value),
    product_code: document.getElementById('prod-code').value,
    name: document.getElementById('prod-name').value,
    price: parseFloat(document.getElementById('prod-price').value),
    is_available: true
  };

  if (id) {
    await supabaseClient.from('store_products').update(payload).eq('product_id', id);
  } else {
    await supabaseClient.from('store_products').insert([payload]);
  }
  resetProductForm();
  loadProductsCRUD();
}

function editProduct(item) {
  document.getElementById('prod-id').value = item.product_id;
  document.getElementById('prod-store-id').value = item.store_id;
  document.getElementById('prod-code').value = item.product_code;
  document.getElementById('prod-name').value = item.name;
  document.getElementById('prod-price').value = item.price;
  document.getElementById('crud-submit-btn').textContent = 'อัปเดต';
}

async function deleteProduct(id) {
  if (!confirm('ยืนยันการลบสินค้านี้?')) return;
  await supabaseClient.from('store_products').delete().eq('product_id', id);
  loadProductsCRUD();
}

function resetProductForm() {
  document.getElementById('product-form').reset();
  document.getElementById('prod-id').value = '';
  document.getElementById('crud-submit-btn').textContent = 'บันทึก';
}

// ==========================================
// 4. ระบบ AI Chatbot
// ==========================================
function setQuestion(q) {
  document.getElementById('chat-input').value = q;
}

async function sendChatQuestion(e) {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  const question = input.value.trim();
  if (!question) return;

  const chatBox = document.getElementById('chat-messages');
  const loading = document.getElementById('chat-loading');

  chatBox.innerHTML += `
    <div class="flex justify-end">
      <div class="bg-amber-500 text-slate-950 font-medium px-4 py-2.5 rounded-2xl max-w-lg text-sm shadow">${question}</div>
    </div>`;
  input.value = '';
  loading.classList.remove('hidden');
  chatBox.scrollTop = chatBox.scrollHeight;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, customer_id: 1 })
    });
    const result = await res.json();
    if (result.error) throw new Error(result.error);

    chatBox.innerHTML += `
      <div class="bg-slate-900 p-4 rounded-2xl border border-slate-700 shadow-lg space-y-3 text-sm">
        <p class="text-slate-100 leading-relaxed">${result.answer}</p>
        <div class="bg-black/80 text-emerald-400 p-3 rounded-xl font-mono text-xs overflow-x-auto border border-slate-800">
          <div class="text-slate-500 mb-1">-- หลักฐานคำสั่ง SQL ที่ถูกสร้าง:</div>
          <code>${result.sql}</code>
        </div>
        <div>
          <div class="text-xs font-semibold text-amber-400 mb-1.5">ตารางผลลัพธ์จริง (Raw Data):</div>
          <div class="overflow-x-auto max-h-48 rounded-lg border border-slate-700">${renderHtmlTable(result.data)}</div>
        </div>
      </div>`;
  } catch (err) {
    chatBox.innerHTML += `
      <div class="bg-rose-950/60 border border-rose-500/50 text-rose-300 p-3 rounded-xl text-xs">
        เกิดข้อผิดพลาด: ${err.message}
      </div>`;
  } finally {
    loading.classList.add('hidden');
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}