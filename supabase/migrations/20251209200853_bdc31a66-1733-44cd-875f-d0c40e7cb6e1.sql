-- Allow patients to send messages (reply to clinicians)
CREATE POLICY "Patients can send messages to clinicians"
ON public.messages
FOR INSERT
WITH CHECK (
  auth.uid() = from_user_id 
  AND to_clinician_id IS NOT NULL
  AND has_role(auth.uid(), 'patient')
);

-- Allow users to see messages they sent
CREATE POLICY "Users can view messages they sent"
ON public.messages
FOR SELECT
USING (auth.uid() = from_user_id);