# 🏥 График дежурств врачей — Инструкция по развёртыванию

## 📋 Содержание

1. [Обзор архитектуры](#1-обзор-архитектуры)
2. [Варианты развёртывания](#2-варианты-развёртывания)
3. [Вариант A: Только фронтенд (статический сайт)](#3-вариант-a-только-фронтенд-статический-сайт)
4. [Вариант B: Полный стек (фронтенд + PHP + MySQL)](#4-вариант-b-полный-стек-фронтенд--php--mysql)
5. [Настройка веб-сервера Nginx](#5-настройка-веб-сервера-nginx)
6. [Настройка веб-сервера Apache](#6-настройка-веб-сервера-apache)
7. [Настройка SSL/TLS сертификата](#7-настройка-ssltls-сертификата)
8. [Обновление приложения](#8-обновление-приложения)
9. [Резервное копирование](#9-резервное-копирование)
10. [Мониторинг и устранение неполадок](#10-мониторинг-и-устранение-неполадок)

---

## 1. Обзор архитектуры

```
┌─────────────────────────────────────────────────────────────┐
│                     Браузер пользователя                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  React SPA (HTML + CSS + JS)                           │  │
│  │  • График дежурств (таблица)                           │  │
│  │  • Drag-and-drop (перетаскивание врачей)               │  │
│  │  • Экспорт в Word / PDF / Буфер обмена                 │  │
│  │  • Расчёт нагрузки в часах                             │  │
│  └──────────────────────┬────────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────────┘
                          │ HTTP/HTTPS
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Веб-сервер                              │
│           (Nginx / Apache / Caddy)                           │
│                                                              │
│   /var/www/duty-schedule/                                    │
│   ├── index.html              (SPA entry point)              │
│   ├── assets/                 (JS, CSS bundles)              │
│   └── api/                    (PHP backend, опционально)     │
│       ├── config.php          (настройки БД)                 │
│       ├── doctors.php         (CRUD врачей)                  │
│       ├── schedule.php        (CRUD графика)                 │
│       └── .htaccess           (rewrites для Apache)          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    MySQL / MariaDB                           │
│   • Таблица doctors (список врачей)                          │
│   • Таблица schedule_entries (записи графика)                │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Варианты развёртывания

| Вариант | Описание | Когда использовать |
|---------|----------|--------------------|
| **A. Только фронтенд** | Статический сайт, данные в localStorage браузера | Быстрый старт, демо, локальная сеть |
| **B. Полный стек** | Фронтенд + PHP API + MySQL | Продакшн, многопользовательский доступ |

---

## 3. Вариант A: Только фронтенд (статический сайт)

### 3.1 Требования

- Node.js 18+ и npm (для сборки)
- Любой веб-сервер (Nginx, Apache, Caddy) или хостинг статических сайтов

### 3.2 Сборка проекта

```bash
# Клонировать репозиторий
git clone <url-репозитория>
cd duty-schedule

# Установить зависимости
npm install

# Собрать продакшн-версию
npm run build
```

Результат сборки появится в папке `dist/`.

### 3.3 Развёртывание

Скопируйте содержимое папки `dist/` в корневую директорию веб-сервера:

```bash
# Пример для Nginx
sudo cp -r dist/* /var/www/duty-schedule/

# Установить права
sudo chown -R www-data:www-data /var/www/duty-schedule/
sudo chmod -R 755 /var/www/duty-schedule/
```

### 3.4 Альтернативные площадки

| Площадка | Команда / Действие |
|----------|-------------------|
| **Netlify** | Перетащите папку `dist/` на [app.netlify.com/drop](https://app.netlify.com/drop) |
| **Vercel** | `npx vercel --prod` из корня проекта |
| **GitHub Pages** | Запушьте папку `dist/` в ветку `gh-pages` |
| **Cloudflare Pages** | Подключите репозиторий, build command: `npm run build`, output: `dist` |

> ⚠️ **Важно:** при таком развёртывании данные хранятся в localStorage каждого браузера отдельно. Данные не синхронизируются между пользователями.

---

## 4. Вариант B: Полный стек (фронтенд + PHP + MySQL)

### 4.1 Требования

- **Сервер:** Linux (Ubuntu 22.04+ / Debian 12+ / CentOS 9+)
- **PHP:** 8.1 или выше с расширениями: `pdo`, `pdo_mysql`, `json`, `mbstring`
- **MySQL:** 8.0+ или **MariaDB** 10.6+
- **Веб-сервер:** Nginx 1.22+ или Apache 2.4+
- **Composer** (опционально, для автозагрузки)

### 4.2 Установка зависимостей на сервере (Ubuntu/Debian)

```bash
# Обновить систему
sudo apt update && sudo apt upgrade -y

# Установить веб-сервер, PHP и MySQL
sudo apt install -y nginx mysql-server php8.1-fpm php8.1-mysql \
    php8.1-mbstring php8.1-json php8.1-xml php8.1-curl

# Проверить версии
php -v       # Должна быть 8.1+
mysql --version
nginx -v
```

### 4.3 Настройка базы данных MySQL

```bash
# Войти в MySQL
sudo mysql -u root
```

```sql
-- Создать базу данных
CREATE DATABASE duty_schedule CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Создать пользователя
CREATE USER 'duty_user'@'localhost' IDENTIFIED BY 'Ваш_Надёжный_Пароль_123!';
GRANT ALL PRIVILEGES ON duty_schedule.* TO 'duty_user'@'localhost';
FLUSH PRIVILEGES;

-- Переключиться на базу
USE duty_schedule;

-- Таблица врачей
CREATE TABLE doctors (
    id CHAR(36) PRIMARY KEY,           -- UUID
    last_name VARCHAR(100) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100) DEFAULT '',
    workplace VARCHAR(255) DEFAULT '',
    color VARCHAR(7) NOT NULL DEFAULT '#3B82F6',  -- HEX-цвет
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_last_name (last_name)
) ENGINE=InnoDB;

-- Таблица записей графика
CREATE TABLE schedule_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id CHAR(36) NOT NULL,
    year SMALLINT NOT NULL,
    month TINYINT NOT NULL,            -- 1-12
    day TINYINT NOT NULL,              -- 1-31
    column_index TINYINT NOT NULL,     -- 0-7 (8 колонок)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    UNIQUE KEY unique_entry (year, month, day, column_index),
    INDEX idx_period (year, month),
    INDEX idx_doctor (doctor_id)
) ENGINE=InnoDB;

-- Проверить
SHOW TABLES;
EXIT;
```

### 4.4 Развёртывание PHP-бекенда

PHP-файлы API находятся в папке `backend/api/` этого репозитория. Скопируйте их:

```bash
# Создать директорию для API
sudo mkdir -p /var/www/duty-schedule/api

# Скопировать файлы бекенда
sudo cp -r backend/api/* /var/www/duty-schedule/api/

# Настроить подключение к БД
sudo nano /var/www/duty-schedule/api/config.php
```

Отредактируйте `config.php`:

```php
<?php
return [
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'dbname' => 'duty_schedule',
        'username' => 'duty_user',
        'password' => 'Ваш_Надёжный_Пароль_123!',
        'charset' => 'utf8mb4',
    ],
    'cors' => [
        'allowed_origins' => ['https://ваш-домен.ru'],
    ],
];
```

Установите права:

```bash
sudo chown -R www-data:www-data /var/www/duty-schedule/
sudo chmod -R 755 /var/www/duty-schedule/
sudo chmod 600 /var/www/duty-schedule/api/config.php  # Защита конфига
```

### 4.5 Переключение фронтенда на API

В файле `src/store.ts` замените localStorage-вызовы на fetch к API:

```typescript
const API_BASE = '/api';

export async function getDoctors(): Promise<Doctor[]> {
  const res = await fetch(`${API_BASE}/doctors.php`);
  return res.json();
}

export async function addDoctor(doctor: Doctor): Promise<void> {
  await fetch(`${API_BASE}/doctors.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doctor),
  });
}
// ... аналогично для остальных методов
```

Пересоберите проект:

```bash
npm run build
sudo cp -r dist/* /var/www/duty-schedule/
```

### 4.6 Тестирование API

```bash
# Проверить список врачей
curl http://localhost/api/doctors.php

# Добавить врача
curl -X POST http://localhost/api/doctors.php \
  -H "Content-Type: application/json" \
  -d '{"id":"test-uuid","lastName":"Иванов","firstName":"Иван","middleName":"Иванович","workplace":"Больница №1","color":"#3B82F6"}'

# Получить записи графика
curl "http://localhost/api/schedule.php?year=2026&month=1"
```

---

## 5. Настройка веб-сервера Nginx

### 5.1 Базовая конфигурация

```bash
sudo nano /etc/nginx/sites-available/duty-schedule
```

```nginx
server {
    listen 80;
    server_name ваш-домен.ru;
    root /var/www/duty-schedule;
    index index.html;

    # Максимальный размер тела запроса (для экспорта)
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
        try_files $uri $uri/ /api/index.php?$query_string;

        location ~ \.php$ {
            include snippets/fastcgi-php.conf;
            fastcgi_pass unix:/run/php/php8.1-fpm.sock;
            fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
            include fastcgi_params;
        }
    }

    # SPA fallback — все маршруты → index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Запрет доступа к конфигу
    location ~ /\. {
        deny all;
    }

    location ~ /api/config\.php$ {
        deny all;
    }

    # Логи
    access_log /var/log/nginx/duty-schedule.access.log;
    error_log /var/log/nginx/duty-schedule.error.log;
}
```

Активируйте сайт:

```bash
sudo ln -s /etc/nginx/sites-available/duty-schedule /etc/nginx/sites-enabled/
sudo nginx -t                    # Проверить конфигурацию
sudo systemctl reload nginx      # Перезагрузить Nginx
```

---

## 6. Настройка веб-сервера Apache

```bash
sudo apt install -y apache2 libapache2-mod-php8.1
sudo a2enmod rewrite
```

Создайте виртуальный хост:

```bash
sudo nano /etc/apache2/sites-available/duty-schedule.conf
```

```apache
<VirtualHost *:80>
    ServerName ваш-домен.ru
    DocumentRoot /var/www/duty-schedule

    <Directory /var/www/duty-schedule>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted

        # SPA fallback
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>

    # Защита конфигурации
    <Files "config.php">
        Require all denied
    </Files>

    ErrorLog ${APACHE_LOG_DIR}/duty-schedule-error.log
    CustomLog ${APACHE_LOG_DIR}/duty-schedule-access.log combined
</VirtualHost>
```

```bash
sudo a2ensite duty-schedule.conf
sudo systemctl reload apache2
```

---

## 7. Настройка SSL/TLS сертификата

### 7.1 Let's Encrypt (бесплатный сертификат)

```bash
# Установить Certbot
sudo apt install -y certbot python3-certbot-nginx   # для Nginx
# или
sudo apt install -y certbot python3-certbot-apache  # для Apache

# Получить сертификат
sudo certbot --nginx -d ваш-домен.ru
# или
sudo certbot --apache -d ваш-домен.ru

# Проверить автопродление
sudo certbot renew --dry-run
```

Certbot автоматически настроит перенаправление HTTP → HTTPS.

### 7.2 Ручная настройка (если нужно)

```nginx
# В блоке server для Nginx
listen 443 ssl http2;
ssl_certificate /etc/letsencrypt/live/ваш-домен.ru/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/ваш-домен.ru/privkey.pem;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers HIGH:!aNULL:!MD5;
ssl_prefer_server_ciphers on;
```

---

## 8. Обновление приложения

### 8.1 Скрипт автоматического обновления

Создайте файл `deploy.sh`:

```bash
#!/bin/bash
set -e

echo "🔄 Обновление графика дежурств..."

# Перейти в директорию проекта
cd /opt/duty-schedule

# Обновить код
git pull origin main

# Установить зависимости (если изменились)
npm ci

# Собрать
npm run build

# Скопировать на сервер
sudo rm -rf /var/www/duty-schedule/assets/
sudo cp -r dist/* /var/www/duty-schedule/

# Очистить кеш (опционально)
# sudo systemctl reload nginx

echo "✅ Обновление завершено!"
```

```bash
chmod +x deploy.sh
```

### 8.2 Ручное обновление

```bash
# На машине разработчика
npm run build
scp -r dist/* user@server:/var/www/duty-schedule/

# На сервере (если нужно)
sudo systemctl reload nginx
```

---

## 9. Резервное копирование

### 9.1 Скрипт бэкапа MySQL

```bash
#!/bin/bash
# /opt/scripts/backup-duty-schedule.sh

BACKUP_DIR="/opt/backups/duty-schedule"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="duty_schedule"
DB_USER="backup_user"
DB_PASS="пароль_для_бэкапа"

mkdir -p $BACKUP_DIR

# Дамп базы данных
mysqldump -u$DB_USER -p$DB_PASS \
    --single-transaction \
    --routines --triggers \
    $DB_NAME | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Бэкап файлов
tar -czf "$BACKUP_DIR/files_$DATE.tar.gz" \
    /var/www/duty-schedule/api/config.php

# Удалить бэкапы старше 30 дней
find $BACKUP_DIR -type f -mtime +30 -delete

echo "✅ Бэкап создан: $BACKUP_DIR/db_$DATE.sql.gz"
```

### 9.2 Настройка cron

```bash
# Ежедневный бэкап в 3:00 ночи
sudo crontab -e
```

```cron
0 3 * * * /opt/scripts/backup-duty-schedule.sh >> /var/log/duty-schedule-backup.log 2>&1
```

### 9.3 Восстановление из бэкапа

```bash
# Распаковать дамп
gunzip db_20260115_030000.sql.gz

# Восстановить базу
mysql -u root duty_schedule < db_20260115_030000.sql
```

---

## 10. Мониторинг и устранение неполадок

### 10.1 Проверка работоспособности

```bash
# Статус сервисов
sudo systemctl status nginx
sudo systemctl status php8.1-fpm
sudo systemctl status mysql

# Логи Nginx
sudo tail -f /var/log/nginx/duty-schedule.error.log
sudo tail -f /var/log/nginx/duty-schedule.access.log

# Логи PHP
sudo tail -f /var/log/php8.1-fpm.log

# Логи MySQL
sudo tail -f /var/log/mysql/error.log
```

### 10.2 Частые проблемы

| Проблема | Решение |
|----------|---------|
| **502 Bad Gateway** | Проверьте, запущен ли PHP-FPM: `sudo systemctl restart php8.1-fpm` |
| **Белый экран** | Проверьте логи PHP, включите `display_errors = On` в `php.ini` |
| **CORS-ошибки** | Проверьте настройки `allowed_origins` в `api/config.php` |
| **Не сохраняются данные** | Проверьте подключение к БД, права пользователя MySQL |
| **404 на /api/*** | Проверьте конфигурацию Nginx/Apache для маршрута `/api/` |
| **Медленная работа** | Проверьте нагрузку на сервер: `htop`, `mysqladmin status` |

### 10.3 Полезные команды MySQL

```sql
-- Посмотреть размер базы
SELECT table_name,
       ROUND((data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)'
FROM information_schema.tables
WHERE table_schema = 'duty_schedule';

-- Количество записей графика
SELECT year, month, COUNT(*) as entries
FROM schedule_entries
GROUP BY year, month
ORDER BY year DESC, month DESC;

-- Количество врачей
SELECT COUNT(*) FROM doctors;
```

### 10.4 Безопасность

- ✅ Используйте HTTPS (Let's Encrypt)
- ✅ Ограничьте доступ к API по IP (при необходимости)
- ✅ Регулярно обновляйте систему: `sudo apt update && sudo apt upgrade`
- ✅ Не храните пароли в коде — используйте переменные окружения
- ✅ Настройте firewall: `sudo ufw allow 80,443/tcp`
- ✅ Делайте регулярные бэкапы

---

## 📁 Структура проекта на сервере

```
/var/www/duty-schedule/
├── index.html              # Точка входа SPA
├── assets/
│   ├── index-XXXXX.js      # JS-бандл
│   └── index-XXXXX.css     # CSS-бандл
└── api/
    ├── config.php          # Конфигурация БД (chmod 600!)
    ├── doctors.php         # API: CRUD врачей
    ├── schedule.php        # API: CRUD графика
    └── .htaccess           # Rewrites для Apache
```

---

## 🚀 Быстрый старт (TL;DR)

```bash
# 1. На сервере установить зависимости
sudo apt install nginx php8.1-fpm php8.1-mysql mysql-server

# 2. Создать БД (см. раздел 4.3)

# 3. На машине разработчика собрать
npm install && npm run build

# 4. Загрузить на сервер
scp -r dist/* user@server:/var/www/duty-schedule/
scp -r backend/api/* user@server:/var/www/duty-schedule/api/

# 5. Настроить Nginx (см. раздел 5)

# 6. Настроить SSL (см. раздел 7)

# 7. Готово! Открыть https://ваш-домен.ru
```

---

**Поддержка:** при возникновении вопросов обращайтесь к логам сервера (раздел 10.1) — в 90% случаев причина ошибки видна в `error.log`.
