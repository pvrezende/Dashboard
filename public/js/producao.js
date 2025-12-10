// producao.js (VERSÃO FINAL E CORRIGIDA - SEM DRAG-AND-DROP)

/**
 * Variáveis globais
 */
var producaoFerramentas = [];
let ferramentaSelecionadaId = null;
let producaoContainer = null;

// Variáveis para o gerenciamento de temporizadores, agora armazenando o estado de múltiplos timers
// Key: toolId, Value: { intervalId, elapsedTime, startTime, isRunning, subStageId, toolHoursPerDay, fullscreenTimerElement }
const timers = new Map();
// Objeto para armazenar o estado ativo dos timers recuperado do backend.
// Key: ferramenta_id, Value: { sub_etapa_producao_id, status, tempo_acumulado_ms, ultimo_inicio_timestamp }
let activeBackendTimers = new Map(); // Esta é a variável CRÍTICA para a sincronização

// Função auxiliar para obter horário formatado ou fallback
function getFormattedTime(timeValue) {
    return (timeValue && timeValue.trim() !== '') ? timeValue : 'HH:MM';
}


/**
 * Inicializa a tela de Produção, buscando e exibindo as ferramentas.
 */
window.initializeProducaoScreen = function() {
    console.log('Produção: Inicializando tela...');
    const mainContentArea = document.getElementById('ferramentaDetailsDisplay');
    producaoContainer = document.querySelector('.producao-container');

    if (!mainContentArea || !producaoContainer) {
        console.error('Produção: Elementos essenciais da tela (mainContentArea ou producaoContainer) não encontrados no DOM! Verifique index.html (tela5).');
        if(mainContentArea) mainContentArea.innerHTML = '<div class="no-tools" style="color:red;">Erro: Problema na estrutura da página.</div>';
        return;
    }

    mainContentArea.innerHTML = '<div class="loading-indicator">Carregando ferramentas...</div>';

    // Primeiro, busca o estado dos timers ativos do backend
    window.fetchActiveTimersState().then(() => {
        buscarFerramentasParaExibicao(); // Em seguida, busca as ferramentas e renderiza-as com os estados dos timers
    }).catch(error => {
        console.error("Produção: Erro ao buscar estados de timers ativos do backend:", error);
        window.showError("Erro ao carregar estado dos temporizadores: " + error.message);
        buscarFerramentasParaExibicao(); // Tenta buscar ferramentas mesmo que o estado do timer falhe
    });
};

/**
 * Para o carrossel automático.
 */
window.stopProducaoCarousel = function() {
    // Implementação removida, função mantida como placeholder
};

/**
 * Busca o estado de todos os temporizadores atualmente ativos no backend.
 * Popula a variável global `activeBackendTimers`.
 */
