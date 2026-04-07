import { getSupabaseClient } from "@/lib/supabase"

export interface Meeting {
  id?: string
  topic: string
  time: string
  location: string
  notes?: string
  key_takeaways?: string[] // 新增重點摘要欄位
  pdf_file_url?: string // 新增 PDF 檔案 URL
  minutes_url?: string
  created_by?: string
  created_at?: string
}

async function notifyMeetingLine(meeting: Meeting, notificationType?: "pdf_added") {
  try {
    const notifyRes = await fetch("/api/meeting/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meeting, notificationType }),
      keepalive: true,
    })

    if (!notifyRes.ok) {
      const notifyError = await notifyRes.json().catch(() => ({}))
      console.warn("Meeting notification response:", notifyError)
    }
  } catch (err: any) {
    console.warn("Meeting notification fetch error:", err)
  }
}

export async function getMeetingById(id: string): Promise<Meeting | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from("meetings").select("*").eq("id", id).single()

  if (error) {
    console.error("Error fetching meeting:", error)
    return null
  }
  return data
}

export async function getMeetings(): Promise<Meeting[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from("meetings").select("*").order("time", { ascending: false })

  if (error) {
    console.error("Error fetching meetings:", error)
    return []
  }
  return data || []
}

export async function createMeeting(
  meeting: Omit<Meeting, "id" | "created_at">,
  userId?: string,
): Promise<Meeting | null> {
  const supabase = getSupabaseClient()
  // 先保存會議到資料庫
  const { data, error } = await supabase
    .from("meetings")
    .insert([{ ...meeting, created_by: userId }])
    .select()
    .single()

  if (error) {
    console.error("Error creating meeting:", error)
    return null
  }

  // 通知採非阻塞，避免儲存流程卡住
  if (data?.id) {
    void notifyMeetingLine(data)
  }

  return data
}

export async function updateMeeting(id: string, meeting: Partial<Meeting>): Promise<Meeting | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from("meetings").update(meeting).eq("id", id).select().single()

  if (error) {
    console.error("Error updating meeting:", error)
    return null
  }

  // 如果更新包含 PDF 檔案，向住戶發送通知
  if (data && meeting.pdf_file_url) {
    void notifyMeetingLine(data, "pdf_added")
  }

  return data
}

export async function deleteMeeting(id: string): Promise<boolean> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("meetings").delete().eq("id", id)

  if (error) {
    console.error("Error deleting meeting:", error)
    return false
  }
  return true
}

export async function uploadMeetingPDF(file: File): Promise<string> {
  if (!(file instanceof File)) {
    throw new Error("無效的檔案")
  }

  const ext = (file.name?.split(".").pop() || "").toLowerCase()
  if (ext !== "pdf") {
    throw new Error("僅支援 PDF 檔案")
  }

  const formData = new FormData()
  formData.append("file", file)
  formData.append("folder", "meetings/minutes")

  const res = await fetch("/api/upload-file", {
    method: "POST",
    body: formData,
  })

  const payload = await res.json().catch(() => ({}))
  if (!res.ok || !payload?.url) {
    throw new Error(payload?.error || "PDF 上傳失敗")
  }

  if (!/^https?:\/\//i.test(payload.url)) {
    throw new Error("PDF 連結格式錯誤")
  }

  return payload.url
}
