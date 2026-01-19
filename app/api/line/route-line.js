import { Client } from "@line/bot-sdk"
import { createClient } from "@supabase/supabase-js"
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
import { generateAnswer } from "../../../grokmain.cjs"
import "dotenv/config"

export const runtime = "nodejs"

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
}

const client = new Client(lineConfig)

const IMAGE_KEYWORDS = ["圖片", "設施", "游泳池", "健身房", "大廳"]

async function handleCommunityPost(userId, userText, replyToken, existingProfile) {
  // 格式: #投稿 [標題] [內容]
  const content = userText.replace("#投稿", "").trim()
  const lines = content.split("\n")

  if (lines.length < 2) {
    await client.replyMessage(replyToken, {
      type: "text",
      text: "投稿格式錯誤\n\n正確格式：\n#投稿\n標題：您的標題\n內容：您的內容",
    })
    return
  }

  const title = lines[0].replace("標題：", "").replace("標題:", "").trim()
  const postContent = lines.slice(1).join("\n").replace("內容：", "").replace("內容:", "").trim()

  if (!title || !postContent) {
    await client.replyMessage(replyToken, {
      type: "text",
      text: "標題和內容不能為空",
    })
    return
  }

  // 檢查LINE是否已綁定
  const { data: binding } = await supabase
    .from("line_bindings")
    .select("user_id, is_verified")
    .eq("line_user_id", userId)
    .eq("is_verified", true)
    .maybeSingle()

  if (!binding) {
    await client.replyMessage(replyToken, {
      type: "text",
      text: "您尚未綁定帳號或綁定未驗證，請先完成綁定後再投稿",
    })
    return
  }

  // 創建貼文
  const { data: post, error } = await supabase
    .from("community_posts")
    .insert({
      author_id: binding.user_id,
      line_user_id: userId,
      title: title,
      content: postContent,
      post_type: "discussion",
      status: "pending", // 需要審核
      is_anonymous: false,
      created_via: "line",
    })
    .select()
    .single()

  if (error) {
    console.error("創建貼文失敗:", error)
    await client.replyMessage(replyToken, {
      type: "text",
      text: "投稿失敗，請稍後再試",
    })
    return
  }

  await client.replyMessage(replyToken, {
    type: "text",
    text: `投稿成功！\n\n您的貼文已送出審核，審核通過後將會顯示在社區討論板。\n\n貼文編號：${post.id.substring(0, 8)}`,
  })
}

async function handleCommunityQuestion(userId, userText, replyToken) {
  // 格式: #問答 [問題]
  const question = userText.replace("#問答", "").trim()

  if (!question) {
    await client.replyMessage(replyToken, {
      type: "text",
      text: "請輸入您的問題\n\n範例：#問答 社區什麼時候可以使用游泳池？",
    })
    return
  }

  // 先搜尋知識庫
  const { data: cards } = await supabase
    .from("knowledge_cards")
    .select("title, summary, content")
    .eq("status", "published")
    .textSearch("title", question)
    .limit(3)

  let replyText = "以下是相關的知識卡片：\n\n"

  if (cards && cards.length > 0) {
    cards.forEach((card, index) => {
      replyText += `${index + 1}. ${card.title}\n${card.summary}\n\n`
    })
    replyText += "\n如需更多資訊，請前往社區討論板查看完整內容。"
  } else {
    // 使用 LLM 回答
    try {
      const answer = await generateAnswer(question)
      replyText = typeof answer === "string" ? answer.trim() : "目前沒有找到相關資訊，您可以在社區討論板發文詢問。"
    } catch (err) {
      console.error("LLM 查詢失敗:", err)
      replyText = "查詢失敗，請稍後再試或在社區討論板發文詢問。"
    }
  }

  await client.replyMessage(replyToken, {
    type: "text",
    text: replyText,
  })
}

async function handleReportContent(userId, userText, replyToken) {
  // 格式: #檢舉 [貼文ID/留言ID] [原因]
  const content = userText.replace("#檢舉", "").trim()
  const parts = content.split(" ")

  if (parts.length < 2) {
    await client.replyMessage(replyToken, {
      type: "text",
      text: "檢舉格式錯誤\n\n正確格式：\n#檢舉 [貼文ID] [原因]\n\n範例：#檢舉 abc123 內容不實",
    })
    return
  }

  const targetId = parts[0]
  const reason = parts.slice(1).join(" ")

  // 檢查LINE是否已綁定
  const { data: binding } = await supabase
    .from("line_bindings")
    .select("user_id")
    .eq("line_user_id", userId)
    .eq("is_verified", true)
    .maybeSingle()

  if (!binding) {
    await client.replyMessage(replyToken, {
      type: "text",
      text: "您尚未綁定帳號，請先完成綁定後再進行檢舉",
    })
    return
  }

  // 檢查貼文是否存在
  const { data: post } = await supabase.from("community_posts").select("id").eq("id", targetId).maybeSingle()

  if (!post) {
    await client.replyMessage(replyToken, {
      type: "text",
      text: "找不到該貼文，請確認貼文ID是否正確",
    })
    return
  }

  // 創建檢舉
  const { error } = await supabase.from("reports").insert({
    reporter_id: binding.user_id,
    target_type: "post",
    target_id: targetId,
    reason: reason,
    status: "pending",
  })

  if (error) {
    console.error("創建檢舉失敗:", error)
    await client.replyMessage(replyToken, {
      type: "text",
      text: "檢舉失敗，請稍後再試",
    })
    return
  }

  await client.replyMessage(replyToken, {
    type: "text",
    text: "檢舉已送出，我們會盡快處理。感謝您協助維護社區環境。",
  })
}

