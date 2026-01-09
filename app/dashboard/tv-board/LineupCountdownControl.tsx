// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\dashboard\tv-board\LineupCountdownControl.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnon);

export default function LineupCountdownControl() {
  const [minutes, setMinutes] = useState<number>(120);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setMsg(null);
    const { data, error } = await supabase
      .from("tv_lineup_settings")
      .select("countdown_lead_minutes")
      .eq("id", "default")
      .maybeSingle();

    if (error) {
      setMsg("Could not load countdown setting.");
      return;
    }

    const n = Number((data as any)?.countdown_lead_minutes);
    if (Number.isFinite(n)) setMinutes(Math.max(0, Math.min(1440, Math.floor(n))));
  }

  async function save() {
    setSaving(true);
    setMsg(null);

    const safe = Math.max(0, Math.min(1440, Math.floor(Number(minutes) || 0)));

    const { error } = await supabase
      .from("tv_lineup_settings")
      .upsert(
        {
          id: "default",
          countdown_lead_minutes: safe,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    setSaving(false);

    if (error) {
      setMsg("Save failed. (Are you logged into the dashboard?)");
      return;
    }

    setMsg("Saved. TV will pick this up automatically.");
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="text-lg font-extrabold text-slate-900">Countdown start window</div>
      <div className="mt-1 text-sm text-slate-600">
        Before the first set begins, the TV countdown will appear only within this many minutes of the first artist.
      </div>

      <div className="mt-4 flex items-center gap-3">
        <input
          type="number"
          min={0}
          max={1440}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className="w-28 rounded-xl border border-slate-300 px-3 py-2 font-bold text-slate-900"
        />
        <div className="text-slate-700 font-semibold">minutes</div>

        <button
          onClick={save}
          disabled={saving}
          className="ml-auto rounded-xl bg-black px-4 py-2 text-white font-extrabold disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {msg ? <div className="mt-3 text-sm font-semibold text-slate-700">{msg}</div> : null}
    </div>
  );
}
