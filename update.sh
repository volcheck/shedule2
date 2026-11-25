#!/bin/bash

# ============================================================================
# Скрипт обновления "График дежурств врачей"
# ============================================================================
# Использование:
#   sudo bash update.sh
# ============================================================================

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверка прав root
if [ "$EUID" -ne 0 ]; then
    log_error "Этот скрипт должен быть запущен с правами root (sudo)"
    exit 1
fi

# Конфигурация
WEB_ROOT="/var/www/duty-schedule"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "========================================================================"
echo "  Обновление: График дежурств врачей"
echo "========================================================================"
echo ""

# ============================================================================
# 1. Создание резервной копии перед обновлением
# ============================================================================
log_info "Создание резервной копии перед обновлением..."

BACKUP_DIR="/opt/backups/duty-schedule"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# Бэкап базы данных (если есть конфигурация)
if [ -f "$WEB_ROOT/api/config.php" ]; then
    # Извлечь учётные данные из конфигурации
    DB_USER=$(php -r "include '$WEB_ROOT/api/config.php'; \$c = include '$WEB_ROOT/api/config.php'; echo \$c['db']['username'];")
    DB_PASS=$(php -r "include '$WEB_ROOT/api/config.php'; \$c = include '$WEB_ROOT/api/config.php'; echo \$c['db']['password'];")
    DB_NAME=$(php -r "include '$WEB_ROOT/api/config.php'; \$c = include '$WEB_ROOT/api/config.php'; echo \$c['db']['dbname'];")
    
    if [ -n "$DB_USER" ] && [ -n "$DB_PASS" ] && [ -n "$DB_NAME" ]; then
        mysqldump -u"$DB_USER" -p"$DB_PASS" \
            --single-transaction \
            --routines --triggers \
            "$DB_NAME" | gzip > "$BACKUP_DIR/pre_update_db_$DATE.sql.gz"
        log_success "База данных сохранена: pre_update_db_$DATE.sql.gz"
    fi
fi

# Бэкап файлов
if [ -d "$WEB_ROOT" ]; then
    tar -czf "$BACKUP_DIR/pre_update_files_$DATE.tar.gz" -C /var/www duty-schedule
    log_success "Файлы сохранены: pre_update_files_$DATE.tar.gz"
fi

# ============================================================================
# 2. Обновление кода из git
# ============================================================================
log_info "Обновление кода из git..."

cd "$SCRIPT_DIR"

# Сохранить локальные изменения конфигурации
if [ -f "$WEB_ROOT/api/config.php" ]; then
    cp "$WEB_ROOT/api/config.php" /tmp/config.php.backup
    log_info "Конфигурация API сохранена"
fi

# Обновить код
if git pull origin main; then
    log_success "Код обновлён из git"
else
    log_warning "Не удалось обновить код из git (возможно, нет репозитория)"
fi

# ============================================================================
# 3. Установка зависимостей
# ============================================================================
log_info "Установка зависимостей..."

if command -v npm &> /dev/null; then
    npm install --quiet
    log_success "Зависимости установлены"
else
    log_warning "npm не найден, пропуск установки зависимостей"
fi

# ============================================================================
# 4. Сборка фронтенда
# ============================================================================
log_info "Сборка фронтенда..."

if command -v npm &> /dev/null; then
    npm run build
    log_success "Фронтенд собран"
else
    log_warning "npm не найден, пропуск сборки"
fi

# ============================================================================
# 5. Копирование файлов
# ============================================================================
log_info "Копирование файлов..."

# Копировать фронтенд
if [ -d "$SCRIPT_DIR/dist" ]; then
    # Удалить старые assets
    rm -rf "$WEB_ROOT/assets/"
    
    # Скопировать новые файлы
    cp -r "$SCRIPT_DIR/dist/"* "$WEB_ROOT/"
    log_success "Фронтенд обновлён"
else
    log_warning "Папка dist/ не найдена"
fi

