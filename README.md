# TechFocus

YouTube tech-lecture watcher. Dark navy (`#0b0d12`) with orange accent (`#f97316`). Brand: **TECH** + orange **FOCUS**.

Live: [techfocus-beta.vercel.app](https://techfocus-beta.vercel.app)

Watch a lecture, or listen with a still thumbnail. There are no channel or subscribe pages.

## Features

- Search videos and playlists/courses
- Watch or listen mode
- Course / full-playlist links on watch pages
- Description and comments
- Talk to AI panel (needs a model API key: `GROQ_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, or `GEMINI_API_KEY`)
- History
- Settings (audio-only is off by default)

## Routes

Hash routes:

- `#/` — home
- `#/results?search_query=...` — search
- `#/watch/:id` — watch
- `#/playlist/:id` — playlist / course
- `#/history`
- `#/settings`

## Stack

- React 19, Vite, Tailwind CSS v4
- Node API in `server/index.mjs`
- Vercel serverless wrapper: `api/[...path].mjs` (`vercel.json`)

## Local

API defaults to port `8787`. Vite (`PORT`, default `8443`) proxies `/api` to `API_PORT` or `8787`.

```bash
npm install
API_PORT=8768 node server/index.mjs
API_PORT=8768 PORT=8443 npm run dev
```

Open the Vite URL (typically `http://localhost:8443`).

## Scripts

| Script | Command |
| --- | --- |
| Dev (Vite) | `npm run dev` |
| API | `npm run server` |
| Build | `npm run build` |
| Preview | `npm run preview` |
| Format | `npm run format` |

## Deploy

Hosted on Vercel. `vercel.json` builds with Vite (`dist`) and routes API requests through `api/[...path].mjs` (includes `server/**`).
