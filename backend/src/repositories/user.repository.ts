import { Pool, PoolClient } from 'pg';
import { pool } from '../config/db';
import { encrypt, decrypt, getBlindIndex } from '../utils/security';

export interface User {
    id: string;
    name: string;
    phone_number: string;
    email: string | null;
    password?: string;
    role: string;
    id_number: string | null;
    status: string;
    initials: string;
    is_active: boolean;
    token_version: number;
    profile_image: string | null;
    profile_image_data?: Buffer | null;
    profile_image_mime?: string | null;
    created_at: Date;
    updated_at: Date;
}

export class UserRepository {
    private db: Pool;

    constructor(db: Pool = pool) {
        this.db = db;
    }

    async findByEmailOrPhone(identifier: string): Promise<User | null> {
        const blindIndex = getBlindIndex(identifier);
        const result = await this.db.query(
            'SELECT * FROM users WHERE email = $1 OR phone_blind_index = $2 OR phone_number = $1',
            [identifier, blindIndex]
        );
        const user = result.rows[0];
        return user ? this.decryptUser(user) : null;
    }

    async findByPhoneOrEmail(phoneNumber: string, email?: string): Promise<User | null> {
        const phoneBlindIndex = getBlindIndex(phoneNumber);
        const query = email
            ? 'SELECT * FROM users WHERE phone_blind_index = $1 OR email = $2 OR phone_number = $3'
            : 'SELECT * FROM users WHERE phone_blind_index = $1 OR phone_number = $2';
        const params = email ? [phoneBlindIndex, email, phoneNumber] : [phoneBlindIndex, phoneNumber];
        const result = await this.db.query(query, params);
        const user = result.rows[0];
        return user ? this.decryptUser(user) : null;
    }

    async findById(id: string): Promise<User | null> {
        const result = await this.db.query(
            'SELECT * FROM users WHERE id = $1',
            [id]
        );
        const user = result.rows[0];
        return user ? this.decryptUser(user) : null;
    }

    async create(userData: Partial<User>, client?: PoolClient): Promise<User> {
        const db = client || this.db;
        const { name, phone_number, email, password, role, id_number } = userData;

        // PII Protection
        const encryptedPhone = phone_number ? encrypt(phone_number) : '';
        const phoneBlindIndex = phone_number ? getBlindIndex(phone_number) : '';
        const encryptedID = id_number ? encrypt(id_number) : null;
        const idBlindIndex = id_number ? getBlindIndex(id_number) : null;

        const result = await db.query(
            `INSERT INTO users (
                name, phone_number, email, password, role, id_number, phone_blind_index, id_blind_index, created_at, updated_at, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), 'ACTIVE') 
            RETURNING id, email, role, name, phone_number, initials, status, profile_image, token_version`,
            [name, encryptedPhone, email || null, password, role, encryptedID, phoneBlindIndex, idBlindIndex]
        );
        return this.decryptUser(result.rows[0]);
    }

    async updateProfile(userId: string, data: { name: string, email: string, phone_number: string }): Promise<User> {
        const encryptedPhone = encrypt(data.phone_number);
        const phoneBlindIndex = getBlindIndex(data.phone_number);

        const result = await this.db.query(
            'UPDATE users SET name = $1, email = $2, phone_number = $3, phone_blind_index = $4, updated_at = NOW() WHERE id = $5 RETURNING *',
            [data.name, data.email, encryptedPhone, phoneBlindIndex, userId]
        );
        return this.decryptUser(result.rows[0]);
    }

    private decryptUser(user: Record<string, unknown>): User {
        if (!user) return user as unknown as User;
        return {
            ...user,
            phone_number: decrypt(user.phone_number as string),
            id_number: user.id_number ? decrypt(user.id_number as string) : null
        } as User;
    }

    async updateProfileImage(userId: string, imageBuffer: Buffer, mimeType: string): Promise<User> {
        const result = await this.db.query(
            'UPDATE users SET profile_image_data = $1, profile_image_mime = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
            [imageBuffer, mimeType, userId]
        );
        return this.decryptUser(result.rows[0]);
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
