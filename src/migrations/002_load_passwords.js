// Migración: Cargar contraseñas desde CSV
const fs = require('fs');
const readline = require('readline');
const path = require('path');

module.exports = {
    name: '002_load_passwords',
    description: 'Cargar contraseñas comunes desde archivo CSV',

    async up(connection) {
        console.log('🔨 Ejecutando migración: 002_load_passwords');

        const dbName = process.env.DB_NAME || 'evaluate';
        await connection.query(`USE ${dbName}`);

        // Verificar si ya hay datos
        const [countResult] = await connection.query(
            'SELECT COUNT(*) as total FROM common_passwords'
        );

        if (countResult[0].total > 0) {
            console.log(`ℹ️  Ya existen ${countResult[0].total} contraseñas en la base de datos`);
            console.log('⏩ Saltando carga de datos (usa migrate:reset para recargar)');
            return;
        }

        // Buscar archivo CSV
        const csvPath = path.join(__dirname, '../data/1millionPasswords.csv');

        if (!fs.existsSync(csvPath)) {
            console.log('⚠️  Archivo CSV no encontrado en:', csvPath);
            console.log('ℹ️  Para cargar contraseñas, ejecuta: npm run migrate:load-data');
            return;
        }

        console.log('📂 Cargando contraseñas desde:', csvPath);

        const batchSize = 1000;
        let batch = [];
        let totalProcessed = 0;
        let totalInserted = 0;
        let isFirstLine = true;

        const fileStream = fs.createReadStream(csvPath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        for await (const line of rl) {
            if (!line || line.trim() === '' || isFirstLine) {
                isFirstLine = false;
                continue;
            }

            const parts = line.split(',');
            if (parts.length >= 2) {
                const password = parts[1].trim();

                if (password && password.length > 0 && !password.startsWith('#')) {
                    batch.push([password, 0, 'common']);

                    if (batch.length >= batchSize) {
                        const inserted = await this.insertBatch(connection, batch);
                        totalProcessed += batch.length;
                        totalInserted += inserted;
                        batch = [];

                        if (totalProcessed % 10000 === 0) {
                            console.log(`📊 Procesadas ${totalProcessed} líneas, insertadas ${totalInserted} contraseñas`);
                        }
                    }
                }
            }
        }

        if (batch.length > 0) {
            const inserted = await this.insertBatch(connection, batch);
            totalProcessed += batch.length;
            totalInserted += inserted;
        }

        console.log(`✅ Migración completada!`);
        console.log(`📈 Total procesadas: ${totalProcessed}`);
        console.log(`📈 Total insertadas: ${totalInserted}`);
    },

    async insertBatch(connection, batch) {
        if (batch.length === 0) return 0;

        try {
            const placeholders = batch.map(() => '(?, ?, ?)').join(',');
            const values = batch.flat();

            const sql = `
                INSERT IGNORE INTO common_passwords (password, frequency, category)
                VALUES ${placeholders}
            `;

            const [result] = await connection.execute(sql, values);
            return result.affectedRows || 0;
        } catch (error) {
            console.error('❌ Error insertando lote:', error.message);
            return 0;
        }
    },

    async down(connection) {
        console.log('⏪ Revirtiendo migración: 002_load_passwords');

        const dbName = process.env.DB_NAME || 'evaluate';
        await connection.query(`USE ${dbName}`);

        await connection.query('DELETE FROM common_passwords');
        await connection.query('ALTER TABLE common_passwords AUTO_INCREMENT = 1');

        console.log('✅ Contraseñas eliminadas');
    }
};
