// ==========================================
// ตั้งค่าการเชื่อมต่อ Supabase (ใส่ค่าของโปรเจกต์คุณ)
// ==========================================
const SUPABASE_URL = 'https://qzzdheolaekmbhwogjel.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_nRJrYQGI6y0nUqYK9C9G5A_18d80btt';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ตรวจสอบสถานะการ Login อัตโนมัติ
supabaseClient.auth.onAuthStateChange((event, session) => {
  const authSec = document.getElementById('auth-section');
  const appMain = document.getElementById('app-main');
  const navLinks = document.getElementById('nav-links');

  if (session) {
    authSec.classList.add('hidden');
    appMain.classList.remove('hidden');
    navLinks.classList.remove('hidden');
    document.getElementById('user-badge').textContent = session.user.email;
    loadDashboardViews();
    loadProductsCRUD();
  } else {
    authSec.classList.remove('hidden');
    appMain.classList.add('hidden');
    navLinks.classList.add('hidden');
  }
});

// ==========================================
// 1. ระบบ Authentication (Register / Login / Logout)
// ==========================================
async function handleRegister() {
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const msg = document.getElementById('auth-msg');

  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    msg.textContent = 'สมัครไม่สำเร็จ: ' + error.message;
  } else {
    msg.className = 'text-sm text-center text-emerald-600 mt-2';
    msg.textContent = 'สมัครสมาชิกสำเร็จ! สามารถกดเข้าสู่ระบบได้เลย (หรือเช็กอีเมลยืนยัน)';
  }
}

async function handleLogin() {
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const msg = document.getElementById('auth-msg');

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    msg.textContent = 'เข้าสู่ระบบไม่สำเร็จ: ' + error.message;
  }
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
}

// สลับแท็บหน้าจอ
function switchTab(tabName) {
  ['dashboard', 'crud', 'chat'].forEach(t => {
    document.getElementById(`tab-${t}`).classList.add('hidden');
  });
  document.getElementById(`tab-${tabName}`).classList.remove('hidden');
}

// ฟังก์ชันช่วยสร้างตาราง HTML อัตโนมัติจาก Array of Objects
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

// ==========================================
// 2. หน้า Dashboard แสดงผล Views (3 รายการ)
// ==========================================
async function loadDashboardViews() {
  const { data: movies } = await supabaseClient.from('v_movie_box_office_summary').select('*');
  document.getElementById('view-movies-table').innerHTML = renderHtmlTable(movies);

  const { data: stores } = await supabaseClient.from('v_store_performance_summary').select('*').limit(10);
  document.getElementById('view-stores-table').innerHTML = renderHtmlTable(stores);

  const { data: redemptions } = await supabaseClient.from('v_cross_campaign_redemptions').select('*');
  document.getElementById('view-redemptions-table').innerHTML = renderHtmlTable(redemptions);
}

// ==========================================
// 3. ระบบ CRUD (ตาราง store_products)
// ==========================================
async function loadProductsCRUD() {
  const { data, error } = await supabaseClient
    .from('store_products')
    .select('*')
    .order('product_id', { ascending: false })
    .limit(20);

  if (error) return console.error(error);

  let html = '<table class="min-w-full text-sm text-left border-collapse border border-slate-200">';
  html += '<thead class="bg-slate-100"><tr><th class="border p-2">ID</th><th class="border p-2">Store ID</th><th class="border p-2">Code</th><th class="border p-2">ชื่อสินค้า</th><th class="border p-2">ราคา</th><th class="border p-2 text-center">จัดการ</th></tr></thead><tbody>';

  data.forEach(item => {
    html += `<tr class="hover:bg-slate-50">
      <td class="border p-2">${item.product_id}</td>
      <td class="border p-2">${item.store_id}</td>
      <td class="border p-2">${item.product_code || '-'}</td>
      <td class="border p-2 font-medium">${item.name}</td>
      <td class="border p-2">${Number(item.price).toLocaleString()} ฿</td>
      <td class="border p-2 text-center space-x-2">
        <button onclick='editProduct(${JSON.stringify(item)})' class="text-amber-600 hover:underline text-xs font-medium">แก้ไข</button>
        <button onclick="deleteProduct(${item.product_id})" class="text-rose-600 hover:underline text-xs font-medium">ลบ</button>
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
    // UPDATE
    await supabaseClient.from('store_products').update(payload).eq('product_id', id);
  } else {
    // CREATE
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
  document.getElementById('crud-submit-btn').textContent = 'อัปเดตข้อมูล';
}

async function deleteProduct(id) {
  if (!confirm('ยืนยันการลบสินค้านี้?')) return;
  await supabaseClient.from('store_products').delete().eq('product_id', id);
  loadProductsCRUD();
}

function resetProductForm() {
  document.getElementById('product-form').reset();
  document.getElementById('prod-id').value = '';
  document.getElementById('crud-submit-btn').textContent = 'บันทึกข้อมูล';
}

// ==========================================
// 4. ระบบ AI Chatbot (ส่งคำถาม + แสดงหลักฐาน SQL & Raw Data)
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

  // แสดงข้อความฝั่งผู้ใช้
  chatBox.innerHTML += `
    <div class="flex justify-end">
      <div class="bg-indigo-600 text-white px-4 py-2.5 rounded-xl max-w-lg text-sm shadow">${question}</div>
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

    // แสดงคำตอบ + หลักฐาน SQL + ตาราง Raw Data ตามเกณฑ์โจทย์
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