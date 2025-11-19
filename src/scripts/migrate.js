const mysql = require('mysql2/promise');
const fs = require('fs');
const readline = require('readline');
const path = require('path');

class CSVToMySQLMigrator {
    constructor() {
        this.batchSize = 1000; // Insertar en lotes de 1000
        this.totalProcessed = 0;
        this.totalInserted = 0;
    }

    async connect() {
        this.connection = await mysql.createConnection({
            host: 'localhost',
            user: 'evaluate',
            password: 'evaluate123',
            database: 'evaluate',
            charset: 'utf8mb4',
            multipleStatements: false
        });
        console.log('✅ Conectado a la base de datos MySQL');
    }

    async disconnect() {
        if (this.connection) {
            await this.connection.end();
            console.log('🔌 Desconectado de la base de datos');
        }
    }

    async clearExistingData() {
        console.log('🧹 Limpiando datos existentes...');
        await this.connection.execute('DELETE FROM password_similarity_cache');
        await this.connection.execute('DELETE FROM common_passwords');
        await this.connection.execute('ALTER TABLE common_passwords AUTO_INCREMENT = 1');
        await this.connection.execute('ALTER TABLE password_similarity_cache AUTO_INCREMENT = 1');
        console.log('✅ Datos existentes eliminados');
    }

    async processCSVFile(filePath) {
        console.log(`📂 Procesando archivo: ${filePath}`);
        
        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let batch = [];
        let isFirstLine = true;
        let lineNumber = 0;

        for await (const line of rl) {
            lineNumber++;
            
            // Saltar línea vacía o header
            if (!line || line.trim() === '' || isFirstLine) {
                isFirstLine = false;
                continue;
            }

            // Procesar línea CSV (formato: rank,password)
            const parts = line.split(',');
            if (parts.length >= 2) {
                const password = parts[1].trim();
                
                // Validar contraseña
                if (password && password.length > 0 && !password.startsWith('#')) {
                    batch.push([password, 0, 'common']); // [password, frequency, category]
                    
                    // Insertar cuando el lote esté lleno
                    if (batch.length >= this.batchSize) {
                        await this.insertBatch(batch);
                        batch = [];
                    }
                }
            }

            // Mostrar progreso cada 10,000 líneas
            if (lineNumber % 10000 === 0) {
                console.log(`📊 Procesadas ${lineNumber} líneas, insertadas ${this.totalInserted} contraseñas`);
            }
        }

        // Insertar el último lote si queda algo
        if (batch.length > 0) {
            await this.insertBatch(batch);
        }

        console.log(`🎉 Migración completada!`);
        console.log(`📈 Total procesadas: ${this.totalProcessed}`);
        console.log(`📈 Total insertadas: ${this.totalInserted}`);
    }

    async insertBatch(batch) {
        if (batch.length === 0) return;

        try {
            const placeholders = batch.map(() => '(?, ?, ?)').join(',');
            const values = batch.flat();
            
            const sql = `
                INSERT IGNORE INTO common_passwords (password, frequency, category) 
                VALUES ${placeholders}
            `;
            
            const [result] = await this.connection.execute(sql, values);
            this.totalProcessed += batch.length;
            this.totalInserted += result.affectedRows || 0;
            
            console.log(`✅ Lote insertado: ${batch.length} registros (${result.affectedRows} nuevos)`);
            
        } catch (error) {
            console.error('❌ Error insertando lote:', error.message);
            // Continuar con el siguiente lote en caso de error
        }
    }

    async verifyMigration() {
        console.log('\n🔍 Verificando migración...');
        
        const [rows] = await this.connection.execute('SELECT COUNT(*) as total FROM common_passwords');
        console.log(`📊 Total contraseñas en BD: ${rows[0].total}`);
        
        // Verificar algunas contraseñas comunes
        const testPasswords = ['123456', 'password', '123456789', 'qwerty'];
        
        for (const pwd of testPasswords) {
            const [result] = await this.connection.execute(
                'SELECT COUNT(*) as found FROM common_passwords WHERE password = ?',
                [pwd]
            );
            console.log(`   ${pwd}: ${result[0].found > 0 ? '✅ Encontrada' : '❌ No encontrada'}`);
        }
    }
}

// Ejecutar migración
async function main() {
    const migrator = new CSVToMySQLMigrator();
    
    try {
        await migrator.connect();
        
        // Opcional: limpiar datos existentes (descomenta si quieres empezar desde cero)
        // await migrator.clearExistingData();
        
        const csvPath = path.join(__dirname, '../data/1millionPasswords.csv');
        await migrator.processCSVFile(csvPath);
        await migrator.verifyMigration();
        
    } catch (error) {
        console.error('💥 Error durante la migración:', error);
    } finally {
        await migrator.disconnect();
    }
}

// Ejecutar si es el script principal
if (require.main === module) {
    main();
}

module.exports = CSVToMySQLMigrator;