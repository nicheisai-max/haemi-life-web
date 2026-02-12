const fs = require('fs');
const path = require('path');

const doctors = [
    { name: 'Dr. K. Modise', role: 'Cardiologist', gender: 'male', color: '#0E6B74' },
    { name: 'Dr. S. Kgosi', role: 'Pediatrician', gender: 'female', color: '#3FC2B5' },
    { name: 'Dr. T. Mosweu', role: 'Neurologist', gender: 'male', color: '#1E293B' },
    { name: 'Dr. L. Moloi', role: 'General Practitioner', gender: 'female', color: '#F59E0B' }
];

const patients = [
    { name: 'Thabo Setshedi', color: '#3B82F6' },
    { name: 'Mpho Dube', color: '#10B981' },
    { name: 'Lorato Phiri', color: '#8B5CF6' },
    { name: 'Kabo Ntsima', color: '#F43F5E' }
];

const generateSVG = (initials, color) => `
<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="200" fill="${color}"/>
  <text x="50%" y="50%" dy=".1em" fill="white" font-family="Arial, sans-serif" font-size="80" text-anchor="middle" dominant-baseline="middle" font-weight="bold">${initials}</text>
</svg>
`;

const getInitials = (name) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
        // For doctors like 'Dr. K. Modise', take 'KM' (last two parts usually better?)
        // Actually for 'Dr. K. Modise', 'KM' is good.
        // For 'Dr. Modise', 'DM'.
        // Let's just take the first letter of the last two words if it starts with Dr.
        if (name.startsWith('Dr.')) {
            return name.split(' ').slice(1).map(p => p[0]).join('').replace('.', '').toUpperCase().substring(0, 2);
        }
        return parts.map(p => p[0]).join('').toUpperCase().substring(0, 2);
    }
    return name.substring(0, 2).toUpperCase();
};

const outputDirDoctors = path.join(__dirname, 'frontend/public/images/doctors');
const outputDirPatients = path.join(__dirname, 'frontend/public/images/patients');

[outputDirDoctors, outputDirPatients].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

doctors.forEach(doc => {
    const initials = getInitials(doc.name);
    const svg = generateSVG(initials, doc.color);
    const filename = doc.name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '.svg';
    fs.writeFileSync(path.join(outputDirDoctors, filename), svg);
    console.log(`Generated ${filename}`);
});

patients.forEach(pat => {
    const initials = getInitials(pat.name);
    const svg = generateSVG(initials, pat.color);
    const filename = pat.name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '.svg';
    fs.writeFileSync(path.join(outputDirPatients, filename), svg);
    console.log(`Generated ${filename}`);
});

console.log('Avatar generation complete!');
