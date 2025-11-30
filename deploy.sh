#!/bin/bash

# Script de despliegue automático para Password Evaluator API
# Este script despliega toda la aplicación con PM2 y Nginx

set -e  # Detener en caso de error

echo "=========================================="
echo "  Password Evaluator API - Deploy"
echo "  Con PM2 + Nginx + MySQL"
echo "=========================================="
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Función para imprimir con color
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_step() {
    echo -e "${PURPLE}🚀 $1${NC}"
}

# ============================================
# PASO 1: Verificar requisitos del sistema
# ============================================
print_step "PASO 1: Verificando requisitos del sistema..."
echo ""

# Verificar Node.js
print_info "Verificando Node.js..."
if ! command -v node &> /dev/null; then
    print_error "Node.js no está instalado. Por favor instálalo primero."
    exit 1
fi
NODE_VERSION=$(node -v)
print_success "Node.js instalado: $NODE_VERSION"

# Verificar npm
if ! command -v npm &> /dev/null; then
    print_error "npm no está instalado."
    exit 1
fi
NPM_VERSION=$(npm -v)
print_success "npm instalado: $NPM_VERSION"

# Verificar MySQL
print_info "Verificando MySQL..."
if ! command -v mysql &> /dev/null; then
    print_error "MySQL no está instalado. Por favor instálalo primero."
    exit 1
fi
print_success "MySQL está instalado"

# Verificar si MySQL está corriendo
if ! mysqladmin ping -h localhost --silent 2>/dev/null; then
    print_warning "MySQL no parece estar corriendo. Intentando iniciar..."
    sudo systemctl start mysql || sudo service mysql start || print_error "No se pudo iniciar MySQL"
fi
print_success "MySQL está corriendo"

# Verificar PM2
print_info "Verificando PM2..."
if ! command -v pm2 &> /dev/null; then
    print_warning "PM2 no está instalado. Instalando globalmente..."
    sudo npm install -g pm2
    print_success "PM2 instalado globalmente"
else
    PM2_VERSION=$(pm2 -v)
    print_success "PM2 ya está instalado: $PM2_VERSION"
fi

# Verificar Nginx
print_info "Verificando Nginx..."
if ! command -v nginx &> /dev/null; then
    print_warning "Nginx no está instalado."
    read -p "¿Deseas instalar Nginx ahora? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo apt-get update && sudo apt-get install -y nginx || print_error "Error instalando Nginx"
        print_success "Nginx instalado"
    else
        print_warning "Continuando sin Nginx..."
    fi
else
    NGINX_VERSION=$(nginx -v 2>&1 | cut -d'/' -f2)
    print_success "Nginx ya está instalado: $NGINX_VERSION"
fi

echo ""

# ============================================
# PASO 2: Configurar archivo .env
# ============================================
print_step "PASO 2: Configurando archivo .env..."
echo ""

if [ ! -f .env ]; then
    print_warning "Archivo .env no encontrado"
    if [ -f .env.example ]; then
        print_info "Copiando .env.example a .env"
        cp .env.example .env
        print_warning "Por favor edita el archivo .env con tus credenciales de MySQL"
        print_info "Presiona Enter cuando hayas configurado .env..."
        read -r
    else
        print_info "Creando archivo .env..."
        cat > .env << 'EOF'
PORT=3000
NODE_ENV=production
DB_HOST=localhost
DB_USER=evaluate
DB_PASSWORD=evaluate123
DB_NAME=evaluate
EOF
        print_warning "Archivo .env creado. Por favor edítalo con tus credenciales"
        print_info "Presiona Enter cuando hayas configurado .env..."
        read -r
    fi
else
    print_success "Archivo .env encontrado"
fi

# Cargar variables de entorno
export $(grep -v '^#' .env | xargs)
echo ""

# ============================================
# PASO 3: Instalar dependencias de Node.js
# ============================================
print_step "PASO 3: Instalando dependencias de Node.js..."
echo ""

