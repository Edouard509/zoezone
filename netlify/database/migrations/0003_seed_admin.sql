-- ZOEZONE — bootstrap the first admin account.
-- Login email/password is provided separately by whoever ran this build (see deployment notes).
-- CHANGE THIS PASSWORD immediately after your first login via the admin dashboard's
-- "Change Password" screen, then you can safely ignore/rotate this seed row.
INSERT INTO admin_users (email, password_hash, name) VALUES
  ('admin@zoezone.com', '$2a$10$T6sQoXo0wGRqljO1Mkbobuc2OR8PLkbmhHkZ5mQWJ.z9dy6ZcBu0K', 'Store Admin')
ON CONFLICT (email) DO NOTHING;
