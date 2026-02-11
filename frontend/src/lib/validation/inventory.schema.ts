import { z } from "zod";

/**
 * Inventory Item Schema
 */
export const inventorySchema = z.object({
    name: z.string().min(2, "Medicine name must be at least 2 characters"),
    category: z.string().min(1, "Please select a category"),
    stock: z.coerce.number().min(0, "Stock cannot be negative"),
    minStock: z.coerce.number().min(0, "Minimum stock cannot be negative"),
    price: z.coerce.number().min(0.01, "Price must be at least 0.01"),
});

export type InventoryFormData = z.infer<typeof inventorySchema>;
