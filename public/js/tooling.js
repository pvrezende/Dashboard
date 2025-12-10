// tooling.js (VERSÃO FINAL COM CORREÇÃO VISUAL PARA EXIBIÇÃO DE HORAS PEQUENAS E FUNÇÕES GLOBAIS)

let currentToolId = null;
let toolingAutoRefreshInterval = null;

// Função auxiliar para converter entrada do usuário "H.MM" (onde MM são minutos) para o TOTAL DE MINUTOS (inteiro)
// Ex: "0.10" -> 10; "1.01" -> 61; "8.50" -> 530
window.convertUserHMMToTotalMinutes = function(userInputValue) {
    console.log(`convertUserHMMToTotalMinutes: RAW Input received: "${userInputValue}"`);
    if (userInputValue === null || userInputValue === undefined || String(userInputValue).trim() === "") {
        console.log(`convertUserHMMToTotalMinutes: Input vazio ou nulo, retornando null.`);
        return null;
    }

    const valueStr = String(userInputValue).trim().replace(',', '.');
    const parts = valueStr.split('.');
    let hours = parseFloat(parts[0]);
    let minutes = 0;

    if (isNaN(hours)) {
        hours = 0;
    }

    if (parts.length > 1) {
        let minuteStr = parts[1];
        if (minuteStr.length === 1) {
            minuteStr += '0';
        }
        minutes = parseInt(minuteStr.substring(0, 2));
        if (isNaN(minutes)) {
            minutes = 0;
        }
    }

    const totalMinutes = (hours * 60) + minutes;
    console.log(`convertUserHMMToTotalMinutes: Input "${userInputValue}" converted to ${totalMinutes} total minutes.`);

    return totalMinutes;
};

// Converte o TOTAL DE MINUTOS (inteiro) para HORAS DECIMAIS (para o banco de dados DECIMAL(10,4))
// Ex: 10 -> 0.1667; 61 -> 1.0167
window.convertTotalMinutesToDecimalHours = function(totalMinutes) {
    if (totalMinutes === null || totalMinutes === undefined || isNaN(totalMinutes) || totalMinutes < 0) {
        return null;
    }
    const decimalHours = totalMinutes / 60;
    const roundedDecimalHours = Math.round(decimalHours * 10000) / 10000; // Arredonda para 4 casas decimais para DB
    console.log(`convertTotalMinutesToDecimalHours: ${totalMinutes} minutes converted to ${roundedDecimalHours} decimal hours.`);
    return roundedDecimalHours;
};


// NOVA VERSÃO: Converte HORAS DECIMAIS (do banco) para o formato de exibição "H.MM" (H horas e MM minutos)
// Esta função é o foco da correção.
window.convertDecimalHoursToHMMDisplay = function(decimalHoursValue) {
    console.log(`convertDecimalHoursToHMMDisplay: Value received for display (decimal): ${decimalHoursValue}`);

    if (decimalHoursValue === null || decimalHoursValue === undefined || isNaN(decimalHoursValue)) {
        return '0.00';
    }

    if (decimalHoursValue === 0) {
        return '0.00';
    }
    
    if (decimalHoursValue > 0 && decimalHoursValue < 0.01) {
        console.log(`convertDecimalHoursToHMMDisplay: Valor decimal ${decimalHoursValue} muito pequeno, forçando display para 0.01.`);
        return '0.01';
    }

    const totalSeconds = Math.round(decimalHoursValue * 3600);
    const hours = Math.floor(totalSeconds / 3600);
    const remainingSeconds = totalSeconds % 3600;
    const minutes = Math.round(remainingSeconds / 60);

    const formattedMinutes = String(minutes).padStart(2, '0');

    const displayResult = `${hours}.${formattedMinutes}`;
    console.log(`convertDecimalHoursToHMMDisplay: Displaying: ${displayResult} for decimalHoursValue: ${decimalHoursValue}`);
    return displayResult;
};


// Handler para o botão 'Adicionar Ferramenta' no modal de cadastro
const handleAddToolFormSubmit = async (event) => {
    event.preventDefault();
    const toolName = document.getElementById('toolName').value;
    const toolDescription = document.getElementById('toolDescription').value;
    const toolOperator = "Não Informado";

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/ferramentas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: toolName, descricao: toolDescription, operador: toolOperator }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido ao adicionar ferramenta. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao adicionar ferramenta.');
        }

        const result = await response.json();
        window.showToast(result.message, 'success');
        document.getElementById('addToolForm').reset();
        window.fetchAndRenderTools();
    } catch (error) {
        console.error('Erro ao adicionar ferramenta:', error);
        window.showError('Erro ao adicionar ferramenta: ' + error.message);
    }
};

// Handler para o botão 'Salvar Alterações' no modal de edição de ferramenta
const handleEditToolFormSubmit = async (event) => {
    event.preventDefault();
    const toolId = document.getElementById('editToolId').value;
    const toolName = document.getElementById('editToolName').value;
    const toolDescription = document.getElementById('editToolDescription').value;
    const toolOperator = document.getElementById('editToolOperator').value;

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/ferramentas/${toolId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: toolName, descricao: toolDescription, operador: toolOperator }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido ao atualizar ferramenta. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao atualizar ferramenta.');
        }

        const result = await response.json();
        window.showToast(result.message, 'success');
        window.closeModal('editToolModal');
        window.fetchAndRenderTools();
        if (document.getElementById('tela5').classList.contains('active')) {
            window.initializeProducaoScreen();
        }
    } catch (error) {
        console.error('Erro ao atualizar ferramenta:', error);
        window.showError('Erro ao atualizar ferramenta: ' + error.message);
    }
};


/**
 * Inicializa a tela de Ferramentaria, buscando e exibindo as ferramentas.
 */
window.initializeToolingScreen = function() {
    console.log('Ferramentaria: Inicializando tela...');
    window.fetchAndRenderTools();

    const addToolForm = document.getElementById('addToolForm');
    if (addToolForm) {
        addToolForm.reset();
        addToolForm.removeEventListener('submit', handleAddToolFormSubmit);
        addToolForm.addEventListener('submit', handleAddToolFormSubmit);
    }

    const editToolForm = document.getElementById('editToolForm');
    if (editToolForm) {
        editToolForm.removeEventListener('submit', handleEditToolFormSubmit);
        editToolForm.addEventListener('submit', handleEditToolFormSubmit);
    }

    const generateToolingReportBtn = document.getElementById('generateToolingReportBtn');
    if (generateToolingReportBtn) {
        generateToolingReportBtn.removeEventListener('click', openToolingReportModal);
        generateToolingReportBtn.addEventListener('click', openToolingReportModal);
    }

    setupToolSubStagesModalListeners();
};

/**
 * Busca todas as ferramentas e suas sub-etapas e as renderiza.
 */
