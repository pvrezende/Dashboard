// dashboard.js (ATUALIZADO PARA RBAC - INTEGRAÇÃO FINAL E ERROS DE SINTAXE CORRIGIDOS)

// Variável para armazenar o ID do intervalo de atualização automática do dashboard
let autoRefreshDashboardInterval;

// Instância do gráfico de produção
let productionChart = null;

// ===============================================
// Funções para o Dashboard (Tela 1)
// ===============================================

/**
 * Inicializa a tela do Dashboard (Tela 1).
 * Esta é a função principal chamada por `script.js.switchScreen('tela1')`.
 * Ela coordena o carregamento inicial dos dados e a aplicação das permissões.
 */
window.initializeDashboardScreen = function() {
    console.log("Dashboard: Inicializando tela...");
    
    // 1. Atualiza a data/hora
    window.updateCurrentDateTime(); 
    if (!window.updateCurrentDateTimeInterval) { 
        window.updateCurrentDateTimeInterval = setInterval(window.updateCurrentDateTime, 1000);
    }

    // 2. Configura o filtro de data
    window.setupDateFilter(); 

    // 3. Inicia a atualização automática
    window.startAutoRefreshDashboard(10); 
    
    // 4. Aplica as permissões
    if (window.applyUIPermissions && window.getCurrentUser) { 
        window.applyUIPermissions(window.getCurrentUser()?.role);
    } else {
        console.error("permissions-ui.js não foi carregado...");
    }
    
    // =======================================================
    // ▼▼▼ ADICIONE ESTA LINHA AQUI ▼▼▼
    // =======================================================
    if (window.checkAndDisplayDashboardAlerts) {
        window.checkAndDisplayDashboardAlerts();
    }
    // =======================================================
    // ▲▲▲ FIM DA ADIÇÃO ▲▲▲
    // =======================================================
};

/**
 * Atualiza a data e hora atual no dashboard.
 */
function updateCurrentDateTime() {
    const now = new Date();
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    const dateTimeElement = document.getElementById('currentDateTime');
    if (dateTimeElement) {
        dateTimeElement.textContent = now.toLocaleDateString('pt-BR', options);
    }
}

/**
 * Configura o evento de mudança para o filtro de data única.
 * Também carrega os indicadores iniciais para a data padrão.
 */
function setupDateFilter() {
    const selectedDateInput = document.getElementById('selectedDate');
    if (selectedDateInput) {
        // Define a data atual como padrão
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0'); // Mês é 0-indexado
        const day = String(today.getDate()).padStart(2, '0');
        const formattedToday = `${year}-${month}-${day}`;
        
        selectedDateInput.value = formattedToday;

        // Adiciona evento de mudança para atualizar os dados quando a data é alterada
        selectedDateInput.addEventListener('change', function() {
            window.fetchIndicadores(this.value); 
        });

        // Carrega os dados iniciais para a data padrão
        window.fetchIndicadores(selectedDateInput.value); 
    }
}

/**
 * Busca e exibe os indicadores do dashboard (produção por hora, meta diária, total de peças).
 * @param {string} selectedDate - Data selecionada para filtragem (YYYY-MM-DD do input).
 */
window.fetchIndicadores = async function(selectedDateISO = null) {
    console.log('FRONTEND DEBUG - fetchIndicadores recebendo selectedDateISO:', selectedDateISO);
    let url = `${API_BASE_URL}/indicadores`;
    const params = new URLSearchParams();
    if (selectedDateISO) {
        // Converte posteriormente-MM-DD para DD/MM/YYYY para enviar ao backend
        params.append('selectedDate', window.formatDateForDB(selectedDateISO));
    }
    if (params.toString()) {
        url += `?${params.toString()}`;
    }

    try {
        // Usa window.authenticatedFetch para enviar o token JWT
        const response = await window.authenticatedFetch(url); 
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Error fetching indicators. Non-JSON response.' }));
            throw new Error(errorData.error || 'Error fetching indicators.');
        }
        const data = await response.json();

        // pecasPorCaixa é uma constante global (definida em script.js)
        const caixasEstimadas = data.metaDiaria.length > 0 ? data.metaDiaria[0].meta : 0;
        const metaTotal = caixasEstimadas * pecasPorCaixa; 

        const caixasProduzidas = data.totalPecasProduzidas || 0;
        const totalProduzido = caixasProduzidas * pecasPorCaixa;

        const totalReprovados = data.totalReprovados || 0;

        const totalAprovados = totalProduzido - totalReprovados;

        let percentAprovados = 0;
        let percentReprovados = 0;

        if (totalProduzido > 0) {
            percentAprovados = ((totalAprovados / totalProduzido) * 100).toFixed(2);
            percentReprovados = ((totalReprovados / totalProduzido) * 100).toFixed(2);
        }

        // Atualiza os valores nos cartões
        document.getElementById('totalCaixasEstimadas').textContent = caixasEstimadas;
        document.getElementById('totalPecasEstimadas').textContent = metaTotal;

        document.getElementById('totalCaixasProduzidas').textContent = caixasProduzidas;
        document.getElementById('totalPecasProduzidasValue').textContent = totalProduzido;

        document.getElementById('pecasAprovadasHoje').textContent = totalAprovados;
        document.getElementById('percentAprovados').textContent = percentAprovados;

        document.getElementById('totalReprovados').textContent = totalReprovados;
        document.getElementById('percentReprovados').textContent = percentReprovados;

        if (document.getElementById('productionChart')) {
            window.updateProductionChart(data.producaoPorHora); 
        }

    } catch (error) {
        console.error('Erro ao carregar indicadores:', error);
        window.showError('Erro ao carregar indicadores: ' + error.message); 
    }
};


/**
 * Atualiza o gráfico de produção por hora.
 * @param {Array<Object>} producaoPorHora - Dados de produção por hora (onde total_pecas são caixas).
 */
