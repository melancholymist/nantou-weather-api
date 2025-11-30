// 1. 載入套件
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const dotenv = require("dotenv");

// 讀取 .env 裡的變數
dotenv.config();


// 2. 建立 app
const app = express();

// 3. 因為Zeabur所以調整為 3000 port
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 4. 啟動時先印一行，確認真的是這一份在跑
console.log("✅ server.js 啟動中（使用 3000 port，有設定 CORS＋getAdvice）");

// 5. 每一個 request 都印出 method / url，方便你確認
app.use((req, res, next) => {
  console.log("👉 收到請求：", req.method, req.url);
  next();
});

// 6. 使用 cors 套件（開放所有來源）
app.use(cors());

// 7. 再手動加一次 CORS header（雙保險）
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

// 🔍 跟中央氣象署要「南投縣未來天氣」原始資料
async function fetchCwaNantou() {
  const baseUrl = "https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-D0047-023";
  const apiKey = process.env.CWA_API_KEY;

  if (!apiKey) {
    throw new Error("CWA_API_KEY 沒有設定，請在 .env 裡設定你的金鑰");
  }

  // 之後可以再加其他查詢參數，例如 locationId，不過先用最基本的
  const res = await axios.get(baseUrl, {
    params: {
      Authorization: apiKey,
      locationName: "埔里鎮"  // 📌 新增這一行：只取埔里的資料
    }
  });

  // 這裡先把重點資訊印出來，幫助你理解
  console.log("✅ 已從中央氣象署取得資料");
  console.log("  - success =", res.data.success);
  console.log("  - 有沒有 records =", !!res.data.records);

  return res.data; // 先原封不動回傳，之後再來做整理
}


// 8. 健康建議函式：根據當天溫度、濕度、降雨機率，給一句人話建議
function getAdvice(day) {
  const { tempMin, tempMax, rainProb, humidity } = day;
  const tempRange = tempMax - tempMin;

  // 1) 很高降雨機率，盡量少出門
  if (rainProb >= 90) {
    return "今天雨勢可能很大，能不出門就盡量在家休息，必要外出請帶雨具並注意地面濕滑。";
  }

  // 2) 濕冷：關節容易不舒服
  if (tempMax <= 20 && (humidity >= 80 || rainProb >= 60)) {
    return "天氣偏冷又潮濕，關節容易痠痛，出門請多加一件外套，注意膝蓋、腰部和肩頸保暖。";
  }

  // 3) 冷又乾：皮膚、呼吸道容易乾裂
  if (tempMax <= 18 && humidity <= 60) {
    return "天氣偏冷又乾燥，皮膚與嘴唇容易乾裂，建議擦乳液、多喝溫開水，外出可戴口罩或圍巾。";
  }

  // 4) 悶熱：高溫＋高濕，注意中暑與心血管負擔
  if (tempMax >= 30 && humidity >= 75) {
    return "天氣悶熱，請避免在中午高溫時段外出，多補充水分，保持室內通風，有心血管疾病者要特別留意不過度勞累。";
  }

  // 5) 日夜溫差大：最容易著涼
  if (tempRange >= 7) {
    return "早晚和白天溫差大，出門記得帶一件可以穿脫的外套，睡前也要注意肩頸、膝蓋與腰部保暖。";
  }

  // 6) 舒適天氣：鼓勵適度活動
  if (
    tempMax >= 20 &&
    tempMax <= 28 &&
    humidity >= 60 &&
    humidity <= 75 &&
    rainProb <= 40
  ) {
    return "天氣算舒適，適合在家附近散步、曬曬太陽、活動筋骨，但仍請依自己體力調整時間長短。";
  }

  // 7) 其他一般天氣：給中性提醒
  return "天氣普通，請依自己身體狀況安排活動，外出記得帶水與簡單保暖衣物，若感到不適請儘早休息。";
}

