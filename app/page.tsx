import { redirect } from "next/navigation";

export default function Home() {
  // Always send people directly to the VIP Dashboard
  redirect("/dashboard");
}