window.updateProductionChart = function(producaoPorHora) {
    const ctx = document.getElementById('productionChart').getContext('2d');

    const labels = producaoPorHora.map(item => `${String(item.hora).padStart(2, '0')}:00`);
    const data = producaoPorHora.map(item => item.total_pecas); // 'total_pecas' aqui são as caixas

    const metaPorHora = 8.5; // Ajuste este valor se sua meta for de peças por hora, não caixas.
    const metaData = Array(labels.length).fill(metaPorHora);

    if (productionChart) {
        productionChart.destroy();
    }

    productionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Caixas Produzidas por Hora',
                    data: data,
                    backgroundColor: 'rgba(0, 123, 255, 0.5)',
                    borderColor: 'rgba(0, 123, 255, 1)',
                    borderWidth: 1,
                    order: 2
                },
                {
                    label: 'Meta por Hora (Caixas)',
                    data: metaData,
                    type: 'line',
                    fill: false,
                    borderColor: '#ffc107',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    tension: 0,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Total de Caixas'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Hora do Dia'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                if (context.dataset.label.includes('Caixas') || context.dataset.label.includes('Meta')) {
                                    label += context.parsed.y + ' caixas';
                                } else {
                                    label += context.parsed.y + ' peças';
                                }
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
};

/**
 * Abre o modal de registro de produção.
 */
window.openRegisterModal = async function() {
    console.log('openRegisterModal called.');
    const registerModal = document.getElementById('registerModal');
    if (registerModal) {
        window.openModal('registerModal'); // Abre o modal usando a função global

        const pecasEstimadasInput = document.getElementById('pecasEstimadasInput');
        const dataHoraMetaInput = document.getElementById('dataHoraMetaInput');
        const dataHoraProducaoInput = document.getElementById('dataHoraProducaoInput');

        // Reseta os formulários para limpar valores anteriores
        document.getElementById('registerProductionForm').reset();

        // Define a data atual como padrão para o input de meta
        const today = new Date();
        const formattedTodayISO = today.toISOString().split('T')[0];
        dataHoraMetaInput.value = formattedTodayISO; 

        // Define a data e hora atual para o input de produção
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(now - offset)).toISOString().slice(0, 16);
        dataHoraProducaoInput.value = localISOTime;

        // Preenche pecasEstimadasInput com a meta atual para a data inicialmente selecionada
        const initialSelectedDateISO = document.getElementById('selectedDate').value || formattedTodayISO;
        const initialSelectedDateFormattedForDB = window.formatDateForDB(initialSelectedDateISO);

        try {
            // Envia DD/MM/YYYY para o backend
            // Usa window.authenticatedFetch para enviar o token JWT
            const response = await window.authenticatedFetch(`${API_BASE_URL}/indicadores?selectedDate=${initialSelectedDateFormattedForDB}`);
            if (!response.ok) { 
                const errorData = await response.json().catch(() => ({ error: 'Erro ao buscar meta atual. Resposta não-JSON.' }));
                throw new Error(errorData.error || 'Falha ao buscar meta atual para o modal de registro.');
            }
            const data = await response.json();
            const currentMetaBoxes = data.metaDiaria.length > 0 ? data.metaDiaria[0].meta : 0;
            pecasEstimadasInput.value = currentMetaBoxes;
            console.log('Meta atual (caixas) buscada:', currentMetaBoxes);
        } catch (error) {
            console.error('Erro ao buscar meta atual:', error);
            pecasEstimadasInput.value = 0; // Padrão em caso de erro
            window.showError('Erro ao carregar meta atual: ' + error.message);
        }

        // CRÍTICO: Aplica as permissões da UI para os elementos do modal ao abri-lo.
        if (window.applyUIPermissions && window.getCurrentUser) {
            window.applyUIPermissions(window.getCurrentUser()?.role);
        } else {
            console.error("permissions-ui.js não foi carregado ou applyUIPermissions/getCurrentUser não está definido!");
        }
    }
};

/**
 * Atualiza apenas a meta de peças estimada (meta diária).
 */
window.updateDailyMeta = async function() {
    const pecasEstimadasInput = document.getElementById('pecasEstimadasInput');
    const dataHoraMetaInput = document.getElementById('dataHoraMetaInput');

    const pecasEstimadas = parseInt(pecasEstimadasInput.value);
    const selectedDateISO = dataHoraMetaInput.value; 

    if (isNaN(pecasEstimadas) || pecasEstimadas < 0) {
        window.showError('Por favor, insira uma quantidade válida de caixas estimadas para a meta.');
        return;
    }
    if (!selectedDateISO) {
        window.showError('Por favor, selecione uma data para a meta.');
        return;
    }

    // Converte posteriormente-MM-DD para DD/MM/YYYY para enviar ao backend
    const formattedDateForDB = window.formatDateForDB(selectedDateISO); 

    try {
        // Usa window.authenticatedFetch para enviar o token JWT
        const metaUpdateResponse = await window.authenticatedFetch(`${API_BASE_URL}/meta_dia`, { 
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                date: formattedDateForDB, 
                meta: pecasEstimadas
            }),
        });

        if (!metaUpdateResponse.ok) {
            const errorData = await metaUpdateResponse.json().catch(() => ({ error: "Erro desconhecido ao atualizar meta diária." }));
            throw new Error(errorData.error || 'Erro ao atualizar meta diária.');
        }

        window.showToast('Meta diária atualizada com sucesso!', 'success');
        // A data para refresh vem do input principal do dashboard, que é posteriormente-MM-DD
        window.fetchIndicadores(document.getElementById('selectedDate').value); 
    } catch (error) {
        console.error('Erro ao atualizar meta diária:', error);
        window.showError('Erro ao atualizar meta diária: ' + error.message);
    }
};

/**
 * Registra a produção (apenas peças produzidas e reprovadas).
 * Envia dados para o backend.
 */
