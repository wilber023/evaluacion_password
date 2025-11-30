#!/bin/bash

# Script de verificación post-despliegue
# Verifica que todo esté funcionando correctamente

echo "=========================================="
echo "  Verificación del Despliegue"
echo "  Password Evaluator API"
echo "=========================================="
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    ((ERRORS++))
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNINGS++))
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# ============================================
# 1. Verificar MySQL
# ============================================
print_info "1. Verificando MySQL..."

if ! mysqladmin ping -h localhost --silent 2>/dev/null; then
    print_error "MySQL no está respondiendo"
else
    print_success "MySQL está corriendo"

    # Cargar .env
    export $(grep -v '^#' .env | xargs 2>/dev/null)

    # Verificar base de datos
    if mysql -h localhost -u ${DB_USER} -p${DB_PASSWORD} -e "USE ${DB_NAME}; SELECT 1;" &>/dev/null; then
        print_success "Base de datos ${DB_NAME} existe y es accesible"

        # Verificar tablas
        TABLE_COUNT=$(mysql -h localhost -u ${DB_USER} -p${DB_PASSWORD} -D ${DB_NAME} -se "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}';")
        print_info "   Tablas encontradas: $TABLE_COUNT"

        # Verificar datos
        PASSWORD_COUNT=$(mysql -h localhost -u ${DB_USER} -p${DB_PASSWORD} -D ${DB_NAME} -se "SELECT COUNT(*) FROM common_passwords;" 2>/dev/null || echo "0")
        if [ "$PASSWORD_COUNT" -gt 0 ]; then
            print_success "Contraseñas en BD: $PASSWORD_COUNT"
        else
            print_warning "No hay contraseñas en la base de datos"
        fi
    else
        print_error "No se puede acceder a la base de datos ${DB_NAME}"
    fi
fi
echo ""

# ============================================
# 2. Verificar PM2
# ============================================
print_info "2. Verificando PM2..."

if ! command -v pm2 &> /dev/null; then
    print_error "PM2 no está instalado"
