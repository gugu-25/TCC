package com.peroladoporto.api;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import javax.json.Json;
import javax.json.JsonArray;
import javax.json.JsonArrayBuilder;
import javax.json.JsonObject;
import javax.json.JsonObjectBuilder;
import javax.json.JsonReader;
import javax.json.JsonValue;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

@WebServlet("/api/chat")
public class ChatServlet extends HttpServlet {
    private static final String GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";
    private static final String GEMINI_MODEL = "gemini-3.6-flash";

    @Override
    protected void doOptions(HttpServletRequest request, HttpServletResponse response) {
        configurarCors(response);
        response.setStatus(HttpServletResponse.SC_NO_CONTENT);
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        configurarCors(response);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        if (request.getContentLengthLong() > 32768) {
            enviarErro(response, 413, "Requisicao muito grande.");
            return;
        }

        JsonArray recebidas = lerMensagens(request);
        if (recebidas == null || recebidas.isEmpty()) {
            enviarErro(response, 400, "Nenhuma mensagem recebida.");
            return;
        }

        String instrucoes = "Seu nome é atlas, o assistente virtual da Pousada Perola do Porto. "
                + "sempre inicie a conversa falando seu nome e que voce é"
                + "responda todas as mensagens em portugues do Brasil caso a mensagem seja em outro idioma vocÊ identifica ele e respoda-o "
                + ""
                + "Você deve responder as saudações, perguntas e dúvidas dos usuários sobre a pousada, suas instalações, serviços, localização e reservas. "
                + "Responda de forma simpática, curta e objetiva, em português do Brasil. "
                + "A pousada fica a aproximadamente 40 metros da praia e 400 metros da vila, no bairro Merepe I. "
                + "Oferece ar-condicionado, TV, frigobar, banheiro privativo, duas piscinas, jardins, restaurante, "
                + "bar na piscina, Wi-Fi gratuito, limpeza diária, recepção 24 horas e café da manhã. "
                + "Se o usuário perguntar sobre diária, informe o valor estimado considerando 1 casal = 1 quarto e 2 adultos, e cada criança adicional terá custo de referência. "
                + "Se o usuário mencionar quantos casais e crianças quer reservar, calcule o valor total estimado e inclua um link para a página Reservar com os parâmetros casais, criancas e valor no formato: "
                + "https://seusite.com/reservar.html?casais=X&criancas=Y&valor=ZZZ, onde X é o número de casais, Y o número de crianças e ZZZ o valor estimado em reais. "
                + "Nunca invente valores sem contexto; quando houver dúvida use valor estimado e diga que é uma cotação de referência. "
                + "Para reservar, oriente o usuário a acessar a página Reservar. Não invente preços ou informações."
                ;

        JsonArrayBuilder contents = Json.createArrayBuilder();
        int inicio = Math.max(0, recebidas.size() - 10);
        for (int i = inicio; i < recebidas.size(); i++) {
            JsonValue valor = recebidas.get(i);
            if (valor.getValueType() != JsonValue.ValueType.OBJECT) {
                continue;
            }
            JsonObject mensagem = (JsonObject) valor;
            String role = mensagem.getString("role", "");
            String content = mensagem.getString("content", "").trim();
            if (!content.isEmpty() && content.length() <= 2000
                    && ("user".equals(role) || "assistant".equals(role))) {
                contents.add(Json.createObjectBuilder()
                        .add("role", "assistant".equals(role) ? "model" : "user")
                        .add("parts", Json.createArrayBuilder()
                                .add(Json.createObjectBuilder().add("text", content).build())
                                .build())
                        .build());
            }
        }

        JsonObject payload = Json.createObjectBuilder()
                .add("systemInstruction", Json.createObjectBuilder()
                        .add("parts", Json.createArrayBuilder()
                                .add(Json.createObjectBuilder().add("text", instrucoes).build())
                                .build())
                        .build())
                .add("contents", contents.build())
                .add("generationConfig", Json.createObjectBuilder()
                        .add("temperature", 0.6)
                        .add("maxOutputTokens", 800)
                        .build())
                .build();

        String apiKey = obterApiKey();
        if (apiKey == null || apiKey.trim().isEmpty()) {
            enviarErro(response, 500, "Chave da API do Gemini não configurada. Defina a variável de ambiente GEMINI_API_KEY.");
            return;
        }

        ResultadoGemini resultadoGemini;
        try {
            resultadoGemini = chamarGemini(payload, apiKey);
        } catch (IOException erro) {
            enviarErro(response, 502, "Não foi possível conectar ao Gemini. Verifique sua chave da API e a conexão com a internet.");
            return;
        }

        try (JsonReader leitor = Json.createReader(new java.io.StringReader(resultadoGemini.corpo))) {
            JsonObject dados = leitor.readObject();
            if (resultadoGemini.status < 200 || resultadoGemini.status >= 300) {
                String detalhe = dados.containsKey("error")
                        ? dados.getJsonObject("error").getString("message", "")
                        : "";
                enviarErro(response, 502, "A API do Gemini recusou a solicitação (HTTP "
                        + resultadoGemini.status + "): " + detalhe);
                return;
            }

            JsonArray candidatos = dados.getJsonArray("candidates");
            if (candidatos == null || candidatos.isEmpty()) {
                enviarErro(response, 502, "Resposta inválida da API do Gemini.");
                return;
            }

            JsonObject primeiroCandidato = candidatos.getJsonObject(0);
            JsonObject content = primeiroCandidato.getJsonObject("content");
            JsonArray partes = content == null ? null : content.getJsonArray("parts");
            if (partes == null || partes.isEmpty()) {
                enviarErro(response, 502, "Resposta inválida da API do Gemini.");
                return;
            }

            String resposta = partes.getJsonObject(0).getString("text", "").trim();
            if (resposta.isEmpty()) {
                enviarErro(response, 502, "Resposta inválida da API do Gemini.");
                return;
            }
            response.getWriter().write(Json.createObjectBuilder()
                    .add("resposta", resposta).build().toString());
        } catch (RuntimeException erro) {
            enviarErro(response, 502, "Resposta inválida da API do Gemini.");
        }
    }