window.fetchActiveTimersState = async function() {
    console.log("Produção: Buscando estados de timers ativos do backend...");
    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/timers/active`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao buscar estados de timers. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao buscar estados de timers.');
        }
        const activeTimers = await response.json();
        activeBackendTimers = new Map(); // Limpa o mapa antes de preencher
        activeTimers.forEach(timer => {
            activeBackendTimers.set(timer.ferramenta_id, timer);
        });
        console.log("Produção: Estados de timers ativos carregados:", activeTimers);
    } catch (error) {
        console.error("Produção: Erro ao buscar estados de timers ativos:", error);
        throw error; // Propaga o erro
    }
};

/**
 * Busca todas as ferramentas e suas sub-etapas do servidor para exibição.
 */
async function buscarFerramentasParaExibicao() {
    console.log('Produção: Buscando ferramentas...');
    const mainContentArea = document.getElementById('ferramentaDetailsDisplay');
    const fullscreenTimerElement = document.getElementById('fullscreenTimerDisplay');

    try {
        const toolsResponse = await window.authenticatedFetch(`${API_BASE_URL}/ferramentas`);
        if (!toolsResponse.ok) {
            const errorData = await toolsResponse.json().catch(() => ({ error: 'Error fetching tools. Non-JSON response.' }));
            throw new Error(errorData.error || 'Error fetching tools.');
        }
        let fetchedFerramentas = await toolsResponse.json();
        console.log('Produção: Ferramentas recebidas do backend (antes de sub-etapas):', fetchedFerramentas);

        if (fetchedFerramentas.length === 0) {
            producaoFerramentas = [];
            mainContentArea.innerHTML = '<div class="placeholder-message">Nenhuma ferramenta para exibir.</div>';
            window.stopProducaoCarousel();
            if (fullscreenTimerElement) fullscreenTimerElement.style.display = 'none';
            return;
        }

        const ferramentasPromises = fetchedFerramentas.map(async (ferramenta) => {
            try {
                const subEtapasResponse = await window.authenticatedFetch(
                    `${API_BASE_URL}/ferramentas/${ferramenta.id}/sub_etapas_producao?includeProjectName=true`
                );

                if (subEtapasResponse.ok) {
                    ferramenta.subEtapasProducao = await subEtapasResponse.json();
                    console.log(`Produção: Sub-etapas para ${ferramenta.nome} (ID:${ferramenta.id}):`, ferramenta.subEtapasProducao);
                } else {
                    ferramenta.subEtapasProducao = [];
                    console.warn(`Produção: Não foi possível carregar sub-etapas para a ferramenta ${ferramenta.nome} (ID: ${ferramenta.id}).`);
                }
            } catch (e) {
                ferramenta.subEtapasProducao = [];
                console.error(`Produção: Erro de rede ao buscar sub-etapas para a ferramenta ${ferramenta.nome} (ID: ${ferramenta.id}):`, e);
            }
            return ferramenta;
        });

        producaoFerramentas = await Promise.all(ferramentasPromises);
        console.log('Produção: Ferramentas com sub-etapas carregadas:', producaoFerramentas);

        const isFullscreen = producaoContainer.classList.contains('fullscreen-mode');

        if (isFullscreen && ferramentaSelecionadaId) {
             exibirDetalhesFerramenta(ferramentaSelecionadaId);
        } else {
            renderizarListaCompactaFerramentas(producaoFerramentas);
            ferramentaSelecionadaId = null;
            window.stopProducaoCarousel();
            if (fullscreenTimerElement) fullscreenTimerElement.style.display = 'none';
        }
        // CRÍTICO: Aplica as permissões da UI após a renderização dos cards
        if (window.applyUIPermissions && window.getCurrentUser) {
            window.applyUIPermissions(window.getCurrentUser()?.role);
        }

    } catch (error) {
        console.error('Produção: Erro ao carregar ferramentas:', error);
        mainContentArea.innerHTML = `<div class="placeholder-message" style="color:red;">Erro ao carregar ferramentas: ${error.message}.</div>`;
        window.showError('Erro ao carregar ferramentas: ' + error.message);
        window.stopProducaoCarousel();
        if (fullscreenTimerElement) fullscreenTimerElement.style.display = 'none';
    }
};


/**
 * Renderiza a lista compacta de ferramentas na área principal.
 * @param {Array<Object>} ferramentas - Array de objetos de ferramenta (agora producaoFerramentas).
 */
function renderizarListaCompactaFerramentas(ferramentas) {
    const mainContentArea = document.getElementById('ferramentaDetailsDisplay');
    if (!mainContentArea) return;

    mainContentArea.innerHTML = '';

    const existingFullscreenTimer = document.getElementById('fullscreenTimerDisplay');
    if (existingFullscreenTimer) {
        existingFullscreenTimer.style.display = 'none';
    }

    // MODIFICAÇÃO AQUI: Filtrar para mostrar apenas ferramentas com atividades relevantes
    const ferramentasAtivasParaExibicao = ferramentas.filter(ferramenta => {
        // Adiciona uma verificação para garantir que subEtapasProducao é um array
        const hasSubEtapas = Array.isArray(ferramenta.subEtapasProducao) && ferramenta.subEtapasProducao.length > 0;

        if (!hasSubEtapas) {
            // NOVO: Adiciona a condição para incluir a ferramenta se ela tem um timer ativo, mesmo sem sub-etapas agendadas.
            return activeBackendTimers.has(ferramenta.id);
        }

        // Verifica se há alguma sub-etapa não concluída
        const hasNonCompletedSubStage = ferramenta.subEtapasProducao.some(subEtapa => !subEtapa.concluida);
        
        // NOVO: Adiciona a condição para incluir a ferramenta se ela tem alguma sub-etapa que está com timer ativo
        const hasActiveTimer = activeBackendTimers.has(ferramenta.id);

        return hasNonCompletedSubStage || hasActiveTimer; // Exibe se tiver atividade não concluída ou timer ativo
    });

    console.log('Produção: Ferramentas ATIVAS após filtro:', ferramentasAtivasParaExibicao); // Renomeei para evitar confusão

    // Use ferramentasAtivasParaExibicao para ordenação e renderização
    ferramentasAtivasParaExibicao.sort((a, b) => {
        const statusA = determinarStatusFerramenta(a);
        const statusB = determinarStatusFerramenta(b);

        const statusOrder = { 'em-processo': 1, 'atrasado': 2, 'em-andamento': 3, 'na-fila-de-producao': 4, 'pendente': 5, 'concluido': 6, 'disponivel': 7, 'sem-turno': 8 };
        return statusOrder[statusA] - statusOrder[statusB];
    });

    if (ferramentasAtivasParaExibicao.length === 0) {
        mainContentArea.innerHTML = '<div class="placeholder-message">Nenhuma ferramenta com atividade agendada ou em andamento para exibir.</div>';
        return;
    }

    ferramentasAtivasParaExibicao.forEach(ferramenta => { // Loop sobre a lista filtrada
        const miniCard = document.createElement('div');
        miniCard.className = `ferramenta-mini-card ${ferramenta.id === ferramentaSelecionadaId ? 'active-selected' : ''}`;
        miniCard.dataset.toolId = ferramenta.id;

        let finalShiftToDisplay = getRelevantShiftForTool(ferramenta);

        let displayOperator = 'Não Informado';
        let timeStatusText = 'SEM TURNO';
        let activityDetailsHtml = 'Nenhuma atividade ativa.';
        let statusDotClass = 'status-sem-turno';

        const currentSubStageId = finalShiftToDisplay ? finalShiftToDisplay.id : null;
        let toolHoursPerDay = finalShiftToDisplay ? parseFloat(finalShiftToDisplay.horas_previstas_conclusao) || 0 : 0;
        let isOverdueShift = false;
        
        const backendTimerState = activeBackendTimers.get(ferramenta.id);
        const isTimerActive = backendTimerState && (backendTimerState.status === 'running' || backendTimerState.status === 'paused');
        let elapsedTime = backendTimerState ? backendTimerState.tempo_acumulado_ms : 0;

        if (backendTimerState && backendTimerState.status === 'running' && backendTimerState.ultimo_inicio_timestamp) {
            const lastStart = new Date(backendTimerState.ultimo_inicio_timestamp).getTime();
            elapsedTime += (Date.now() - lastStart);
        }

        timers.set(ferramenta.id, {
            intervalId: null,
            elapsedTime: elapsedTime,
            startTime: isTimerActive && backendTimerState.status === 'running' ? Date.now() - elapsedTime : null,
            isRunning: isTimerActive && backendTimerState.status === 'running',
            subStageId: backendTimerState ? backendTimerState.sub_etapa_producao_id : currentSubStageId,
            toolHoursPerDay: toolHoursPerDay,
            fullscreenTimerElement: null
        });

        if (finalShiftToDisplay) {
            displayOperator = finalShiftToDisplay.operador || 'Não Informado';
            toolHoursPerDay = parseFloat(finalShiftToDisplay.horas_previstas_conclusao) || 0;
            const startTime = getFormattedTime(finalShiftToDisplay.hora_inicio_turno);
            const endTime = getFormattedTime(finalShiftToDisplay.hora_fim_turno);
            const today = new Date();
            today.setHours(0,0,0,0);

            let dueDateObj = finalShiftToDisplay.data_prevista_conclusao ? window.parseDDMMYYYYtoDate(finalShiftToDisplay.data_prevista_conclusao) : null;
            if (dueDateObj && dueDateObj.getTime() < today.getTime() && !finalShiftToDisplay.concluida) {
                isOverdueShift = true;
            }

            if (isTimerActive) {
                timeStatusText = 'EM PROCESSO';
                statusDotClass = 'status-em-processo';
            } else if (finalShiftToDisplay.concluida) {
                timeStatusText = 'ENCERRADO';
                statusDotClass = 'status-concluida';
            } else if (isOverdueShift) {
                timeStatusText = 'ATRASADO';
                statusDotClass = 'status-atrasada';
            } else {
                timeStatusText = 'NA FILA DE PRODUÇÃO';
                statusDotClass = 'status-em-andamento';
            }

            const currentActivity = finalShiftToDisplay;
            if (currentActivity && currentActivity.descricao) {
                const fullActivityDescription = currentActivity.descricao;
                const activityDescriptionMatch = fullActivityDescription.match(/Produção de Peça: (.+) \(Qtd: (\d+)\)/);
                let activityName = fullActivityDescription;
                let activityQuantity = 'N/A';

                if (activityDescriptionMatch && activityDescriptionMatch[1]) {
                    activityName = activityDescriptionMatch[1].trim();
                    activityQuantity = activityDescriptionMatch[2];
                }

                const projectNameInfo = currentActivity.nome_projeto ? `<span class="sub-etapa-project-name">${currentActivity.nome_projeto}</span>` : '<span class="value-na">N/A</span>';
                const operatorInfoContent = currentActivity.operador ? `<span class="operator-name">${currentActivity.operador}</span>` : '<span class="value-na">N/A</span>';

                const displayedRealizedHours = (isTimerActive)
                    ? window.convertDecimalHoursToHMMDisplay(elapsedTime / 3600000)
                    : (currentActivity.horas_trabalhadas_dia !== null ? window.convertDecimalHoursToHMMDisplay(parseFloat(currentActivity.horas_trabalhadas_dia)) : '0.00');

                const plannedHours = currentActivity.horas_previstas_conclusao !== null ? window.convertDecimalHoursToHMMDisplay(parseFloat(currentActivity.horas_previstas_conclusao)) : '0.00';

                activityDetailsHtml = `
                    <p class="mini-card-text activity-description"><span class="label-color description-label">Atividade:</span> <span class="activity-value">${activityName}</span></p>
                    <p class="mini-card-text"><span class="label-color machine-label">Máquina:</span> <span class="machine-name">${ferramenta.nome}</span></p>
                    <p class="mini-card-text"><span class="label-color quantity-label">Quantidade:</span> <span class="quantity-value">${activityQuantity}</span></p>
                    <p class="mini-card-text"><span class="label-color project-label">Projeto:</span> ${projectNameInfo} <span class="label-color operator-label">Operador:</span> ${operatorInfoContent}</p>
                `;
            } else {
                activityDetailsHtml = '<p class="mini-card-text no-activity">Nenhuma atividade agendada para esta ferramenta.</p>';
            }

        } else {
            displayOperator = 'Não Informado';
            timeStatusText = 'SEM TURNO';
            activityDetailsHtml = '<p class="mini-card-text no-activity">Nenhuma atividade agendada para esta ferramenta.</p>';
            statusDotClass = 'status-sem-turno';
        }

        let imagemSrc = 'img/placeholder.png';
        const nomeLower = ferramenta.nome.toLowerCase();
        if (nomeLower.includes('torno')) { imagemSrc = 'img/torno.png'; }
        else if (nomeLower.includes('fresa')) { imagemSrc = 'img/fresagem.png'; }
        else if (nomeLower.includes('usinagem')) { imagemSrc = 'img/usinagem.png'; }
        else if (nomeLower.includes('serra')) { imagemSrc = 'img/serra.png'; }
        else if (nomeLower.includes('rosqueadeira')) { imagemSrc = 'img/rosqueadeira.png'; }

        const mostRelevantSubStage = getRelevantShiftForTool(ferramenta);
        if (mostRelevantSubStage && mostRelevantSubStage.miniatura_url) {
            imagemSrc = mostRelevantSubStage.miniatura_url;
        }

        if (isOverdueShift) {
            miniCard.classList.add('overdue-card');
        }
        
        const overallPercentage = calcularProgressoFerramenta(ferramenta); 
        let progressStatusClassMiniCard = determinarStatusFerramenta(ferramenta);
        if (overallPercentage === 100) progressStatusClassMiniCard = 'concluido';

        miniCard.innerHTML = `
            <div class="ferramenta-mini-card-header">
                <span class="ferramenta-mini-card-name">${ferramenta.nome}</span>
                <div class="ferramenta-mini-card-status">
                    <span class="ferramenta-mini-card-status-text ${statusDotClass}">${timeStatusText}</span>
                </div>
            </div>
            <div class="ferramenta-mini-card-body">
                <div class="ferramenta-mini-card-image-container">
                    <img src="${imagemSrc}" alt="${ferramenta.nome}" onerror="this.onerror=null; this.src='img/placeholder.png';">
                </div>
                <div class="ferramenta-mini-card-details-content">
                    ${activityDetailsHtml}
                </div>
            </div>
            <div class="progress-bar-container-mini">
                <div class="progress-bar-fill ${progressStatusClassMiniCard}" style="width: ${overallPercentage}%"></div>
                <span class="progress-bar-text">${overallPercentage}%</span>
            </div>
            <div class="timer-section" data-tool-id="${ferramenta.id}" data-sub-stage-id="${currentSubStageId}" data-tool-hours-per-day="${toolHoursPerDay}">
                <div class="timer-display">00:00:00</div>
                <div class="timer-progress-bar-container">
                    <div class="timer-progress-bar-fill" style="width: 0%;"></div>
                </div>
                <div class="timer-controls">
                    <button class="start-btn action-button success"><i class="fas fa-play"></i> Iniciar</button>
                    <button class="pause-btn action-button warning hidden-control"><i class="fas fa-pause"></i> Pausar</button>
                    <button class="stop-btn action-button danger hidden-control"><i class="fas fa-stop"></i> Resetar</button>
                    <button class="complete-activity-btn action-button secondary hidden-control"><i class="fas fa-check-double"></i> Concluir Atividade</button>
                </div>
            </div>
        `;

        miniCard.addEventListener('click', (event) => {
            if (event.target.closest('.timer-controls button')) {
                return;
            }
            toggleProducaoFullscreen(ferramenta.id);
        });

        mainContentArea.appendChild(miniCard);
        setupTimerControls(ferramenta.id, currentSubStageId, toolHoursPerDay);
    });

    if (ferramentasAtivasParaExibicao.length > 0 && ferramentaSelecionadaId === null) {
        ferramentaSelecionadaId = ferramentasAtivasParaExibicao[0].id;
    }
    if (ferramentaSelecionadaId) {
        const selectedMiniCard = document.querySelector(`.ferramenta-mini-card[data-tool-id="${ferramentaSelecionadaId}"]`);
        if (selectedMiniCard) {
            document.querySelectorAll('.ferramenta-mini-card').forEach(card => card.classList.remove('active-selected'));
            selectedMiniCard.classList.add('active-selected');
            selectedMiniCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
    if (window.applyUIPermissions && window.getCurrentUser) {
        window.applyUIPermissions(window.getCurrentUser()?.role);
    }
}


/**
 * Lógica auxiliar para determinar o shift mais relevante para uma ferramenta.
 * Retirado do renderizarShiftBoard para ser reutilizado.
 */
function getRelevantShiftForTool(ferramenta) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Filtra apenas por sub-etapas que não estão concluídas e possuem uma data de agendamento
    const pendingAndDatedSubStages = ferramenta.subEtapasProducao.filter(se => !se.concluida && se.data_sub_etapa);

    if (pendingAndDatedSubStages.length === 0) {
        return null; // Se não há nenhuma atividade pendente com data, não há o que mostrar.
    }

    // 2. Ordena as atividades por data e, em seguida, por hora de início
    pendingAndDatedSubStages.sort((a, b) => {
        const dateA = window.parseDDMMYYYYtoDate(a.data_sub_etapa);
        const dateB = window.parseDDMMYYYYtoDate(b.data_sub_etapa);

        const timeA = dateA instanceof Date && !isNaN(dateA.getTime()) ? dateA.getTime() : Infinity;
        const timeB = dateB instanceof Date && !isNaN(dateB.getTime()) ? dateB.getTime() : Infinity;

        // Se as datas são diferentes, ordena pela data
        if (timeA !== timeB) {
            return timeA - timeB;
        }

        // Se as datas são iguais, ordena pela hora de início
        const timeStrA = a.hora_inicio_turno || '00:00';
        const timeStrB = b.hora_inicio_turno || '00:00';
        const partsA = timeStrA.split(':').map(Number);
        const partsB = timeStrB.split(':').map(Number);
        const minutesA = partsA[0] * 60 + (partsA[1] || 0);
        const minutesB = partsB[0] * 60 + (partsB[1] || 0);
        return minutesA - minutesB;
    });

    // 3. Encontra a atividade mais relevante a ser exibida
    // Procura pela primeira atividade que seja de hoje ou de uma data passada (atrasada)
    const relevantShift = pendingAndDatedSubStages.find(se => {
        const seDate = window.parseDDMMYYYYtoDate(se.data_sub_etapa);
        seDate.setHours(0, 0, 0, 0);
        return seDate.getTime() <= today.getTime();
    });

    // Se encontrou uma tarefa relevante (a primeira de hoje ou a mais antiga atrasada), retorna ela
    if (relevantShift) {
        return relevantShift;
    }

    // Se não há tarefas para hoje ou atrasadas, retorna a primeira tarefa futura da lista
    return pendingAndDatedSubStages[0] || null;
}

/**
 * Cria o card de detalhes HTML para uma ferramenta específica.
 * @param {Object} ferramenta - Objeto da ferramenta com suas subEtapasProducao.
 * @returns {HTMLElement} O elemento do card de detalhes da ferramenta.
 */
function criarCardDetalhesFerramenta(ferramenta) {
    const card = document.createElement('div');
    card.className = 'ferramenta-card-details';
    card.dataset.toolId = ferramenta.id;

    const status = determinarStatusFerramenta(ferramenta);
    let statusClassForDisplay = status;
    let statusTextForDisplay = '';

    if (status === 'atrasado') {
        statusTextForDisplay = 'Atrasada';
    } else if (status === 'em-andamento') {
        statusTextForDisplay = 'Em Andamento';
    } else if (status === 'em-processo') {
        statusTextForDisplay = 'Em Processo';
    } else if (status === 'concluido') {
        statusTextForDisplay = 'Concluída';
    } else if (status === 'pendente') {
        statusTextForDisplay = 'Pendente';
    } else if (status === 'sem-turno') {
        statusTextForDisplay = 'Sem Turno';
    } else {
        statusTextForDisplay = 'Desconhecido';
    }

    const progresso = calcularProgressoFerramenta(ferramenta); 

    let operador = 'Não Informado';
    if (ferramenta.operador && ferramenta.operador.trim() !== '') {
        operador = ferramenta.operador;
    } else if (Array.isArray(ferramenta.subEtapasProducao) && ferramenta.subEtapasProducao.length > 0) {
        const relevantShift = getRelevantShiftForTool(ferramenta);
        if (relevantShift && relevantShift.operador && relevantShift.operador.trim() !== '') {
            operador = relevantShift.operador;
        } else {
            const firstSubEtapaWithOperator = ferramenta.subEtapasProducao.find(se => se.operador && se.operador.trim() !== '');
            if (firstSubEtapaWithOperator) {
                operador = firstSubEtapaWithOperator.operador;
            }
        }
    }

    const header = document.createElement('div');
    header.className = 'ferramenta-header';
    header.innerHTML = `
        <div class="status-indicator ${statusClassForDisplay}" title="Status: ${statusTextForDisplay}"></div>
        <h2>${ferramenta.nome}</h2>
    `;
    card.appendChild(header);

    const content = document.createElement('div');
    content.className = 'ferramenta-content-inner';

    const imageSection = document.createElement('div');
    imageSection.className = 'ferramenta-image-section-fullscreen';

    let imagemSrc = 'img/placeholder.png';
    const nomeLower = ferramenta.nome.toLowerCase();
    if (nomeLower.includes('torno')) { imagemSrc = 'img/torno.png'; }
    else if (nomeLower.includes('fresa')) { imagemSrc = 'img/fresagem.png'; }
    else if (nomeLower.includes('usinagem')) { imagemSrc = 'img/usinagem.png'; }
    else if (nomeLower.includes('serra')) { imagemSrc = 'img/serra.png'; }
    else if (nomeLower.includes('rosqueadeira')) { imagemSrc = 'img/rosqueadeira.png'; }

    // NOVO: Usa a miniatura da sub-etapa mais relevante se disponível
    const mostRelevantSubStage = getRelevantShiftForTool(ferramenta);
    if (mostRelevantSubStage && mostRelevantSubStage.anexo_url && mostRelevantSubStage.anexo_tipo_arquivo.includes('image')) {
        imagemSrc = mostRelevantSubStage.anexo_url;
    } else if (mostRelevantSubStage && mostRelevantSubStage.anexo_url && mostRelevantSubStage.anexo_tipo_arquivo.includes('pdf')) {
        // Se o anexo é um PDF, use um ícone de PDF
        imagemSrc = 'img/pdf-icon.png';
    }

    imageSection.innerHTML = `
        <div class="ferramenta-image-fullscreen">
            <img src="${imagemSrc}" alt="${ferramenta.nome}" onerror="this.onerror=null; this.src='img/placeholder.png';">
        </div>
        <div class="operador-info-fullscreen">
            <span>Operador: <strong>${operador}</strong></span>
            <span>Status: <strong class="${statusClassForDisplay}">${statusTextForDisplay}</strong></span>
        </div>
        <div class="progress-bar-container-fullscreen" title="Progresso Geral: ${progresso}%">
            <div class="progress-bar-fill ${statusClassForDisplay}" style="width: ${progresso}%">${progresso}%</div>
        </div>
    `;
    content.appendChild(imageSection);

    const activitiesSection = document.createElement('div');
    activitiesSection.className = 'ferramenta-activities-section-fullscreen';

    activitiesSection.innerHTML = `
        <h3 class="activities-header activities-header-${statusClassForDisplay}">Atividades Pendentes / Em Andamento</h3>
        <div class="activities-list-fullscreen" id="activitiesListFullscreen">
            ${criarListaAtividades(ferramenta)}
        </div>
    `;
    card.appendChild(activitiesSection);

    const backButton = document.createElement('button');
    backButton.className = 'back-to-list-btn';
    backButton.innerHTML = '<i class="fas fa-times"></i> Fechar Detalhes';
    backButton.addEventListener('click', () => {
        exitProducaoFullscreen();
    });
    card.appendChild(backButton);
    
    card.querySelectorAll('.print-attachment-btn').forEach(button => {
        if (!button.disabled) {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const attachmentUrl = button.dataset.url;
                window.printFile(attachmentUrl);
            });
        }
    });

    return card;
}


/**
 * Cria o HTML para a lista de atividades (sub-etapas não concluídas) de uma ferramenta.
 * @param {Object} ferramenta - Objeto da ferramenta.
 * @returns {string} HTML da lista de atividades.
 */
function criarListaAtividades(ferramenta) {
    if (!Array.isArray(ferramenta.subEtapasProducao) || ferramenta.subEtapasProducao.length === 0) {
        return '<div class="activity-item-none">Nenhuma atividade cadastrada.</div>';
    }

    const atividadesNaoConcluidas = ferramenta.subEtapasProducao.filter(subEtapa => !subEtapa.concluida);

    if (atividadesNaoConcluidas.length === 0) {
        return '<div class="activity-item-none">Todas as atividades concluídas.</div>';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    atividadesNaoConcluidas.sort((a, b) => a.ordem - b.ordem);

    let html = '';
    atividadesNaoConcluidas.forEach(subEtapa => {
        const projectNameInfo = subEtapa.nome_projeto ? `<span class="sub-etapa-project-name">${subEtapa.nome_projeto}</span>` : '<span class="value-na">N/A</span>';
        const operatorInfoContent = subEtapa.operador ? `<span class="operator-name">${subEtapa.operador}</span>` : '<span class="value-na">N/A</span>';

        const hoursRealizedDisplay = subEtapa.horas_trabalhadas_dia !== null && !isNaN(parseFloat(subEtapa.horas_trabalhadas_dia))
                                ? window.convertDecimalHoursToHMMDisplay(parseFloat(subEtapa.horas_trabalhadas_dia)) : '0.00';
        const hoursPlannedDisplay = subEtapa.horas_previstas_conclusao !== null && !isNaN(parseFloat(subEtapa.horas_previstas_conclusao))
                                ? window.convertDecimalHoursToHMMDisplay(parseFloat(subEtapa.horas_previstas_conclusao)) : '0.00';

        const turnInfo = `Turno: ${getFormattedTime(subEtapa.hora_inicio_turno)} - ${getFormattedTime(subEtapa.hora_fim_turno)}`;
        
        // CORREÇÃO: Declarar a variável dateText corretamente
        const dateText = `Dia: ${subEtapa.data_sub_etapa || 'N/A'}`;

        const activityStatusClass = getSubStageSpecificStatus(subEtapa, today);
        let attachmentUrl = subEtapa.anexo_url;
        let fileNameDisplay = subEtapa.anexo_nome_arquivo || 'Arquivo';
        if (fileNameDisplay.length > 20) {
            fileNameDisplay = fileNameDisplay.substring(0, 17) + '...';
        }
        
        let mediaHtml = '';
        const isViewableAttachment = subEtapa.anexo_url && (subEtapa.anexo_tipo_arquivo.includes('image') || subEtapa.anexo_tipo_arquivo.includes('pdf'));
        if (isViewableAttachment) {
            mediaHtml = `<div class="attachment-thumbnail-container" data-url="${attachmentUrl}" data-file-type="${subEtapa.anexo_tipo_arquivo}" data-file-name="${subEtapa.anexo_nome_arquivo}">`;

            if (subEtapa.anexo_tipo_arquivo.includes('pdf')) {
                mediaHtml += `<iframe src="${attachmentUrl}#toolbar=0&navpanes=0&scrollbar=0" title="Pré-visualização de ${subEtapa.anexo_nome_arquivo}"></iframe>`;
            } else {
                mediaHtml += `<img src="${attachmentUrl}" alt="${subEtapa.anexo_nome_arquivo}">`;
            }
            mediaHtml += `</div>`;
        }

        const attachmentsHtml = attachmentUrl ? `
            <div class="attachment-column">
                ${mediaHtml}
                <div class="attachment-actions-group">
                    <a href="${attachmentUrl}" target="_blank" download="${subEtapa.anexo_nome_arquivo}" class="action-button primary small" title="Download">
                        <i class="fas fa-download"></i> Download
                    </a>
                    <button class="action-button info small print-attachment-btn" data-url="${attachmentUrl}" title="Imprimir">
                        <i class="fas fa-print"></i> Imprimir
                    </button>
                </div>
            </div>
        ` : `
            <div class="attachment-column hidden-attachment-column"></div>
        `;
        
        const activityInfoTextColHtml = `
            <div class="activity-info-text-grid-col">
                <div class="activity-info-text">
                    <p class="mini-card-text activity-description"><span class="label-color description-label">Atividade:</span> <span class="activity-value">${subEtapa.descricao}</span></p>
                    <p class="mini-card-text">
                        <span class="label-color">Turno:</span> ${turnInfo}
                        <span class="label-color">Dia:</span> ${dateText}
                    </p>
                    <p class="mini-card-text">
                        <span class="label-color project-label">Projeto:</span> ${projectNameInfo}
                        <span class="label-color operator-label">Operador:</span> ${operatorInfoContent}
                    </p>
                    <p class="mini-card-text">
                        <span class="label-color">Horas Realizadas:</span> <span class="realized-hours">${hoursRealizedDisplay}h</span>
                        <span class="label-color">Horas Previstas:</span> <span class="planned-hours">${hoursPlannedDisplay}h</span>
                    </p>
                </div>
            </div>
        `;

        html += `
            <div class="activity-item activity-item-${activityStatusClass}">
                <div class="activity-item-main-grid">
                    ${activityInfoTextColHtml}
                    ${attachmentsHtml}
                </div>
            </div>
        `;
    });

    return html;
}

/**
 * Função auxiliar para determinar o status específico de UMA sub-etapa
 * para uso na lista de atividades do card da ferramenta e na lógica geral.
 * @param {Object} subStage - O objeto da sub-etapa.
 * @param {Date} today - A data atual (meia-noite).
 * @returns {string} O status: 'atrasado', 'em-andamento', 'pendente', 'concluido'.
 */
function getSubStageSpecificStatus(subStage, today) {
    if (subStage.concluida) {
        return 'concluido';
    }

    // Prioriza data_prevista_conclusao (prazo) para determinar atraso/andamento
    if (subStage.data_prevista_conclusao) {
        try {
            const dueDateObj = window.parseDDMMYYYYtoDate(subStage.data_prevista_conclusao);

            if (dueDateObj instanceof Date && !isNaN(dueDateObj.getTime())) {
                if (dueDateObj.getTime() < today.getTime()) {
                    return 'atrasado'; // Data de prazo é anterior a hoje
                } else {
                    return 'em-andamento'; // Data de prazo é hoje ou no futuro
                }
            }
        } catch (e) {
            console.warn("Produção: Erro ao parsear data de prazo em getSubStageSpecificStatus (data_prevista_conclusao):", subStage.data_prevista_conclusao, e);
        }
    } 
    
    // Se não tem data_prevista_conclusao válida, usa data_sub_etapa (agendamento)
    if (subStage.data_sub_etapa) {
        try {
            const scheduledDateObj = window.parseDDMMYYYYtoDate(subStage.data_sub_etapa);
            
            if (scheduledDateObj instanceof Date && !isNaN(scheduledDateObj.getTime())) {
                if (scheduledDateObj.getTime() < today.getTime()) {
                    return 'atrasado'; // Data de agendamento é anterior a hoje
                } else {
                    return 'em-andamento'; // Data de agendamento é hoje ou no futuro
                }
            }
        } catch (e) {
            console.warn("Produção: Erro ao parsear data de agendamento em getSubStageSpecificStatus (data_sub_etapa):", subStage.data_sub_etapa, e);
        }
    }

    return 'pendente'; // Se não tiver datas válidas ou parsing falhar
};


/**
 * Determina o status GERAL de uma ferramenta com base em suas sub-etapas.
 * Esta é a função CRÍTICA que foi atualizada para a lógica de cores.
 * @param {Object} ferramenta - Objeto da ferramenta.
 * @returns {string} Status da ferramenta ('atrasado', 'em-andamento', 'concluido', 'pendente', 'sem-turno').
 */
function determinarStatusFerramenta(ferramenta) {
    // Prioridade máxima: se um timer está ativo (rodando ou pausado) para esta ferramenta, o status é "em-processo".
    if (activeBackendTimers.has(ferramenta.id)) {
        return 'em-processo';
    }

    // Obtenha as sub-etapas *apenas para o dia atual*
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normaliza para o início do dia

    // Adiciona verificação para garantir que subEtapasProducao é um array
    const subEtapasDoDia = Array.isArray(ferramenta.subEtapasProducao) ? ferramenta.subEtapasProducao.filter(se => {
        if (!se.data_sub_etapa) return false;
        const seDate = window.parseDDMMYYYYtoDate(se.data_sub_etapa);
        return seDate && seDate.getTime() === today.getTime();
    }) : []; // Se não for array, retorna array vazio

    // Verifica se a ferramenta tem sub-etapas agendadas (mesmo que não para hoje)
    const hasAnySubEtapas = Array.isArray(ferramenta.subEtapasProducao) && ferramenta.subEtapasProducao.length > 0;

    if (subEtapasDoDia.length === 0) {
        if (hasAnySubEtapas) {
            // Se não há atividades para o dia, mas tem sub-etapas agendadas (futuras ou passadas não concluídas),
            // e não há timer ativo, o status é "na-fila-de-producao".
            return 'na-fila-de-producao';
        }
        return 'disponivel'; // Se não há atividades para o dia e nenhuma sub-etapa agendada, é "disponivel"
    }

    let hasDelayed = false;
    let hasInProgress = false;
    let allDailyCompleted = true; // Flag para verificar se TODAS as sub-etapas do dia estão concluídas

    for (const subEtapa of subEtapasDoDia) {
        if (!subEtapa.concluida) {
            allDailyCompleted = false;
            const statusEspecifico = getSubStageSpecificStatus(subEtapa, today);
            if (statusEspecifico === 'atrasado') {
                hasDelayed = true;
            } else if (statusEspecifico === 'em-andamento') {
                hasInProgress = true;
            }
        }
    }

    if (hasDelayed) {
        return 'atrasado'; // Se há atrasos no dia, ferramenta atrasada
    } else if (hasInProgress && !allDailyCompleted) {
        return 'em-andamento'; // Se há progresso no dia e não tudo concluído
    } else if (allDailyCompleted && subEtapasDoDia.length > 0) {
        return 'concluido'; // Todas as atividades do dia foram concluídas
    } else {
        return 'pendente'; // Nenhuma atividade em andamento hoje, mas talvez agendadas futuras
    }
}


/**
 * Calcula o progresso percentual de uma ferramenta com base nas atividades do DIA.
 * @param {Object} ferramenta - Objeto da ferramenta.
 * @returns {number} Percentual de progresso (0-100).
 */
function calcularProgressoFerramenta(ferramenta) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normaliza para o início do dia

    // Adiciona verificação para garantir que subEtapasProducao é um array
    const subEtapasDoDia = Array.isArray(ferramenta.subEtapasProducao) ? ferramenta.subEtapasProducao.filter(subEtapa => {
        if (!subEtapa.data_sub_etapa) return false;
        const seDate = window.parseDDMMYYYYtoDate(subEtapa.data_sub_etapa);
        return seDate && seDate.getTime() === today.getTime();
    }) : []; // Se não for array, retorna array vazio

    const totalSubEtapasDoDia = subEtapasDoDia.length;
    if (totalSubEtapasDoDia === 0) {
        return 0; // Se não há atividades para o dia, 0%
    }

    const subEtapasConcluidasDoDia = subEtapasDoDia.filter(subEtapa => subEtapa.concluida).length;

    const percentual = (subEtapasConcluidasDoDia / totalSubEtapasDoDia) * 100;
    return Math.round(percentual);
};


// NOVO: Funções de Gerenciamento do Temporizador
function setupTimerControls(toolId, subStageId, toolHoursPerDay) {
    const timerSection = document.querySelector(`.timer-section[data-tool-id="${toolId}"]`);
    if (!timerSection) return;

    const startBtn = timerSection.querySelector('.start-btn');
    const pauseBtn = timerSection.querySelector('.pause-btn');
    const stopBtn = timerSection.querySelector('.stop-btn');
    const saveBtn = timerSection.querySelector('.save-btn');
    const completeActivityBtn = timerSection.querySelector('.complete-activity-btn'); // NOVO: Botão de concluir atividade

    // Limpar qualquer intervalo anterior para esta ferramenta
    if (timers.has(toolId) && timers.get(toolId).intervalId) {
        clearInterval(timers.get(toolId).intervalId);
    }

    // Inicializar ou atualizar o temporizador na memória com base NO ESTADO DO BACKEND
    const backendTimerState = activeBackendTimers.get(toolId);
    const initialIsRunning = backendTimerState && backendTimerState.status === 'running';
    const initialIsPaused = backendTimerState && backendTimerState.status === 'paused';
    let initialElapsedTime = backendTimerState ? backendTimerState.tempo_acumulado_ms : 0;

    // Se o timer está rodando (segundo o backend), recalcula o tempo decorrido
    if (initialIsRunning && backendTimerState.ultimo_inicio_timestamp) {
        const lastStart = new Date(backendTimerState.ultimo_inicio_timestamp).getTime();
        initialElapsedTime = Math.max(0, initialElapsedTime + (Date.now() - lastStart));
    }

    timers.set(toolId, {
        intervalId: null, // Será preenchido em setupTimerControls se estiver rodando
        elapsedTime: initialElapsedTime, // Tempo em milissegundos
        startTime: initialIsRunning ? Date.now() - initialElapsedTime : null,
        isRunning: initialIsRunning,
        subStageId: backendTimerState ? backendTimerState.sub_etapa_producao_id : subStageId, // Usa o subStageId do backend se existir
        toolHoursPerDay: toolHoursPerDay, // Horas planejadas para o dia (do banco de dados)
        fullscreenTimerElement: null
    });

    console.log(`DEBUG PRODUCAO SETUP: Timer para ferramenta ${toolId}. ` +
            `InitialElapsedTime: ${initialElapsedTime}, IsRunning: ${initialIsRunning}, IsPaused: ${initialIsPaused}. ` +
            `SubStageId: ${timers.get(toolId).subStageId}, ToolHoursPerDay: ${timers.get(toolId).toolHoursPerDay}`);

    updateTimerDisplay(toolId);
    updateTimerButtonVisibility(toolId);

    // Adicionar listeners (garantindo que não sejam duplicados)
    // Usar removeEventListener antes de addEventListener para segurança
    if (startBtn) {
        startBtn.onclick = null;
        startBtn.onclick = () => startTimer(toolId);
    }
    if (pauseBtn) {
        pauseBtn.onclick = null;
        pauseBtn.onclick = () => pauseTimer(toolId);
    }
    if (stopBtn) {
        stopBtn.onclick = null;
        stopBtn.onclick = () => stopTimer(toolId);
    }
    if (saveBtn) {
        saveBtn.onclick = null;
        saveBtn.onclick = () => saveHours(toolId);
    }
    if (completeActivityBtn) {
        completeActivityBtn.onclick = null;
        completeActivityBtn.onclick = () => completeActivity(toolId, subStageId);
    }

    // Se o timer está rodando (segundo o estado inicial vindo do backend), inicia o intervalo local
    if (initialIsRunning) {
        const timerState = timers.get(toolId);
        timerState.intervalId = setInterval(() => updateTimerAndDisplay(toolId), 1000);
        console.log(`DEBUG PRODUÇÃO SETUP: Ferramenta ${toolId} estava rodando. Setting interval. Current elapsedTime: ${timers.get(toolId).elapsedTime}`);
    }

    // Lógica para sempre exibir o timer e controlar a habilitação dos botões
    if (timerSection) timerSection.style.display = 'flex';
};

/**
 * Função de Setup do Temporizador para o Fullscreen.
 * Remove a funcionalidade e a exibição do temporizador em tela cheia.
 * Mantém apenas a inicialização do timerState.fullscreenTimerElement para
 * evitar erros de referência nula se a propriedade for acessada em outros locais.
 */
function setupTimerControlsForFullscreen(toolId, subStageId, toolHoursPerDay) {
    const timerSection = document.getElementById('fullscreenTimerDisplay');
    if (timerSection) {
        // ESCONDE O TEMPORIZADOR EM TELA CHEIA - Mantido como solicitado implicitamente
        // para que o timer fixo não apareça no modo fullscreen.
        timerSection.style.display = 'none';
    }

    const timerState = timers.get(toolId);
    if (!timerState) {
        // Inicializa o timerState para a ferramenta, se não existir
        timers.set(toolId, {
            intervalId: null,
            elapsedTime: 0,
            startTime: null,
            isRunning: false,
            subStageId: subStageId,
            toolHoursPerDay: toolHoursPerDay,
            fullscreenTimerElement: timerSection // Ainda armazena a referência, mas ele estará oculto
        });
        return;
    }

    // Apenas atualiza a referência do fullscreenTimerElement e as propriedades do timerState
    // que seriam usadas (but the timer will be hidden)
    timerState.fullscreenTimerElement = timerSection;
    timerState.subStageId = subStageId;
    timerState.toolHoursPerDay = toolHoursPerDay;

    // Se o temporizador estava rodando para esta ferramenta, pare-o,
    // pois ele não será exibido nem interativo em tela cheia.
    if (timerState.isRunning) {
        clearInterval(timerState.intervalId);
        timerState.isRunning = false;
        timerState.intervalId = null;
    }
    // Remove listeners para evitar interações acidentais, já que a UI está oculta
    if (timerSection) {
        const startBtn = timerSection.querySelector('.start-btn');
        const pauseBtn = timerSection.querySelector('.pause-btn');
        const stopBtn = timerSection.querySelector('.stop-btn');
        const saveBtn = timerSection.querySelector('.save-btn');
        if (startBtn) startBtn.removeEventListener('click', startTimerFullscreen);
        if (pauseBtn) pauseBtn.removeEventListener('click', pauseTimerFullscreen);
        if (stopBtn) stopBtn.removeEventListener('click', stopTimerFullscreen);
        if (saveBtn) saveBtn.removeEventListener('click', saveHoursFullscreen);
    }
};


function updateTimerDisplay(toolId) {
    const timerState = timers.get(toolId);
    if (!timerState) return;

    const displayElement = document.querySelector(`.timer-section[data-tool-id="${toolId}"] .timer-display`);
    const progressBarFill = document.querySelector(`.timer-section[data-tool-id="${toolId}"] .timer-progress-bar-fill`);

    if (!displayElement || !progressBarFill) return;

    // Garante que totalSeconds não seja negativo antes de formatar
    let totalSeconds = Math.floor(timerState.elapsedTime / 1000);
    if (totalSeconds < 0) {
        totalSeconds = 0; // Se for negativo, force a zero
        console.warn(`Timer para ferramenta ${toolId}: tempo total em segundos resultou negativo, forçado para 0. ElapsedTime: ${timerState.elapsedTime}`);
    }
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const formattedDisplayTime = [hours, minutes, seconds].map(unit => String(unit).padStart(2, '0')).join(':');

    displayElement.textContent = formattedDisplayTime;

    if (timerState.toolHoursPerDay > 0) {
        const plannedSeconds = timerState.toolHoursPerDay * 3600; 
        
        let percentage = (totalSeconds / plannedSeconds) * 100;
        if (percentage > 100) percentage = 100;
        
        progressBarFill.style.width = `${percentage}%`;
        progressBarFill.style.backgroundColor = totalSeconds >= plannedSeconds ? 'var(--danger-color)' : 'var(--success-color)'; 
    } else {
        progressBarFill.style.width = '0%';
        progressBarFill.style.backgroundColor = 'var(--info-color)';
    }
};

function updateTimerDisplayFullscreen(toolId) {
    const timerState = timers.get(toolId);
    if (!timerState || !timerState.fullscreenTimerElement) {
        return;
    }
    timerState.fullscreenTimerElement.style.display = 'none';
};

function updateTimerButtonVisibility(toolId) {
    const timerState = timers.get(toolId);
    if (!timerState) {
        return;
    }

    const timerSection = document.querySelector(`.timer-section[data-tool-id="${toolId}"]`);
    if (!timerSection) {
        return;
    }

    const startBtn = timerSection.querySelector('.start-btn');
    const pauseBtn = timerSection.querySelector('.pause-btn');
    const stopBtn = timerSection.querySelector('.stop-btn');
    const completeActivityBtn = timerSection.querySelector('.complete-activity-btn');
    
    const ferramentaAtual = producaoFerramentas.find(f => f.id === toolId);
    let subEtapaAtivaParaIniciar = null;

    if (ferramentaAtual && Array.isArray(ferramentaAtual.subEtapasProducao)) {
        subEtapaAtivaParaIniciar = ferramentaAtual.subEtapasProducao.find(se => {
            const status = getSubStageSpecificStatus(se, new Date(new Date().setHours(0,0,0,0)));
            return !se.concluida && (status === 'em-andamento' || status === 'atrasado');
        });
    }

    if (timerState.subStageId && timerState.subStageId !== subEtapaAtivaParaIniciar?.id && timerState.elapsedTime > 0) {
        if (timerState.isRunning) {
            saveHours(toolId); 
            window.showToast("Atividade do temporizador não é mais a principal. Temporizador salvo e resetado.", "warning");
        } else if (timerState.elapsedTime > 0) {
            if (confirm("A atividade do temporizador atual não é a principal. Deseja salvar as horas acumuladas antes de resetar?")) {
                saveHours(toolId);
            } else {
                stopTimer(toolId); 
            }
        } else {
            stopTimer(toolId); 
        }
        subEtapaAtivaParaIniciar = null; 
    }
    
    // --- LÓGICA DE VISIBILIDADE DOS BOTÕES ---
    if (timerState.isRunning) {
        if (startBtn) startBtn.classList.add('hidden-control');
        if (pauseBtn) pauseBtn.classList.remove('hidden-control');
        if (stopBtn) stopBtn.classList.remove('hidden-control');
        if (completeActivityBtn) completeActivityBtn.classList.remove('hidden-control');
    } else { // Timer está pausado ou parado
        if (pauseBtn) pauseBtn.classList.add('hidden-control');
        if (startBtn) startBtn.classList.remove('hidden-control');
        
        const hasTime = timerState.elapsedTime > 0;
        if (stopBtn) stopBtn.classList.toggle('hidden-control', !hasTime);
        if (completeActivityBtn) completeActivityBtn.classList.toggle('hidden-control', !hasTime);
    }

    // --- LÓGICA PARA HABILITAR/DESABILITAR BOTÕES ---
    if (!subEtapaAtivaParaIniciar) {
        // Se não há nenhuma atividade válida, desabilita tudo
        if (startBtn) startBtn.disabled = true;
        if (pauseBtn) pauseBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = true;
        if (completeActivityBtn) completeActivityBtn.disabled = true;
        if (startBtn) startBtn.title = "Não há atividade agendada para esta ferramenta.";
    } else {
        // Se há uma atividade válida, controla os botões com base no estado do timer
        if (timerState.isRunning) {
            if (startBtn) startBtn.disabled = true;
            if (pauseBtn) pauseBtn.disabled = false;
            if (stopBtn) stopBtn.disabled = false;
            if (completeActivityBtn) completeActivityBtn.disabled = false;
        } else { // Timer está pausado ou parado
            if (startBtn) startBtn.disabled = false;
            if (pauseBtn) pauseBtn.disabled = true;
            
            const hasTime = timerState.elapsedTime > 0;
            if (stopBtn) stopBtn.disabled = !hasTime;
            if (completeActivityBtn) completeActivityBtn.disabled = !hasTime;
        }
        if (startBtn) startBtn.title = "";
    }
};

function updateTimerButtonVisibilityFullscreen(toolId) {
    const timerState = timers.get(toolId);
    if (!timerState || !timerState.fullscreenTimerElement) {
        return;
    }
    timerState.fullscreenTimerElement.style.display = 'none';
};

async function startTimer(toolId) {
    const timerState = timers.get(toolId);
    const startBtn = document.querySelector(`.timer-section[data-tool-id="${toolId}"] .start-btn`);

    const ferramentaAtual = producaoFerramentas.find(f => f.id === toolId);
    // Adiciona verificação para garantir que subEtapasProducao é um array
    const subEtapaAtivaParaIniciar = ferramentaAtual && Array.isArray(ferramentaAtual.subEtapasProducao) ? ferramentaAtual.subEtapasProducao.find(se => {
        const status = getSubStageSpecificStatus(se, new Date(new Date().setHours(0,0,0,0)));
        return !se.concluida && (status === 'em-andamento' || status === 'atrasado');
    }) : null; // Se não for array, retorna null


    if (!subEtapaAtivaParaIniciar) {
        window.showError("Nenhuma atividade ativa agendada para esta ferramenta. Por favor, vincule uma sub-etapa.");
        return;
    }

    // NOVO: Verificar se o timer já está vinculado a outra sub-etapa que não seja a "ativa"
    // E se não está rodando ainda, mas tem tempo acumulado de uma sub-etapa diferente.
    if (timerState.subStageId && timerState.subStageId !== subEtapaAtivaParaIniciar.id && timerState.elapsedTime > 0) {
        const confirmSwitch = confirm(`O temporizador possui horas acumuladas para outra atividade: "${ferramentaAtual.subEtapasProducao.find(se => se.id === timerState.subStageId)?.descricao}". Deseja salvar essas horas e iniciar uma nova atividade, ou continuar a atividade anterior? \n\nClique 'OK' para salvar e iniciar nova. \nClique 'Cancelar' para continuar a atividade anterior (se for ela a ativa).`);
        if (confirmSwitch) {
            await saveHours(toolId); // Salva as horas da atividade anterior e reseta o timer
            // Após salvar e resetar, a função pode continuar e iniciar a nova atividade
            // Recarrega o estado do timer para garantir que esteja limpo para a nova atividade
            await window.fetchActiveTimersState();
            // Atualiza o timerState para a nova sub-etapa
            timerState.subStageId = subEtapaAtivaParaIniciar.id;
            timerState.toolHoursPerDay = parseFloat(subEtapaAtivaParaIniciar.horas_previstas_conclusao) || 0;
            timerState.elapsedTime = 0;
        } else {
            // Se o usuário cancelar e não quiser salvar, e não for a atividade correta, não faz nada.
            // Se ele quis continuar a atividade anterior, assume-se que ele clicará na atividade correta.
            return;
        }
    }


    if (timerState.isRunning || (startBtn && startBtn.disabled && timerState.elapsedTime === 0)) { // Adicionado check para elapsed time
        if (startBtn && startBtn.disabled) {
            window.showError("Para iniciar o temporizador, cadastre e vincule uma sub-etapa de produção a esta ferramenta.");
        } else {
            window.showError("Não é possível iniciar: temporizador já em execução.");
        }
        return;
    }

    // Persistir START/RESUME no backend
    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/timers/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ferramenta_id: toolId,
                sub_etapa_producao_id: subEtapaAtivaParaIniciar.id,
                tempo_acumulado_ms: timerState.elapsedTime, // Envia o tempo que já estava acumulado
                ultimo_inicio_timestamp: new Date().toISOString() // Novo timestamp de início
            })
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao iniciar/retomar temporizador. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao iniciar/retomar temporizador.');
        }

        // // ALTERAÇÃO INICIADA: Força a atualização completa da UI
        window.showToast("Temporizador iniciado!", "info");
        await window.fetchActiveTimersState();
        await buscarFerramentasParaExibicao();
        // // ALTERAÇÃO FINALIZADA

    } catch (error) {
        console.error("Erro ao iniciar temporizador:", error);
        window.showError("Erro ao iniciar temporizador: " + error.message);
    }
};

async function pauseTimer(toolId) {
    const timerState = timers.get(toolId);
    if (!timerState || !timerState.isRunning) return;

    // Calcula o tempo decorrido para salvar antes de pausar
    timerState.elapsedTime = Date.now() - timerState.startTime;

    // Persistir PAUSE no backend
    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/timers/pause`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ferramenta_id: toolId,
                sub_etapa_producao_id: timerState.subStageId,
                tempo_acumulado_ms: timerState.elapsedTime // Salva o tempo acumulado total
            })
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao pausar temporizador. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao pausar temporizador.');
        }

        // // ALTERAÇÃO INICIADA: Força a atualização completa da UI
        window.showToast("Temporizador pausado.", "info");
        await window.fetchActiveTimersState();
        await buscarFerramentasParaExibicao();
        // // ALTERAÇÃO FINALIZADA

    } catch (error) {
        console.error("Erro ao pausar temporizador:", error);
        window.showError("Erro ao pausar temporizador: " + error.message);
    }
};

