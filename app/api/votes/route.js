import { createClient } from "@supabase/supabase-js";
import { Client } from "@line/bot-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ✅ 延後到 request 才建立，避免 build 階段就因 env 缺而爆
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("supabaseUrl is required. Missing SUPABASE_URL or SUPABASE_ANON_KEY.");
  }
  return createClient(url, serviceRoleKey || anonKey);
}

// ✅ LINE client 也改成延後建立（同樣避免 env 缺直接炸）
function getLineClient() {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;

  if (!channelAccessToken || !channelSecret) {
    throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN or LINE_CHANNEL_SECRET.");
  }

  return new Client({ channelAccessToken, channelSecret });
}

// 從資料庫撈出所有已綁定 LINE 的住戶 ID
async function getAllLineUserIds(supabase) {
  const lineUserIds = new Set();

  try {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("line_user_id")
      .not("line_user_id", "is", null);
    (profiles || []).forEach((p) => {
      if (p.line_user_id) lineUserIds.add(p.line_user_id);
    });
  } catch (e) {
    console.warn("[Votes] profiles lookup failed:", e);
  }

  try {
    const { data: lineUsers } = await supabase
      .from("line_users")
      .select("line_user_id")
      .not("line_user_id", "is", null);
    (lineUsers || []).forEach((u) => {
      if (u.line_user_id) lineUserIds.add(u.line_user_id);
    });
  } catch (e) {
    console.warn("[Votes] line_users lookup failed:", e);
  }

  return [...lineUserIds];
}

function normalizeOptions(raw) {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return normalizeOptions(parsed);
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean);
  }
  if (raw && typeof raw === "object" && Array.isArray(raw.options)) {
    return raw.options.map((item) => String(item).trim()).filter(Boolean);
  }
  return [];
}

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function formatLineDateTime(value) {
  if (!value) return "未設定";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    hour12: false,
  });
}

function getSystemBaseUrl() {
  const fixedProductionUrl = "https://next-js-zdx3399.vercel.app";

  const direct =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "";

  if (direct) {
    return direct.replace(/\/$/, "");
  }

  return fixedProductionUrl;
}

function mapVoteRow(row) {
  const rawOptions = row?.options;
  const options = normalizeOptions(rawOptions);
  let parsedObject = null;
  if (typeof rawOptions === "string") {
    try {
      const parsed = JSON.parse(rawOptions);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        parsedObject = parsed;
      }
    } catch {}
  }

  const fallbackUrlFromDescription = typeof row?.description === "string" ? row.description.match(/https?:\/\/[^\s]+/)?.[0] : "";
  const externalUrl =
    (rawOptions && typeof rawOptions === "object" && !Array.isArray(rawOptions) && rawOptions.external_url) ||
    parsedObject?.external_url ||
    "";
  const finalExternalUrl = externalUrl || row?.vote_url || row?.form_url || fallbackUrlFromDescription || "";

  const mode = finalExternalUrl ? "external" : "internal";

  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    author: row.author || "管委會",
    created_by: row.created_by || null,
    status: row.status || "active",
    ends_at: row.ends_at || null,
    created_at: row.created_at,
    mode,
    external_url: finalExternalUrl || undefined,
    options: options.length > 0 ? options : ["同意", "反對", "棄權"],
  };
}

async function handleVoteFromLineMessage({ supabase, body }) {
  const line_user_id = body.line_user_id;

  const parts = body.vote_message.split(":");
  if (parts.length < 3) {
    return Response.json({ error: "投票訊息格式錯誤" }, { status: 400 });
  }

  const voteIdFromMsg = parts[1].trim();
  const option_selected = parts[2].replace("🗳️", "").trim();

  const { data: voteExists, error: voteExistsErr } = await supabase
    .from("votes")
    .select("id")
    .eq("id", voteIdFromMsg)
    .single();

  if (voteExistsErr || !voteExists) {
    return Response.json({ error: "投票已過期或不存在，請點擊最新投票訊息" }, { status: 400 });
  }

  const vote_id = voteExists.id;

  const { data: userProfile, error: userError } = await supabase
    .from("line_users")
    .select("display_name, profile_id")
    .eq("line_user_id", line_user_id)
    .single();

  if (userError || !userProfile || !userProfile.profile_id) {
    return Response.json({ error: "找不到住戶資料" }, { status: 400 });
  }

  const user_id = userProfile.profile_id;
  const user_name = userProfile.display_name;

  const { data: existingVote, error: existingVoteErr } = await supabase
    .from("vote_records")
    .select("id")
    .eq("vote_id", vote_id)
    .eq("user_id", user_id)
    .maybeSingle();

  if (existingVoteErr) {
    return Response.json({ error: "系統錯誤，請稍後再試" }, { status: 500 });
  }

  if (existingVote) {
    return Response.json({ error: "您已經投過票，不能重複投票" }, { status: 400 });
  }

  const { error: recordError } = await supabase.from("vote_records").insert([
    {
      vote_id,
      user_id,
      user_name,
      option_selected,
      voted_at: new Date().toISOString(),
    },
  ]);

  if (recordError) {
    return Response.json({ error: "投票失敗", details: recordError.message }, { status: 500 });
  }

  return Response.json({ success: true, message: `確認，您的投票結果為「${option_selected}」` });
}