export async function POST(req) {
  try {
    const rawBody = await req.text()
    if (!rawBody) return new Response("Bad Request: Empty body", { status: 400 })

    let events
    try {
      events = JSON.parse(rawBody).events
    } catch {
      return new Response("Bad Request: Invalid JSON", { status: 400 })
    }

    for (const event of events) {
      const userId = event.source?.userId
      if (!userId) continue

      let profile = { displayName: "", pictureUrl: "", statusMessage: "" }
      try {
        profile = await client.getProfile(userId)
      } catch (err) {
        console.warn("⚠️ 無法抓到 profile，只存 userId。", err)
      }

      const { data: existingProfile, error: checkError } = await supabase
        .from("profiles")
        .select("id, line_user_id, line_display_name, line_avatar_url, line_status_message")
        .eq("line_user_id", userId)
        .maybeSingle()

      if (checkError) {
        console.error("❌ Supabase 檢查錯誤:", checkError)
      }

      const profileChanged =
        !existingProfile ||
        existingProfile.line_display_name !== (profile.displayName || "") ||
        existingProfile.line_avatar_url !== (profile.pictureUrl || "") ||
        existingProfile.line_status_message !== (profile.statusMessage || "")

      if (event.type === "follow" || profileChanged) {
        const upsertProfile = {
          line_user_id: userId,
          line_display_name: profile.displayName || "",
          line_avatar_url: profile.pictureUrl || "",
          line_status_message: profile.statusMessage || "",
          email: userId + "@line.local",
          password: userId,
          updated_at: new Date().toISOString(),
        }
        if (existingProfile?.id) upsertProfile.id = existingProfile.id
        const { error: upsertError } = await supabase
          .from("profiles")
          .upsert([upsertProfile], { onConflict: "line_user_id" })

        if (upsertError) console.error("❌ Supabase upsert 錯誤:", upsertError)
      }

      if (event.type === "message" && event.message.type === "text") {
        const userText = event.message.text.trim()
        const replyToken = event.replyToken
        console.log("📩 使用者輸入:", userText)

        // 1. 投稿功能
        if (userText.startsWith("#投稿")) {
          await handleCommunityPost(userId, userText, replyToken, existingProfile)
          continue
        }

        // 2. 問答功能
        if (userText.startsWith("#問答")) {
          await handleCommunityQuestion(userId, userText, replyToken)
          continue
        }

        // 3. 檢舉功能
        if (userText.startsWith("#檢舉")) {
          await handleReportContent(userId, userText, replyToken)
          continue
        }

        // 4. 幫助指令
        if (userText === "#幫助" || userText === "幫助" || userText === "help") {
          const helpMessage = {
            type: "flex",
            altText: "功能說明",
            contents: {
              type: "bubble",
              body: {
                type: "box",
                layout: "vertical",
                contents: [
                  {
                    type: "text",
                    text: "社區討論板功能",
                    weight: "bold",
                    size: "xl",
                    margin: "md",
                  },
                  {
                    type: "separator",
                    margin: "lg",
                  },
                  {
                    type: "box",
                    layout: "vertical",
                    margin: "lg",
                    spacing: "sm",
                    contents: [
                      {
                        type: "text",
                        text: "#投稿\n標題：您的標題\n內容：您的內容",
                        size: "sm",
                        wrap: true,
                        color: "#666666",
                      },
                      {
                        type: "text",
                        text: "#問答 您的問題",
                        size: "sm",
                        wrap: true,
                        color: "#666666",
                        margin: "md",
                      },
                      {
                        type: "text",
                        text: "#檢舉 [貼文ID] [原因]",
                        size: "sm",
                        wrap: true,
                        color: "#666666",
                        margin: "md",
                      },
                      {
                        type: "text",
                        text: "公共設施 - 查看設施資訊",
                        size: "sm",
                        wrap: true,
                        color: "#666666",
                        margin: "md",
                      },
                    ],
                  },
                ],
              },
            },
          }
          await client.replyMessage(replyToken, helpMessage)
          continue
        }

        if (userText.includes("vote:")) {
          try {
            const parts = userText.split(":")
            if (parts.length < 3) {
              await client.replyMessage(replyToken, { type: "text", text: "投票訊息格式錯誤" })
              continue
            }

            const voteIdFromMsg = parts[1].trim()
            const option_selected = parts[2].replace("🗳️", "").trim()

            const { data: voteExists } = await supabase.from("votes").select("id").eq("id", voteIdFromMsg).maybeSingle()

            if (!voteExists) {
              await client.replyMessage(replyToken, { type: "text", text: "投票已過期或不存在" })
              continue
            }

            const vote_id = voteExists.id
            const user_id = existingProfile?.id
            const user_name = existingProfile?.line_display_name

            if (!user_id) {
              await client.replyMessage(replyToken, { type: "text", text: "找不到住戶資料" })
              continue
            }

            const { data: existingVote } = await supabase
              .from("vote_records")
              .select("id")
              .eq("vote_id", vote_id)
              .eq("user_id", user_id)
              .maybeSingle()

            if (existingVote) {
              await client.replyMessage(replyToken, { type: "text", text: "您已經投過票" })
              continue
            }

            const { error: voteError } = await supabase.from("vote_records").insert([
              {
                vote_id,
                user_id,
                user_name,
                option_selected,
                voted_at: new Date().toISOString(),
              },
            ])

            if (voteError) {
              console.error("❌ 投票寫入失敗:", voteError)
              await client.replyMessage(replyToken, { type: "text", text: "投票失敗" })
              continue
            }

            await client.replyMessage(replyToken, { type: "text", text: `確認，您的投票結果為「${option_selected}」` })
          } catch (err) {
            console.error("❌ 投票處理失敗:", err)
          }
          continue
        }

        if (userText.includes("公共設施")) {
          const carouselMessage = {
            type: "flex",
            altText: "公共設施資訊",
            contents: {
              type: "carousel",
              contents: [
                {
                  type: "bubble",
                  hero: {
                    type: "image",
                    url: "https://today-obs.line-scdn.net/0h-NdfKUUZcmFZH1sCDogNNmNJcQ5qc2FiPSkjYhpxLFUjLjAzNSs8D3pKfgZ1KTU_Ny44D34WaVAmKjQ-ZSo8/w1200",
                    size: "full",
                    aspectRatio: "20:13",
                    aspectMode: "cover",
                  },
                  body: {
                    type: "box",
                    layout: "vertical",
                    contents: [{ type: "text", text: "健身房\n開放時間：06:00 - 22:00", wrap: true }],
                  },
                },
                {
                  type: "bubble",
                  hero: {
                    type: "image",
                    url: "https://www.ytyut.com/uploads/news/1000/3/d3156e6f-9126-46cd.jpg",
                    size: "full",
                    aspectRatio: "20:13",
                    aspectMode: "cover",
                  },
                  body: {
                    type: "box",
                    layout: "vertical",
                    contents: [{ type: "text", text: "游泳池\n開放時間：08:00 - 20:00", wrap: true }],
                  },
                },
                {
                  type: "bubble",
                  hero: {
                    type: "image",
                    url: "https://www.gogo-engineering.com/store_image/ydplan/file/D1695800312494.jpg",
                    size: "full",
                    aspectRatio: "20:13",
                    aspectMode: "cover",
                  },
                  body: {
                    type: "box",
                    layout: "vertical",
                    contents: [{ type: "text", text: "大廳\n開放時間：全天", wrap: true }],
                  },
                },
              ],
            },
          }

          await client.replyMessage(replyToken, carouselMessage)
          continue
        }

        if (IMAGE_KEYWORDS.some((kw) => userText.includes(kw))) {
          await client.replyMessage(replyToken, { type: "text", text: "目前圖片查詢功能尚未啟用。" })
          continue
        }

        try {
          const answer = await generateAnswer(userText)
          const replyMessage = typeof answer === "string" ? answer.trim() : "目前沒有找到相關資訊，請查看社區公告。"
          await client.replyMessage(replyToken, { type: "text", text: replyMessage })
        } catch (err) {
          console.error("查詢 LLM API 失敗:", err)
          await client.replyMessage(replyToken, { type: "text", text: "查詢失敗，請稍後再試。" })
        }
      }
    }

    return new Response("OK", { status: 200 })
  } catch (err) {
    console.error("Webhook error:", err)
    return new Response("Internal Server Error", { status: 500 })
  }
}

export async function GET() {
  return new Response("Method Not Allowed", { status: 405 })
}
