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
    avatar_url TEXT,
    accent_color TEXT DEFAULT '#196ee6',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
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
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'picked_up')),
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

-- 3. Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE pings ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- We will use a custom JWT claim or just rely on RPCs for authentication.
-- Since it's code-based auth, we can create a custom RPC to verify the code and return a JWT,
-- OR we can just use RPCs for all operations and bypass RLS for those RPCs (SECURITY DEFINER).
-- Given the constraints, SECURITY DEFINER RPCs are the easiest way to handle custom code-based auth without integrating a full external auth provider.

-- 4. RPCs for Authentication and Operations

-- Login RPC
CREATE OR REPLACE FUNCTION login(access_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    found_user RECORD;
    result JSONB;
BEGIN
    -- Rate limiting could be added here by checking an attempts table, but for simplicity we rely on the app logic or a basic delay.
    -- Find user by checking hash
    SELECT * INTO found_user FROM users WHERE access_code_hash = crypt(access_code, access_code_hash) AND is_active = true LIMIT 1;
    
    IF found_user.id IS NOT NULL THEN
        -- Log event
        INSERT INTO events (event_type, user_id, metadata) VALUES ('login_success', found_user.id, jsonb_build_object('role', found_user.role));
        
        result := jsonb_build_object(
            'success', true,
            'user', jsonb_build_object(
                'id', found_user.id,
                'role', found_user.role,
                'display_name', found_user.display_name,
                'emoji', found_user.emoji,
                'accent_color', found_user.accent_color
            )
        );
    ELSE
        -- Log failed attempt (we don't know the user, so user_id is null)
        INSERT INTO events (event_type, metadata) VALUES ('login_failed', jsonb_build_object('attempted_code_length', length(access_code)));
        result := jsonb_build_object('success', false, 'message', 'Invalid access code');
    END IF;
    
    RETURN result;
END;
$$;

-- Request Pickup RPC (Atomic)
CREATE OR REPLACE FUNCTION request_pickup(
    p_user_id UUID,
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION,
    p_accuracy DOUBLE PRECISION
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    active_session RECORD;
    user_ticket RECORD;
    new_ping_id UUID;
BEGIN
    -- Find active session
    SELECT * INTO active_session FROM sessions WHERE is_active = true AND now() BETWEEN start_time AND end_time LIMIT 1;
    
    IF active_session.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No active session found');
    END IF;

    -- Find unused ticket for this user in this session
    SELECT * INTO user_ticket FROM tickets WHERE session_id = active_session.id AND user_id = p_user_id AND is_used = false FOR UPDATE;
    
    IF user_ticket.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No valid ticket found or already used');
    END IF;

    -- Mark ticket as used
    UPDATE tickets SET is_used = true WHERE id = user_ticket.id;

    -- Insert ping
    INSERT INTO pings (session_id, user_id, lat, lng, accuracy, status)
    VALUES (active_session.id, p_user_id, p_lat, p_lng, p_accuracy, 'pending')
    RETURNING id INTO new_ping_id;

    -- Log event
    INSERT INTO events (event_type, user_id, session_id, metadata)
    VALUES ('pickup_requested', p_user_id, active_session.id, jsonb_build_object('ping_id', new_ping_id));

    RETURN jsonb_build_object('success', true, 'ping_id', new_ping_id);
END;
$$;

-- Admin RPCs (Simplified, in a real app we'd verify the caller is admin, but we'll assume the client passes the admin user_id and we check it)
CREATE OR REPLACE FUNCTION admin_create_user(
    admin_id UUID,
    p_display_name TEXT,
    p_access_code TEXT,
    p_emoji TEXT,
    p_accent_color TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_admin BOOLEAN;
    new_user_id UUID;
BEGIN
    SELECT role = 'admin' INTO is_admin FROM users WHERE id = admin_id;
    IF NOT is_admin THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    INSERT INTO users (role, display_name, access_code_hash, emoji, accent_color)
    VALUES ('passenger', p_display_name, crypt(p_access_code, gen_salt('bf')), p_emoji, p_accent_color)
    RETURNING id INTO new_user_id;

    RETURN jsonb_build_object('success', true, 'user_id', new_user_id);
END;
$$;

-- 5. Seed Data
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
    -- Delete events older than 30 days
    DELETE FROM events WHERE created_at < now() - interval '30 days';
END;
$$;
