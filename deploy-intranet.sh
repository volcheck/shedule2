#!/bin/bash

# ============================================================================
# Скрипт развёртывания "График дежурств врачей" для интранета (без SSL)
# ============================================================================
# Использование:
#   sudo bash deploy-intranet.sh [опции]
#
# Опции:
#   --host=HOSTNAME    Имя хоста или IP-адрес (по умолчанию: автоопределение)
#   --port=PORT        Порт веб-сервера (по умолчанию: 80)
#   --no-firewall      Не настраивать firewall
#   --no-update        Не обновлять систему
#   --db-pass=PASS     Пароль для БД (по умолчанию: генерируется)
#   --help             Показать справку
#
# Примеры:
#   sudo bash deploy-intranet.sh
#   sudo bash deploy-intranet.sh --host=192.168.1.100
#   sudo bash deploy-intranet.sh --host=duty.local --port=8080
#   sudo bash deploy-intranet.sh --host=medserver --no-firewall --no-update
# ============================================================================

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Функции логирования
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_step() { echo -e "${CYAN}▶${NC} $1"; }

# ============================================================================
# Парсинг аргументов
# ============================================================================
HOST=""
PORT=80
SETUP_FIREWALL=true
UPDATE_SYSTEM=true
CUSTOM_DB_PASS=""

show_help() {
    echo ""
    echo "========================================================================"
    echo "  Развёртывание «График дежурств врачей» для интранета"
    echo "========================================================================"
    echo ""
    echo "Использование: sudo bash deploy-intranet.sh [опции]"
    echo ""
    echo "Опции:"
    echo "  --host=HOSTNAME    Имя хоста или IP-адрес"
    echo "                     (по умолчанию: автоопределение)"
    echo "  --port=PORT        Порт веб-сервера (по умолчанию: 80)"
    echo "  --no-firewall      Не настраивать firewall"
    echo "  --no-update        Не обновлять систему"
    echo "  --db-pass=PASS     Задать пароль для БД"
    echo "  --help             Показать эту справку"
    echo ""
    echo "Примеры:"
    echo "  sudo bash deploy-intranet.sh"
    echo "  sudo bash deploy-intranet.sh --host=192.168.1.100"
    echo "  sudo bash deploy-intranet.sh --host=duty.local --port=8080"
    echo "  sudo bash deploy-intranet.sh --host=medserver --no-firewall"
    echo ""
    exit 0
}

for arg in "$@"; do
    case $arg in
        --host=*)
            HOST="${arg#*=}"
            ;;
        --port=*)
            PORT="${arg#*=}"
            ;;
        --no-firewall)
            SETUP_FIREWALL=false
            ;;
        --no-update)
            UPDATE_SYSTEM=false
            ;;
        --db-pass=*)
            CUSTOM_DB_PASS="${arg#*=}"
            ;;
        --help)
            show_help
            ;;
        *)
            log_warning "Неизвестный аргумент: $arg"
            ;;
    esac
done

# ============================================================================
# Проверка прав
# ============================================================================
if [ "$EUID" -ne 0 ]; then
    log_error "Этот скрипт должен быть запущен с правами root (sudo)"
    exit 1
fi

# ============================================================================
# Автоопределение хоста
# ============================================================================
if [ -z "$HOST" ]; then
    # Попытка определить IP-адрес
    HOST=$(hostname -I | awk '{print $1}')
    if [ -z "$HOST" ]; then
        HOST=$(hostname)
    fi
fi

# ============================================================================
# Конфигурация
# ============================================================================
DB_NAME="duty_schedule"
DB_USER="duty_user"
if [ -n "$CUSTOM_DB_PASS" ]; then
    DB_PASS="$CUSTOM_DB_PASS"
else
    DB_PASS=$(openssl rand -base64 16 | tr -d '=+/' | cut -c1-16)
fi
WEB_ROOT="/var/www/duty-schedule"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL="http://$HOST"
if [ "$PORT" != "80" ]; then
    BASE_URL="http://$HOST:$PORT"
fi

# ============================================================================
# Приветствие
# ============================================================================
echo ""
echo "========================================================================"
echo "  🏥 Развёртывание «График дежурств врачей» для интранета"
echo "========================================================================"
echo ""
echo "  Режим:             ${YELLOW}Интранет (без SSL)${NC}"
echo "  Адрес:             ${CYAN}$BASE_URL${NC}"
echo "  Порт:              $PORT"
echo "  База данных:       $DB_NAME"
echo "  Пользователь БД:   $DB_USER"
echo "  Директория:        $WEB_ROOT"
echo "  Firewall:          $([ "$SETUP_FIREWALL" = true ] && echo 'Да' || echo 'Нет')"
echo "  Обновление системы: $([ "$UPDATE_SYSTEM" = true ] && echo 'Да' || echo 'Нет')"
echo ""

