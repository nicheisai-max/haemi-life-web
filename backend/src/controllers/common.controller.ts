import type { Request, Response } from 'express';
import { pool } from '../config/db';
import { sendResponse, sendError } from '../utils/response';
import { logger } from '../utils/logger';
import { 
    mapLocationToResponse, 
    mapMedicineToResponse, 
    mapPharmacyToResponse 
} from '../utils/common.mapper';
import { LocationEntity, MedicineEntity, PharmacyEntity } from '../types/db.types';

export const getLocations = async (req: Request, res: Response) => {
    try {
        const result = await pool.query<LocationEntity>('SELECT * FROM locations ORDER BY city ASC');
        const mapped = result.rows.map(mapLocationToResponse);
        return sendResponse(res, 200, true, 'Locations fetched', mapped);
    } catch (error: unknown) {
        logger.error('Error fetching locations:', {
            error: error instanceof Error ? error.message : String(error)
        });
        return sendError(res, 500, 'Error fetching locations');
    }
};

export const getMedicines = async (req: Request, res: Response) => {
    try {
        const result = await pool.query<MedicineEntity>('SELECT * FROM medicines ORDER BY name ASC');
        const mapped = result.rows.map(mapMedicineToResponse);
        return sendResponse(res, 200, true, 'Medicines fetched', mapped);
    } catch (error: unknown) {
        logger.error('Error fetching medicines:', {
            error: error instanceof Error ? error.message : String(error)
        });
        return sendError(res, 500, 'Error fetching medicines');
    }
};

export const getPharmacies = async (req: Request, res: Response) => {
    try {
        const result = await pool.query<PharmacyEntity>('SELECT * FROM pharmacies WHERE is_active = true ORDER BY name ASC');
        const mapped = result.rows.map(mapPharmacyToResponse);
        return sendResponse(res, 200, true, 'Pharmacies fetched', mapped);
    } catch (error: unknown) {
        logger.error('Error fetching pharmacies:', {
            error: error instanceof Error ? error.message : String(error)
        });
        return sendError(res, 500, 'Error fetching pharmacies');
    }
};

