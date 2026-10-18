begin;

grant select, update on public.email_outbox to service_role;

commit;
