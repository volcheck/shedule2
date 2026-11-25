#!/bin/bash

# ============================================================================
# Скрипт развёртывания "График дежурств врачей" для Ubuntu 20.04/22.04/24.04
# ============================================================================
# Использование:
#   sudo bash deploy.sh [domain]
#
# Примеры:
#   sudo bash deploy.sh                    # Развернуть на localhost
#   sudo bash deploy.sh duty.example.com   # Развернуть на домене
# ============================================================================

set -e  # Остановить при ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функции логирования
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
DOMAIN=${1:-"localhost"}
DB_NAME="duty_schedule"
DB_USER="duty_user"
DB_PASS=$(openssl rand -base64 16 | tr -d '=+/' | cut -c1-16)
WEB_ROOT="/var/www/duty-schedule"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "========================================================================"
echo "  Развёртывание: График дежурств врачей"
echo "========================================================================"
echo ""
echo "Домен:              $DOMAIN"
echo "База данных:        $DB_NAME"
echo "Пользователь БД:    $DB_USER"
echo "Пароль БД:          $DB_PASS"
echo "Директория сайта:   $WEB_ROOT"
echo ""

read -p "Продолжить развёртывание? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Развёртывание отменено"
    exit 0
fi

echo ""

# ============================================================================
# 1. Проверка системы
# ============================================================================
log_info "Проверка системы..."

# Проверка версии Ubuntu
if [ -f /etc/os-release ]; then
    . /etc/os-release
    if [[ "$ID" != "ubuntu" ]]; then
        log_warning "Скрипт оптимизирован для Ubuntu. На других системах могут быть проблемы."
    fi
    log_info "Операционная система: $PRETTY_NAME"
else
    log_warning "Не удалось определить версию ОС"
fi

# Проверка архитектуры
ARCH=$(uname -m)
log_info "Архитектура: $ARCH"

# ============================================================================
# 2. Обновление системы и установка зависимостей
# ============================================================================
log_info "Обновление пакетов..."
apt-get update -qq

log_info "Установка необходимых пакетов..."
apt-get install -y -qq \
    nginx \
    mysql-server \
    php8.1-fpm \
    php8.1-mysql \
    php8.1-mbstring \
    php8.1-xml \
    php8.1-curl \
    php8.1-zip \
    unzip \
    curl \
    wget \
    git \
    ufw \
    > /dev/null 2>&1

log_success "Пакеты установлены"

# ============================================================================
# 3. Настройка MySQL
# ============================================================================
log_info "Настройка MySQL..."

# Запуск MySQL
systemctl start mysql
systemctl enable mysql

# Создание базы данных и пользователя
mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
EOF

log_success "База данных создана"

# Импорт схемы
if [ -f "$SCRIPT_DIR/backend/database/schema.sql" ]; then
    log_info "Импорт схемы базы данных..."
    mysql -u root "$DB_NAME" < "$SCRIPT_DIR/backend/database/schema.sql"
    log_success "Схема импортирована"
else
    log_warning "Файл schema.sql не найден в $SCRIPT_DIR/backend/database/"
    log_warning "База данных создана, но таблицы не импортированы"
fi

# ============================================================================
# 4. Создание директории и копирование файлов
# ============================================================================
log_info "Создание директории сайта..."
mkdir -p "$WEB_ROOT"
mkdir -p "$WEB_ROOT/api"

# Копирование фронтенда
if [ -d "$SCRIPT_DIR/dist" ]; then
    log_info "Копирование фронтенда..."
    cp -r "$SCRIPT_DIR/dist/"* "$WEB_ROOT/"
    log_success "Фронтенд скопирован"
else
    log_warning "Папка dist/ не найдена"
    log_warning "Соберите фронтенд: npm install && npm run build"
fi

# Копирование бекенда
if [ -d "$SCRIPT_DIR/backend/api" ]; then
    log_info "Копирование бекенда..."
    cp -r "$SCRIPT_DIR/backend/api/"* "$WEB_ROOT/api/"
    log_success "Бекенд скопирован"