async function stopTimer(toolId) {
    const timerState = timers.get(toolId);
    if (!timerState || (timerState.elapsedTime === 0 && !timerState.isRunning)) { // Só permite parar se houver tempo acumulado ou se estiver rodando
        window.showError("Nenhum tempo registrado ou temporizador não ativo para finalizar.");
        return;
    }

    if (timerState.isRunning) {
        // Se estiver rodando, primeiro calcula o tempo final e para o timer localmente
        timerState.elapsedTime = Date.now() - timerState.startTime;
        clearInterval(timerState.intervalId);
        timerState.isRunning = false;
        timerState.intervalId = null;
        timerState.startTime = null;
    }

    // Persistir STOP no backend (que registrará horas e removerá timer_ativos)
    try {
        const hoursToSaveDecimal = timerState.elapsedTime / 3600000;

        const response = await window.authenticatedFetch(`${API_BASE_URL}/timers/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ferramenta_id: toolId,
                sub_etapa_producao_id: timerState.subStageId,
                horas_trabalhadas: hoursToSaveDecimal
            })
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao finalizar temporizador. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao finalizar temporizador.');
        }

        // // ALTERAÇÃO INICIADA: Força a atualização completa da UI
        window.showToast("Temporizador finalizado e horas salvas!", "success");
        await window.fetchActiveTimersState();
        await buscarFerramentasParaExibicao();
        // // ALTERAÇÃO FINALIZADA

    } catch (error) {
        console.error("Erro ao finalizar temporizador:", error);
        window.showError("Erro ao finalizar temporizador: " + error.message);
    }
};

// CORREÇÃO: A função saveHours não precisa mais de uma rota separada.
// Ela agora tem a mesma lógica que stopTimer, garantindo que as horas sejam salvas e o timer resetado.
async function saveHours(toolId) { 
    const timerState = timers.get(toolId);
    if (!timerState || timerState.subStageId === null || timerState.subStageId === 'null') {
        window.showError("Nenhuma atividade ativa para salvar horas.");
        return;
    }

    if (timerState.isRunning) {
        pauseTimer(toolId); // Pausa antes de salvar se estiver rodando
    }

    const hoursFromTimerDecimal = timerState.elapsedTime / 3600000; 

    if (isNaN(hoursFromTimerDecimal) || hoursFromTimerDecimal <= 0) { 
        window.showError("Nenhuma hora trabalhada válida para salvar.");
        return;
    }

    try {
        // Envia as horas para a rota 'timers/stop' que irá registrar as horas
        // no banco de dados e remover o temporizador ativo.
        const response = await window.authenticatedFetch(`${API_BASE_URL}/timers/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ferramenta_id: toolId,
                sub_etapa_producao_id: timerState.subStageId,
                horas_trabalhadas: hoursFromTimerDecimal
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido ao registrar horas do timer.' }));
            throw new Error(errorData.error || 'Erro ao registrar horas do timer.');
        }

        // // ALTERAÇÃO INICIADA: Força a atualização completa da UI
        window.showToast("Horas registradas e temporizador resetado!", "success");
        await window.fetchActiveTimersState();
        await buscarFerramentasParaExibicao();
        // // ALTERAÇÃO FINALIZADA
        
    } catch (error) {
        console.error("Producao.js: Erro ao salvar horas do timer no banco de dados:", error);
        window.showError("Erro ao salvar horas do timer: " + error.message);
    }
};


