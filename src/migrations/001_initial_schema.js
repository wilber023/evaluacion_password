// Migración inicial: Crear base de datos y tablas
module.exports = {
    name: '001_initial_schema',
    description: 'Crear base de datos y tablas iniciales para el sistema de evaluación de contraseñas',

    async up(connection) {
        console.log('🔨 Ejecutando migración: 001_initial_schema');

        // Crear base de datos si no existe
        console.log('📦 Creando base de datos...');
        await connection.query(`
            CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'evaluate'}
            CHARACTER SET utf8mb4
            COLLATE utf8mb4_unicode_ci
        `);

        console.log('✅ Base de datos creada o ya existe');

        // Cambiar a la base de datos
        await connection.query(`USE ${process.env.DB_NAME || 'evaluate'}`);

        // Crear tabla de contraseñas comunes (OPTIMIZADA)
        console.log('📋 Creando tabla common_passwords...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS common_passwords (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                password VARCHAR(255) NOT NULL,
                frequency INT UNSIGNED DEFAULT 0,
                category VARCHAR(50) DEFAULT 'common',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_password (password),
                INDEX idx_category (category),
                INDEX idx_frequency (frequency DESC),
                INDEX idx_password_length (password(10))
            ) ENGINE=InnoDB
            DEFAULT CHARSET=utf8mb4
            COLLATE=utf8mb4_unicode_ci
            ROW_FORMAT=COMPRESSED
            COMMENT='Contraseñas comunes para validación rápida'
        `);

        console.log('✅ Tabla common_passwords creada');

        // Crear tabla de cache de similitud (OPTIMIZADA)
        console.log('📋 Creando tabla password_similarity_cache...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS password_similarity_cache (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                original_password VARCHAR(255) NOT NULL,
                similar_password VARCHAR(255) NOT NULL,
                similarity_score DECIMAL(4,3) NOT NULL,
                similarity_type ENUM('identical', 'simple_variation', 'similar') DEFAULT 'similar',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_pair (original_password(100), similar_password(100)),
                INDEX idx_original (original_password(50)),
                INDEX idx_score (similarity_score DESC),
                INDEX idx_created (created_at)
            ) ENGINE=InnoDB
            DEFAULT CHARSET=utf8mb4
            COLLATE=utf8mb4_unicode_ci
            ROW_FORMAT=COMPRESSED
            COMMENT='Cache de similitudes para optimizar búsquedas repetidas'
        `);

        console.log('✅ Tabla password_similarity_cache creada');

        // Crear tabla de migraciones
        console.log('📋 Creando tabla migrations...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_name (name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('✅ Tabla migrations creada');
        console.log('✅ Migración 001_initial_schema completada exitosamente');
    },

    async down(connection) {
        console.log('⏪ Revirtiendo migración: 001_initial_schema');

        await connection.query(`USE ${process.env.DB_NAME || 'evaluate'}`);

        await connection.query('DROP TABLE IF EXISTS password_similarity_cache');
        console.log('🗑️  Tabla password_similarity_cache eliminada');

        await connection.query('DROP TABLE IF EXISTS common_passwords');
        console.log('🗑️  Tabla common_passwords eliminada');

        await connection.query('DROP TABLE IF EXISTS migrations');
        console.log('🗑️  Tabla migrations eliminada');

        console.log('✅ Reversión completada');
    }
};
