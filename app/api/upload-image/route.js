import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const folder = formData.get("folder");

    if (!file || typeof file === "string") {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    const originalName = file.name || "image.jpg";
    const ext = originalName.split(".").pop()?.toLowerCase() || "jpg";
    const allowedExts = ["jpg", "jpeg", "png", "gif", "webp"];
    if (!allowedExts.includes(ext)) {
      return Response.json({ error: "不支援的圖片格式，請使用 jpg/png/gif/webp" }, { status: 400 });
    }

    const folderName = typeof folder === "string" && /^[a-z0-9-_/]+$/i.test(folder) ? folder : "announcements";
    const fileName = `${folderName}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const BUCKET = "public-images";

    // 確保 bucket 存在，若不存在則自動建立
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === BUCKET);
    if (!bucketExists) {
      console.log("[UploadImage] ⚙️  bucket 不存在，自動建立...");
      const { error: createErr } = await supabase.storage.createBucket(BUCKET, { public: true });
      if (createErr) {
        console.error("[UploadImage] ❌ 建立 bucket 失敗:", createErr.message);
        // 建立失敗時嘗試直接上傳（可能 bucket 已被別人建立）
      } else {
        console.log("[UploadImage] ✅ bucket 建立成功");
      }
    }

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, buffer, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("[UploadImage] ❌ 上傳失敗:", uploadError.message);
      return Response.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: publicData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(fileName);

    console.log("[UploadImage] ✅ 上傳成功:", publicData.publicUrl);
    return Response.json({ url: publicData.publicUrl });
  } catch (err) {
    console.error("[UploadImage] 💥 錯誤:", err?.message);
    return Response.json({ error: err?.message || "上傳失敗" }, { status: 500 });
  }
}