function updateTimerAndDisplay(toolId) {
    const timerState = timers.get(toolId);
    if (!timerState || !timerState.isRunning) return;

    timerState.elapsedTime = Date.now() - timerState.startTime;
    
    updateTimerDisplay(toolId); 

    // O localStorage NÃO DEVE ser usado para persistir o estado do timer entre dispositivos
    // Isso foi removido para evitar a dessincronização. O backend é a fonte da verdade.
    // localStorage.setItem(`timerState_${toolId}_${timerState.subStageId}`, JSON.stringify(timerState));
    console.log(`DEBUG PRODUÇÃO DISPLAY: Ferramenta ${toolId}. ElapsedTime: ${timerState.elapsedTime}, isRunning: ${timerState.isRunning}`);
};


function startTimerFullscreen(toolId) {
    window.showError("Temporizador na tela cheia desativado. Use os controles no mini card.");
};

function pauseTimerFullscreen(toolId) {
    window.showError("Temporizador na tela cheia desativado. Use os controles no mini card.");
};

function stopTimerFullscreen(toolId) {
    window.showError("Temporizador na tela cheia desativado. Use os controles no mini card.");
};

async function saveHoursFullscreen(toolId, hoursToSave) {
    window.showError("Temporizador na tela cheia desativado. Use os controles no mini card.");
};

