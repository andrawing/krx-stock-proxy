const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // 1. 아임웹(브라우저)에서 들어오는 CORS 요청 전면 허용
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. 전달받은 한국거래소(KRX) AUTH_KEY 입력
  const KRX_AUTH_KEY = process.env.KRX_AUTH_KEY || "8F1584A569A643DF870628454A90A69CB427A2CB";

  // 3. 최근 영업일 날짜 생성 (YYYYMMDD)
  const today = new Date();
  if (today.getDay() === 0) today.setDate(today.getDate() - 2); // 일요일 -> 금요일
  else if (today.getDay() === 6) today.setDate(today.getDate() - 1); // 토요일 -> 금요일
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");

  try {
    // 4. 서버 대 서버 통신으로 KRX API 호출 (CORS 영향 없음)
    const krxResponse = await fetch("https://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd", {
      method: "POST",
      headers: {
        "AUTH_KEY": KRX_AUTH_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ basDd: dateStr })
    });

    const result = await krxResponse.json();

    // 5. 전체 데이터 중 '한국석유(004090)' 데이터만 추출하여 응답
    if (result && result.OutBlock_1) {
      const targetStock = result.OutBlock_1.find(
        item => item.ISU_CD?.includes("004090") || item.ISU_NM?.includes("한국석유")
      );
      
      return res.status(200).json({
        success: true,
        data: targetStock || null
      });
    }

    return res.status(200).json({ success: false, message: "데이터 없음" });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};