# 旅日手帳｜Angular 旅遊行程規劃

這個版本使用 Angular standalone components，各區塊獨立維護；資料層使用 Firebase Authentication + Cloud Firestore，不需要另外撰寫一台自有後端伺服器。

## 目前功能

- 多趟旅程切換與新增
- 漢堡選單與側邊旅程清單
- Google 登入並顯示目前使用者名稱
- 邀請碼加入旅程與一起去的人標籤
- 日期分頁與行程時間軸
- 新增／編輯／刪除行程與旅程
- 加入行程時必選「超想去」或「有時間可去」
- 景點名稱直接連到 Google Maps
- 訂位、付款狀態與付款金額顯示
- 右下角懸浮新增按鈕
- 側滑帳本、台幣／日幣與記帳當下匯率換算
- 帳本可依日期連動到指定行程
- 每日 Note 可新增與編輯
- 帳本支援多人平均分攤、付款人負擔與自訂每人金額
- Firestore 即時同步，瀏覽器也保留每位使用者的本機快取

## Component 結構

- `app.component`：頁面組合與開關狀態
- `topbar`：漢堡選單與 Google 登入狀態
- `trip-sidebar`：多趟旅程切換
- `itinerary`：日期、景點時間軸與 Google Maps 連結
- `floating-actions`：右下角新增選單
- `expense-drawer`：側滑帳本
- `trip-dialog`、`event-dialog`、`expense-dialog`：各自獨立表單
- `trip-invite-dialog`、`join-trip-dialog`：邀請碼與旅程加入
- `trip-store.service`：本機快取、Firestore 同步與資料狀態更新
- `auth.service`：Google 登入狀態

## 本機使用

先安裝 Node.js 後，在此資料夾執行：

```powershell
npm install
npm start
```

再用瀏覽器開啟 Angular CLI 顯示的本機網址，通常是 `http://localhost:4200`。

初次開啟不會預先放入任何旅程、姓名或金額。登入 Google 後，旅程會保存到 Firebase Firestore；同一趟旅程的旅伴可透過邀請碼加入。瀏覽器的 `localStorage` 只作為該 Google 使用者的本機快取，不是跨裝置同步的主要來源。

## Firebase 設定

目前程式已放入 Firebase Web 設定檔，回家使用前請在 Firebase Console 確認：

1. Authentication → Sign-in method → 啟用 Google。
2. Firestore Database → 建立資料庫。
3. Firestore Database → Rules，貼上專案根目錄的 `firestore.rules` 並按 Publish。

未發布規則時，畫面仍可暫存本機資料，但 Google 登入後的跨裝置同步與邀請碼會被 Firestore 拒絕。

## GitHub Pages 部署

專案已包含 `.github/workflows/deploy-pages.yml`。將程式推到 GitHub 的 `main` 分支後，GitHub Actions 會自動安裝套件、建置 Angular，並部署到 GitHub Pages。

1. 在 GitHub 建立 Repository。GitHub Free 通常使用公開 Repository 最簡單；若要使用私有 Repository 的 Pages，需確認帳號方案支援。
2. 將整個專案資料夾推到 `main` 分支。
3. 到 Repository 的 `Settings` → `Pages`，將 `Source` 設為 `GitHub Actions`。
4. 到 `Actions` 查看 `Deploy Angular app to GitHub Pages`，完成後可在 Pages 頁面取得網址，通常是 `https://你的帳號.github.io/Repository名稱/`。
5. 到 Firebase Console → Authentication → Settings → Authorized domains，加入 `你的帳號.github.io`，Google 登入才允許從 GitHub Pages 網域使用。

Firebase 已提供登入、資料庫與權限規則，所以這個專案目前不需要另外架設自有後端；GitHub Pages 只負責提供前端檔案。Firestore 規則仍以專案根目錄的 `firestore.rules` 為準。
