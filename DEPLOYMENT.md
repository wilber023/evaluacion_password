# Guía de Despliegue - Password Evaluator API

Esta guía te ayudará a desplegar completamente la API con MySQL, PM2 y Nginx.

## 📋 Requisitos Previos

Antes de ejecutar el despliegue, asegúrate de tener instalado:

- **Node.js** (v14 o superior)
- **npm** (v6 o superior)
- **MySQL** (v5.7 o superior, recomendado v8.0+)
- **Git** (para clonar el repositorio)

## 🚀 Despliegue Rápido (Un Solo Comando)

```bash
bash deploy.sh
```

Este script realizará automáticamente:

1. ✅ Verificación de requisitos (Node.js, MySQL, PM2, Nginx)
2. ✅ Instalación de PM2 y Nginx si no están presentes
3. ✅ Configuración del archivo `.env`
4. ✅ Instalación de dependencias de Node.js
5. ✅ Creación de usuario MySQL
6. ✅ Ejecución de migraciones de base de datos
7. ✅ Carga de datos de contraseñas
8. ✅ Configuración de PM2 en modo cluster
9. ✅ Configuración de Nginx con proxy_pass
10. ✅ Verificación del despliegue

## 📝 Despliegue Paso a Paso

Si prefieres hacerlo manualmente:

### 1. Clonar el repositorio

```bash
git clone <repository-url>
cd password-evaluator-api
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tus credenciales
```

Archivo `.env`:
```env
PORT=3000
NODE_ENV=production
DB_HOST=localhost
DB_USER=evaluate
DB_PASSWORD=evaluate123
DB_NAME=evaluate
```

### 3. Crear usuario MySQL

```bash
mysql -u root -p
```

```sql
CREATE USER 'evaluate'@'localhost' IDENTIFIED BY 'evaluate123';
GRANT ALL PRIVILEGES ON evaluate.* TO 'evaluate'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 4. Instalar dependencias

```bash
npm install --production
```

### 5. Ejecutar migraciones

```bash
npm run migrate:up
```

Esto creará:
- Base de datos `evaluate`
- Tabla `common_passwords` (optimizada con índices)
- Tabla `password_similarity_cache` (para cache de búsquedas)
- Tabla `migrations` (control de versiones)

### 6. Cargar datos de contraseñas

```bash
npm run migrate:load-data
```

### 7. Instalar PM2 globalmente

```bash
sudo npm install -g pm2
```

### 8. Iniciar aplicación con PM2

```bash
npm run pm2:start
# o directamente:
pm2 start ecosystem.config.js --env production
```

### 9. Configurar PM2 para auto-inicio

```bash
pm2 startup
# Ejecutar el comando que PM2 te sugiera
pm2 save
```

### 10. Configurar Nginx

```bash
# Copiar configuración
sudo cp nginx.conf /etc/nginx/sites-available/password-evaluator-api

# Crear enlace simbólico
sudo ln -s /etc/nginx/sites-available/password-evaluator-api /etc/nginx/sites-enabled/

# Verificar configuración
sudo nginx -t

