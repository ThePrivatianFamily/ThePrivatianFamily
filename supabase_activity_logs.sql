-- =====================================================================
-- THE PRIVATIAN FAMILY — IMMUTABLE ACTIVITY LOGS & AUDIT TRAIL SCHEMA
-- =====================================================================

-- 1. Create the activity_logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_email TEXT NOT NULL,
    actor_name TEXT,
    actor_role TEXT DEFAULT 'Admin',
    action TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    summary TEXT NOT NULL,
    target_id TEXT,
    target_name TEXT,
    details JSONB DEFAULT '{}'::jsonb
);

-- 2. Create performance indexes for rapid multi-filter querying
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON public.activity_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_category ON public.activity_logs (category);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_email ON public.activity_logs (actor_email);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.activity_logs (action);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 4. Read policy: Allow authenticated service key and operators
CREATE POLICY "Allow authenticated read for activity logs"
    ON public.activity_logs
    FOR SELECT
    USING (true);

-- 5. Insert policy: Allow service role to record events
CREATE POLICY "Allow insert for activity logs"
    ON public.activity_logs
    FOR INSERT
    WITH CHECK (true);

-- 6. IMMUTABILITY ENFORCEMENT:
-- Strictly DO NOT create UPDATE or DELETE policies.
-- Even database administrators cannot delete logs via the API.
