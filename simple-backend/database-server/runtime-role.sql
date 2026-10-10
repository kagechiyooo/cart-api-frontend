-- Apply as an administrator after migration. Provision actual LOGIN/password separately.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cart_api_server') THEN
    CREATE ROLE cart_api_server NOLOGIN;
  END IF;
END $$;
GRANT USAGE ON SCHEMA cart_api TO cart_api_server;
GRANT SELECT ON ALL TABLES IN SCHEMA cart_api TO cart_api_server;
GRANT INSERT ON cart_api.sessions, cart_api.cart_lines, cart_api.orders, cart_api.order_lines TO cart_api_server;
GRANT UPDATE ON cart_api.products, cart_api.coupons, cart_api.carts, cart_api.cart_lines TO cart_api_server;
GRANT UPDATE(status) ON cart_api.orders TO cart_api_server;
GRANT DELETE ON cart_api.cart_lines TO cart_api_server;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['users','products','coupons','carts','cart_lines','orders','order_lines','sessions'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS server_access ON cart_api.%I', t);
    EXECUTE format('CREATE POLICY server_access ON cart_api.%I TO cart_api_server USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