window.fetchAndRenderTools = async function() {
    console.log('Ferramentaria: Buscando e renderizando ferramentas...');
    const toolListContainer = document.getElementById('toolList');
    if (!toolListContainer) {
        console.warn('Ferramentaria: Elemento #toolList não encontrado.');
        return;
    }
    toolListContainer.innerHTML = '<p class="no-tools">Carregando ferramentas...</p>';
    try {
        const toolsResponse = await window.authenticatedFetch(`${API_BASE_URL}/ferramentas`);
        if (!toolsResponse.ok) {
            const errorData = await toolsResponse.json().catch(() => ({ error: 'Erro desconhecido ao buscar ferramentas. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao buscar ferramentas.');
        }
        let tools = await toolsResponse.json();

        if (tools.length === 0) {
            toolListContainer.innerHTML = '<p class="no-tools">Nenhuma ferramenta cadastrada ainda.</p>';
            return;
        }

        const toolsWithSubStagesPromises = tools.map(async (tool) => {
            try {
                // Adicionando um cache-buster para garantir dados frescos
                const cacheBuster = `_t=${new Date().getTime()}`;
                const subStagesResponse = await window.authenticatedFetch(`${API_BASE_URL}/ferramentas/${tool.id}/sub_etapas_producao?includeProjectName=true&${cacheBuster}`);
                if (subStagesResponse.ok) {
                    tool.subEtapasProducao = await subStagesResponse.json();
                } else {
                    tool.subEtapasProducao = [];
                    console.warn(`Ferramentaria: Não foi possível carregar sub-etapas para a ferramenta ${tool.nome} (ID: ${tool.id}).`);
                }
            } catch (e) {
                tool.subEtapasProducao = [];
                console.error(`Ferramentaria: Erro ao buscar sub-etapas para a ferramenta ${tool.nome} (ID: ${tool.id}):`, e);
            }
            return tool;
        });

        const toolsWithSubStages = await Promise.all(toolsWithSubStagesPromises);

        toolListContainer.innerHTML = '';
        toolsWithSubStages.forEach(tool => {
            const toolCard = createToolCard(tool);
            toolListContainer.appendChild(toolCard);
        });
        
    } catch (error) {
        console.error('Ferramentaria: Erro ao carregar e renderizar ferramentas:', error);
        toolListContainer.innerHTML = '<p class="no-tools" style="color:red;">Erro ao carregar ferramentas. Tente novamente.</p>';
        window.showError('Erro ao carregar ferramentas: ' + error.message);
    }
};

// ***** INÍCIO DA CORREÇÃO *****
// A função foi limpa para remover a lógica de permissão incorreta e duplicada.
function createToolCard(tool) {
    const card = document.createElement('div');
    card.className = 'tool-card';
    card.dataset.toolId = tool.id;

    const toolInfo = document.createElement('div');
    toolInfo.className = 'tool-info';

    let operatorDisplay = tool.operador && tool.operador !== 'Não Informado' ? ` - Operador Principal: ${tool.operador}` : '';
    if (!operatorDisplay) {
        const primarySubStageOperator = getPrincipalOperator(tool.subEtapasProducao);
        if (primarySubStageOperator) {
            operatorDisplay = ` - Operador Atual: ${primarySubStageOperator}`;
        }
    }

    toolInfo.innerHTML = `
        <h4>${tool.nome}${operatorDisplay}</h4> <p><strong>Cadastro:</strong> ${window.formatDate(tool.data_cadastro, true)}</p>
        ${tool.descricao ? `<p class="tool-description">${tool.descricao}</p>` : ''}
    `;
    card.appendChild(toolInfo);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const subEtapasDoDia = tool.subEtapasProducao.filter(subEtapa => {
        if (!subEtapa.data_sub_etapa) return false;
        const seDate = window.parseDDMMYYYYtoDate(subEtapa.data_sub_etapa);
        return seDate && seDate.getTime() === today.getTime();
    });

    let overallPercentage = 0;
    let progressStatusClass = 'tool-progress-pending';
    let progressStatusText = '0% Sem Atividades Hoje';

    const totalSubEtapasDoDia = subEtapasDoDia.length;
    const completedSubEtapasDoDia = subEtapasDoDia.filter(ss => ss.concluida).length;

    if (totalSubEtapasDoDia > 0) {
        overallPercentage = (completedSubEtapasDoDia / totalSubEtapasDoDia) * 100;
        overallPercentage = parseFloat(overallPercentage.toFixed(2));
    }

    let hasDelayedNonCompletedToday = false;
    let hasInProgressNonCompletedToday = false;

    if (subEtapasDoDia.length > 0) {
        for (const ss of subEtapasDoDia) {
            if (!ss.concluida) {
                const status = getSubStageStatus(ss, today);
                if (status === 'atrasada') {
                    hasDelayedNonCompletedToday = true;
                    break;
                } else if (status === 'em-andamento') {
                    hasInProgressNonCompletedToday = true;
                }
            }
        }
    }
    
    const isTimerActiveForTool = activeBackendTimers && activeBackendTimers.has(tool.id);

    if (isTimerActiveForTool) {
        progressStatusClass = 'tool-progress-in-process';
        progressStatusText = `${overallPercentage}% Em Processo Hoje`;
    } else if (totalSubEtapasDoDia === 0) {
        progressStatusClass = 'tool-progress-pending';
        progressStatusText = '0% Sem Atividades Hoje';
    } else if (overallPercentage === 100) {
        progressStatusClass = 'tool-progress-completed';
        progressStatusText = `100% Concluído Hoje`;
    } else if (hasDelayedNonCompletedToday) {
        progressStatusClass = 'tool-progress-delayed';
        progressStatusText = `${overallPercentage}% Atrasado Hoje`;
    } else if (hasInProgressNonCompletedToday || overallPercentage > 0) {
        progressStatusClass = 'tool-progress-in-progress';
        progressStatusText = `${overallPercentage}% Em Andamento Hoje`;
    } else { 
        progressStatusClass = 'tool-progress-pending';
        progressStatusText = `${overallPercentage}% Pendente Hoje`;
    }

    const toolProgressBar = document.createElement('div');
    toolProgressBar.className = 'tool-progress-bar';
    toolProgressBar.innerHTML = `
        <div class="tool-progress-header">
            <h5>Progresso Geral:</h5>
            <span class="tool-progress-indicator ${progressStatusClass}">${progressStatusText}</span>
        </div>
        <div class="progress-bar-container">
            <div class="progress-bar-fill ${progressStatusClass}" style="width: ${overallPercentage}%"></div>
            <span class="progress-bar-text">${overallPercentage}%</span>
        </div>
    `;
    card.appendChild(toolProgressBar);

    let toolUsage = calculateToolUsage(tool.subEtapasProducao);

    const toolUsageSection = document.createElement('div');
    toolUsageSection.className = 'tool-progress-bar';
    toolUsageSection.innerHTML = `
        <div class="tool-progress-header">
            <h5>Uso da Ferramenta por Período:</h5>
        </div>
        <div class="tool-usage-details">
            <p><strong>Horas Totais Registradas:</strong> ${convertDecimalHoursToHMMDisplay(toolUsage.totalHours)}h</p>
            <p><strong>Média Diária (dias com uso):</strong> ${convertDecimalHoursToHMMDisplay(toolUsage.averageDailyHours)}h</p>
            <p><strong>Uso nos últimos 7 dias:</strong> ${convertDecimalHoursToHMMDisplay(toolUsage.last7DaysHours)}h</p>
            <p><strong>Uso nos últimos 30 dias:</strong> ${convertDecimalHoursToHMMDisplay(toolUsage.last30DaysHours)}h</p>
        </div>
    `;
    card.appendChild(toolUsageSection);


    const subEtapasVisualList = document.createElement('div');
    subEtapasVisualList.className = 'tool-sub-etapas-overview';
    if (tool.subEtapasProducao && tool.subEtapasProducao.length > 0) {
        const nonCompletedSubStages = tool.subEtapasProducao.filter(ss => !ss.concluida);

        if (nonCompletedSubStages.length > 0) {
            const sortedNonCompletedSubStages = nonCompletedSubStages.slice().sort((a, b) => {
                const statusA = getSubStageStatus(a, today);
                const statusB = getSubStageStatus(b, today);
                const statusOrder = { 'atrasada': 1, 'em-andamento': 2, 'pendente': 3 };

                if (statusOrder[statusA] !== statusOrder[statusB]) {
                    return statusOrder[statusA] - statusOrder[statusB];
                }

                const dateA = a.data_sub_etapa ? new Date(a.data_sub_etapa.split('/').reverse().join('-')) : new Date(0);
                const dateB = b.data_sub_etapa ? new Date(b.data_sub_etapa.split('/').reverse().join('-')) : new Date(0);
                
                if (dateA.getTime() !== dateB.getTime()) {
                    return dateA.getTime() - dateB.getTime();
                }

                const timeA = a.hora_inicio_turno ? parseInt(a.hora_inicio_turno.replace(':', ''), 10) : 0;
                const timeB = b.hora_inicio_turno ? parseInt(b.hora_inicio_turno.replace(':', ''), 10) : 0;
                return timeA - timeB;
            });

            const relevantSubStages = sortedNonCompletedSubStages.slice(0, 5);

            if (relevantSubStages.length > 0) {
                const listHeader = document.createElement('h5');
                listHeader.textContent = 'Próximas Atividades:';
                subEtapasVisualList.appendChild(listHeader);

                relevantSubStages.forEach(subStage => {
                    const subEtapaItem = document.createElement('div');
                    subEtapaItem.className = 'tool-sub-etapa-item-overview';

                    const status = getSubStageStatus(subStage, today);
                    const projectNameText = subStage.nome_projeto ? ` (Projeto: ${subStage.nome_projeto})` : '';
                    const dateText = subStage.data_sub_etapa ? ` em ${subStage.data_sub_etapa}` : '';
                    const timeText = (subStage.hora_inicio_turno && subStage.hora_fim_turno) ? ` (${subStage.hora_inicio_turno}-${subStage.hora_fim_turno})` : '';
                    const operatorText = subStage.operador ? ` por ${subStage.operador}` : '';


                    subEtapaItem.innerHTML = `
                        <span class="sub-etapa-dot sub-etapa-dot-${status}" title="Status: ${status}"></span>
                        <span class="sub-etapa-text">
                            <strong>${subStage.descricao}</strong>${projectNameText}${operatorText}${dateText}${timeText}
                        </span>
                    `;
                    subEtapasVisualList.appendChild(subEtapaItem);
                });
            } else {
                 subEtapasVisualList.innerHTML = '<p class="tool-sub-etapas-none">Nenhuma sub-etapa pendente ou em andamento para esta ferramenta.</p>';
            }
        } else {
             subEtapasVisualList.innerHTML = '<p class="tool-sub-etapas-none">Nenhuma sub-etapa pendente ou em andamento para esta ferramenta.</p>';
        }

    } else {
        subEtapasVisualList.innerHTML = '<p class="tool-sub-etapas-none">Nenhuma sub-etapa definida para esta ferramenta.</p>';
    }
    card.appendChild(subEtapasVisualList);

    const toolActions = document.createElement('div');
    toolActions.className = 'tool-actions';

    // Apenas cria os botões. A lógica de mostrar/esconder será feita pelo permissions-ui.js
    const detailsToolBtn = document.createElement('button');
    detailsToolBtn.className = 'action-button info details-btn';
    detailsToolBtn.innerHTML = '<i class="fas fa-info-circle"></i> Detalhes';
    detailsToolBtn.addEventListener('click', () => window.openToolDetailsModal(tool.id));
    toolActions.appendChild(detailsToolBtn);

    const viewSubStagesBtn = document.createElement('button');
    viewSubStagesBtn.className = 'action-button view-sub-stages';
    viewSubStagesBtn.innerHTML = '<i class="fas fa-tasks"></i> Gerenciar Sub-etapas';
    viewSubStagesBtn.addEventListener('click', () => window.openToolSubStagesModal(tool.id, tool.nome));
    toolActions.appendChild(viewSubStagesBtn);

    const editToolBtn = document.createElement('button');
    editToolBtn.className = 'action-button primary edit-btn';
    editToolBtn.innerHTML = '<i class="fas fa-edit"></i> Editar';
    editToolBtn.addEventListener('click', () => window.openEditToolModal(tool.id));
    toolActions.appendChild(editToolBtn);

    const deleteToolBtn = document.createElement('button');
    deleteToolBtn.className = 'action-button danger delete-btn';
    deleteToolBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Excluir';
    deleteToolBtn.addEventListener('click', () => window.openDeleteToolConfirmModal(tool.id, tool.nome));
    toolActions.appendChild(deleteToolBtn);
    
    card.appendChild(toolActions);

    return card;
}
// ***** FIM DA CORREÇÃO *****

/**
 * Função auxiliar para determinar o status de uma sub-etapa.
 * @param {Object} subStage - O objeto da sub-etapa.
 * @param {Date} today - A data atual (meia-noite).
 * @returns {string} O status: 'concluida', 'atrasada', 'em-andamento', 'pendente'.
 */
function getSubStageStatus(subStage, today) {
    if (subStage.concluida) {
        return 'concluida';
    }

    if (subStage.data_sub_etapa) {
        try {
            const dateString = String(subStage.data_sub_etapa); // Formato DD/MM/YYYY
            const [day, month, year] = dateString.split('/');
            const subStageDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            subStageDate.setHours(0,0,0,0);

            const todayNormalized = new Date();
            todayNormalized.setHours(0,0,0,0);

            if (!isNaN(subStageDate.getTime())) {
                if (subStageDate.getTime() < todayNormalized.getTime()) {
                    return 'atrasada';
                } else {
                    return 'em-andamento';
                }
            }
        }
        catch (e) {
            console.error("Erro na lógica de data para sub-etapa de ferramenta em card:", e);
            return 'pendente';
        }
    }

    return 'pendente';
}

/**
 * Função auxiliar para determinar o operador principal de uma ferramenta
 * baseado nas sub-etapas. Prioriza operadores em sub-etapas ativas/recentes.
 * @param {Array<Object>} subStages - Array de sub-etapas de produção.
 * @returns {string|null} Nome do operador principal ou null.
 */
function getPrincipalOperator(subStages) {
    if (!subStages || subStages.length === 0) {
        return null;
    }

    const relevantSubStages = subStages.filter(ss => ss.operador && typeof ss.operador === 'string' && ss.operador.trim() !== '')
                                      .sort((a, b) => {
                                          const dateA = a.data_sub_etapa ? new Date(a.data_sub_etapa.split('/').reverse().join('-')) : new Date(0);
                                          const dateB = b.data_sub_etapa ? new Date(b.data_sub_etapa.split('/').reverse().join('-')) : new Date(0);
                                          
                                          if (dateA.getTime() === dateB.getTime()) {
                                              const timeA = a.hora_inicio_turno ? parseInt(a.hora_inicio_turno.replace(':', ''), 10) : 0;
                                              const timeB = b.hora_inicio_turno ? parseInt(b.hora_inicio_turno.replace(':', ''), 10) : 0;
                                              return timeB - timeA;
                                          }
                                          return dateB.getTime() - dateA.getTime();
                                      });

    const mostRecentActiveSubStage = relevantSubStages.find(ss => !ss.concluida);
    if (mostRecentActiveSubStage) {
        return mostRecentActiveSubStage.operador;
    }

    if (relevantSubStages.length > 0) {
        return relevantSubStages[0].operador;
    }

    return null;
}


/**
 * Adiciona uma nova ferramenta via formulário.
 * (Esta função foi movida para handleAddToolFormSubmit e mantida como placeholder para chamadas antigas)
 */
window.addTool = handleAddToolFormSubmit;


/**
 * Abre o modal para visualizar e gerenciar sub-etapas de produção de uma ferramenta.
 * @param {number} toolId - ID da ferramenta.
 * @param {string} toolName - Nome da ferramenta.
 */
window.openToolSubStagesModal = async function(toolId, toolName) {
    console.log(`Ferramentaria: Abrindo modal de sub-etapas para ferramenta ID ${toolId} (${toolName}).`);

    const toolNameSpan = document.getElementById('toolSubStagesToolName');
    const toolIdInput = document.getElementById('toolSubStagesToolId');

    // INÍCIO DA CORREÇÃO
    // A verificação do elemento 'editProjectSelect' foi removida, pois ele pertence a outro modal e causava o erro.
    if (!toolNameSpan || !toolIdInput) {
        console.error('Ferramentaria: Elementos essenciais do modal de sub-etapas (título ou hidden inputs) não encontrados!');
        window.showError('Erro ao abrir o modal de sub-etapas. Elementos não encontrados.');
        return;
    }
    // FIM DA CORREÇÃO

    toolNameSpan.textContent = toolName;
    toolIdInput.value = toolId;
    currentToolId = toolId;

    // A função loadProjectsForToolSubStages agora cuida de popular os selects necessários em seus respectivos modais.
    await loadProjectsForToolSubStages();

    await window.fetchToolSubStages(toolId, true);

    await window.fetchAndRenderPartsToSelect();

    const searchProjectPartsInput = document.getElementById('searchProjectPartsInput');
    if(searchProjectPartsInput) {
        searchProjectPartsInput.value = '';
    }

    window.openModal('toolSubStagesModal');
};


/**
 * Busca e exibe as sub-etapas de produção para uma ferramenta específica.
 * @param {number} toolId - ID da ferramenta.
 * @param {boolean} [includeProjectName=false] - Se true, inclui o nome do projeto na resposta.
 */
window.fetchToolSubStages = async function(toolId, includeProjectName = false) {
    console.log(`Ferramentaria: Buscando sub-etapas para ferramenta ID ${toolId}.`);
    const toolSubStagesList = document.getElementById('toolSubStagesList');
    if (!toolSubStagesList) {
        console.error('Ferramentaria: Elemento toolSubStagesList não encontrado para exibir sub-etapas.');
        return;
    }
    toolSubStagesList.innerHTML = '<p class="no-sub-etapas">Carregando sub-etapas...</p>';

    let url = `${API_BASE_URL}/ferramentas/${toolId}/sub_etapas_producao`;
    if (includeProjectName) {
        url += '?includeProjectName=true';
    }

    const cacheBuster = `_t=${new Date().getTime()}`;
    url += (url.includes('?') ? '&' : '?') + cacheBuster;

    try {
        const response = await window.authenticatedFetch(url);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao buscar sub-etapas de produção. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao buscar sub-etapas de produção.');
        }
        const subStages = await response.json();

        toolSubStagesList.innerHTML = '';

        const activeSubStages = subStages.filter(subStage => !subStage.concluida);

        if (activeSubStages.length === 0) {
            toolSubStagesList.innerHTML = '<p class="no-sub-etapas">Nenhuma sub-etapa de produção ativa para esta ferramenta. Atribua uma peça para começar.</p>';
            return;
        }

        const today = new Date();
        today.setHours(0,0,0,0);
        
        activeSubStages.sort((a, b) => a.ordem - b.ordem);

        activeSubStages.forEach(subStage => {
            const subStageElement = createSubStageElement(subStage);
            toolSubStagesList.appendChild(subStageElement);
        });
        
    } catch (error) {
        console.error('Ferramentaria: Erro ao buscar ou renderizar sub-etapas:', error);
        toolSubStagesList.innerHTML = '<p class="no-sub-etapas" style="color:red;">Erro ao carregar sub-etapas. Tente novamente.</p>';
        window.showError('Erro ao carregar sub-etapas: ' + error.message);
    }
};

/**
 * Cria o elemento HTML para uma sub-etapa de produção.
 * @param {Object} subStage - Objeto da sub-etapa.
 * @returns {HTMLElement} O elemento da sub-etapa.
 */
function createSubStageElement(subStage) {
    const div = document.createElement('div');
    div.className = `sub-etapa-item`;
    div.dataset.subStageId = subStage.id;

    const today = new Date();
    today.setHours(0,0,0,0);

    const status = getSubStageStatus(subStage, today);
    div.classList.add(`sub-etapa-${status}-visual`);

    const projectNameText = subStage.nome_projeto ? ` (Projeto: ${subStage.nome_projeto})` : '';
    const operatorText = subStage.operador ? ` (Operador: ${subStage.operador})` : '';

    const startTime = getFormattedTime(subStage.hora_inicio_turno);
    const endTime = getFormattedTime(subStage.hora_fim_turno);
    
    const hoursRealizedDisplay = subStage.horas_trabalhadas_dia !== null && !isNaN(parseFloat(subStage.horas_trabalhadas_dia))
                                ? window.convertDecimalHoursToHMMDisplay(parseFloat(subStage.horas_trabalhadas_dia)) : '0.00';
    const hoursPlannedDisplay = subStage.horas_previstas_conclusao !== null && !isNaN(parseFloat(subStage.horas_previstas_conclusao))
                                ? window.convertDecimalHoursToHMMDisplay(parseFloat(subStage.horas_previstas_conclusao)) : '0.00';


    const turnInfo = `Turno: ${startTime} - ${endTime}, Realizado: ${hoursRealizedDisplay}h, Previsto: ${hoursPlannedDisplay}h`;

    const dateText = subStage.data_sub_etapa ? `Agendado: ${window.formatDate(subStage.data_sub_etapa)}` : 'Dia não agendado';
    const dueDateText = subStage.data_prevista_conclusao ? `Prazo: ${window.formatDate(subStage.data_prevista_conclusao)}` : 'Sem prazo';


    div.innerHTML = `
        <div class="sub-etapa-info">
            <input type="checkbox" class="sub-etapa-checkbox" ${subStage.concluida ? 'checked' : ''} data-sub-stage-id="${subStage.id}">
            <span class="sub-etapa-dot sub-etapa-dot-${status}" title="Status: ${status}"></span>
            <span class="sub-etapa-text">
                <strong>${subStage.descricao}</strong>${projectNameText}${operatorText}
                <br>
                <span>${turnInfo}</span>
                <br>
                <span>${dateText}</span>
                <span>(${dueDateText})</span>
            </span>
        </div>
        <div class="sub-etapa-actions">
            <button class="action-button secondary small edit-tool-sub-stage-btn" data-sub-stage-id="${subStage.id}"><i class="fas fa-pencil-alt"></i></button>
            ${subStage.concluida ?
                `<button class="action-button warning small uncomplete-btn" data-sub-stage-id="${subStage.id}" title="Marcar como Pendente">
                    <i class="fas fa-undo"></i>
                </button>` :
                `<button class="action-button success small complete-btn" data-sub-stage-id="${subStage.id}" title="Marcar como Concluída">
                    <i class="fas fa-check"></i>
                </button>`
            }
            <button class="action-button danger small delete-tool-sub-stage-btn" data-sub-stage-id="${subStage.id}"><i class="fas fa-trash-alt"></i></button>
        </div>
    `;
    return div;
}

/**
 * Adiciona uma nova sub-etapa de produção para a ferramenta atual.
 */
window.addSubEtapaProducao = async function(event) {
    console.warn("Função `addSubEtapaProducao` chamada, mas foi desativada no fluxo da UI.");
};

/**
 * Alterna o status de conclusão de uma sub-etapa.
 * @param {number} subStageId - ID da sub-etapa.
 * @param {boolean} concluida - Novo status de conclusão.
 */
window.toggleSubStageStatus = async function(subStageId, concluida) {
    console.log(`Ferramentaria: Alternando status da sub-etapa ID ${subStageId} para ${concluida}.`);
    const toolIdForRefresh = document.getElementById('toolSubStagesToolId').value;

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/ferramentas_sub_etapas_producao/${subStageId}/concluir`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ concluida })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao atualizar status da sub-etapa. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao atualizar status.');
        }

        const result = await response.json();
        window.showToast(result.message, 'success');

        window.fetchToolSubStages(toolIdForRefresh, true);
        window.fetchAndRenderTools();
        if (document.getElementById('tela5').classList.contains('active')) {
            window.initializeProducaoScreen();
        }
    }
    catch (error) {
        console.error('Ferramentaria: Erro ao atualizar status da sub-etapa:', error);
        window.showError('Erro ao atualizar status: ' + error.message);
        const checkbox = document.querySelector(`.sub-etapa-item[data-sub-stage-id="${subStageId}"] .sub-etapa-checkbox`);
        if (checkbox) {
            checkbox.checked = !concluida;
        }
    }
};

/**
 * Abre o modal para editar uma sub-etapa de produção.
 * @param {number} subStageId - ID da sub-etapa a ser editada.
 */
window.openEditToolSubStageModal = async function(subStageId) {
    console.log(`Ferramentaria: Abrindo modal de edição para sub-etapa ID ${subStageId}.`);

    const modal = document.getElementById('editToolSubStageModal');
    const idInput = document.getElementById('editToolSubStageId');
    const toolIdInput = document.getElementById('editToolSubStageToolId');
    const descriptionInput = document.getElementById('editToolSubStageDescription');
    const dueDateInput = document.getElementById('editToolSubStageDueDate');
    const hoursPerDayInput = document.getElementById('editToolSubStageHoursPerDay');
    const plannedHoursInput = document.getElementById('editToolSubStagePlannedHours');
    const dateInput = document.getElementById('editToolSubStageDate');
    const projectSelect = document.getElementById('editToolSubStageProject');
    const operatorInput = document.getElementById('editToolSubStageOperator');
    const startTimeInput = document.getElementById('editToolSubStageStartTime');
    const endTimeInput = document.getElementById('editToolSubStageEndTime');
    const titleElement = document.getElementById('editToolSubStageTitle');

    if (!modal || !idInput || !toolIdInput || !descriptionInput || !dueDateInput || !hoursPerDayInput || !plannedHoursInput || !dateInput || !projectSelect || !operatorInput || !startTimeInput || !endTimeInput || !titleElement) {
        console.error('Ferramentaria: Elementos do modal de edição de sub-etapa não encontrados!');
        window.showError('Erro ao abrir o modal de edição. Elementos não encontrados.');
        return;
    }

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/sub_etapas_producao/${subStageId}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao buscar dados da sub-etapa. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao buscar dados da sub-etapa.');
        }
        const subStage = await response.json();

        idInput.value = subStage.id;
        toolIdInput.value = subStage.ferramenta_id;
        descriptionInput.value = subStage.descricao || '';
        dueDateInput.value = subStage.data_prevista_conclusao ? subStage.data_prevista_conclusao.split('/').reverse().join('-') : '';
        
        hoursPerDayInput.value = subStage.horas_trabalhadas_dia !== null && subStage.horas_trabalhadas_dia !== 0 ? window.convertDecimalHoursToHMMDisplay(parseFloat(subStage.horas_trabalhadas_dia)) : '';
        plannedHoursInput.value = subStage.horas_previstas_conclusao !== null && subStage.horas_previstas_conclusao !== 0 ? window.convertDecimalHoursToHMMDisplay(parseFloat(subStage.horas_previstas_conclusao)) : '';

        dateInput.value = subStage.data_sub_etapa ? subStage.data_sub_etapa.split('/').reverse().join('-') : '';
        operatorInput.value = subStage.operador || '';
        startTimeInput.value = subStage.hora_inicio_turno || '';
        endTimeInput.value = subStage.hora_fim_turno || '';
        titleElement.textContent = `Editar Sub-Etapa: ${subStage.descricao}`;

        const editToolSubStageProjectSelect = document.getElementById('editToolSubStageProject');
        if (editToolSubStageProjectSelect) {
            editToolSubStageProjectSelect.value = subStage.projeto_id || '';
        }

        window.openModal('editToolSubStageModal');

        document.getElementById('editToolSubStageForm').onsubmit = async (event) => {
            event.preventDefault();
            await window.editToolSubStage(event);
        };

    } catch (error) {
        console.error('Ferramentaria: Erro ao abrir modal de edição de sub-etapa:', error);
        window.showError('Erro ao carregar dados para edição: ' + error.message);
    }
};

/**
 * Salva as alterações de uma sub-etapa de produção editada.
 */
window.editToolSubStage = async function(event) {
    event.preventDefault();
    console.log('Ferramentaria: Tentando salvar alterações da sub-etapa...');
    
    const formElements = event.currentTarget.elements;

    const subStageId = formElements.editToolSubStageId.value;
    const toolId = formElements.editToolSubStageToolId.value;

    let currentSubStageData;
    try {
        const responseCurrent = await window.authenticatedFetch(`${API_BASE_URL}/sub_etapas_producao/${subStageId}`);
        if (!responseCurrent.ok) {
            throw new Error('Não foi possível obter os dados atuais da sub-etapa para mesclagem.');
        }
        currentSubStageData = await responseCurrent.json();
    } catch (error) {
        console.error('Erro ao buscar dados atuais da sub-etapa antes da edição:', error);
        window.showError('Erro ao carregar dados para edição: ' + error.message);
        return;
    }
    
    const descricao = formElements.editToolSubStageDescription.value.trim();
    
    const data_prevista_conclusao_input = formElements.editToolSubStageDueDate.value;
    const data_prevista_conclusao = data_prevista_conclusao_input ? window.formatDateForDB(data_prevista_conclusao_input) : null;

    const data_sub_etapa_input = formElements.editToolSubStageDate.value;
    const data_sub_etapa = data_sub_etapa_input ? window.formatDateForDB(data_sub_etapa_input) : null;
    
    const hoursPerDayInputValue = formElements.editToolSubStageHoursPerDay.value;
    const plannedHoursInputValue = formElements.editToolSubStagePlannedHours.value;
    
    const hoursPerDayTotalMinutes = window.convertUserHMMToTotalMinutes(hoursPerDayInputValue);
    const hoursPerDayDecimal = window.convertTotalMinutesToDecimalHours(hoursPerDayTotalMinutes);
    
    const plannedHoursTotalMinutes = window.convertUserHMMToTotalMinutes(plannedHoursInputValue);
    const plannedHoursDecimal = window.convertTotalMinutesToDecimalHours(plannedHoursTotalMinutes);
    
    if (hoursPerDayDecimal !== null && (isNaN(hoursPerDayDecimal) || hoursPerDayDecimal < 0)) {
        window.showError('Horas Trabalhadas por Dia inválidas. Por favor, insira um número válido ou deixe em branco.');
        return;
    }
    if (plannedHoursDecimal !== null && (isNaN(plannedHoursDecimal) || plannedHoursDecimal < 0)) {
        window.showError('Horas Previstas para Conclusão inválidas. Por favor, insira um número válido ou deixe em branco.');
        return;
    }

    const projeto_id_input = formElements.editToolSubStageProject.value;
    const projeto_id = projeto_id_input ? parseInt(projeto_id_input) : null;
    const operador = formElements.editToolSubStageOperator.value.trim() || null;
    const hora_inicio_turno = formElements.editToolSubStageStartTime.value.trim() || null;
    const hora_fim_turno = formElements.editToolSubStageEndTime.value.trim() || null;

    if (!descricao) {
        window.showError('A descrição da sub-etapa é obrigatória.');
        return;
    }
    
    const mergedSubStageData = {
        descricao: descricao || currentSubStageData.descricao,
        data_prevista_conclusao: data_prevista_conclusao || currentSubStageData.data_prevista_conclusao,
        horas_trabalhadas_dia: hoursPerDayDecimal,
        horas_previstas_conclusao: plannedHoursDecimal,
        data_sub_etapa: data_sub_etapa || currentSubStageData.data_sub_etapa,
        projeto_id: projeto_id,
        operador: operador,
        hora_inicio_turno: hora_inicio_turno,
        hora_fim_turno: hora_fim_turno,
        concluida: currentSubStageData.concluida,
        data_conclusao: currentSubStageData.data_conclusao
    };
    
    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/ferramentas/${toolId}/sub_etapas_producao/${subStageId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mergedSubStageData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido ao salvar alterações da sub-etapa. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao salvar alterações.');
        }

        const result = await response.json();
        window.showToast(result.message || 'Alterações salvas com sucesso!', 'success');
        
        const editModalElement = document.getElementById('editToolSubStageModal');
        const modalContent = editModalElement.querySelector('.modal-content');

        const handleModalCloseTransition = async () => {
            modalContent.removeEventListener('transitionend', handleModalCloseTransition);
            console.log('Ferramentaria: Modal de edição fechado. Recarregando sub-etapas e ferramentas...');
            await window.fetchToolSubStages(toolId, true);
            await window.fetchAndRenderTools();
            if (document.getElementById('tela5').classList.contains('active')) {
                window.initializeProducaoScreen();
            }
        };

        modalContent.addEventListener('transitionend', handleModalCloseTransition);
        window.closeModal('editToolSubStageModal');

    } catch (error) {
        console.error('Ferramentaria: Erro ao salvar alterações da sub-etapa:', error);
        window.showError('Erro ao salvar alterações: ' + error.message);
    }
};

/**
 * Exclui uma sub-etapa de produção.
 * @param {number} subStageId - ID da sub-etapa a ser excluída.
 */
window.deleteToolSubStage = async function(subStageId) {
    console.log(`Ferramentaria: Tentando excluir sub-etapa ID ${subStageId}.`);
    const toolIdForRefresh = document.getElementById('toolSubStagesToolId').value;

    if (!confirm('Tem certeza que deseja excluir esta sub-etapa?')) {
        return;
    }

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/sub_etapas_producao/${subStageId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao excluir sub-etapa. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao excluir sub-etapa.');
        }

        const result = await response.json();
        window.showToast(result.message, 'success');
        window.closeModal('confirmDeleteToolModal');
        window.fetchToolSubStages(toolIdForRefresh, true);
        window.fetchAndRenderTools();
        if (document.getElementById('tela5').classList.contains('active')) {
            window.initializeProducaoScreen();
        }
    } catch (error) {
        console.error('Ferramentaria: Erro ao excluir sub-etapa:', error);
        window.showError('Erro ao excluir sub-etapa: ' + error.message);
    }
};


/**
 * Abre o modal para editar uma ferramenta.
 * @param {number} toolId - ID da ferramenta a ser editada.
 */
window.openEditToolModal = async function(toolId) {
    console.log(`Ferramentaria: Abrindo modal de edição para ferramenta ID ${toolId}.`);

    const idInput = document.getElementById('editToolId');
    const nameInput = document.getElementById('editToolName');
    const descriptionInput = document.getElementById('editToolDescription');
    const operatorInput = document.getElementById('editToolOperator');

    if (!idInput || !nameInput || !descriptionInput || !operatorInput) {
        console.error('Ferramentaria: Elementos do modal de edição de ferramenta não encontrados.');
        window.showError('Erro ao abrir modal de edição.');
        return;
    }

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/ferramentas/${toolId}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao buscar dados da ferramenta. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao buscar dados da ferramenta.');
        }
        const tool = await response.json();

        idInput.value = tool.id;
        nameInput.value = tool.nome;
        descriptionInput.value = tool.descricao || '';
        operatorInput.value = tool.operador || '';

        window.openModal('editToolModal');

        document.getElementById('editToolForm').onsubmit = handleEditToolFormSubmit;

    } catch (error) {
        console.error('Ferramentaria: Erro ao carregar dados da ferramenta para edição:', error);
        window.showError('Erro ao carregar dados da ferramenta: ' + error.message);
    }
};

/**
 * Salva as alterações de uma ferramenta editada.
 * (Esta função é na verdade handleEditToolFormSubmit e mantida como placeholder para chamadas antigas)
 */
window.editTool = handleEditToolFormSubmit;

/**
 * Abre o modal de detalhes da ferramenta (exemplo básico).
 * @param {number} toolId - ID da ferramenta.
 */
window.openToolDetailsModal = async function(toolId) {
    console.log(`Ferramentaria: Abrindo detalhes para ferramenta ID ${toolId}.`);
    const detailsContent = document.getElementById('toolDetailsContent');
    if (!detailsContent) {
        console.error('Ferramentaria: Elemento toolDetailsContent não encontrado.');
        window.showError('Erro ao abrir detalhes.');
        return;
    }
    detailsContent.innerHTML = '<p>Carregando detalhes...</p>';
    window.openModal('toolDetailsModal');

    try {
        const toolResponse = await window.authenticatedFetch(`${API_BASE_URL}/ferramentas/${toolId}`);
        if (!toolResponse.ok) {
            throw new Error('Erro ao buscar detalhes básicos da ferramenta.');
        }
        const tool = await toolResponse.json();

        const subStagesResponse = await window.authenticatedFetch(`${API_BASE_URL}/ferramentas/${tool.id}/sub_etapas_producao?includeProjectName=true`);
        if (!subStagesResponse.ok) {
            throw new Error('Erro ao buscar sub-etapas da ferramenta para detalhes');
        }
        const subStages = await subStagesResponse.json();
        tool.subEtapasProducao = subStages;

        const principalOperator = getPrincipalOperator(tool.subEtapasProducao);
        const toolOperatorInfo = principalOperator ? ` - Operador Principal: ${principalOperator}` : '';

        const todayNormalizedForDetails = new Date();
        todayNormalizedForDetails.setHours(0,0,0,0);

        let detailsHtml = `
            <div class="tool-details-container">
                <div class="tool-details-header">
                    <h3>${tool.nome} <span class="tool-header-operator">${toolOperatorInfo}</span></h3>
                </div>
                <div class="tool-details-sections">
                    <div class="tool-details-section">
                        <h4>Informações Básicas</h4>
                        <p><strong>Descrição:</strong> ${tool.descricao || 'N/A'}</p>
                        <p><strong>Data de Cadastro:</strong> ${window.formatDate(tool.data_cadastro, true)}</p>
                        <p><strong>Operador Principal Registrado:</strong> ${tool.operador || 'N/A'}</p>
                    </div>
                    <div class="tool-details-section">
                        <h4>Sub-etapas de Produção:</h4>
                        ${tool.subEtapasProducao && tool.subEtapasProducao.length > 0 ? `
                            <table class="details-table">
                                <thead>
                                    <tr>
                                        <th>Descrição</th>
                                        <th>Projeto</th>
                                        <th>Agendado</th>
                                        <th>Início Turno</th>
                                        <th>Fim Turno</th>
                                        <th>Horas Realizadas</th>
                                        <th>Horas Previstas</th>
                                        <th>Operador</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tool.subEtapasProducao.map(ss => {
                                        const currentStatus = getSubStageStatus(ss, todayNormalizedForDetails);
                                        let statusDisplayText = '';
                                        let statusClass = '';

                                        switch (currentStatus) {
                                            case 'concluida':
                                                statusDisplayText = 'Concluída';
                                                statusClass = 'status-completed';
                                                break;
                                            case 'atrasada':
                                                statusDisplayText = 'Atrasada';
                                                statusClass = 'status-delayed';
                                                break;
                                            case 'em-andamento':
                                                statusDisplayText = 'Em Andamento';
                                                statusClass = 'status-in-progress';
                                                break;
                                            case 'pendente':
                                                statusDisplayText = 'Pendente';
                                                statusClass = 'status-pending';
                                                break;
                                            default:
                                                statusDisplayText = 'Desconhecido';
                                                statusClass = '';
                                        }
                                        return `
                                            <tr>
                                                <td>${ss.descricao}</td>
                                                <td>${ss.nome_projeto || 'N/A'}</td>
                                                <td>${window.formatDate(ss.data_sub_etapa) || 'N/A'}</td>
                                                <td>${getFormattedTime(ss.hora_inicio_turno)}</td>
                                                <td>${getFormattedTime(ss.hora_fim_turno)}</td>
                                                <td>${!isNaN(parseFloat(ss.horas_trabalhadas_dia)) ? convertDecimalHoursToHMMDisplay(parseFloat(ss.horas_trabalhadas_dia)) : 'N/A'}</td>
                                                <td>${!isNaN(parseFloat(ss.horas_previstas_conclusao)) ? convertDecimalHoursToHMMDisplay(parseFloat(ss.horas_previstas_conclusao)) : 'N/A'}</td>
                                                <td>${ss.operador || 'N/A'}</td>
                                                <td><span class="${statusClass}">${statusDisplayText}</span></td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        ` : '<p>Nenhuma sub-etapa de produção registrada para esta ferramenta.</p>'}
                    </div>
                </div>
            </div>
        `;

        detailsContent.innerHTML = detailsHtml;

    } catch (error) {
        console.error('Ferramentaria: Erro ao buscar detalhes da ferramenta:', error);
        detailsContent.innerHTML = '<p style="color:red;">Erro ao carregar detalhes.</p>';
        window.showError('Erro ao carregar detalhes: ' + error.message);
    }
};

/**
 * Abre o modal de confirmação para excluir uma ferramenta.
 * @param {number} toolId - ID da ferramenta.
 * @param {string} toolName - Nome da ferramenta.
 */
window.openDeleteToolConfirmModal = function(toolId, toolName) {
    console.log(`Ferramentaria: Abrindo confirmação para excluir ferramenta ID ${toolId} (${toolName}).`);
    const deleteToolNameSpan = document.getElementById('deleteToolName');
    const confirmDeleteBtn = document.getElementById('confirmDeleteToolBtn');

    if (!deleteToolNameSpan || !confirmDeleteBtn) {
        console.error('Ferramentaria: Elementos do modal de confirmação de exclusão não encontrados.');
        window.showError('Erro ao abrir confirmação de exclusão.');
        return;
    }

    deleteToolNameSpan.textContent = toolName;
    confirmDeleteBtn.replaceWith(confirmDeleteBtn.cloneNode(true)); // Clona para remover listeners antigos
    document.getElementById('confirmDeleteToolBtn').addEventListener('click', () => window.deleteTool(toolId));

    window.openModal('confirmDeleteToolModal');
};

/**
 * Exclui uma ferramenta após confirmação.
 * @param {number} toolId - ID da ferramenta a ser excluída.
 */
window.deleteTool = async function(toolId) {
    console.log(`Ferramentaria: Excluindo ferramenta ID ${toolId}.`);
    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/ferramentas/${toolId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao excluir ferramenta. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao excluir ferramenta.');
        }

        const result = await response.json();
        window.showToast(result.message, 'success');
        window.closeModal('confirmDeleteToolModal');
        window.fetchAndRenderTools();
        if (document.getElementById('tela5').classList.contains('active')) {
            window.initializeProducaoScreen();
        }
    } catch (error) {
        console.error('Ferramentaria: Erro ao excluir ferramenta:', error);
        window.showError('Erro ao excluir ferramenta: ' + error.message);
    }
};


