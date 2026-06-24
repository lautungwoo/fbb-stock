alter table "public"."inventory_transfers" add column if not exists "cancelled_at" timestamptz default null;
