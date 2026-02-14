import Link from "next/link";
import { Zap, Code, Eye, Terminal, Bot, Layers } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-accent" />
          <span className="font-semibold text-lg">SuperAgent</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/login"
            className="text-sm bg-accent text-accent-foreground px-4 py-2 rounded-md hover:bg-accent/90 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24">
        <div className="max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 bg-accent/10 text-accent text-sm px-3 py-1 rounded-full mb-6">
            <Bot className="h-3.5 w-3.5" />
            AI-Powered Application Builder
          </div>
          <h1 className="text-5xl font-bold tracking-tight mb-6">
            Describe it. Build it.
            <br />
            <span className="text-accent">Ship it.</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
            Multiple AI agents collaborate to plan, code, design, test, and
            deploy your applications. Describe what you want — watch it come to
            life in a live sandbox.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/login"
              className="bg-accent text-accent-foreground px-6 py-3 rounded-md text-base font-medium hover:bg-accent/90 transition-colors"
            >
              Start Building
            </Link>
            <Link
              href="#features"
              className="border border-border px-6 py-3 rounded-md text-base font-medium hover:bg-muted transition-colors"
            >
              See How It Works
            </Link>
          </div>
        </div>

        {/* Features */}
        <div
          id="features"
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 max-w-4xl w-full"
        >
          {[
            {
              icon: Layers,
              title: "Multi-Agent Orchestration",
              desc: "8 specialized agents — planning, coding, design, testing, database, debugging, deployment, and review — coordinated by a supervisor.",
            },
            {
              icon: Terminal,
              title: "Isolated Sandboxes",
              desc: "Each project runs in its own Docker container with Node.js, Python, and a full development environment.",
            },
            {
              icon: Eye,
              title: "Live Preview",
              desc: "See your application running in real-time as agents build it. Hot reload, multiple ports, framework-agnostic.",
            },
            {
              icon: Code,
              title: "Full IDE",
              desc: "Monaco code editor, file tree, integrated terminal. Switch between chat mode and developer mode.",
            },
            {
              icon: Bot,
              title: "105 Skills",
              desc: "Agents leverage a library of 105 specialized skills — from architecture patterns to database design to frontend development.",
            },
            {
              icon: Zap,
              title: "Any Framework",
              desc: "Next.js, React, Vue, Python Flask/Django/FastAPI, Express, static HTML — build with whatever you want.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="border border-border rounded-lg p-5"
            >
              <f.icon className="h-5 w-5 text-accent mb-3" />
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-4 text-center text-sm text-muted-foreground">
        SuperAgent — AI-powered application builder
      </footer>
    </div>
  );
}
