begin;

alter table public.comments
  add column parent_id uuid references public.comments (id),
  add column edited_at timestamptz,
  add constraint comments_parent_not_self check (parent_id is null or parent_id <> id);
create index comments_parent_idx on public.comments (parent_id) where parent_id is not null;

create or replace function public.comments_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'record_immutable';
  end if;
  if old.deleted_at is not null
    or new.id <> old.id or new.brand_id <> old.brand_id or new.item_id <> old.item_id
    or new.revision_id is distinct from old.revision_id or new.author_id <> old.author_id
    or new.visibility <> old.visibility or new.created_at <> old.created_at
    or new.parent_id is distinct from old.parent_id then
    raise exception 'record_immutable';
  end if;
  if new.deleted_at is not null and (
    new.body <> old.body or new.edited_at is distinct from old.edited_at
  ) then
    raise exception 'record_immutable';
  end if;
  return new;
end;
$$;

drop function public.comment_add(uuid, text, text);

create function public.comment_add(
  p_item uuid,
  p_visibility text,
  p_body text,
  p_parent uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.content_items;
  v_parent public.comments;
  v_root uuid;
  v_visibility text := p_visibility;
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  if p_parent is null then
    if v_visibility = 'internal' then
      perform public.assert_action('comments.create_internal');
    elsif v_visibility = 'external' then
      perform public.assert_action('comments.create_external');
    else
      raise exception 'invalid_input';
    end if;
  end if;
  if char_length(v_body) not between 1 and 4000 then
    raise exception 'invalid_input';
  end if;
  select * into v_item from public.content_items i where i.id = p_item;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_item.brand_id);

  if p_parent is not null then
    select * into v_parent from public.comments c
    where c.id = p_parent and c.item_id = p_item and c.deleted_at is null;
    if not found then
      raise exception 'not_found';
    end if;
    v_visibility := v_parent.visibility;
    v_root := coalesce(v_parent.parent_id, v_parent.id);
  end if;

  if p_parent is not null then
    if v_visibility = 'internal' then
      perform public.assert_action('comments.create_internal');
    else
      perform public.assert_action('comments.create_external');
    end if;
  end if;

  insert into public.comments (brand_id, item_id, revision_id, author_id, visibility, body, parent_id)
  values (
    v_item.brand_id, p_item, v_item.current_revision_id, auth.uid(), v_visibility, v_body, v_root
  )
  returning id into v_id;
  perform public.audit_write(
    public.current_organization_id(), v_item.brand_id, 'comment.created', 'comment', v_id,
    jsonb_build_object('visibility', v_visibility, 'item_id', p_item, 'is_reply', v_root is not null)
  );
  return jsonb_build_object('id', v_id);
end;
$$;

create function public.comment_edit(p_comment uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comment public.comments;
  v_body text := btrim(coalesce(p_body, ''));
begin
  select * into v_comment from public.comments c where c.id = p_comment and c.deleted_at is null;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_comment.brand_id);
  if v_comment.author_id <> auth.uid() then
    raise exception 'denied';
  end if;
  if char_length(v_body) not between 1 and 4000 then
    raise exception 'invalid_input';
  end if;
  update public.comments set body = v_body, edited_at = now() where id = p_comment;
  perform public.audit_write(
    public.current_organization_id(), v_comment.brand_id, 'comment.edited', 'comment', p_comment,
    jsonb_build_object('visibility', v_comment.visibility, 'item_id', v_comment.item_id)
  );
end;
$$;

