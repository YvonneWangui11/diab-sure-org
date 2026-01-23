-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can create automated alerts" ON public.health_alerts;

-- The SECURITY DEFINER function already bypasses RLS, so we don't need an additional policy
-- The existing "Doctors can create alerts" policy covers manual alert creation