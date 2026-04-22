// ─── Pharmacist Domain Types (Frontend SSOT) ──────────────────────────────────
// These are duplicated from backend/src/types/pharmacist.types.ts.
// Rationale: Frontend cannot import from backend at compile time (separate build
// pipelines). Keeping types in sync is enforced via interface parity.

export interface PharmacyInventoryEntity {
    id: string;
    pharmacy_id: number;
    medicine_id: number;
    price: number;
    stock_quantity: number;
    dispensed_today: number;
    reorder_level: number;
    expiry_date: Date | null;
    created_at: Date;
    updated_at: Date;
    // Joined fields
    medicine_name?: string;
    medicine_category?: string;
}

export interface OrderEntity {
    id: string;
    patient_id: string;
    pharmacy_id: number;
    status: string;
    total_amount: number;
    prescription_url: string | null;
    is_prescription_required: boolean;
    delivery_mode: 'COLLECT' | 'HAEMI_DELIVERY';
    is_government_subsidized: boolean;
    omang_number: string | null;
    hospital_origin: string | null;
    created_at: Date;
    updated_at: Date;
    // Joined fields
    patient_name?: string;
}

export interface DashboardStats {
    lowStockCount: number;
    expiringSoonCount: number;
    totalDispensedToday: number;
}
