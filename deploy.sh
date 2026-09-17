#!/bin/bash
# ============================================================
# Скрипт быстрого развёртывания "График дежурств врачей"
# Для Ubuntu/Debian с Nginx + PHP + MySQL
# ============================================================

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функции
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Проверка прав root
if [ "$EUID" -ne 0 ]; then
    log_error "Этот скрипт должен быть запущен с правами root (sudo)"
    exit 1
fi

# Конфигурация
DOMAIN=${1:-"localhost"}
DB_NAME="duty_schedule"
DB_USER="duty_user"
DB_PASS=$(openssl rand -base64 16)
WEB_ROOT="/var/www/duty-schedule"

echo ""
echo "=========================================="
echo "  Развёртывание: График дежурств врачей"
echo "=========================================="
echo ""
echo "Домен: $DOMAIN"
echo "База данных: $DB_NAME"
echo "Пользователь БД: $DB_USER"
echo "Пароль БД: $DB_PASS"
echo "Директория: $WEB_ROOT"
echo ""
read -p "Продолжить? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# ============================================================
# 1. Установка зависимостей
# ============================================================
log_info "Установка зависимостей..."
apt update
apt install -y \
    nginx \
    mysql-server \
    php8.1-fpm \
    php8.1-mysql \
    php8.1-mbstring \
    php8.1-xml \
    php8.1-curl \
    unzip \
    curl

log_success "Зависимости установлены"

# ============================================================
# 2. Настройка MySQL
# ============================================================
log_info "Настройка базы данных MySQL..."

# Запустить MySQL, если не запущен
systemctl start mysql
systemctl enable mysql

# Создать базу данных и пользователя
mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
EOF

# Импортировать схему
if [ -f "backend/database/schema.sql" ]; then
    mysql -u root $DB_NAME < backend/database/schema.sql
    log_success "Схема БД импортирована"
else
    log_warning "Файл schema.sql не найден, пропуск импорта"
fi

# ============================================================
# 3. Создание директории и копирование файлов
# ============================================================
log_info "Создание директории и копирование файлов..."

mkdir -p $WEB_ROOT/api

# Копировать фронтенд (если есть dist/)
if [ -d "dist" ]; then
    cp -r dist/* $WEB_ROOT/
    log_success "Фронтенд скопирован"
else
    log_warning "Папка dist/ не найдена. Сначала выполните: npm run build"
fi

# Копировать бекенд
if [ -d "backend/api" ]; then
    cp -r backend/api/* $WEB_ROOT/api/
    log_success "Бекенд скопирован"
else
    log_warning "Папка backend/api/ не найдена"
fi

# ============================================================
# 4. Настройка конфигурации API
# ============================================================
log_info "Настройка конфигурации API..."

cat > $WEB_ROOT/api/config.php <<EOF
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
        ],
    ],
    'debug' => false,
];
EOF

# Установить права
chown -R www-data:www-data $WEB_ROOT
chmod -R 755 $WEB_ROOT
chmod 600 $WEB_ROOT/api/config.php

log_success "Конфигурация настроена"

# ============================================================
# 5. Настройка Nginx
# ============================================================
log_info "Настройка Nginx..."

cat > /etc/nginx/sites-available/duty-schedule <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    root $WEB_ROOT;
    index index.html;

    client_max_body_size 10M;

    # Сжатие
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 1000;

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
    location ~ /\\. {
        deny all;
    }

    location ~ /api/config\\.php\$ {
        deny all;
    }

    # Логи
    access_log /var/log/nginx/duty-schedule.access.log;
    error_log /var/log/nginx/duty-schedule.error.log;
}
EOF

# Активировать сайт
ln -sf /etc/nginx/sites-available/duty-schedule /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Проверить конфигурацию
nginx -t

# Перезагрузить Nginx
systemctl restart nginx
systemctl enable nginx

log_success "Nginx настроен"

# ============================================================
# 6. Настройка PHP-FPM
# ============================================================
log_info "Настройка PHP-FPM..."

systemctl restart php8.1-fpm
systemctl enable php8.1-fpm

log_success "PHP-FPM настроен"

# ============================================================
# 7. Настройка firewall (если UFW активен)
# ============================================================
if command -v ufw &> /dev/null; then
    log_info "Настройка firewall..."
    ufw allow 'Nginx Full'
    ufw --force enable
    log_success "Firewall настроен"
else
    log_warning "UFW не установлен, пропуск настройки firewall"
fi

# ============================================================
# 8. Проверка работоспособности
# ============================================================
log_info "Проверка работоспособности..."

sleep 2

# Проверить Nginx
if systemctl is-active --quiet nginx; then
    log_success "Nginx работает"
else
    log_error "Nginx не запущен!"
fi

# Проверить PHP-FPM
if systemctl is-active --quiet php8.1-fpm; then
    log_success "PHP-FPM работает"
else
    log_error "PHP-FPM не запущен!"
fi

# Проверить MySQL
if systemctl is-active --quiet mysql; then
    log_success "MySQL работает"
else
    log_error "MySQL не запущен!"
fi

# Проверить API
if curl -s -o /dev/null -w "%{http_code}" http://localhost/api/doctors.php | grep -q "200"; then
    log_success "API отвечает"
else
    log_warning "API не отвечает (возможно, требуется время для запуска)"
fi

# ============================================================
# Итоговая информация
# ============================================================
echo ""
echo "=========================================="
echo "  ✅ Развёртывание завершено!"
echo "=========================================="
echo ""
echo "📍 Адрес: http://$DOMAIN"
echo ""
echo "🔐 Доступ к базе данных:"
echo "   Хост: localhost"
echo "   База: $DB_NAME"
echo "   Пользователь: $DB_USER"
echo "   Пароль: $DB_PASS"
echo ""
echo "📁 Файлы размещены в: $WEB_ROOT"
echo ""
echo "📋 Полезные команды:"
echo "   systemctl status nginx"
echo "   systemctl status php8.1-fpm"
echo "   systemctl status mysql"
echo "   tail -f /var/log/nginx/duty-schedule.error.log"
echo ""
echo "🔒 Рекомендуется:"
echo "   1. Настроить SSL: certbot --nginx -d $DOMAIN"
echo "   2. Сохраните пароль БД в надёжное место!"
echo "   3. Настройте резервное копирование"
echo ""

# Сохранить учётные данные
cat > /root/duty-schedule-credentials.txt <<EOF
График дежурств врачей - Учётные данные
========================================
Дата установки: $(date)
Домен: $DOMAIN

База данных:
  Имя: $DB_NAME
  Пользователь: $DB_USER
  Пароль: $DB_PASS

Файлы: $WEB_ROOT
EOF

chmod 600 /root/duty-schedule-credentials.txt
log_success "Учётные данные сохранены в /root/duty-schedule-credentials.txt"

echo "⚠️  ВАЖНО: Сохраните файл /root/duty-schedule-credentials.txt в надёжном месте!"
echo ""
