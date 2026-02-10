-- Create locations table
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'city', 'town', 'village'
  region TEXT, -- 'South-East', 'Central', etc.
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed Locations (Botswana)
INSERT INTO locations (name, type, region) VALUES 
('Gaborone', 'city', 'South-East'),
('Francistown', 'city', 'North-East'),
('Molepolole', 'village', 'Kweneng'),
('Maun', 'town', 'North-West'),
('Serowe', 'village', 'Central'),
('Selibe Phikwe', 'town', 'Central'),
('Kanye', 'village', 'Southern'),
('Mahalapye', 'village', 'Central'),
('Mogoditshane', 'village', 'Kweneng'),
('Mochudi', 'village', 'Kgatleng'),
('Lobatse', 'town', 'South-East'),
('Palapye', 'village', 'Central'),
('Ramotswa', 'village', 'South-East'),
('Tlokweng', 'village', 'South-East'),
('Kasane', 'town', 'Chobe')
ON CONFLICT DO NOTHING;

-- Seed Medicines (Common)
INSERT INTO medicines (id, name, category, strength, manufacturer, created_at) VALUES 
(gen_random_uuid(), 'Paracetamol', 'Analgesic', '500mg', 'Adcock Ingram', NOW()),
(gen_random_uuid(), 'Ibuprofen', 'Anti-inflammatory', '400mg', 'Aspen', NOW()),
(gen_random_uuid(), 'Amoxicillin', 'Antibiotic', '500mg', 'Cipla', NOW()),
(gen_random_uuid(), 'Metformin', 'Antidiabetic', '850mg', 'Mylan', NOW()),
(gen_random_uuid(), 'Amlodipine', 'Antihypertensive', '5mg', 'Sandoz', NOW()),
(gen_random_uuid(), 'Omeprazole', 'Antacid', '20mg', 'Dr. Reddy''s', NOW()),
(gen_random_uuid(), 'Simvastatin', 'Statin', '20mg', 'Accord', NOW()),
(gen_random_uuid(), 'Cetirizine', 'Antihistamine', '10mg', 'Austin', NOW()),
(gen_random_uuid(), 'Azithromycin', 'Antibiotic', '500mg', 'Aspen', NOW()),
(gen_random_uuid(), 'Lisinopril', 'Antihypertensive', '10mg', 'Mylan', NOW());

-- Seed Pharmacies (Botswana Context)
-- Note: We'll insert pharmacies linked to Gaborone for demo purposes
INSERT INTO pharmacies (id, name, city, address, phone_number, is_active, created_at) VALUES 
(gen_random_uuid(), 'Link Pharmacy - Airport Junction', 'Gaborone', 'Shop 23, Airport Junction Mall', '+267 391 2345', true, NOW()),
(gen_random_uuid(), 'Clicks Pharmacy - Game City', 'Gaborone', 'Game City Mall, Unit 5', '+267 395 6789', true, NOW()),
(gen_random_uuid(), 'Medswana Pharmacy', 'Francistown', 'Blue Jacket Street', '+267 241 3456', true, NOW()),
(gen_random_uuid(), 'Tswana Med', 'Maun', 'Old Mall, Maun', '+267 686 1234', true, NOW()),
(gen_random_uuid(), 'Kalahari Pharmacy', 'Gaborone', 'Main Mall', '+267 390 9876', true, NOW());

