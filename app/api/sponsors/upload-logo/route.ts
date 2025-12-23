import { NextResponse } from "next/server";
import sharp from "sharp";
import { supabaseServer } from "@/lib/supabaseServer";

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "") || "sponsor"
  );
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const sponsorName = (formData.get("sponsorName") || "sponsor").toString();
    const providedSlug = formData.get("sponsorSlug")?.toString();

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "No file provided." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ success: false, error: "Only image uploads are allowed." }, { status: 400 });
    }

    const maxBytes = 5 * 1024 * 1024; // 5 MB (match artist route)
    if (file.size > maxBytes) {
      return NextResponse.json({ success: false, error: "Image too large. Max size is 5 MB." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const img = sharp(buffer);
    const metadata = await img.metadata();

    const minWidth = 600;
    const minHeight = 600;

    if ((metadata.width && metadata.width < minWidth) || (metadata.height && metadata.height < minHeight)) {
      return NextResponse.json(
        { success: false, error: `Image is too small. Minimum size is ${minWidth}x${minHeight}px.` },
        { status: 400 }
      );
    }

    // ✅ Sponsor logo normalization (server-side, same pattern as artists):
    // - Normalize to square output for consistent app rendering
    // - Use PNG to preserve transparency for logos
    const resized = await img
      .resize(1024, 1024, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 }, // transparent padding
      })
      .png({ quality: 90 })
      .toBuffer();

    const baseSlug = providedSlug || slugify(sponsorName);
    const fileName = `${baseSlug}-${Date.now()}.png`;

    const bucket = "sponsor-logos";
    const key = fileName; // key INSIDE the bucket

    const { error: uploadError } = await supabaseServer.storage.from(bucket).upload(key, resized, {
      contentType: "image/png",
      upsert: true,
    });

    if (uploadError) {
      console.error("[Sponsor upload-logo] Supabase upload error:", uploadError);
      return NextResponse.json({ success: false, error: "Failed to upload logo to storage." }, { status: 500 });
    }

    const { data } = supabaseServer.storage.from(bucket).getPublicUrl(key);
    const publicUrl = data?.publicUrl ?? null;

    return NextResponse.json({
      success: true,
      key, // store this in sponsors.logo_path
      publicUrl,
    });
  } catch (error) {
    console.error("[Sponsor upload-logo] Unexpected error:", error);
    return NextResponse.json({ success: false, error: "Unexpected error while uploading logo." }, { status: 500 });
  }
}