    private JsonArray lerMensagens(HttpServletRequest request) throws IOException {
        try (JsonReader leitor = Json.createReader(request.getReader())) {
            JsonObject corpo = leitor.readObject();
            return corpo.getJsonArray("mensagens");
        } catch (RuntimeException erro) {
            return null;
        }
    }

    private String obterApiKey() {
        String apiKey = System.getenv("GEMINI_API_KEY");
        if (apiKey == null || apiKey.trim().isEmpty()) {
            apiKey = System.getenv("GOOGLE_API_KEY");
        }
        if (apiKey == null || apiKey.trim().isEmpty()) {
            apiKey = System.getProperty("gemini.api.key");
        }
        if (apiKey == null || apiKey.trim().isEmpty()) {
            apiKey = System.getProperty("google.api.key");
        }
        return apiKey == null ? null : apiKey.trim();
    }

    private ResultadoGemini chamarGemini(JsonObject payload, String apiKey) throws IOException {
        String urlComChave = GEMINI_API_URL + "?key=" + URLEncoder.encode(apiKey, StandardCharsets.UTF_8.name());
        HttpURLConnection conexao = (HttpURLConnection) new URL(urlComChave).openConnection();
        conexao.setRequestMethod("POST");
        conexao.setConnectTimeout(10000);
        conexao.setReadTimeout(120000);
        conexao.setDoOutput(true);
        conexao.setRequestProperty("Content-Type", "application/json");

        try (OutputStream saida = conexao.getOutputStream()) {
            saida.write(payload.toString().getBytes(StandardCharsets.UTF_8));
        }

        int status = conexao.getResponseCode();
        InputStream fluxo = status >= 200 && status < 300
                ? conexao.getInputStream() : conexao.getErrorStream();
        if (fluxo == null) {
            throw new IOException("A API do Gemini encerrou a conexao sem enviar uma resposta.");
        }
        try (BufferedReader leitor = new BufferedReader(new InputStreamReader(fluxo, StandardCharsets.UTF_8))) {
            StringBuilder resultado = new StringBuilder();
            String linha;
            while ((linha = leitor.readLine()) != null) {
                resultado.append(linha);
            }
            return new ResultadoGemini(status, resultado.toString());
        } finally {
            conexao.disconnect();
        }
    }

    private void configurarCors(HttpServletResponse response) {
        response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("Cache-Control", "no-store");
    }

    private void enviarErro(HttpServletResponse response, int status, String mensagem) throws IOException {
        response.setStatus(status);
        response.getWriter().write(Json.createObjectBuilder().add("erro", mensagem).build().toString());
    }

    private static class ResultadoGemini {
        private final int status;
        private final String corpo;

        private ResultadoGemini(int status, String corpo) {
            this.status = status;
            this.corpo = corpo;
        }
    }
}