// Helper function para calcular uso da ferramenta
window.calculateToolUsage = function(subEtapas) {
    const usage = {
        totalHours: 0,
        averageDailyHours: 0,
        last7DaysHours: 0,
        last30DaysHours: 0,
        dailyHoursMap: new Map()
    };

    if (!subEtapas || subEtapas.length === 0) {
        return usage;
    }

    const now = new Date();
    now.setHours(0,0,0,0);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    sevenDaysAgo.setHours(0,0,0,0);
    thirtyDaysAgo.setHours(0,0,0,0);

    subEtapas.forEach(ss => {
        const hours = parseFloat(ss.horas_trabalhadas_dia) || 0;
        usage.totalHours += hours;

        if (ss.data_sub_etapa) {
            try {
                const [day, month, year] = ss.data_sub_etapa.split('/');
                const subEtapaDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                subEtapaDate.setHours(0,0,0,0);

                const dateString = subEtapaDate.toISOString().split('T')[0];

                if (!isNaN(subEtapaDate.getTime())) {
                    usage.dailyHoursMap.set(dateString, (usage.dailyHoursMap.get(dateString) || 0) + hours);

                    if (subEtapaDate.getTime() >= sevenDaysAgo.getTime()) {
                        usage.last7DaysHours += hours;
                    }
                    if (subEtapaDate.getTime() >= thirtyDaysAgo.getTime()) {
                        usage.last30DaysHours += hours;
                    }
                }
            }
            catch (e) {
                console.warn('Erro ao processar data da sub-etapa para cálculo de uso:', ss.data_sub_etapa, e);
            }
        }
    });

    if (usage.dailyHoursMap.size > 0) {
        usage.averageDailyHours = usage.totalHours / usage.dailyHoursMap.size;
    }

    return usage;
};

