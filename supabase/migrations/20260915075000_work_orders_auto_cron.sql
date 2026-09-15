-- Advance laboratory orders automatically even when Optyker is closed.
-- The status function itself is not executable by anon/authenticated roles.

do $$
declare j bigint;
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    for j in select jobid from cron.job where jobname='optyker-work-orders-auto-advance' loop
      perform cron.unschedule(j);
    end loop;
    perform cron.schedule(
      'optyker-work-orders-auto-advance',
      '*/15 * * * *',
      'select public.optyker_work_orders_auto_advance();'
    );
  end if;
end $$;
