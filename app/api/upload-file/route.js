import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "public-files";
const ALLOWED_EXTS = [
  "pdf",
  "csv",
  "txt",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "zip",
  "rar",
  "7z",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
];

function sanitizeFolder(folder) {
  if (typeof folder !== "string") return "votes/results";
  return /^[a-z0-9-_/]+$/i.test(folder) ? folder : "votes/results";
}

function getSafeExt(fileName) {
  const ext = String(fileName || "").split(".").pop()?.toLowerCase() || "";
  return ALLOWED_EXTS.includes(ext) ? ext : "";
}

export async function POST(req) {
  try {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      return Response.json({ error: "Missing Supabase configuration" }, { status: 500 });
    }

    const supabase = createClient(url, serviceRoleKey || anonKey);
    const formData = await req.formData();
    const file = formData.get("file");
    const folder = sanitizeFolder(formData.get("folder"));

    if (!file || typeof file === "string") {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = getSafeExt(file.name);
    if (!ext) {
      return Response.json({ error: "不支援的檔案格式" }, { status: 400 });
    }

    const maxSize = 20 * 1024 * 1024;
    if (typeof file.size === "number" && file.size > maxSize) {
      return Response.json({ error: "檔案大小不可超過 20MB" }, { status: 400 });
    }

    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === BUCKET);
    if (!bucketExists) {
      await supabase.storage.createBucket(BUCKET, { public: true });
    }

    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(fileName, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    if (uploadError) {
      return Response.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    return Response.json({
      url: publicData.publicUrl,
      fileName: file.name,
      path: fileName,
    });
  } catch (err) {
    return Response.json({ error: err?.message || "上傳失敗" }, { status: 500 });
  }
}
