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
    /**
     * Botswana Omang (national ID). PII-sensitive. The list endpoint
     * masks this value at the response boundary; only an audited reveal
     * endpoint may surface the raw value.
     */
    omang_number: string | null;
    hospital_origin: string | null;
    created_at: Date;
    updated_at: Date;
    // Joined fields
    patient_name?: string;
}

export interface OrderItemEntity {
    id: string;
    order_id: string;
    medicine_id: number;
    quantity: number;
    unit_price: number;
    created_at: Date;
    // Joined fields
    medicine_name?: string;
}

export interface DashboardStats {
    lowStockCount: number;
    expiringSoonCount: number;
    totalDispensedToday: number;
}
