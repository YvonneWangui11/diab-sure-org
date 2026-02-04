-- Insert the clinician role for the test user who already signed up
INSERT INTO user_roles (user_id, role) 
VALUES ('6e0c6bf5-6fca-4935-94e1-28f83a016628', 'clinician')
ON CONFLICT (user_id, role) DO NOTHING;