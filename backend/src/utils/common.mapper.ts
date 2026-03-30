import { MedicineEntity, PharmacyEntity, LocationEntity } from '../types/db.types';

export interface MedicineResponse {
    id: number;
    name: string;
    genericName: string | null;
    strength: string | null;
    category: string | null;
    commonUses: string | null;
    pricePerUnit: number;
}

export interface PharmacyResponse {
    id: number;
    name: string;
    locationId: number | null;
    address: string | null;
    phoneNumber: string | null;
    email: string | null;
}

export interface LocationResponse {
    id: number;
    city: string;
    district: string | null;
    gpsLatitude: number | null;
    gpsLongitude: number | null;
}

export const mapMedicineToResponse = (data: MedicineEntity): MedicineResponse => ({
    id: data.id,
    name: data.name,
    genericName: data.generic_name || null,
    strength: data.strength || null,
    category: data.category || null,
    commonUses: data.common_uses || null,
    pricePerUnit: Number(data.price_per_unit || 0)
});

export const mapPharmacyToResponse = (data: PharmacyEntity): PharmacyResponse => ({
    id: data.id,
    name: data.name,
    locationId: data.location_id || null,
    address: data.address || null,
    phoneNumber: data.phone_number || null,
    email: data.email || null
});

export const mapLocationToResponse = (data: LocationEntity): LocationResponse => ({
    id: data.id,
    city: data.city,
    district: data.district || null,
    gpsLatitude: data.gps_latitude ? Number(data.gps_latitude) : null,
    gpsLongitude: data.gps_longitude ? Number(data.gps_longitude) : null
});

