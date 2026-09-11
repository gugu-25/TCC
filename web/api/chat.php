<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("X-Content-Type-Options: nosniff");
header("Cache-Control: no-store");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") { http_response_code(204); exit; }
if ($_SERVER["REQUEST_METHOD"] !== "POST") { http_response_code(405); echo json_encode(["erro" => "Metodo nao permitido"]); exit; }
if (!function_exists("curl_init")) { http_response_code(500); echo json_encode(["erro" => "A extensao cURL do PHP nao esta habilitada."]); exit; }

$tamanho = (int) ($_SERVER["CONTENT_LENGTH"] ?? 0);
if ($tamanho > 32768) { http_response_code(413); echo json_encode(["erro" => "Requisicao muito grande."]); exit; }

$apiKey = trim((string) getenv("OPENAI_API_KEY"));
if ($apiKey === "") { http_response_code(500); echo json_encode(["erro" => "Chave da OpenAI nao configurada no servidor."]); exit; }

$corpo = json_decode(file_get_contents("php://input"), true);
$mensagens = is_array($corpo) ? ($corpo["mensagens"] ?? []) : [];
if (!is_array($mensagens) || empty($mensagens)) { http_response_code(400); echo json_encode(["erro" => "Nenhuma mensagem recebida."]); exit; }

$validas = [];
foreach (array_slice($mensagens, -10) as $mensagem) {
    $role = is_array($mensagem) ? ($mensagem["role"] ?? "") : "";
    $content = is_array($mensagem) ? trim((string) ($mensagem["content"] ?? "")) : "";
    if (in_array($role, ["user", "assistant"], true) && $content !== "" && strlen($content) <= 2000) { $validas[] = ["role" => $role, "content" => $content]; }
}
if (empty($validas)) { http_response_code(400); echo json_encode(["erro" => "Mensagens invalidas."]); exit; }

$sistema = ["role" => "system", "content" => "Voce e o assistente virtual da Pousada Perola do Porto, em Porto de Galinhas (PE). Responda de forma simpatica, curta e objetiva, em portugues do Brasil. A pousada fica a aproximadamente 40 metros da praia e cerca de 400 metros da vila, no bairro Merepe I. Oferece acomodacoes com ar-condicionado, TV, frigobar e banheiro privativo, duas piscinas, jardins, restaurante, bar na piscina, Wi-Fi gratuito, limpeza diaria, recepcao 24 horas e cafe da manha. Para reservar, oriente o usuario a acessar a pagina Reservar. Nao invente precos ou informacoes que nao foram fornecidos."];
$payload = ["model" => "gpt-4o-mini", "messages" => array_merge([$sistema], $validas), "temperature" => 0.6, "max_tokens" => 300];

$ch = curl_init("https://api.openai.com/v1/chat/completions");
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_HTTPHEADER => ["Content-Type: application/json", "Authorization: Bearer " . $apiKey], CURLOPT_POSTFIELDS => json_encode($payload), CURLOPT_TIMEOUT => 30]);
$bruto = curl_exec($ch);
$erro = curl_error($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
if ($erro) { http_response_code(502); echo json_encode(["erro" => "Falha ao contatar a OpenAI."]); exit; }

$dados = json_decode($bruto, true);
if ($status < 200 || $status >= 300 || empty($dados["choices"][0]["message"]["content"])) { http_response_code(502); echo json_encode(["erro" => "Resposta invalida da OpenAI."]); exit; }
echo json_encode(["resposta" => trim($dados["choices"][0]["message"]["content"])], JSON_UNESCAPED_UNICODE);
