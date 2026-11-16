import { createClient } from '@supabase/supabase-js';

// ดึงค่าจาก Environment Variables บน Vercel (ปลอดภัย ไม่หลุดใน GitHub)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// สรุป Schema และ Views ให้ LLM รู้จักโครงสร้างตารางจริงของเรา
const DB_SCHEMA_CONTEXT = `
คุณคือผู้เชี่ยวชาญ PostgreSQL สำหรับระบบ Mall & Cineplex Complex
จงแปลงคำถามผู้ใช้เป็นคำสั่ง PostgreSQL SELECT ที่ถูกต้องเพียง 1 คำสั่งเท่านั้น (ห้ามใส่ markdown \`\`\`sql หรือคำอธิบายใดๆ ตอบกลับเฉพาะตัว SQL เพียวๆ)

ตารางหลัก:
- membership_tiers (tier_id, tier_name, min_accumulated_spend, point_multiplier, free_parking_hours)
- customer_profiles (customer_id, full_name, email, phone, tier_id, current_points, total_lifetime_spend)
- mall_zones (zone_id, zone_code, zone_name, floor_level)
- store_categories (category_id, name, point_rate_multiplier)
- mall_stores (store_id, zone_id, category_id, store_number, name, floor_level, is_active)
- store_products (product_id, store_id, product_code, name, price, is_available)
- store_receipts (receipt_id, customer_id, store_id, receipt_number, total_spend, points_earned, purchase_date)
- mall_campaigns (campaign_id, title, campaign_type, points_required, discount_value, min_spend_required, start_date, end_date)
- customer_coupons (coupon_id, campaign_id, customer_id, coupon_code, is_used, redeemed_with_points, expires_at)
- parking_records (parking_id, license_plate, customer_id, entry_time, exit_time, total_hours, standard_fee, validated_discount, net_fee)
- movies (movie_id, title, duration_min, release_date, age_rating)
- genres (genre_id, name)
- movie_genres (movie_id, genre_id)
- cinema_halls (hall_id, name, hall_type, total_seats)
- hall_seats (seat_id, hall_id, seat_number, seat_type, surcharge)
- showtimes (showtime_id, movie_id, hall_id, show_date, start_time, base_price)
- cinema_bookings (booking_id, customer_id, booking_date, status, original_amount, discount_amount, final_amount)
- booking_tickets (ticket_id, booking_id, showtime_id, seat_id, price)
- concession_items (item_id, name, category, price)
- concession_orders (order_id, booking_id, ordered_at, total_amount)
- cinema_redemptions (redemption_id, booking_id, coupon_id, discount_applied, redeemed_at)

Views สำเร็จรูป (แนะนำให้ใช้เมื่อตรงกับคำถาม):
- v_customer_tier_overview (customer_id, full_name, email, tier_name, point_multiplier, free_parking_hours, current_points, total_lifetime_spend, total_mall_visits, actual_mall_spend)
- v_store_performance_summary (store_id, store_number, store_name, zone_name, category_name, receipt_count, total_revenue, avg_spend_per_receipt)
- v_movie_box_office_summary (movie_id, movie_title, age_rating, total_showtimes, tickets_sold, total_ticket_revenue, avg_ticket_price)
- v_cross_campaign_redemptions (campaign_id, campaign_title, points_required, discount_value, total_redeemed, total_discount_given, avg_booking_final_amount)
- v_parking_validation_report (parking_id, license_plate, customer_name, tier_name, total_hours, standard_fee, validated_discount, net_fee, receipt_number, receipt_spend)
- v_concession_sales_ranking (item_id, item_name, category, current_price, total_quantity_sold, total_concession_revenue)

ข้อกำหนด:
1. ใช้ ILIKE '%keyword%' เมื่อค้นหาชื่อข้อความภาษาไทยหรืออังกฤษ
2. ห้ามใช้คำสั่งแก้ไขข้อมูลเด็ดขาด ต้องเป็น SELECT เท่านั้น
`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { question, customer_id } = req.body;
  if (!question) {
    return res.status(400).json({ error: 'กรุณาระบุคำถาม' });
  }

  try {
    // 1. ส่งคำถามให้ Gemini แปลงเป็น SQL
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${DB_SCHEMA_CONTEXT}\n\nคำถามจากผู้ใช้: "${question}"` }]
            }
          ],
          generationConfig: { temperature: 0.1 }
        })
      }
    );

    const geminiData = await geminiResponse.json();
    let generatedSql = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    generatedSql = generatedSql.replace(/```sql|```/gi, '').trim();

    // 2. รัน SQL บน Supabase ผ่านฟังก์ชัน Read-Only RPC
    const { data: rawData, error: sqlError } = await supabase.rpc('execute_readonly_sql', {
      query_text: generatedSql
    });

    if (sqlError) {
      throw new Error(`SQL Error: ${sqlError.message}`);
    }

    // 3. ให้ Gemini สรุปคำตอบภาษาธรรมชาติจากผลลัพธ์จริง (Raw Data)
    const summaryResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{
                text: `คำถามผู้ใช้: "${question}"\nข้อมูลจริงจากฐานข้อมูล: ${JSON.stringify(rawData)}\n\nจงสรุปคำตอบเป็นภาษาไทยที่สุภาพ กระชับ และตรงตามข้อมูลจริงด้านบนเท่านั้น (ห้ามเดาข้อมูลที่ไม่มีในผลลัพธ์)`
              }]
            }
          ]
        })
      }
    );

    const summaryData = await summaryResponse.json();
    const answerText = summaryData?.candidates?.[0]?.content?.parts?.[0]?.text || 'พบข้อมูลตามตารางด้านล่างครับ';

    // 4. บันทึกประวัติแชทลงตาราง chat_logs (เงื่อนไข Bonus 5 คะแนน)
    await supabase.from('chat_logs').insert({
      customer_id: customer_id || null,
      question: question,
      generated_sql: generatedSql,
      response_summary: answerText
    });

    // 5. ส่งผลลัพธ์และหลักฐานกลับไปแสดงบนหน้าเว็บ
    return res.status(200).json({
      answer: answerText,
      sql: generatedSql,
      data: rawData
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}