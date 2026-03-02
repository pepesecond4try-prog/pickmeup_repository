# Pickup App Deployment Instructions

This is a production-grade, iOS-first, installable PWA built with React + Vite and Supabase.

## Supabase Setup

1. Create a new Supabase project.
2. Go to the SQL Editor and run the contents of `supabase/setup.sql`.
3. Get your `URL` and `anon key` from Project Settings -> API.
4. Add them to your `.env` file:
   ```
   VITE_SUPABASE_URL=your_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

## Web Push Notifications Setup

1. Generate VAPID keys using `npx web-push generate-vapid-keys`.
2. Add the public key to your `.env` file:
   ```
   VITE_VAPID_PUBLIC_KEY=your_public_key
   ```
3. Deploy the Edge Function to Supabase:
   ```bash
   supabase functions deploy send-push
   ```
4. Set the secrets for the Edge Function:
   ```bash
   supabase secrets set VAPID_PUBLIC_KEY=your_public_key VAPID_PRIVATE_KEY=your_private_key
   ```
5. Create a Database Webhook in Supabase:
   - Go to Database -> Webhooks.
   - Create a new webhook.
   - Trigger on `INSERT` to the `pings` table.
   - Type: Supabase Edge Function.
   - Select the `send-push` function.

## Deployment

### Netlify (Drag and Drop)
1. Run `npm run build`.
2. Drag the `dist` folder into Netlify.
3. Ensure you have added the environment variables in the Netlify UI.

### GitHub Connected Builds
1. Push the code to GitHub.
2. Connect the repository to Netlify or Vercel.
3. Add the environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`) in the platform's settings.
4. Deploy.

## Admin Access

- The default admin access code is `admin_pepe`.
- To test the app, you must add it to your home screen or simulate standalone mode.