// ===============================================
// Funções para Relatório de Sub-etapas de Ferramentaria (NOVO)
// ===============================================

/**
 * Abre o modal de relatório de sub-etapas de ferramentaria.
 */
function openToolingReportModal() {
    const today = new Date();
    const formattedToday = today.toISOString().split('T')[0];

    const startDateInput = document.getElementById('toolingReportStartDate');
    const endDateInput = document.getElementById('toolingReportEndDate');
    const reportResultDiv = document.getElementById('toolingReportResult');
    const toolingDownloadOptionsDiv = document.getElementById('toolingDownloadOptions');
    const generateBtn = document.getElementById('generateToolingReportSubmitBtn');

    startDateInput.value = formattedToday;
    endDateInput.value = formattedToday;

    reportResultDiv.style.display = 'none';
    reportResultDiv.innerHTML = '';
    toolingDownloadOptionsDiv.style.display = 'none';

    generateBtn.removeEventListener('click', generateToolingSubStageReport);
    document.getElementById('downloadToolingTxt').removeEventListener('click', downloadToolingReportTxt);
    document.getElementById('downloadToolingExcel').removeEventListener('click', downloadToolingReportExcel);
    document.getElementById('printToolingReport').removeEventListener('click', printToolingReport);

    generateBtn.addEventListener('click', generateToolingSubStageReport);
    document.getElementById('downloadToolingTxt').addEventListener('click', downloadToolingReportTxt);
    document.getElementById('downloadToolingExcel').addEventListener('click', downloadToolingReportExcel);
    document.getElementById('printToolingReport').addEventListener('click', printToolingReport);

    window.openModal('toolingReportModal');
}

