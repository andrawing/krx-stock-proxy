const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // 1. CORS 및 Vercel Edge 캐싱 설정 (60초간 응답 결과 기억 ➔ 속도 10배 상승)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const KRX_AUTH_KEY = process.env.KRX_AUTH_KEY || "8F1584A569A643DF870628454A90A69CB427A2CB";

  // 2. 한국 시간(KST) 기준 최신 영업일 계산 (루프 최소화)
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kst = new Date(utc + (3600000 * 9)); // KST (UTC+9)

  // 주말(토/일) 처리
  if (kst.getDay() === 0) kst.setDate(kst.getDate() - 2); // 일요일 ➔ 금요일
  else if (kst.getDay() === 6) kst.setDate(kst.getDate() - 1); // 토요일 ➔ 금요일

  const dateStr = kst.toISOString().slice(0, 10).replace(/-/g, "");

  try {
    // 3. 단 1회 직격 호출
    const url = `https://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd?basDd=${dateStr}`;
    const krxResponse = await fetch(url, {
      method: "GET",
      headers: { "AUTH_KEY": KRX_AUTH_KEY }
    });

    const result = await krxResponse.json();
    const items = result?.OutBlock_1 || [];

    let targetStock = items.find(item => {
      const code = String(item.ISU_CD || '');
      const name = String(item.ISU_NM || '');
      return code.includes("004090") || name.includes("한국석유");
    });

    return res.status(200).json({
      success: targetStock ? true : false,
      date: dateStr,
      data: targetStock || null
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
};



