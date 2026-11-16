const SUPABASE_URL = 'https://qzzdheolaekmbhwogjel.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_nRJrYQGI6y0nUqYK9C9G5A_18d80btt';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let showtimesData = [];
let concessionsData = [];
let couponsData = [];

// โหลดข้อมูลทันทีที่เปิดหน้าเว็บ (ไม่ต้องรอล็อกอินก่อน)
window.addEventListener('DOMContentLoaded', () => {
  loadUserPortal();
  loadDashboardViews();
  loadProductsCRUD();
});

// ตรวจสอบสถานะการ Login สำหรับอัปเดตปุ่มบน Navbar
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
// 1. ระบบ Popup Login / Register & สลับหน้าจอ
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
    btnUser.classList.add('bg-indigo-600');
    btnAdmin.classList.remove('bg-indigo-600');
  } else {
    viewUser.classList.add('hidden');
    viewAdmin.classList.remove('hidden');
    btnAdmin.classList.add('bg-indigo-600');
    btnUser.classList.remove('bg-indigo-600');
  }
}

async function handleRegister() {
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const msg = document.getElementById('auth-msg');

  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    msg.className = 'text-xs text-center text-rose-600 mt-2';
    msg.textContent = 'สมัครไม่สำเร็จ: ' + error.message;
  } else {
    msg.className = 'text-xs text-center text-emerald-600 mt-2';
    msg.textContent = 'สมัครสมาชิกสำเร็จ! กดเข้าสู่ระบบได้เลย';
  }
}

async function handleLogin() {
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const msg = document.getElementById('auth-msg');

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    msg.className = 'text-xs text-center text-rose-600 mt-2';
    msg.textContent = 'เข้าสู่ระบบไม่สำเร็จ: ' + error.message;
  }
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
}

// ==========================================
// 2. ฝั่งลูกค้า (User Portal: จองตั๋ว + ใช้คูปองห้าง)
// ==========================================
async function loadUserPortal() {
  // ดึงรอบฉายพร้อมชื่อหนัง
  const { data: st } = await supabaseClient
    .from('showtimes')
    .select('showtime_id, show_date, start_time, base_price, movies(title), cinema_halls(name)')
    .limit(15);
  showtimesData = st || [];
  const stSelect = document.getElementById('book-showtime');
  stSelect.innerHTML = showtimesData.map(s =>
    `<option value="${s.showtime_id}" data-price="${s.base_price}">${s.movies?.title} (${s.show_date} ${s.start_time.slice(0, 5)}) - ${s.base_price}฿</option>`
  ).join('');

  // ดึงชุดของว่าง
  const { data: cc } = await supabaseClient.from('concession_items').select('*');
  concessionsData = cc || [];
  const ccSelect = document.getElementById('book-concession');
  ccSelect.innerHTML = `<option value="0" data-price="0">-- ไม่รับของว่าง --</option>` +
    concessionsData.map(c => `<option value="${c.item_id}" data-price="${c.price}">${c.name} (+${c.price}฿)</option>`).join('');

  // ดึงคูปองส่วนลดของลูกค้า
  const { data: cp } = await supabaseClient
    .from('customer_coupons')
    .select('coupon_id, coupon_code, mall_campaigns(title, discount_value)')
    .limit(10);
  couponsData = cp || [];
  const cpSelect = document.getElementById('book-coupon');
  cpSelect.innerHTML = `<option value="0" data-discount="0">-- ไม่ใช้คูปองส่วนลด --</option>` +
    couponsData.map(c => `<option value="${c.coupon_id}" data-discount="${c.mall_campaigns?.discount_value || 0}">${c.coupon_code}: ${c.mall_campaigns?.title} (-${c.mall_campaigns?.discount_value}฿)</option>`).join('');

  calculateBookingTotal();

  // ดึงประวัติการจองล่าสุด
  const { data: bookings } = await supabaseClient
    .from('cinema_bookings')
    .select('*')
    .order('booking_id', { ascending: false })
    .limit(8);

  const listDiv = document.getElementById('user-bookings-list');
  if (!bookings || bookings.length === 0) {
    listDiv.innerHTML = '<p class="text-slate-400">ยังไม่มีประวัติการจอง</p>';
    return;
  }
  listDiv.innerHTML = bookings.map(b => `
    <div class="p-3 border rounded-lg bg-slate-50 flex justify-between items-center">
      <div>
        <div class="font-bold text-indigo-950">Booking #${b.booking_id} <span class="text-emerald-600">[${b.status}]</span></div>
        <div class="text-slate-500">ยอดเต็ม ${b.original_amount}฿ | ลด ${b.discount_amount}฿</div>
      </div>
      <div class="font-bold text-sm text-indigo-700">${b.final_amount} ฿</div>
    </div>
  `).join('');
}

