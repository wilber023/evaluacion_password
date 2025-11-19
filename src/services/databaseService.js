// src/services/databaseService.js
const mysql = require('mysql2/promise');

class DatabaseService {
    constructor() {
        this.pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'evaluate',
            password: process.env.DB_PASSWORD || 'evaluate123',
            database: process.env.DB_NAME || 'evaluate',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            charset: 'utf8mb4',
            enableKeepAlive: true,
            keepAliveInitialDelay: 0
        });
        
        this.cache = new Map();
        this.cacheTtl = 600000; // 10 minutos (más tiempo = menos queries)
    }

    async isCommonPassword(password) {
        const cacheKey = `common_${password}`;
        
        // Revisar cache primero
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const [rows] = await this.pool.query(
                'SELECT 1 FROM common_passwords WHERE password = ? LIMIT 1',
                [password]
            );
            
            const result = rows.length > 0;
            
            // Cachear resultado
            this.cache.set(cacheKey, result);
            setTimeout(() => this.cache.delete(cacheKey), this.cacheTtl);
            
            return result;
        } catch (error) {
            console.error('Error checking common password:', error.message);
            return false;
        }
    }

    async findSimilarPasswords(password, maxResults = 3) {
        const cacheKey = `similar_${password}`;
        
        // Revisar cache primero
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const results = [];
            const lowerPassword = password.toLowerCase();
            
            // Solo buscar si la contraseña es corta (< 15 caracteres)
            // Contraseñas largas y complejas son muy improbables de ser comunes
            if (password.length >= 15) {
                this.cache.set(cacheKey, []);
                setTimeout(() => this.cache.delete(cacheKey), this.cacheTtl);
                return [];
            }

            // QUERY ÚNICA Y SIMPLE
            const [rows] = await this.pool.query(`
                SELECT password, 
                       CASE WHEN LOWER(password) = ? THEN 'identical' ELSE 'simple_variation' END as type
                FROM common_passwords 
                WHERE LOWER(password) = ?
                   OR password LIKE ?
                LIMIT ?
            `, [lowerPassword, lowerPassword, `${password}%`, maxResults]);

            rows.forEach(row => {
                const similarity = row.type === 'identical' ? 1.0 : 0.9;
                results.push({
                    password: row.password,
                    similarity: similarity,
                    type: row.type,
                    message: row.type === 'identical' 
                        ? 'Contraseña idéntica encontrada' 
                        : 'Variación simple de contraseña común'
                });
            });

            // Cachear resultado
            this.cache.set(cacheKey, results);
            setTimeout(() => this.cache.delete(cacheKey), this.cacheTtl);

            return results;

        } catch (error) {
            console.error('Error finding similar passwords:', error.message);
            return [];
        }
    }

    async getStats() {
        try {
            const [countResult] = await this.pool.query(
                'SELECT COUNT(*) as total FROM common_passwords'
            );
            
            return {
                totalPasswords: countResult[0].total,
                memoryCacheSize: this.cache.size,
                isConnected: true,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error getting stats:', error.message);
            return { 
                error: 'Unable to get statistics', 
                isConnected: false 
            };
        }
    }

    async healthCheck() {
        try {
            const [result] = await this.pool.query('SELECT 1 as health');
            return { 
                status: 'healthy', 
                database: 'connected'
            };
        } catch (error) {
            return { 
                status: 'unhealthy', 
                database: 'disconnected', 
                error: error.message
            };
        }
    }

    clearCache() {
        this.cache.clear();
    }

    async close() {
        await this.pool.end();
    }
}

module.exports = new DatabaseService();