import Link from "next/link";
import { Zap, FolderOpen, LayoutTemplate, Bot } from "lucide-react";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 border-r border-sidebar-border bg-sidebar flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-sidebar-border">
          <Link href="/projects" className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-accent" />
            <span className="font-semibold">SuperAgent</span>
          </Link>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          <Link
            href="/projects"
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors"
          >
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            Projects
          </Link>
          <Link
            href="/templates"
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors"
          >
            <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
            Templates
          </Link>
          <Link
            href="/agents"
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors"
          >
            <Bot className="h-4 w-4 text-muted-foreground" />
            Agents
          </Link>
        </nav>

        <div className="px-2 py-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground">
            <div className="h-6 w-6 rounded-full bg-accent/20 flex items-center justify-center text-xs font-medium text-accent">
              {session.user.name?.[0]?.toUpperCase() ?? "U"}
            </div>
            <span className="truncate text-foreground">
              {session.user.name ?? session.user.email}
            </span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
