# 多社區管理系統

這是一個支援多租戶（Multi-Tenant）的社區管理系統，可以讓用戶在登入時選擇要進入的社區，系統會自動連接到對應的資料庫。

## 功能特色

- **多租戶支援**：支援多個獨立的社區資料庫
- **登入時選擇社區**：用戶可以在登入頁面選擇要進入的社區
- **自動資料庫切換**：根據選擇的社區自動連接到對應的 Supabase 資料庫
- **完整社區管理功能**：
  - 公告管理
  - 投票系統
  - 設備維護
  - 管理費收支
  - 住戶管理
  - 包裹管理
  - 訪客登記
  - 會議活動
  - 緊急事件

## 環境變數設定

在 Vercel 或本地 `.env.local` 中設定以下環境變數：

\`\`\`env
# 社區 A 的 Supabase 設定
NEXT_PUBLIC_TENANT_A_SUPABASE_URL=your_tenant_a_supabase_url
NEXT_PUBLIC_TENANT_A_SUPABASE_ANON_KEY=your_tenant_a_anon_key

# 社區 B 的 Supabase 設定
NEXT_PUBLIC_TENANT_B_SUPABASE_URL=your_tenant_b_supabase_url
NEXT_PUBLIC_TENANT_B_SUPABASE_ANON_KEY=your_tenant_b_anon_key
\`\`\`

## 資料庫設定

1. 在 Supabase 中建立兩個獨立的專案（社區 A 和社區 B）
2. 在每個專案中執行對應的 SQL 腳本：
   - 社區 A：執行 `scripts/create-tenant-a-database.sql`
   - 社區 B：執行 `scripts/create-tenant-b-database.sql`

## 測試帳號

### 社區 A
- 帳號：`admin@tenant-a.com`
- 密碼：`admin123`

### 社區 B
- 帳號：`admin@tenant-b.com`
- 密碼：`admin123`

## 使用方式

1. 進入登入頁面
2. 選擇要進入的社區（社區 A 或社區 B）
3. 輸入帳號密碼登入
4. 系統會自動連接到對應社區的資料庫
5. 所有操作都會在選定的社區資料庫中進行

## 技術架構

- **前端框架**：Next.js 15 (App Router)
- **UI 框架**：React 19
- **樣式**：Tailwind CSS v4
- **資料庫**：Supabase (PostgreSQL)
- **多租戶實現**：動態 Supabase 客戶端切換

## 開發

\`\`\`bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# 建置生產版本
npm run build

# 啟動生產伺服器
npm start
\`\`\`

## 部署

推薦使用 Vercel 部署：

1. 將專案推送到 GitHub
2. 在 Vercel 中匯入專案
3. 設定環境變數
4. 部署完成

## 注意事項

- 每個社區的資料完全獨立，不會互相影響
- 用戶需要在每個社區分別註冊帳號
- 切換社區需要重新登入
