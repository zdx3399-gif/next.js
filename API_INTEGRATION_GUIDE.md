# API 整合指南

## 概述

所有的 API 都已整合到統一的 API 客戶端中。使用 `@/lib/api-client` 和對應的 Custom Hooks 來調用 API。

## 快速開始

### 1. 認證相關 API

#### 登入
```typescript
import { authAPI } from "@/lib/api-client"

const result = await authAPI.login(email, password)
// 返回: { success: true, user: {...}, ... }
```

#### 註冊
```typescript
import { authAPI } from "@/lib/api-client"

const result = await authAPI.register(email, password, name, phone, role, relationship, unit)
// 返回: { success: true, user: {...}, ... }
```

#### LINE 綁定
```typescript
import { authAPI } from "@/lib/api-client"

const result = await authAPI.bindLine(profileId, lineUserId, lineDisplayName, lineAvatarUrl, lineStatusMessage)
// 返回: { success: true, profile: {...}, ... }
```

#### LINE 解除綁定
```typescript
import { authAPI } from "@/lib/api-client"

const result = await authAPI.unbindLine(profileId)
// 返回: { success: true, ... }
```

---

## 2. 包裹相關 API

### 使用 Hook 方式（推薦）

```typescript
"use client"
import { usePackages } from "@/features/packages/hooks/usePackages"

export function PackagesList() {
  const { packages, loading, handleAddPackage } = usePackages()
  // ...
}
```

### 直接調用 API
```typescript
import { packagesAPI } from "@/lib/api-client"

// 取得包裹列表
const packages = await packagesAPI.getPackages()

// 新增包裹
const result = await packagesAPI.addPackage(
  courier,
  recipientName,
  recipientRoom,
  trackingNumber,
  arrivedAt,
  test
)

// 標記為已取件
const result = await packagesAPI.markPackageAsPickedUp(packageId, pickedUpBy)
```

---

## 3. 訪客相關 API

### 使用 Hook 方式（推薦）

```typescript
"use client"
import { useVisitors } from "@/features/visitors/hooks/useVisitors"

export function VisitorsList() {
  const { visitors, loading, handleAddVisitor } = useVisitors()
  // ...
}
```

### 直接調用 API
```typescript
import { visitorsAPI } from "@/lib/api-client"

// 取得訪客列表
const visitors = await visitorsAPI.getVisitors()

// 新增訪客預約
const result = await visitorsAPI.addVisitor(
  visitorName,
  visitorPhone,
  purpose,
  reserveTime,
  unitId,
  reservedById
)

// 簽到
const result = await visitorsAPI.checkInVisitor(visitorId)

// 簽出
const result = await visitorsAPI.checkOutVisitor(visitorId)
```

---

## 4. 反饋相關 API

### 使用 Hook 方式（推薦）

```typescript
"use client"
import { useFeedback } from "@/hooks/useFeedback"

export function FeedbackComponent() {
  const { submitFeedback, loading, error } = useFeedback({
    onSuccess: () => console.log("反饋已提交"),
    onError: (err) => console.error(err),
  })

  const handleSubmit = async () => {
    await submitFeedback(
      chatLogId,
      "helpful", // "helpful" | "unclear" | "not_helpful"
      userId,
      clarificationChoice,
      comment
    )
  }
}
```

### 直接調用 API
```typescript
import { feedbackAPI } from "@/lib/api-client"

const result = await feedbackAPI.submitFeedback(
  chatLogId,
  "helpful",
  userId,
  clarificationChoice,
  comment
)
```

---

## 5. 費用相關 API

### 使用 Hook 方式（推薦）

```typescript
"use client"
import { useFees } from "@/hooks/useFees"

export function FeeNotificationComponent() {
  const { notifyFee, loading, error } = useFees({
    onSuccess: () => console.log("費用通知已發送"),
    onError: (err) => console.error(err),
  })

  const handleNotify = async () => {
    await notifyFee(
      room,        // 房號，例：A-3-302
      amount,      // 金額
      dueDate,     // 到期日期
      invoice,     // 發票號（可選）
      false        // test 模式（可選）
    )
  }
}
```

### 直接調用 API
```typescript
import { feesAPI } from "@/lib/api-client"

const result = await feesAPI.notifyFee(room, amount, due, invoice, test)
```

---

## 6. AI 聊天相關 API

### 使用 Hook 方式（推薦）

```typescript
"use client"
import { useLLM } from "@/hooks/useLLM"

export function ChatComponent() {
  const { chat, loading, error } = useLLM({
    onSuccess: () => console.log("聊天完成"),
    onError: (err) => console.error(err),
  })

  const handleChat = async () => {
    const response = await chat(
      query,    // 使用者問句
      userId,   // 使用者 ID（可選）
      eventId   // 事件 ID，用於防重複（可選）
    )
  }
}
```

### 直接調用 API
```typescript
import { llmAPI } from "@/lib/api-client"

const result = await llmAPI.chat(query, userId, eventId)
```

---

## 7. 個人檔案相關 API

### 使用 Hook 方式（推薦）

```typescript
"use client"
import { useProfileByName } from "@/hooks/useProfileByName"

export function ProfileSearchComponent() {
  const { getProfileByName, loading, error } = useProfileByName({
    onSuccess: () => console.log("查詢成功"),
    onError: (err) => console.error(err),
  })

  const handleSearch = async () => {
    const profile = await getProfileByName(name)
  }
}
```

### 直接調用 API
```typescript
import { profileAPI } from "@/lib/api-client"

const profile = await profileAPI.getProfileByName(name)
```

---

## 8. 其他功能 API

### LINE 通知
```typescript
import { otherAPI } from "@/lib/api-client"

await otherAPI.notifyLine(userId, message)
```

