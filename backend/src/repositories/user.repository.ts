import { Pool, PoolClient } from 'pg';
import { pool } from '../config/db';
import { encrypt, decrypt, getBlindIndex } from '../utils/security';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import { UserEntity, UserStatus } from '../types/db.types';

export interface User extends Omit<UserEntity, 'role' | 'status'> {
    role: UserEntity['role'];
    status: UserStatus;
    password?: string;
    profile_image_data?: Buffer | null;
}

type UserRow = UserEntity & { password?: string };


export class UserRepository {
    private db: Pool;

    constructor(db: Pool = pool) {
        this.db = db;
    }

    async findByEmailOrPhone(identifier: string): Promise<User | null> {
        try {
            const blindIndex = getBlindIndex(identifier);
            const result = await this.db.query<UserRow>(
                'SELECT * FROM users WHERE email = $1 OR phone_blind_index = $2 OR phone_number = $1',
                [identifier, blindIndex]
            );
            const user = result.rows[0];
            return user ? this.decryptUser(user) : null;
        } catch (error: unknown) {
            logger.error('Failed to find user by email or phone', {
                error: error instanceof Error ? error.message : String(error),
                identifier
            });
            throw error;
        }
    }

    async findByPhoneOrEmail(phoneNumber: string, email?: string): Promise<User | null> {
        try {
            const phoneBlindIndex = getBlindIndex(phoneNumber);
            const query = email
                ? 'SELECT * FROM users WHERE phone_blind_index = $1 OR email = $2 OR phone_number = $3'
                : 'SELECT * FROM users WHERE phone_blind_index = $1 OR phone_number = $2';
            const params = email ? [phoneBlindIndex, email, phoneNumber] : [phoneBlindIndex, phoneNumber];
            const result = await this.db.query<UserRow>(query, params);
            const user = result.rows[0];
            return user ? this.decryptUser(user) : null;
        } catch (error: unknown) {
            logger.error('Failed to find user by phone or email', {
                error: error instanceof Error ? error.message : String(error),
                email
            });
            throw error;
        }
    }

    async findById(id: string): Promise<User | null> {
        try {
            const result = await this.db.query<UserRow>(
                'SELECT * FROM users WHERE id = $1',
                [id]
            );
            const user = result.rows[0];
            return user ? this.decryptUser(user) : null;
        } catch (error: unknown) {
            logger.error('Failed to find user by ID', {
                error: error instanceof Error ? error.message : String(error),
                id
            });
            throw error;
        }
    }

    async create(userData: { name: string, phoneNumber: string, email: string, password?: string, role: UserEntity['role'], idNumber?: string | null }, client?: PoolClient): Promise<User> {
        const db = client || this.db;
        const { name, phoneNumber, email, password, role, idNumber } = userData;

        try {
            // PII Protection
            const encryptedPhone = phoneNumber ? encrypt(phoneNumber) : '';
            const phoneBlindIndex = phoneNumber ? getBlindIndex(phoneNumber) : '';
            const encryptedID = idNumber ? encrypt(idNumber) : null;
            const idBlindIndex = idNumber ? getBlindIndex(idNumber) : null;

            const result = await db.query<UserRow>(
                `INSERT INTO users (
                    name, phone_number, email, password, role, id_number, phone_blind_index, id_blind_index, created_at, updated_at, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), 'ACTIVE') 
                RETURNING id, name, phone_number, email, role, id_number, status, initials, is_active, is_verified, token_version, profile_image, last_activity, created_at, updated_at`,
                [name, encryptedPhone, email || null, password, role, encryptedID, phoneBlindIndex, idBlindIndex]
            );
            return this.decryptUser(result.rows[0]);
        } catch (error: unknown) {
            logger.error('Failed to create user', {
                error: error instanceof Error ? error.message : String(error),
                email
            });
            throw error;
        }
    }

    async updateProfile(userId: string, data: { name: string, email: string, phoneNumber: string }): Promise<User> {
        try {
            const encryptedPhone = encrypt(data.phoneNumber);
            const phoneBlindIndex = getBlindIndex(data.phoneNumber);

            const result = await this.db.query<UserRow>(
                'UPDATE users SET name = $1, email = $2, phone_number = $3, phone_blind_index = $4, updated_at = NOW() WHERE id = $5 RETURNING *',
                [data.name, data.email, encryptedPhone, phoneBlindIndex, userId]
            );
            return this.decryptUser(result.rows[0]);
        } catch (error: unknown) {
            logger.error('Failed to update user profile', {
                error: error instanceof Error ? error.message : String(error),
                userId
            });
            throw error;
        }
    }

    private decryptUser(user: UserRow): User {
        if (!user) {
            throw new Error('User data is missing');
        }

        return {
            ...user,
            phone_number: user.phone_number ? decrypt(user.phone_number) : '',
            id_number: user.id_number ? decrypt(user.id_number) : null
        };
    }

    async updateProfileImage(userId: string, imageBuffer: Buffer, mimeType: string): Promise<User> {
        try {
            // PRODUCTION HARDENING: Filesystem Offloading
            const fileExt = mimeType.split('/')[1] || 'jpg';
            const uniqueFileName = `${crypto.randomUUID()}.${fileExt}`;
            const relativePath = `uploads/profiles/${uniqueFileName}`;
            const fullPath = path.join(process.cwd(), relativePath);

            // Ensure directory exists
            if (!fs.existsSync(path.dirname(fullPath))) {
                fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            }

            // Write to filesystem
            fs.writeFileSync(fullPath, imageBuffer);

            const result = await this.db.query<UserRow>(
                'UPDATE users SET profile_image = $1, profile_image_mime = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
                [relativePath, mimeType, userId]
            );
            return this.decryptUser(result.rows[0]);
        } catch (error: unknown) {
            logger.error('Failed to update profile image', {
                error: error instanceof Error ? error.message : String(error),
                userId
            });
            throw error;
        }
    }


    async updatePassword(userId: string, hashedPassword: string): Promise<void> {
        try {
            await this.db.query(
                'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
                [hashedPassword, userId]
            );
        } catch (error: unknown) {
            logger.error('Failed to update password', {
                error: error instanceof Error ? error.message : String(error),
                userId
            });
            throw error;
        }
    }

    async getPasswordHash(userId: string): Promise<string | null> {
        try {
            const result = await this.db.query<{ password: string }>('SELECT password FROM users WHERE id = $1', [userId]);
            return result.rows[0]?.password || null;
        } catch (error: unknown) {
            logger.error('Failed to get password hash', {
                error: error instanceof Error ? error.message : String(error),
                userId
            });
            return null;
        }
    }
}

export const userRepository = new UserRepository();