/**
 * Gera o relatório de sub-etapas de ferramentaria.
 */
async function generateToolingSubStageReport() {
    const startDate = document.getElementById('toolingReportStartDate').value;
    const endDate = document.getElementById('toolingReportEndDate').value;
    const reportResultDiv = document.getElementById('toolingReportResult');
    const toolingDownloadOptionsDiv = document.getElementById('toolingDownloadOptions');

    reportResultDiv.innerHTML = '<p>Gerando relatório...</p>';
    reportResultDiv.style.display = 'block';
    toolingDownloadOptionsDiv.style.display = 'none';

    if (!startDate || !endDate) {
        window.showError('Por favor, selecione as datas de início e fim.');
        reportResultDiv.innerHTML = '';
        reportResultDiv.style.display = 'none';
        return;
    }

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/ferramentas_sub_etapas_producao/relatorio?startDate=${startDate}&endDate=${endDate}`);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido ao gerar relatório.' }));
            throw new Error(errorData.error || 'Erro ao gerar relatório de sub-etapas.');
        }

        const data = await response.json();
        renderToolingReport(data, startDate, endDate);
    } catch (error) {
        console.error('Erro ao gerar relatório de sub-etapas:', error);
        reportResultDiv.innerHTML = `<p style="color:red;">Erro ao gerar relatório: ${error.message}</p>`;
        window.showError('Erro ao gerar relatório: ' + error.message);
    }
}

/**
 * Renderiza os dados do relatório de sub-etapas de ferramentaria no modal.
 * @param {Array<Object>} data - Dados do relatório.
 * @param {string} startDate - Data de início do filtro.
 * @param {string} endDate - Data de fim do filtro.
 */
function renderToolingReport(data, startDate, endDate) {
    const reportResultDiv = document.getElementById('toolingReportResult');
    const toolingDownloadOptionsDiv = document.getElementById('toolingDownloadOptions');

    reportResultDiv.innerHTML = '';
    toolingDownloadOptionsDiv.style.display = 'block';

    if (data.length === 0) {
        reportResultDiv.innerHTML = '<p class="no-sub-etapas">Nenhuma sub-etapa de produção encontrada para o período selecionado.</p>';
        return;
    }
    
    let reportHtml = `
        <h3>Relatório de Sub-etapas de Ferramentaria (${window.formatDate(startDate)} a ${window.formatDate(endDate)})</h3>
        <table class="report-table">
            <thead>
                <tr>
                    <th>Ferramenta</th>
                    <th>Descrição da Sub-etapa</th>
                    <th>Projeto</th>
                    <th>Operador</th>
                    <th>Dia da Sub-etapa</th>
                    <th>Início Turno</th>
                    <th>Fim Turno</th>
                    <th>Horas Realizadas</th>
                    <th>Horas Previstas</th>
                    <th>Prazo Conclusão</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
    `;


    data.forEach(item => {
        let status = item.concluida ? 'Concluída' : 'Pendente';
        let statusClass = item.concluida ? 'status-completed' : 'status-pending';

        if (!item.concluida && item.data_sub_etapa) {
            const subStageDate = window.parseDDMMYYYYtoDate(item.data_sub_etapa);
            const today = new Date();
            today.setHours(0,0,0,0);
            if (subStageDate && subStageDate.getTime() < today.getTime()) {
                status = 'Atrasada';
                statusClass = 'status-delayed';
            }
        }

        const horasTrabalhadasDia = parseFloat(item.horas_trabalhadas_dia);
        const horasPrevistasConclusao = parseFloat(item.horas_previstas_conclusao);

        reportHtml += `
            <tr>
                <td>${item.nome_ferramenta || 'N/A'}</td>
                <td>${item.descricao || 'N/A'}</td>
                <td>${item.nome_projeto || 'N/A'}</td>
                <td>${item.operador || 'N/A'}</td>
                <td>${item.data_sub_etapa || 'N/A'}</td>
                <td>${getFormattedTime(item.hora_inicio_turno)}</td>
                <td>${getFormattedTime(item.hora_fim_turno)}</td>
                <td>${!isNaN(horasTrabalhadasDia) ? convertDecimalHoursToHMMDisplay(horasTrabalhadasDia) : 'N/A'}</td>
                <td>${!isNaN(horasPrevistasConclusao) ? convertDecimalHoursToHMMDisplay(horasPrevistasConclusao) : 'N/A'}</td>
                <td>${item.data_prevista_conclusao || 'N/A'}</td>
                <td><span class="${statusClass}">${status}</span></td>
            </tr>
        `;
    });

    reportHtml += `
            </tbody>
        </table>
    `;
    reportResultDiv.innerHTML = reportHtml;
}

/**
 * Baixa o relatório de sub-etapas de ferramentaria como TXT.
 */
function downloadToolingReportTxt() {
    const reportTable = document.getElementById('toolingReportResult').querySelector('table');
    if (!reportTable) {
        window.showError('Nenhum relatório para baixar.');
        return;
    }

    let textContent = '';
    Array.from(reportTable.querySelectorAll('thead th')).forEach(th => {
        textContent += th.textContent + '\t';
    });
    textContent += '\n';

    Array.from(reportTable.querySelectorAll('tbody tr')).forEach(row => {
        Array.from(row.querySelectorAll('td')).forEach(td => {
            textContent += td.textContent + '\t';
        });
        textContent += '\n';
    });

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'relatorio_sub_etapas_ferramentaria.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/**
 * Baixa o relatório de sub-etapas de ferramentaria como Excel.
 */
async function downloadToolingReportExcel() {
    const reportTable = document.getElementById('toolingReportResult').querySelector('table');
    if (!reportTable) {
        window.showError('Nenhum relatório para baixar.');
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Relatório de Sub-etapas');

    const headers = Array.from(reportTable.querySelectorAll('thead th')).map(th => th.textContent);
    worksheet.addRow(headers);

    Array.from(reportTable.querySelectorAll('tbody tr')).forEach(row => {
        const rowData = Array.from(row.querySelectorAll('td')).map(td => td.textContent);
        worksheet.addRow(rowData);
    });

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

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'relatorio_sub_etapas_ferramentaria.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/**
 * Imprime o relatório de sub-etapas de ferramentaria.
 */
function printToolingReport() {
    const printContent = document.getElementById('toolingReportResult').innerHTML;
    const originalBody = document.body.innerHTML;

    document.body.innerHTML = `
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .report-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .report-table th, .report-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .report-table th { background-color: #f2f2f2; }
            .status-completed { color: green; }
            .status-delayed { color: red; }
            .status-pending { color: gray; }
        </style>
        <h1>Relatório de Sub-etapas de Ferramentaria</h1>
        ${printContent}
    `;

    window.print();
    document.body.innerHTML = originalBody;
}


// ===============================================
// Funções para Seleção de Peças para Produção (NOVO)
// ===============================================

/**
 * Busca e renderiza la lista de peças de projetos disponíveis para serem atribuídas à produção.
 * @param {string} [searchTerm=''] - Termo de busca para filtrar peças.
 */
window.fetchAndRenderPartsToSelect = async function(searchTerm = '') {
    const partsToSelectList = document.getElementById('partsToSelectList');
    if (!partsToSelectList) {
        console.error('Ferramentaria: Elemento partsToSelectList não encontrado.');
        return;
    }
    partsToSelectList.innerHTML = '<p class="no-parts-available">Carregando peças de projetos...</p>';

    let url = `${API_BASE_URL}/projetos_pecas_disponiveis`;
    if (searchTerm) {
        url += `?searchTerm=${encodeURIComponent(searchTerm)}`;
    }

    try {
        const response = await window.authenticatedFetch(url);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao buscar peças disponíveis. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao buscar peças disponíveis.');
        }
        const availableParts = await response.json();
        
        let activeToolSubStages = [];
        if (currentToolId) {
            try {
                const activeSubStagesResponse = await window.authenticatedFetch(`${API_BASE_URL}/ferramentas/${currentToolId}/sub_etapas_producao`);
                if (activeSubStagesResponse.ok) {
                    const allSubStages = await activeSubStagesResponse.json();
                    activeToolSubStages = allSubStages.filter(ss => !ss.concluida);
                } else {
                    console.warn(`Ferramentaria: Não foi possível carregar sub-etapas ativas para ferramenta ${currentToolId}.`, await activeSubStagesResponse.text());
                }
            } catch (e) {
                console.error(`Ferramentaria: Erro de rede ao buscar sub-etapas ativas para ferramenta ${currentToolId}:`, e);
            }
        }
        
        availableParts.sort((a, b) => {
            const statusOrder = { 'Disponivel': 1, 'Falta B.O.M': 2, 'Em Ordem': 3, 'Concluído': 4 };

            const statusA = statusOrder[a.status] || 99;
            const statusB = statusOrder[b.status] || 99;
            
            const aInProduction = activeToolSubStages.some(activeSs => activeSs.descricao === `Produção de Peça: ${a.nome} (Qtd: ${a.quantidade})`);
            const bInProduction = activeToolSubStages.some(activeSs => activeSs.descricao === `Produção de Peça: ${b.nome} (Qtd: ${b.quantidade})`);

            if (aInProduction && !bInProduction) return 1;
            if (!aInProduction && bInProduction) return -1;

            if (statusA !== statusB) {
                return statusA - statusB;
            }
            
            return a.nome.localeCompare(b.nome);
        });


        partsToSelectList.innerHTML = '';
        if (availableParts.length === 0) {
            partsToSelectList.innerHTML = '<p class="no-parts-available">Nenhuma peça disponível ou correspondente encontrada.</p>';
        } else {
            const partsToRender = availableParts.map(part => {
                const isAlreadyInProduction = activeToolSubStages.some(activeSs => {
                    const expectedDescription = `Produção de Peça: ${part.nome} (Qtd: ${part.quantidade})`;
                    return activeSs.descricao === expectedDescription;
                });
                return { ...part, isAlreadyInProduction };
            });

            const finalPartsToDisplay = partsToRender.filter(part => part.status !== 'Concluído');

            if (finalPartsToDisplay.length === 0) {
                partsToSelectList.innerHTML = '<p class="no-parts-available">Todas as peças foram concluídas ou não há peças para produção.</p>';
            } else {
                finalPartsToDisplay.forEach(part => {
                    const partToSelectItem = createPartToSelectItem(part);
                    partsToSelectList.appendChild(partToSelectItem);
                });
            }
        }
    } catch (error) {
        console.error('Ferramentaria: Erro ao buscar ou renderizar peças para seleção:', error);
        partsToSelectList.innerHTML = '<p class="no-parts-available" style="color:red;">Erro ao carregar peças disponíveis. Tente novamente.</p>';
        window.showError('Erro ao carregar peças disponíveis: ' + error.message);
    }
};

/**
 * Cria o elemento HTML para um item de peça que pode ser selecionado para produção.
 * @param {Object} part - Objeto da peça (inclui nome do projeto, e agora isAlreadyInProduction).
 * @returns {HTMLElement} O elemento da peça para seleção.
 */
function createPartToSelectItem(part) {
    const div = document.createElement('div');
    div.className = `part-to-select-item`;
    div.dataset.partId = part.id;
    div.dataset.projectId = part.projeto_id;

    if (part.isAlreadyInProduction) {
        div.classList.add('part-in-production'); 
        div.title = 'Esta peça já está em produção para esta ferramenta.';
    }

    let statusClass = '';
    let statusText = part.status || 'Desconhecido';
    switch (part.status) {
        case 'Falta B.O.M':
        case 'Em Falta':
            statusClass = 'status-em-falta';
            statusText = 'Falta B.O.M';
            break;
        case 'Disponivel':
            statusClass = 'status-disponivel';
            statusText = 'Disponível';
            break;
        case 'Concluído':
        case 'Recebido':
            statusClass = 'status-recebido';
            statusText = 'Concluído';
            break;
        case 'Em Ordem':
            statusClass = 'status-em-ordem';
            statusText = 'Em Ordem';
            break;
        case 'Aguardando Análise':
            statusClass = 'status-aguardando-analise';
            statusText = 'Aguardando Análise';
            break;
        default:
            statusClass = '';
            statusText = part.status || 'Desconhecido';
    }

    div.innerHTML = `
        <div class="part-to-select-info">
            <strong>${part.nome}</strong>
            <span>(Projeto: ${part.nome_projeto || 'N/A'})</span>
            <span>Quantidade: ${part.quantidade}</span>
        </div>
        <span class="part-to-select-status ${statusClass}">
            ${statusText}
            ${part.isAlreadyInProduction ? ' (EM PRODUÇÃO)' : ''}
        </span>
    `;
    
    if (!part.isAlreadyInProduction) {
        div.addEventListener('click', () => {
            const toolId = document.getElementById('toolSubStagesToolId').value;
            window.assignPartToToolProduction(toolId, part);
        });
    } else {
        div.style.cursor = 'not-allowed';
    }

    return div;
}

/**
 * Atribui uma peça selecionada (do projeto) a uma ferramenta como uma nova sub-etapa de produção.
 * @param {number} toolId - O ID da ferramenta para a qual a peça será atribuída.
 * @param {Object} part - O objeto da peça selecionada.
 */
window.assignPartToToolProduction = async function(toolId, part) {
    console.log(`Ferramentaria: Atribuindo peça ID ${part.id} (Projeto: ${part.projeto_id}) à Ferramenta ID ${toolId}.`);
    console.log(`Ferramentaria: Detalhes da peça: `, part);

    const now = new Date();
    const todayFormattedForDB = window.formatDateForDB(now.toISOString().split('T')[0]);
    const currentTime = now.toTimeString().slice(0, 5);

    const operator = prompt("Por favor, insira o nome do operador para esta produção:", "");
    if (!operator) {
        window.showError("Operador é obrigatório para iniciar a produção de uma peça.");
        return;
    }

    const plannedHoursInput = prompt(`Horas previstas para concluir a peça "${part.nome}"? (Ex: 8.50 para 8h50min; 0.10 para 10min.)`, "8.00");
    const plannedHoursTotalMinutes = convertUserHMMToTotalMinutes(plannedHoursInput);
    const plannedHoursDecimal = window.convertTotalMinutesToDecimalHours(plannedHoursTotalMinutes);

    if (isNaN(plannedHoursDecimal) || plannedHoursDecimal < 0) {
        window.showError("Horas previstas inválidas. A produção não foi iniciada.");
        return;
    }

    const newSubStageData = {
        descricao: `Produção de Peça: ${part.nome} (Qtd: ${part.quantidade})`,
        data_prevista_conclusao: todayFormattedForDB,
        horas_trabalhadas_dia: 0,
        horas_previstas_conclusao: plannedHoursDecimal,
        data_sub_etapa: todayFormattedForDB,
        projeto_id: part.projeto_id,
        operador: operator,
        hora_inicio_turno: currentTime,
        hora_fim_turno: "17:00"
    };

    console.log('Ferramentaria: Dados da nova sub-etapa a serem enviados:', newSubStageData);

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/ferramentas/${toolId}/sub_etapas_producao`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newSubStageData)
        });

        console.log('Ferramentaria: Resposta da API para assignPartToToolProduction:', response.status, response.statusText);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido ao atribuir peça à produção. Resposta não-JSON.' }));
            console.error('Ferramentaria: Erro detalhado da API:', errorData);
            throw new Error(errorData.error || 'Erro ao atribuir peça à produção.');
        }

        const result = await response.json();
        window.showToast(`Peça "${part.nome}" atribuída à produção com sucesso!`, 'success');

        // ===== INÍCIO DA CORREÇÃO =====
        // Força a atualização da lista de peças do projeto em segundo plano
        if (window.fetchProjectParts) {
            window.fetchProjectParts(part.projeto_id);
        }
        // ===== FIM DA CORREÇÃO =====

        // O restante do código para recarregar a tela de ferramentaria permanece o mesmo
        window.fetchToolSubStages(toolId, true);
        window.fetchAndRenderTools();
        if (document.getElementById('tela5').classList.contains('active')) {
            window.initializeProducaoScreen();
        }

    } catch (error) {
        console.error('Ferramentaria: Erro ao atribuir peça à produção:', error);
        window.showError('Erro ao atribuir peça à produção: ' + error.message);
    }
};

