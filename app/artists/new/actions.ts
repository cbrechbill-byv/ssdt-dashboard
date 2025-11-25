"use server";

import { supabaseServer } from "@/lib/supabaseServer";

export async function createArtist(formData: FormData) {
  const supabase = supabaseServer;

  const name = formData.get("name") as string;
  const genre = formData.get("genre") as string;
  const website = formData.get("website") as string | null;
  const instagram = formData.get("instagram") as string | null;
  const bio = formData.get("bio") as string | null;

  const { error } = await supabase.from("artists").insert({
    name,
    genre,
    website,
    instagram,
    bio,
    is_active: true,
  });

  if (error) {
    console.error("Artist insert failed:", error);
    throw new Error(error.message);
  }

  return { success: true };
}
