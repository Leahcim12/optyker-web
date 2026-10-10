-- Authenticated Edge Functions update work orders as service_role. Their
-- invoker trigger calls optyker_private.client_cart_add_work_order, which
-- already permits execution but could not resolve its private schema.
-- Browser roles keep no access; this does not expose the schema to PostgREST.
grant usage on schema optyker_private to service_role;
