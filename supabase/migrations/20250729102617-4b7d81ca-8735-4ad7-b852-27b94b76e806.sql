-- Create user profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  date_of_birth DATE,
  role TEXT NOT NULL CHECK (role IN ('patient', 'doctor')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create patient-specific details table
CREATE TABLE public.patient_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  medical_history TEXT,
  current_medications TEXT[],
  allergies TEXT[],
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  insurance_provider TEXT,
  insurance_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create doctor-specific details table
CREATE TABLE public.doctor_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  specialization TEXT NOT NULL,
  license_number TEXT NOT NULL,
  hospital_affiliation TEXT,
  years_of_experience INTEGER,
  consultation_fee DECIMAL(10,2),
  availability_hours TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_details ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policies for patient details
CREATE POLICY "Patients can view their own details" ON public.patient_details
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Patients can update their own details" ON public.patient_details
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Patients can insert their own details" ON public.patient_details
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Doctors can view patient details" ON public.patient_details
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'doctor'
    )
  );

-- Create policies for doctor details
CREATE POLICY "Doctors can view their own details" ON public.doctor_details
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Doctors can update their own details" ON public.doctor_details
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Doctors can insert their own details" ON public.doctor_details
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view doctor details" ON public.doctor_details
  FOR SELECT USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patient_details_updated_at
  BEFORE UPDATE ON public.patient_details
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_doctor_details_updated_at
  BEFORE UPDATE ON public.doctor_details
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();