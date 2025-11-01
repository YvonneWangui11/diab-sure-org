-- Fix search_path for validate_appointment_time function
CREATE OR REPLACE FUNCTION public.validate_appointment_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if NEW.end_time is not null and NEW.end_time < NEW.start_time then
    raise exception 'end_time cannot be before start_time';
  end if;
  return NEW;
end;
$$;