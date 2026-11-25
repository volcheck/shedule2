# 🏢 Развёртывание в интранете (без SSL)

Пошаговое руководство по развёртыванию «Графика дежурств врачей» в корпоративной сети без использования SSL-сертификатов.

## 📋 Особенности интранет-развёртывания

- ✅ HTTP только (без HTTPS)
- ✅ Работа по IP-адресу или внутреннему имени хоста
- ✅ Упрощённая настройка firewall
- ✅ Опциональное обновление системы
- ✅ Поддержка нестандартных портов
- ✅ Автоматическое резервное копирование
- ✅ Готово к работе за корпоративным прокси

## 🎯 Быстрый старт

### Вариант 1: Автоопределение (рекомендуется)

```bash
# Скрипт сам определит IP-адрес сервера
sudo bash deploy-intranet.sh
```

### Вариант 2: Указать IP-адрес

```bash
sudo bash deploy-intranet.sh --host=192.168.1.100
```

### Вариант 3: Указать внутреннее имя

```bash
sudo bash deploy-intranet.sh --host=duty.med.local
```

### Вариант 4: Нестандартный порт

```bash
sudo bash deploy-intranet.sh --host=medserver --port=8080
```

## 📖 Все опции скрипта

| Опция | Описание | По умолчанию |
|-------|----------|--------------|
| `--host=HOSTNAME` | Имя хоста или IP-адрес | Автоопределение |
| `--port=PORT` | Порт веб-сервера | `80` |
| `--no-firewall` | Не настраивать UFW | Настраивается |
| `--no-update` | Не обновлять систему | Обновляется |
| `--db-pass=PASS` | Задать пароль БД | Генерируется |
| `--help` | Показать справку | — |

## 🏗️ Что делает скрипт

### 1. Подготовка системы
- (Опционально) Обновление списка пакетов
- Установка Nginx, PHP 8.1+, MySQL 8.0
- Установка необходимых PHP-расширений

### 2. Настройка базы данных
- Создание БД `duty_schedule`
- Создание пользователя `duty_user`
- Генерация случайного пароля (или использование указанного)
- Импорт схемы из `backend/database/schema.sql`

### 3. Размещение файлов
- Копирование фронтенда из `dist/`
- Копирование бекенда из `backend/api/`
- Генерация конфигурации `api/config.php`

### 4. Настройка прав
- Владелец: `www-data` (или `apache`)
- Директории: `755`, файлы: `644`
- Конфигурация API: `600`

### 5. Настройка Nginx
- Виртуальный хост на указанном порту
- SPA fallback для фронтенда
- Проксирование PHP через FPM
- Сжатие gzip
- Кеширование статики (7 дней)
- Статус-страница для мониторинга

### 6. Firewall (опционально)
- Открытие порта SSH
- Открытие порта веб-сервера
- Активация UFW

### 7. Резервное копирование
- Скрипт `/opt/scripts/backup-duty-schedule.sh`
- Cron-задание ежедневно в 2:00
- Хранение бэкапов 60 дней

## 🌐 Доступ для пользователей

### Способ 1: По IP-адресу

Сообщите пользователям адрес:
```
http://192.168.1.100
```

### Способ 2: По внутреннему имени

1. Добавьте запись в DNS-сервер организации:
   ```
   duty.med.local.  IN  A  192.168.1.100
   ```

2. Или добавьте в hosts-файлы компьютеров пользователей:
   ```
   # Windows: C:\Windows\System32\drivers\etc\hosts
   # Linux/Mac: /etc/hosts
   192.168.1.100  duty.med.local
   ```

3. Пользователи смогут обращаться по адресу:
   ```
   http://duty.med.local
   ```

### Способ 3: Через корпоративный прокси

Если в организации используется прокси-сервер, добавьте адрес в исключения:

**Для Squid:**
```
acl intranet_apps dstdomain duty.med.local
always_direct allow intranet_apps
```

**Для пользователей браузера:**
Добавьте адрес в исключения прокси:
- Chrome: `chrome://settings/system` → «Открыть настройки прокси»
- Firefox: Настройки → Сетевые настройки → Без прокси для: `duty.med.local`

## 🔧 Настройка после развёртывания

### Проверка работоспособности

```bash
# Статус сервисов
sudo systemctl status nginx
sudo systemctl status php8.1-fpm
sudo systemctl status mysql

# Проверка API
curl http://localhost/api/doctors.php

# Логи
sudo tail -f /var/log/nginx/duty-schedule.error.log
```

### Изменение порта

```bash
# Отредактировать конфигурацию Nginx
sudo nano /etc/nginx/sites-available/duty-schedule

# Изменить listen 80; на listen 8080;

# Перезапустить Nginx
sudo systemctl reload nginx

# Обновить firewall
sudo ufw allow 8080/tcp
```

### Добавление дополнительных разрешённых адресов

Если нужно разрешить доступ только из определённых подсетей:

```bash
sudo nano /etc/nginx/sites-available/duty-schedule
```

Добавить в блок `server`:
```nginx
# Разрешить только из корпоративной сети
allow 192.168.1.0/24;
allow 10.0.0.0/8;
deny all;
```

Перезапустить Nginx:
```bash
sudo systemctl reload nginx
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
sudo gunzip /opt/backups/duty-schedule/db_20240115_020000.sql.gz

# Восстановить БД
sudo mysql -u duty_user -p duty_schedule < /opt/backups/duty-schedule/db_20240115_020000.sql
```

