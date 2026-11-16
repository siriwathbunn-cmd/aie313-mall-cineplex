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
// 2. ฝั่งลูกค้า: Wizard 4 ขั้นตอนแบบ Major Cineplex
// ==========================================
let allMoviesData = [];
let selectedMovieObj = null;
let selectedDate = null;
let selectedShowtimeObj = null;
let selectedSeats = []; // เก็บ { code: 'B13', type: 'Normal', price: 260 }

async function loadUserPortal() {
  const { data: movies } = await supabaseClient.from('movies').select('*').order('movie_id').limit(10);
  allMoviesData = movies || [];

  const { data: st } = await supabaseClient
    .from('showtimes')
    .select('showtime_id, movie_id, show_date, start_time, base_price, cinema_halls(name)')
    .order('show_date')
    .order('start_time');
  showtimesData = st || [];

  const { data: cc } = await supabaseClient.from('concession_items').select('*');
  concessionsData = cc || [];
  document.getElementById('book-concession').innerHTML = `<option value="0" data-price="0">-- ไม่รับชุดป๊อปคอร์น/เครื่องดื่ม --</option>` +
    concessionsData.map(c => `<option value="${c.item_id}" data-price="${c.price}">🍿 ${c.name} (+${c.price} THB)</option>`).join('');

  const { data: cp } = await supabaseClient
    .from('customer_coupons')
    .select('coupon_id, coupon_code, mall_campaigns(title, discount_value)')
    .limit(10);
  couponsData = cp || [];
  document.getElementById('book-coupon').innerHTML = `<option value="0" data-discount="0">-- ไม่ใช้คูปองส่วนลด --</option>` +
    couponsData.map(c => `<option value="${c.coupon_id}" data-discount="${c.mall_campaigns?.discount_value || 0}">🎟️ ${c.coupon_code}: ${c.mall_campaigns?.title} (-${c.mall_campaigns?.discount_value} THB)</option>`).join('');

  renderMoviesGrid();
  loadBookingHistory();
}

