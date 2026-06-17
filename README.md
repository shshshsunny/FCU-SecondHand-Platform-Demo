# ReDorm 完整版 v6

這是一套可直接展示的「二手宿舍物品交易平台」，包含前端、Node.js 後端 API 與 SQLite 資料庫。

## 本版重點

- 每件商品點進詳細頁後，底下都有「買賣家留言區」
- 買家可在商品頁直接詢問，賣家可在同一頁選擇不同買家並回覆
- 留言為私人對話，只顯示給該商品的買家與賣家
- 賣家可從電腦或手機相簿上傳商品圖片
- 圖片會在瀏覽器自動壓縮，再存進 SQLite 資料庫
- 註冊與登入只需要「學號＋密碼」，完全不需要電子信箱
- 響應式版面，可在電腦、平板與手機使用

## 其他功能

- 會員註冊、登入、登出與登入狀態驗證
- 密碼雜湊儲存，不在資料庫保存明碼
- 商品新增、查詢、修改、刪除
- 僅商品建立者可修改或刪除自己的商品
- 關鍵字搜尋、分類篩選與價格／人氣排序
- 商品瀏覽次數統計
- 平台留言板
- 商品總數、販售中、已售出、平均價格等即時分析
- 商品分類分布、熱門排行、活躍賣家排行

## 執行需求

- Node.js 22.5 以上版本
- 不需要執行 `npm install`
- 不需要另外安裝 SQL Server

## 執行方式

### 方法一：Windows 直接開啟

點兩下：

```text
start-redorm.bat
```

### 方法二：PowerShell

在此資料夾開啟 PowerShell：

```powershell
npm start
```

若 npm 無法執行：

```powershell
node --no-warnings server.js
```

接著開啟：

```text
http://localhost:3000
```

## 展示帳號

```text
學號：D1348918
密碼：123456
```

其他測試帳號：

```text
D1350021
D1350088
D1350112
```

密碼皆為：

```text
123456
```

## 手機共同使用

電腦與手機連到同一個 Wi-Fi 或手機熱點後：

1. 電腦啟動 ReDorm。
2. 電腦 PowerShell 輸入 `ipconfig`。
3. 找到電腦的 IPv4 位址，例如 `192.168.1.105`。
4. 手機瀏覽器開啟 `http://192.168.1.105:3000`。

手機與電腦會共同讀寫同一個 SQLite 資料庫。Windows 防火牆若跳出詢問，請允許 Node.js 使用私人網路。

## 圖片儲存方式

商品圖片會經過前端壓縮後，以圖片資料形式存進：

```text
data/redorm.db
```

單張原始圖片請勿超過 12 MB。系統會自動縮小尺寸與壓縮，不需要自行處理。

## 資料庫

資料庫檔案：

```text
data/redorm.db
```

資料表：

```text
users
sessions
products
messages
conversations
chat_messages
```

建表語法：

```text
docs/schema.sql
```

## 還原初始資料

先關閉網站，再輸入：

```powershell
npm run reset
npm start
```

或點兩下：

```text
reset-database.bat
```

## 專案結構

```text
redorm_fullstack_v6/
├─ server.js
├─ reset-db.js
├─ package.json
├─ start-redorm.bat
├─ reset-database.bat
├─ data/
│  └─ redorm.db
├─ docs/
│  └─ schema.sql
└─ public/
   ├─ index.html
   ├─ styles.css
   └─ app.js
```
