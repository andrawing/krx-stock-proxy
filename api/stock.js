module.exports = async (req, res) => {
  // CORS 처리 및 Vercel Edge Cache 설정 (5분간 응답 보존으로 속도 최적화)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const KRX_AUTH_KEY = process.env.KRX_AUTH_KEY || "8F1584A569A643DF870628454A90A69CB427A2CB";

  // 한국 시간(KST) 구하기
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kst = new Date(utc + (3600000 * 9));

  // 무조건 '어제(전일)' 기준 날짜부터 탐색 시작하여 시세 수치 핑퐁 현상 방지
  kst.setDate(kst.getDate() - 1);

  let targetStock = null;
  let fetchedDateStr = "";

  // 어제부터 역순으로 최근 4일간 영업일 데이터 탐색
  for (let i = 0; i < 4; i++) {
    if (kst.getDay() === 0) kst.setDate(kst.getDate() - 2); // 일요일 -> 금요일
    else if (kst.getDay() === 6) kst.setDate(kst.getDate() - 1); // 토요일 -> 금요일

    const dateStr = kst.toISOString().slice(0, 10).replace(/-/g, "");

    try {
      const krxResponse = await fetch("https://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd", {
        method: "POST",
        headers: {
          "AUTH_KEY": KRX_AUTH_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ basDd: dateStr })
      });

      const result = await krxResponse.json();
      const items = result?.OutBlock_1 || [];

      if (Array.isArray(items) && items.length > 0) {
        targetStock = items.find(item => {
          const code = String(item.ISU_CD || '');
          const name = String(item.ISU_NM || '');
          return code.includes("004090") || name.includes("한국석유");
        });

        if (targetStock) {
          fetchedDateStr = dateStr;
          break; // 확정 데이터를 찾았으므로 루프 종료
        }
      }
    } catch (e) {
      console.error(e);
    }

    kst.setDate(kst.getDate() - 1);
  }

  return res.status(200).json({
    success: targetStock ? true : false,
    date: fetchedDateStr,
    data: targetStock || null
  });
};
