-- Supabase Setup Script
-- Enable pgcrypto for hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Tables
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL CHECK (role IN ('admin', 'passenger')),
    display_name TEXT NOT NULL,
    access_code_hash TEXT NOT NULL,
    emoji TEXT,
    accent_color TEXT DEFAULT '#196ee6',
    is_active BOOLEAN DEFAULT true,
    last_active_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE auth_tokens (
    token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE login_attempts (
    ip_address TEXT PRIMARY KEY,
    attempts INT DEFAULT 1,
    last_attempt TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_used BOOLEAN DEFAULT false,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(session_id, user_id)
);

CREATE TABLE pings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'viewed', 'picked_up')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes
CREATE INDEX idx_tickets_session_user ON tickets(session_id, user_id);
CREATE INDEX idx_pings_session ON pings(session_id);
CREATE INDEX idx_pings_user ON pings(user_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_created_at ON events(created_at);
CREATE INDEX idx_auth_tokens_token ON auth_tokens(token);

-- 3. Custom Auth Helper
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT user_id FROM auth_tokens 
    WHERE token::text = current_setting('request.headers', true)::json->>'x-auth-token'
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT role = 'admin' FROM users WHERE id = current_user_id();
$$;

-- 4. Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE pings ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Users: Admin can all, Passenger can read self
CREATE POLICY "Admin can manage all users" ON users FOR ALL USING (is_admin());
CREATE POLICY "Passenger can read self" ON users FOR SELECT USING (id = current_user_id());

-- Sessions: Admin can all, Passenger can read active
CREATE POLICY "Admin can manage all sessions" ON sessions FOR ALL USING (is_admin());
CREATE POLICY "Passenger can read active sessions" ON sessions FOR SELECT USING (is_active = true);

-- Tickets: Admin can all, Passenger can read self
CREATE POLICY "Admin can manage all tickets" ON tickets FOR ALL USING (is_admin());
CREATE POLICY "Passenger can read own tickets" ON tickets FOR SELECT USING (user_id = current_user_id());

-- Pings: Admin can all, Passenger can read/insert self
CREATE POLICY "Admin can manage all pings" ON pings FOR ALL USING (is_admin());
CREATE POLICY "Passenger can read own pings" ON pings FOR SELECT USING (user_id = current_user_id());
CREATE POLICY "Passenger can insert own pings" ON pings FOR INSERT WITH CHECK (user_id = current_user_id());

-- Push Subscriptions: Admin can all, Passenger can manage self
CREATE POLICY "Admin can manage all push subs" ON push_subscriptions FOR ALL USING (is_admin());
CREATE POLICY "Passenger can manage own push subs" ON push_subscriptions FOR ALL USING (user_id = current_user_id());

-- Events: Admin can all, Passenger cannot access
CREATE POLICY "Admin can manage all events" ON events FOR ALL USING (is_admin());

-- 5. RPCs for Authentication and Operations

-- Login RPC with Rate Limiting
CREATE OR REPLACE FUNCTION login(access_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    client_ip TEXT;
    attempt_record RECORD;
    found_user RECORD;
    new_token UUID;
BEGIN
    client_ip := coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', 'unknown');
    
    -- Check rate limit (max 5 attempts per 15 mins)
    SELECT * INTO attempt_record FROM login_attempts WHERE ip_address = client_ip;
    IF attempt_record.ip_address IS NOT NULL AND attempt_record.attempts >= 5 AND attempt_record.last_attempt > now() - interval '15 minutes' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Too many failed attempts. Please try again later.');
    END IF;

    -- Find user
    SELECT * INTO found_user FROM users WHERE access_code_hash = crypt(access_code, access_code_hash) AND is_active = true LIMIT 1;
    
    IF found_user.id IS NOT NULL THEN
        -- Success: clear attempts, create token, log event
        DELETE FROM login_attempts WHERE ip_address = client_ip;
        
        INSERT INTO auth_tokens (user_id) VALUES (found_user.id) RETURNING token INTO new_token;
        UPDATE users SET last_active_at = now() WHERE id = found_user.id;
        
        INSERT INTO events (event_type, user_id, metadata) VALUES ('login_success', found_user.id, jsonb_build_object('role', found_user.role));
        
        RETURN jsonb_build_object(
            'success', true,
            'token', new_token,
            'user', jsonb_build_object(
                'id', found_user.id,
                'role', found_user.role,
                'display_name', found_user.display_name,
                'emoji', found_user.emoji,
                'accent_color', found_user.accent_color
            )
        );
    ELSE
        -- Failure: increment attempts
        INSERT INTO login_attempts (ip_address, attempts, last_attempt)
        VALUES (client_ip, 1, now())
        ON CONFLICT (ip_address) DO UPDATE SET attempts = login_attempts.attempts + 1, last_attempt = now();
        
        INSERT INTO events (event_type, metadata) VALUES ('login_failed', jsonb_build_object('ip', client_ip));
        RETURN jsonb_build_object('success', false, 'message', 'Invalid access code');
    END IF;
END;
$$;

-- Request Pickup RPC (Atomic)
CREATE OR REPLACE FUNCTION request_pickup(
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION,
    p_accuracy DOUBLE PRECISION
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    uid UUID;
    active_session RECORD;
    user_ticket RECORD;
    new_ping_id UUID;
BEGIN
    uid := current_user_id();
    IF uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    -- Find active session
    SELECT * INTO active_session FROM sessions WHERE is_active = true AND now() BETWEEN start_time AND end_time LIMIT 1;
    IF active_session.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No active session found');
    END IF;

    -- Find unused ticket for this user in this session FOR UPDATE (locks the row)
    SELECT * INTO user_ticket FROM tickets WHERE session_id = active_session.id AND user_id = uid AND is_used = false FOR UPDATE;
    IF user_ticket.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No valid ticket found or already used');
    END IF;

    -- Mark ticket as used
    UPDATE tickets SET is_used = true, used_at = now() WHERE id = user_ticket.id;

    -- Insert ping
    INSERT INTO pings (session_id, user_id, lat, lng, accuracy, status)
    VALUES (active_session.id, uid, p_lat, p_lng, p_accuracy, 'new')
    RETURNING id INTO new_ping_id;

    -- Update user last active
    UPDATE users SET last_active_at = now() WHERE id = uid;

    -- Log event
    INSERT INTO events (event_type, user_id, session_id, metadata)
    VALUES ('pickup_requested', uid, active_session.id, jsonb_build_object('ping_id', new_ping_id));

    RETURN jsonb_build_object('success', true, 'ping_id', new_ping_id);
END;
$$;

-- Admin: Create User
CREATE OR REPLACE FUNCTION admin_create_user(
    p_display_name TEXT,
    p_access_code TEXT,
    p_emoji TEXT,
    p_accent_color TEXT,
    p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_user_id UUID;
BEGIN
    IF NOT is_admin() THEN RETURN jsonb_build_object('success', false, 'message', 'Unauthorized'); END IF;

    INSERT INTO users (role, display_name, access_code_hash, emoji, accent_color, is_active)
    VALUES ('passenger', p_display_name, crypt(p_access_code, gen_salt('bf')), p_emoji, p_accent_color, p_is_active)
    RETURNING id INTO new_user_id;

    INSERT INTO events (event_type, user_id, metadata) VALUES ('user_created', current_user_id(), jsonb_build_object('created_user_id', new_user_id));
    RETURN jsonb_build_object('success', true, 'user_id', new_user_id);
END;
$$;

-- Admin: Update User
CREATE OR REPLACE FUNCTION admin_update_user(
    p_user_id UUID,
    p_display_name TEXT,
    p_access_code TEXT, -- pass null if not changing
    p_emoji TEXT,
    p_accent_color TEXT,
    p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT is_admin() THEN RETURN jsonb_build_object('success', false, 'message', 'Unauthorized'); END IF;

    UPDATE users SET 
        display_name = coalesce(p_display_name, display_name),
        emoji = coalesce(p_emoji, emoji),
        accent_color = coalesce(p_accent_color, accent_color),
        is_active = coalesce(p_is_active, is_active)
    WHERE id = p_user_id;

    IF p_access_code IS NOT NULL AND p_access_code != '' THEN
        UPDATE users SET access_code_hash = crypt(p_access_code, gen_salt('bf')) WHERE id = p_user_id;
        -- Invalidate all existing sessions for this user
        DELETE FROM auth_tokens WHERE user_id = p_user_id;
    END IF;

    INSERT INTO events (event_type, user_id, metadata) VALUES ('user_updated', current_user_id(), jsonb_build_object('updated_user_id', p_user_id));
    RETURN jsonb_build_object('success', true);
END;
$$;

-- Admin: Create Session
CREATE OR REPLACE FUNCTION admin_create_session(
    p_name TEXT,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_session_id UUID;
    passenger RECORD;
BEGIN
    IF NOT is_admin() THEN RETURN jsonb_build_object('success', false, 'message', 'Unauthorized'); END IF;

    INSERT INTO sessions (name, start_time, end_time, is_active)
    VALUES (p_name, p_start_time, p_end_time, p_is_active)
    RETURNING id INTO new_session_id;

    -- Auto-generate tickets for all active passengers
    FOR passenger IN SELECT id FROM users WHERE role = 'passenger' AND is_active = true LOOP
        INSERT INTO tickets (session_id, user_id) VALUES (new_session_id, passenger.id);
    END LOOP;

    INSERT INTO events (event_type, user_id, session_id) VALUES ('session_created', current_user_id(), new_session_id);
    RETURN jsonb_build_object('success', true, 'session_id', new_session_id);
END;
$$;

-- Admin: Reset Ticket
CREATE OR REPLACE FUNCTION admin_reset_ticket(p_ticket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT is_admin() THEN RETURN jsonb_build_object('success', false, 'message', 'Unauthorized'); END IF;
    UPDATE tickets SET is_used = false, used_at = null WHERE id = p_ticket_id;
    INSERT INTO events (event_type, user_id, metadata) VALUES ('ticket_reset', current_user_id(), jsonb_build_object('ticket_id', p_ticket_id));
    RETURN jsonb_build_object('success', true);
END;
$$;

-- Admin: Bulk Reset Tickets
CREATE OR REPLACE FUNCTION admin_bulk_reset_tickets(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT is_admin() THEN RETURN jsonb_build_object('success', false, 'message', 'Unauthorized'); END IF;
    UPDATE tickets SET is_used = false, used_at = null WHERE session_id = p_session_id;
    INSERT INTO events (event_type, user_id, session_id) VALUES ('bulk_tickets_reset', current_user_id(), p_session_id);
    RETURN jsonb_build_object('success', true);
END;
$$;

-- 6. Seed Data
-- Admin access code: admin_pepe
INSERT INTO users (role, display_name, access_code_hash, emoji, accent_color)
VALUES ('admin', 'Admin', crypt('admin_pepe', gen_salt('bf')), '👑', '#ffffff');

-- Cleanup function for old events and pings
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Delete pings older than 24 hours
    DELETE FROM pings WHERE created_at < now() - interval '24 hours';
    -- Delete events older than 90 days
    DELETE FROM events WHERE created_at < now() - interval '90 days';
    -- Delete old login attempts
    DELETE FROM login_attempts WHERE last_attempt < now() - interval '1 day';
    -- Delete old auth tokens (e.g., older than 30 days)
    DELETE FROM auth_tokens WHERE created_at < now() - interval '30 days';
END;
$$;

