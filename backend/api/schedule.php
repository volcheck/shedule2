<?php
/**
 * API для работы с графиком дежурств
 *
 * GET    /api/schedule.php?year=2026&month=1  — получить записи за месяц
 * POST   /api/schedule.php                    — добавить запись
 * PUT    /api/schedule.php                    — обновить запись (переместить)
 * DELETE /api/schedule.php                    — удалить запись
 */

header('Content-Type: application/json; charset=utf-8');

// CORS
$config = require __DIR__ . '/config.php';
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $config['cors']['allowed_origins'])) {
    header("Access-Control-Allow-Origin: $origin");
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Подключение к БД
try {
    $dsn = "mysql:host={$config['db']['host']};port={$config['db']['port']};dbname={$config['db']['dbname']};charset={$config['db']['charset']}";
    $pdo = new PDO($dsn, $config['db']['username'], $config['db']['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed', 'message' => $config['debug'] ? $e->getMessage() : null]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            // Получить записи за указанный месяц
            $year = (int) ($_GET['year'] ?? date('Y'));
            $month = (int) ($_GET['month'] ?? date('n'));

            if ($month < 1 || $month > 12 || $year < 2000 || $year > 2100) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid year or month']);
                exit;
            }

            $stmt = $pdo->prepare('SELECT id, doctor_id, year, month, day, column_index FROM schedule_entries WHERE year = :year AND month = :month ORDER BY day, column_index');
            $stmt->execute([':year' => $year, ':month' => $month]);
            $entries = $stmt->fetchAll();

            // Преобразовать в формат фронтенда
            $result = array_map(function ($e) {
                return [
                    'doctorId' => $e['doctor_id'],
                    'day' => (int) $e['day'],
                    'column' => (int) $e['column_index'],
                ];
            }, $entries);

            echo json_encode($result, JSON_UNESCAPED_UNICODE);
            break;

        case 'POST':
            // Добавить запись
            $input = json_decode(file_get_contents('php://input'), true);
            if (!$input || !isset($input['doctorId'], $input['day'], $input['column'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Missing required fields: doctorId, day, column']);
                exit;
            }

            // Определить год и месяц из контекста или запроса
            $year = (int) ($input['year'] ?? date('Y'));
            $month = (int) ($input['month'] ?? date('n'));

            // Проверить, не занята ли уже ячейка
            $check = $pdo->prepare('SELECT id FROM schedule_entries WHERE year = :year AND month = :month AND day = :day AND column_index = :column');
            $check->execute([
                ':year' => $year,
                ':month' => $month,
                ':day' => $input['day'],
                ':column' => $input['column'],
            ]);

            if ($check->fetch()) {
                // Ячейка занята — заменить (swap handled on frontend)
                $stmt = $pdo->prepare('UPDATE schedule_entries SET doctor_id = :doctor_id WHERE year = :year AND month = :month AND day = :day AND column_index = :column');
                $stmt->execute([
                    ':doctor_id' => $input['doctorId'],
                    ':year' => $year,
                    ':month' => $month,
                    ':day' => $input['day'],
                    ':column' => $input['column'],
                ]);
            } else {
                $stmt = $pdo->prepare('INSERT INTO schedule_entries (doctor_id, year, month, day, column_index) VALUES (:doctor_id, :year, :month, :day, :column)');
                $stmt->execute([
                    ':doctor_id' => $input['doctorId'],
                    ':year' => $year,
                    ':month' => $month,
                    ':day' => $input['day'],
                    ':column' => $input['column'],
                ]);
            }

            http_response_code(201);
            echo json_encode(['success' => true]);
            break;

        case 'PUT':
            // Обновить запись (переместить)
            $input = json_decode(file_get_contents('php://input'), true);
            if (!$input || !isset($input['from'], $input['to'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Missing from/to fields']);
                exit;
            }

            $year = (int) ($input['year'] ?? date('Y'));
            $month = (int) ($input['month'] ?? date('n'));

            $pdo->beginTransaction();

            // Получить запись в источнике
            $from = $input['from'];
            $to = $input['to'];

            $stmt = $pdo->prepare('SELECT doctor_id FROM schedule_entries WHERE year = :year AND month = :month AND day = :day AND column_index = :column');
            $stmt->execute([':year' => $year, ':month' => $month, ':day' => $from['day'], ':column' => $from['column']]);
            $fromEntry = $stmt->fetch();

            $stmt->execute([':year' => $year, ':month' => $month, ':day' => $to['day'], ':column' => $to['column']]);
            $toEntry = $stmt->fetch();

            if ($fromEntry) {
                if ($toEntry) {
                    // Swap: обновить обе записи
                    $pdo->prepare('UPDATE schedule_entries SET doctor_id = :doc WHERE year = :year AND month = :month AND day = :day AND column_index = :col')
                        ->execute([':doc' => $toEntry['doctor_id'], ':year' => $year, ':month' => $month, ':day' => $from['day'], ':col' => $from['column']]);
                    $pdo->prepare('UPDATE schedule_entries SET doctor_id = :doc WHERE year = :year AND month = :month AND day = :day AND column_index = :col')
                        ->execute([':doc' => $fromEntry['doctor_id'], ':year' => $year, ':month' => $month, ':day' => $to['day'], ':col' => $to['column']]);
                } else {
                    // Move: удалить из источника, вставить в цель
                    $pdo->prepare('DELETE FROM schedule_entries WHERE year = :year AND month = :month AND day = :day AND column_index = :col')
                        ->execute([':year' => $year, ':month' => $month, ':day' => $from['day'], ':col' => $from['column']]);
                    $pdo->prepare('INSERT INTO schedule_entries (doctor_id, year, month, day, column_index) VALUES (:doc, :year, :month, :day, :col)')
                        ->execute([':doc' => $fromEntry['doctor_id'], ':year' => $year, ':month' => $month, ':day' => $to['day'], ':col' => $to['column']]);
                }
            }

            $pdo->commit();
            echo json_encode(['success' => true]);
            break;

        case 'DELETE':
            // Удалить запись
            $year = (int) ($_GET['year'] ?? 0);
            $month = (int) ($_GET['month'] ?? 0);
            $day = (int) ($_GET['day'] ?? 0);
            $column = (int) ($_GET['column'] ?? 0);

            if (!$year || !$month || !$day) {
                http_response_code(400);
                echo json_encode(['error' => 'Missing year, month, or day']);
                exit;
            }

            $stmt = $pdo->prepare('DELETE FROM schedule_entries WHERE year = :year AND month = :month AND day = :day AND column_index = :column');
            $stmt->execute([':year' => $year, ':month' => $month, ':day' => $day, ':column' => $column]);

            echo json_encode(['success' => true, 'deleted' => $stmt->rowCount()]);
            break;

        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['error' => 'Database error', 'message' => $config['debug'] ? $e->getMessage() : null]);
}
