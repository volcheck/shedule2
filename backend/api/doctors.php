<?php
/**
 * API для работы со списком врачей
 *
 * GET    /api/doctors.php          — получить всех врачей
 * POST   /api/doctors.php          — добавить врача
 * PUT    /api/doctors.php?id=UUID  — обновить врача
 * DELETE /api/doctors.php?id=UUID  — удалить врача
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
            // Получить всех врачей
            $stmt = $pdo->query('SELECT id, last_name, first_name, middle_name, workplace, color FROM doctors ORDER BY last_name');
            $doctors = $stmt->fetchAll();
            echo json_encode($doctors, JSON_UNESCAPED_UNICODE);
            break;

        case 'POST':
            // Добавить врача
            $input = json_decode(file_get_contents('php://input'), true);
            if (!$input || !isset($input['id'], $input['lastName'], $input['firstName'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Missing required fields: id, lastName, firstName']);
                exit;
            }

            $stmt = $pdo->prepare('INSERT INTO doctors (id, last_name, first_name, middle_name, workplace, color) VALUES (:id, :last_name, :first_name, :middle_name, :workplace, :color)');
            $stmt->execute([
                ':id' => $input['id'],
                ':last_name' => $input['lastName'],
                ':first_name' => $input['firstName'],
                ':middle_name' => $input['middleName'] ?? '',
                ':workplace' => $input['workplace'] ?? '',
                ':color' => $input['color'] ?? '#3B82F6',
            ]);

            http_response_code(201);
            echo json_encode(['success' => true, 'id' => $input['id']]);
            break;

        case 'PUT':
            // Обновить врача
            $id = $_GET['id'] ?? null;
            if (!$id) {
                http_response_code(400);
                echo json_encode(['error' => 'Missing doctor id']);
                exit;
            }

            $input = json_decode(file_get_contents('php://input'), true);
            $stmt = $pdo->prepare('UPDATE doctors SET last_name = :last_name, first_name = :first_name, middle_name = :middle_name, workplace = :workplace, color = :color WHERE id = :id');
            $stmt->execute([
                ':id' => $id,
                ':last_name' => $input['lastName'] ?? '',
                ':first_name' => $input['firstName'] ?? '',
                ':middle_name' => $input['middleName'] ?? '',
                ':workplace' => $input['workplace'] ?? '',
                ':color' => $input['color'] ?? '#3B82F6',
            ]);

            echo json_encode(['success' => true, 'updated' => $stmt->rowCount()]);
            break;

        case 'DELETE':
            // Удалить врача
            $id = $_GET['id'] ?? null;
            if (!$id) {
                http_response_code(400);
                echo json_encode(['error' => 'Missing doctor id']);
                exit;
            }

            $stmt = $pdo->prepare('DELETE FROM doctors WHERE id = :id');
            $stmt->execute([':id' => $id]);

            echo json_encode(['success' => true, 'deleted' => $stmt->rowCount()]);
            break;

        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error', 'message' => $config['debug'] ? $e->getMessage() : null]);
}
