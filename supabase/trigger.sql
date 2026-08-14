-- Run this in the Supabase SQL Editor AFTER the send-breakdown function
-- has been deployed. It makes every new row in public.signups call the
-- function automatically, so the breakdown email sends itself.
--
-- The webhook secret below must match the SIGNUP_WEBHOOK_SECRET set via
-- `supabase secrets set` for the function, and the anon key is the same
-- public key already used in index.html — safe to store here since this
-- runs server-side, never exposed to visitors.

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_new_signup()
returns trigger
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url := 'https://penzbxcgjxjgrcclyect.supabase.co/functions/v1/send-breakdown',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SUPABASE_ANON_KEY',
      'x-webhook-secret', 'b2f7837c0ddee7cd83b32dfd3ce2f4a6fb0534b8c17fa243'
    ),
    body := jsonb_build_object('record', row_to_json(new))
  );
  return new;
end;
$$;

drop trigger if exists on_signup_insert on public.signups;

create trigger on_signup_insert
after insert on public.signups
for each row execute function public.notify_new_signup();
