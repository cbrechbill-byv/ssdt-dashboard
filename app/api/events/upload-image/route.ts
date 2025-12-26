import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

export const runtime = "nodejs";

const MIN_SIZE = 600;
const TARGET_SIZE = 900; // nice for retina; still small enough
const BUCKET = "events";

function okJson(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function errJson(message: string, status = 400, extra?: any) {
  return NextResponse.json({ success: false, error: message, ...extra }, { status });
}

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false },
  });
}

function makePublicUrl(path: string) {
  // path looks like: "events/<eventId>/cover.jpg"
  const parts = path.split("/");
  const bucket = parts[0];
  const key = parts.slice(1).join("/");
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${bucket}/${key}`;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const file = formData.get("file") as File | null;
    const eventId = (formData.get("eventId")?.toString() || "").trim();
    const eventTitle = (formData.get("eventTitle")?.toString() || "Event").trim();

    if (!file) return errJson("No file uploaded.");
    if (!eventId) return errJson("Missing eventId. Save the event first.");

    if (!file.type.startsWith("image/")) {
      return errJson("Please choose an image file (JPEG or PNG).");
    }

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      return errJson("Image is too large. Max size is 5 MB.");
    }

    const arrayBuffer = await file.arrayBuffer();
    const input = Buffer.from(arrayBuffer);

    // Read metadata & validate size
    let meta;
    try {
      meta = await sharp(input).metadata();
    } catch {
      return errJson("Could not read image. Please try a different file.");
    }

    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    if (width < MIN_SIZE || height < MIN_SIZE) {
      return errJson(`Image is too small. Minimum is ${MIN_SIZE}×${MIN_SIZE}.`);
    }

    // Resize to square (cover) + output jpg
    const output = await sharp(input)
      .rotate() // respect EXIF
      .resize(TARGET_SIZE, TARGET_SIZE, { fit: "cover" })
      .jpeg({ quality: 85 })
      .toBuffer();

    const safeName = eventTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "event";

    const objectKey = `${eventId}/${safeName}.jpg`;
    const fullPath = `${BUCKET}/${objectKey}`;

    const supabase = getAdminSupabase();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(objectKey, output, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("[events/upload-image] upload error", uploadError);
      return errJson(uploadError.message || "Upload failed.");
    }

    return okJson({
      success: true,
      path: fullPath, // "events/<eventId>/<slug>.jpg"
      publicUrl: makePublicUrl(fullPath),
    });
  } catch (e: any) {
    console.error("[events/upload-image] exception", e);
    return errJson(e?.message || "Unexpected upload error.", 500);
  }
}
