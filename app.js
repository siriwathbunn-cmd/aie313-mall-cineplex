const SUPABASE_URL = 'https://qzzdheolaekmbhwogjel.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_nRJrYQGI6y0nUqYK9C9G5A_18d80btt';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let showtimesData = [];
let concessionsData = [];
let couponsData = [];

// ภาพโปสเตอร์ประกอบสวยๆ ตามรหัสหนัง (movie_id 1-10)
const MOVIE_POSTERS = {
  1: 'https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?auto=format&fit=crop&w=500&q=80', // Dune
  2: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=500&q=80', // Oppenheimer
  3: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=500&q=80', // Avatar
  4: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?auto=format&fit=crop&w=500&q=80', // Spider-Man
  5: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=500&q=80', // Batman
  6: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=500&q=80', // Interstellar
  7: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=500&q=80', // Inside Out
  8: 'https://images.unsplash.com/photo-1505635552518-3448ff116af3?auto=format&fit=crop&w=500&q=80', // Quiet Place
  9: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=500&q=80', // Fast & Furious
  10: 'https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?auto=format&fit=crop&w=500&q=80' // Your Name
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
async function loadUserPortal() {
  // โหลดรายการหนังมาทำแกลเลอรีโปสเตอร์
  const { data: movies } = await supabaseClient.from('movies').select('*').limit(5);
  const posterGrid = document.getElementById('movie-poster-grid');
  if (movies && movies.length > 0) {
    posterGrid.innerHTML = movies.map(m => {
      const imgUrl = MOVIE_POSTERS[m.movie_id] || MOVIE_POSTERS[1];
      return `
        <div onclick="selectMovieById(${m.movie_id})" class="group relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 cursor-pointer shadow-lg hover:border-amber-400 transition">
          <img src="${imgUrl}" alt="${m.title}" class="w-full h-56 object-cover group-hover:scale-105 transition duration-300" />
          <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent"></div>
          <span class="absolute top-2.5 right-2.5 bg-black/70 backdrop-blur-md text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-500/30">${m.age_rating}</span>
          <div class="absolute bottom-0 inset-x-0 p-3">
            <h3 class="font-bold text-sm text-white truncate group-hover:text-amber-400 transition">${m.title}</h3>
            <p class="text-[11px] text-slate-400">⏱️ ${m.duration_min} นาที • คลิกเลือกรอบ</p>
          </div>
        </div>
      `;
    }).join('');
  }

  // ดึงรอบฉายพร้อมชื่อหนัง
  const { data: st } = await supabaseClient
    .from('showtimes')
    .select('showtime_id, movie_id, show_date, start_time, base_price, movies(title, duration_min, age_rating), cinema_halls(name)')
    .limit(20);
  showtimesData = st || [];
  const stSelect = document.getElementById('book-showtime');
  stSelect.innerHTML = showtimesData.map(s =>
    `<option value="${s.showtime_id}" data-movie-id="${s.movie_id}" data-price="${s.base_price}" data-title="${s.movies?.title}" data-meta="${s.cinema_halls?.name || 'Cinema Hall'} • วันที่ ${s.show_date} เวลา ${s.start_time.slice(0, 5)} น.">${s.movies?.title} (${s.show_date} ${s.start_time.slice(0, 5)}) - ${s.base_price}฿</option>`
  ).join('');

  // ดึงชุดของว่าง
  const { data: cc } = await supabaseClient.from('concession_items').select('*');
  concessionsData = cc || [];
  const ccSelect = document.getElementById('book-concession');
  ccSelect.innerHTML = `<option value="0" data-price="0">-- ไม่รับของว่าง --</option>` +
    concessionsData.map(c => `<option value="${c.item_id}" data-price="${c.price}">🍿 ${c.name} (+${c.price}฿)</option>`).join('');

  // ดึงคูปองส่วนลดของลูกค้า
  const { data: cp } = await supabaseClient
    .from('customer_coupons')
    .select('coupon_id, coupon_code, mall_campaigns(title, discount_value)')
    .limit(10);
  couponsData = cp || [];
  const cpSelect = document.getElementById('book-coupon');
  cpSelect.innerHTML = `<option value="0" data-discount="0">-- ไม่ใช้คูปองส่วนลด --</option>` +
    couponsData.map(c => `<option value="${c.coupon_id}" data-discount="${c.mall_campaigns?.discount_value || 0}">🎟️ ${c.coupon_code}: ${c.mall_campaigns?.title} (-${c.mall_campaigns?.discount_value}฿)</option>`).join('');

  calculateBookingTotal();

  // ดึงประวัติการจองล่าสุด
  const { data: bookings } = await supabaseClient
    .from('cinema_bookings')
    .select('*')
    .order('booking_id', { ascending: false })
    .limit(8);

  const listDiv = document.getElementById('user-bookings-list');
  if (!bookings || bookings.length === 0) {
    listDiv.innerHTML = '<p class="text-slate-500">ยังไม่มีประวัติการจอง</p>';
    return;
  }
  listDiv.innerHTML = bookings.map(b => `
    <div class="p-3.5 border border-slate-700/80 rounded-xl bg-slate-900/90 flex justify-between items-center relative overflow-hidden">
      <div class="border-l-4 border-amber-400 pl-3">
        <div class="font-bold text-white">E-Ticket #${b.booking_id} <span class="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded ml-1">${b.status}</span></div>
        <div class="text-slate-400 mt-0.5">ราคาเต็ม ${b.original_amount}฿ • ส่วนลดห้าง -${b.discount_amount}฿</div>
      </div>
      <div class="font-extrabold text-base text-amber-400">${b.final_amount} ฿</div>
    </div>
  `).join('');
}

function selectMovieById(movieId) {
  const stSelect = document.getElementById('book-showtime');
  for (let i = 0; i < stSelect.options.length; i++) {
    if (Number(stSelect.options[i].dataset.movieId) === movieId) {
      stSelect.selectedIndex = i;
      calculateBookingTotal();
      stSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
      break;
    }
  }
}

function calculateBookingTotal() {
  const stSelect = document.getElementById('book-showtime');
  const ccSelect = document.getElementById('book-concession');
  const cpSelect = document.getElementById('book-coupon');

  const selectedOpt = stSelect.options[stSelect.selectedIndex];
  if (selectedOpt) {
    const movieId = Number(selectedOpt.dataset.movieId) || 1;
    document.getElementById('selected-movie-img').src = MOVIE_POSTERS[movieId] || MOVIE_POSTERS[1];
    document.getElementById('selected-movie-title').textContent = selectedOpt.dataset.title || 'ภาพยนตร์';
    document.getElementById('selected-movie-meta').textContent = selectedOpt.dataset.meta || '';
  }

  const ticketPrice = Number(selectedOpt?.dataset.price || 0);
  const snackPrice = Number(ccSelect.options[ccSelect.selectedIndex]?.dataset.price || 0);
  const discount = Number(cpSelect.options[cpSelect.selectedIndex]?.dataset.discount || 0);

  const original = ticketPrice + snackPrice;
  const finalAmount = Math.max(0, original - discount);

  document.getElementById('calc-original').textContent = original;
  document.getElementById('calc-discount').textContent = discount;
  document.getElementById('calc-final').textContent = finalAmount;
}

async function submitUserBooking(e) {
  e.preventDefault();
  const original = Number(document.getElementById('calc-original').textContent);
  const discount = Number(document.getElementById('calc-discount').textContent);
  const finalAmount = Number(document.getElementById('calc-final').textContent);

  const { error } = await supabaseClient.from('cinema_bookings').insert([{
    customer_id: 1,
    status: 'CONFIRMED',
    original_amount: original,
    discount_amount: discount,
    final_amount: finalAmount
  }]);

  if (error) {
    alert('เกิดข้อผิดพลาด: ' + error.message);
  } else {
    alert('🎉 จองตั๋วภาพยนตร์สำเร็จ! ออก E-Ticket เรียบร้อยแล้ว');
    loadUserPortal();
  }
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