/**
 * Função para marcar uma atividade (sub-etapa de produção) como concluída.
 * @param {number} toolId - ID da ferramenta.
 * @param {number} subStageId - ID da sub-etapa de produção.
 */
async function completeActivity(toolId, subStageId) {
    if (!subStageId) {
        window.showError("Nenhuma atividade ativa selecionada para concluir.");
        return;
    }

    if (!confirm('Tem certeza que deseja marcar esta atividade como CONCLUÍDA? Isso também resetará o temporizador.')) {
        return;
    }

    // Se o timer estiver rodando ou pausado, primeiro garante que o tempo acumulado seja salvo e o timer pare.
    const timerState = timers.get(toolId);
    if (timerState && timerState.elapsedTime > 0) {
        // saveHours chamará timers/stop que já persiste as horas e limpa o timer ativo no backend.
        await saveHours(toolId);
    }

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/ferramentas_sub_etapas_producao/${subStageId}/concluir`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ concluida: true })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido ao concluir atividade. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao concluir atividade.');
        }

        // // ALTERAÇÃO INICIADA: Força a atualização completa da UI
        window.showToast("Atividade concluída com sucesso!", "success");
        await window.fetchActiveTimersState();
        await buscarFerramentasParaExibicao();
        // // ALTERAÇÃO FINALIZADA

    } catch (error) {
        console.error("Erro ao concluir atividade:", error);
        window.showError("Erro ao concluir atividade: " + error.message);
    }
};


// REGISTRO DO INICIALIZADOR DA TELA: IMEDIATAMENTE NO CORPO DO SCRIPT, FORA DE QUALQUER DOMContentLoaded
if (typeof window.screenInitializers === 'undefined') {
    window.screenInitializers = {};
}
window.screenInitializers['tela5'] = window.initializeProducaoScreen;

window.addEventListener('beforeunload', () => {
    window.stopProducaoCarousel();
});

document.addEventListener('visibilitychange', () => {
    const telaProducao = document.getElementById('tela5');
    if (telaProducao && telaProducao.classList.contains('active')) {
        if (!document.hidden) {
            // Ao retornar para a aba, força o re-fetch dos estados dos timers e das ferramentas.
            window.fetchActiveTimersState().then(() => {
                buscarFerramentasParaExibicao();
            }).catch(error => {
                console.error("Produção: Erro ao buscar estados de timers ativos ao retornar para a aba:", error);
                window.showError("Erro ao recarregar estados dos temporizadores: " + error.message);
                buscarFerramentasParaExibicao();
            });
        }
    }
});


// ---- NOVAS FUNÇÕES PARA DRAG-AND-DROP ----

/**
 * Salva a nova ordem das sub-etapas no backend.
 * @param {number} toolId - ID da ferramenta pai.
 */
async function saveSubStageOrder(toolId) {
    console.warn("saveSubStageOrder() foi chamada, mas a funcionalidade foi desativada.");
    window.showError("A reordenação de atividades está desabilitada na visualização de produção.");
}

/**
 * Adiciona a funcionalidade de drag-and-drop a um container.
 * @param {string} containerId - O ID do container que contém os itens arrastáveis.
 */
function setupDragAndDrop(containerId) {
    console.warn("setupDragAndDrop() foi chamada, mas a funcionalidade foi desativada.");
}

// Handler para o evento de início do arrasto
function handleDragStart(e) {
    console.warn("handleDragStart() foi chamado, mas a funcionalidade foi desativada.");
    e.preventDefault();
}

// Handler para o evento de mover sobre outro item
function handleDragOver(e) {
    console.warn("handleDragOver() foi chamado, mas a funcionalidade foi desativada.");
    e.preventDefault();
}

// Handler para o evento de fim do arrasto
function handleDragEnd() {
    console.warn("handleDragEnd() foi chamado, mas a funcionalidade foi desativada.");
}


function toggleProducaoFullscreen(toolId = null) {
    const isCurrentlyFullscreen = document.fullscreenElement === producaoContainer ||
                                  document.webkitFullscreenElement === producaoContainer ||
                                  document.mozFullScreenElement === producaoContainer ||
                                  document.msFullscreenElement === producaoContainer;

    if (!isCurrentlyFullscreen) {
        if (producaoContainer.requestFullscreen) {
            producaoContainer.requestFullscreen();
        } else if (producaoContainer.mozRequestFullScreen) {
            producaoContainer.mozRequestFullScreen();
        } else if (producaoContainer.webkitRequestFullscreen) {
            producaoContainer.webkitRequestFullscreen();
        } else if (producaoContainer.msRequestFullscreen) {
            producaoContainer.msRequestFullscreen();
        }
        ferramentaSelecionadaId = toolId;
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.documentElement.msExitFullscreen) { 
            document.exitFullscreen();
        }
    }
}

function exitProducaoFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.documentElement.msExitFullscreen) { 
        document.exitFullscreen();
    }
};


document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('mozfullscreenchange', handleFullscreenChange);
document.addEventListener('MSFullscreenChange', handleFullscreenChange);

function handleFullscreenChange() {
    const mainContentArea = document.getElementById('ferramentaDetailsDisplay');
    const fullscreenTimerElement = document.getElementById('fullscreenTimerDisplay');
    const producaoHeader = document.querySelector('.producao-header');

    const isCurrentlyFullscreen = document.fullscreenElement === producaoContainer ||
                                  document.webkitFullscreenElement === producaoContainer ||
                                  document.mozFullScreenElement === producaoContainer ||
                                  document.msFullscreenElement === producaoContainer;

    if (isCurrentlyFullscreen) {
        producaoContainer.classList.add('fullscreen-mode');
        if (producaoHeader) producaoHeader.style.display = 'none';
        
        const ferramenta = producaoFerramentas.find(f => f.id === ferramentaSelecionadaId);
        if (ferramenta) {
            mainContentArea.innerHTML = '';
            const newLargeCard = criarCardDetalhesFerramenta(ferramenta);
            newLargeCard.classList.add('active');
            mainContentArea.appendChild(newLargeCard);

            const relevantShift = getRelevantShiftForTool(ferramenta);
            const currentSubStageId = relevantShift ? relevantShift.id : null;
            const toolHoursPerDay = relevantShift ? parseFloat(relevantShift.horas_previstas_conclusao) || 0 : 0;
            
            setupTimerControlsForFullscreen(ferramenta.id, currentSubStageId, toolHoursPerDay);
            
            if (fullscreenTimerElement) {
                fullscreenTimerElement.style.display = 'none'; 
            }
        } else {
            mainContentArea.innerHTML = '<div class="placeholder-message">Nenhuma ferramenta selecionada para exibir detalhes em tela cheia.</div>';
            if (fullscreenTimerElement) fullscreenTimerElement.style.display = 'none';
        }

    } else {
        producaoContainer.classList.remove('fullscreen-mode');
        if (producaoHeader) producaoHeader.style.display = 'flex';

        window.fetchActiveTimersState().then(() => {
            renderizarListaCompactaFerramentas(producaoFerramentas);
        }).catch(error => {
            console.error("Produção: Erro ao buscar estados de timers ativos ao sair do fullscreen:", error);
            window.showError("Erro ao recarregar estados dos temporizadores ao sair do fullscreen: " + error.message);
            renderizarListaCompactaFerramentas(producaoFerramentas);
        });

        ferramentaSelecionadaId = null;

        if (fullscreenTimerElement) fullscreenTimerElement.style.display = 'none';
    }
}