// ===============================================
// Event Listeners Globais para Ferramentaria
// ===============================================

// REGISTRO DO INICIALIZADOR DA TELA: IMEDIATAMENTE NO CORPO DO SCRIPT, FORA DE QUALQUER DOMContentLoaded
if (typeof window.screenInitializers === 'undefined') {
    window.screenInitializers = {};
}
window.screenInitializers['tela4'] = window.initializeToolingScreen;

document.addEventListener('DOMContentLoaded', () => {
});

function setupToolSubStagesModalListeners() {
    const editToolSubStageForm = document.getElementById('editToolSubStageForm');
    if (editToolSubStageForm) {
        editToolSubStageForm.removeEventListener('submit', window.editToolSubStage);
        editToolSubStageForm.addEventListener('submit', window.editToolSubStage);
    }

    const toolSubStagesList = document.getElementById('toolSubStagesList');
    if (toolSubStagesList) {
        toolSubStagesList.removeEventListener('click', handleSubStageListClick);
        toolSubStagesList.addEventListener('click', handleSubStageListClick);
    }

    const searchProjectPartsBtn = document.getElementById('searchProjectPartsBtn');
    const searchProjectPartsInput = document.getElementById('searchProjectPartsInput');
    if (searchProjectPartsBtn && searchProjectPartsInput) {
        searchProjectPartsBtn.addEventListener('click', () => {
            window.fetchAndRenderPartsToSelect(searchProjectPartsInput.value);
        });
        searchProjectPartsInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                window.fetchAndRenderPartsToSelect(searchProjectPartsInput.value);
            }
        });
    }
}

