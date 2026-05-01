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

/**
 * Strict numeric coercion that distinguishes "absent" (null/undefined)
 * from "literally zero". Replaces the truthy-check pattern that turned
 * a valid `0.0` GPS coordinate into `null` (equator latitude bug).
 *
 * The pg NUMERIC parser registered in config/db.ts already converts
 * `numeric` columns to `number`, so `value` is normally `number | null`.
 * This helper remains conservative against legacy callers that may pass
 * the raw string form (e.g. seed scripts).
 */
const toNullableNumber = (value: number | string | null | undefined): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
};

export const mapMedicineToResponse = (data: MedicineEntity): MedicineResponse => ({
    id: data.id,
    name: data.name,
    genericName: data.generic_name || null,
    strength: data.strength || null,
    category: data.category || null,
    commonUses: data.common_uses || null,
    // pricePerUnit defaults to 0 when the column is null so the response
    // contract remains `number` (not nullable) for downstream consumers.
    pricePerUnit: toNullableNumber(data.price_per_unit) ?? 0
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
    // P1 GPS FIX: 0.0 latitude/longitude is a valid coordinate (equator,
    // prime meridian). The previous `data.gps_x ? Number(...) : null`
    // pattern incorrectly mapped 0 to null.
    gpsLatitude: toNullableNumber(data.gps_latitude),
    gpsLongitude: toNullableNumber(data.gps_longitude)
});

