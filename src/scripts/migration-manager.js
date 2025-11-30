// Sistema de gestión de migraciones automático
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class MigrationManager {
    constructor() {
        this.connection = null;
        this.migrationsPath = path.join(__dirname, '../migrations');
    }

    async connect() {
        try {
            // Conectar sin especificar base de datos primero
            this.connection = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'evaluate',
                password: process.env.DB_PASSWORD || 'evaluate123',
                charset: 'utf8mb4',
                multipleStatements: true
            });
            console.log('✅ Conectado al servidor MySQL');
        } catch (error) {
            console.error('❌ Error conectando a MySQL:', error.message);
            throw error;
        }
    }

    async disconnect() {
        if (this.connection) {
            await this.connection.end();
            console.log('🔌 Desconectado de MySQL');
        }
    }

    async getMigrationFiles() {
        try {
            const files = fs.readdirSync(this.migrationsPath)
                .filter(file => file.endsWith('.js'))
                .sort(); // Ordenar alfabéticamente

            return files;
        } catch (error) {
            console.error('❌ Error leyendo archivos de migración:', error.message);
            return [];
        }
    }

    async getExecutedMigrations() {
        try {
            // Verificar si existe la base de datos
            const dbName = process.env.DB_NAME || 'evaluate';
            const [databases] = await this.connection.query(
                'SHOW DATABASES LIKE ?',
                [dbName]
            );

            if (databases.length === 0) {
                console.log('ℹ️  Base de datos no existe, se ejecutarán todas las migraciones');
                return [];
            }

            // Cambiar a la base de datos
            await this.connection.query(`USE ${dbName}`);

            // Verificar si existe la tabla de migraciones
            const [tables] = await this.connection.query(
                'SHOW TABLES LIKE ?',
                ['migrations']
            );

            if (tables.length === 0) {
                console.log('ℹ️  Tabla de migraciones no existe, se ejecutarán todas las migraciones');
                return [];
            }

            // Obtener migraciones ejecutadas
            const [rows] = await this.connection.query(
                'SELECT name FROM migrations ORDER BY id ASC'
            );

            return rows.map(row => row.name);
        } catch (error) {
            console.error('⚠️  Error obteniendo migraciones ejecutadas:', error.message);
            return [];
        }
    }

    async runMigration(migrationFile) {
        const migrationPath = path.join(this.migrationsPath, migrationFile);
        const migration = require(migrationPath);

        console.log(`\n🚀 Ejecutando migración: ${migration.name}`);
        console.log(`📝 Descripción: ${migration.description || 'Sin descripción'}`);

        try {
            await migration.up(this.connection);

            // Registrar migración ejecutada
            await this.registerMigration(migration.name);

            console.log(`✅ Migración ${migration.name} completada exitosamente\n`);
            return true;
        } catch (error) {
            console.error(`❌ Error ejecutando migración ${migration.name}:`, error.message);
            throw error;
        }
    }

    async registerMigration(name) {
        try {
            const dbName = process.env.DB_NAME || 'evaluate';
            await this.connection.query(`USE ${dbName}`);

            await this.connection.query(
                'INSERT INTO migrations (name) VALUES (?)',
                [name]
            );
        } catch (error) {
            console.error('⚠️  Error registrando migración:', error.message);
        }
    }

    async runPendingMigrations() {
        console.log('🔍 Buscando migraciones pendientes...\n');

        const allMigrations = await this.getMigrationFiles();
        const executedMigrations = await this.getExecutedMigrations();

        const pendingMigrations = allMigrations.filter(
            migration => !executedMigrations.includes(path.basename(migration, '.js'))
        );

        if (pendingMigrations.length === 0) {
            console.log('✅ No hay migraciones pendientes. Base de datos actualizada.\n');
            return;
        }

        console.log(`📋 Migraciones pendientes: ${pendingMigrations.length}`);
        pendingMigrations.forEach((migration, index) => {
            console.log(`   ${index + 1}. ${migration}`);
        });
        console.log('');

        for (const migration of pendingMigrations) {
            await this.runMigration(migration);
        }

        console.log('🎉 Todas las migraciones completadas exitosamente!\n');
    }

    async status() {
        console.log('📊 Estado de migraciones:\n');

        const allMigrations = await this.getMigrationFiles();
        const executedMigrations = await this.getExecutedMigrations();

        console.log(`Total de migraciones: ${allMigrations.length}`);
        console.log(`Ejecutadas: ${executedMigrations.length}`);
        console.log(`Pendientes: ${allMigrations.length - executedMigrations.length}\n`);

        console.log('Detalle:');
        allMigrations.forEach(migration => {
            const name = path.basename(migration, '.js');
            const status = executedMigrations.includes(name) ? '✅ Ejecutada' : '⏳ Pendiente';
            console.log(`   ${status} - ${migration}`);
        });
        console.log('');
    }

    async reset() {
        console.log('⚠️  ADVERTENCIA: Esto eliminará todas las tablas y datos!');

        const dbName = process.env.DB_NAME || 'evaluate';

        try {
            await this.connection.query(`DROP DATABASE IF EXISTS ${dbName}`);
            console.log(`🗑️  Base de datos ${dbName} eliminada`);

            console.log('♻️  Ejecutando todas las migraciones desde cero...\n');
            await this.runPendingMigrations();
        } catch (error) {
            console.error('❌ Error durante el reset:', error.message);
            throw error;
        }
    }
}

// CLI
async function main() {
    const command = process.argv[2] || 'migrate';
    const manager = new MigrationManager();

    try {
        await manager.connect();

        switch (command) {
            case 'migrate':
            case 'up':
                await manager.runPendingMigrations();
                break;

            case 'status':
                await manager.status();
                break;

            case 'reset':
                await manager.reset();
                break;

            default:
                console.log('❌ Comando no reconocido');
                console.log('Comandos disponibles:');
                console.log('   migrate (o up) - Ejecutar migraciones pendientes');
                console.log('   status         - Ver estado de migraciones');
                console.log('   reset          - Resetear base de datos y ejecutar todas las migraciones');
        }
    } catch (error) {
        console.error('💥 Error:', error.message);
        process.exit(1);
    } finally {
        await manager.disconnect();
    }
}

if (require.main === module) {
    main();
}

module.exports = MigrationManager;
