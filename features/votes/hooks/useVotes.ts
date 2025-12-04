import { useState, useEffect } from "react"
import { getSupabaseClient } from "@/lib/supabase"

// We repurpose the 'votes' table to store our single Google Form configuration
// Title -> Public Form URL
// Description -> Admin Edit URL
// Options -> Results Sheet URL

const CONFIG_ID = "google-form-config" // specific ID to identify this record

export function useGoogleVote() {
  const [publicFormUrl, setPublicFormUrl] = useState("")
  const [adminEditUrl, setAdminEditUrl] = useState("")
  const [resultsUrl, setResultsUrl] = useState("")
  const [loading, setLoading] = useState(true)

  // Load the config from Supabase
  useEffect(() => {
    async function loadConfig() {
      setLoading(true)
      const supabase = getSupabaseClient()
      
      // Try to find a vote record with our specific ID or a specific marker
      // Since we can't easily force an ID in insert, we'll search by a unique title marker
      const { data } = await supabase
        .from("votes")
        .select("*")
        .eq("title", "GOOGLE_FORM_CONFIG_DO_NOT_DELETE")
        .single()

      if (data) {
        // Parse our stored data
        // Description field = Public Link
        // Options field = Admin Edit Link
        // Note field (if exists) or JSON inside options = Results Link
        
        // Let's use a JSON object in 'options' to store everything neatly if possible, 
        // but 'options' might be text. Let's try to be clever.
        
        // MAPPING:
        // description = Public Form URL (User sees this)
        // options = JSON string containing { editUrl, resultsUrl }
        
        setPublicFormUrl(data.description || "")
        try {
          const extraData = JSON.parse(data.options || "{}")
          setAdminEditUrl(extraData.editUrl || "")
          setResultsUrl(extraData.resultsUrl || "")
        } catch (e) {
          // Fallback if options isn't JSON
          setAdminEditUrl("") 
          setResultsUrl("")
        }
      }
      setLoading(false)
    }
    loadConfig()
  }, [])

  const saveConfig = async (publicUrl: string, editUrl: string, sheetUrl: string) => {
    const supabase = getSupabaseClient()
    setLoading(true)

    const payload = {
      title: "GOOGLE_FORM_CONFIG_DO_NOT_DELETE", // Unique marker
      description: publicUrl,
      options: JSON.stringify({ editUrl, resultsUrl: sheetUrl }),
      status: "active",
      author: "System",
      ends_at: new Date(2099, 0, 1).toISOString() // Never expires
    }

    // Check if exists first
    const { data: existing } = await supabase
      .from("votes")
      .select("id")
      .eq("title", "GOOGLE_FORM_CONFIG_DO_NOT_DELETE")
      .single()

    let error
    if (existing) {
      const res = await supabase.from("votes").update(payload).eq("id", existing.id)
      error = res.error
    } else {
      const res = await supabase.from("votes").insert([payload])
      error = res.error
    }

    if (!error) {
      setPublicFormUrl(publicUrl)
      setAdminEditUrl(editUrl)
      setResultsUrl(sheetUrl)
    }
    
    setLoading(false)
    return { success: !error, error: error?.message }
  }

  return {
    publicFormUrl,
    adminEditUrl,
    resultsUrl,
    loading,
    saveConfig
  }
}