function calculateBookingTotal() {
  const stSelect = document.getElementById('book-showtime');
  const ccSelect = document.getElementById('book-concession');
  const cpSelect = document.getElementById('book-coupon');

  const ticketPrice = Number(stSelect.options[stSelect.selectedIndex]?.dataset.price || 0);
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
    alert('จองตั๋วภาพยนตร์สำเร็จ!');
    loadUserPortal();
  }
}

// ==========================================
// 3. ฝั่งแอดมิน: Dashboard Views & CRUD
// ==========================================
function renderHtmlTable(rows) {
  if (!rows || rows.length === 0) return '<p class="text-sm text-slate-500">ไม่พบข้อมูล</p>';
  const headers = Object.keys(rows[0]);
  let html = '<table class="min-w-full text-xs text-left border-collapse border border-slate-200">';
  html += '<thead class="bg-slate-100 text-slate-700 font-semibold"><tr>';
  headers.forEach(h => html += `<th class="border border-slate-200 px-3 py-2">${h}</th>`);
  html += '</tr></thead><tbody>';
  rows.forEach(row => {
    html += '<tr class="hover:bg-slate-50">';
    headers.forEach(h => html += `<td class="border border-slate-200 px-3 py-2">${row[h] ?? '-'}</td>`);
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

  let html = '<table class="min-w-full text-xs text-left border-collapse border border-slate-200">';
  html += '<thead class="bg-slate-100"><tr><th class="border p-2">ID</th><th class="border p-2">Store</th><th class="border p-2">Code</th><th class="border p-2">ชื่อสินค้า</th><th class="border p-2">ราคา</th><th class="border p-2 text-center">จัดการ</th></tr></thead><tbody>';

  data.forEach(item => {
    html += `<tr class="hover:bg-slate-50">
      <td class="border p-2">${item.product_id}</td>
      <td class="border p-2">${item.store_id}</td>
      <td class="border p-2">${item.product_code || '-'}</td>
      <td class="border p-2 font-medium">${item.name}</td>
      <td class="border p-2">${Number(item.price).toLocaleString()} ฿</td>
      <td class="border p-2 text-center space-x-2">
        <button onclick='editProduct(${JSON.stringify(item)})' class="text-amber-600 hover:underline font-medium">แก้ไข</button>
        <button onclick="deleteProduct(${item.product_id})" class="text-rose-600 hover:underline font-medium">ลบ</button>
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
      <div class="bg-indigo-600 text-white px-4 py-2 rounded-xl max-w-lg text-sm shadow">${question}</div>
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
      <div class="bg-white p-4 rounded-xl border shadow-sm space-y-3 text-sm">
        <p class="text-slate-800 leading-relaxed">${result.answer}</p>
        <div class="bg-slate-900 text-emerald-400 p-3 rounded-lg font-mono text-xs overflow-x-auto">
          <div class="text-slate-400 mb-1">-- หลักฐานคำสั่ง SQL ที่ถูกสร้าง:</div>
          <code>${result.sql}</code>
        </div>
        <div>
          <div class="text-xs font-semibold text-slate-600 mb-1">ตารางผลลัพธ์จริง (Raw Data):</div>
          <div class="overflow-x-auto max-h-48">${renderHtmlTable(result.data)}</div>
        </div>
      </div>`;
  } catch (err) {
    chatBox.innerHTML += `
      <div class="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg text-xs">
        เกิดข้อผิดพลาด: ${err.message}
      </div>`;
  } finally {
    loading.classList.add('hidden');
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}