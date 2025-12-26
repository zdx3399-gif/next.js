import Groq from "groq-sdk";
import { createClient } from '@supabase/supabase-js';

// 1. Inisialisasi Groq (AI)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// 2. Inisialisasi Supabase (Database)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Fungsi untuk tanya AI
export async function generateAnswer(userMessage, systemPrompt = "You are a helpful assistant.") {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      model: "llama-3.3-70b-versatile",
    });
    return chatCompletion.choices[0]?.message?.content || "Maaf, aku nggak ngerti.";
  } catch (error) {
    console.error("Error generating answer:", error);
    throw error;
  }
}

// Fungsi untuk cari gambar
export async function getImageUrlsByKeyword(keyword) {
  try {
    const { data, error } = await supabase
      .from('images')
      .select('url')
      .ilike('keyword', `%${keyword}%`);

    if (error) throw error;
    return data.map(item => item.url);
  } catch (error) {
    console.error("Error fetching images:", error);
    return [];
  }
}