# 🚀 Инструкция по развёртыванию на Ubuntu

## 📋 Требования

- **ОС:** Ubuntu 20.04, 22.04 или 24.04 LTS
- **Права:** root или sudo
- **Память:** минимум 1 GB RAM
- **Диск:** минимум 2 GB свободного места
- **Сеть:** открытый порт 80 (HTTP) и 443 (HTTPS)

## 🎯 Быстрое развёртывание

### 1. Подготовка сервера

```bash
# Обновить систему
sudo apt update && sudo apt upgrade -y

# Установить git (если не установлен)
sudo apt install -y git
```

### 2. Клонирование репозитория

```bash
# Клонировать проект
git clone <url-репозитория> duty-schedule
cd duty-schedule
```

### 3. Сборка фронтенда

```bash
# Установить Node.js (если не установлен)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Установить зависимости
npm install

# Собрать продакшн-версию
npm run build
```

### 4. Запуск скрипта развёртывания

```bash
# Сделать скрипт исполняемым
chmod +x deploy.sh

# Запустить развёртывание на localhost
sudo bash deploy.sh

# Или на конкретном домене
sudo bash deploy.sh duty.example.com
```

### 5. Проверка

Откройте браузер и перейдите по адресу:
- `http://localhost` (если развёртывали на localhost)
- `http://ваш-домен.ru` (если указали домен)

## 📖 Подробное описание скрипта

Скрипт `deploy.sh` автоматически выполняет следующие действия:

### ✅ Устанавливает и настраивает:

1. **Системные пакеты**
   - Nginx (веб-сервер)
   - MySQL 8.0 (база данных)
   - PHP 8.1 + расширения (FPM, MySQL, mbstring, xml, curl, zip)
   - UFW (firewall)

2. **База данных**
   - Создаёт базу данных `duty_schedule`
   - Создаёт пользователя `duty_user` с случайным паролем
   - Импортирует схему из `backend/database/schema.sql`

3. **Файлы приложения**
   - Копирует фронтенд из `dist/` в `/var/www/duty-schedule/`
   - Копирует бекенд из `backend/api/` в `/var/www/duty-schedule/api/`
   - Генерирует конфигурацию `api/config.php` с учётными данными БД

4. **Права доступа**
   - Владелец: `www-www-data`
   - Директории: 755
   - Файлы: 644
   - Конфигурация API: 600 (только для root)

5. **Nginx**
   - Создаёт виртуальный хост
   - Настраивает SPA fallback
   - Настраивает проксирование PHP
   - Включает сжатие gzip
   - Настраивает кеширование статики

6. **Firewall (UFW)**
   - Открывает порты 22 (SSH), 80 (HTTP), 443 (HTTPS)
   - Активирует firewall

7. **Резервное копирование**
   - Создаёт скрипт `/opt/scripts/backup-duty-schedule.sh`
   - Добавляет задание в cron (ежедневно в 3:00)
   - Хранит бэкапы в `/opt/backups/duty-schedule/`
   - Автоматически удаляет бэкапы старше 30 дней

8. **Учётные данные**
   - Сохраняет все пароли в `/root/duty-schedule-credentials.txt`
   - Устанавливает права 600 (только для root)

## 🔐 Настройка SSL (HTTPS)

После развёртывания рекомендуется настроить SSL-сертификат:

```bash
# Установить Certbot
sudo apt install -y certbot python3-certbot-nginx

# Получить сертификат
sudo certbot --nginx -d ваш-домен.ru

# Проверить автопродление
sudo certbot renew --dry-run
```

Certbot автоматически настроит перенаправление HTTP → HTTPS.

## 🔄 Обновление приложения

Для обновления приложения используйте скрипт `update.sh`:

```bash
# Сделать скрипт исполняемым
chmod +x update.sh

# Запустить обновление
sudo bash update.sh
```

Или вручную:

```bash
# Перейти в директорию проекта
cd /opt/duty-schedule

# Обновить код из git
git pull origin main

# Пересобрать фронтенд
npm install
npm run build

# Скопировать новые файлы
sudo cp -r dist/* /var/www/duty-schedule/

# Перезагрузить Nginx (опционально)
sudo systemctl reload nginx
```

## 📊 Мониторинг

### Проверка статуса сервисов

```bash
sudo systemctl status nginx
sudo systemctl status php8.1-fpm
sudo systemctl status mysql
```

### Просмотр логов

