import Image from "next/image";

export const metadata = {
  title: "Staff login – Sugarshack Downtown",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 px-8 py-10">
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-48 h-16 mb-5">
            <Image
              src="/ssdt-logo.png"
              alt="Sugarshack Downtown"
              fill
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 text-center">
            Staff dashboard
          </h1>
          <p className="text-xs text-slate-500 text-center mt-1">
            Internal view for VIP rewards, fan wall, and tonight&apos;s shows.
          </p>
        </div>

        <form
          method="POST"
          action="/api/login"
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">
              Username
            </label>
            <input
              type="text"
              name="username"
              autoComplete="username"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">
              Password
            </label>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full mt-2 inline-flex items-center justify-center rounded-full bg-slate-900 text-white text-sm font-medium py-2.5 hover:bg-slate-800"
          >
            Sign in
          </button>

          <p className="text-[11px] text-slate-400 text-center mt-3">
            For Sugarshack Downtown staff use only.
          </p>
        </form>
      </div>
    </div>
  );
}