else
    log_warning "Папка backend/api/ не найдена"
fi

# ============================================================================
# 5. Настройка конфигурации API
# ============================================================================
log_info "Настройка конфигурации API..."

cat > "$WEB_ROOT/api/config.php" <<EOF
<?php
return [
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'dbname' => '$DB_NAME',
        'username' => '$DB_USER',
        'password' => '$DB_PASS',
        'charset' => 'utf8mb4',
    ],
    'cors' => [
        'allowed_origins' => [
            'http://$DOMAIN',
            'https://$DOMAIN',
            'http://localhost',
            'http://localhost:3000',
        ],
    ],
    'debug' => false,
];
EOF

log_success "Конфигурация API создана"

# ============================================================================
# 6. Настройка прав доступа
# ============================================================================
log_info "Настройка прав доступа..."

chown -R www-www-data "$WEB_ROOT"
find "$WEB_ROOT" -type d -exec chmod 755 {} \;
find "$WEB_ROOT" -type f -exec chmod 644 {} \;
chmod 600 "$WEB_ROOT/api/config.php"

log_success "Права доступа настроены"

# ============================================================================
# 7. Настройка Nginx
# ============================================================================
log_info "Настройка Nginx..."

cat > /etc/nginx/sites-available/duty-schedule <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    root $WEB_ROOT;
    index index.html;

    # Максимальный размер запроса
    client_max_body_size 10M;

    # Сжатие
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Кеширование статики
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # PHP API
    location /api/ {
        try_files \$uri \$uri/ /api/index.php?\$query_string;

        location ~ \.php\$ {
            include snippets/fastcgi-php.conf;
            fastcgi_pass unix:/run/php/php8.1-fpm.sock;
            fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
            include fastcgi_params;
        }
    }

    # SPA fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Защита конфигурации
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    location ~ /api/config\.php\$ {
        deny all;
    }

    # Логи
    access_log /var/log/nginx/duty-schedule.access.log;
    error_log /var/log/nginx/duty-schedule.error.log;
}
EOF

# Активация сайта
ln -sf /etc/nginx/sites-available/duty-schedule /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Проверка конфигурации
if nginx -t; then
    log_success "Конфигурация Nginx корректна"
else
    log_error "Ошибка в конфигурации Nginx"
    exit 1
fi

# Перезапуск Nginx
systemctl restart nginx
systemctl enable nginx

log_success "Nginx настроен и запущен"

# ============================================================================
# 8. Настройка PHP-FPM
# ============================================================================
log_info "Настройка PHP-FPM..."

systemctl restart php8.1-fpm
systemctl enable php8.1-fpm

log_success "PHP-FPM настроен и запущен"

# ============================================================================
# 9. Настройка Firewall (UFW)
# ============================================================================
log_info "Настройка firewall..."

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

log_success "Firewall настроен"

# ============================================================================
# 10. Проверка работоспособности
# ============================================================================
log_info "Проверка работоспособности..."

sleep 2

# Проверка сервисов
if systemctl is-active --quiet nginx; then
    log_success "Nginx работает"
else
    log_error "Nginx не запущен!"
fi

if systemctl is-active --quiet php8.1-fpm; then
    log_success "PHP-FPM работает"
else
    log_error "PHP-FPM не запущен!"
fi

if systemctl is-active --quiet mysql; then
    log_success "MySQL работает"
else
    log_error "MySQL не запущен!"
fi

# Проверка API
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/doctors.php || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    log_success "API отвечает корректно (HTTP $HTTP_CODE)"
else
    log_warning "API не отвечает (HTTP $HTTP_CODE)"
fi

# ============================================================================
# 11. Создание скрипта резервного копирования
# ============================================================================
log_info "Создание скрипта резервного копирования..."

mkdir -p /opt/scripts
mkdir -p /opt/backups/duty-schedule

cat > /opt/scripts/backup-duty-schedule.sh <<'BACKUP_EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/duty-schedule"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="duty_schedule"
DB_USER="duty_user"
DB_PASS="DB_PASSWORD_PLACEHOLDER"

