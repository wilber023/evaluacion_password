#!/bin/bash

# Script de preparación pre-despliegue
# Limpia y prepara el proyecto antes del despliegue

echo "=========================================="
echo "  Pre-Deploy - Preparación"
echo "=========================================="
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 1. Limpiar node_modules y package-lock.json
print_info "Limpiando instalaciones anteriores..."
rm -rf node_modules
rm -f package-lock.json
print_success "node_modules eliminado"
print_success "package-lock.json eliminado"
echo ""

# 2. Reinstalar dependencias limpias
print_info "Instalando dependencias frescas..."
npm install --omit=dev
print_success "Dependencias instaladas"
echo ""

# 3. Verificar que .env exista
if [ ! -f .env ]; then
    print_warning "Archivo .env no encontrado"
    if [ -f .env.example ]; then
        cp .env.example .env
        print_success ".env creado desde .env.example"
        print_warning "Por favor edita .env con tus credenciales antes de continuar"
    fi
else
    print_success "Archivo .env existe"
fi
echo ""

# 4. Dar permisos de ejecución a scripts
print_info "Configurando permisos de scripts..."
chmod +x deploy.sh
chmod +x verify-deployment.sh
chmod +x pre-deploy.sh
print_success "Permisos configurados"
echo ""

print_success "¡Preparación completada!"
echo ""
print_info "Ahora puedes ejecutar:"
echo "  ./deploy.sh"
echo ""
