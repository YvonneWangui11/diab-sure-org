-- Give the test clinician admin role so they can access admin features
INSERT INTO public.user_roles (user_id, role)
SELECT '6e0c6bf5-6fca-4935-94e1-28f83a016628', 'admin'
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = '6e0c6bf5-6fca-4935-94e1-28f83a016628' AND role = 'admin'
);