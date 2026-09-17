-- ============================================================
-- Схема базы данных "График дежурств врачей"
-- MySQL 8.0+ / MariaDB 10.6+
-- ============================================================

-- Создать базу данных (если не существует)
CREATE DATABASE IF NOT EXISTS duty_schedule
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE duty_schedule;

-- ============================================================
-- Таблица: doctors
-- Список врачей
-- ============================================================
CREATE TABLE IF NOT EXISTS doctors (
    id CHAR(36) PRIMARY KEY COMMENT 'UUID врача',
    last_name VARCHAR(100) NOT NULL COMMENT 'Фамилия',
    first_name VARCHAR(100) NOT NULL COMMENT 'Имя',
    middle_name VARCHAR(100) DEFAULT '' COMMENT 'Отчество',
    workplace VARCHAR(255) DEFAULT '' COMMENT 'Место работы',
    color VARCHAR(7) NOT NULL DEFAULT '#3B82F6' COMMENT 'Цвет-обозначение (HEX)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_last_name (last_name),
    INDEX idx_workplace (workplace)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Список врачей';

-- ============================================================
-- Таблица: schedule_entries
-- Записи графика дежурств
-- ============================================================
CREATE TABLE IF NOT EXISTS schedule_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id CHAR(36) NOT NULL COMMENT 'ID врача (FK → doctors.id)',
    year SMALLINT NOT NULL COMMENT 'Год',
    month TINYINT NOT NULL COMMENT 'Месяц (1-12)',
    day TINYINT NOT NULL COMMENT 'День месяца (1-31)',
    column_index TINYINT NOT NULL COMMENT 'Колонка (0-7):
        0 = Дневная смена — ответственный дежурный
        1 = Ночная смена — ответственный дежурный
        2 = Дневная смена — второй дежурный
        3 = Ночная смена — второй дежурный
        4 = Дневная смена — третий дежурный
        5 = Ночная смена — третий дежурный
        6 = Дневная смена — врач приёмного отделения
        7 = Ночная смена — врач приёмного отделения',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE KEY unique_entry (year, month, day, column_index) COMMENT 'Один врач на ячейку',
    INDEX idx_period (year, month) COMMENT 'Быстрый поиск по месяцу',
    INDEX idx_doctor (doctor_id) COMMENT 'Быстрый поиск по врачу',
    INDEX idx_doctor_period (doctor_id, year, month) COMMENT 'Расчёт нагрузки'
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Записи графика дежурств';

-- ============================================================
-- Таблица: users (опционально, для аутентификации)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'editor', 'viewer') DEFAULT 'viewer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Пользователи системы';

-- ============================================================
-- Тестовые данные (опционально)
-- ============================================================
-- INSERT INTO doctors (id, last_name, first_name, middle_name, workplace, color) VALUES
-- ('550e8400-e29b-41d4-a716-446655440000', 'Иванов', 'Иван', 'Иванович', 'Хирургия', '#3B82F6'),
-- ('550e8400-e29b-41d4-a716-446655440001', 'Петров', 'Пётр', 'Петрович', 'Терапия', '#EF4444'),
-- ('550e8400-e29b-41d4-a716-446655440002', 'Сидорова', 'Анна', 'Сергеевна', 'Приёмное отделение', '#10B981');

-- ============================================================
-- Проверка
-- ============================================================
SHOW TABLES;
SELECT COUNT(*) AS total_tables FROM information_schema.tables WHERE table_schema = 'duty_schedule';
