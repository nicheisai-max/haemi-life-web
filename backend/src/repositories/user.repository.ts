import { Pool, PoolClient } from 'pg';
import { pool } from '../config/db';

export interface User {
    id: string;
    name: string;
    phone_number: string;
    email: string | null;
    password?: string;
    role: string;
    id_number: string | null;
    status: string;
    is_active: boolean;
    token_version: number;
    created_at: Date;
    updated_at: Date;
}

export class UserRepository {
    private db: Pool;

    constructor(db: Pool = pool) {
        this.db = db;
    }

    async findByEmailOrPhone(identifier: string): Promise<User | null> {
        const result = await this.db.query(
            'SELECT * FROM users WHERE email = $1 OR phone_number = $1',
            [identifier]
        );
        return result.rows[0] || null;
    }

    async findByPhoneOrEmail(phoneNumber: string, email?: string): Promise<User | null> {
        const query = email
            ? 'SELECT * FROM users WHERE phone_number = $1 OR email = $2'
            : 'SELECT * FROM users WHERE phone_number = $1';
        const params = email ? [phoneNumber, email] : [phoneNumber];
        const result = await this.db.query(query, params);
        return result.rows[0] || null;
    }

    async findById(id: string): Promise<User | null> {
        const result = await this.db.query(
            'SELECT id, name, email, phone_number, role, id_number, status, is_active, created_at, token_version FROM users WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }

    async create(userData: Partial<User>, client?: PoolClient): Promise<User> {
        const db = client || this.db;
        const { name, phone_number, email, password, role, id_number } = userData;
        const result = await db.query(
            `INSERT INTO users (
                name, phone_number, email, password, role, id_number, created_at, updated_at, status
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), 'ACTIVE') 
            RETURNING id, email, role, name, phone_number, status`,
            [name, phone_number, email || null, password, role, id_number || null]
        );
        return result.rows[0];
    }

    async updateProfile(userId: string, data: { name: string, email: string, phone_number: string }): Promise<User> {
        const result = await this.db.query(
            'UPDATE users SET name = $1, email = $2, phone_number = $3, updated_at = NOW() WHERE id = $4 RETURNING id, name, email, phone_number, role',
            [data.name, data.email, data.phone_number, userId]
        );
        return result.rows[0];
    }

    async updatePassword(userId: string, hashedPassword: string): Promise<void> {
        await this.db.query(
            'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
            [hashedPassword, userId]
        );
    }

    async getPasswordHash(userId: string): Promise<string | null> {
        const result = await this.db.query('SELECT password FROM users WHERE id = $1', [userId]);
        return result.rows[0]?.password || null;
    }
}

export const userRepository = new UserRepository();