# Recargar Nginx
sudo systemctl reload nginx
```

## 🔍 Verificación del Despliegue

```bash
npm run verify
```

Este comando verificará:
- ✅ MySQL está corriendo y accesible
- ✅ Base de datos y tablas existen
- ✅ PM2 está ejecutando la aplicación
- ✅ Aplicación responde en puerto 3000
- ✅ Nginx está configurado correctamente
- ✅ Endpoints funcionan correctamente
- ✅ Tiempo de respuesta es aceptable

## 📊 Estructura de Base de Datos Optimizada

### Tabla: common_passwords

```sql
CREATE TABLE common_passwords (
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
ROW_FORMAT=COMPRESSED;
```

**Optimizaciones:**
- `INT UNSIGNED` para IDs y frequency (ahorra espacio)
- `UNIQUE KEY` en password (búsquedas O(1))
- Índice en category (filtrado rápido)
- Índice descendente en frequency (top passwords)
- Índice parcial en password (prefijos rápidos)
- `ROW_FORMAT=COMPRESSED` (reduce espacio en disco ~30%)

### Tabla: password_similarity_cache

```sql
CREATE TABLE password_similarity_cache (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    original_password VARCHAR(255) NOT NULL,
    similar_password VARCHAR(255) NOT NULL,
    similarity_score DECIMAL(4,3) NOT NULL,
    similarity_type ENUM('identical', 'simple_variation', 'similar'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_pair (original_password(100), similar_password(100)),
    INDEX idx_original (original_password(50)),
    INDEX idx_score (similarity_score DESC),
    INDEX idx_created (created_at)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci
ROW_FORMAT=COMPRESSED;
```

**Optimizaciones:**
- ENUM para similarity_type (más eficiente que VARCHAR)
- Índice compuesto único (evita duplicados)
- Índices parciales (reducen tamaño de índice)
- Índice en created_at (limpieza de cache viejo)

## 🔧 Comandos Útiles

### Gestión con PM2

```bash
# Ver estado
pm2 status

# Ver logs en tiempo real
npm run pm2:logs

# Reiniciar aplicación
npm run pm2:restart

# Detener aplicación
npm run pm2:stop

# Monitor en tiempo real
npm run pm2:monit

# Ver métricas
pm2 describe password-evaluator-api
```

### Gestión de Migraciones

```bash
# Ver estado de migraciones
npm run migrate:status

# Ejecutar migraciones pendientes
npm run migrate:up

# Resetear base de datos (¡CUIDADO!)
npm run migrate:reset

# Cargar datos de contraseñas
npm run migrate:load-data
```

### Gestión de Nginx

```bash
# Verificar configuración
sudo nginx -t

# Recargar configuración
sudo systemctl reload nginx

# Ver estado
sudo systemctl status nginx

# Ver logs
sudo tail -f /var/log/nginx/password-evaluator-access.log
sudo tail -f /var/log/nginx/password-evaluator-error.log
```

### MySQL

```bash
# Conectar a MySQL
mysql -u evaluate -p evaluate

# Ver estadísticas
SELECT COUNT(*) FROM common_passwords;
SELECT * FROM migrations;

# Verificar índices
SHOW INDEX FROM common_passwords;

# Ver tamaño de tablas
SELECT
    table_name,
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)'
FROM information_schema.TABLES
WHERE table_schema = 'evaluate';
```

## 🌐 Endpoints

Una vez desplegado, la API estará disponible en:

- **Aplicación directa:** `http://localhost:3000`
- **A través de Nginx:** `http://localhost` (puerto 80)

### Endpoints principales:

```bash
# Health check
GET http://localhost:3000/health

# Información de la API
GET http://localhost:3000/

# Evaluar contraseña
POST http://localhost:3000/api/v1/password/evaluate
Content-Type: application/json
{
  "password": "MiContraseña123!"
}

# Encontrar similitudes
POST http://localhost:3000/api/v1/password/similarity
Content-Type: application/json
{
  "password": "password123"
}

# Estadísticas
GET http://localhost:3000/api/v1/password/stats
```

## 🔒 Configuración de Seguridad

### Nginx

La configuración incluye:

- **Rate limiting:** 100 req/s por IP
- **Connection limiting:** 10 conexiones simultáneas
- **Headers de seguridad:** X-Frame-Options, X-Content-Type-Options, etc.
- **Compresión gzip** para respuestas
- **Cache** para endpoints GET

### PM2

- **Modo cluster:** Utiliza todos los núcleos del CPU
- **Auto-restart:** Reinicio automático en caso de crash
- **Límite de memoria:** 500MB por instancia
- **Logs rotados** automáticamente

### MySQL

- Usuario con permisos limitados solo a la base de datos `evaluate`
- Conexión solo desde localhost
- Charset utf8mb4 para soporte completo de Unicode

## 📈 Rendimiento Esperado

Con la configuración optimizada:

- **Tiempo de respuesta:** 1-10ms por evaluación
- **Throughput:** 1000+ req/s (con PM2 cluster)
- **Memoria:** ~100-200MB por instancia de Node.js
- **Base de datos:** ~150MB para 1 millón de contraseñas

## 🐛 Resolución de Problemas

### La aplicación no inicia

```bash
# Ver logs de PM2
pm2 logs password-evaluator-api --lines 100

# Verificar que MySQL esté corriendo
sudo systemctl status mysql

# Verificar conexión a MySQL
mysql -u evaluate -p -e "SELECT 1;"
```

### Nginx devuelve 502 Bad Gateway

```bash
# Verificar que la aplicación esté corriendo
curl http://localhost:3000/health

# Ver logs de Nginx
sudo tail -f /var/log/nginx/password-evaluator-error.log

# Verificar configuración de Nginx
sudo nginx -t
```

### Base de datos no tiene contraseñas

```bash
# Verificar que exista el archivo CSV
ls -lh src/data/1millionPasswords.csv

# Cargar datos manualmente
npm run migrate:load-data
```

### PM2 no se inicia automáticamente al arrancar

```bash
# Configurar startup
pm2 startup

# Ejecutar el comando sugerido por PM2
# Ejemplo: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u user --hp /home/user

# Guardar configuración
pm2 save
```

## 🔄 Actualización de la Aplicación

```bash
# Detener aplicación
pm2 stop password-evaluator-api

# Actualizar código
git pull

# Instalar dependencias
npm install --production

# Ejecutar migraciones pendientes
npm run migrate:up

# Reiniciar aplicación
pm2 restart password-evaluator-api

# Verificar
npm run verify
```

## 📚 Recursos Adicionales

- [Documentación de PM2](https://pm2.keymetrics.io/)
- [Documentación de Nginx](https://nginx.org/en/docs/)
- [Optimización de MySQL](https://dev.mysql.com/doc/refman/8.0/en/optimization.html)

## 📞 Soporte

Para reportar problemas o solicitar ayuda, crear un issue en el repositorio.
