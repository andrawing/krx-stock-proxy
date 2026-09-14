const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const KRX_AUTH_KEY = process.env.KRX_AUTH_KEY || "8F1584A569A643DF870628454A90A69CB427A2CB";

  let historyData = []; // 그래프용 7일치 데이터 배열
  let latestStock = null;
  let fetchedDateStr = "";

  // 최근 12일간을 조회하여 주말/공휴일을 제외한 7영업일 데이터 수집
  for (let daysAgo = 0; daysAgo < 12; daysAgo++) {
    if (historyData.length >= 7) break;

    let checkDate = new Date();
    checkDate.setDate(checkDate.getDate() - daysAgo);

    if (checkDate.getDay() === 0 || checkDate.getDay() === 6) continue;

    const dateStr = checkDate.toISOString().slice(0, 10).replace(/-/g, "");

    try {
      const url = `https://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd?basDd=${dateStr}`;
      const krxResponse = await fetch(url, {
        method: "GET",
        headers: { "AUTH_KEY": KRX_AUTH_KEY }
      });

      const result = await krxResponse.json();
      const items = result?.OutBlock_1 || [];

      if (Array.isArray(items) && items.length > 0) {
        const target = items.find(item => {
          const code = String(item.ISU_CD || '');
          const name = String(item.ISU_NM || '');
          return code.includes("004090") || name.includes("한국석유");
        });

        if (target) {
          if (!latestStock) {
            latestStock = target;
            fetchedDateStr = dateStr;
          }
          historyData.unshift({
            date: `${dateStr.slice(4,6)}/${dateStr.slice(6,8)}`,
            price: Number(target.TDD_CLSPRC || 0)
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  return res.status(200).json({
    success: latestStock ? true : false,
    date: fetchedDateStr,
    data: latestStock || null,
    history: historyData // 7일간의 날짜/종가 데이터
  });
};