else
    print_success "PM2 está instalado"

    # Verificar proceso
    if pm2 list | grep -q "password-evaluator-api"; then
        STATUS=$(pm2 jlist | grep -A 20 "password-evaluator-api" | grep "pm2_env" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

        if [ "$STATUS" == "online" ]; then
            print_success "Aplicación está corriendo (status: $STATUS)"

            # Obtener info del proceso
            UPTIME=$(pm2 jlist | grep -A 20 "password-evaluator-api" | grep "pm_uptime" | grep -o '[0-9]*')
            MEMORY=$(pm2 jlist | grep -A 20 "password-evaluator-api" | grep "memory" | grep -o '[0-9]*' | head -1)
            MEMORY_MB=$((MEMORY / 1024 / 1024))

            print_info "   Memoria utilizada: ${MEMORY_MB}MB"
        else
            print_error "Aplicación NO está online (status: $STATUS)"
        fi
    else
        print_error "Proceso password-evaluator-api no encontrado en PM2"
    fi
fi
echo ""

# ============================================
# 3. Verificar aplicación Node.js
# ============================================
print_info "3. Verificando aplicación Node.js..."

# Verificar que responda en el puerto 3000
if curl -s http://localhost:3000/health > /dev/null; then
    print_success "Aplicación responde en http://localhost:3000"

    # Verificar endpoint raíz
    RESPONSE=$(curl -s http://localhost:3000/)
    if echo "$RESPONSE" | grep -q "Password Evaluator API"; then
        print_success "Endpoint raíz responde correctamente"
    else
        print_warning "Endpoint raíz no devuelve la respuesta esperada"
    fi

    # Verificar health check
    HEALTH=$(curl -s http://localhost:3000/health)
    if echo "$HEALTH" | grep -q "OK"; then
        print_success "Health check responde correctamente"
    else
        print_warning "Health check no devuelve OK"
    fi

    # Probar endpoint de evaluación
    TEST_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/password/evaluate \
        -H "Content-Type: application/json" \
        -d '{"password":"test123"}')

    if echo "$TEST_RESPONSE" | grep -q "entropy"; then
        print_success "Endpoint de evaluación funciona correctamente"
    else
        print_warning "Endpoint de evaluación no responde como se esperaba"
    fi
else
    print_error "Aplicación NO responde en http://localhost:3000"
fi
echo ""

# ============================================
# 4. Verificar Nginx
# ============================================
print_info "4. Verificando Nginx..."

if ! command -v nginx &> /dev/null; then
    print_warning "Nginx no está instalado"
else
    print_success "Nginx está instalado"

    # Verificar que esté corriendo
    if systemctl is-active --quiet nginx 2>/dev/null || service nginx status &>/dev/null; then
        print_success "Nginx está corriendo"

        # Verificar configuración
        if sudo nginx -t &>/dev/null; then
            print_success "Configuración de Nginx es válida"
        else
            print_error "Configuración de Nginx tiene errores"
        fi

        # Verificar que responda
        if curl -s http://localhost/health > /dev/null; then
            print_success "Nginx proxy funciona correctamente"
        else
            print_warning "Nginx no está respondiendo en http://localhost"
        fi
    else
        print_error "Nginx NO está corriendo"
    fi
fi
echo ""

# ============================================
# 5. Verificar logs
# ============================================
print_info "5. Verificando logs..."

if [ -d logs ]; then
    print_success "Directorio de logs existe"

    if [ -f logs/out.log ]; then
        LOG_SIZE=$(du -h logs/out.log | cut -f1)
        print_info "   out.log: $LOG_SIZE"
    fi

    if [ -f logs/error.log ]; then
        ERROR_COUNT=$(grep -c "Error" logs/error.log 2>/dev/null || echo "0")
        if [ "$ERROR_COUNT" -gt 0 ]; then
            print_warning "Errores encontrados en logs: $ERROR_COUNT"
        else
            print_success "No hay errores en logs"
        fi
    fi
else
    print_warning "Directorio de logs no existe"
fi
echo ""

# ============================================
# 6. Verificar estructura de base de datos
# ============================================
print_info "6. Verificando estructura de base de datos..."

if [ -n "$DB_USER" ] && [ -n "$DB_PASSWORD" ]; then
    # Verificar tabla common_passwords
    if mysql -h localhost -u ${DB_USER} -p${DB_PASSWORD} -D ${DB_NAME} -e "DESCRIBE common_passwords;" &>/dev/null; then
        print_success "Tabla common_passwords existe"

        # Verificar índices
        INDEX_COUNT=$(mysql -h localhost -u ${DB_USER} -p${DB_PASSWORD} -D ${DB_NAME} -se "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema='${DB_NAME}' AND table_name='common_passwords';")
        print_info "   Índices en common_passwords: $INDEX_COUNT"
    else
        print_error "Tabla common_passwords no existe"
    fi

    # Verificar tabla password_similarity_cache
    if mysql -h localhost -u ${DB_USER} -p${DB_PASSWORD} -D ${DB_NAME} -e "DESCRIBE password_similarity_cache;" &>/dev/null; then
        print_success "Tabla password_similarity_cache existe"
    else
        print_error "Tabla password_similarity_cache no existe"
    fi

    # Verificar tabla migrations
    if mysql -h localhost -u ${DB_USER} -p${DB_PASSWORD} -D ${DB_NAME} -e "DESCRIBE migrations;" &>/dev/null; then
        MIGRATION_COUNT=$(mysql -h localhost -u ${DB_USER} -p${DB_PASSWORD} -D ${DB_NAME} -se "SELECT COUNT(*) FROM migrations;")
        print_success "Migraciones ejecutadas: $MIGRATION_COUNT"
    else
        print_error "Tabla migrations no existe"
    fi
fi
echo ""

# ============================================
# 7. Test de rendimiento básico
# ============================================
print_info "7. Test de rendimiento básico..."

if curl -s http://localhost:3000/health > /dev/null; then
    # Medir tiempo de respuesta
    RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' http://localhost:3000/api/v1/password/evaluate \
        -H "Content-Type: application/json" \
        -d '{"password":"test123456"}')

    RESPONSE_MS=$(echo "$RESPONSE_TIME * 1000" | bc)

    if (( $(echo "$RESPONSE_TIME < 0.1" | bc -l) )); then
        print_success "Tiempo de respuesta: ${RESPONSE_MS}ms (excelente)"
    elif (( $(echo "$RESPONSE_TIME < 0.5" | bc -l) )); then
        print_success "Tiempo de respuesta: ${RESPONSE_MS}ms (bueno)"
    else
        print_warning "Tiempo de respuesta: ${RESPONSE_MS}ms (lento)"
    fi
fi
echo ""

# ============================================
# RESUMEN
# ============================================
echo "=========================================="
echo "  RESUMEN DE VERIFICACIÓN"
echo "=========================================="
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    print_success "¡Todo está funcionando perfectamente!"
elif [ $ERRORS -eq 0 ]; then
    print_warning "Sistema funcionando con $WARNINGS advertencias"
else
    print_error "Se encontraron $ERRORS errores y $WARNINGS advertencias"
fi

echo ""
print_info "Endpoints disponibles:"
echo "  📍 http://localhost:3000          - Aplicación directa"
if command -v nginx &> /dev/null; then
    echo "  📍 http://localhost               - A través de Nginx"
fi
echo "  📍 http://localhost:3000/health   - Health check"
echo "  📍 POST http://localhost:3000/api/v1/password/evaluate"
echo ""

print_info "Para ver logs en tiempo real:"
echo "  pm2 logs password-evaluator-api"
echo ""

exit $ERRORS
