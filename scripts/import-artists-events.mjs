#!/usr/bin/env node
/**
 * SSDT Fresh – Patch existing artist_events with end_time
 *
 * Uses the same artists.json source as the original import.
 * Updates start_time and end_time per (artist, isoDate).
 *
 * Run from ssdt-dashboard root:
 *   node scripts/patch-event-times.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load env vars from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Parse "7:00-10:00 PM" or "1:00-4:00 pm"
function parseTimeRange(timeStr) {
  if (!timeStr) return { start: null, end: null };

  const re =
    /^\s*(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?\s*$/;
  const match = timeStr.match(re);
  if (!match) {
    console.warn("⚠️ Could not parse time range:", timeStr);
    return { start: null, end: null };
  }

  let [
    ,
    h1,
    m1,
    ampm1,
    h2,
    m2,
    ampm2,
  ] = match;

  // If first half missing AM/PM, assume same as second half
  if (!ampm1 && ampm2) {
    ampm1 = ampm2;
  }

  function to24h(hRaw, mRaw, ampmRaw) {
    let hour = parseInt(hRaw, 10);
    const minute = parseInt(mRaw, 10);
    const ampm = ampmRaw ? ampmRaw.toUpperCase() : null;

    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;

    const hh = hour.toString().padStart(2, "0");
    const mm = minute.toString().padStart(2, "0");
    return `${hh}:${mm}:00`;
  }

  const start = to24h(h1, m1, ampm1);
  const end = to24h(h2, m2, ampm2 || ampm1);

  return { start, end };
}

async function main() {
  console.log("🔄 SSDT patch: event start/end times");

  const dashboardRoot = process.cwd();
  const artistsPath = path.resolve(
    dashboardRoot,
    "..",
    "ssdt",
    "data",
    "artists.json"
  );

  console.log("📄 Reading artists.json from:", artistsPath);
  const raw = await fs.readFile(artistsPath, "utf8");
  const artistsJson = JSON.parse(raw);

  if (!Array.isArray(artistsJson)) {
    throw new Error("artists.json is not an array");
  }

  // Get all artists from DB
  console.log("📡 Fetching artists from Supabase...");
  const { data: dbArtists, error: dbArtistsErr } = await supabase
    .from("artists")
    .select("id, name");

  if (dbArtistsErr) {
    console.error("❌ Error fetching artists from DB:", dbArtistsErr);
    process.exit(1);
  }

  const artistIdByName = {};
  for (const row of dbArtists) {
    artistIdByName[row.name] = row.id;
  }

  console.log(`🔗 Found ${dbArtists.length} artists in DB.`);

  let updatedCount = 0;
  let skippedNoMatch = 0;

  for (const artist of artistsJson) {
    const artistId = artistIdByName[artist.name];
    if (!artistId) {
      console.warn(`⚠️ No DB artist for "${artist.name}", skipping events.`);
      skippedNoMatch++;
      continue;
    }

    if (!Array.isArray(artist.events)) continue;

    for (const evt of artist.events) {
      const eventDate = evt.isoDate;
      const timeRange = evt.time;

      if (!eventDate) {
        console.warn(
          `⚠️ Event missing isoDate for artist "${artist.name}", skipping.`
        );
        continue;
      }

      const { start, end } = parseTimeRange(timeRange);
      if (!start && !end) {
        console.warn(
          `⚠️ Could not parse start/end for "${artist.name}" on ${eventDate}: ${timeRange}`
        );
        continue;
      }

      const { error: updateErr } = await supabase
        .from("artist_events")
        .update({
          start_time: start,
          end_time: end,
        })
        .eq("artist_id", artistId)
        .eq("event_date", eventDate);

      if (updateErr) {
        console.error(
          `❌ Error updating event for "${artist.name}" on ${eventDate}:`,
          updateErr
        );
      } else {
        updatedCount++;
      }
    }
  }

  console.log(`✅ Updated ${updatedCount} event rows with start/end times.`);
  if (skippedNoMatch > 0) {
    console.log(
      `ℹ️ Skipped ${skippedNoMatch} artists with no DB match (name mismatch or not imported).`
    );
  }

  console.log("🎉 Patch complete.");
}

main().catch((err) => {
  console.error("Unexpected error in patch script:", err);
  process.exit(1);
});
