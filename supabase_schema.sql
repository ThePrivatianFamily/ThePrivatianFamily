-- ════════════════════════════════════════════════════════════════════
-- THE PRIVATIAN FAMILY — Supabase Complete Database Schema & Permissions
-- Run this script in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ════════════════════════════════════════════════════════════════════

-- 1. SECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    locked BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    admin_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint / indexes on sections
CREATE UNIQUE INDEX IF NOT EXISTS idx_sections_slug ON public.sections (slug) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_sections_order ON public.sections (display_order);

-- 2. ARTICLES TABLE
CREATE TABLE IF NOT EXISTS public.articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    deck TEXT,
    section TEXT,
    author TEXT DEFAULT 'The Privatian Family',
    author_role TEXT,
    author_bio TEXT,
    hero_img_url TEXT,
    hero_caption TEXT,
    hero_credit TEXT,
    content_html TEXT,
    status TEXT DEFAULT 'draft', -- 'draft' or 'published'
    created_by TEXT,
    published_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for articles
CREATE INDEX IF NOT EXISTS idx_articles_slug ON public.articles (slug);
CREATE INDEX IF NOT EXISTS idx_articles_status ON public.articles (status);
CREATE INDEX IF NOT EXISTS idx_articles_section ON public.articles (section);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON public.articles (published_at DESC);

-- 3. ALLOWED ADMINS TABLE
CREATE TABLE IF NOT EXISTS public.allowed_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'Moderator', -- 'Admin' or 'Moderator'
    status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'suspended', 'deleted'
    added_by TEXT DEFAULT 'system',
    added_at TIMESTAMPTZ DEFAULT NOW(),
    modified_by TEXT,
    modified_at TIMESTAMPTZ,
    modified_action TEXT
);

CREATE INDEX IF NOT EXISTS idx_allowed_admins_email ON public.allowed_admins (email);

-- ════════════════════════════════════════════════════════════════════
-- 4. ROW LEVEL SECURITY (RLS) & PERMISSIONS
-- ════════════════════════════════════════════════════════════════════

-- Grant standard permissions to anon and authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.sections TO anon, authenticated;
GRANT SELECT ON public.articles TO anon, authenticated;
GRANT SELECT ON public.allowed_admins TO anon, authenticated;

-- Grant full access to service_role (used by backend API endpoints)
GRANT ALL ON public.sections TO service_role;
GRANT ALL ON public.articles TO service_role;
GRANT ALL ON public.allowed_admins TO service_role;

-- Enable RLS
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allowed_admins ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to prevent conflicts
DROP POLICY IF EXISTS "Public can view active sections" ON public.sections;
DROP POLICY IF EXISTS "Service role full access on sections" ON public.sections;
DROP POLICY IF EXISTS "Public can view published articles" ON public.articles;
DROP POLICY IF EXISTS "Service role full access on articles" ON public.articles;
DROP POLICY IF EXISTS "Public can view allowed admins" ON public.allowed_admins;
DROP POLICY IF EXISTS "Service role full access on allowed_admins" ON public.allowed_admins;

-- Sections policies:
-- Anyone can view active, non-deleted sections
CREATE POLICY "Public can view active sections"
ON public.sections FOR SELECT
TO anon, authenticated
USING (is_active = TRUE AND is_deleted = FALSE);

-- Service role bypass for full management
CREATE POLICY "Service role full access on sections"
ON public.sections FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Articles policies:
-- Anyone can view published articles
CREATE POLICY "Public can view published articles"
ON public.articles FOR SELECT
TO anon, authenticated
USING (status = 'published');

-- Service role bypass for full management
CREATE POLICY "Service role full access on articles"
ON public.articles FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allowed Admins policies:
-- Authenticated & anon can check active admins for login verification
CREATE POLICY "Public can view allowed admins"
ON public.allowed_admins FOR SELECT
TO anon, authenticated
USING (true);

-- Service role bypass for full management
CREATE POLICY "Service role full access on allowed_admins"
ON public.allowed_admins FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════════
-- 5. OPTIONAL: STORAGE BUCKET FOR ARTICLE IMAGES
-- ════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('article-images', 'article-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access for article images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'article-images');

CREATE POLICY "Authenticated users can upload article images"
ON storage.objects FOR INSERT
TO authenticated, service_role
WITH CHECK (bucket_id = 'article-images');
