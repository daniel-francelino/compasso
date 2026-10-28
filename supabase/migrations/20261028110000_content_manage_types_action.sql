begin;

insert into public.actions (key, module, description, admin_only, portal, requires)
values
  ('content.manage_types', 'content', 'Create, edit and archive content types', false, false, '{content.view}')
on conflict (key) do nothing;

insert into public.role_actions (role_id, action_key)
select r.id, 'content.manage_types' from public.roles r where r.key = 'manager'
on conflict do nothing;

create or replace function public.content_type_save(p_type jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_type ->> 'id', '')::uuid;
  v_name text := btrim(coalesce(p_type ->> 'name', ''));
  v_color text := coalesce(nullif(btrim(coalesce(p_type ->> 'color', '')), ''), 'violet');
  v_emoji text := nullif(btrim(coalesce(p_type ->> 'emoji', '')), '');
  v_org uuid := public.current_organization_id();
begin
  perform public.assert_action('content.manage_types');
  if char_length(v_name) not between 1 and 40
    or v_color not in ('violet', 'orchid', 'rose', 'peach', 'coral', 'sage', 'cactus', 'ink_soft')
    or (v_emoji is not null and char_length(v_emoji) > 8) then
    raise exception 'invalid_input';
  end if;

  begin
    if v_id is null then
      insert into public.content_types (organization_id, name, color, emoji)
      values (v_org, v_name, v_color, v_emoji)
      returning id into v_id;
    else
      update public.content_types
      set name = v_name, color = v_color, emoji = v_emoji
      where id = v_id and organization_id = v_org;
      if not found then
        raise exception 'not_found';
      end if;
    end if;
  exception when unique_violation then
    raise exception 'content_type_name_taken';
  end;

  perform public.audit_write(v_org, null, 'content_type.saved', 'content_type', v_id, '{}'::jsonb);
  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.content_type_set_archived(p_type uuid, p_archived boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := public.current_organization_id();
begin
  perform public.assert_action('content.manage_types');
  update public.content_types
  set archived_at = case when p_archived then now() else null end
  where id = p_type and organization_id = v_org;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.audit_write(
    v_org, null, 'content_type.archived', 'content_type', p_type,
    jsonb_build_object('archived', p_archived)
  );
  return jsonb_build_object('id', p_type);
end;
$$;

commit;
