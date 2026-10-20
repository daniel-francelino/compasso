begin;

drop function public.reassign_approver(uuid, uuid);

create or replace function public.approval_requests_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'record_immutable';
  end if;
  if new.brand_id <> old.brand_id or new.item_id <> old.item_id
    or new.revision_id <> old.revision_id or new.stage <> old.stage
    or new.requested_at <> old.requested_at or new.requested_by is distinct from old.requested_by
    or new.due_date is distinct from old.due_date or new.message is distinct from old.message then
    raise exception 'record_immutable';
  end if;
  if old.status <> 'pending' and (new.status <> old.status or new.decided_at is distinct from old.decided_at) then
    raise exception 'request_not_pending';
  end if;
  return new;
end;
$fn$;

drop index public.approval_requests_approver_idx;
alter table public.approval_requests drop column approver_user_id;

commit;
