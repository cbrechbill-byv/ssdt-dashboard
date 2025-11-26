import { NextResponse } from "next/server";
import sharp from "sharp";
import { supabaseServer } from "@/lib/supabaseServer";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "") || "artist";
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const artistName = (formData.get("artistName") || "artist").toString();
    const providedSlug = formData.get("artistSlug")?.toString();

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "No file provided." },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, error: "Only image uploads are allowed." },
        { status: 400 }
      );
    }

    const maxBytes = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxBytes) {
      return NextResponse.json(
        { success: false, error: "Image too large. Max size is 5 MB." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);

    const img = sharp(buffer);
    const metadata = await img.metadata();

    const minWidth = 600;
    const minHeight = 600;

    if (
      (metadata.width && metadata.width < minWidth) ||
      (metadata.height && metadata.height < minHeight)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Image is too small. Minimum size is ${minWidth}x${minHeight}px.`,
        },
        { status: 400 }
      );
    }

    // Resize to 800x800 JPEG
    const resized = await img
      .resize(800, 800, { fit: "cover" })
      .jpeg({ quality: 80 })
      .toBuffer();

    const baseSlug = providedSlug || slugify(artistName);
    const fileName = `${baseSlug}-${Date.now()}.jpg`;

    // Object key *inside* bucket artist-photos
    const objectKey = `artist-photos/${fileName}`;

    const bucket = "artist-photos";

    const { error: uploadError } = await supabaseServer.storage
      .from(bucket)
      .upload(objectKey, resized, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("[Artist upload-image] Supabase upload error:", uploadError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to upload image to storage.",
        },
        { status: 500 }
      );
    }

    // Build a public URL via Supabase (no env guessing on client)
    const { data } = supabaseServer.storage.from(bucket).getPublicUrl(objectKey);
    const publicUrl = data?.publicUrl ?? null;

    // We store the full "bucket/key" path in artists.image_path
    const imagePath = `${bucket}/${fileName}`;

    return NextResponse.json({
      success: true,
      path: imagePath,
      publicUrl,
    });
  } catch (error) {
    console.error("[Artist upload-image] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Unexpected error while uploading image." },
      { status: 500 }
    );
  }
}
