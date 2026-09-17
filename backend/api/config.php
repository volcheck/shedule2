<?php
/**
 * Конфигурация приложения "График дежурств врачей"
 *
 * ВНИМАНИЕ: этот файл содержит конфиденциальные данные!
 * Установите права: chmod 600 config.php
 */

return [
    // Настройки подключения к MySQL
    'db' => [
        'host'     => getenv('DB_HOST') ?: 'localhost',
        'port'     => getenv('DB_PORT') ?: 3306,
        'dbname'   => getenv('DB_NAME') ?: 'duty_schedule',
        'username' => getenv('DB_USER') ?: 'duty_user',
        'password' => getenv('DB_PASS') ?: '',
        'charset'  => 'utf8mb4',
    ],

    // CORS-настройки
    'cors' => [
        'allowed_origins' => [
            'http://localhost',
            'http://localhost:3000',
            // Добавьте свой домен:
            // 'https://ваш-домен.ru',
        ],
    ],

    // Режим отладки (отключить в продакшне!)
    'debug' => (bool) getenv('APP_DEBUG'),
];