// สลับหน้าจอระหว่าง Step 1 (รวมหนัง) -> Step 2 (รอบฉาย) -> Step 3 (ที่นั่ง) -> Step 4 (โปรโมชั่น & ออกตั๋ว)
function goToStep(step) {
  [1, 2, 3, 4].forEach(s => {
    document.getElementById(`wizard-step-${s}`).classList.add('hidden');
  });
  document.getElementById(`wizard-step-${step}`).classList.remove('hidden');

  const stepBar = document.getElementById('booking-step-bar');
  if (step === 1) {
    stepBar.classList.add('hidden');
  } else {
    stepBar.classList.remove('hidden');
    [2, 3, 4].forEach(tab => {
      const el = document.getElementById(`step-tab-${tab}`);
      if (tab === step) {
        el.className = 'py-3 bg-white text-slate-950 font-extrabold cursor-pointer transition';
      } else if (tab < step) {
        el.className = 'py-3 bg-zinc-800 text-amber-400 font-bold cursor-pointer transition';
      } else {
        el.className = 'py-3 bg-zinc-900 text-zinc-500 transition';
      }
    });
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// STEP 1: แสดงตารางโปสเตอร์หนัง 10 เรื่องแบบ Major Cineplex
function renderMoviesGrid() {
  const grid = document.getElementById('movie-poster-grid');
  grid.innerHTML = allMoviesData.map(m => {
    const imgUrl = MOVIE_POSTERS[m.movie_id] || MOVIE_POSTERS[1];
    return `
      <div onclick="openMovieShowtimes(${m.movie_id})" class="group cursor-pointer space-y-2.5">
        <div class="relative rounded-xl overflow-hidden border border-zinc-800 group-hover:border-amber-400 transition shadow-lg">
          <img src="${imgUrl}" alt="${m.title}" class="w-full h-72 object-cover group-hover:scale-105 transition duration-300" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition flex items-end p-3">
            <span class="w-full text-center bg-amber-500 text-slate-950 font-bold text-xs py-2 rounded-lg">เลือกรอบฉาย</span>
          </div>
        </div>
        <div class="space-y-1">
          <div class="text-[11px] font-bold text-amber-400 tracking-wider uppercase">${m.release_date || '16 NOV 2026'}</div>
          <h3 class="font-bold text-sm text-white group-hover:text-amber-400 transition line-clamp-1">${m.title}</h3>
          <div class="flex items-center gap-1.5 pt-0.5">
            <span class="bg-zinc-800 text-zinc-300 text-[10px] px-2 py-0.5 rounded-full">${m.age_rating || 'PG-13'}</span>
            <span class="bg-zinc-800 text-zinc-300 text-[10px] px-2 py-0.5 rounded-full">${m.duration_min} นาที</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// STEP 2: เปิดหน้ารอบฉายของหนังเรื่องที่กด
function openMovieShowtimes(movieId) {
  selectedMovieObj = allMoviesData.find(m => m.movie_id === movieId);
  if (!selectedMovieObj) return;

  const imgUrl = MOVIE_POSTERS[movieId] || MOVIE_POSTERS[1];
  document.getElementById('step2-poster').src = imgUrl;
  document.getElementById('step2-release').textContent = selectedMovieObj.release_date || '16 November 2026';
  document.getElementById('step2-title').textContent = selectedMovieObj.title;
  document.getElementById('step2-rating').textContent = selectedMovieObj.age_rating || 'PG-13';
  document.getElementById('step2-duration').textContent = `🕒 ${selectedMovieObj.duration_min} นาที`;

  const movieShowtimes = showtimesData.filter(s => s.movie_id === movieId);
  const dates = [...new Set(movieShowtimes.map(s => s.show_date))];
  selectedDate = dates[0] || null;

  renderDateAndSlots(movieId);
  goToStep(2);
}

function renderDateAndSlots(movieId) {
  // 1. สร้างวันที่เรียงต่อกัน 7 วัน (21 - 27 พ.ย. 2026) ไม่ข้ามวัน
  const consecutiveDates = [
    { date: '2026-11-21', dayName: 'SAT', dayNum: '21' },
    { date: '2026-11-22', dayName: 'SUN', dayNum: '22' },
    { date: '2026-11-23', dayName: 'MON', dayNum: '23' },
    { date: '2026-11-24', dayName: 'TUE', dayNum: '24' },
    { date: '2026-11-25', dayName: 'WED', dayNum: '25' },
    { date: '2026-11-26', dayName: 'THU', dayNum: '26' },
    { date: '2026-11-27', dayName: 'FRI', dayNum: '27' }
  ];

  if (!selectedDate || !consecutiveDates.some(d => d.date === selectedDate)) {
    selectedDate = consecutiveDates[0].date;
  }

  // วาดปุ่มวันที่เรียงต่อกัน 21, 22, 23, 24, 25, 26, 27
  const dateContainer = document.getElementById('date-pills-container');
  dateContainer.innerHTML = consecutiveDates.map(d => {
    const active = d.date === selectedDate;
    return `
      <button type="button" onclick="changeShowDate(${movieId}, '${d.date}')"
        class="w-16 h-16 shrink-0 rounded-xl border flex flex-col items-center justify-center transition cursor-pointer ${active ? 'bg-zinc-900 border-amber-400 text-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.3)]' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-600'}">
        <span class="text-[10px] font-semibold uppercase">${d.dayName}</span>
        <span class="text-lg font-extrabold">${d.dayNum}</span>
      </button>
    `;
  }).join('');

  // 2. กำหนด 3 โรงภาพยนตร์ต่อวัน และสุ่มรอบฉายโรงละ 1-3 รอบเวลา
  const halls = [
    { id: 1, name: 'THEATRE 1 (IMAX LASER)', sound: 'EN/TH' },
    { id: 2, name: 'THEATRE 2 (4DX)', sound: 'TH' },
    { id: 3, name: 'THEATRE 3 (STANDARD)', sound: 'EN/TH' }
  ];
  const timePools = [
    ['11:00', '14:30', '18:10'],
    ['12:15', '16:00'],
    ['13:30', '17:45', '21:15'],
    ['15:20'],
    ['10:45', '19:30', '22:10']
  ];

  // ดึง showtime_id จริงจากฐานข้อมูลมาผูกไว้เพื่อให้บันทึกลง DB ได้ไม่ติด Foreign Key
  const dbShowtimeId = showtimesData.find(s => s.movie_id === movieId)?.showtime_id || showtimesData[0]?.showtime_id || 1;

  document.getElementById('showtime-slots-container').innerHTML = halls.map((hall, idx) => {
    // สุ่มจำนวนรอบ 1-3 รอบต่อโรง (อิงตามวันและโรงเพื่อความสมจริง)
    const poolIndex = (movieId + idx + parseInt(selectedDate.slice(-2))) % timePools.length;
    const count = ((movieId + hall.id + parseInt(selectedDate.slice(-1))) % 3) + 1; // ได้ค่า 1, 2 หรือ 3 รอบ
    const times = timePools[poolIndex].slice(0, count);

    return `
      <div class="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-3">
        <div class="flex items-center gap-3 text-xs">
          <span class="font-extrabold text-sm text-white uppercase tracking-wider">${hall.name}</span>
          <span class="text-zinc-500">|</span>
          <span class="text-zinc-300">🔊 ${hall.sound}</span>
          <span class="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">${selectedMovieObj.age_rating || 'PG-13'}</span>
        </div>
        <div class="flex flex-wrap gap-3 pt-1">
          ${times.map(t => `
            <button type="button" onclick="openCustomSeatSelection(${dbShowtimeId}, '${hall.name}', '${selectedDate}', '${t}')"
              class="bg-white hover:bg-amber-400 text-slate-950 font-extrabold px-6 py-2.5 rounded-lg text-sm transition cursor-pointer shadow">
              ${t}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// ฟังก์ชันรับค่าโรง วันที่ และเวลาที่กดเลือก ส่งต่อไปหน้าเลือกที่นั่ง (Step 3)
function openCustomSeatSelection(showtimeId, hallName, showDate, startTime) {
  selectedShowtimeObj = {
    showtime_id: showtimeId,
    show_date: showDate,
    start_time: startTime,
    cinema_halls: { name: hallName }
  };
  selectedSeats = [];

  const imgUrl = MOVIE_POSTERS[selectedMovieObj.movie_id] || MOVIE_POSTERS[1];
  document.getElementById('step3-poster').src = imgUrl;
  document.getElementById('step3-title').textContent = selectedMovieObj.title;
  document.getElementById('step3-duration').textContent = `🕒 ${selectedMovieObj.duration_min} นาที`;
  document.getElementById('step3-rating').textContent = selectedMovieObj.age_rating || 'PG-13';
  document.getElementById('step3-date').textContent = showDate;
  document.getElementById('step3-hall').textContent = hallName;
  document.getElementById('step3-time').textContent = startTime;

  renderMajorSeatMap();
  updateStep3Summary();
  goToStep(3);
}

function changeShowDate(movieId, d) {
  selectedDate = d;
  renderDateAndSlots(movieId);
}

// STEP 3: เปิดหน้าเลือกที่นั่ง (Seat Map เต็มจอ + Summary ด้านขวา)
function openSeatSelection(showtimeId) {
  selectedShowtimeObj = showtimesData.find(s => s.showtime_id === showtimeId);
  selectedSeats = [];

  const imgUrl = MOVIE_POSTERS[selectedMovieObj.movie_id] || MOVIE_POSTERS[1];
  document.getElementById('step3-poster').src = imgUrl;
  document.getElementById('step3-title').textContent = selectedMovieObj.title;
  document.getElementById('step3-duration').textContent = `🕒 ${selectedMovieObj.duration_min} นาที`;
  document.getElementById('step3-rating').textContent = selectedMovieObj.age_rating || 'PG-13';
  document.getElementById('step3-date').textContent = selectedShowtimeObj.show_date;
  document.getElementById('step3-hall').textContent = selectedShowtimeObj.cinema_halls?.name || 'Theatre 1';
  document.getElementById('step3-time').textContent = selectedShowtimeObj.start_time.slice(0, 5);

  renderMajorSeatMap();
  updateStep3Summary();
  goToStep(3);
}

function renderMajorSeatMap() {
  const rows = ['H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];
  const cols = 14;
  // ที่นั่งที่ถูกจองแล้วจำลองให้เหมือนในภาพ
  const occupiedSeats = ['E10', 'E11', 'E12', 'C6', 'C7'];

  document.getElementById('seat-map-grid').innerHTML = rows.map(row => {
    const isPremium = ['H', 'G', 'F'].includes(row);
    const price = isPremium ? 340 : 260;
    const type = isPremium ? 'Premium' : 'Normal';

    let rowHtml = `<div class="flex items-center justify-between gap-2">
      <span class="w-5 text-xs font-bold text-zinc-400 text-center">${row}</span>
      <div class="flex gap-1.5 justify-center flex-1">`;

    for (let c = 1; c <= cols; c++) {
      const code = `${row}${c}`;
      const isOccupied = occupiedSeats.includes(code);
      const isPicked = selectedSeats.some(s => s.code === code);

      if (isOccupied) {
        rowHtml += `<div class="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-600 text-zinc-400 text-[10px] flex items-center justify-center cursor-not-allowed" title="ไม่ว่าง">👤</div>`;
      } else if (isPicked) {
        rowHtml += `<button type="button" onclick="toggleMajorSeat('${code}', '${type}', ${price})"
          class="w-6 h-6 rounded-full bg-[#d4af37] text-slate-950 font-black text-xs flex items-center justify-center shadow ring-2 ring-white cursor-pointer" title="${code} (${price}฿)">✓</button>`;
      } else {
        rowHtml += `<button type="button" onclick="toggleMajorSeat('${code}', '${type}', ${price})"
          class="w-6 h-6 rounded-t-md ${isPremium ? 'bg-amber-600/80 hover:bg-amber-400' : 'bg-red-700 hover:bg-red-500'} text-white text-[9px] font-bold flex items-center justify-center transition cursor-pointer" title="${code} - ${type} (${price}฿)">💺</button>`;
      }
    }

    rowHtml += `</div><span class="w-5 text-xs font-bold text-zinc-400 text-center">${row}</span></div>`;
    return rowHtml;
  }).join('');
}

function toggleMajorSeat(code, type, price) {
  const idx = selectedSeats.findIndex(s => s.code === code);
  if (idx >= 0) selectedSeats.splice(idx, 1);
  else selectedSeats.push({ code, type, price });

  renderMajorSeatMap();
  updateStep3Summary();
}

function updateStep3Summary() {
  const seatNames = selectedSeats.map(s => s.code).join(', ');
  const total = selectedSeats.reduce((sum, s) => sum + s.price, 0);
  document.getElementById('step3-seats').textContent = seatNames || '-';
  document.getElementById('step3-price').textContent = total.toLocaleString();
}

// STEP 4: กดปุ่ม "ซื้อตั๋ว" -> ไปหน้าโปรโมชั่นคูปองแต้มห้าง & ป๊อปคอร์น
function proceedToCheckout() {
  if (selectedSeats.length === 0) {
    alert('กรุณาคลิกเลือกที่นั่งบนผังโรงภาพยนตร์อย่างน้อย 1 ที่นั่งก่อนครับ');
    return;
  }
  calculateFinalCheckout();
  goToStep(4);
}

function calculateFinalCheckout() {
  const seatTotal = selectedSeats.reduce((sum, s) => sum + s.price, 0);
  const ccSelect = document.getElementById('book-concession');
  const cpSelect = document.getElementById('book-coupon');

  const snackPrice = Number(ccSelect.options[ccSelect.selectedIndex]?.dataset.price || 0);
  const discount = Number(cpSelect.options[cpSelect.selectedIndex]?.dataset.discount || 0);
  const finalAmount = Math.max(0, (seatTotal + snackPrice) - discount);

  document.getElementById('step4-seat-list').textContent = selectedSeats.map(s => s.code).join(', ');
  document.getElementById('calc-seat-price').textContent = seatTotal;
  document.getElementById('calc-snack-price').textContent = snackPrice;
  document.getElementById('calc-discount').textContent = discount;
  document.getElementById('calc-final').textContent = finalAmount;
}

// บันทึกการจองลง Supabase และเปิด Popup E-Ticket
async function submitUserBooking(e) {
  e.preventDefault();
  const seatTotal = Number(document.getElementById('calc-seat-price').textContent);
  const snackPrice = Number(document.getElementById('calc-snack-price').textContent);
  const discount = Number(document.getElementById('calc-discount').textContent);
  const finalAmount = Number(document.getElementById('calc-final').textContent);

  const { data, error } = await supabaseClient.from('cinema_bookings').insert([{
    customer_id: 1,
    status: 'CONFIRMED',
    original_amount: seatTotal + snackPrice,
    discount_amount: discount,
    final_amount: finalAmount
  }]).select();

  if (error) {
    alert('เกิดข้อผิดพลาด: ' + error.message);
    return;
  }

  // ใส่ข้อมูลครบทุกช่องลงหน้าตั๋วหนัง E-Ticket (โปสเตอร์, หนัง, วันที่, เวลา, โรง, ที่นั่ง, ยอดเงิน)
  const imgUrl = MOVIE_POSTERS[selectedMovieObj?.movie_id] || MOVIE_POSTERS[1];
  document.getElementById('ticket-poster').src = imgUrl;
  document.getElementById('ticket-movie').textContent = selectedMovieObj?.title || 'Movie Ticket';
  document.getElementById('ticket-date').textContent = selectedShowtimeObj?.show_date || '-';
  document.getElementById('ticket-time').textContent = `${selectedShowtimeObj?.start_time || '-'} น.`;
  document.getElementById('ticket-hall').textContent = selectedShowtimeObj?.cinema_halls?.name || 'Theatre 1';
  document.getElementById('ticket-seats').textContent = selectedSeats.map(s => s.code).join(', ');
  document.getElementById('ticket-total').textContent = `${finalAmount} THB`;
  document.getElementById('ticket-id').textContent = data?.[0]?.booking_id || 'NEW';

  // เปิดหน้าตั๋วหนังขึ้นมาโชว์
  document.getElementById('eticket-modal').classList.remove('hidden');
  loadBookingHistory();
}

function closeTicketModal() {
  document.getElementById('eticket-modal').classList.add('hidden');
  goToStep(1); // กลับสู่หน้ารวมภาพยนตร์ 10 เรื่อง
}

async function loadBookingHistory() {
  const { data: bookings } = await supabaseClient
    .from('cinema_bookings')
    .select('*')
    .order('booking_id', { ascending: false })
    .limit(6);

  const listDiv = document.getElementById('user-bookings-list');
  if (!bookings || bookings.length === 0) {
    listDiv.innerHTML = '<p class="text-zinc-400">ยังไม่มีประวัติการจอง</p>';
    return;
  }
  listDiv.innerHTML = bookings.map(b => `
    <div class="p-3 border border-zinc-800 rounded-xl bg-zinc-950 flex justify-between items-center">
      <div>
        <div class="font-bold text-white">E-Ticket #${b.booking_id} <span class="text-emerald-400">[${b.status}]</span></div>
        <div class="text-zinc-400">เต็ม ${b.original_amount}฿ • ลด ${b.discount_amount}฿</div>
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