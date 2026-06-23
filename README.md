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

## 開發環境

| 類別 | 軟體或技術 | 用途 |
| --- | --- | --- |
| 作業系統 | Windows 11 / macOS | 系統開發及測試環境 |
| 程式開發工具 | Visual Studio Code | 撰寫及除錯程式 |
| 前端技術 | HTML、CSS、JavaScript | 建立網頁介面及互動效果 |
| 前端框架 | 無，採用原生 JavaScript | 直接處理畫面渲染與事件控制 |
| 後端技術 | Node.js、Express.js | 處理系統邏輯及 API |
| 資料庫 | SQLite | 儲存會員、商品、留言及對話資料 |
| 版本管理 | GitHub | 儲存及管理專題程式碼 |
| 瀏覽器 | Google Chrome、Microsoft Edge | 系統操作及功能測試 |

## 執行需求

- Node.js 22.5 以上版本
- 不需要執行 `npm install`
- 不需要另外安裝 SQL Server，資料庫使用 SQLite

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

## 本機 SQLite Demo：搭配 DB Browser for SQLite

這個專案使用同一份本機 SQLite 資料庫：

```text
data/redorm.db
```

Demo 時可以同時開網站與 DB Browser for SQLite，直接觀察商品資料列的新增、修改、刪除。

### 1. 啟動網站

在專案資料夾執行：

```bash
npm start
```

接著開啟：

```text
http://localhost:3000
```

### 2. 用 DB Browser 開啟資料庫

在 DB Browser for SQLite 選擇：

```text
Open Database
```

然後開啟本專案的：

```text
data/redorm.db
```

### 3. 查看商品資料

切到 `Execute SQL`，執行：

```sql
SELECT * FROM products ORDER BY id;
```

在網站新增商品後，再回 DB Browser 重新執行這段 SQL，就可以看到 `products` 多一筆資料。

### 4. 查看操作紀錄

本機 Demo 版另外提供 `operation_logs` 資料表。當網站成功新增、修改或刪除商品時，後端會寫入一筆操作紀錄。

```sql
SELECT * FROM operation_logs ORDER BY id DESC;
```

欄位說明：

| 欄位 | 說明 |
| --- | --- |
| `operation` | 操作類型，包含 `INSERT`、`UPDATE`、`DELETE` |
| `table_name` | 被操作的資料表，例如 `products` |
| `record_id` | 被操作的資料列 id |
| `details` | JSON 格式的補充資訊，例如商品名稱、價格、操作者學號 |
| `created_at` | 操作時間 |

### 5. Demo 操作流程

1. 使用展示帳號登入網站。
2. 到商品管理新增一筆商品。
3. 在 DB Browser 執行：

   ```sql
   SELECT * FROM products ORDER BY id;
   ```

4. 修改剛剛新增的商品，例如價格或狀態。
5. 再次查詢 `products`，確認欄位已更新。
6. 刪除剛剛新增的商品。
7. 查詢操作紀錄：

   ```sql
   SELECT * FROM operation_logs ORDER BY id DESC;
   ```

8. 確認有對應的 `INSERT`、`UPDATE`、`DELETE` 紀錄。

### 6. DB Browser 看不到最新資料時

此專案維持 SQLite WAL 模式。若網站已操作成功，但 DB Browser 暫時看不到最新資料，可以依序嘗試：

1. 在 DB Browser 重新執行 SQL 或重新整理資料庫連線。
2. 在 DB Browser 執行：

   ```sql
   PRAGMA wal_checkpoint(FULL);
   ```

3. 關閉 DB Browser 後，重新開啟 `data/redorm.db`。

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
operation_logs
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
