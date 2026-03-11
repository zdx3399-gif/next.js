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

  // 同步發送 LINE 通知（確保在 serverless 環境中完成）
  if (data?.id) {
    try {
      const notifyRes = await fetch("/api/meeting/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meeting: data,
        }),
      })
      
      if (!notifyRes.ok) {
        const notifyError = await notifyRes.json()
        console.warn("Meeting notification response:", notifyError)
        // 不因為通知失敗而中斷會議建立
      }
    } catch (err) {
      console.warn("Meeting notification fetch error:", err)
      // 不因為通知失敗而中斷會議建立
    }
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
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(reader.result as string)
    }
    reader.onerror = () => {
      reject(new Error("PDF 讀取失敗"))
    }
    reader.readAsDataURL(file)
  })
}
