# Test Accounts for FBB Stock (app_metadata Setup)

This document outlines how to correctly create and configure test accounts in Supabase to test the Role-Level Security (RLS) policies.

> [!WARNING]
> **CRITICAL SECURITY NOTE:** Never use `user_metadata` for roles or permissions. `user_metadata` can be freely modified by users from the client side via `supabase.auth.updateUser()`. Any user could escalate their privileges if roles were stored there.
>
> We strictly use `app_metadata` which is securely isolated and can only be modified via the server (RPC, Serverless Functions, or directly via SQL in the dashboard).

## Role: HQ Admin
**Purpose**: Has full read and write access to all tables. Can access HQ fulfillment, Market Packing, and Blind Stocktake.

1. Go to Supabase Dashboard -> Authentication -> Users.
2. Create a new user (e.g., `hq_admin@test.com`).
3. Copy the `id` (UUID) of the newly created user.
4. Go to the **SQL Editor** in your Supabase Dashboard and run the following command to update their `app_metadata`:

```sql
UPDATE auth.users 
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "hq_admin"}'::jsonb
WHERE id = 'INSERT_USER_UUID_HERE';
```

## Role: Store Manager
**Purpose**: Has read-only access to products. Can only see `inventory_levels` and incoming `inventory_transfers` for their assigned store. Can only manage `store_orders` that belong to their specific `store_id`. Has absolutely NO access to `inventory_batches`.

1. Go to Supabase Dashboard -> Table Editor -> `stores`.
2. Copy the `id` (UUID) of an existing store (e.g., "Store A").
3. Go to Authentication -> Users.
4. Create a new user (e.g., `manager_a@test.com`) and copy their User `id` (UUID).
5. Go to the **SQL Editor** in your Supabase Dashboard and run the following command to inject their `role` and `store_id` into `app_metadata`:

```sql
UPDATE auth.users 
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "store_manager", "store_id": "INSERT_STORE_UUID_HERE"}'::jsonb
WHERE id = 'INSERT_USER_UUID_HERE';
```

*Note: Replace `INSERT_STORE_UUID_HERE` with the UUID from step 1, and `INSERT_USER_UUID_HERE` with the UUID from step 3.*

## How to test:
- Login with the HQ Admin account to verify global access and HQ-specific tasks.
- Login with the Store Manager account to verify that they can only see data filtered to their store, and cannot access or modify restricted tables like `inventory_batches`.

> [!IMPORTANT]
> **Token Refresh Required:** After updating `raw_app_meta_data` via SQL, the user MUST sign out and sign back in for the new role to take effect in their JWT. Existing sessions will continue to use the old metadata until the token refreshes.
