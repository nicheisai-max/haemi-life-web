import type { Request, Response } from 'express';
import { pool } from '../config/db';
import { sendResponse, sendError } from '../utils/response';

export const getLocations = async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM locations ORDER BY name ASC');
        sendResponse(res, 200, true, 'Locations fetched', result.rows);
    } catch (error) {
        console.error('Error fetching locations:', error);
        sendError(res, 500, 'Error fetching locations');
    }
};

export const getMedicines = async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM medicines ORDER BY name ASC');
        sendResponse(res, 200, true, 'Medicines fetched', result.rows);
    } catch (error) {
        console.error('Error fetching medicines:', error);
        sendError(res, 500, 'Error fetching medicines');
    }
};

export const getPharmacies = async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM pharmacies WHERE is_active = true ORDER BY name ASC');
        sendResponse(res, 200, true, 'Pharmacies fetched', result.rows);
    } catch (error) {
        console.error('Error fetching pharmacies:', error);
        sendError(res, 500, 'Error fetching pharmacies');
    }
};
