import Image from "next/image";

export default function LoginPage(props: { searchParams?: { error?: string } }) {
  const hasError = props.searchParams?.error === "1";

  return (
    <section className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-xl border border-slate-200 px-10 py-10">
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="relative w-56 h-16">
            <Image
              src="/ssdt-logo.png"
              alt="Sugarshack Downtown"
              fill
              priority
              className="object-contain"
            />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-slate-900">
              Sugarshack Downtown Dashboard
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Internal view for VIP rewards, fan wall, and tonights shows.
            </p>
          </div>
        </div>

        {hasError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Invalid username or password.
          </div>
        )}

        <form method="POST" action="/api/login" className="space-y-5">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Username
            </label>
            <input
              type="text"
              name="username"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 bg-slate-50"
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              type="password"
              name="password"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 bg-slate-50"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="w-full mt-2 rounded-2xl bg-slate-950 text-white text-sm font-medium py-2.5 shadow-sm hover:bg-slate-900 transition-colors"
          >
            Sign in
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          For Sugarshack Downtown staff use only.
        </p>
      </div>
    </section>
  );
}
