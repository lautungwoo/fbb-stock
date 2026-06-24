create or replace function public.transfer_to_popup(p_items jsonb, p_to_location text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
  v_product_id uuid;
  v_qty int;
  v_hq_stock int;
  v_existing_id uuid;
begin
  -- Validate role
  if public.current_user_role() != 'hq_admin' then
    raise exception 'Permission denied: Only HQ Admin can transfer to pop-up.';
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (item.value->>'product_id')::uuid;
    v_qty := (item.value->>'qty')::int;

    -- 1. Deduct from HQ (Central Kitchen)
    select stock_quantity into v_hq_stock 
    from public.inventory_levels 
    where product_id = v_product_id and location_name = 'Central Kitchen' 
    for update;

    if v_hq_stock is null or v_hq_stock < v_qty then
      raise exception 'Insufficient stock at Central Kitchen for product %', v_product_id;
    end if;

    update public.inventory_levels 
    set stock_quantity = stock_quantity - v_qty, last_updated_at = now()
    where product_id = v_product_id and location_name = 'Central Kitchen';

    -- 2. Add to Pop-up
    select id into v_existing_id
    from public.inventory_levels
    where product_id = v_product_id and location_name = p_to_location
    for update;

    if v_existing_id is not null then
      update public.inventory_levels
      set stock_quantity = stock_quantity + v_qty, last_updated_at = now()
      where id = v_existing_id;
    else
      insert into public.inventory_levels (product_id, location_name, stock_quantity, last_updated_at)
      values (v_product_id, p_to_location, v_qty, now());
    end if;
  end loop;
end;
$$;
grant execute on function public.transfer_to_popup(jsonb, text) to authenticated;