```bash
# Логи Nginx
sudo tail -f /var/log/nginx/duty-schedule.error.log
sudo tail -f /var/log/nginx/duty-schedule.access.log

# Логи PHP
sudo tail -f /var/log/php8.1-fpm.log

# Логи MySQL
sudo tail -f /var/log/mysql/error.log
```

### Проверка базы данных

```bash
# Войти в MySQL
mysql -u duty_user -p duty_schedule

# Посмотреть размер базы
SELECT table_name,
       ROUND((data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)'
FROM information_schema.tables
WHERE table_schema = 'duty_schedule';

# Количество записей
SELECT COUNT(*) FROM doctors;
SELECT COUNT(*) FROM schedule_entries;
```

## 💾 Резервное копирование

### Ручное создание бэкапа

```bash
sudo /opt/scripts/backup-duty-schedule.sh
```

### Просмотр бэкапов

```bash
ls -lh /opt/backups/duty-schedule/
```

### Восстановление из бэкапа

```bash
# Распаковать дамп
gunzip /opt/backups/duty-schedule/db_20240115_030000.sql.gz

# Восстановить базу данных
mysql -u duty_user -p duty_schedule < /opt/backups/duty-schedule/db_20240115_030000.sql
```

## 🛠️ Устранение неполадок

### Проблема: 502 Bad Gateway

**Решение:**
```bash
sudo systemctl restart php8.1-fpm
sudo systemctl restart nginx
```

### Проблема: Белый экран

**Решение:**
```bash
# Проверить логи PHP
sudo tail -f /var/log/php8.1-fpm.log

# Включить отображение ошибок (временно)
sudo nano /etc/php/8.1/fpm/php.ini
# Установить: display_errors = On
sudo systemctl restart php8.1-fpm
```

### Проблема: API не отвечает

**Решение:**
```bash
# Проверить конфигурацию
sudo cat /var/www/duty-schedule/api/config.php

# Проверить подключение к БД
mysql -u duty_user -p duty_schedule

# Проверить права доступа
sudo ls -la /var/www/duty-schedule/api/
```

### Проблема: CORS ошибки

**Решение:**
```bash
# Отредактировать конфигурацию
sudo nano /var/www/duty-schedule/api/config.php

# Добавить домен в allowed_origins
'cors' => [
    'allowed_origins' => [
        'http://ваш-домен.ru',
        'https://ваш-домен.ru',
    ],
],
```

## 📁 Структура файлов на сервере

```
/var/www/duty-schedule/
├── index.html              # Точка входа SPA
├── assets/
│   ├── index-XXXXX.js      # JS-бандл
│   └── index-XXXXX.css     # CSS-бандл
└── api/
    ├── config.php          # Конфигурация БД (chmod 600)
    ├── doctors.php         # API для врачей
    ├── schedule.php        # API для графика
    └── .htaccess           # Защита конфигурации

/opt/scripts/
└── backup-duty-schedule.sh # Скрипт резервного копирования

/opt/backups/duty-schedule/
└── db_YYYYMMDD_HHMMSS.sql.gz  # Бэкапы базы данных

/root/
└── duty-schedule-credentials.txt  # Учётные данные (chmod 600)
```

## 🔒 Безопасность

### Рекомендации:

1. **Измените пароль root** после установки
2. **Настройте SSH-ключи** и отключите аутентификацию по паролю
3. **Обновляйте систему** регулярно: `sudo apt update && sudo apt upgrade`
4. **Удалите файл с учётными данными** после сохранения пароля:
   ```bash
   sudo rm /root/duty-schedule-credentials.txt
   ```
5. **Настройте SSL** (Let's Encrypt) для шифрования трафика
6. **Ограничьте доступ к API** по IP (при необходимости)
7. **Делайте регулярные бэкапы** и проверяйте их восстановление

### Проверка безопасности:

```bash
# Проверить открытые порты
sudo ufw status

# Проверить запущенные сервисы
sudo systemctl list-units --type=service --state=running

# Проверить права на конфигурацию
sudo ls -la /var/www/duty-schedule/api/config.php
```

## 📞 Поддержка

При возникновении проблем:

1. Проверьте логи (раздел "Мониторинг")
2. Убедитесь, что все сервисы запущены
3. Проверьте права доступа к файлам
4. Проверьте конфигурацию БД в `api/config.php`

## 🎓 Дополнительные ресурсы

- [Документация по развёртыванию](README_DEPLOY.md)
- [Инструкция по обновлению](UPDATE.md)
- [Руководство по безопасности](SECURITY.md)

---

**Успешного развёртывания!** 🚀
