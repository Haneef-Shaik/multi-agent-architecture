import { redirect } from "next/navigation";

// Signup redirects to login since we use OAuth
export default function SignupPage() {
  redirect("/login");
}
