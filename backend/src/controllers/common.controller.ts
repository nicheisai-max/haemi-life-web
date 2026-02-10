import type { Request, Response } from 'express';
import { pool } from '../config/db';

export const getLocations = async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM locations ORDER BY name ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching locations:', error);
        res.status(500).json({ message: 'Error fetching locations' });
    }
};

export const getMedicines = async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM medicines ORDER BY name ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching medicines:', error);
        res.status(500).json({ message: 'Error fetching medicines' });
    }
};

export const getPharmacies = async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM pharmacies WHERE is_active = true ORDER BY name ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching pharmacies:', error);
        res.status(500).json({ message: 'Error fetching pharmacies' });
    }
};