window.registerProduction = async function(event) {
    event.preventDefault(); // Previne o envio padrão do formulário

    const qtdDadosInput = document.getElementById('qtdDadosInput');
    const pecasReprovadaInput = document.getElementById('pecasReprovadaInput');
    const dataHoraProducaoInput = document.getElementById('dataHoraProducaoInput');

    const qtdDados = parseInt(qtdDadosInput.value) || 0; 
    const pecasReprovadas = parseInt(pecasReprovadaInput.value) || 0;
    
    // dataHoraProducaoInput.value é впоследствии-MM-DDTHH:mm
    const dateObj = new Date(dataHoraProducaoInput.value);
    // Converte Date object para DD/MM/YYYY HH:MM:SS para enviar ao backend
    const dataHora = window.formatDateTimeForDB(dateObj); 
    // Data para refresh do dashboard (YYYY-MM-DD)
    const selectedDateForRefresh = dataHoraProducaoInput.value.split('T')[0];

    // Validação
    if (qtdDados < 0) {
        window.showError('Por favor, insira uma quantidade válida de caixas produzidas (não negativa).');
        return;
    }
    if (isNaN(pecasReprovadas) || pecasReprovadas < 0) {
        window.showError('Por favor, insira uma quantidade válida de peças reprovadas (não negativa).');
        return;
    }

    if (qtdDados === 0 && pecasReprovadas === 0) {
        window.showError('Por favor, insira a quantidade de caixas produzidas ou peças reprovadas para registrar.');
        return;
    }

    try {
        if (qtdDados > 0) {
            // Usa window.authenticatedFetch para enviar o token JWT
            const productionResponse = await window.authenticatedFetch(`${API_BASE_URL}/producao`, { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ qtdDados, dataHora }), // Envia DD/MM/YYYY HH:MM:SS
            });

            if (!productionResponse.ok) {
                const errorData = await productionResponse.json().catch(() => ({error: "Erro desconhecido durante o registro."}));
                throw new Error(errorData.error || 'Erro ao registrar produção.');
            }
            window.showToast('Produção registrada com sucesso!', 'success');
        }

        if (pecasReprovadas > 0) {
            // Usa window.authenticatedFetch para enviar o token JWT
            const eficienciaResponse = await window.authenticatedFetch(`${API_BASE_URL}/eficiencia`, { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ qtd: pecasReprovadas, flag: 'rejeitada', dataHora }), // Envia DD/MM/YYYY HH:MM:SS
            });
            if (!eficienciaResponse.ok) {
                const errorData = await eficienciaResponse.json().catch(() => ({error: "Erro desconhecido ao registrar peças reprovadas."}));
                console.error('Erro ao registrar peças reprovadas:', errorData.error);
                window.showError('Houve um erro ao registrar peças reprovadas: ' + errorData.error);
            } else {
                window.showToast('Peças reprovadas registradas com sucesso!', 'success');
            }
        }

        // Mensagens combinadas para clareza
        if (qtdDados > 0 && pecasReprovadas > 0) {
            window.showToast('Produção e peças reprovadas registradas com sucesso!', 'success');
        } else if (qtdDados > 0) {
             // Já tratado pelo toast de sucesso da produção acima
        } else if (pecasReprovadas > 0) {
            // Já tratado pelo toast de sucesso das peças reprovadas acima
        }

        // Reseta apenas os campos relacionados à produção após o envio bem-sucedido
        qtdDadosInput.value = '';
        pecasReprovadaInput.value = '';

        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        dataHoraProducaoInput.value = (new Date(now - offset)).toISOString().slice(0, 16);

        window.fetchIndicadores(selectedDateForRefresh); // Usa global fetchIndicadores

    } catch (error) {
        console.error('Erro:', error);
        window.showError(error.message);
    }
};

/**
 * Gera e exibe o relatório de produção.
 * Busca dados do endpoint /relatorio para permitir relatórios por intervalo de datas.
 */
