process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://parts_inventory:parts_inventory_dev_password@localhost:5432/parts_inventory_test?schema=public";
process.env.DIRECT_URL ??= process.env.DATABASE_URL;
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-please-change-me-32chars";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-please-change-me-32chars";
process.env.COOKIE_SECRET ??= "test-cookie-secret-please-change-me-32chars";
