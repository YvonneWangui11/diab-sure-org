-- Part 1: Assign patient roles and link to clinician
INSERT INTO user_roles (user_id, role) VALUES 
('d892bad6-c1e2-4ecb-90ca-aa95643260fb', 'patient'),
('e7101b54-742f-436d-88c1-accf433a86a5', 'patient'),
('48d1869b-5685-4b66-b0a1-87056a7bb023', 'patient'),
('691851e5-68fd-4d42-aadd-26f5e4ea39d0', 'patient'),
('0a282446-5b74-4dd4-8c15-13e93076ada5', 'patient')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO doctor_patients (doctor_id, patient_id, status) VALUES
('6e0c6bf5-6fca-4935-94e1-28f83a016628', 'd892bad6-c1e2-4ecb-90ca-aa95643260fb', 'active'),
('6e0c6bf5-6fca-4935-94e1-28f83a016628', 'e7101b54-742f-436d-88c1-accf433a86a5', 'active'),
('6e0c6bf5-6fca-4935-94e1-28f83a016628', '48d1869b-5685-4b66-b0a1-87056a7bb023', 'active'),
('6e0c6bf5-6fca-4935-94e1-28f83a016628', '691851e5-68fd-4d42-aadd-26f5e4ea39d0', 'active'),
('6e0c6bf5-6fca-4935-94e1-28f83a016628', '0a282446-5b74-4dd4-8c15-13e93076ada5', 'active')
ON CONFLICT DO NOTHING;

-- Part 2: Add prescriptions
INSERT INTO prescriptions (patient_id, clinician_id, drug_name, dosage, frequency, start_date, end_date, instructions, status) VALUES
('d892bad6-c1e2-4ecb-90ca-aa95643260fb', '6e0c6bf5-6fca-4935-94e1-28f83a016628', 'Metformin', '850mg', 'Three times daily', CURRENT_DATE - INTERVAL '45 days', CURRENT_DATE + INTERVAL '45 days', 'Take with meals', 'active'),
('d892bad6-c1e2-4ecb-90ca-aa95643260fb', '6e0c6bf5-6fca-4935-94e1-28f83a016628', 'Insulin Glargine', '20 units', 'Once daily at bedtime', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '60 days', 'Inject subcutaneously', 'active'),
('e7101b54-742f-436d-88c1-accf433a86a5', '6e0c6bf5-6fca-4935-94e1-28f83a016628', 'Metformin', '1000mg', 'Twice daily', CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE + INTERVAL '30 days', 'Take with food', 'active'),
('48d1869b-5685-4b66-b0a1-87056a7bb023', '6e0c6bf5-6fca-4935-94e1-28f83a016628', 'Metformin', '500mg', 'Twice daily', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '60 days', 'Take with meals', 'active'),
('48d1869b-5685-4b66-b0a1-87056a7bb023', '6e0c6bf5-6fca-4935-94e1-28f83a016628', 'Glibenclamide', '5mg', 'Once daily', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '60 days', 'Take in the morning', 'active'),
('691851e5-68fd-4d42-aadd-26f5e4ea39d0', '6e0c6bf5-6fca-4935-94e1-28f83a016628', 'Glimepiride', '2mg', 'Once daily', CURRENT_DATE - INTERVAL '25 days', CURRENT_DATE + INTERVAL '65 days', 'Take before breakfast', 'active'),
('0a282446-5b74-4dd4-8c15-13e93076ada5', '6e0c6bf5-6fca-4935-94e1-28f83a016628', 'Metformin', '500mg', 'Once daily', CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE + INTERVAL '70 days', 'Take with breakfast', 'active');

-- Part 3: Add glucose readings
INSERT INTO glucose_readings (patient_id, glucose_value, test_time, notes, created_at) VALUES
('d892bad6-c1e2-4ecb-90ca-aa95643260fb', 185, 'Fasting', 'Missed evening dose', NOW() - INTERVAL '1 day'),
('d892bad6-c1e2-4ecb-90ca-aa95643260fb', 210, 'After meal', 'Heavy lunch', NOW() - INTERVAL '2 days'),
('d892bad6-c1e2-4ecb-90ca-aa95643260fb', 165, 'Fasting', NULL, NOW() - INTERVAL '3 days'),
('e7101b54-742f-436d-88c1-accf433a86a5', 320, 'Fasting', 'Feeling unwell', NOW() - INTERVAL '1 day'),
('e7101b54-742f-436d-88c1-accf433a86a5', 285, 'After meal', NULL, NOW() - INTERVAL '3 days'),
('e7101b54-742f-436d-88c1-accf433a86a5', 310, 'Fasting', 'Missed medications', NOW() - INTERVAL '5 days'),
('48d1869b-5685-4b66-b0a1-87056a7bb023', 105, 'Fasting', 'Before breakfast', NOW() - INTERVAL '1 day'),
('48d1869b-5685-4b66-b0a1-87056a7bb023', 128, 'After meal', 'After lunch', NOW() - INTERVAL '1 day'),
('48d1869b-5685-4b66-b0a1-87056a7bb023', 112, 'Fasting', 'Before breakfast', NOW() - INTERVAL '2 days'),
('691851e5-68fd-4d42-aadd-26f5e4ea39d0', 145, 'Fasting', NULL, NOW() - INTERVAL '1 day'),
('691851e5-68fd-4d42-aadd-26f5e4ea39d0', 168, 'After meal', 'After lunch', NOW() - INTERVAL '2 days'),
('0a282446-5b74-4dd4-8c15-13e93076ada5', 98, 'Fasting', 'Good morning', NOW() - INTERVAL '1 day'),
('0a282446-5b74-4dd4-8c15-13e93076ada5', 135, 'After meal', 'Post dinner', NOW() - INTERVAL '2 days');