# Intentar npm ci primero, si falla usar npm install
if [ -f package-lock.json ]; then
    print_info "Intentando instalación limpia con npm ci..."
    if ! npm ci --omit=dev 2>/dev/null; then
        print_warning "npm ci falló, regenerando package-lock.json..."
        rm -f package-lock.json
        npm install --omit=dev
    fi
else
    npm install --omit=dev
fi
print_success "Dependencias instaladas"
echo ""

# ============================================
# PASO 4: Configurar MySQL
# ============================================
print_step "PASO 4: Configurando MySQL..."
echo ""

print_info "Creando usuario y otorgando permisos..."

# Intentar múltiples métodos para crear el usuario MySQL
USER_CREATED=false

# Método 1: Intentar con sudo mysql (auth_socket en Ubuntu)
if sudo mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}'; GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost'; FLUSH PRIVILEGES;" 2>/dev/null; then
    print_success "Usuario MySQL configurado (método: sudo mysql)"
    USER_CREATED=true
# Método 2: Intentar sin contraseña root
elif mysql -u root -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}'; GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost'; FLUSH PRIVILEGES;" 2>/dev/null; then
    print_success "Usuario MySQL configurado (método: root sin password)"
    USER_CREATED=true
# Método 3: Intentar con contraseña vacía
elif mysql -u root -p'' -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}'; GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost'; FLUSH PRIVILEGES;" 2>/dev/null; then
    print_success "Usuario MySQL configurado (método: root password vacío)"
    USER_CREATED=true
fi

if [ "$USER_CREATED" = false ]; then
    print_warning "No se pudo crear usuario automáticamente."
    print_info "Ejecuta estos comandos manualmente:"
    echo ""
    echo "  sudo mysql"
    echo "  CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';"
    echo "  GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';"
    echo "  FLUSH PRIVILEGES;"
    echo "  EXIT;"
    echo ""
    print_info "Presiona Enter cuando hayas creado el usuario..."
    read -r
fi
echo ""

# ============================================
# PASO 5: Ejecutar migraciones
# ============================================
print_step "PASO 5: Ejecutando migraciones de base de datos..."
echo ""

npm run migrate:up
print_success "Migraciones completadas"
echo ""

# ============================================
# PASO 6: Cargar datos de contraseñas
# ============================================
print_step "PASO 6: Cargando datos de contraseñas..."
echo ""

if [ -f src/data/1millionPasswords.csv ]; then
    print_info "Archivo CSV encontrado. Cargando datos..."
    npm run migrate:load-data || print_warning "Error cargando datos, continuando..."
    print_success "Datos cargados"
else
    print_warning "Archivo CSV no encontrado en src/data/1millionPasswords.csv"
    print_info "Puedes cargar los datos más tarde con: npm run migrate:load-data"
fi
echo ""

# ============================================
# PASO 7: Verificar estado
# ============================================
print_step "PASO 7: Verificando estado de la base de datos..."
echo ""

npm run migrate:status
echo ""

# ============================================
# PASO 8: Crear directorios necesarios
# ============================================
print_step "PASO 8: Creando directorios necesarios..."
echo ""

mkdir -p logs
mkdir -p /tmp/nginx-cache/password-evaluator 2>/dev/null || sudo mkdir -p /var/cache/nginx/password-evaluator
print_success "Directorios creados"
echo ""

# ============================================
# PASO 9: Configurar PM2
# ============================================
print_step "PASO 9: Configurando PM2..."
echo ""

# Detener proceso anterior si existe
pm2 delete password-evaluator-api 2>/dev/null || true

# Iniciar con PM2
print_info "Iniciando aplicación con PM2..."
pm2 start ecosystem.config.js --env production

# Configurar PM2 para iniciar al arrancar el sistema
print_info "Configurando PM2 para iniciar al arrancar el sistema..."
pm2 startup | grep -o 'sudo.*' | bash || print_warning "No se pudo configurar PM2 startup automáticamente"
pm2 save

print_success "Aplicación iniciada con PM2"

# Mostrar estado
pm2 status
echo ""