### Изменение расписания бэкапов

```bash
sudo crontab -e
```

Примеры:
```cron
# Каждый день в 2:00 (по умолчанию)
0 2 * * * /opt/scripts/backup-duty-schedule.sh

# Каждые 6 часов
0 */6 * * * /opt/scripts/backup-duty-schedule.sh

# Каждый понедельник в 3:00
0 3 * * 1 /opt/scripts/backup-duty-schedule.sh
```

## 🔄 Обновление приложения

Используйте скрипт `update.sh`:

```bash
sudo bash update.sh
```

Или вручную:

```bash
cd /opt/duty-schedule
git pull origin main
npm install
npm run build
sudo cp -r dist/* /var/www/duty-schedule/
sudo systemctl reload nginx
```

## 🛠️ Устранение неполадок

### Проблема: Сайт не открывается

**Проверка:**
```bash
# Работает ли Nginx?
sudo systemctl status nginx

# Слушает ли порт?
sudo netstat -tlnp | grep :80

# Логи
sudo tail -f /var/log/nginx/duty-schedule.error.log
```

**Решение:**
```bash
sudo systemctl restart nginx
```

### Проблема: 502 Bad Gateway

**Причина:** PHP-FPM не запущен

**Решение:**
```bash
sudo systemctl restart php8.1-fpm
```

### Проблема: API не отвечает

**Проверка:**
```bash
# Работает ли MySQL?
sudo systemctl status mysql

# Подключение к БД
mysql -u duty_user -p duty_schedule
```

**Решение:**
```bash
sudo systemctl restart mysql
sudo systemctl restart php8.1-fpm
```

### Проблема: Доступ только с localhost

**Причина:** Firewall блокирует внешние подключения

**Решение:**
```bash
# Проверить статус firewall
sudo ufw status

# Открыть порт
sudo ufw allow 80/tcp
# или для нестандартного порта
sudo ufw allow 8080/tcp
```

### Проблема: Корпоративный прокси блокирует доступ

**Решение:**
1. Обратитесь к системному администратору
2. Попросите добавить адрес в исключения прокси
3. Или настройте прямой доступ в браузере пользователя

## 📊 Мониторинг

### Статус-страница Nginx

Доступна по адресу:
```
http://ваш-сервер/server-status
```

Показывает:
- Активные соединения
- Обработанные запросы
- Нагрузку на сервер

### Проверка доступности

Скрипт для мониторинга (можно добавить в cron):

```bash
#!/bin/bash
# /opt/scripts/check-duty-schedule.sh

URL="http://duty.med.local/api/doctors.php"
EMAIL="admin@med.local"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL")

if [ "$HTTP_CODE" != "200" ]; then
    echo "ВНИМАНИЕ: График дежурств недоступен! HTTP $HTTP_CODE" | \
    mail -s "Алерт: График дежурств" "$EMAIL"
fi
```

```bash
# Проверка каждые 5 минут
*/5 * * * * /opt/scripts/check-duty-schedule.sh
```

## 🔒 Безопасность в интранете

Несмотря на отсутствие SSL, рекомендуется:

1. **Ограничить доступ по IP**
   ```nginx
   allow 192.168.1.0/24;
   deny all;
   ```

2. **Регулярно обновлять систему**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

3. **Защитить конфигурацию**
   ```bash
   sudo chmod 600 /var/www/duty-schedule/api/config.php
   ```

4. **Делать резервные копии**
   - Ежедневные автоматические бэкапы уже настроены
   - Проверяйте их целостность раз в месяц

5. **Мониторить логи**
   ```bash
   sudo tail -f /var/log/nginx/duty-schedule.access.log
   ```

## 📁 Структура файлов на сервере

```
/var/www/duty-schedule/
├── index.html              # Точка входа SPA
├── assets/                 # JS, CSS
└── api/
    ├── config.php          # Конфигурация (chmod 600)
    ├── doctors.php         # API врачей
    └── schedule.php        # API графика

/opt/scripts/
└── backup-duty-schedule.sh # Скрипт бэкапа

/opt/backups/duty-schedule/
└── db_YYYYMMDD_HHMMSS.sql.gz

/etc/nginx/sites-available/
└── duty-schedule           # Конфигурация Nginx

/root/
└── duty-schedule-credentials.txt  # Учётные данные
```

## 📞 Поддержка

При возникновении проблем:

1. Проверьте логи: `sudo tail -f /var/log/nginx/duty-schedule.error.log`
2. Убедитесь, что все сервисы запущены
3. Проверьте сетевую доступность: `ping ваш-сервер`
4. Обратитесь к системному администратору для проверки прокси/firewall

## 🎓 Отличия от публичного развёртывания

| Параметр | Публичное | Интранет |
|----------|-----------|----------|
| SSL | Обязательно | Не требуется |
| Домен | Публичный DNS | Внутренний DNS/IP |
| Firewall | Строгий | Упрощённый |
| Порт | 80/443 | Любой |
| Обновление системы | Обязательно | Опционально |
| Резервное копирование | 30 дней | 60 дней |
| Мониторинг | Внешний | Внутренний |

---

**Успешного развёртывания в вашей организации!** 🏥
