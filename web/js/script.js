(function () {
    "use strict";

    var ENDPOINT = window.location.protocol === "file:" ? null : new URL("api/chat", window.location.href).toString();
    var state = { aberto: false, enviando: false, historico: [] };
    var PRECO_POR_CRIANCA = 90;
    var TARIFAS_QUARTOS = {
        "duplo-standard": { nome: "Duplo Standard", diaria: 330 },
        standard: { nome: "Standard", diaria: 360 },
        superior: { nome: "Superior", diaria: 420 },
        "senior-sem-varanda": { nome: "Sênior sem varanda", diaria: 480 }
    };
    var imagensHotel = [
        "imagem/p1.jpeg",
        "imagem/p2.jpeg",
        "imagem/p3.jpeg",
        "imagem/p4.jpeg",
        "imagem/p5.jpg",
        "imagem/p6.jpg",
        "imagem/p7.jpg",
        "imagem/p8.jpg",
        "imagem/p9.jpg",
        "imagem/p10.jpg",
        "imagem/p11.jpg",
        "imagem/p12.jpg"
    ];

    function formatarMoeda(valor) {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
    }

    function calcularDiaria(adultos, criancas, tipoQuarto) {
        var qtdAdultos = Number(adultos) || 2;
        var qtdCriancas = Number(criancas) || 0;
        var tarifa = TARIFAS_QUARTOS[tipoQuarto] || TARIFAS_QUARTOS.standard;
        var valorBase = tarifa.diaria + (qtdCriancas * PRECO_POR_CRIANCA);
        return {
            adultos: qtdAdultos,
            criancas: qtdCriancas,
            tipoQuarto: tarifa.nome,
            diaria: tarifa.diaria,
            valor: valorBase
        };
    }

    function calcularNoites(checkIn, checkOut) {
        if (!checkIn || !checkOut) {
            return 1;
        }

        var dataEntrada = new Date(checkIn + "T00:00:00");
        var dataSaida = new Date(checkOut + "T00:00:00");

        if (isNaN(dataEntrada.getTime()) || isNaN(dataSaida.getTime())) {
            return 1;
        }

        var diferencaMs = dataSaida.getTime() - dataEntrada.getTime();
        var noites = Math.round(diferencaMs / (1000 * 60 * 60 * 24));
        return noites > 0 ? noites : 1;
    }

    function montarUrlOmnibees(adultos, criancas, tipoQuarto) {
        var dados = calcularDiaria(adultos, criancas, tipoQuarto);
        var url = new URL("https://book.omnibees.com/hotelresults");
        url.searchParams.set("q", "15704");
        url.searchParams.set("lang", "pt-PT");
        url.searchParams.set("version", "4");
        url.searchParams.set("CheckIn", "");
        url.searchParams.set("CheckOut", "");
        url.searchParams.set("NRooms", "1");
        url.searchParams.set("ad", String(dados.adultos));
        url.searchParams.set("ch", String(dados.criancas));
        url.searchParams.set("Code", "");
        return url.toString();
    }

    function atualizarResumoReserva() {
        var campoAdultos = document.getElementById("adultos");
        var campoCriancas = document.getElementById("criancas");
        var campoTipoQuarto = document.getElementById("tipo-quarto");
        var campoCheckIn = document.getElementById("checkin");
        var campoCheckOut = document.getElementById("checkout");
        var valorTotal = document.getElementById("valor-estimado");
        var resumoAcomodacao = document.getElementById("resumo-acomodacao");
        if (!campoAdultos || !campoCriancas || !campoTipoQuarto || !campoCheckIn || !campoCheckOut || !valorTotal || !resumoAcomodacao) {
            return;
        }

        var dados = calcularDiaria(campoAdultos.value, campoCriancas.value, campoTipoQuarto.value);
        var noites = calcularNoites(campoCheckIn.value, campoCheckOut.value);
        var totalReserva = dados.valor * noites;

        valorTotal.textContent = formatarMoeda(totalReserva);
        resumoAcomodacao.textContent = dados.tipoQuarto;
    }

    function aplicarParametrosReserva() {
        var params = new URLSearchParams(window.location.search);
        var adultoParam = params.get("adultos");
        var criancaParam = params.get("criancas");
        var tipoQuartoParam = params.get("tipoQuarto");
        var valorParam = params.get("valor");
        var campoAdultos = document.getElementById("adultos");
        var campoCriancas = document.getElementById("criancas");
        var valorTotal = document.getElementById("valor-estimado");

        if (campoAdultos && adultoParam) {
            campoAdultos.value = adultoParam;
        }
        if (campoCriancas && criancaParam) {
            campoCriancas.value = criancaParam;
        }
        var campoTipoQuarto = document.getElementById("tipo-quarto");
        if (campoTipoQuarto && tipoQuartoParam) {
            campoTipoQuarto.value = tipoQuartoParam;
        }
        if (valorTotal && valorParam) {
            valorTotal.textContent = formatarMoeda(Number(valorParam));
        }
        atualizarResumoReserva();
    }

    function iniciarGaleria() {
        var principal = document.getElementById("galeria-principal");
        var botoes = document.querySelectorAll(".thumb");
        var prev = document.querySelector(".galeria-nav.prev");
        var next = document.querySelector(".galeria-nav.next");
        if (!principal || botoes.length === 0) {
            return;
        }

        var indiceAtual = 0;

        function atualizarGaleria(novoIndice) {
            indiceAtual = (novoIndice + imagensHotel.length) % imagensHotel.length;
            principal.src = imagensHotel[indiceAtual];
            botoes.forEach(function (botao, index) {
                botao.classList.toggle("active", index === indiceAtual);
            });
        }

        botoes.forEach(function (botao) {
            botao.addEventListener("click", function () {
                atualizarGaleria(Number(botao.dataset.index));
            });
        });

        if (prev) {
            prev.addEventListener("click", function () {
                atualizarGaleria(indiceAtual - 1);
            });
        }

        if (next) {
            next.addEventListener("click", function () {
                atualizarGaleria(indiceAtual + 1);
            });
        }
    }

    function montarWidget() {
        var wrapper = document.createElement("div");
        wrapper.className = "chatbot-wrapper";
        wrapper.innerHTML = "<button type=\"button\" class=\"chatbot-toggle\" aria-expanded=\"false\" aria-controls=\"chatbot-panel\"><span class=\"chatbot-toggle-icon\" aria-hidden=\"true\"></span><span>Duvidas?</span></button>" +
            "<section id=\"chatbot-panel\" class=\"chatbot-panel\" hidden><header class=\"chatbot-header\"><div><p class=\"chatbot-header-title\">Assistente Perola do Porto</p><p class=\"chatbot-header-subtitle\">Resposta automatica</p></div><button type=\"button\" class=\"chatbot-close\" aria-label=\"Fechar chat\">&times;</button></header><div class=\"chatbot-messages\" id=\"chatbot-messages\" role=\"log\" aria-live=\"polite\"></div><form class=\"chatbot-form\" id=\"chatbot-form\"><label class=\"visually-hidden\" for=\"chatbot-input\">Digite sua pergunta</label><input id=\"chatbot-input\" type=\"text\" placeholder=\"Digite sua duvida...\" autocomplete=\"off\" required><button type=\"submit\" class=\"chatbot-send\">Enviar</button></form></section>";
        document.body.appendChild(wrapper);
        return wrapper;
    }

    function adicionarMensagem(container, texto, autor) {
        var bolha = document.createElement("div");
        bolha.className = "chatbot-msg chatbot-msg--" + autor;
        bolha.textContent = texto;
        container.appendChild(bolha);
        container.scrollTop = container.scrollHeight;
    }

    function mostrarDigitando(container) {
        var bolha = document.createElement("div");
        bolha.id = "chatbot-digitando";
        bolha.className = "chatbot-msg chatbot-msg--assistant chatbot-msg--digitando";
        bolha.innerHTML = "<span></span><span></span><span></span>";
        container.appendChild(bolha);
    }

    async function enviarMensagem(container, texto) {
        state.historico.push({ role: "user", content: texto });
        mostrarDigitando(container);
        state.enviando = true;
        try {
            if (!ENDPOINT) {
                throw new Error("O chatbot precisa ser aberto pelo servidor da aplicação. Execute o projeto no NetBeans e acesse a página pelo endereço HTTP.");
            }
            var resposta = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mensagens: state.historico }) });
            var corpo = await resposta.text();
            var dados;
            try { dados = JSON.parse(corpo); } catch (erroJson) { throw new Error("O servidor nao retornou JSON (HTTP " + resposta.status + ")."); }
            if (!resposta.ok) { throw new Error(dados.erro || dados.detalhe || "Falha na resposta do servidor."); }
            var digitando = container.querySelector("#chatbot-digitando");
            if (digitando) { digitando.remove(); }
            var textoResposta = dados.resposta || "Desculpe, nao consegui responder agora.";
            adicionarMensagem(container, textoResposta, "assistant");
            state.historico.push({ role: "assistant", content: textoResposta });
        } catch (erro) {
            var carregando = container.querySelector("#chatbot-digitando");
            if (carregando) { carregando.remove(); }
            adicionarMensagem(container, "Erro: " + erro.message, "assistant");
        } finally { state.enviando = false; }
    }

    function iniciar() {
        var wrapper = montarWidget();
        var toggle = wrapper.querySelector(".chatbot-toggle");
        var panel = wrapper.querySelector("#chatbot-panel");
        var fechar = wrapper.querySelector(".chatbot-close");
        var form = wrapper.querySelector("#chatbot-form");
        var input = wrapper.querySelector("#chatbot-input");
        var mensagens = wrapper.querySelector("#chatbot-messages");

        function abrir() { state.aberto = true; panel.hidden = false; toggle.setAttribute("aria-expanded", "true"); input.focus(); }
        function fecharPainel() { state.aberto = false; panel.hidden = true; toggle.setAttribute("aria-expanded", "false"); }
        toggle.addEventListener("click", function () { state.aberto ? fecharPainel() : abrir(); });
        fechar.addEventListener("click", fecharPainel);
        form.addEventListener("submit", function (evento) {
            evento.preventDefault();
            var texto = input.value.trim();
            if (!texto || state.enviando) { return; }
            adicionarMensagem(mensagens, texto, "user");
            input.value = "";
            enviarMensagem(mensagens, texto);
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        var messages = { "login-form": "Login realizado com sucesso." };
        Object.keys(messages).forEach(function (formId) {
            var form = document.getElementById(formId);
            if (!form) { return; }
            form.addEventListener("submit", function (event) {
                event.preventDefault();
                var email = form.querySelector("#email");
                var senha = form.querySelector("#senha");
                if (!email || !senha || !email.value.trim() || !senha.value) { return; }
                localStorage.setItem("sessaoPousada", JSON.stringify({ autenticado: true, email: email.value.trim(), autenticadoEm: new Date().toISOString() }));
                var oldMessage = form.querySelector(".form-message");
                if (oldMessage) { oldMessage.remove(); }
                var message = document.createElement("p");
                message.className = "form-message";
                message.setAttribute("role", "status");
                message.textContent = messages[formId];
                form.appendChild(message);
                form.reset();
                var destino = new URLSearchParams(window.location.search).get("redirect");
                if (destino === "reservas.html") {
                    window.location.href = "reservas.html";
                }
            });
        });

        var reservaForm = document.getElementById("reserva-form");
        if (reservaForm) {
            var camposReserva = [document.getElementById("adultos"), document.getElementById("criancas"), document.getElementById("tipo-quarto"), document.getElementById("checkin"), document.getElementById("checkout")];
            camposReserva.forEach(function (campo) {
                if (!campo) { return; }
                campo.addEventListener("change", atualizarResumoReserva);
                campo.addEventListener("input", atualizarResumoReserva);
            });
            aplicarParametrosReserva();
            reservaForm.addEventListener("submit", function (event) {
                event.preventDefault();
                var dados = {};
                new FormData(reservaForm).forEach(function (valor, chave) { dados[chave] = valor; });
                var tarifa = TARIFAS_QUARTOS[dados["tipo-quarto"]] || TARIFAS_QUARTOS.standard;
                var noites = calcularNoites(dados.checkin, dados.checkout);
                dados.tipoQuartoNome = tarifa.nome;
                dados.diaria = tarifa.diaria;
                dados.noites = noites;
                dados.total = (tarifa.diaria + (Number(dados.criancas) * PRECO_POR_CRIANCA)) * noites;
                localStorage.setItem("reservaPousada", JSON.stringify(dados));
                window.location.href = "resumo.html";
            });
        }

        iniciarGaleria();
        iniciar();
    });
}());
