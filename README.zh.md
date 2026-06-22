# [2026 世界盃儀表板 ⚽](https://julianchun.github.io/2026worldcup-dashboard)

簡潔而完整的 2026 國際足總世界盃助手：賽程、小組、對陣圖、參賽名單、球場、天氣，以及開放資料比賽脈絡，支援 23 種語言。

👉 **[點我立即使用 2026 世界盃儀表板！](https://julianchun.github.io/2026worldcup-dashboard)** ⚽ ([julianchun.github.io/2026worldcup-dashboard](https://julianchun.github.io/2026worldcup-dashboard))

比起 FIFA&#46;com、Google 或維基百科，這裡查資訊更快、更簡單、更輕鬆：關於這屆賽事的每一條資訊都只需一兩下點按即可取得，以你的語言、你的時區呈現，沒有任何多餘的東西（無廣告、無新聞流、無影片、無 Cookie 橫幅、無需登入）。

> **非官方、球迷自製、非營利、開源專案**，託管於 GitHub Pages。與國際足總、任何國家足協、球隊、球員或轉播機構均無關聯、未獲其認可、也無任何關係。程式碼與精選資料採用 MIT 授權（見 [LICENSE](LICENSE.md)）；第三方資料條款詳見 [COPYRIGHT](COPYRIGHT.md)。

其他語言的 README：[English](README.md)

## ✨ 功能特色

### 🏆 賽事

- 📅 **全部 104 場比賽**，含開球時間、球場、小組/階段標籤以及半即時比分
- 🔍 **賽程**可依球隊、階段和球場篩選；篩選條件儲存在 URL 中，因此檢視可以分享
- 📊 **小組積分榜**依據官方國際足總同分排序規則計算，並附第三名球隊的排名（12 支中前 8 名晉級），用顏色標示晉級情況
- 🪜 **淘汰賽對陣圖**採用向中心匯聚的樹狀結構，隨球隊晉級自動填入，無需橫向捲動；在手機上則改為逐輪列表版面
- 📋 **比賽頁面**：來自開放資料的賽前背景、對戰紀錄、標示清楚的近期國際賽狀態、球場資訊、開球時段天氣預報（對於較遠日期則回退至典型氣候資料）、完整裁判組、繪製在 SVG 球場上並標註陣型的先發陣容，以及可點選的先發/替補球員列表與進球時間軸

### 👕 球隊與球員

- 🧢 **48 支球隊頁面**：即時國際足總排名、開放資料狀態脈絡、陣容資訊摘要、總教練、小組積分榜、完整賽程、訓練基地（含地圖 + Google 地圖連結）、官方網站及維基百科連結
- 👥 **官方 26 人參賽名單**：號碼、位置、年齡、出場次數、進球數、所屬俱樂部；每位球員均連結到其英文維基百科項目
- ⭐ **收藏**：為你關注的球隊加星標，並據此篩選賽程

### 🗺️ 球場與地圖

- 🌎 全部 16 座球場的**真實地理地圖**（Natural Earth 資料，蘭伯特等角圓錐預測），標示每座球場的容量、頂棚類型、時區以及六月/七月氣候
- 🏕️ **球隊基地**以旗幟圖釘形式標繪在同一張地圖上（避免重疊的版面），並配有球隊篩選功能，僅醒目顯示所選球隊參賽的城市

### 📊 資料統計與比賽脈絡

- 👟 **金靴榜**及賽事資料統計，在整屆比賽期間持續更新
- 🧭 **開放資料比賽脈絡**結合賽事資料與歷史國際賽結果：近期狀態、對戰紀錄、最近交手、FIFA 排名、賽前休息天數、天氣可用性、公平競賽分數與現行停賽
- 🩺 **可用性備註**僅支援人工精選、附來源連結的官方資訊；本應用不爬取也不宣稱完整傷病覆蓋
- 🧾 **不提供投注式預測**：本應用提供事實脈絡，協助你自行判斷，不顯示賠率、勝率或模型產生的比分預測。

### 🌍 語言

- **23 種語言**，涵蓋所有參賽球隊的語言以及一些熱門語言：English · Français · Español · Português (Portugal) · Português (Brasil) · Deutsch · Nederlands · Čeština · Hrvatski · Svenska · Norsk · العربية · فارسی · Türkçe · Oʻzbekcha · 日本語 · 한국어 · 繁體中文 · Italiano · Bahasa Indonesia · Русский · Українська
- 對阿拉伯語和波斯語提供自動偵測及完整的 RTL（從右到左）支援
- 球隊、球場和裁判的名稱還會以國際足總自己的在地化方式提供給其中 12 種語言；其餘語言则在介面保持翻譯的同時回退使用英文名稱。語言可隨時從頂欄切換；字典按需載入

### 🎁 體驗

- 🕒 **時區**：比賽時間預設以*你的*時鐘顯示；可切換為球場當地時間或任意固定時區（預設錨定主辦地時區 America/New_York）
- 📲 **PWA**：可安裝到桌面端和行動端，首次造訪後完全離線可用（除即時比分重新整理外的一切功能）
- 📆 **行事曆匯出**：下載你所關注球隊比賽的 `.ics` 文件
- 🌗 **淺色與深色主題**，預設自动切換
- 🔒 **自包含**：旗幟、字型、地圖資料以及所有賽事資料均於本機提供；應用在執行時發出**零次第三方請求**

## 📱 相容性

- **螢幕**：從小螢幕手機（360 px）到大螢幕桌面均自適應；行動端使用底部標籤列，桌面端則為完整導覽
- **瀏覽器**：最新版本 Chrome、Edge、Firefox 和 Safari（桌面端及 iOS）
- **安裝**：可在 Android、iOS（"加入主畫面"）以及桌面版 Chrome/Edge 上從瀏覽器選單作為 PWA 安裝
- **無障礙**：支援鍵盤導覽的控制項、可見的焦點狀態、兩種主題下均達到 WCAG AA 對比度，並遵循 `prefers-reduced-motion` 設定

## ⚡ 資料：每場比賽後即時更新

所有資料均來自免費、權威的來源，且全程不使用任何 API 金鑰：

| 來源 | 提供內容 |
|---|---|
| FIFA 公開 API | 賽程、比分、陣容、裁判、在地化名稱、世界排名 |
| 維基百科 | 官方 26 人參賽名單（號碼、出場次數、進球數、俱樂部、總教練） |
| Open-Meteo | 逐小時球場天氣預報及基地地理編碼 |
| 手工精選檔案 | 球場、基地、氣候常年值、球隊配色、可選的附來源可用性備註 |
| 開放歷史資料 | 來自 `martj42/international_results`（CC0）的對戰紀錄與近期國際賽狀態 |
| 本機計算 | 積分榜、賽事統計、停賽、休息/旅程參考資訊、open-data match-context JSON |

**自動更新**（GitHub Actions，已包含在本倉庫中）：

- ⏱️ **比賽進行期間每 15 分鐘一次**（另外每場比賽開球前 10 分鐘擷取一次陣容）
- 🌙 **每天纽约時間 00:00**
- ✅ 每次更新在發布前都會經過合理性檢查，並觸發站點重新部署

比分為**半即時，而非即時**：通常比轉播訊號落後最多約 15 分鐘。這是有意為之；整個應用是由 CI 重新整理的靜態 JSON，沒有伺服器、socket 或推播基礎設施。

**目前不會自動擷取**：傷病、FIFA 公布前的預計先發、投注賠率、xG，以及進階球員/球隊事件資料。可用性資訊只能透過 `scripts/curated/availability-notes.json` 中附來源連結的人工精選備註加入；不要加入傳聞或無來源說法。

加入任何需要 API 金鑰的資料來源前，請先閱讀 [Optional Data Providers](docs/optional-data-providers.md)。

## 🛠️ 開發

面向本專案的開發者。

### 🚀 快速開始

```bash
npm install
npm run update   # fetch the latest data
npm run dev      # http://localhost:5173
```

正式環境建置（在 `dist/` 中產生完全靜態的輸出）：

```bash
npm run build
npm run preview
```

### 📜 腳本

| 腳本 | 作用 |
|---|---|
| `npm run dev` | 在 `localhost:5173` 啟動 Vite 開發伺服器 |
| `npm run build` | 型別檢查並建置正式版本到 `dist/` |
| `npm run preview` | 在本機提供已建置的 `dist/` |
| `npm run update` | 將所有賽事資料（FIFA、維基百科、Open-Meteo）及計算後的參考資訊重新整理到 `public/data/` |
| `npm run gencron` | 根據比賽日曆重新產生 CI cron 排程計畫 |
| `npm run genmap` | 從 Natural Earth 源資料重建球場地圖 |
| `npm run typecheck` | TypeScript 型別檢查（`tsc -b`，不产出文件） |
| `npm run format` | Biome 自動格式化（寫入） |
| `npm run lint` | Biome lint + 格式檢查（包含無障礙規則） |
| `npm run smoke` | 無頭冒煙測試：涵蓋所有語言和主題下的每條路由 |
| `npm run a11y` | axe-core WCAG A/AA 稽核：路由 × 淺色/深色 × RTL |
| `npm run checkall` | 快速檢查：typecheck + format + lint |
| `npm run checkall:build` | 完整檢查：checkall + build + smoke + a11y |

<details>
<summary><b>🌐 新增一種語言</b></summary>

1. 建立 `src/i18n/<code>.ts`，包含 `en.ts` 中的每一個鍵，順序相同（在語法需要時再加上 `key#one` 風格的複數變體）。
2. 接入它：`types.ts` 中的 `Lang` 聯合型別；`i18n/strings.ts` 中的 `LOCALE_TAG` + `LANG_LABEL`（鍵的順序 = 選單順序）；`i18n/index.tsx` 中的載入器；`SettingsContext.tsx` 中的偵測前綴；以及在適用時的 `RTL_LANGS` / `DATA_FALLBACK`。
3. 如果 `api.fifa.com` 提供該語言，就將其加入 `scripts/update.mjs` 中的 `LANGS`；否則將其加入那裡的 `CLDR_LANGS`（球隊名稱隨後會來自 CLDR 國家名稱），並將 England 和 Scotland 添加到 `team-names-l10n.json` —— 它們是 CLDR 無法命名的英國行政區。
4. 翻譯精選內容：16 條 `rainNote` 項目（`climate.json`）、舊金山灣區標籤（`Venues.tsx`）、16 個城市名稱（`city-l10n.json`，僅限非拉丁文字），以及僅在本機命名習慣與 CLDR 不同時（如繁體中文）才需要的完整 48 個球隊名稱區塊（`team-names-l10n.json`）。
5. 添加一次冒煙測試，更新本 README 的語言列表，並執行 `npm run update && npm run build && npm run smoke`。

</details>

### 🚢 部署

本應用是一個採用 hash 路由和相對資源路徑的靜態站點。對於 GitHub Pages：

1. 推送到倉庫。
2. `deploy.yml` 會在每次推送到 `main` 時建置並發布（僅涉及文件和僅涉及流水線的變更會被跳過）。
3. `update-data.yml` 會依上述以比賽為驅動的排程重新整理資料並重新部署。它的 cron 表是根據固定的比賽日曆產生的；如果某場比賽的開球時間發生變化，請執行 `npm run gencron`。

### 🐳 Docker（自託管）

一個小巧的映像（由 nginx 提供已建置的 PWA），發布於 **`ghcr.io/julianchun/2026worldcup-dashboard`**。它從何處讀取比賽資料由 `DATA_SOURCE` 環境變數決定；無論哪種方式，應用都在 **http://localhost:8080** 上提供服務。

| `DATA_SOURCE` | `/data/*.json` 來自 | 時效性 | 網路 |
| --- | --- | --- | --- |
| `remote` *（預設）* | 從線上站點反向代理 | 始終最新，含即時比分 | 向 `REMOTE_DATA_HOST` 發出對外請求 |
| `self` | 執行資料流水線的更新器 sidecar 容器 | 接近即時（由自身的 `UPDATE_INTERVAL` 決定） | 向 FIFA/維基百科/Open-Meteo 發出對外請求 |

#### 1. `remote` 模式（預設）：從線上站點代理的始終最新的資料

**1.1 使用預建置映像**（無需複製）：

```bash
docker run -d -p 8080:80 ghcr.io/julianchun/2026worldcup-dashboard:latest
```

**1.2 自行建置**（有本機變更，或在映像發布之前）：

```bash
git clone https://github.com/julianchun/2026worldcup-dashboard.git
cd 2026worldcup-dashboard
docker build -t ghcr.io/julianchun/2026worldcup-dashboard:latest .          # 建置本機映像
docker run -d -p 8080:80 ghcr.io/julianchun/2026worldcup-dashboard:latest   # 相同標籤 → 執行你的建置，不會擷取
```

#### 2. `self` 模式：自我更新，不依賴線上站點

兩個容器共用一個資料卷：Web 伺服器（`DATA_SOURCE=self`）和一個每隔 `UPDATE_INTERVAL` 秒（預設 `900` = 15 分鐘）重新執行資料流水線的更新器。該資料卷以映像中預置的快照作為初始內容，因此站點可立即運作，并在首次執行後被最新資料取代。

**2.1 使用預建置映像**（無需複製），直接執行這一對容器：

```bash
docker volume create wc-data
docker run -d -p 8080:80 -e DATA_SOURCE=self --restart unless-stopped \
  -v wc-data:/usr/share/nginx/html/data \
  ghcr.io/julianchun/2026worldcup-dashboard:latest
docker run -d -e UPDATE_INTERVAL=900 --restart unless-stopped \
  -v wc-data:/app/public/data \
  ghcr.io/julianchun/2026worldcup-dashboard-updater:latest
```

**2.2 自行建置**（Compose 會同時建置 Web 映像和更新器映像）：

```bash
git clone https://github.com/julianchun/2026worldcup-dashboard.git
cd 2026worldcup-dashboard
docker compose -f docker-compose.yml -f docker-compose.self.yml up -d --build
```

### ⚙️ 技術棧

React 19 · TypeScript · Vite · 無後端，除 React + Router 外無任何執行時依賴。全程使用 SVG：含先發陣容的球場、投影後的北美地圖、對陣圖、Logo。

```
scripts/update.mjs    data pipeline (npm run update)
scripts/gencron.mjs   regenerates the match-driven CI schedule
scripts/genmap.mjs    rebuilds the map from Natural Earth data
scripts/smoke.mjs     headless smoke test across routes, languages, themes
scripts/curated/      hand-checked datasets
docs/                 optional provider boundaries and project notes
public/data/          generated JSON the app loads at runtime
src/                  application code (pages, components, i18n, settings)
```

## 📄 授權

程式碼與精選資料：[MIT](LICENSE.md)。詳細的第三方資料與圖像授權：[COPYRIGHT](COPYRIGHT.md)。資料由國際足總公開 API、維基百科及 Open-Meteo 提供；請透過當地節目表核實轉播權。