# Копировать бекенд (если есть изменения)
if [ -d "$SCRIPT_DIR/backend/api" ]; then
    # Сохранить текущую конфигурацию
    if [ -f "$WEB_ROOT/api/config.php" ]; then
        cp "$WEB_ROOT/api/config.php" /tmp/config.php.current
    fi
    
    # Скопировать новые файлы API
    cp -r "$SCRIPT_DIR/backend/api/"* "$WEB_ROOT/api/"
    
    # Восстановить конфигурацию
    if [ -f /tmp/config.php.current ]; then
        cp /tmp/config.php.current "$WEB_ROOT/api/config.php"
        log_success "Бекенд обновлён (конфигурация сохранена)"
    else
        log_success "Бекенд обновлён"
    fi
fi

# ============================================================================
# 6. Обновление базы данных (если есть миграции)
# ============================================================================
log_info "Проверка обновлений базы данных..."

if [ -f "$SCRIPT_DIR/backend/database/updates/$DATE.sql" ]; then
    log_info "Найдены миграции БД, применение..."
    
    if [ -f "$WEB_ROOT/api/config.php" ]; then
        DB_USER=$(php -r "include '$WEB_ROOT/api/config.php'; \$c = include '$WEB_ROOT/api/config.php'; echo \$c['db']['username'];")
        DB_PASS=$(php -r "include '$WEB_ROOT/api/config.php'; \$c = include '$WEB_ROOT/api/config.php'; echo \$c['db']['password'];")
        DB_NAME=$(php -r "include '$WEB_ROOT/api/config.php'; \$c = include '$WEB_ROOT/api/config.php'; echo \$c['db']['dbname'];")
        
        if [ -n "$DB_USER" ] && [ -n "$DB_PASS" ] && [ -n "$DB_NAME" ]; then
            mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$SCRIPT_DIR/backend/database/updates/$DATE.sql"
            log_success "Миграции применены"
        fi
    fi
else
    log_info "Миграции не найдены"
fi

# ============================================================================
# 7. Настройка прав доступа
# ============================================================================
log_info "Настройка прав доступа..."

chown -R www-www-data "$WEB_ROOT"
find "$WEB_ROOT" -type d -exec chmod 755 {} \;
find "$WEB_ROOT" -type f -exec chmod 644 {} \;
chmod 600 "$WEB_ROOT/api/config.php"

log_success "Права доступа настроены"

# ============================================================================
# 8. Перезапуск сервисов
# ============================================================================
log_info "Перезапуск сервисов..."

systemctl reload nginx
systemctl restart php8.1-fpm

log_success "Сервисы перезапущены"

# ============================================================================
# 9. Проверка работоспособности
# ============================================================================
log_info "Проверка работоспособности..."

sleep 2

# Проверка API
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/doctors.php || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    log_success "API работает корректно"
else
    log_warning "API не отвечает (HTTP $HTTP_CODE)"
fi

# ============================================================================
# 10. Очистка временных файлов
# ============================================================================
rm -f /tmp/config.php.backup /tmp/config.php.current

# ============================================================================
# Финальная информация
# ============================================================================
echo ""
echo "========================================================================"
echo "  ✅ Обновление завершено успешно!"
echo "========================================================================"
echo ""
echo "📍 Сайт доступен по адресу:"
echo "   http://localhost"
echo ""
echo "💾 Резервная копия перед обновлением:"
echo "   База данных: $BACKUP_DIR/pre_update_db_$DATE.sql.gz"
echo "   Файлы: $BACKUP_DIR/pre_update_files_$DATE.tar.gz"
echo ""
echo "📋 Если что-то пошло не так, вы можете откатиться:"
echo "   # Восстановить файлы:"
echo "   sudo tar -xzf $BACKUP_DIR/pre_update_files_$DATE.tar.gz -C /var/www/"
echo ""
echo "   # Восстановить базу данных:"
echo "   gunzip $BACKUP_DIR/pre_update_db_$DATE.sql.gz"
echo "   mysql -u duty_user -p duty_schedule < $BACKUP_DIR/pre_update_db_$DATE.sql"
echo ""
echo "========================================================================"