window.generateReport = async function() {
    const reportStartDateInput = document.getElementById('reportStartDate');
    const reportEndDateInput = document.getElementById('reportEndDate');
    // As datas do input são YYYY-MM-DD
    const startDateISO = reportStartDateInput.value;
    const endDateISO = reportEndDateInput.value;
    const reportModalContent = document.querySelector('#reportModal .modal-content');

    if (!startDateISO || !endDateISO) {
        window.showError('Por favor, selecione as datas de início e fim para o relatório.');
        reportModalContent.classList.remove('fullscreen-report');
        return;
    }
    if (new Date(startDateISO) > new Date(endDateISO)) {
        window.showError('A data de início não pode ser depois da data de fim.');
        reportModalContent.classList.remove('fullscreen-report');
        return;
    }

    let url = `${API_BASE_URL}/relatorio`;
    const params = new URLSearchParams();
    // Converte YYYY-MM-DD para DD/MM/YYYY para enviar ao backend
    params.append('startDate', window.formatDateForDB(startDateISO));
    params.append('endDate', window.formatDateForDB(endDateISO));
    url += `?${params.toString()}`;

    try {
        // Usa window.authenticatedFetch para enviar o token JWT
        const response = await window.authenticatedFetch(url); 
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const errorMessage = errorData?.error || 'Erro desconhecido ao buscar dados para o relatório.';
            throw new Error(errorMessage);
        }
        const dailyReportData = await response.json();

        const reportResultDiv = document.getElementById('reportResult');
        reportResultDiv.innerHTML = '';
        reportResultDiv.style.display = 'block';

        document.getElementById('downloadOptions').style.display = 'block';

        let totalPiecesEstimatedOverall = 0;
        let totalPiecesProducedOverall = 0;
        let totalPiecesRejectedOverall = 0;

        dailyReportData.forEach(day => {
            totalPiecesEstimatedOverall += Number(day.meta_dia_total) || 0;
            totalPiecesProducedOverall += Number(day.total_produzido_dia) || 0;
            totalPiecesRejectedOverall += Number(day.total_reprovado_dia) || 0;
        });

        // pecasPorCaixa é global
        const totalPiecesApprovedOverall = (totalPiecesProducedOverall * pecasPorCaixa) - totalPiecesRejectedOverall;

        let overallPercentApproved = 0;
        let overallPercentRejected = 0;

        if (totalPiecesProducedOverall * pecasPorCaixa > 0) { 
            overallPercentApproved = ((totalPiecesApprovedOverall / (totalPiecesProducedOverall * pecasPorCaixa)) * 100).toFixed(2);
            overallPercentRejected = ((totalPiecesRejectedOverall / (totalPiecesProducedOverall * pecasPorCaixa)) * 100).toFixed(2);
        }

        const formattedTotalBoxesEstimatedOverall = Math.round(totalPiecesEstimatedOverall).toLocaleString('pt-BR');
        const formattedTotalPiecesEstimatedOverall = Math.round(totalPiecesEstimatedOverall * pecasPorCaixa).toLocaleString('pt-BR');

        const formattedTotalBoxesProducedOverall = Math.round(totalPiecesProducedOverall).toLocaleString('pt-BR');
        const formattedTotalPiecesProducedInUnits = Math.round(totalPiecesProducedOverall * pecasPorCaixa).toLocaleString('pt-BR');
        
        const formattedTotalPiecesApprovedOverall = Math.round(totalPiecesApprovedOverall).toLocaleString('pt-BR');
        const formattedTotalPiecesRejectedOverall = Math.round(totalPiecesRejectedOverall).toLocaleString('pt-BR');

        // Usa as datas ISO para criar objetos Date, depois formata para exibição
        const startDateFormatted = new Date(startDateISO + 'T00:00:00').toLocaleDateString('pt-BR');
        const endDateFormatted = new Date(endDateISO + 'T00:00:00').toLocaleDateString('pt-BR');
        const periodoTexto = startDateISO === endDateISO ?
            `${startDateFormatted}` :
            `${startDateFormatted} a ${endDateFormatted}`;

        const summary = document.createElement('div');
        summary.className = 'report-summary';
        summary.innerHTML = `
            <h3>Resumo do Período: ${periodoTexto}</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-label">Peças Estimadas:</div>
                    <div class="summary-value">${formattedTotalBoxesEstimatedOverall} cx (${formattedTotalPiecesEstimatedOverall} peças)</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Peças Produzidas:</div>
                    <div class="summary-value">${formattedTotalBoxesProducedOverall} cx (${formattedTotalPiecesProducedInUnits} peças)</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Aprovados:</div>
                    <div class="summary-value">${formattedTotalPiecesApprovedOverall} peças</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Reprovados:</div>
                    <div class="summary-value">${formattedTotalPiecesRejectedOverall} peças</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">% Aprovados:</div>
                    <div class="summary-value">${overallPercentApproved}%</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">% Reprovados:</div>
                    <div class="summary-value">${overallPercentRejected}%</div>
                </div>
            </div>
        `;

        reportResultDiv.appendChild(summary);

        if (dailyReportData.length > 0) {
            const detailsSection = document.createElement('div');
            detailsSection.className = 'report-details';

            const detailsTitle = document.createElement('h3');
            detailsTitle.textContent = 'Detalhes Diários';
            detailsSection.appendChild(detailsTitle);

            const table = document.createElement('table');
            table.className = 'report-table';

            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr>
                    <th>Data</th>
                    <th>Meta (peças)</th>
                    <th>Produzido (peças)</th>
                    <th>Aprovado (peças)</th>
                    <th>Reprovado (peças)</th>
                    <th>% Aprovado</th>
                    <th>% Reprovado</th>
                </tr>
            `;
            table.appendChild(thead);

            const tbody = document.createElement('tbody');

            dailyReportData.forEach(day => {
                // report_date vem do backend como YYYY-MM-DD
                const date = new Date(day.report_date).toLocaleDateString('pt-BR');
                const metaPecas = (Number(day.meta_dia_total) || 0) * pecasPorCaixa;
                const produzidoPecas = (Number(day.total_produzido_dia) || 0) * pecasPorCaixa;
                const reprovadoPecas = Number(day.total_reprovado_dia) || 0;
                const aprovadoPecas = produzidoPecas - reprovadoPecas;

                let percentAprovadoDia = 0;
                let percentReprovadoDia = 0; 
                if (produzidoPecas > 0) {
                    percentAprovadoDia = (aprovadoPecas / produzidoPecas * 100).toFixed(2);
                    percentReprovadoDia = (reprovadoPecas / produzidoPecas * 100).toFixed(2);
                }

                const row = document.createElement('tr');
                row.innerHTML = `
                            <tr>
                                <td>${date}</td>
                                <td>${Math.round(metaPecas).toLocaleString('pt-BR')}</td>
                                <td>${Math.round(produzidoPecas).toLocaleString('pt-BR')}</td>
                                <td>${Math.round(aprovadoPecas).toLocaleString('pt-BR')}</td>
                                <td>${Math.round(reprovadoPecas).toLocaleString('pt-BR')}</td>
                                <td>${percentAprovadoDia}%</td>
                                <td>${percentReprovadoDia}%</td>
                            </tr>
                        `;
                tbody.appendChild(row);
            });

            table.appendChild(tbody);
            detailsSection.appendChild(table);
            reportResultDiv.appendChild(detailsSection);
        }

        // Garante que o objeto window.reportData seja construído corretamente.
        window.reportData = {
            summaryData: {
                totalMeta: totalPiecesEstimatedOverall,
                totalProduzido: totalPiecesProducedOverall,
                totalAprovado: totalPiecesApprovedOverall,
                totalReprovado: totalPiecesRejectedOverall,
                percentAprovados: overallPercentApproved,
                percentReprovados: overallPercentRejected,
                caixasEstimadas: totalPiecesEstimatedOverall,
                caixasProduzidas: totalPiecesProducedOverall
            },
            detailedData: dailyReportData,
            startDate: startDateISO, 
            endDate: endDateISO 
        };

    } catch (error) { 
        console.error('Error generating report:', error); 
        window.showError('Erro ao gerar relatório: ' + error.message);
        const reportResultDiv = document.getElementById('reportResult');
        reportResultDiv.innerHTML = `<p style="color: red;">Erro ao gerar relatório: ${error.message}</p>`;
        reportResultDiv.style.display = 'block';
        document.getElementById('downloadOptions').style.display = 'none';
    }
};

// --- Report Download Functions ---

/**
 * Downloads the report as a TXT file.
 */
window.downloadReportTxt = function() {
    if (!window.reportData) {
        window.showError('Nenhum dado de relatório para baixar.');
        return;
    }

    const { summaryData, detailedData, startDate, endDate } = window.reportData;

    const startDateFormatted = new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR');
    const endDateFormatted = new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR');
    const periodoTexto = startDate === endDate ? `${startDateFormatted}` : `${startDateFormatted} a ${endDateFormatted}`;

    let textContent = `RELATÓRIO DE PRODUÇÃO\n`;
    textContent += `Período: ${periodoTexto}\n\n`;

    textContent += `RESUMO DO PERÍODO:\n`;
    textContent += `Peças Estimadas: ${summaryData.caixasEstimadas.toLocaleString('pt-BR')} cx (${Math.round(summaryData.totalMeta * pecasPorCaixa).toLocaleString('pt-BR')} peças)\n`;
    textContent += `Peças Produzidas: ${summaryData.caixasProduzidas.toLocaleString('pt-BR')} cx (${Math.round(summaryData.totalProduzido * pecasPorCaixa).toLocaleString('pt-BR')} peças)\n`;
    textContent += `Total Aprovados: ${Math.round(summaryData.totalAprovado).toLocaleString('pt-BR')} peças (${summaryData.percentAprovados}%)\n`;
    textContent += `Total Reprovados: ${Math.round(summaryData.totalReprovado).toLocaleString('pt-BR')} peças (${summaryData.percentReprovados}%)\n\n`;

    textContent += `DETALHES DIÁRIOS:\n`;
    textContent += `Data\tMeta (peças)\tProduzido (peças)\tAprovado (peças)\tReprovado (peças)\t% Aprovado\t% Reprovado\n`;
    detailedData.forEach(day => {
        const date = new Date(day.report_date).toLocaleDateString('pt-BR');
        const metaPecas = (Number(day.meta_dia_total) || 0) * pecasPorCaixa;
        const produzidoPecas = (Number(day.total_produzido_dia) || 0) * pecasPorCaixa;
        const reprovadoPecas = Number(day.total_reprovado_dia) || 0;
        const aprovadoPecas = produzidoPecas - reprovadoPecas;
        let percentAprovadoDia = (produzidoPecas > 0) ? (aprovadoPecas / produzidoPecas * 100).toFixed(2) : 0;
        let percentReprovadoDia = (produzidoPecas > 0) ? (reprovadoPecas / produzidoPecas * 100).toFixed(2) : 0;
        textContent += `${date}\t${Math.round(metaPecas).toLocaleString('pt-BR')}\t${Math.round(produzidoPecas).toLocaleString('pt-BR')}\t${Math.round(aprovadoPecas).toLocaleString('pt-BR')}\t${Math.round(reprovadoPecas).toLocaleString('pt-BR')}\t${percentAprovadoDia}%\t${percentReprovadoDia}%}\n`;
    });

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_producao_${periodoTexto.replace(/[/ ]/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    window.showToast('Relatório TXT gerado com sucesso!', 'success');
};

/**
 * Downloads the report as an Excel file (XLSX) with basic formatting.
 */
window.downloadReportExcel = async function() { 
    if (!window.reportData) {
        window.showError('Nenhum dado de relatório para baixar.');
        return;
    }

    const { summaryData, detailedData, startDate, endDate } = window.reportData;

    const startDateFormatted = new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR');
    const endDateFormatted = new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR');
    const periodoTexto = startDate === endDate ? `${startDateFormatted}` : `${startDateFormatted} a ${endDateFormatted}`;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Dashboard de Produção';
    workbook.lastModifiedBy = 'Dashboard de Produção';
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet('Relatório de Produção');

    worksheet.addRow(['RELATÓRIO DE PRODUÇÃO']).font = { bold: true, size: 16 };
    worksheet.mergeCells('A1:H1'); 
    worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.addRow([`Período: ${periodoTexto}`]).font = { bold: true, size: 12 };
    worksheet.mergeCells('A2:H2');
    worksheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.addRow([]); 

    worksheet.addRow(['RESUMO DO PERÍODO:']).font = { bold: true };
    const summaryHeaderRow = worksheet.addRow([
        "Peças Estimadas (cx)", "Peças Estimadas (peças)", "Peças Produzidas (cx)", "Peças Produzidas (peças)",
        "Total Aprovados (peças)", "% Aprovados", "Total Reprovados (peças)", "% Reprovados"
    ]);
    summaryHeaderRow.eachCell(cell => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } }; 
        cell.alignment = { vertical: 'middle', horizontal: 'center' }; 
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });


    const summaryValuesRow = worksheet.addRow([
        summaryData.caixasEstimadas,
        Math.round(summaryData.totalMeta * pecasPorCaixa),
        summaryData.caixasProduzidas,
        Math.round(summaryData.totalProduzido * pecasPorCaixa),
        Math.round(summaryData.totalAprovado),
        parseFloat(summaryData.percentAprovados) / 100, 
        Math.round(summaryData.totalReprovado),
        parseFloat(summaryData.percentReprovados) / 100
    ]);
    summaryValuesRow.eachCell((cell, colNumber) => {
        if (colNumber === 6 || colNumber === 8) { 
            cell.numFmt = '0.00%'; 
        } else { 
             cell.numFmt = '#,##0'; 
        }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }; 
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    worksheet.addRow([]); 

    worksheet.addRow(['DETALHES DIÁRIOS:']).font = { bold: true };
    const detailsHeaderRow = worksheet.addRow([
        "Data", "Meta (peças)", "Produzido (peças)", "Aprovado (peças)",
        "Reprovado (peças)", "% Aprovado", "% Reprovado"
    ]);
    detailsHeaderRow.eachCell(cell => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } }; 
        cell.alignment = { vertical: 'middle', horizontal: 'center' }; 
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    // *** INÍCIO DA MELHORIA ***
    detailedData.forEach(day => {
        const date = new Date(day.report_date); // YYYY-MM-DD
        const metaPecas = (Number(day.meta_dia_total) || 0) * pecasPorCaixa;
        const produzidoPecas = (Number(day.total_produzido_dia) || 0) * pecasPorCaixa;
        const reprovadoPecas = Number(day.total_reprovado_dia) || 0;
        const aprovadoPecas = produzidoPecas - reprovadoPecas;

        let percentAprovadoDia = 0;
        let percentReprovadoDia = 0; 
        if (produzidoPecas > 0) {
            percentAprovadoDia = aprovadoPecas / produzidoPecas; // Salva como decimal para formatação
            percentReprovadoDia = reprovadoPecas / produzidoPecas; // Salva como decimal para formatação
        }

        const row = worksheet.addRow([
            date, // ExcelJS lida com objetos Date
            Math.round(metaPecas),
            Math.round(produzidoPecas),
            Math.round(aprovadoPecas),
            Math.round(reprovadoPecas),
            percentAprovadoDia,
            percentReprovadoDia
        ]);
        
        // Aplica formatação de número e porcentagem
        row.getCell(1).numFmt = 'dd/mm/yyyy';
        row.getCell(2).numFmt = '#,##0';
        row.getCell(3).numFmt = '#,##0';
        row.getCell(4).numFmt = '#,##0';
        row.getCell(5).numFmt = '#,##0';
        row.getCell(6).numFmt = '0.00%';
        row.getCell(7).numFmt = '0.00%';
        row.eachCell(cell => {
             cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
    });
    // *** FIM DA MELHORIA ***

    // Ajusta a largura das colunas
    worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
            const columnText = cell.value ? cell.value.toString() : '';
            if (columnText.length > maxLength) {
                maxLength = columnText.length;
            }
        });
        column.width = maxLength < 10 ? 10 : maxLength + 2;
    });

    // Gerar buffer e acionar download
    try {
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio_producao_${periodoTexto.replace(/[/ ]/g, '_')}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        window.showToast('Relatório Excel (XLSX) gerado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao gerar ou baixar o arquivo XLSX:', error); 
        window.showError('Erro ao gerar ou baixar o relatório Excel: ' + error.message);
    }
};

/**
 * Prints the report using the browser's print functionality.
 */
window.printReport = function() {
    if (!window.reportData) {
        window.showError('Nenhum dado de relatório para imprimir.');
        return;
    }

    const { summaryData, detailedData, startDate, endDate } = window.reportData;

    const startDateFormatted = new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR');
    const endDateFormatted = new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR');
    const periodoTexto = startDate === endDate ? `${startDateFormatted}` : `${startDateFormatted} a ${endDateFormatted}`;

    let printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Relatório de Produção</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1, h2 { color: #007bff; text-align: center; }
                .summary-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 15px;
                    margin-bottom: 30px;
                }
                .summary-item {
                    border: 1px solid #ddd;
                    padding: 15px;
                    border-left: 4px solid #007bff;
                    margin-bottom: 10px; 
                }
                .summary-label {
                    font-weight: bold;
                    color: #666;
                    margin-bottom: 5px;
                }
                .summary-value {
                    font-size: 1.2em;
                    font-weight: bold;
                    color: #333;
                }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
                thead { background-color: #f8f9fa; }
                @media print {
                    .download-options, .action-buttons-container { display: none; }
                }
            </style>
        </head>
        <body>
            <h1>RELATÓRIO DE PRODUÇÃO</h1>
            <h3 style="text-align: center;">Período: ${periodoTexto}</h3>

            <h2>RESUMO DO PERÍODO</h2>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-label">Peças Estimadas:</div>
                    <div class="summary-value">${Math.round(summaryData.totalMeta).toLocaleString('pt-BR')} cx (${Math.round(summaryData.totalMeta * pecasPorCaixa).toLocaleString('pt-BR')} peças)</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Peças Produzidas:</div>
                    <div class="summary-value">${Math.round(summaryData.totalProduzido).toLocaleString('pt-BR')} cx (${Math.round(summaryData.totalProduzido * pecasPorCaixa).toLocaleString('pt-BR')} peças)</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Aprovados:</div>
                    <div class="summary-value">${Math.round(summaryData.totalAprovado).toLocaleString('pt-BR')} peças</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Reprovados:</div>
                    <div class="summary-value">${Math.round(summaryData.totalReprovado).toLocaleString('pt-BR')} peças</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">% Aprovados:</div>
                    <div class="summary-value">${summaryData.percentAprovados}%</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">% Reprovados:</div>
                    <div class="summary-value">${summaryData.percentReprovados}%</div>
                </div>
            </div>

            <h2>DETALHES DIÁRIOS</h2>
            <table>
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Meta (peças)</th>
                        <th>Produzido (peças)</th>
                        <th>Aprovado (peças)</th>
                        <th>Reprovado (peças)</th>
                        <th>% Aprovado</th>
                        <th>% Reprovado</th>
                    </tr>
                </thead>
                <tbody>
                    ${detailedData.map(day => {
                        const date = new Date(day.report_date).toLocaleDateString('pt-BR');
                        const metaPecas = (Number(day.meta_dia_total) || 0) * pecasPorCaixa;
                        const produzidoPecas = (Number(day.total_produzido_dia) || 0) * pecasPorCaixa;
                        const reprovadoPecas = Number(day.total_reprovado_dia) || 0;
                        const aprovadoPecas = produzidoPecas - reprovadoPecas;

                        let percentAprovadoDia = 0;
                        let percentReprovadoDia = 0; 
                        if (produzidoPecas > 0) {
                            percentAprovadoDia = (aprovadoPecas / produzidoPecas * 100).toFixed(2);
                            percentReprovadoDia = (reprovadoPecas / produzidoPecas * 100).toFixed(2);
                        }

                        return `
                            <tr>
                                <td>${date}</td>
                                <td>${Math.round(metaPecas).toLocaleString('pt-BR')}</td>
                                <td>${Math.round(produzidoPecas).toLocaleString('pt-BR')}</td>
                                <td>${Math.round(aprovadoPecas).toLocaleString('pt-BR')}</td>
                                <td>${Math.round(reprovadoPecas).toLocaleString('pt-BR')}</td>
                                <td>${percentAprovadoDia}%</td>
                                <td>${percentReprovadoDia}%</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        window.showToast('Relatório enviado para a impressora!', 'success');
    } else {
        window.showError('Falha ao abrir janela de impressão. Verifique se o bloqueador de pop-ups está ativo.');
    }
};

