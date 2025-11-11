-- Fix security issues in RLS policies

-- 1. Fix doctor_details public exposure
-- Drop the overly permissive policy that allows anyone to view doctor details
DROP POLICY IF EXISTS "Users can view doctor details" ON public.doctor_details;

-- Create restrictive policies for doctor_details
-- Only authenticated users can view doctor profiles (for patient search)
CREATE POLICY "Authenticated users can view doctor profiles"
ON public.doctor_details
FOR SELECT
TO authenticated
USING (true);

-- Doctors can view their own details
CREATE POLICY "Doctors can view own details"
ON public.doctor_details
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all doctor details
CREATE POLICY "Admins can view all doctor details"
ON public.doctor_details
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Fix patient_details clinician access
-- Drop the overly permissive clinician policy
DROP POLICY IF EXISTS "Clinicians can view patient details" ON public.patient_details;

-- Create restrictive policy that only allows clinicians to view their assigned patients
CREATE POLICY "Clinicians can view assigned patient details"
ON public.patient_details
FOR SELECT
USING (
  public.has_role(auth.uid(), 'clinician') AND
  EXISTS (
    SELECT 1 FROM public.doctor_patients
    WHERE doctor_patients.doctor_id = auth.uid()
    AND doctor_patients.patient_id = patient_details.user_id
    AND doctor_patients.status = 'active'
  )
);