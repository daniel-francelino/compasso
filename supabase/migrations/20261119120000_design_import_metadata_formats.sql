begin;

alter table public.design_import_metadata drop constraint design_import_metadata_source_format_check;
alter table public.design_import_metadata
  add constraint design_import_metadata_source_format_check check (source_format in ('psd', 'ai', 'pdf', 'png', 'jpeg', 'webp', 'tiff', 'avif', 'gif', 'ase', 'aco', 'gpl', 'svg', 'sketch'));

create or replace function public.design_record_import(p_design uuid, p_metadata jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.designs;
  v_format text;
  v_layers jsonb;
  v_fonts jsonb;
  v_colors jsonb;
  v_el jsonb;
  v_text text;
  v_id uuid;
  v_formats constant text[] := array['psd', 'ai', 'pdf', 'png', 'jpeg', 'webp', 'tiff', 'avif', 'gif', 'ase', 'aco', 'gpl', 'svg', 'sketch'];
  v_color_modes constant text[] := array['grayscale', 'rgb', 'cmyk', 'indexed', 'bitmap', 'unknown'];
  v_kinds constant text[] := array['raster', 'group', 'text', 'smart_object', 'adjustment', 'shape', 'unknown'];
  v_sources constant text[] := array['text', 'fill', 'swatch'];
  v_top constant text[] := array['version', 'source', 'dimensions', 'layers', 'textRuns', 'fonts', 'colors', 'truncation'];
  v_source_keys constant text[] := array['format', 'colorMode', 'bitsPerChannel', 'pageCount'];
  v_dimension_keys constant text[] := array['sourceWidth', 'sourceHeight', 'pageWidth', 'pageHeight'];
  v_layer_keys constant text[] := array['index', 'parentIndex', 'name', 'kind', 'visible', 'opacity', 'blendMode', 'bounds'];
  v_bounds_keys constant text[] := array['left', 'top', 'width', 'height'];
  v_font_keys constant text[] := array['name', 'usageCount'];
  v_color_keys constant text[] := array['r', 'g', 'b', 'source', 'count'];
  v_truncation_keys constant text[] := array['layers', 'textRuns', 'fonts', 'colors', 'textCharsDropped'];
  v_unsafe constant text := '[' || chr(1) || '-' || chr(31) || chr(127) || '-' || chr(159) || chr(173)
    || chr(8203) || '-' || chr(8207) || chr(8232) || '-' || chr(8238) || chr(8288) || '-' || chr(8297)
    || chr(65279) || chr(917504) || '-' || chr(917631) || ']';
  v_key text;
begin
  perform public.assert_action('design.update');
  select * into v_row from public.designs d where d.id = p_design;
  if not found or not public.can_access_brand(v_row.brand_id) then
    raise exception 'not_found';
  end if;
  if v_row.trashed_at is not null then
    raise exception 'design_trashed';
  end if;

  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'invalid_input';
  end if;
  if octet_length(p_metadata::text) > 1048576 then
    raise exception 'design_import_metadata_too_large';
  end if;

  if not (p_metadata ?& v_top) then
    raise exception 'invalid_input';
  end if;
  for v_key in select k from jsonb_object_keys(p_metadata) k loop
    if not (v_key = any (v_top)) then
      raise exception 'invalid_input';
    end if;
  end loop;

  if p_metadata -> 'version' is distinct from '1'::jsonb then
    raise exception 'invalid_input';
  end if;

  v_el := p_metadata -> 'source';
  if jsonb_typeof(v_el) <> 'object' then
    raise exception 'invalid_input';
  end if;
  if not (v_el ?& v_source_keys) or (select count(*) from jsonb_object_keys(v_el)) <> 4 then
    raise exception 'invalid_input';
  end if;
  if jsonb_typeof(v_el -> 'format') <> 'string' or jsonb_typeof(v_el -> 'colorMode') <> 'string' then
    raise exception 'invalid_input';
  end if;
  v_format := v_el ->> 'format';
  if not (v_format = any (v_formats)) or not ((v_el ->> 'colorMode') = any (v_color_modes)) then
    raise exception 'invalid_input';
  end if;
  if jsonb_typeof(v_el -> 'bitsPerChannel') not in ('number', 'null')
     or jsonb_typeof(v_el -> 'pageCount') not in ('number', 'null') then
    raise exception 'invalid_input';
  end if;

  v_el := p_metadata -> 'dimensions';
  if jsonb_typeof(v_el) <> 'object' then
    raise exception 'invalid_input';
  end if;
  if not (v_el ?& v_dimension_keys) or (select count(*) from jsonb_object_keys(v_el)) <> 4 then
    raise exception 'invalid_input';
  end if;
  for v_key in select unnest(v_dimension_keys) loop
    if jsonb_typeof(v_el -> v_key) <> 'number' then
      raise exception 'invalid_input';
    end if;
  end loop;

  v_el := p_metadata -> 'truncation';
  if jsonb_typeof(v_el) <> 'object' then
    raise exception 'invalid_input';
  end if;
  if not (v_el ?& v_truncation_keys) or (select count(*) from jsonb_object_keys(v_el)) <> 5 then
    raise exception 'invalid_input';
  end if;
  for v_key in select unnest(v_truncation_keys) loop
    v_text := case when v_key = 'textCharsDropped' then 'number' else 'boolean' end;
    if jsonb_typeof(v_el -> v_key) <> v_text then
      raise exception 'invalid_input';
    end if;
  end loop;

  if jsonb_typeof(p_metadata -> 'textRuns') <> 'array' then
    raise exception 'invalid_input';
  end if;
  if jsonb_array_length(p_metadata -> 'textRuns') <> 0 then
    raise exception 'invalid_input';
  end if;

  v_layers := p_metadata -> 'layers';
  if jsonb_typeof(v_layers) <> 'array' then
    raise exception 'invalid_input';
  end if;
  if jsonb_array_length(v_layers) > 1000 then
    raise exception 'invalid_input';
  end if;
  for v_el in select e from jsonb_array_elements(v_layers) e loop
    if jsonb_typeof(v_el) <> 'object' then
      raise exception 'invalid_input';
    end if;
    if not (v_el ?& v_layer_keys) or (select count(*) from jsonb_object_keys(v_el)) <> 8 then
      raise exception 'invalid_input';
    end if;
    if jsonb_typeof(v_el -> 'name') <> 'string' or jsonb_typeof(v_el -> 'blendMode') <> 'string'
       or jsonb_typeof(v_el -> 'kind') <> 'string' then
      raise exception 'invalid_input';
    end if;
    v_text := v_el ->> 'name';
    if char_length(v_text) > 200 or v_text ~ v_unsafe then
      raise exception 'invalid_input';
    end if;
    v_text := v_el ->> 'blendMode';
    if char_length(v_text) > 40 or v_text ~ v_unsafe then
      raise exception 'invalid_input';
    end if;
    if not ((v_el ->> 'kind') = any (v_kinds)) then
      raise exception 'invalid_input';
    end if;
    if jsonb_typeof(v_el -> 'index') <> 'number' or jsonb_typeof(v_el -> 'opacity') <> 'number'
       or jsonb_typeof(v_el -> 'visible') <> 'boolean'
       or jsonb_typeof(v_el -> 'parentIndex') not in ('number', 'null')
       or jsonb_typeof(v_el -> 'bounds') not in ('object', 'null') then
      raise exception 'invalid_input';
    end if;
    if jsonb_typeof(v_el -> 'bounds') = 'object' then
      if not ((v_el -> 'bounds') ?& v_bounds_keys)
         or (select count(*) from jsonb_object_keys(v_el -> 'bounds')) <> 4 then
        raise exception 'invalid_input';
      end if;
      for v_key in select unnest(v_bounds_keys) loop
        if jsonb_typeof(v_el -> 'bounds' -> v_key) <> 'number' then
          raise exception 'invalid_input';
        end if;
      end loop;
    end if;
  end loop;

  v_fonts := p_metadata -> 'fonts';
  if jsonb_typeof(v_fonts) <> 'array' then
    raise exception 'invalid_input';
  end if;
  if jsonb_array_length(v_fonts) > 100 then
    raise exception 'invalid_input';
  end if;
  for v_el in select e from jsonb_array_elements(v_fonts) e loop
    if jsonb_typeof(v_el) <> 'object' then
      raise exception 'invalid_input';
    end if;
    if not (v_el ?& v_font_keys) or (select count(*) from jsonb_object_keys(v_el)) <> 2 then
      raise exception 'invalid_input';
    end if;
    if jsonb_typeof(v_el -> 'name') <> 'string' or jsonb_typeof(v_el -> 'usageCount') <> 'number' then
      raise exception 'invalid_input';
    end if;
    v_text := v_el ->> 'name';
    if char_length(v_text) > 200 or v_text ~ v_unsafe then
      raise exception 'invalid_input';
    end if;
  end loop;

  v_colors := p_metadata -> 'colors';
  if jsonb_typeof(v_colors) <> 'array' then
    raise exception 'invalid_input';
  end if;
  if jsonb_array_length(v_colors) > 64 then
    raise exception 'invalid_input';
  end if;
  for v_el in select e from jsonb_array_elements(v_colors) e loop
    if jsonb_typeof(v_el) <> 'object' then
      raise exception 'invalid_input';
    end if;
    if not (v_el ?& v_color_keys) or (select count(*) from jsonb_object_keys(v_el)) <> 5 then
      raise exception 'invalid_input';
    end if;
    if jsonb_typeof(v_el -> 'r') <> 'number' or jsonb_typeof(v_el -> 'g') <> 'number'
       or jsonb_typeof(v_el -> 'b') <> 'number' or jsonb_typeof(v_el -> 'count') <> 'number'
       or jsonb_typeof(v_el -> 'source') <> 'string' then
      raise exception 'invalid_input';
    end if;
    for v_key in select unnest(array['r', 'g', 'b']) loop
      if (v_el ->> v_key)::numeric <> trunc((v_el ->> v_key)::numeric)
         or (v_el ->> v_key)::numeric < 0 or (v_el ->> v_key)::numeric > 255 then
        raise exception 'invalid_input';
      end if;
    end loop;
    if not ((v_el ->> 'source') = any (v_sources)) then
      raise exception 'invalid_input';
    end if;
  end loop;

  insert into public.design_import_metadata (design_id, brand_id, source_format, metadata, created_by, created_at)
  values (v_row.id, v_row.brand_id, v_format, p_metadata, auth.uid(), clock_timestamp())
  returning id into v_id;

  delete from public.design_import_metadata m
  where m.design_id = v_row.id
    and m.id not in (
      select k.id from public.design_import_metadata k
      where k.design_id = v_row.id
      order by k.created_at desc, k.id desc
      limit 20
    );

  perform public.audit_write(public.current_organization_id(), v_row.brand_id,
    'design.import_recorded', 'design', v_row.id,
    jsonb_build_object('format', v_format, 'layer_count', jsonb_array_length(v_layers)));
  return jsonb_build_object('id', v_id);
end;
$$;

commit;