// 把中央氣象署的 JSON 轉成我們要的 3 天資料格式（F-D0047-023 專用）
function mapCwaToDays(data) {
  const records = data.records;
  if (!records) return [];

  // 外層：南投縣這一包
  const locationsWrapperList = records.Locations || records.locations || [];
  if (!Array.isArray(locationsWrapperList) || locationsWrapperList.length === 0) {
    return [];
  }

  const wrapper = locationsWrapperList[0]; // 南投縣
  const locationList = wrapper.Location || wrapper.location || [];
  if (!Array.isArray(locationList) || locationList.length === 0) {
    return [];
  }

  // 找「埔里鎮」，找不到先用第一個（目前 JSON 裡第一個是南投市）
  const puliLocation =
    locationList.find((loc) => {
      const name = loc.LocationName || loc.locationName;
      return name === "埔里鎮";
    }) || locationList[0];

  if (!puliLocation) return [];

  const weatherElements =
    puliLocation.WeatherElement || puliLocation.weatherElement || [];

  // 依 ElementName（中文）找各種要素
  const findElement = (name) =>
    weatherElements.find((el) => {
      const n = el.ElementName || el.elementName;
      return n === name;
    });

  const elMaxT = findElement("最高溫度");        // MaxTemperature
  const elMinT = findElement("最低溫度");        // MinTemperature
  const elRH = findElement("平均相對濕度");      // RelativeHumidity
  const elPoP12 = findElement("12小時降雨機率"); // ProbabilityOfPrecipitation
  const elWx = findElement("天氣現象");          // Weather

  const daysMap = {}; // 用 YYYY-MM-DD 當 key

  function ensureDay(date) {
    if (!daysMap[date]) {
      daysMap[date] = {
        date,
        tempMaxList: [],
        tempMinList: [],
        hums: [],
        rains: [],
        wxList: []
      };
    }
    return daysMap[date];
  }

  // 共用時間序列處理
  function processSeries(element, updater) {
    if (!element) return;
    const times = element.Time || element.time || [];
    times.forEach((t) => {
      const start = t.StartTime || t.startTime;
      if (!start) return;

      const date = String(start).slice(0, 10); // 取 YYYY-MM-DD
      const evArr = t.ElementValue || t.elementValue || [];
      if (!Array.isArray(evArr) || evArr.length === 0) return;

      const ev = evArr[0];
      if (!ev) return;

      const day = ensureDay(date);
      updater(day, ev);
    });
  }

  // 最高溫度
  processSeries(elMaxT, (day, ev) => {
    const n = parseFloat(ev.MaxTemperature);
    if (!Number.isNaN(n)) day.tempMaxList.push(n);
  });

  // 最低溫度
  processSeries(elMinT, (day, ev) => {
    const n = parseFloat(ev.MinTemperature);
    if (!Number.isNaN(n)) day.tempMinList.push(n);
  });

  // 平均相對濕度
  processSeries(elRH, (day, ev) => {
    const n = parseFloat(ev.RelativeHumidity);
    if (!Number.isNaN(n)) day.hums.push(n);
  });

  // 12 小時降雨機率（有 "-" 就跳過，取該日最大值）
  processSeries(elPoP12, (day, ev) => {
    const raw = ev.ProbabilityOfPrecipitation;
    if (raw === "-" || raw === undefined || raw === null || raw === "") return;
    const n = parseFloat(raw);
    if (!Number.isNaN(n)) day.rains.push(n);
  });

  // 天氣現象（文字）
  processSeries(elWx, (day, ev) => {
    const wx = ev.Weather || ev.weather;
    if (wx) day.wxList.push(String(wx));
  });

  // 變成陣列 + 依日期排序
  const dayArray = Object.values(daysMap).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // 取未來三天（從資料裡最早的那天開始算三天）
  const limited = dayArray.slice(0, 3);

  // 整理成前端要的格式
  const result = limited.map((d) => {
    // 溫度：用「最低溫度的最小值」、「最高溫度的最大值」
    let tempMin = null;
    let tempMax = null;

    if (d.tempMinList.length > 0) {
      tempMin = Math.min(...d.tempMinList);
    }
    if (d.tempMaxList.length > 0) {
      tempMax = Math.max(...d.tempMaxList);
    }

    // 如果只拿到一邊，就用另一邊兜湊一個範圍（避免全 null）
    if (tempMin === null && tempMax !== null) {
      tempMin = tempMax;
    }
    if (tempMax === null && tempMin !== null) {
      tempMax = tempMin;
    }

    const humidity =
      d.hums.length > 0
        ? Math.round(d.hums.reduce((sum, x) => sum + x, 0) / d.hums.length)
        : null;

    const rainProb =
      d.rains.length > 0 ? Math.round(Math.max(...d.rains)) : null;

    // summary：出現次數最多的天氣現象文字
    let summary = "";
    if (d.wxList.length > 0) {
      const freq = {};
      d.wxList.forEach((s) => {
        freq[s] = (freq[s] || 0) + 1;
      });
      summary = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
    }

    return {
      date: d.date,
      summary,   // e.g. "晴時多雲"
      tempMin,   // 最低溫
      tempMax,   // 最高溫
      rainProb,  // 最大降雨機率
      humidity   // 平均濕度
    };
  });

  return result;
}

