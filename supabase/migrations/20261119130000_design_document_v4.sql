begin;

create function public.design_assert_path(p_element jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_color constant text := '^#[0-9a-f]{6}$';
  v_element_keys constant text[] := array[
    'id', 'kind', 'x', 'y', 'width', 'height', 'rotation', 'opacity', 'locked', 'groupId',
    'blendMode', 'fillOpacity', 'name', 'hidden', 'parentId', 'clipToBelow', 'mask',
    'd', 'viewWidth', 'viewHeight', 'fill', 'stroke', 'fillRule'
  ];
  v_paint jsonb;
  v_stroke jsonb;
  v_stop jsonb;
  v_key text;
  v_kind text;
  v_commands int;
begin
  if exists (select 1 from jsonb_object_keys(p_element) k where k <> all (v_element_keys)) then
    raise exception 'invalid_input';
  end if;

  if char_length(p_element ->> 'id') not between 1 and 40 then
    raise exception 'invalid_input';
  end if;
  foreach v_key in array array['x', 'y'] loop
    if coalesce(jsonb_typeof(p_element -> v_key), 'missing') <> 'number'
       or (p_element ->> v_key)::numeric not between -20000 and 20000 then
      raise exception 'invalid_input';
    end if;
  end loop;
  foreach v_key in array array['width', 'height'] loop
    if coalesce(jsonb_typeof(p_element -> v_key), 'missing') <> 'number'
       or (p_element ->> v_key)::numeric not between 1 and 20000 then
      raise exception 'invalid_input';
    end if;
  end loop;
  if coalesce(jsonb_typeof(p_element -> 'rotation'), 'missing') <> 'number'
     or (p_element ->> 'rotation')::numeric not between -360 and 360
     or coalesce(jsonb_typeof(p_element -> 'opacity'), 'missing') <> 'number'
     or (p_element ->> 'opacity')::numeric not between 0 and 1
     or coalesce(jsonb_typeof(p_element -> 'locked'), 'missing') <> 'boolean'
     or coalesce(jsonb_typeof(p_element -> 'groupId'), 'null') not in ('string', 'null') then
    raise exception 'invalid_input';
  end if;
  if jsonb_typeof(p_element -> 'groupId') = 'string'
     and char_length(p_element ->> 'groupId') not between 1 and 40 then
    raise exception 'invalid_input';
  end if;

  if coalesce(jsonb_typeof(p_element -> 'd'), 'missing') <> 'string'
     or char_length(p_element ->> 'd') not between 1 and 16384
     or (p_element ->> 'd') !~ '^[MLCQZ0-9.eE+ ,-]+$' then
    raise exception 'invalid_input';
  end if;
  v_commands := char_length(p_element ->> 'd') - char_length(translate(p_element ->> 'd', 'MLCQZ', ''));
  if v_commands not between 1 and 3000 then
    raise exception 'invalid_input';
  end if;

  foreach v_key in array array['viewWidth', 'viewHeight'] loop
    if coalesce(jsonb_typeof(p_element -> v_key), 'missing') <> 'number'
       or (p_element ->> v_key)::numeric not between 1 and 20000 then
      raise exception 'invalid_input';
    end if;
  end loop;

  if coalesce(jsonb_typeof(p_element -> 'fillRule'), 'missing') <> 'string'
     or (p_element ->> 'fillRule') not in ('nonzero', 'evenodd') then
    raise exception 'invalid_input';
  end if;

  v_paint := p_element -> 'fill';
  if v_paint is null then
    raise exception 'invalid_input';
  end if;
  if jsonb_typeof(v_paint) <> 'null' then
    if jsonb_typeof(v_paint) <> 'object' or coalesce(jsonb_typeof(v_paint -> 'kind'), 'missing') <> 'string' then
      raise exception 'invalid_input';
    end if;
    v_kind := v_paint ->> 'kind';
    if v_kind = 'solid' then
      if (select count(*) from jsonb_object_keys(v_paint)) <> 2
         or not (v_paint ?& array['color'])
         or coalesce(jsonb_typeof(v_paint -> 'color'), 'missing') <> 'string'
         or (v_paint ->> 'color') !~ v_color then
        raise exception 'invalid_input';
      end if;
    elsif v_kind in ('linear', 'radial') then
      if v_kind = 'linear' and (
           (select count(*) from jsonb_object_keys(v_paint)) <> 6
           or not (v_paint ?& array['x1', 'y1', 'x2', 'y2', 'stops'])) then
        raise exception 'invalid_input';
      end if;
      if v_kind = 'radial' and (
           (select count(*) from jsonb_object_keys(v_paint)) <> 5
           or not (v_paint ?& array['cx', 'cy', 'r', 'stops'])) then
        raise exception 'invalid_input';
      end if;
      foreach v_key in array case v_kind
        when 'linear' then array['x1', 'y1', 'x2', 'y2']
        else array['cx', 'cy', 'r']
      end loop
        if coalesce(jsonb_typeof(v_paint -> v_key), 'missing') <> 'number'
           or (v_paint ->> v_key)::numeric not between 0 and 1 then
          raise exception 'invalid_input';
        end if;
      end loop;
      if v_kind = 'radial' and (v_paint ->> 'r')::numeric <= 0 then
        raise exception 'invalid_input';
      end if;
      if coalesce(jsonb_typeof(v_paint -> 'stops'), 'missing') <> 'array'
         or jsonb_array_length(v_paint -> 'stops') not between 2 and 8 then
        raise exception 'invalid_input';
      end if;
      for v_stop in select s from jsonb_array_elements(v_paint -> 'stops') s loop
        if jsonb_typeof(v_stop) <> 'object'
           or (select count(*) from jsonb_object_keys(v_stop)) <> 3
           or not (v_stop ?& array['offset', 'color', 'alpha'])
           or coalesce(jsonb_typeof(v_stop -> 'color'), 'missing') <> 'string'
           or (v_stop ->> 'color') !~ v_color then
          raise exception 'invalid_input';
        end if;
        foreach v_key in array array['offset', 'alpha'] loop
          if coalesce(jsonb_typeof(v_stop -> v_key), 'missing') <> 'number'
             or (v_stop ->> v_key)::numeric not between 0 and 1 then
            raise exception 'invalid_input';
          end if;
        end loop;
      end loop;
    else
      raise exception 'invalid_input';
    end if;
  end if;

  v_stroke := p_element -> 'stroke';
  if v_stroke is null then
    raise exception 'invalid_input';
  end if;
  if jsonb_typeof(v_stroke) <> 'null' then
    if jsonb_typeof(v_stroke) <> 'object'
       or (select count(*) from jsonb_object_keys(v_stroke)) <> 6
       or not (v_stroke ?& array['color', 'width', 'cap', 'join', 'miterLimit', 'dashed'])
       or coalesce(jsonb_typeof(v_stroke -> 'color'), 'missing') <> 'string'
       or (v_stroke ->> 'color') !~ v_color
       or coalesce(jsonb_typeof(v_stroke -> 'cap'), 'missing') <> 'string'
       or (v_stroke ->> 'cap') not in ('butt', 'round', 'square')
       or coalesce(jsonb_typeof(v_stroke -> 'join'), 'missing') <> 'string'
       or (v_stroke ->> 'join') not in ('miter', 'round', 'bevel')
       or coalesce(jsonb_typeof(v_stroke -> 'dashed'), 'missing') <> 'boolean' then
      raise exception 'invalid_input';
    end if;
    if coalesce(jsonb_typeof(v_stroke -> 'width'), 'missing') <> 'number'
       or (v_stroke ->> 'width')::numeric not between 0.1 and 100
       or coalesce(jsonb_typeof(v_stroke -> 'miterLimit'), 'missing') <> 'number'
       or (v_stroke ->> 'miterLimit')::numeric not between 1 and 20 then
      raise exception 'invalid_input';
    end if;
  end if;
end;
$$;

create or replace function public.design_assert_document(p_document jsonb, p_brand uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_version int;
  v_page jsonb;
  v_element jsonb;
  v_kind text;
  v_kinds text[];
  v_blends constant text[] := array[
    'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn',
    'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'
  ];
  v_adjustments constant text[] := array[
    'brightness_contrast', 'levels', 'curves', 'hue_saturation', 'color_balance', 'black_white',
    'invert', 'threshold'
  ];
  v_key text;
  v_groups text[];
  v_parents jsonb;
  v_current text;
  v_depth int;
  v_mask jsonb;
  v_number numeric;
  v_total int := 0;
  v_max int;
begin
  if p_document is null or jsonb_typeof(p_document) <> 'object'
     or coalesce(jsonb_typeof(p_document -> 'version'), 'null') <> 'number'
     or (p_document ->> 'version') not in ('2', '3', '4')
     or coalesce(jsonb_typeof(p_document -> 'pages'), 'missing') <> 'array'
     or jsonb_array_length(p_document -> 'pages') < 1 then
    raise exception 'invalid_input';
  end if;
  if octet_length(p_document::text) > 262144 or jsonb_array_length(p_document -> 'pages') > 10 then
    raise exception 'design_too_large';
  end if;
  v_version := (p_document ->> 'version')::int;
  v_max := case v_version when 2 then 100 else 200 end;
  v_kinds := case v_version
    when 2 then array['text', 'image', 'rect', 'ellipse', 'line']
    when 3 then array['text', 'image', 'rect', 'ellipse', 'line', 'raster', 'adjustment', 'group']
    else array['text', 'image', 'rect', 'ellipse', 'line', 'raster', 'adjustment', 'group', 'path']
  end;

  for v_page in select p from jsonb_array_elements(p_document -> 'pages') p loop
    if jsonb_typeof(v_page) <> 'object'
       or coalesce(jsonb_typeof(v_page -> 'id'), 'missing') <> 'string'
       or coalesce(jsonb_typeof(v_page -> 'elements'), 'missing') <> 'array'
       or coalesce(jsonb_typeof(v_page -> 'background'), 'missing') not in ('string', 'null') then
      raise exception 'invalid_input';
    end if;
    if jsonb_typeof(v_page -> 'background') = 'string'
       and (v_page ->> 'background') !~ '^#[0-9a-f]{6}$' then
      raise exception 'invalid_input';
    end if;
    foreach v_key in array array['width', 'height'] loop
      continue when not (v_page ? v_key);
      if v_version < 3 or jsonb_typeof(v_page -> v_key) <> 'number' then
        raise exception 'invalid_input';
      end if;
      v_number := (v_page ->> v_key)::numeric;
      if v_number <> trunc(v_number) or v_number not between 64 and 4096 then
        raise exception 'invalid_input';
      end if;
    end loop;
    v_total := v_total + jsonb_array_length(v_page -> 'elements');
    if v_total > v_max then
      raise exception 'design_too_large';
    end if;

    for v_element in select e from jsonb_array_elements(v_page -> 'elements') e loop
      if jsonb_typeof(v_element) <> 'object'
         or coalesce(jsonb_typeof(v_element -> 'id'), 'missing') <> 'string'
         or not (coalesce(v_element ->> 'kind', '') = any (v_kinds)) then
        raise exception 'invalid_input';
      end if;
    end loop;

    select coalesce(array_agg(e ->> 'id') filter (where e ->> 'kind' = 'group'), '{}'),
           coalesce(jsonb_object_agg(e ->> 'id', coalesce(e -> 'parentId', 'null'::jsonb)), '{}'::jsonb)
    into v_groups, v_parents
    from jsonb_array_elements(v_page -> 'elements') e;

    for v_element in select e from jsonb_array_elements(v_page -> 'elements') e loop
      v_kind := v_element ->> 'kind';
      if v_kind = 'image' then
        perform public.design_assert_media(v_element -> 'mediaVersionId', p_brand, 'image/%');
      end if;
      continue when v_version < 3;

      if v_element ? 'blendMode'
         and (jsonb_typeof(v_element -> 'blendMode') <> 'string'
              or not ((v_element ->> 'blendMode') = any (v_blends))) then
        raise exception 'invalid_input';
      end if;
      if v_element ? 'fillOpacity'
         and (jsonb_typeof(v_element -> 'fillOpacity') <> 'number'
              or (v_element ->> 'fillOpacity')::numeric not between 0 and 1) then
        raise exception 'invalid_input';
      end if;
      if v_element ? 'name'
         and (jsonb_typeof(v_element -> 'name') <> 'string'
              or char_length(v_element ->> 'name') > 80) then
        raise exception 'invalid_input';
      end if;
      foreach v_key in array array['hidden', 'clipToBelow'] loop
        if v_element ? v_key and jsonb_typeof(v_element -> v_key) <> 'boolean' then
          raise exception 'invalid_input';
        end if;
      end loop;

      if coalesce(jsonb_typeof(v_element -> 'parentId'), 'null') not in ('string', 'null') then
        raise exception 'invalid_input';
      end if;
      v_current := v_element ->> 'parentId';
      v_depth := 0;
      while v_current is not null loop
        v_depth := v_depth + 1;
        if v_current = v_element ->> 'id' or v_depth > 8 or not (v_current = any (v_groups)) then
          raise exception 'invalid_input';
        end if;
        v_current := case jsonb_typeof(v_parents -> v_current)
          when 'string' then v_parents ->> v_current
          else null
        end;
      end loop;

      v_mask := coalesce(v_element -> 'mask', 'null'::jsonb);
      if jsonb_typeof(v_mask) <> 'null' then
        if jsonb_typeof(v_mask) <> 'object'
           or coalesce(jsonb_typeof(v_mask -> 'enabled'), 'boolean') <> 'boolean'
           or coalesce(jsonb_typeof(v_mask -> 'linked'), 'boolean') <> 'boolean' then
          raise exception 'invalid_input';
        end if;
        if coalesce(jsonb_typeof(v_mask -> 'mediaVersionId'), 'null') <> 'null' then
          perform public.design_assert_media(v_mask -> 'mediaVersionId', p_brand, 'image/png');
        end if;
      end if;

      if v_kind = 'raster' then
        if coalesce(jsonb_typeof(v_element -> 'pixelsVersionId'), 'null') <> 'null' then
          perform public.design_assert_media(v_element -> 'pixelsVersionId', p_brand, 'image/png');
        end if;
        foreach v_key in array array['pixelWidth', 'pixelHeight'] loop
          if coalesce(jsonb_typeof(v_element -> v_key), 'missing') <> 'number' then
            raise exception 'invalid_input';
          end if;
          v_number := (v_element ->> v_key)::numeric;
          if v_number <> trunc(v_number) or v_number not between 1 and 4096 then
            raise exception 'invalid_input';
          end if;
        end loop;
      elsif v_kind = 'adjustment' then
        if coalesce(jsonb_typeof(v_element -> 'adjustment'), 'missing') <> 'object'
           or not (coalesce(v_element -> 'adjustment' ->> 'type', '') = any (v_adjustments)) then
          raise exception 'invalid_input';
        end if;
      elsif v_kind = 'group' then
        foreach v_key in array array['collapsed', 'passThrough'] loop
          if v_element ? v_key and jsonb_typeof(v_element -> v_key) <> 'boolean' then
            raise exception 'invalid_input';
          end if;
        end loop;
      elsif v_kind = 'path' then
        perform public.design_assert_path(v_element);
      end if;
    end loop;
  end loop;
end;
$$;

revoke execute on function public.design_assert_path(jsonb) from public, anon, authenticated;

commit;
