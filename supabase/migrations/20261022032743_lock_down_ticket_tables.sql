-- Stop the public Data API from reading or changing support data.
--
-- The Next.js server uses the service role, which bypasses row level
-- security, and only after an operator session check (except public ticket
-- intake, which inserts one new ticket and does not read the queue).
-- anon and authenticated get no policies, so the publishable key cannot
-- list tickets, customer emails, or AI logs.

do $$
declare
  pol record;
  tbl text;
begin
  foreach tbl in array array['departments', 'tickets', 'ai_logs']
  loop
    if to_regclass(format('public.%I', tbl)) is null then
      raise exception 'Expected public.% to exist before locking it down', tbl;
    end if;

    for pol in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = tbl
    loop
      execute format(
        'drop policy if exists %I on public.%I',
        pol.policyname,
        tbl
      );
    end loop;

    execute format(
      'alter table public.%I enable row level security',
      tbl
    );
    execute format(
      'revoke all on table public.%I from public, anon, authenticated',
      tbl
    );
  end loop;
end
$$;