// 9. 健康檢查 API
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// 🧪 Debug 用：觀察 CWA 回來的 JSON 結構（Locations → Location）
app.get("/api/debug/cwa-puli", async (req, res) => {
  try {
    const data = await fetchCwaNantou();

    const records = data.records;
    const locationsWrapper = records?.Locations || [];
    const firstWrapper = locationsWrapper[0] || null;   // 通常是一個「南投縣」級別
    const locationList = firstWrapper?.Location || [];  // 各鄉鎮市列表
    const firstLocation = locationList[0] || null;      // 第一個鄉鎮的詳細資料

    res.json({
      success: data.success,
      topKeys: Object.keys(data),                         // ["success", "result", "records"]
      recordsKeys: records ? Object.keys(records) : null, // ["Locations"]
      locationsWrapperCount: locationsWrapper.length,     // 通常是 1
      locationListCount: locationList.length,             // 這裡應該會是 13~30 之類的鄉鎮數量
      // 看看第一層包裝物（通常是縣級）的欄位
      firstWrapperKeys: firstWrapper ? Object.keys(firstWrapper) : null,
      // 看看第一個鄉鎮物件長什麼樣子
      firstLocationKeys: firstLocation ? Object.keys(firstLocation) : null,
      firstLocationName: firstLocation?.LocationName || firstLocation?.locationName || null
    });
  } catch (err) {
    console.error("❌ 讀取 CWA API 發生錯誤：", err.message);
    res.status(500).json({
      error: "讀取中央氣象署資料失敗，請稍後再試"
    });
  }
});

// 🧪 Debug 用：看整理後的埔里 3 天天氣資料
app.get("/api/debug/cwa-puli-days", async (req, res) => {
  try {
    const data = await fetchCwaNantou();
    const days = mapCwaToDays(data);

    res.json({
      count: days.length,
      days
    });
  } catch (err) {
    console.error("❌ 解析 CWA 資料發生錯誤：", err.message);
    res.status(500).json({
      error: "解析中央氣象署資料失敗，請稍後再試"
    });
  }
});

// 埔里天氣：優先使用中央氣象署資料，失敗時才用備援假資料
app.get("/api/weather/puli", async (req, res) => {
  // 備援用的假資料（CWA 掛掉時避免整個 API 爆掉）
  const fallbackRawDays = [
    {
      date: "2025-11-30",
      summary: "多雲時晴",
      tempMin: 18,
      tempMax: 25,
      rainProb: 20,
      humidity: 70
    },
    {
      date: "2025-12-01",
      summary: "短暫陣雨",
      tempMin: 17,
      tempMax: 23,
      rainProb: 60,
      humidity: 85
    },
    {
      date: "2025-12-02",
      summary: "晴時多雲",
      tempMin: 16,
      tempMax: 24,
      rainProb: 10,
      humidity: 60
    }
  ];

  try {
    // 1) 跟 CWA 拿原始 JSON
    const data = await fetchCwaNantou();

    // 2) 整理成 3 天的簡化資料
    const rawDays = mapCwaToDays(data);

    let daysToUse = rawDays;

    // 如果整理出來是空的，就用備援假資料
    if (!Array.isArray(rawDays) || rawDays.length === 0) {
      console.warn("⚠️ CWA 回傳資料無有效天氣，改用備援假資料");
      daysToUse = fallbackRawDays;
    }

    // 3) 每一天套用一句人話建議
    const daysWithAdvice = daysToUse.map((day) => ({
      ...day,
      advice: getAdvice(day)
    }));

    res.json({
      location: "南投縣埔里鎮",
      days: daysWithAdvice,
      source: Array.isArray(rawDays) && rawDays.length > 0 ? "CWA" : "fallback"
    });
  } catch (err) {
    console.error("❌ 取得 CWA 或整理資料錯誤：", err.message);

    // CWA 掛掉或解析失敗時，仍然回傳假資料＋建議
    const daysWithAdvice = fallbackRawDays.map((day) => ({
      ...day,
      advice: getAdvice(day)
    }));

    res.json({
      location: "南投縣埔里鎮",
      days: daysWithAdvice,
      source: "fallback-error"
    });
  }
});


// 11. 啟動伺服器
app.listen(PORT, () => {
  console.log(
    `🚀 Server is running at http://127.0.0.1:${PORT}`
  );
});