async function handleSubmitVote({ supabase, body }) {
  const { vote_id, user_id, user_name, option_selected } = body;

  if (!vote_id || !user_id || !option_selected) {
    return Response.json({ error: "vote_id、user_id、option_selected 為必填" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data: vote, error: voteError } = await supabase
    .from("votes")
    .select("id, status, ends_at")
    .eq("id", vote_id)
    .single();

  if (voteError || !vote) {
    return Response.json({ error: "投票不存在" }, { status: 404 });
  }

  if (vote.status !== "active" || (vote.ends_at && vote.ends_at <= now)) {
    return Response.json({ error: "投票已截止" }, { status: 400 });
  }

  const { data: existingVote, error: existingVoteErr } = await supabase
    .from("vote_records")
    .select("id")
    .eq("vote_id", vote_id)
    .eq("user_id", user_id)
    .maybeSingle();

  if (existingVoteErr) {
    return Response.json({ error: "查詢投票紀錄失敗" }, { status: 500 });
  }
  if (existingVote) {
    return Response.json({ error: "您已經投過票了" }, { status: 409 });
  }

  const { error: insertError } = await supabase.from("vote_records").insert([
    {
      vote_id,
      user_id,
      user_name: user_name || "住戶",
      option_selected,
      voted_at: now,
    },
  ]);

  if (insertError) {
    if (insertError.code === "23505") {
      return Response.json({ error: "您已經投過票了" }, { status: 409 });
    }
    return Response.json({ error: "投票失敗", details: insertError.message }, { status: 500 });
  }

  return Response.json({ success: true });
}

async function handleCreateVote({ supabase, body }) {
  const { title, description, author, created_by, ends_at, mode, external_url, options, test } = body;

  if (!title || !ends_at) {
    return Response.json({ error: "title、ends_at 為必填" }, { status: 400 });
  }

  const finalMode = mode === "external" ? "external" : "internal";
  const normalizedOptions = normalizeOptions(options);

  if (finalMode === "external" && !external_url) {
    return Response.json({ error: "連結模式需要 external_url" }, { status: 400 });
  }

  if (finalMode === "internal" && normalizedOptions.length < 2) {
    return Response.json({ error: "內部投票至少需要 2 個選項" }, { status: 400 });
  }

  const dbOptions =
    finalMode === "external"
      ? {
          type: "external",
          external_url,
          options: [],
        }
      : normalizedOptions;

  const safeCreatedBy = isUuid(created_by) ? created_by : null;

  const insertPayload = {
    title,
    description: description || "",
    options: dbOptions,
    created_at: new Date().toISOString(),
    ends_at,
    status: "active",
    author: author || "管委會",
    created_by: safeCreatedBy,
  };

  const tryInsertVote = async (payload) => {
    return supabase.from("votes").insert([payload]).select("*").single();
  };

  const pruneMissingColumnAndRetry = async (payload, maxRetry = 4) => {
    let nextPayload = { ...payload };
    let result = await tryInsertVote(nextPayload);

    for (let i = 0; i < maxRetry && result.error; i++) {
      const message = String(result.error.message || "");
      const missingColumnMatch = message.match(/Could not find the '([^']+)' column/i);
      if (!missingColumnMatch) break;

      const missingColumn = missingColumnMatch[1];
      if (!(missingColumn in nextPayload)) break;

      delete nextPayload[missingColumn];
      result = await tryInsertVote(nextPayload);
    }

    return result;
  };

  let { data: inserted, error: insertError } = await pruneMissingColumnAndRetry(insertPayload);

  if (insertError) {
    const message = String(insertError.message || "");
    const maybeOptionsTypeIssue = /type text|character varying|varchar/i.test(message);

    if (maybeOptionsTypeIssue) {
      const fallbackPayload = {
        ...insertPayload,
        options: JSON.stringify(dbOptions),
      };

      const retry = await supabase.from("votes").insert([fallbackPayload]).select("*").single();
      inserted = retry.data;
      insertError = retry.error;
    }
  }

  if (insertError) {
    return Response.json({ error: "投票儲存失敗", details: insertError.message }, { status: 500 });
  }

  if (test === true) {
    return Response.json({ success: true, vote: mapVoteRow(inserted), pushed: 0, failed: 0 });
  }

  let client;
  try {
    client = getLineClient();
  } catch (lineErr) {
    console.warn("[Votes] LINE client not available, skip push:", lineErr?.message);
    return Response.json({ success: true, vote: mapVoteRow(inserted), pushed: 0, failed: 0 });
  }

  const lineUserIds = await getAllLineUserIds(supabase);
  if (lineUserIds.length === 0) {
    return Response.json({ success: true, vote: mapVoteRow(inserted), pushed: 0, failed: 0 });
  }

  const internalVoteLink = `${getSystemBaseUrl()}/dashboard`;

  const text =
    finalMode === "external"
      ? `📢 新問卷通知\n標題：${title}\n截止時間：${formatLineDateTime(ends_at)}\n請點擊下方連結填寫：\n${external_url}`
      : `📢 新投票通知\n標題：${title}\n截止時間：${formatLineDateTime(ends_at)}\n${description || "請至社區系統參與投票"}\n\n系統投票入口：\n${internalVoteLink}\n(進入後點選「社區投票」)`;

  let totalSent = 0;
  let totalFailed = 0;
  for (const lineUserId of lineUserIds) {
    try {
      await client.pushMessage(lineUserId, { type: "text", text });
      totalSent++;
    } catch {
      totalFailed++;
    }
  }

  return Response.json({ success: true, vote: mapVoteRow(inserted), pushed: totalSent, failed: totalFailed });
}

async function handleCloseVote({ supabase, body }) {
  const { vote_id } = body;

  if (!vote_id) {
    return Response.json({ error: "vote_id 為必填" }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("votes")
    .update({ status: "closed" })
    .eq("id", vote_id)
    .select("*")
    .single();

  if (error) {
    return Response.json({ error: "關閉投票失敗", details: error.message }, { status: 500 });
  }

  return Response.json({ success: true, vote: mapVoteRow(updated) });
}

export async function POST(req) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    if (body.vote_message && typeof body.vote_message === "string") {
      return handleVoteFromLineMessage({ supabase, body });
    }

    if (body.action === "submit") {
      return handleSubmitVote({ supabase, body });
    }

    if (body.action === "close") {
      return handleCloseVote({ supabase, body });
    }

    if (body.action === "create" || body.title) {
      return handleCreateVote({ supabase, body });
    }

    return Response.json({ error: "不支援的操作" }, { status: 400 });
  } catch (err) {
    console.error("votes POST 錯誤:", err);
    return Response.json(
      { error: "Internal Server Error", details: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope") || "all";
    const userId = searchParams.get("userId");
    const withResults = searchParams.get("withResults") === "1";

    let query = supabase.from("votes").select("*").order("created_at", { ascending: false });

    if (scope === "active") {
      query = query.eq("status", "active").gt("ends_at", new Date().toISOString());
    }

    const { data: votesData, error: votesError } = await query;
    if (votesError) {
      return Response.json({ error: "讀取投票失敗", details: votesError.message }, { status: 500 });
    }

    const mappedVotes = (votesData || []).map(mapVoteRow);

    let votedVoteIds = [];
    if (userId) {
      const { data: records, error: recordErr } = await supabase
        .from("vote_records")
        .select("vote_id")
        .eq("user_id", userId);

      if (!recordErr) {
        votedVoteIds = (records || []).map((r) => r.vote_id);
      }
    }

    if (withResults && mappedVotes.length > 0) {
      const voteIds = mappedVotes.map((vote) => vote.id);
      const { data: records, error: resultErr } = await supabase
        .from("vote_records")
        .select("vote_id, option_selected")
        .in("vote_id", voteIds);

      if (!resultErr && records) {
        const resultMap = new Map();
        for (const record of records) {
          const current = resultMap.get(record.vote_id) || { total: 0, counts: {} };
          current.total += 1;
          current.counts[record.option_selected] = (current.counts[record.option_selected] || 0) + 1;
          resultMap.set(record.vote_id, current);
        }

        for (const vote of mappedVotes) {
          const result = resultMap.get(vote.id) || { total: 0, counts: {} };
          vote.total_votes = result.total;
          vote.results = result.counts;
        }
      }
    }

    return Response.json({ votes: mappedVotes, votedVoteIds });
  } catch (err) {
    console.error("votes GET 錯誤:", err);
    return Response.json(
      { error: "Internal Server Error", details: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