/**
 * Starts automatic refresh of dashboard data.
 * @param {number} intervalSeconds - Interval in seconds between each refresh.
 */
window.startAutoRefreshDashboard = function(intervalSeconds = 10) {
    window.stopAutoRefreshDashboard(); // Ensure no duplicate intervals
    const intervalMs = intervalSeconds * 1000;

    let stopButton = document.getElementById('stopRefreshButton');
    if (!stopButton) {
        stopButton = document.createElement('button');
        stopButton.id = 'stopRefreshButton';
        stopButton.textContent = 'Parar Atualização Automática';
        stopButton.className = 'action-button secondary';
        stopButton.style.position = 'fixed';
        stopButton.style.bottom = '20px';
        stopButton.style.right = '20px';
        stopButton.style.zIndex = '1000';
        stopButton.addEventListener('click', window.stopAutoRefreshDashboard); // Use global stopAutoRefreshDashboard
        document.body.appendChild(stopButton);
    } else {
        stopButton.style.display = 'inline-block';
    }

    autoRefreshDashboardInterval = setInterval(() => {
        const selectedDate = document.getElementById('selectedDate').value; // YYYY-MM-DD
        window.fetchIndicadores(selectedDate); // Use global fetchIndicadores
    }, intervalMs);
    window.showToast(`Atualização automática do Dashboard ativada (${intervalSeconds}s)!`, 'success', 2000);
};

