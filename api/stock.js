// node-fetch require 제거 (Node 18+ 내장 fetch 사용으로 속도 최적화)

module.exports = async (req, res) => {
  // CORS 및 60초 캐싱 (Vercel Edge Caching 적용)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const KRX_AUTH_KEY = process.env.KRX_AUTH_KEY || "8F1584A569A643DF870628454A90A69CB427A2CB";

  // 한국 시간(KST) 구하기
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kst = new Date(utc + (3600000 * 9));

  // 오늘 오전 9시 이전이면 어제 날짜로 기준일 세팅 (KRX 장전 데이터 미생성 방지)
  if (kst.getHours() < 9) {
    kst.setDate(kst.getDate() - 1);
  }

  let targetStock = null;
  let fetchedDateStr = "";

  // 최대 3번만 빠르게 탐색 (오늘 ➔ 어제 ➔ 그제)
  for (let i = 0; i < 3; i++) {
    if (kst.getDay() === 0) kst.setDate(kst.getDate() - 2); // 일 ➔ 금
    else if (kst.getDay() === 6) kst.setDate(kst.getDate() - 1); // 토 ➔ 금

    const dateStr = kst.toISOString().slice(0, 10).replace(/-/g, "");

    try {
      // POST 방식 호출 (KRX 규격상 응답속도가 더 안정적)
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
          break; // 데이터 찾으면 즉시 리턴하여 대기시간 단축
        }
      }
    } catch (e) {
      console.error(e);
    }

    // 데이터 없으면 하루 전으로 차감 후 재시도
    kst.setDate(kst.getDate() - 1);
  }

  return res.status(200).json({
    success: targetStock ? true : false,
    date: fetchedDateStr,
    data: targetStock || null
  });
};