mkdir -p $BACKUP_DIR

# Дамп базы данных
mysqldump -u$DB_USER -p$DB_PASS \
    --single-transaction \
    --routines --triggers \
    $DB_NAME | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Удалить бэкапы старше 30 дней
find $BACKUP_DIR -type f -mtime +30 -delete

echo "Бэкап создан: $BACKUP_DIR/db_$DATE.sql.gz"
BACKUP_EOF

# Замена пароля в скрипте
sed -i "s/DB_PASSWORD_PLACEHOLDER/$DB_PASS/g" /opt/scripts/backup-duty-schedule.sh
chmod +x /opt/scripts/backup-duty-schedule.sh

# Добавление в cron
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/scripts/backup-duty-schedule.sh >> /var/log/duty-schedule-backup.log 2>&1") | crontab -

log_success "Скрипт резервного копирования создан и добавлен в cron (ежедневно в 3:00)"

# ============================================================================
# 12. Сохранение учётных данных
# ============================================================================
cat > /root/duty-schedule-credentials.txt <<EOF
================================================================
График дежурств врачей - Учётные данные
================================================================
Дата установки: $(date)
Домен: $DOMAIN

База данных:
  Имя: $DB_NAME
  Пользователь: $DB_USER
  Пароль: $DB_PASS

Файлы сайта: $WEB_ROOT
Конфигурация API: $WEB_ROOT/api/config.php

Резервные копии: /opt/backups/duty-schedule
Скрипт бэкапа: /opt/scripts/backup-duty-schedule.sh

Логи:
  Nginx: /var/log/nginx/duty-schedule.*
  PHP: /var/log/php8.1-fpm.log
  MySQL: /var/log/mysql/error.log

Полезные команды:
  systemctl status nginx
  systemctl status php8.1-fpm
  systemctl status mysql
  tail -f /var/log/nginx/duty-schedule.error.log
  mysql -u$DB_USER -p$DB_PASS $DB_NAME
================================================================
EOF

chmod 600 /root/duty-schedule-credentials.txt

# ============================================================================
# 13. Финальная информация
# ============================================================================
echo ""
echo "========================================================================"
echo "  ✅ Развёртывание завершено успешно!"
echo "========================================================================"
echo ""
echo "📍 Адрес сайта:"
if [ "$DOMAIN" = "localhost" ]; then
    echo "   http://localhost"
else
    echo "   http://$DOMAIN"
    echo "   https://$DOMAIN (после настройки SSL)"
fi
echo ""
echo "🔐 Учётные данные сохранены в:"
echo "   /root/duty-schedule-credentials.txt"
echo ""
echo "📁 Файлы сайта:"
echo "   $WEB_ROOT"
echo ""
echo "💾 Резервное копирование:"
echo "   Скрипт: /opt/scripts/backup-duty-schedule.sh"
echo "   Бэкапы: /opt/backups/duty-schedule/"
echo "   Расписание: ежедневно в 3:00"
echo ""
echo "📋 Полезные команды:"
echo "   systemctl status nginx              # Статус Nginx"
echo "   systemctl status php8.1-fpm         # Статус PHP-FPM"
echo "   systemctl status mysql              # Статус MySQL"
echo "   tail -f /var/log/nginx/duty-schedule.error.log  # Логи Nginx"
echo "   /opt/scripts/backup-duty-schedule.sh  # Создать бэкап вручную"
echo ""

if [ "$DOMAIN" != "localhost" ]; then
    echo "🔒 Рекомендуется настроить SSL:"
    echo "   sudo apt install certbot python3-certbot-nginx"
    echo "   sudo certbot --nginx -d $DOMAIN"
    echo ""
fi

echo "⚠️  ВАЖНО:"
echo "   1. Сохраните файл /root/duty-schedule-credentials.txt в надёжном месте!"
echo "   2. Удалите его после сохранения пароля:"
echo "      rm /root/duty-schedule-credentials.txt"
echo ""
echo "========================================================================"