function handleSubStageListClick(event) {
    const editButton = event.target.closest('.edit-tool-sub-stage-btn');
    if (editButton) {
        const subStageId = parseInt(editButton.dataset.subStageId);
        window.openEditToolSubStageModal(subStageId);
        return;
    }

    const deleteButton = event.target.closest('.delete-tool-sub-stage-btn');
    if (deleteButton) {
        const subStageId = parseInt(deleteButton.dataset.subStageId);
        window.deleteToolSubStage(subStageId);
        return;
    }

    const checkbox = event.target.closest('.sub-etapa-checkbox');
    if (checkbox) {
        const subStageId = parseInt(checkbox.dataset.subStageId);
        window.toggleSubStageStatus(subStageId, checkbox.checked);
    }

    const completeBtn = event.target.closest('.complete-btn');
    if (completeBtn) {
        const subStageId = parseInt(completeBtn.dataset.subStageId);
        window.toggleSubStageStatus(subStageId, true);
        return;
    }

    const uncompleteBtn = event.target.closest('.uncomplete-btn');
    if (uncompleteBtn) {
        const subStageId = parseInt(uncompleteBtn.dataset.subStageId);
        window.toggleSubStageStatus(subStageId, false);
        return;
    }
}

async function loadProjectsForToolSubStages() {
    const selectElements = document.querySelectorAll('#toolSubStageProject, #editToolSubStageProject');
    selectElements.forEach(select => {
        let defaultOption = select.querySelector('option[value=""]');
        if (!defaultOption) {
            defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Nenhum Projeto';
            select.prepend(defaultOption);
        }
        Array.from(select.options).filter(opt => opt.value !== '').forEach(opt => opt.remove());
    });

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/projetos`);
        if (response.ok) {
            const projects = await response.json();
            selectElements.forEach(select => {
                projects.forEach(project => {
                    const option = document.createElement('option');
                    option.value = project.id;
                    option.textContent = project.nome;
                    select.appendChild(option);
                });
            });
        } else {
            console.error('Erro ao carregar projetos para sub-etapas de ferramenta:', await response.text());
        }
    } catch (error) {
        console.error('Erro de rede ao carregar projetos para sub-etapas de ferramenta:', error);
    }
}