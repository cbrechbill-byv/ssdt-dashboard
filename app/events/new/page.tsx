import { revalidatePath } from "next/cache";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import { logDashboardEventServer } from "@/lib/logDashboardEventServer";

export default async function NewEventPage() {
  async function createEvent(formData: FormData) {
    "use server";

    const supabase = supabaseServer;

    const title = formData.get("title")?.toString().trim() || "";
    const description = formData.get("description")?.toString().trim() || null;
    const start_time = formData.get("start_time")?.toString() || null;
    const end_time = formData.get("end_time")?.toString() || null;
    const artist_id = formData.get("artist_id")?.toString() || null;

    if (!title) throw new Error("Title is required");

    const payload = {
      title,
      description,
      start_time,
      end_time,
      artist_id,
    };

    const { data, error } = await supabase
      .from("events")
      .insert(payload)
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    const eventId = data.id;

    // 🔐 AUDIT LOG — CREATE EVENT
    await logDashboardEventServer({
      action: "create",
      entity: "events",
      entityId: eventId,
      details: payload,
    });

    revalidatePath("/events");
    redirect("/events");
  }

  // Fetch artists for dropdown
  const { data: artists } = await supabaseServer
    .from("artists")
    .select("id, name")
    .order("name", { ascending: true });

  return (
    <DashboardShell title="Events" subtitle="Create new event" activeTab="events">
      <div className="max-w-xl mx-auto bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Add New Event</h2>

        <form action={createEvent} className="space-y-4">

          <div>
            <label className="text-xs font-semibold block mb-1">Event Title</label>
            <input
              name="title"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1">Description</label>
            <textarea
              name="description"
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold block mb-1">Start Time</label>
              <input
                type="datetime-local"
                name="start_time"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1">End Time</label>
              <input
                type="datetime-local"
                name="end_time"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1">Artist</label>
            <select
              name="artist_id"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="">No artist</option>
              {artists?.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end">
            <button
              className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-500"
            >
              Create Event
            </button>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}
