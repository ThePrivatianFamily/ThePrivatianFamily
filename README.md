# The Privatian Family

> A modern, elegant web publishing platform and editorial archive for **The Privatian Family**, featuring dynamic sections, rich article formatting, cross-browser real-time synchronization, and a Google OAuth-protected administrative management dashboard.

---

## 📁 Project Architecture & Directory Structure

```text
ThePrivatianFamily/
├── index.html                  # Homepage (Hero, Small Articles, Events, All News Grid)
├── section.html                # Dynamic Section Page (Filtered articles, hero & sidebar)
├── article.html                # Dynamic Article Page (Full content, author bio, related stories)
├── admin.html                  # Admin Dashboard (Sections CRUD, Header Settings, Manage Access)
├── admin-login.html            # Google OAuth Sign-In Portal
├── admin-article-editor.html   # In-theme WYSIWYG Article Editor
│
├── api/                        # Vercel Serverless Functions (Backend API)
│   ├── _lib/
│   │   └── auth.js             # JWT session verification & live DB role guard
│   ├── admins.js               # Admin access management (List, Add, Role Update, Recycle Bin)
│   ├── articles.js             # Article CRUD, publishing, image upload & public read endpoints
│   ├── auth.js                 # Google OAuth verification & session management
│   └── sections.js             # Section management & dynamic navbar sync
│
├── assets/                     # Static Client Assets
│   ├── css/
│   │   ├── style.css           # Global typography, color system & homepage layout
│   │   ├── admin.css           # Admin panel & modal stylesheet
│   │   └── article.css         # Harvard-Gazette-style editorial layout
│   ├── js/
│   │   ├── script.js           # Homepage dynamic label updates
│   │   ├── components.js       # Shared Header, Sub-header, Nav, Search & Footer
│   │   ├── admin.js            # Admin dashboard logic & real-time sync
│   │   ├── admin-auth.js       # Client-side route guard & session check
│   │   └── supabase-config.js  # Client-side Supabase helper with API fallback
│   └── images/                 # Editorial imagery & SVG vector logos
│       ├── logo.svg
│       ├── logo-cover.svg
│       ├── img1.png ... img6.png
│
├── dev-server.js               # Zero-dependency local Node.js development server
├── supabase_schema.sql         # Supabase PostgreSQL schema, RLS policies & GRANT script
├── vercel.json                 # Vercel deployment routing & caching configuration
├── package.json                # Project dependencies & npm scripts
├── .env.example                # Template for environment variables
└── .gitignore                  # Git ignore rules for node_modules and secrets
```

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` (or configure your Supabase keys):
```bash
cp .env.example .env
```

### 3. Start the Full-Stack Dev Server
```bash
npm start
```
- **Main Website:** [http://localhost:3000](http://localhost:3000)
- **Section Page:** [http://localhost:3000/section.html?slug=findings](http://localhost:3000/section.html?slug=findings)
- **Article Page:** [http://localhost:3000/article.html](http://localhost:3000/article.html)
- **Admin Panel:** [http://localhost:3000/admin.html](http://localhost:3000/admin.html)
- **Admin Login:** [http://localhost:3000/admin-login.html](http://localhost:3000/admin-login.html)

---

## 🗄️ Database Setup (Supabase)

1. Open your project on [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **SQL Editor** from the left navigation menu.
3. Open `supabase_schema.sql` from this repository, paste the contents into the SQL Editor, and click **Run**.
4. This script sets up:
   - `sections` table with slug index and display order.
   - `articles` table with publication status, full content HTML, and metadata.
   - `allowed_admins` table for Google OAuth access control.
   - Row Level Security (RLS) policies allowing public read of published content and full service-role management.

---

## ⚙️ Environment Variables

| Variable | Description |
| :--- | :--- |
| `SUPABASE_URL` | Your Supabase Project URL (`https://<project-ref>.supabase.co`) |
| `SUPABASE_ANON_KEY` | Supabase public anonymous API key |
| `SUPABASE_SERVICE_KEY` | Supabase private `service_role` key (used by `/api/*` endpoints) |
| `SESSION_SECRET` | 32+ character random string for signing JWT tokens |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Client ID from Google Cloud Console |
| `PORT` | Local development server port (Default: `3000`) |

---

## ☁️ Deployment (Vercel)

1. Push this repository to GitHub / GitLab / Bitbucket.
2. Import the project in [Vercel](https://vercel.com).
3. In the Vercel project settings, go to **Settings > Environment Variables** and add:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `SESSION_SECRET`
   - `GOOGLE_CLIENT_ID`
4. Click **Deploy**. Vercel will automatically serve the static assets and execute the serverless functions in `/api/`.

---

## 🛡️ Admin & Security Features

- **Google Sign-In Authentication:** Only whitelisted Google accounts in `allowed_admins` can sign in.
- **Role-Based Access Control:** `Admin` (full management, publish/delete, role assignment) and `Moderator` roles.
- **Stale JWT Escalation Protection:** Every privileged action performs a live database check to prevent session tampering.
- **Recycle Bin & Min-2 Admin Guard:** Prevents accidental deletion of the last admin account and supports account suspension and restoration.
