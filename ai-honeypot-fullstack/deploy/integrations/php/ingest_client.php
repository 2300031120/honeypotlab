<?php
declare(strict_types=1);

function honeypot_build_ingest_url(string $baseUrl): string
{
    $base = rtrim(trim($baseUrl), "/");
    if ($base === "") {
        throw new InvalidArgumentException("Missing HONEYPOT_BASE_URL");
    }
    if (str_ends_with(strtolower($base), "/api")) {
        return $base . "/ingest";
    }
    return $base . "/api/ingest";
}

/**
 * Send one security event to the platform.
 * Returns:
 * [
 *   'ok' => bool,
 *   'status_code' => int,
 *   'data' => mixed,
 *   'error' => string|null
 * ]
 */
function honeypot_send_event(array $event, ?string $baseUrl = null, ?string $apiKey = null, int $timeoutSec = 6): array
{
    if (!function_exists("curl_init")) {
        return ["ok" => false, "status_code" => 0, "data" => null, "error" => "cURL extension not enabled"];
    }

    $baseUrl = $baseUrl ?? getenv("HONEYPOT_BASE_URL") ?: "";
    $apiKey = $apiKey ?? getenv("HONEYPOT_API_KEY") ?: "";

    if ($apiKey === "") {
        return ["ok" => false, "status_code" => 0, "data" => null, "error" => "Missing HONEYPOT_API_KEY"];
    }

    try {
        $url = honeypot_build_ingest_url($baseUrl);
    } catch (Throwable $e) {
        return ["ok" => false, "status_code" => 0, "data" => null, "error" => $e->getMessage()];
    }

    $ch = curl_init($url);
    $payload = json_encode($event, JSON_UNESCAPED_SLASHES);
    if ($payload === false) {
        return ["ok" => false, "status_code" => 0, "data" => null, "error" => "JSON encode failed"];
    }

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => [
            "Content-Type: application/json",
            "X-API-Key: " . $apiKey,
        ],
        CURLOPT_CONNECTTIMEOUT => $timeoutSec,
        CURLOPT_TIMEOUT => $timeoutSec,
    ]);

    $responseBody = curl_exec($ch);
    $statusCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($responseBody === false) {
        return ["ok" => false, "status_code" => 0, "data" => null, "error" => $curlError ?: "Request failed"];
    }

    $decoded = json_decode($responseBody, true);
    $data = json_last_error() === JSON_ERROR_NONE ? $decoded : ["raw" => $responseBody];

    return [
        "ok" => $statusCode >= 200 && $statusCode < 300,
        "status_code" => $statusCode,
        "data" => $data,
        "error" => null,
    ];
}

/*
Example:
$result = honeypot_send_event([
    "event_type" => "auth_fail",
    "url_path" => "/login",
    "http_method" => "POST",
    "captured_data" => ["reason" => "invalid_password"],
    "session_id" => "php-login-" . time(),
]);
*/