create or replace function public.comment_list(p_item uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_brand uuid;
begin
  select i.brand_id into v_brand from public.content_items i where i.id = p_item;
  if v_brand is null then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_brand);
  if not (public.has_action('content.view') or public.has_action('approvals.view')) then
    raise exception 'denied';
  end if;
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id, 'visibility', c.visibility,
          'body', case when c.deleted_at is null then c.body end,
          'created_at', c.created_at, 'edited_at', c.edited_at, 'parent_id', c.parent_id,
          'deleted', c.deleted_at is not null,
          'author_id', c.author_id, 'author_name', p.full_name, 'revision_no', r.revision_no,
          'mine', c.deleted_at is null and c.author_id = auth.uid()
        )
        order by c.created_at
      )
      from public.comments c
      join public.profiles p on p.id = c.author_id
      left join public.content_revisions r on r.id = c.revision_id
      where c.item_id = p_item
        and (
          c.deleted_at is null
          or exists (
            select 1 from public.comments reply
            where reply.parent_id = c.id and reply.deleted_at is null
          )
        )
        and (
          (c.visibility = 'internal' and public.has_action('content.view'))
          or (c.visibility = 'external' and (public.has_action('approvals.view') or public.has_action('content.view')))
        )
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.audit_write(
  p_org uuid,
  p_brand uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_catalog constant text[] := array[
    'invitation.created',
    'invitation.revoked',
    'invitation.accepted',
    'client.created',
    'client.updated',
    'client.owner_changed',
    'client.archived',
    'client.reactivated',
    'client.deleted',
    'contact.created',
    'contact.updated',
    'contact.deleted',
    'brand.created',
    'brand.updated',
    'brand.timezone_changed',
    'brand.archived',
    'brand.reactivated',
    'brand.deleted',
    'brand.member_added',
    'brand.member_revoked',
    'brand.member_can_decide_changed',
    'channel.created',
    'channel.updated',
    'channel.archived',
    'channel.reactivated',
    'channel.deleted',
    'content.created',
    'content.updated',
    'content.submitted',
    'content.reopened',
    'content.cancelled',
    'content.published',
    'content.deleted',
    'content_channel.added',
    'content_channel.removed',
    'content_channel.rescheduled',
    'content_channel.published_manually',
    'content_channel.cancelled',
    'calendar_note.created',
    'calendar_note.updated',
    'calendar_note.archived',
    'calendar_note.converted',
    'variant.created',
    'variant.updated',
    'variant.submitted',
    'variant.reopened',
    'variant.rescheduled',
    'variant.cancelled',
    'variant.published_manually',
    'comment.created',
    'comment.deleted',
    'comment.edited',
    'approval.requested',
    'approval.decided',
    'approval.superseded',
    'approval.approved_by_team',
    'approval.cancelled',
    'approval.approver_reassigned',
    'approval.reminder_sent',
    'media.published',
    'media.unpublished',
    'media.deleted_permanently',
    'media.version_replaced',
    'media.share_created',
    'media.share_revoked',
    'site.page_published',
    'site.page_unpublished',
    'site.rolled_back',
    'site.case_study_authorized',
    'site.case_study_withdrawn',
    'site.settings_changed',
    'settings.policy_changed',
    'organization.updated',
    'audit.exported'
  ];
  v_actor uuid := auth.uid();
  v_kind text;
  v_request text;
begin
  if not (p_action = any (v_catalog)) then
    raise exception 'invalid_input';
  end if;

  if v_actor is null then
    v_kind := 'system';
  else
    select p.kind into v_kind from public.profiles p where p.id = v_actor;
    v_kind := coalesce(v_kind, 'internal');
  end if;

  begin
    v_request := (current_setting('request.headers', true)::jsonb) ->> 'x-request-id';
  exception when others then
    v_request := null;
  end;

  insert into public.audit_events (
    organization_id, brand_id, actor_id, actor_kind, action, entity_type, entity_id, metadata,
    request_id
  )
  values (
    p_org, p_brand, v_actor, v_kind, p_action, p_entity_type, p_entity_id,
    coalesce(p_metadata, '{}'::jsonb), v_request
  );
end;
$$;

revoke execute on function public.comment_add(uuid, text, text, uuid),
  public.comment_edit(uuid, text) from public, anon;
grant execute on function public.comment_add(uuid, text, text, uuid),
  public.comment_edit(uuid, text) to authenticated;

commit;
