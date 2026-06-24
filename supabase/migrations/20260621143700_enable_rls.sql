-- Create Helper Functions
create or replace function public.current_user_role() returns text as $$
  select (auth.jwt() -> 'app_metadata' ->> 'role')::text;
$$ language sql stable security definer set search_path = '';
grant execute on function public.current_user_role() to authenticated, anon;

create or replace function public.current_user_store_id() returns uuid as $$
  select (auth.jwt() -> 'app_metadata' ->> 'store_id')::uuid;
$$ language sql stable security definer set search_path = '';
grant execute on function public.current_user_store_id() to authenticated, anon;

-- Enable RLS on all tables
alter table "public"."stores" enable row level security;
alter table "public"."products" enable row level security;
alter table "public"."inventory_levels" enable row level security;
alter table "public"."inventory_batches" enable row level security;
alter table "public"."inventory_transfers" enable row level security;
alter table "public"."store_orders" enable row level security;
alter table "public"."store_order_items" enable row level security;

-- HQ Admin Policies: Full access to all tables
create policy "hq_admin_all_stores" on "public"."stores" to authenticated using (public.current_user_role() = 'hq_admin') with check (public.current_user_role() = 'hq_admin');
create policy "hq_admin_all_products" on "public"."products" to authenticated using (public.current_user_role() = 'hq_admin') with check (public.current_user_role() = 'hq_admin');
create policy "hq_admin_all_inventory_levels" on "public"."inventory_levels" to authenticated using (public.current_user_role() = 'hq_admin') with check (public.current_user_role() = 'hq_admin');
create policy "hq_admin_all_inventory_batches" on "public"."inventory_batches" to authenticated using (public.current_user_role() = 'hq_admin') with check (public.current_user_role() = 'hq_admin');
create policy "hq_admin_all_inventory_transfers" on "public"."inventory_transfers" to authenticated using (public.current_user_role() = 'hq_admin') with check (public.current_user_role() = 'hq_admin');
create policy "hq_admin_all_store_orders" on "public"."store_orders" to authenticated using (public.current_user_role() = 'hq_admin') with check (public.current_user_role() = 'hq_admin');
create policy "hq_admin_all_store_order_items" on "public"."store_order_items" to authenticated using (public.current_user_role() = 'hq_admin') with check (public.current_user_role() = 'hq_admin');

-- Store Manager Policies
-- stores: select own store
create policy "store_manager_select_stores" on "public"."stores" for select to authenticated using (public.current_user_role() = 'store_manager' and id = public.current_user_store_id());

-- products: read only
create policy "store_manager_select_products" on "public"."products" for select to authenticated using (public.current_user_role() = 'store_manager');

-- inventory_levels: read only for own store
create policy "store_manager_select_inventory_levels" on "public"."inventory_levels" for select to authenticated using (public.current_user_role() = 'store_manager' and location_name = (select name from public.stores where id = public.current_user_store_id()));

-- inventory_batches: HQ only, completely restricted for store_manager (no policy added)

-- inventory_transfers: read only for incoming transfers to own store
create policy "store_manager_select_inventory_transfers" on "public"."inventory_transfers" for select to authenticated using (public.current_user_role() = 'store_manager' and to_location = (select name from public.stores where id = public.current_user_store_id()));

-- store_orders: select, insert, update own store
create policy "store_manager_select_store_orders" on "public"."store_orders" for select to authenticated using (public.current_user_role() = 'store_manager' and store_id = public.current_user_store_id());
create policy "store_manager_insert_store_orders" on "public"."store_orders" for insert to authenticated with check (public.current_user_role() = 'store_manager' and store_id = public.current_user_store_id());
create policy "store_manager_update_store_orders" on "public"."store_orders" for update to authenticated using (public.current_user_role() = 'store_manager' and store_id = public.current_user_store_id()) with check (public.current_user_role() = 'store_manager' and store_id = public.current_user_store_id());

-- store_order_items: select, insert, update where order is for own store
create policy "store_manager_select_store_order_items" on "public"."store_order_items" for select to authenticated using (public.current_user_role() = 'store_manager' and order_id in (select id from public.store_orders where store_id = public.current_user_store_id()));
create policy "store_manager_insert_store_order_items" on "public"."store_order_items" for insert to authenticated with check (public.current_user_role() = 'store_manager' and order_id in (select id from public.store_orders where store_id = public.current_user_store_id()));
create policy "store_manager_update_store_order_items" on "public"."store_order_items" for update to authenticated using (public.current_user_role() = 'store_manager' and order_id in (select id from public.store_orders where store_id = public.current_user_store_id())) with check (public.current_user_role() = 'store_manager' and order_id in (select id from public.store_orders where store_id = public.current_user_store_id()));
