alter table "public"."stores" disable row level security;
alter table "public"."products" disable row level security;
alter table "public"."inventory_levels" disable row level security;
alter table "public"."inventory_batches" disable row level security;
alter table "public"."inventory_transfers" disable row level security;
alter table "public"."store_orders" disable row level security;
alter table "public"."store_order_items" disable row level security;

drop policy if exists "hq_admin_all_stores" on "public"."stores";
drop policy if exists "hq_admin_all_products" on "public"."products";
drop policy if exists "hq_admin_all_inventory_levels" on "public"."inventory_levels";
drop policy if exists "hq_admin_all_inventory_batches" on "public"."inventory_batches";
drop policy if exists "hq_admin_all_inventory_transfers" on "public"."inventory_transfers";
drop policy if exists "hq_admin_all_store_orders" on "public"."store_orders";
drop policy if exists "hq_admin_all_store_order_items" on "public"."store_order_items";

drop policy if exists "store_manager_select_stores" on "public"."stores";
drop policy if exists "store_manager_select_products" on "public"."products";
drop policy if exists "store_manager_select_inventory_levels" on "public"."inventory_levels";
drop policy if exists "store_manager_select_inventory_batches" on "public"."inventory_batches";
drop policy if exists "store_manager_select_inventory_transfers" on "public"."inventory_transfers";
drop policy if exists "store_manager_select_store_orders" on "public"."store_orders";
drop policy if exists "store_manager_insert_store_orders" on "public"."store_orders";
drop policy if exists "store_manager_update_store_orders" on "public"."store_orders";
drop policy if exists "store_manager_select_store_order_items" on "public"."store_order_items";
drop policy if exists "store_manager_insert_store_order_items" on "public"."store_order_items";
drop policy if exists "store_manager_update_store_order_items" on "public"."store_order_items";

drop function if exists public.current_user_role();
drop function if exists public.current_user_store_id();
