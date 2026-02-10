/**
 * IMAGE DOWNLOAD HELPER
 * 
 * This script helps download images from Unsplash/Pexels for demo data.
 * 
 * MANUAL INSTRUCTIONS:
 * 1. Visit https://unsplash.com and https://www.pexels.com
 * 2. Search for the following terms and download 1200x800+ images:
 * 
 * PATIENTS (10 images needed):
 * - "botswana people"
 * - "african person"
 * - "african professional"
 * - "african portrait"
 * 
 * DOCTORS (8 images needed):
 * - "african doctor"
 * - "black doctor"
 * - "african healthcare professional"
 * - "african surgeon"
 * 
 * PHARMACIES (4 images needed):
 * - "pharmacy"
 * - "medicine"
 * - "pharmacy counter"
 * 
 * GENERAL (6 images needed):
 * - "clinic"
 * - "hospital waiting room"
 * - "medical consultation"
 * 
 * 3. Rename downloaded images:
 *    patients/patient_01.jpg, patient_02.jpg, ...
 *    doctors/doctor_01.jpg, doctor_02.jpg, ...
 *    pharmacies/pharmacy_01.jpg, pharmacy_02.jpg, ...
 *    general/clinic_interior.jpg, consultation_room.jpg, ...
 * 
 * 4. Place in: frontend/src/assets/images/
 * 
 * AUTOMATED (Optional - requires Unsplash API key):
 * 1. Get API key from https://unsplash.com/developers
 * 2. Set UNSPLASH_ACCESS_KEY environment variable
 * 3. Run: node image-downloader.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const BASE_DIR = path.join(__dirname, '..', 'frontend', 'src', 'assets', 'images');

// Search queries for images
const imageQueries = {
    patients: [
        { query: 'african person professional', filename: 'patient_01.jpg' },
        { query: 'african portrait person', filename: 'patient_02.jpg' },
        { query: 'african professional woman', filename: 'patient_03.jpg' },
        { query: 'african person smiling', filename: 'patient_04.jpg' },
        { query: 'african man professional', filename: 'patient_05.jpg' },
        { query: 'african woman portrait', filename: 'patient_06.jpg' },
        { query: 'african person business', filename: 'patient_07.jpg' },
        { query: 'african young adult', filename: 'patient_08.jpg' },
        { query: 'african person casual', filename: 'patient_09.jpg' },
        { query: 'african professional portrait', filename: 'patient_10.jpg' },
    ],
    doctors: [
        { query: 'african doctor female stethoscope', filename: 'doctor_01.jpg' },
        { query: 'african male doctor', filename: 'doctor_02.jpg' },
        { query: 'black doctor professional', filename: 'doctor_03.jpg' },
        { query: 'african healthcare professional', filename: 'doctor_04.jpg' },
        { query: 'african surgeon', filename: 'doctor_05.jpg' },
        { query: 'black female doctor', filename: 'doctor_06.jpg' },
        { query: 'african doctor consultation', filename: 'doctor_07.jpg' },
        { query: 'african medical professional', filename: 'doctor_08.jpg' },
    ],
    pharmacies: [
        { query: 'pharmacy counter modern', filename: 'pharmacy_01.jpg' },
        { query: 'medicine shelves pharmacy', filename: 'pharmacy_02.jpg' },
        { query: 'pharmacist dispensing', filename: 'pharmacy_03.jpg' },
        { query: 'pharmacy interior', filename: 'pharmacy_04.jpg' },
    ],
    general: [
        { query: 'clinic waiting room', filename: 'clinic_interior.jpg' },
        { query: 'doctor consultation room', filename: 'consultation_room.jpg' },
        { query: 'hospital reception', filename: 'hospital_reception.jpg' },
        { query: 'medical equipment', filename: 'medical_equipment.jpg' },
        { query: 'healthcare facility', filename: 'healthcare_facility.jpg' },
        { query: 'clinic exterior modern', filename: 'clinic_exterior.jpg' },
    ],
};

async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`✓ Downloaded: ${path.basename(filepath)}`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => { });
            reject(err);
        });
    });
}

async function searchUnsplash(query) {
    if (!UNSPLASH_ACCESS_KEY) {
        console.error('❌ UNSPLASH_ACCESS_KEY not set. Please set environment variable or download images manually.');
        return null;
    }

    return new Promise((resolve, reject) => {
        const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
        const options = {
            headers: {
                'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
            }
        };

        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.results && json.results[0]) {
                        resolve(json.results[0].urls.regular);
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function main() {
    console.log('🖼️  Image Download Helper\n');

    // Create directories
    for (const category of Object.keys(imageQueries)) {
        const dir = path.join(BASE_DIR, category);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 Created directory: ${category}/`);
        }
    }

    if (!UNSPLASH_ACCESS_KEY) {
        console.log('\n⚠️  No Unsplash API key found.');
        console.log('   Please download images manually using instructions at the top of this file.\n');
        console.log('   Or set UNSPLASH_ACCESS_KEY and run again.\n');
        return;
    }

    // Download images
    for (const [category, queries] of Object.entries(imageQueries)) {
        console.log(`\n📥 Downloading ${category}...`);
        for (const { query, filename } of queries) {
            const filepath = path.join(BASE_DIR, category, filename);

            // Skip if already exists
            if (fs.existsSync(filepath)) {
                console.log(`⏭️  Skipped: ${filename} (already exists)`);
                continue;
            }

            try {
                const imageUrl = await searchUnsplash(query);
                if (imageUrl) {
                    await downloadImage(imageUrl, filepath);
                } else {
                    console.log(`⚠️  No image found for: ${query}`);
                }
                // Rate limit: 50 requests per hour
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`❌ Error downloading ${filename}:`, error.message);
            }
        }
    }

    console.log('\n✅ Image download complete!\n');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { downloadImage, searchUnsplash };
