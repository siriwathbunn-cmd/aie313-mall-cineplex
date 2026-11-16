import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const SYSTEM_PROMPT = `
คุณคือ AI Command & Data Assistant ของระบบ Integrated Mall & Cineplex Complex
วิเคราะห์ข้อความของผู้ใช้แล้วตอบกลับเป็น JSON เท่านั้น (ห้ามใส่ markdown \`\`\`json) ตามรูปแบบใดรูปแบบหนึ่งด้านล่าง:

กรณีที่ 1: ผู้ใช้ต้องการ "สั่งการ / ทำรายการ" (Action Command)
- ยกเลิกการจองตั๋ว (เช่น "ยกเลิกการจอง", "ขอยกเลิก booking ล่าสุด", "ยกเลิกการจองรหัส 5"):
  {"type": "ACTION", "action": "CANCEL_BOOKING", "booking_id": <ตัวเลข ID หรือ null ถ้าไม่ระบุให้เอาล่าสุด>, "reply": "<ข้อความยืนยันกำลังดำเนินการ>"}
- จองตั๋วหนังด่วน (เช่น "จองตั๋วเรื่อง Dune", "จองหนัง Interstellar"):
  {"type": "ACTION", "action": "QUICK_BOOK", "movie_keyword": "<ชื่อหนัง>", "reply": "<ข้อความยืนยันการจอง>"}

กรณีที่ 2: ผู้ใช้ต้องการ "ค้นหา / สอบถามข้อมูล / ดูสถิติ" (Query)
  {"type": "QUERY", "sql": "<คำสั่ง PostgreSQL SELECT เพียวๆ 1 คำสั่ง>"}

โครงสร้างตารางและ Views สำหรับสร้าง SQL:
- customer_profiles (customer_id, full_name, email, tier_id, current_points, total_lifetime_spend)
- membership_tiers (tier_id, tier_name, point_multiplier, free_parking_hours)
- mall_stores (store_id, zone_id, category_id, store_number, name, floor_level)
- store_products (product_id, store_id, product_code, name, price)
- store_receipts (receipt_id, customer_id, store_id, receipt_number, total_spend, points_earned, purchase_date)
- mall_campaigns (campaign_id, title, points_required, discount_value, min_spend_required)
- customer_coupons (coupon_id, campaign_id, customer_id, coupon_code, is_used, expires_at)
- movies (movie_id, title, duration_min, release_date, age_rating)
- cinema_halls (hall_id, name, hall_type, total_seats)
- showtimes (showtime_id, movie_id, hall_id, show_date, start_time, base_price)
- cinema_bookings (booking_id, customer_id, booking_date, status, original_amount, discount_amount, final_amount)
- booking_tickets (ticket_id, booking_id, showtime_id, seat_id, price)
- concession_items (item_id, name, category, price)
- v_customer_tier_overview, v_store_performance_summary, v_movie_box_office_summary, v_cross_campaign_redemptions, v_concession_sales_ranking
`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { question, customer_id = 1 } = req.body;
  if (!question) return res.status(400).json({ error: 'กรุณาระบุคำสั่งหรือคำถาม' });

  try {
    // 1. ให้ Gemini วิเคราะห์ Intent (Action หรือ Query)
    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\nข้อความผู้ใช้: "${question}"` }] }],
          generationConfig: { temperature: 0.1 }
        })
      }
    );

    const aiJson = await aiRes.json();
    let rawText = aiJson?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    rawText = rawText.replace(/```json|```/gi, '').trim();
    const intent = JSON.parse(rawText);

    // ====================================================
    // MODE A: สั่งการแก้ไขฐานข้อมูลอัตโนมัติ (AI Command)
    // ====================================================
    if (intent.type === 'ACTION') {
      if (intent.action === 'CANCEL_BOOKING') {
        let targetId = intent.booking_id;
        if (!targetId) {
          const { data: latest } = await supabase
            .from('cinema_bookings')
            .select('booking_id')
            .eq('customer_id', customer_id)
            .eq('status', 'CONFIRMED')
            .order('booking_id', { ascending: false })
            .limit(1)
            .single();
          targetId = latest?.booking_id;
        }

        if (!targetId) {
          return res.status(200).json({
            answer: 'ไม่พบรายการจองที่สถานะ CONFIRMED ของคุณในระบบครับ',
            sql: '-- No active booking found to cancel',
            data: []
          });
        }

        const executedSql = `UPDATE cinema_bookings SET status = 'CANCELLED' WHERE booking_id = ${targetId};`;
        const { data: updated, error } = await supabase
          .from('cinema_bookings')
          .update({ status: 'CANCELLED' })
          .eq('booking_id', targetId)
          .select();

        if (error) throw new Error(error.message);

        await supabase.from('chat_logs').insert({
          customer_id,
          question,
          generated_sql: executedSql,
          response_summary: `ยกเลิกการจองรหัส #${targetId} เรียบร้อยแล้ว`
        });

        return res.status(200).json({
          answer: `✅ ดำเนินการยกเลิกการจองรหัส #${targetId} ในฐานข้อมูลเรียบร้อยแล้วครับ`,
          sql: executedSql,
          data: updated,
          refreshNeeded: true
        });
      }

      if (intent.action === 'QUICK_BOOK') {
        const { data: show } = await supabase
          .from('showtimes')
          .select('showtime_id, base_price, show_date, start_time, movies!inner(title)')
          .ilike('movies.title', `%${intent.movie_keyword}%`)
          .limit(1)
          .single();

        if (!show) {
          return res.status(200).json({
            answer: `ไม่พบรอบฉายของภาพยนตร์ที่ตรงกับคำว่า "${intent.movie_keyword}" ครับ`,
            sql: `SELECT * FROM showtimes JOIN movies ON ... WHERE title ILIKE '%${intent.movie_keyword}%'`,
            data: []
          });
        }

        const executedSql = `INSERT INTO cinema_bookings (customer_id, status, original_amount, discount_amount, final_amount) VALUES (${customer_id}, 'CONFIRMED', ${show.base_price}, 0, ${show.base_price});`;
        const { data: newBooking, error } = await supabase
          .from('cinema_bookings')
          .insert([{
            customer_id,
            status: 'CONFIRMED',
            original_amount: show.base_price,
            discount_amount: 0,
            final_amount: show.base_price
          }])
          .select();

        if (error) throw new Error(error.message);

        await supabase.from('chat_logs').insert({
          customer_id,
          question,
          generated_sql: executedSql,
          response_summary: `จองตั๋วเรื่อง ${show.movies.title} สำเร็จ`
        });

        return res.status(200).json({
          answer: `🎟️ จองตั๋วเรื่อง "${show.movies.title}" (รอบวันที่ ${show.show_date} เวลา ${show.start_time}) ราคา ${show.base_price} บาท สำเร็จแล้วครับ!`,
          sql: executedSql,
          data: newBooking,
          refreshNeeded: true
        });
      }
    }

    // ====================================================
    // MODE B: ค้นหาและวิเคราะห์ข้อมูล (Text-to-SQL Query)
    // ====================================================
    const generatedSql = intent.sql;
    const { data: rawData, error: sqlError } = await supabase.rpc('execute_readonly_sql', {
      query_text: generatedSql
    });

    if (sqlError) throw new Error(`SQL Error: ${sqlError.message}`);

    const summaryRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{
              text: `คำถามผู้ใช้: "${question}"\nข้อมูลจริงจากฐานข้อมูล: ${JSON.stringify(rawData)}\nจงสรุปคำตอบภาษาไทยให้กระชับและตรงตามข้อมูลจริงเท่านั้น`
            }]
          }]
        })
      }
    );

    const summaryJson = await summaryRes.json();
    const answerText = summaryJson?.candidates?.[0]?.content?.parts?.[0]?.text || 'พบข้อมูลตามตารางด้านล่างครับ';

    await supabase.from('chat_logs').insert({
      customer_id,
      question,
      generated_sql: generatedSql,
      response_summary: answerText
    });

    return res.status(200).json({
      answer: answerText,
      sql: generatedSql,
      data: rawData
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}