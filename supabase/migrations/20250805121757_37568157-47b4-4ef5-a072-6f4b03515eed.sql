-- Create medications table for doctor prescriptions
CREATE TABLE public.medications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  doctor_id UUID NOT NULL,
  medication_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  instructions TEXT,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create medication_logs table for patient intake tracking
CREATE TABLE public.medication_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medication_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  taken_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'taken',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for medications table
CREATE POLICY "Doctors can insert medications for their patients" 
ON public.medications 
FOR INSERT 
WITH CHECK (
  auth.uid() = doctor_id AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() AND role = 'doctor'
  )
);

CREATE POLICY "Doctors can view medications they prescribed" 
ON public.medications 
FOR SELECT 
USING (
  auth.uid() = doctor_id OR
  (auth.uid() = patient_id AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() AND role = 'patient'
  ))
);

CREATE POLICY "Doctors can update medications they prescribed" 
ON public.medications 
FOR UPDATE 
USING (
  auth.uid() = doctor_id AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() AND role = 'doctor'
  )
);

CREATE POLICY "Patients can view their own medications" 
ON public.medications 
FOR SELECT 
USING (
  auth.uid() = patient_id AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() AND role = 'patient'
  )
);

-- Create policies for medication_logs table
CREATE POLICY "Patients can insert their own medication logs" 
ON public.medication_logs 
FOR INSERT 
WITH CHECK (
  auth.uid() = patient_id AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() AND role = 'patient'
  )
);

CREATE POLICY "Patients can view their own medication logs" 
ON public.medication_logs 
FOR SELECT 
USING (
  auth.uid() = patient_id OR
  EXISTS (
    SELECT 1 FROM medications m 
    WHERE m.id = medication_id AND m.doctor_id = auth.uid()
  )
);

CREATE POLICY "Doctors can view medication logs for their patients" 
ON public.medication_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM medications m 
    WHERE m.id = medication_id AND m.doctor_id = auth.uid()
  )
);

-- Add foreign key constraints
ALTER TABLE public.medications 
ADD CONSTRAINT fk_medications_patient 
FOREIGN KEY (patient_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.medications 
ADD CONSTRAINT fk_medications_doctor 
FOREIGN KEY (doctor_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.medication_logs 
ADD CONSTRAINT fk_medication_logs_medication 
FOREIGN KEY (medication_id) REFERENCES public.medications(id) ON DELETE CASCADE;

ALTER TABLE public.medication_logs 
ADD CONSTRAINT fk_medication_logs_patient 
FOREIGN KEY (patient_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create trigger for updated_at on medications
CREATE TRIGGER update_medications_updated_at
BEFORE UPDATE ON public.medications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for these tables
ALTER TABLE public.medications REPLICA IDENTITY FULL;
ALTER TABLE public.medication_logs REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.medications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.medication_logs;