/**
 * Stops automatic dashboard refresh.
 */
window.stopAutoRefreshDashboard = function() {
    if (autoRefreshDashboardInterval) {
        clearInterval(autoRefreshDashboardInterval);
        autoRefreshDashboardInterval = null;
        window.showToast('Atualização automática do Dashboard desativada.', 'info', 1500);
        const stopButton = document.getElementById('stopRefreshButton');
        if (stopButton) {
            stopButton.style.display = 'none';
        }
    }
};

// Add event listeners specific to dashboard elements
document.addEventListener('DOMContentLoaded', function() {
    // Estes listeners são mantidos aqui porque são para elementos fixos no DOM do dashboard.html
    // e não dependem de re-renderizações dinâmicas.

    const registerProductionBtn = document.getElementById('registerProductionBtn');
    if (registerProductionBtn) {
        registerProductionBtn.addEventListener('click', window.openRegisterModal); 
    }

    const updateMetaButton = document.getElementById('updateMetaBtn');
    if (updateMetaButton) {
        updateMetaButton.addEventListener('click', window.updateDailyMeta); 
    }

    const registerProductionForm = document.getElementById('registerProductionForm');
    if (registerProductionForm) {
        registerProductionForm.addEventListener('submit', window.registerProduction); 
    }

    const generateReportModalBtn = document.getElementById('generateReportModalBtn');
    if (generateReportModalBtn) {
        generateReportModalBtn.addEventListener('click', function() {
            const modal = document.getElementById('reportModal');
            if (modal) {
                const today = new Date();
                const lastMonth = new Date();
                lastMonth.setMonth(today.getMonth() - 1);

                document.getElementById('reportStartDate').value = lastMonth.toISOString().split('T')[0];
                document.getElementById('reportEndDate').value = today.toISOString().split('T')[0];

                document.getElementById('reportResult').innerHTML = '';
                document.getElementById('reportResult').style.display = 'none';
                document.getElementById('downloadOptions').style.display = 'none';

                window.openModal('reportModal'); 
                // CRÍTICO: Aplica permissões ao modal de relatório ao abri-lo.
                // Esta chamada garante que os botões de download/impressão dentro do modal
                // sejam habilitados/desabilitados com base na role do usuário.
                if (window.applyUIPermissions) {
                    window.applyUIPermissions(window.getCurrentUser()?.role);
                } else {
                    console.error("permissions-ui.js não foi carregado ou applyUIPermissions/getCurrentUser não está definido!");
                }
            }
        });
    }

    const generateReportBtn = document.getElementById('generateReportBtn');
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', window.generateReport); 
    }

    const downloadTxtBtn = document.getElementById('downloadTxt');
    const downloadExcelBtn = document.getElementById('downloadExcel');
    const printReportBtn = document.getElementById('printReport');

    if (downloadTxtBtn) {
        downloadTxtBtn.addEventListener('click', window.downloadReportTxt); 
    }
    if (downloadExcelBtn) {
        downloadExcelBtn.addEventListener('click', window.downloadReportExcel); 
    }
    if (printReportBtn) {
        printReportBtn.addEventListener('click', window.printReport); 
    }

    const toggleFullscreenDashboard = document.getElementById('toggleFullscreenDashboard');
    if (toggleFullscreenDashboard) {
        toggleFullscreenDashboard.addEventListener('click', function() {
            if (!document.fullscreenElement) {
                if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen();
                } else if (document.documentElement.webkitRequestFullscreen) {
                    document.documentElement.webkitRequestFullscreen();
                } else if (document.documentElement.msRequestFullscreen) {
                    document.documentElement.msRequestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.documentElement.msExitFullscreen) {
                    document.exitFullscreen();
                }
            }
        });
    }
});

