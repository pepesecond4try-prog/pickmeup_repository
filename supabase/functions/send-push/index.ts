import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import webpush from 'https://esm.sh/web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { record } = await req.json();

    if (!record || !record.id) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Get the user who made the ping
    const { data: pingUser } = await supabaseClient
      .from('users')
      .select('display_name, emoji')
      .eq('id', record.user_id)
      .single();

    // Get all admin push subscriptions
    const { data: adminUsers } = await supabaseClient
      .from('users')
      .select('id')
      .eq('role', 'admin');

    if (!adminUsers || adminUsers.length === 0) {
      return new Response(JSON.stringify({ message: 'No admins found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const adminIds = adminUsers.map(u => u.id);

    const { data: subscriptions } = await supabaseClient
      .from('push_subscriptions')
      .select('*')
      .in('user_id', adminIds);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: 'No subscriptions found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    webpush.setVapidDetails(
      'mailto:admin@example.com',
      Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
      Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
    );

    const payload = JSON.stringify({
      title: 'Pickup Requested',
      body: `${pingUser?.emoji || '👤'} ${pingUser?.display_name || 'Someone'} needs a pickup!`,
      url: '/'
    });

    const sendPromises = subscriptions.map(sub => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };
      return webpush.sendNotification(pushSubscription, payload).catch(err => {
        console.error('Error sending push to', sub.endpoint, err);
        // If gone, we could delete the subscription here
      });
    });

    await Promise.all(sendPromises);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