### 知識庫查詢
```typescript
import { otherAPI } from "@/lib/api-client"

const results = await otherAPI.getKnowledgeGap(query)
```

### 內容審核
```typescript
import { otherAPI } from "@/lib/api-client"

const result = await otherAPI.moderateContent(content)
```

### 公告管理
```typescript
import { otherAPI } from "@/lib/api-client"

// 取得公告
const announcements = await otherAPI.getAnnouncements()

// 發佈公告
const result = await otherAPI.postAnnouncement(title, content)
```

### KMS (知識管理系統)
```typescript
import { otherAPI } from "@/lib/api-client"

const result = await otherAPI.getKMS(query)
```

### 同步功能
```typescript
import { otherAPI } from "@/lib/api-client"

const result = await otherAPI.syncData(type, data)
```

### 解密相關
```typescript
import { otherAPI } from "@/lib/api-client"

// 解密請求
const result = await otherAPI.decryptionRequest(data)

// 解密審核
const result = await otherAPI.decryptionReview(data)
```

---

## 環境變數配置

確認 `.env.local` 中已設置：

```dotenv
# API 基礎 URL
NEXT_PUBLIC_API_URL=http://localhost:3000

# Supabase 設定
SUPABASE_URL=https://your-supabase-url.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# LINE Bot 設定
LINE_CHANNEL_ACCESS_TOKEN=your_token
LINE_CHANNEL_SECRET=your_secret
```

---

## 錯誤處理

所有 Hook 都提供 `error` 狀態和 `onError` 回調：

```typescript
const { chat, loading, error } = useLLM()

// 方法 1：通過 Hook 狀態
if (error) {
  console.log("Error:", error)
}

// 方法 2：通過回調
const { chat } = useLLM({
  onError: (errorMessage) => {
    console.error("Failed:", errorMessage)
  }
})
```

---

## 現有功能與新 API 的兼容性

- ✅ `auth/page.tsx` - 已更新為使用新 `/api/auth/*` 端點
- ✅ `bind-line/page.tsx` - 已使用新 `/api/bind-line` 端點
- ✅ `features/packages` - 仍使用 Supabase 直接調用（保持原有功能）
- ✅ `features/visitors` - 仍使用 Supabase 直接調用（保持原有功能）
- ✅ 新集成的 Hooks：`useFeedback`, `useFees`, `useLLM`, `useProfileByName`

---

## 使用示例完整流程

### 例子：處理包裹到達並發送通知

```typescript
import { packagesAPI } from "@/lib/api-client"
import { otherAPI } from "@/lib/api-client"

async function handlePackageArrival(
  courier: string,
  recipientName: string,
  recipientRoom: string
) {
  try {
    // 1. 新增包裹
    const Package = await packagesAPI.addPackage(
      courier,
      recipientName,
      recipientRoom,
      undefined, // trackingNumber
      new Date().toISOString() // arrivedAt
    )

    // 2. 發送 LINE 通知
    if (Package.unit_id) {
      await otherAPI.notifyLine(
        Package.unit_id,
        `📦 您有一個來自 ${courier} 的包裹已到達`
      )
    }

    return { success: true, package: Package }
  } catch (error) {
    console.error("錯誤:", error)
    return { success: false, error }
  }
}
```

---

## 常見問題

**Q: 應該用 Hook 還是直接調用 API？**
A: 在 React 組件中優先使用 Hook（如 `useFeedback`, `useFees`），這樣可以獲得完整的狀態管理和錯誤處理。直接調用 API 適合在 Server Action 或工具函數中使用。

**Q: API 超時怎麼辦？**
A: 所有錯誤都會被捕獲並返回 error 訊息。你可以通過 Hook 的 `onError` 回調或捕獲 Promise 拒絕來處理。

**Q: 能否自定義 API 基礎 URL？**
A: 是的，透過 `NEXT_PUBLIC_API_URL` 環境變數設置。默認值為 `http://localhost:3000`。

---

## API 端點總覽

| 功能 | 方法 | 端點 | 說明 |
|------|------|------|------|
| 登入 | POST | `/api/auth/login` | 使用者登入 |
| 註冊 | POST | `/api/auth/register` | 新使用者註冊 |
| LINE綁定 | POST | `/api/bind-line` | LINE 帳號綁定 |
| LINE解綁 | DELETE | `/api/bind-line` | 解除 LINE 綁定 |
| 包裹列表 | GET | `/api/packages` | 取得包裹 |
| 新增包裹 | POST | `/api/packages` | 新增包裹 |
| 更新包裹 | PUT | `/api/packages` | 更新包裹狀態 |
| 訪客列表 | GET | `/api/visitor` | 取得訪客記錄 |
| 新增訪客 | POST | `/api/visitor` | 新增訪客預約 |
| 反饋 | POST | `/api/feedback` | 提交聊天反饋 |
| 費用通知 | POST | `/api/fees` | 發送費用通知 |
| AI聊天 | POST | `/api/llm` | AI 聊天對話 |
| 查詢個人檔案 | POST | `/api/profile-by-name` | 按姓名查詢 |
| LINE 通知 | POST | `/api/line-notify` | 發送 LINE 通知 |
| 知識庫 | POST | `/api/knowledge-gap` | 知識庫查詢 |
| 審核 | POST | `/api/moderation` | 內容審核 |
| 公告 | GET/POST | `/api/announce` | 公告管理 |
| KMS | POST | `/api/kms` | 知識管理系統 |
| 同步 | POST | `/api/sync` | 數據同步 |
| 解密 | POST | `/api/decryption/*` | 解密相關操作 |

---

## 更新日期

2026-02-07

## 設計者

API 整合工具