read -p "Продолжить развёртывание? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Развёртывание отменено"
    exit 0
fi
echo ""

# ============================================================================
# ШАГ 1: Обновление системы (опционально)
# ============================================================================
log_step "Шаг 1/9: Подготовка системы..."

if [ "$UPDATE_SYSTEM" = true ]; then
    log_info "Обновление списка пакетов..."
    apt-get update -qq
else
    log_info "Обновление системы пропущено (--no-update)"
fi

# ============================================================================
# ШАГ 2: Установка зависимостей
# ============================================================================
log_step "Шаг 2/9: Установка компонентов..."

PACKAGES="nginx mysql-server php-fpm php-mysql php-mbstring php-xml php-curl php-zip"

# Определение версии PHP
PHP_VERSION=$(php -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;" 2>/dev/null || echo "")
if [ -z "$PHP_VERSION" ]; then
    # Попробовать установить PHP
    apt-get install -y -qq php-fpm > /dev/null 2>&1 || true
    PHP_VERSION=$(php -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;" 2>/dev/null || echo "8.1")
fi

log_info "Версия PHP: $PHP_VERSION"

# Установка пакетов
log_info "Установка пакетов..."
apt-get install -y -qq \
    nginx \
    mysql-server \
    "php${PHP_VERSION}-fpm" \
    "php${PHP_VERSION}-mysql" \
    "php${PHP_VERSION}-mbstring" \
    "php${PHP_VERSION}-xml" \
    "php${PHP_VERSION}-curl" \
    "php${PHP_VERSION}-zip" \
    curl \
    > /dev/null 2>&1

log_success "Компоненты установлены"

# ============================================================================
# ШАГ 3: Настройка MySQL
# ============================================================================
log_step "Шаг 3/9: Настройка базы данных..."

systemctl start mysql 2>/dev/null || true
systemctl enable mysql 2>/dev/null || true

# Создание БД и пользователя
mysql -u root <<EOF 2>/dev/null
CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
DROP USER IF EXISTS '$DB_USER'@'localhost';
CREATE USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
EOF

log_success "База данных создана"

# Импорт схемы
if [ -f "$SCRIPT_DIR/backend/database/schema.sql" ]; then
    mysql -u root "$DB_NAME" < "$SCRIPT_DIR/backend/database/schema.sql" 2>/dev/null
    log_success "Схема БД импортирована"
else
    log_warning "Файл schema.sql не найден"
fi

# ============================================================================
# ШАГ 4: Копирование файлов
# ============================================================================
log_step "Шаг 4/9: Размещение файлов..."

mkdir -p "$WEB_ROOT/api"

# Фронтенд
if [ -d "$SCRIPT_DIR/dist" ]; then
    cp -r "$SCRIPT_DIR/dist/"* "$WEB_ROOT/"
    log_success "Фронтенд скопирован"
else
    log_warning "Папка dist/ не найдена. Выполните: npm install && npm run build"
fi

# Бекенд
if [ -d "$SCRIPT_DIR/backend/api" ]; then
    cp -r "$SCRIPT_DIR/backend/api/"* "$WEB_ROOT/api/"
    log_success "Бекенд скопирован"
else
    log_warning "Папка backend/api/ не найдена"
fi

# ============================================================================
# ШАГ 5: Конфигурация API
# ============================================================================
log_step "Шаг 5/9: Настройка конфигурации..."

cat > "$WEB_ROOT/api/config.php" <<EOF
<?php
/**
 * Конфигурация API «График дежурств врачей»
 * Создано: $(date)
 * Режим: Интранет (без SSL)
 */
return [
    'db' => [
        'host'     => 'localhost',
        'port'     => 3306,
        'dbname'   => '$DB_NAME',
        'username' => '$DB_USER',
        'password' => '$DB_PASS',
        'charset'  => 'utf8mb4',
    ],
    'cors' => [
        'allowed_origins' => [
            '$BASE_URL',
            'http://$HOST',
            'http://localhost',
            'http://127.0.0.1',
        ],
    ],
    'debug' => false,
    'mode'  => 'intranet',
];
EOF

log_success "Конфигурация создана"

# ============================================================================
# ШАГ 6: Права доступа
# ============================================================================
log_step "Шаг 6/9: Настройка прав доступа..."

# Определение пользователя веб-сервера
WEB_USER="www-data"
if id "$WEB_USER" &>/dev/null; then
    WEB_GROUP="$WEB_USER"
else
    WEB_USER="apache"
    WEB_GROUP="apache"
fi

chown -R "$WEB_USER:$WEB_GROUP" "$WEB_ROOT"
find "$WEB_ROOT" -type d -exec chmod 755 {} \;
find "$WEB_ROOT" -type f -exec chmod 644 {} \;
chmod 600 "$WEB_ROOT/api/config.php"

log_success "Права настроены (владелец: $WEB_USER)"

# ============================================================================
# ШАГ 7: Настройка Nginx
# ============================================================================
log_step "Шаг 7/9: Настройка веб-сервера Nginx..."

# Определение socket PHP-FPM
PHP_FPM_SOCK="/run/php/php${PHP_VERSION}-fpm.sock"
if [ ! -S "$PHP_FPM_SOCK" ]; then
    PHP_FPM_SOCK="/var/run/php/php${PHP_VERSION}-fpm.sock"
fi

cat > /etc/nginx/sites-available/duty-schedule <<EOF
# ============================================================================
# График дежурств врачей — Интранет (без SSL)
# Адрес: $BASE_URL
# Создано: $(date)
# ============================================================================

server {
    listen $PORT;
    server_name $HOST _;
    root $WEB_ROOT;
    index index.html;

    # Размер запроса
    client_max_body_size 10M;

    # Кодировка
    charset utf-8;

    # Сжатие
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        application/json
        application/javascript
        text/xml
        application/xml
        text/javascript
        image/svg+xml;

    # Кеширование статики (1 неделя для интранета)
    location /assets/ {
        expires 7d;
        add_header Cache-Control "public";
    }

    # PHP API
    location /api/ {
        try_files \$uri \$uri/ /api/index.php?\$query_string;

        location ~ \.php\$ {
            include snippets/fastcgi-php.conf;
            fastcgi_pass unix:$PHP_FPM_SOCK;
            fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
            include fastcgi_params;
        }
    }

    # SPA fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Защита служебных файлов
    location ~ /\\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    location ~ /api/config\\.php\$ {
        deny all;
    }

    # Статус сервера (для мониторинга)
    location /server-status {
        stub_status on;
        allow 127.0.0.1;
        allow 192.168.0.0/16;
        allow 10.0.0.0/8;
        allow 172.16.0.0/12;
        deny all;
    }

    # Логи
    access_log /var/log/nginx/duty-schedule.access.log;
    error_log  /var/log/nginx/duty-schedule.error.log;
}
EOF

# Активация
ln -sf /etc/nginx/sites-available/duty-schedule /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Проверка
if nginx -t 2>/dev/null; then
    log_success "Конфигурация Nginx корректна"
else
    log_error "Ошибка в конфигурации Nginx"
    nginx -t
    exit 1
fi

systemctl restart nginx
systemctl enable nginx 2>/dev/null

log_success "Nginx настроен на порту $PORT"

# ============================================================================
# ШАГ 8: PHP-FPM
# ============================================================================
log_step "Шаг 8/9: Настройка PHP-FPM..."

systemctl restart "php${PHP_VERSION}-fpm"
systemctl enable "php${PHP_VERSION}-fpm" 2>/dev/null

log_success "PHP-FPM запущен"

# ============================================================================
# ШАГ 9: Firewall (опционально)
# ============================================================================
log_step "Шаг 9/9: Настройка firewall..."

if [ "$SETUP_FIREWALL" = true ]; then
    if command -v ufw &> /dev/null; then
        ufw allow OpenSSH 2>/dev/null || true
        if [ "$PORT" = "80" ]; then
            ufw allow 'Nginx HTTP' 2>/dev/null || true
        else
            ufw allow "$PORT/tcp" 2>/dev/null || true
        fi
        ufw --force enable 2>/dev/null || true
        log_success "Firewall настроен (порт $PORT открыт)"
    else
        log_warning "UFW не установлен, firewall не настроен"
    fi
else
    log_info "Настройка firewall пропущена (--no-firewall)"
fi

# ============================================================================
# Резервное копирование
# ============================================================================
log_info "Настройка резервного копирования..."

mkdir -p /opt/scripts
mkdir -p /opt/backups/duty-schedule

cat > /opt/scripts/backup-duty-schedule.sh <<BACKUP_EOF
#!/bin/bash
BACKUP_DIR="/opt/backups/duty-schedule"
DATE=\$(date +%Y%m%d_%H%M%S)
DB_NAME="$DB_NAME"
DB_USER="$DB_USER"
DB_PASS="$DB_PASS"

mkdir -p \$BACKUP_DIR

# Дамп БД
mysqldump -u\$DB_USER -p\$DB_PASS \\
    --single-transaction \\
    --routines --triggers \\
    \$DB_NAME | gzip > "\$BACKUP_DIR/db_\$DATE.sql.gz"

# Удаление старых бэкапов (60 дней для интранета)
find \$BACKUP_DIR -type f -mtime +60 -delete

echo "Бэкап создан: \$BACKUP_DIR/db_\$DATE.sql.gz"
BACKUP_EOF

chmod +x /opt/scripts/backup-duty-schedule.sh

# Cron
(crontab -l 2>/dev/null | grep -v "backup-duty-schedule"; echo "0 2 * * * /opt/scripts/backup-duty-schedule.sh >> /var/log/duty-schedule-backup.log 2>&1") | crontab -

log_success "Резервное копирование настроено (ежедневно в 2:00)"

# ============================================================================
# Проверка работоспособности
# ============================================================================
log_info "Проверка работоспособности..."

sleep 2

# Проверка сервисов
SERVICES_OK=true

if systemctl is-active --quiet nginx; then
    log_success "Nginx работает"
else
    log_error "Nginx не запущен!"
    SERVICES_OK=false
fi

if systemctl is-active --quiet "php${PHP_VERSION}-fpm"; then
    log_success "PHP-FPM работает"
else
    log_error "PHP-FPM не запущен!"
    SERVICES_OK=false
fi

if systemctl is-active --quiet mysql; then
    log_success "MySQL работает"
else
    log_error "MySQL не запущен!"
    SERVICES_OK=false
fi

# Проверка API
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/api/doctors.php" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    log_success "API отвечает (HTTP $HTTP_CODE)"
else
    log_warning "API не отвечает (HTTP $HTTP_CODE)"
fi

# ============================================================================
# Сохранение учётных данных
# ============================================================================
cat > /root/duty-schedule-credentials.txt <<EOF
================================================================
График дежурств врачей — Учётные данные (Интранет)
================================================================
Дата установки: $(date)
Режим:          Интранет (без SSL)
Адрес:          $BASE_URL

База данных:
  Имя:          $DB_NAME
  Пользователь: $DB_USER
  Пароль:       $DB_PASS

Файлы сайта:    $WEB_ROOT
Конфигурация:   $WEB_ROOT/api/config.php

Резервные копии: /opt/backups/duty-schedule
Скрипт бэкапа:  /opt/scripts/backup-duty-schedule.sh

Логи:
  Nginx:   /var/log/nginx/duty-schedule.*
  PHP:     /var/log/php${PHP_VERSION}-fpm.log
  MySQL:   /var/log/mysql/error.log
================================================================
EOF

chmod 600 /root/duty-schedule-credentials.txt

# ============================================================================
# Финальный отчёт
# ============================================================================
echo ""
echo "========================================================================"
echo "  ✅ Развёртывание завершено!"
echo "========================================================================"
echo ""
echo "  📍 Адрес в интранете:"
echo "     ${CYAN}$BASE_URL${NC}"
echo ""
echo "  📋 Для доступа пользователей:"
echo "     1. Добавьте запись в DNS или hosts-файлы:"
echo "        $HOST  →  $(hostname -I | awk '{print $1}')"
echo ""
echo "     2. Или сообщите пользователям адрес:"
echo "        ${CYAN}$BASE_URL${NC}"
echo ""
echo "  🔐 Учётные данные:"
echo "     /root/duty-schedule-credentials.txt"
echo ""
echo "  💾 Резервные копии:"
echo "     /opt/backups/duty-schedule/"
echo "     Расписание: ежедневно в 2:00"
echo ""
echo "  📝 Полезные команды:"
echo "     systemctl status nginx"
echo "     systemctl status php${PHP_VERSION}-fpm"
echo "     systemctl status mysql"
echo "     tail -f /var/log/nginx/duty-schedule.error.log"
echo "     /opt/scripts/backup-duty-schedule.sh  # бэкап вручную"
echo ""

if [ "$SERVICES_OK" = false ]; then
    echo "  ⚠️  ВНИМАНИЕ: Некоторые сервисы не запущены!"
    echo "     Проверьте логи и перезапустите сервисы вручную."
    echo ""
fi

echo "  💡 Рекомендации для интранета:"
echo "     • Настройте DNS-запись для удобного доступа"
echo "     • Добавьте адрес в белый список корпоративного прокси"
echo "     • Настройте мониторинг доступности сервиса"
echo "     • Регулярно проверяйте резервные копии"
echo ""
echo "========================================================================"