-- Part 4: Add health alerts
INSERT INTO health_alerts (doctor_id, patient_id, alert_type, message, severity, resolved, created_at) VALUES
('6e0c6bf5-6fca-4935-94e1-28f83a016628', 'e7101b54-742f-436d-88c1-accf433a86a5', 'high_glucose', 'CRITICAL: matheoo sean recorded very high glucose of 320 mg/dL. Urgent follow-up recommended.', 'critical', false, NOW() - INTERVAL '1 day'),
('6e0c6bf5-6fca-4935-94e1-28f83a016628', 'e7101b54-742f-436d-88c1-accf433a86a5', 'missed_medication', 'matheoo sean has missed 5 medication doses in the past 7 days.', 'warning', false, NOW() - INTERVAL '2 days'),
('6e0c6bf5-6fca-4935-94e1-28f83a016628', 'd892bad6-c1e2-4ecb-90ca-aa95643260fb', 'high_glucose', 'WARNING: john kimashiil recorded elevated glucose of 210 mg/dL after meal.', 'warning', false, NOW() - INTERVAL '2 days'),
('6e0c6bf5-6fca-4935-94e1-28f83a016628', 'd892bad6-c1e2-4ecb-90ca-aa95643260fb', 'missed_medication', 'john kimashiil has missed 3 medication doses in the past 7 days.', 'warning', false, NOW() - INTERVAL '3 days'),
('6e0c6bf5-6fca-4935-94e1-28f83a016628', '691851e5-68fd-4d42-aadd-26f5e4ea39d0', 'no_activity', 'Ruth Wangui has not logged exercise in 5 days.', 'info', false, NOW() - INTERVAL '1 day');

-- Part 5: Add exercise logs with correct intensity values
INSERT INTO exercise_logs (patient_id, exercise_type, duration_minutes, intensity, date_time, note) VALUES
('48d1869b-5685-4b66-b0a1-87056a7bb023', 'Walking', 30, 'moderate', NOW() - INTERVAL '1 day', 'Morning walk'),
('48d1869b-5685-4b66-b0a1-87056a7bb023', 'Walking', 45, 'moderate', NOW() - INTERVAL '2 days', 'Evening walk'),
('0a282446-5b74-4dd4-8c15-13e93076ada5', 'Cycling', 40, 'moderate', NOW() - INTERVAL '1 day', 'Commute to work'),
('d892bad6-c1e2-4ecb-90ca-aa95643260fb', 'Walking', 15, 'low', NOW() - INTERVAL '5 days', 'Short walk');

-- Part 6: Add meal logs
INSERT INTO meal_logs (patient_id, description, meal_type, portion_size, date_time, note) VALUES
('48d1869b-5685-4b66-b0a1-87056a7bb023', 'Ugali with sukuma wiki and fish', 'dinner', 'medium', NOW() - INTERVAL '1 day', 'Balanced meal'),
('48d1869b-5685-4b66-b0a1-87056a7bb023', 'Oatmeal with fruits', 'breakfast', 'small', NOW() - INTERVAL '1 day', 'Healthy start'),
('d892bad6-c1e2-4ecb-90ca-aa95643260fb', 'Nyama choma with chips', 'lunch', 'large', NOW() - INTERVAL '2 days', 'Heavy meal'),
('0a282446-5b74-4dd4-8c15-13e93076ada5', 'Githeri with avocado', 'lunch', 'medium', NOW() - INTERVAL '1 day', 'Traditional meal'),
('e7101b54-742f-436d-88c1-accf433a86a5', 'Mandazi and tea', 'breakfast', 'medium', NOW() - INTERVAL '3 days', NULL);

-- Part 7: Add upcoming appointments
INSERT INTO appointments (doctor_id, patient_id, start_time, end_time, status, notes) VALUES
('6e0c6bf5-6fca-4935-94e1-28f83a016628', 'e7101b54-742f-436d-88c1-accf433a86a5', NOW() + INTERVAL '2 hours', NOW() + INTERVAL '2 hours 30 minutes', 'scheduled', 'Urgent follow-up for high glucose'),
('6e0c6bf5-6fca-4935-94e1-28f83a016628', 'd892bad6-c1e2-4ecb-90ca-aa95643260fb', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day' + INTERVAL '30 minutes', 'scheduled', 'Adherence review'),
('6e0c6bf5-6fca-4935-94e1-28f83a016628', '48d1869b-5685-4b66-b0a1-87056a7bb023', NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days' + INTERVAL '30 minutes', 'scheduled', 'Routine checkup');