/**
 * NOVO: Verifica e exibe alertas de aprovação pendente no Dashboard (Tela 1).
 * Esta função é chamada após o login ou restauração da sessão.
 */
window.checkAndDisplayDashboardAlerts = async function() {
    // 1. CONTROLE DE ESTADO: Bloqueia chamadas subsequentes enquanto a renderização estiver em andamento.
    if (isRenderingAlerts) {
        console.warn("checkAndDisplayDashboardAlerts: Renderização já em andamento. Ignorando chamada.");
        return;
    }
    isRenderingAlerts = true;
    
    const container = document.getElementById('dashboardAlertContainer');
    if (!container) {
        isRenderingAlerts = false;
        return; 
    }
    
    // CORREÇÃO CRÍTICA: Limpa TUDO no contêiner antes de começar para evitar duplicação.
    container.innerHTML = ''; 

    // Obtém as permissões do usuário logado
    const permissions = window.userPermissions || [];
    const isSuperUser = permissions.includes('project.edit') || permissions.includes('project.delete') || permissions.includes('bom.approve.diretoria');

    if (permissions.length === 0) {
        isRenderingAlerts = false;
        return; 
    }

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/solicitacoes/counts-by-project`);
        if (!response.ok) throw new Error("Não foi possível carregar as contagens de solicitações por projeto.");
        
        const countsByProject = await response.json();

        let hasAlerts = false;
        
        // 1. Alerta para Líder (Aprova o 1º nível: Aguardando Aprovação Líder)
        const projectsLider = countsByProject['Aguardando Aprovação Líder'] || [];
        const countLider = projectsLider.length;
        
        if (permissions.includes('project.shopping.approve') && countLider > 0) {
            const alertDiv = createAlertElement(
                'alert-gerencia',
                'fas fa-user-check',
                `Você tem <strong>${countLider}</strong> ${countLider > 1 ? 'projetos' : 'projeto'} com itens aguardando sua <strong>Aprovação de Líder</strong>.`,
                'Verificar projetos <i class="fas fa-arrow-right"></i>'
            );
            
            alertDiv.onclick = (e) => {
                e.preventDefault();
                filterProjectsByAlert(projectsLider);
            };
            
            container.appendChild(alertDiv);
            hasAlerts = true;
        }

        // 2. Alerta para Gerência (Aprova o 2º nível: Aguardando Aprovação)
        const projectsGerencia = countsByProject['Aguardando Aprovação'] || [];
        const countGerencia = projectsGerencia.length;
        
        if (permissions.includes('project.shopping.approve') && countGerencia > 0) {
            const alertDiv = createAlertElement(
                'alert-gerencia',
                'fas fa-vote-yea',
                `Você tem <strong>${countGerencia}</strong> ${countGerencia > 1 ? 'projetos' : 'projeto'} com itens aguardando sua <strong>Aprovação de Gestor</strong>.`,
                'Verificar projetos <i class="fas fa-arrow-right"></i>'
            );
            
            alertDiv.onclick = (e) => {
                e.preventDefault();
                filterProjectsByAlert(projectsGerencia);
            };
            
            container.appendChild(alertDiv);
            hasAlerts = true;
        }

        // 3. Alerta para Compras (Vê o nível de cotação: Em Cotação)
        const projectsCompras = countsByProject['Em Cotação'] || [];
        const countCompras = projectsCompras.length;

        if (permissions.includes('acquisitions.view') && countCompras > 0) {
            const alertDiv = createAlertElement(
                'alert-compras',
                'fas fa-hand-holding-usd',
                `Existem <strong>${countCompras}</strong> ${countCompras > 1 ? 'projetos' : 'projeto'} com itens aguardando cotação.`,
                'Verificar projetos <i class="fas fa-arrow-right"></i>'
            );
            
            alertDiv.onclick = (e) => {
                e.preventDefault();
                filterProjectsByAlert(projectsCompras);
            };
            
            container.appendChild(alertDiv);
            hasAlerts = true;
        }

        // 4. Alerta para Diretoria (Aprova o nível final: Aguardando Aprovação Diretoria)
        const projectsDiretoria = countsByProject['Aguardando Aprovação Diretoria'] || [];
        const countDiretoria = projectsDiretoria.length;

        if (permissions.includes('bom.approve.diretoria') && countDiretoria > 0) {
            const alertDiv = createAlertElement(
                'alert-diretoria',
                'fas fa-user-tie',
                `Existem <strong>${countDiretoria}</strong> ${countDiretoria > 1 ? 'projetos' : 'projeto'} com itens aguardando sua aprovação final.`,
                'Verificar projetos <i class="fas fa-arrow-right"></i>'
            );
            
            alertDiv.onclick = (e) => {
                e.preventDefault();
                filterProjectsByAlert(projectsDiretoria);
            };
            
            container.appendChild(alertDiv);
            hasAlerts = true;
        }
        
        // Se não houver alertas, esconde o container
        if (!hasAlerts) {
            container.style.display = 'none';
        } else {
            container.style.display = 'flex';
        }

    } catch (error) {
        console.warn("Não foi possível carregar alertas do dashboard:", error.message);
        container.innerHTML = `<p class="error-message">Não foi possível carregar alertas: ${error.message}</p>`;
    } finally {
        // 2. CONTROLE DE ESTADO: Libera a função para que possa ser chamada novamente.
        isRenderingAlerts = false;
    }
};
