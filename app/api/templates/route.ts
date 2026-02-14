import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/helpers";
import { findTemplates, getTemplatesCollection } from "@/lib/db/models/template";

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { searchParams } = request.nextUrl;
  const category = searchParams.get("category") ?? undefined;
  const framework = searchParams.get("framework") ?? undefined;

  const templates = await findTemplates({ category, framework });
  return NextResponse.json(templates);
}

/**
 * POST /api/templates/seed — Seed default templates (admin only in production).
 * For development, anyone can seed.
 */
export async function POST() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const col = await getTemplatesCollection();
  const existing = await col.countDocuments();
  if (existing > 0) {
    return NextResponse.json(
      { message: `Templates already seeded (${existing} exist)` },
      { status: 200 }
    );
  }

  const now = new Date();
  const templates = [
    {
      name: "Next.js Starter",
      description:
        "A modern Next.js 15 app with App Router, Tailwind CSS, and TypeScript.",
      framework: "nextjs" as const,
      category: "fullstack" as const,
      files: [
        {
          path: "package.json",
          content: JSON.stringify(
            {
              name: "my-nextjs-app",
              version: "0.1.0",
              private: true,
              scripts: {
                dev: "next dev",
                build: "next build",
                start: "next start",
              },
              dependencies: {
                next: "^15.0.0",
                react: "^19.0.0",
                "react-dom": "^19.0.0",
              },
              devDependencies: {
                "@types/node": "^22.0.0",
                "@types/react": "^19.0.0",
                typescript: "^5.7.0",
                "tailwindcss": "^4.0.0",
              },
            },
            null,
            2
          ),
        },
        {
          path: "app/layout.tsx",
          content: `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}`,
        },
        {
          path: "app/page.tsx",
          content: `export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Hello, World!</h1>
      <p className="text-muted-foreground mt-2">Edit app/page.tsx to get started.</p>
    </main>
  );
}`,
        },
        {
          path: "tsconfig.json",
          content: JSON.stringify(
            {
              compilerOptions: {
                target: "ES2017",
                lib: ["dom", "dom.iterable", "esnext"],
                allowJs: true,
                skipLibCheck: true,
                strict: true,
                noEmit: true,
                esModuleInterop: true,
                module: "esnext",
                moduleResolution: "bundler",
                resolveJsonModule: true,
                isolatedModules: true,
                jsx: "preserve",
                incremental: true,
                paths: { "@/*": ["./*"] },
              },
              include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
              exclude: ["node_modules"],
            },
            null,
            2
          ),
        },
      ],
      defaultPorts: [3000],
      defaultEnvVars: {},
      popularity: 100,
      createdAt: now,
    },
    {
      name: "React + Vite",
      description:
        "Fast React app with Vite, TypeScript, and Tailwind CSS.",
      framework: "react" as const,
      category: "frontend" as const,
      files: [
        {
          path: "package.json",
          content: JSON.stringify(
            {
              name: "my-react-app",
              version: "0.1.0",
              private: true,
              type: "module",
              scripts: {
                dev: "vite",
                build: "tsc && vite build",
                preview: "vite preview",
              },
              dependencies: {
                react: "^19.0.0",
                "react-dom": "^19.0.0",
              },
              devDependencies: {
                "@types/react": "^19.0.0",
                "@types/react-dom": "^19.0.0",
                "@vitejs/plugin-react": "^4.0.0",
                typescript: "^5.7.0",
                vite: "^6.0.0",
                tailwindcss: "^4.0.0",
              },
            },
            null,
            2
          ),
        },
        {
          path: "index.html",
          content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
        },
        {
          path: "src/main.tsx",
          content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
        },
        {
          path: "src/App.tsx",
          content: `export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <h1 className="text-4xl font-bold">Hello, React!</h1>
    </div>
  );
}`,
        },
      ],
      defaultPorts: [5173],
      defaultEnvVars: {},
      popularity: 90,
      createdAt: now,
    },
    {
      name: "Express API",
      description:
        "A REST API with Express.js, TypeScript, and basic CRUD structure.",
      framework: "express" as const,
      category: "backend" as const,
      files: [
        {
          path: "package.json",
          content: JSON.stringify(
            {
              name: "my-express-api",
              version: "0.1.0",
              private: true,
              scripts: {
                dev: "tsx watch src/index.ts",
                build: "tsc",
                start: "node dist/index.js",
              },
              dependencies: {
                express: "^5.0.0",
                cors: "^2.8.5",
              },
              devDependencies: {
                "@types/express": "^5.0.0",
                "@types/cors": "^2.8.17",
                "@types/node": "^22.0.0",
                typescript: "^5.7.0",
                tsx: "^4.0.0",
              },
            },
            null,
            2
          ),
        },
        {
          path: "src/index.ts",
          content: `import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});`,
        },
      ],
      defaultPorts: [8000],
      defaultEnvVars: {},
      popularity: 80,
      createdAt: now,
    },
    {
      name: "Python FastAPI",
      description:
        "A modern Python API with FastAPI, automatic OpenAPI docs, and uvicorn.",
      framework: "python-fastapi" as const,
      category: "backend" as const,
      files: [
        {
          path: "requirements.txt",
          content: "fastapi>=0.115.0\nuvicorn[standard]>=0.32.0\n",
        },
        {
          path: "main.py",
          content: `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="My API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Hello, World!"}

@app.get("/api/health")
def health():
    return {"status": "ok"}
`,
        },
      ],
      defaultPorts: [8000],
      defaultEnvVars: {},
      popularity: 75,
      createdAt: now,
    },
    {
      name: "Static HTML",
      description: "A simple static site with HTML, CSS, and vanilla JS.",
      framework: "static-html" as const,
      category: "frontend" as const,
      files: [
        {
          path: "index.html",
          content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My Site</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main>
    <h1>Hello, World!</h1>
    <p>Edit index.html to get started.</p>
  </main>
  <script src="script.js"></script>
</body>
</html>`,
        },
        {
          path: "style.css",
          content: `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0a0a0a; color: #ededed; }
main { text-align: center; }
h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
p { color: #888; }`,
        },
        {
          path: "script.js",
          content: `console.log('Hello from script.js');`,
        },
      ],
      defaultPorts: [3000],
      defaultEnvVars: {},
      popularity: 60,
      createdAt: now,
    },
    {
      name: "Vue 3 + Vite",
      description: "Vue 3 with Composition API, Vite, and TypeScript.",
      framework: "vue" as const,
      category: "frontend" as const,
      files: [
        {
          path: "package.json",
          content: JSON.stringify(
            {
              name: "my-vue-app",
              version: "0.1.0",
              private: true,
              type: "module",
              scripts: {
                dev: "vite",
                build: "vue-tsc && vite build",
                preview: "vite preview",
              },
              dependencies: {
                vue: "^3.5.0",
              },
              devDependencies: {
                "@vitejs/plugin-vue": "^5.0.0",
                typescript: "^5.7.0",
                vite: "^6.0.0",
                "vue-tsc": "^2.0.0",
              },
            },
            null,
            2
          ),
        },
        {
          path: "index.html",
          content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Vue App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>`,
        },
        {
          path: "src/main.ts",
          content: `import { createApp } from 'vue';\nimport App from './App.vue';\n\ncreateApp(App).mount('#app');`,
        },
        {
          path: "src/App.vue",
          content: `<template>
  <div class="app">
    <h1>Hello, Vue!</h1>
  </div>
</template>

<script setup lang="ts">
// Your component logic here
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: system-ui, sans-serif;
}
</style>`,
        },
      ],
      defaultPorts: [5173],
      defaultEnvVars: {},
      popularity: 70,
      createdAt: now,
    },
  ];

  await col.insertMany(templates);
  return NextResponse.json(
    { message: `Seeded ${templates.length} templates` },
    { status: 201 }
  );
}
