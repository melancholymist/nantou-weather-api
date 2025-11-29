// 1. 載入套件
const express = require("express");
const cors = require("cors");

// 2. 建立 app
const app = express();

// 3. 固定用 3100 port（不要用 process.env 了，避免混淆）
const PORT = 3100;

// 4. 啟動時先印一行，確認真的是這一份在跑
console.log("✅ server.js 啟動中（使用 3100 port，有設定 CORS）");

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

// 8. 健康檢查 API
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// 9. 埔里天氣（先用假資料）
app.get("/api/weather/puli", (req, res) => {
  console.log("🌤 /api/weather/puli 被呼叫了一次");   
  res.json({
    location: "南投縣埔里鎮（測試版，3100 port）",
    days: [
      {
        date: "2025-11-29",
        summary: "多雲時晴",
        tempMin: 18,
        tempMax: 25,
        rainProb: 20,
        humidity: 70,
        advice: "天氣舒適，適合到戶外短時間走一走、活動筋骨。"
      },
      {
        date: "2025-11-30",
        summary: "短暫陣雨",
        tempMin: 19,
        tempMax: 24,
        rainProb: 80,
        humidity: 85,
        advice: "今天容易下雨，出門請帶雨具，走路放慢，小心路滑。"
      },
      {
        date: "2025-12-01",
        summary: "陰時多雲",
        tempMin: 17,
        tempMax: 22,
        rainProb: 40,
        humidity: 78,
        advice: "早晚溫差較大，出門請帶一件可以穿脫的外套。"
      }
    ]
  });
});

// 10. 啟動伺服器
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://127.0.0.1:${PORT}`);
});