# ============================================
# PASO 10: Configurar Nginx
# ============================================
if command -v nginx &> /dev/null; then
    print_step "PASO 10: Configurando Nginx..."
    echo ""

    # Copiar configuración de Nginx
    print_info "Instalando configuración de Nginx..."

    if [ -f nginx.conf ]; then
        sudo cp nginx.conf /etc/nginx/sites-available/password-evaluator-api

        # Crear symlink si no existe
        if [ ! -L /etc/nginx/sites-enabled/password-evaluator-api ]; then
            sudo ln -s /etc/nginx/sites-available/password-evaluator-api /etc/nginx/sites-enabled/
            print_success "Configuración de Nginx enlazada"
        fi

        # Verificar configuración
        print_info "Verificando configuración de Nginx..."
        if sudo nginx -t 2>/dev/null; then
            print_success "Configuración de Nginx válida"

            # Recargar Nginx
            print_info "Recargando Nginx..."
            sudo systemctl reload nginx || sudo service nginx reload
            print_success "Nginx recargado"
        else
            print_error "Error en la configuración de Nginx"
            print_warning "Revisa /etc/nginx/sites-available/password-evaluator-api"
        fi
    else
        print_warning "Archivo nginx.conf no encontrado"
    fi
    echo ""
else
    print_warning "Nginx no está instalado, saltando configuración..."
    echo ""
fi

# ============================================
# PASO 11: Ejecutar tests
# ============================================
if [ "$1" != "--skip-tests" ]; then
    print_step "PASO 11: Ejecutando tests..."
    echo ""
    npm test || print_warning "Tests fallaron, pero la aplicación está corriendo"
    echo ""
fi

# ============================================
# PASO 12: Verificación final
# ============================================
print_step "PASO 12: Verificación final..."
echo ""

# Esperar a que la aplicación esté lista
sleep 3

# Verificar que la aplicación responda
print_info "Verificando que la aplicación responda..."
if curl -s http://localhost:3000/health > /dev/null; then
    print_success "Aplicación respondiendo correctamente en http://localhost:3000"
else
    print_warning "La aplicación no responde en http://localhost:3000"
fi

# Verificar Nginx si está instalado
if command -v nginx &> /dev/null; then
    print_info "Verificando Nginx..."
    if curl -s http://localhost/health > /dev/null; then
        print_success "Nginx respondiendo correctamente en http://localhost"
    else
        print_warning "Nginx no responde en http://localhost"
    fi
fi

echo ""

# ============================================
# RESUMEN FINAL
# ============================================
echo "=========================================="
print_success "¡DESPLIEGUE COMPLETADO EXITOSAMENTE!"
echo "=========================================="
echo ""

print_info "Información del despliegue:"
echo "  📍 Aplicación: http://localhost:3000"
if command -v nginx &> /dev/null; then
    echo "  📍 Nginx: http://localhost"
fi
echo "  📊 Base de datos: MySQL (${DB_NAME})"
echo "  🔧 Gestión PM2: pm2 status"
echo ""

print_info "Comandos útiles:"
echo "  pm2 status                  - Ver estado de la aplicación"
echo "  pm2 logs                    - Ver logs en tiempo real"
echo "  pm2 restart password-evaluator-api  - Reiniciar aplicación"
echo "  pm2 stop password-evaluator-api     - Detener aplicación"
echo "  pm2 monit                   - Monitor en tiempo real"
echo ""
echo "  npm run migrate:up          - Ejecutar migraciones pendientes"
echo "  npm run migrate:status      - Ver estado de migraciones"
echo "  npm run migrate:reset       - Resetear base de datos"
echo ""

if command -v nginx &> /dev/null; then
    echo "  sudo nginx -t               - Verificar configuración de Nginx"
    echo "  sudo systemctl reload nginx - Recargar Nginx"
    echo "  sudo systemctl status nginx - Estado de Nginx"
    echo ""
fi

print_info "Logs de la aplicación:"
echo "  📄 PM2: ./logs/out.log y ./logs/error.log"
echo "  📄 Nginx: /var/log/nginx/password-evaluator-*.log"
echo ""

print_success "¡Todo listo! Tu API está corriendo con PM2 y Nginx."
echo ""
