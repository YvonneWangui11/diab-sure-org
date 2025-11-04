-- Create storage bucket for meal photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('meal-photos', 'meal-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for meal photo uploads
CREATE POLICY "Users can view meal photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'meal-photos');

CREATE POLICY "Users can upload their own meal photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'meal-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own meal photos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'meal-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own meal photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'meal-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);