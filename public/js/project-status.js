// project-status.js (VERSÃO CORRIGIDA E OTIMIZADA)

// ===============================================
// 0. Utilitários (Helpers)
// ===============================================

/**
 * Anexa um listener de clique a um elemento pelo ID, garantindo que seja anexado apenas uma vez.
 * Usa o atributo data-listenerAttached para evitar duplicação.
 * @param {string} elementId - O ID do elemento.
 * @param {function} handler - A função a ser executada no clique.
 */
function attachClickOnce(elementId, handler) {
    const el = document.getElementById(elementId);
    if (el && !el.dataset.listenerAttached) {
        el.addEventListener('click', handler);
        el.dataset.listenerAttached = 'true';
    }
}

// ===============================================
// 1. Variáveis Globais e Constantes
// ===============================================

let isRenderingAlerts = false;
let autoRefreshProjectsInterval;
let allSubEtapasForModal = [];
let currentSubEtapaPage = 1;
const subEtapasPerPage = 8;
const projectWeekStates = new Map();

// NOVO: Mapeamento de cores para setores (Correção 3)
const SECTOR_COLORS = {
    'Mecânica': '#007bff', // Azul
    'Elétrica': '#fd7e14', // Laranja
    'Software': '#6f42c1', // Roxo
    'Automação': '#28a745', // Verde
    'Hidráulica': '#17a2b8', // Ciano
    'Geral': '#6c757d',    // Cinza
    'Setor Não Classificado': '#343a40' // Cinza Escuro
};

// Handler para o botão 'Adicionar Etapa' no modal de edição de projeto
const handleEditAddEtapaClick = () => {
    window.addDynamicEtapaField('editEtapasContainer');
};

// ===============================================
// Funções para Tela 2 (Status do Projeto)
// ===============================================

window.initializeProjectStatusScreen = function() {
    
    
    // --- LÓGICA PARA MENU HAMBÚRGUER ---
    const menuToggle = document.getElementById('menuToggle');
    const nav = document.querySelector('.screen-selector');
    if (menuToggle && nav && !nav.dataset.listenerAttached) {
        menuToggle.addEventListener('click', () => nav.classList.toggle('open'));
        nav.dataset.listenerAttached = 'true';
    }

    // --- LÓGICA PARA SEÇÕES SANFONA (COLLAPSIBLE) ---
    // (O seu código para 'collapsibleListenerAttached' está correto e foi mantido)
    if (!document.body.dataset.collapsibleListenerAttached) {
        document.body.addEventListener('click', function(event) {
            const header = event.target.closest('.collapsible-header');
            if (header) {
                event.stopPropagation();
                
                const section = header.closest('.collapsible-section');
                if (section) {
                    const icon = header.querySelector('.toggle-collapse-btn i');
                    section.classList.toggle('open');
                    if (icon) {
                        icon.classList.toggle('fa-chevron-up');
                        icon.classList.toggle('fa-chevron-down');
                    }
                }
            }
        });
        document.body.dataset.collapsibleListenerAttached = 'true';
    }

    // --- LÓGICA DE ATUALIZAÇÃO E BUSCA DE PROJETOS ---
    const refreshButton = document.getElementById('refreshProjects');
    const searchInput = document.getElementById('projectSearchInput');
    const searchButton = document.getElementById('searchProjectsBtn');
    const showEncerradosCheckbox = document.getElementById('showEncerradosCheckbox');

    // Botão Atualizar
    if (refreshButton && !refreshButton.dataset.listenerAttached) {
        refreshButton.addEventListener('click', () => {
            window.fetchProjects();
        });
        refreshButton.dataset.listenerAttached = 'true';
    }

    // Botão Buscar
    if (searchButton && !searchButton.dataset.listenerAttached) {
        searchButton.addEventListener('click', () => {
            window.fetchProjects();
        });
        searchButton.dataset.listenerAttached = 'true';
    }

    // Enter no campo de busca
    if (searchInput) {
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);
        newSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                window.fetchProjects();
            }
        });
    }

    // Checkbox “Mostrar Encerrados”
    if (showEncerradosCheckbox && !showEncerradosCheckbox.dataset.listenerAttached) {
        showEncerradosCheckbox.addEventListener('change', () => {
            window.fetchProjects();
        });
        showEncerradosCheckbox.dataset.listenerAttached = 'true';
    }

    // Carrega projetos na entrada da tela
    window.fetchProjects();
    // --- FIM DA LÓGICA DE ATUALIZAÇÃO ---


    const projectsContainer = document.getElementById('projectsContainer');
    if (projectsContainer) {
        projectsContainer.removeEventListener('click', handleProjectCardClick); 
        projectsContainer.addEventListener('click', handleProjectCardClick);
    }

    const newProjectBtn = document.getElementById('openNewProjectModalBtn');
    if (newProjectBtn && !newProjectBtn.dataset.listenerAttached) { // Proteção contra duplicidade
        newProjectBtn.addEventListener('click', () => {
            if (window.openProjectRegistrationModal) {
                window.openProjectRegistrationModal();
            }
        });
        newProjectBtn.dataset.listenerAttached = 'true';
    }
    
    // --- LÓGICA PARA MODAL DE EDIÇÃO DE PROJETO ---
    const editProjectForm = document.getElementById('editProjectForm');
    if (editProjectForm && !editProjectForm.dataset.listenerAttached) { // Proteção contra duplicidade
        editProjectForm.addEventListener('submit', window.handleEditProjectSubmit);
        editProjectForm.dataset.listenerAttached = 'true';
    }
    const editAddEtapaBtn = document.getElementById('editAddEtapaBtn');
    if (editAddEtapaBtn && !editAddEtapaBtn.dataset.listenerAttached) { // Proteção contra duplicidade
        editAddEtapaBtn.addEventListener('click', handleEditAddEtapaClick);
        editAddEtapaBtn.dataset.listenerAttached = 'true';
    }
    
    // ===================== INÍCIO DA ATUALIZAÇÃO (Listeners) - Otimizado com attachClickOnce =====================
    
    // --- Painel do Líder ---
    attachClickOnce('bulkApproveLiderBtn', () => window.handleBulkBOMAction('liderApprovalPanelContent', 'approve'));
    attachClickOnce('bulkReproveLiderBtn', () => window.handleBulkBOMAction('liderApprovalPanelContent', 'reprove'));

    // --- Painel do Gestor ---
    attachClickOnce('bulkApproveGestorBtn', () => window.handleBulkBOMAction('approvalPanelContent', 'approve'));
    attachClickOnce('bulkReproveGestorBtn', () => window.handleBulkBOMAction('approvalPanelContent', 'reprove'));

    // --- Painel da Diretoria ---
    attachClickOnce('bulkApproveDiretorBtn', () => window.handleBulkBOMAction('directorApprovalPanelContent', 'approve-director'));
    attachClickOnce('bulkReproveDiretorBtn', () => window.handleBulkBOMAction('directorApprovalPanelContent', 'reprove'));
    
    // --- Painel Financeiro ---
    attachClickOnce('bulkApproveFinanceiroBtn', () => window.handleBulkBOMAction('financialApprovalPanelContent', 'approve-financial'));
    attachClickOnce('bulkReproveFinanceiroBtn', () => window.handleBulkBOMAction('financialApprovalPanelContent', 'reprove'));

    // ===================== FIM DA ATUALIZAÇÃO (Listeners) - Otimizado =====================

    // --- Listeners para "Selecionar Todos" ---
    document.querySelectorAll('.solicitacao-select-all').forEach(checkbox => {
        if (!checkbox.dataset.listenerAttached) {
            checkbox.addEventListener('change', (e) => {
                const panelId = e.target.dataset.panelId;
                const panel = document.getElementById(panelId);
                if (panel) {
                    panel.querySelectorAll('.solicitacao-checkbox').forEach(cb => {
                        cb.checked = e.target.checked;
                    });
                }
            });
            checkbox.dataset.listenerAttached = 'true';
        }
    });
    
    if (window.applyUIPermissions && window.getCurrentUser) {
        window.applyUIPermissions(); 
    } else {
        console.warn("Atenção: O módulo de permissões (permissions-ui.js) não foi totalmente carregado. Alguns elementos da interface podem não respeitar as permissões do usuário.");
    }
};

/**
 * =================================================================
 * NOVA FUNÇÃO (CORREÇÃO)
 * Manipula ações em massa (Aprovar/Reprovar) para itens de BOM.
 * =================================================================
 */
window.handleBulkBOMAction = async function(panelId, action) {
    const panel = document.getElementById(panelId);
    if (!panel) {
        console.error(`Painel com ID ${panelId} não encontrado.`);
        return;
    }

    const selectedCheckboxes = panel.querySelectorAll('.solicitacao-checkbox:checked');
    if (selectedCheckboxes.length === 0) {
        window.showToast('Nenhum item selecionado.', 'info');
        return;
    }

    const itemIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.itemId);
    const actionText = action.startsWith('approve') ? 'Aprovar' : 'Reprovar';
    const actionPastTense = action.startsWith('approve') ? 'aprovados' : 'reprovados';

    if (!confirm(`Tem certeza que deseja ${actionText.toLowerCase()} ${itemIds.length} item(ns) selecionado(s)?`)) {
        return;
    }

    let successCount = 0;
    let errorCount = 0;
    
    // ########## INÍCIO DA CORREÇÃO ##########
    let getApiUrl, nextPanel;
    
    if (action === 'approve' && panelId === 'liderApprovalPanelContent') {
        // Ação: Aprovar (Líder) -> Manda para Gestor
        getApiUrl = (itemId) => ({
            url: `${API_BASE_URL}/bom-items/${itemId}/status`,
            method: 'PUT',
            body: JSON.stringify({ status: 'Aguardando Aprovação' }) // Status do Gestor
        });
        nextPanel = 'approvalPanel'; // Aba do Gestor
        
    } else if (action === 'approve' && panelId === 'approvalPanelContent') {
        // Ação: Aprovar (Gestor) -> Manda para Cotação
        // (Usando a sua API original que já funciona para isso)
        getApiUrl = (itemId) => ({
            url: `${API_BASE_URL}/solicitacoes/${itemId}/approve`,
            method: 'PUT',
            body: null // API do Gestor não precisa de body
        });
        nextPanel = 'cotacoesPanel'; // Aba de Cotações
        
    } else if (action === 'approve-director' && panelId === 'directorApprovalPanelContent') {
        // Ação: Aprovar (Diretoria) -> Manda para Financeiro
        getApiUrl = (itemId) => ({
            url: `${API_BASE_URL}/solicitacoes/${itemId}/approve-final`,
            method: 'PUT',
            body: null
        });
        nextPanel = 'financialApprovalPanel'; // Aba do Financeiro
        
    } else if (action === 'approve-financial' && panelId === 'financialApprovalPanelContent') {
        // Ação: Aprovar (Financeiro) -> Manda para Aprovados Finais
        getApiUrl = (itemId) => ({
            url: `${API_BASE_URL}/solicitacoes/${itemId}/approve-financeiro`,
            method: 'PUT',
            body: null
        });
        nextPanel = 'finalItemsPanel'; // Aba de Status dos Pedidos
        
    } else if (action === 'reprove') {
        // Ação: Reprovar (qualquer painel) -> Status 'Reprovado'
        getApiUrl = (itemId) => ({
            url: `${API_BASE_URL}/bom-items/${itemId}/status`,
            method: 'PUT',
            body: JSON.stringify({ status: 'Reprovado' }) // Define o status
        });
        nextPanel = 'sentItemsPanel'; // Manda para Status dos Pedidos (COMO VOCÊ PEDIU)
        
    } else {
        console.error("Ação em massa desconhecida:", action, panelId);
        return;
    }
    // ########## FIM DA CORREÇÃO ##########

    window.showToast(`Processando ${itemIds.length} item(ns)...`, 'info');

    const promises = itemIds.map(async (itemId) => {
        try {
            const { url, method, body } = getApiUrl(itemId);
            const fetchOptions = {
                method: method,
                headers: { 'Content-Type': 'application/json' }
            };
            // Adiciona o body apenas se ele existir
            if (body) {
                fetchOptions.body = body;
            }
            
            const response = await window.authenticatedFetch(url, fetchOptions);

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `Erro ${response.status}`);
            
            successCount++;
            const itemCard = panel.querySelector(`.solicitacao-card[data-item-id="${itemId}"]`);
            if (itemCard) itemCard.remove();
        } catch (err) {
            errorCount++;
            console.error(`Falha ao ${actionText} item ${itemId}:`, err.message);
            const itemCard = panel.querySelector(`.solicitacao-card[data-item-id="${itemId}"]`);
            if (itemCard) itemCard.style.borderLeft = '5px solid red';
        }
    });

    await Promise.all(promises);

    if (successCount > 0) {
        window.showToast(`${successCount} item(ns) foram ${actionPastTense} com sucesso!`, 'success');
        const projectId = document.getElementById('shoppingProjectId').value;
        if (projectId) {
            // Recarrega os dados de TODAS as abas
            await window.openShoppingModal(projectId, document.getElementById('shoppingProjectName').textContent); 
            // Muda para a aba de destino correta
            window.switchShoppingPanel(nextPanel); 
        }
    }

    if (errorCount > 0) {
        window.showError(`${errorCount} item(ns) falharam. Verifique os itens marcados em vermelho ou o console.`);
    }

    // Desmarca o "Selecionar Todos"
    const selectAllCheckbox = document.querySelector(`.solicitacao-select-all[data-panel-id="${panelId}"]`);
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
};

function handleProjectCardClick(event) {
    const deliverableDiv = event.target.closest('.deliverable-content');
    if (deliverableDiv && !deliverableDiv.isEditing) {
        
        const deliverableSection = deliverableDiv.closest('.weekly-deliverable-section');
        const weekStartDateStr = deliverableSection.dataset.currentWeek; 

        const now = new Date();
        const dayOfWeek = now.getDay();
        const diffToMonday = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const currentWeekStartDate = new Date(now.setDate(diffToMonday));
        currentWeekStartDate.setHours(0, 0, 0, 0);

        // Converte a string 'YYYY-MM-DD' para um objeto de data LOCAL, não UTC.
        const [year, month, day] = weekStartDateStr.split('-').map(Number);
        const deliverableWeekStartDate = new Date(year, month - 1, day);
        deliverableWeekStartDate.setHours(0, 0, 0, 0); 

        if (deliverableWeekStartDate.getTime() < currentWeekStartDate.getTime()) {
            window.showError("Não é permitido editar entregáveis de semanas passadas.", 4000);
            return; 
        }

        enableDeliverableEditing(deliverableDiv);
        return;
    }

    const weekNavButton = event.target.closest('.week-nav-btn');
    if (weekNavButton) {
        const projectId = weekNavButton.dataset.projectId;
        const direction = weekNavButton.dataset.direction === 'prev' ? -1 : 1;
        fetchDeliverableForWeek(projectId, direction);
        return;
    }
}

// --- INÍCIO DA ADIÇÃO: Novas funções ---
function getWeekDateRange(baseDate) {
    function toLocalDate(d) {
        if (!d) return new Date();
        if (d instanceof Date) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
        if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
            const [y, m, day] = d.split('-').map(Number);
            return new Date(y, m - 1, day);
        }
        const parsed = new Date(d);
        return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }

    const date = toLocalDate(baseDate);

    const day = date.getDay();
    const diffToMonday = (day + 6) % 7; 
    const monday = new Date(date);
    monday.setDate(date.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const year = monday.getFullYear();
    const monthName = monday.toLocaleString('pt-BR', { month: 'long' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    const dayStart = String(monday.getDate()).padStart(2, '0');
    const dayEnd = String(sunday.getDate()).padStart(2, '0');
    const rangeDays = `${dayStart}–${dayEnd}`;

    const thursday = new Date(monday);
    thursday.setDate(monday.getDate() + 3);

    const jan4 = new Date(thursday.getFullYear(), 0, 4);
    const startOfFirstWeek = new Date(jan4);
    startOfFirstWeek.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7)); 

    const weekNumber = Math.floor(((thursday - startOfFirstWeek) / 86400000) / 7) + 1;

    const yearMonth = `${year}, ${capitalizedMonth}`;
    const range = `${yearMonth}, ${rangeDays} (W${weekNumber})`;

    const mondayDate = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;

    return { yearMonth, range, mondayDate };
}

async function fetchDeliverableForWeek(projectId, direction) {
    const card = document.querySelector(`.project-card[data-project-id='${projectId}']`);
    if (!card) return;

    const deliverableSection = card.querySelector('.weekly-deliverable-section');
    const currentWeekDateStr = deliverableSection.dataset.currentWeek;
    
    const currentDate = new Date(currentWeekDateStr);
    currentDate.setUTCDate(currentDate.getUTCDate() + (7 * direction));
    const newWeekDate = currentDate.toISOString().split('T')[0];

    const contentDiv = deliverableSection.querySelector('.deliverable-content');
    const labelSpan = deliverableSection.querySelector('.deliverable-week-range');

    labelSpan.textContent = 'Carregando...';
    contentDiv.querySelector('.marquee-text').textContent = '...';

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}/deliverables?weekDate=${newWeekDate}`);
        if (!response.ok) throw new Error('Erro ao buscar entregável.');

        const data = await response.json();
        const { range, mondayDate } = getWeekDateRange(newWeekDate);
        
        deliverableSection.dataset.currentWeek = mondayDate; 
        projectWeekStates.set(projectId, mondayDate);

        labelSpan.textContent = `(${range})`;
        const marqueeText = contentDiv.querySelector('.marquee-text');
        marqueeText.textContent = data.content || "Clique para editar...";
        
        if (data.content) {
            contentDiv.classList.add('has-content');
        } else {
            contentDiv.classList.remove('has-content');
        }
        
        // --- INÍCIO DA CORREÇÃO (mesma lógica da função acima) ---
        const now = new Date();
        const dayOfWeek = now.getDay();
        const diffToMonday = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const currentWeekStartDate = new Date(now.setDate(diffToMonday));
        currentWeekStartDate.setHours(0, 0, 0, 0);

        const [year, month, day] = mondayDate.split('-').map(Number);
        const deliverableWeekStartDate = new Date(year, month - 1, day);
        deliverableWeekStartDate.setHours(0, 0, 0, 0);

        if (deliverableWeekStartDate.getTime() < currentWeekStartDate.getTime()) {
            contentDiv.classList.add('past-week');
        } else {
            contentDiv.classList.remove('past-week');
        }
        // --- FIM DA CORREÇÃO ---
        
    } catch (error) {
        console.error('Erro ao buscar entregável da semana:', error);
        window.showError(error.message);
        const { range } = getWeekDateRange(currentWeekDateStr); 
        labelSpan.textContent = `(${range})`;
        contentDiv.querySelector('.marquee-text').textContent = 'Erro ao carregar. Tente novamente.';
    }
}

function enableDeliverableEditing(element) {
    element.isEditing = true;
    const currentText = element.querySelector('.marquee-text').textContent;
    const displayText = currentText === 'Clique para editar...' ? '' : currentText;
    const projectId = element.dataset.projectId;
    
    // Busca o elemento pai para pegar a data da semana correta que está sendo exibida no momento do clique
    const deliverableSection = element.closest('.weekly-deliverable-section');
    const currentWeekDate = deliverableSection.dataset.currentWeek;

    const textarea = document.createElement('textarea');
    textarea.className = 'deliverable-textarea';
    textarea.value = displayText;

    element.style.display = 'none';
    element.parentNode.insertBefore(textarea, element.nextSibling);
    textarea.focus();
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';

    const saveChanges = async () => {
        const newText = textarea.value.trim();
        const marqueeText = element.querySelector('.marquee-text');
        marqueeText.textContent = newText || 'Clique para editar...';
        
        if (newText) {
            element.classList.add('has-content');
        } else {
            element.classList.remove('has-content');
        }
        element.style.display = '';
        textarea.remove();
        element.isEditing = false;

        if (newText !== displayText) {
            try {
                const response = await window.authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}/deliverable`, {
                    method: 'POST',
                    body: JSON.stringify({ 
                        content: newText,
                        weekDate: currentWeekDate // Envia a data da semana correta que foi capturada
                    }),
                });
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Erro ao salvar entregável.');
                }
                window.showToast('Entregável salvo com sucesso!', 'success');
            } catch (err) {
                console.error('Erro ao salvar entregável:', err);
                window.showError(err.message);
                marqueeText.textContent = displayText || 'Clique para editar...'; 
                if (displayText) {
                    element.classList.add('has-content');
                } else {
                    element.classList.remove('has-content');
                }
            }
        }
    };

    textarea.addEventListener('blur', saveChanges);
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            textarea.blur();
        }
        if (e.key === 'Escape') {
            element.style.display = '';
            textarea.remove();
            element.isEditing = false;
        }
    });
}

// --- FIM DA ADIÇÃO ---
window.fetchAndRenderProjects = async function(statusFilter = 'ativo', searchTerm = '') {
    
    
    // Assegura que o status seja sempre 'encerrado' ou 'ativos'
    const status = statusFilter === 'encerrado' ? 'encerrado' : 'ativo';

    try {
        const projectsContainer = document.getElementById('projectsContainer');
        if (!projectsContainer) {
            console.warn('project-status.js: projectsContainer not found.');
            return;
        }

        // Se estiver buscando por 'encerrado', mas o checkbox estiver desmarcado, 
        // força a busca de 'ativos' (para consistência do app)
        const showEncerradosCheckbox = document.getElementById('showEncerradosCheckbox');
        if (showEncerradosCheckbox && !showEncerradosCheckbox.checked && statusFilter === 'encerrado') {
             // Não deve acontecer se a lógica de switchScreen estiver correta, mas previne inconsistência.
             // Manter o status ativo se o checkbox de 'encerrado' estiver desmarcado
        }


        // MOSTRA CARREGAMENTO
        projectsContainer.innerHTML = '<div class="loading-spinner"></div>';

        const params = new URLSearchParams({
            status: status
        });

        if (searchTerm) {
            params.append('search', searchTerm);
        }
        let url = `${API_BASE_URL}/projetos?${params.toString()}`;
        

        const response = await window.authenticatedFetch(url, {
            method: 'GET'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao carregar projetos.' }));
            console.error('project-status.js: API Error:', errorData.error || 'Unknown error');
            throw new Error(errorData.error || 'Erro ao carregar projetos.');
        }

        let allProjects = await response.json();
        projectsContainer.innerHTML = '';

        if (allProjects.length === 0) {
            const message = status === 'encerrado' ? 'Nenhum projeto encerrado encontrado.' : 'Nenhum projeto ativo encontrado. Cadastre um novo projeto usando o botão no canto superior.';
            projectsContainer.innerHTML = `<p class="no-projects">${message}</p>`;
            if (window.applyUIPermissions && window.getCurrentUser) {
                window.applyUIPermissions(window.getCurrentUser()?.role);
            }
            return;
        }

        allProjects.forEach(project => {
            const projectCard = window.createProjectCard(project);
            projectsContainer.appendChild(projectCard);
        });

        // Aplica permissões após renderizar todos os elementos
        if (window.applyUIPermissions && window.getCurrentUser) {
            window.applyUIPermissions(window.getCurrentUser()?.role);
        }

    } catch (error) {
        console.error('project-status.js: Erro ao carregar projetos na UI:', error);
        window.showError('Erro ao carregar projetos: ' + error.message);
        document.getElementById('projectsContainer').innerHTML = `<p class="no-projects" style="color:red;">Falha ao carregar projetos.</p>`;
    }
};

// =========================================================================
// FUNÇÕES AUXILIARES DE INTERFACE (CHAMADAS PELA UI)
// =========================================================================

// Função chamada pelo botão de busca e pela função switchScreen em script.js
// Esta função lida com os inputs da interface (checkbox e campo de busca)
function fetchProjects() {
    const showEncerradosCheckbox = document.getElementById('showEncerradosCheckbox');
    const searchTermInput = document.getElementById('projectSearchInput');
    
    // Determina o status com base no checkbox (se o evento veio da UI)
    const status = showEncerradosCheckbox && showEncerradosCheckbox.checked ? 'encerrado' : 'ativo';
    const searchTerm = searchTermInput ? searchTermInput.value : '';
    
    window.fetchAndRenderProjects(status, searchTerm);
}

// Expondo a função para uso global (necessário para switchScreen)
window.fetchProjects = fetchProjects;

window.createProjectCard = function(projeto) {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.dataset.projectId = projeto.id;

    if (projeto.encerrado) {
        card.classList.add('project-encerrado');
    }

    const infoSection = document.createElement('div');
    infoSection.className = 'project-info';

    // --- INÍCIO DA MODIFICAÇÃO ---

    const projectNameWrapper = document.createElement('div');
    projectNameWrapper.className = 'project-name-wrapper';
    
    const projectName = document.createElement('div');
    projectName.className = 'project-info-name';
    projectName.textContent = projeto.nome;

    // Botão Hambúrguer (Toggle)
    const detailsToggleButton = document.createElement('button');
    detailsToggleButton.className = 'details-toggle-btn';
    detailsToggleButton.innerHTML = '<i class="fas fa-bars"></i>';
    detailsToggleButton.title = 'Mostrar/Esconder Detalhes';
    
    projectNameWrapper.appendChild(projectName);
    projectNameWrapper.appendChild(detailsToggleButton);
    
    // Contêiner para os detalhes que serão escondidos/mostrados
    const projectDetails = document.createElement('div');
    projectDetails.className = 'project-info-details collapsible'; // Adicionada a classe 'collapsible'

    // --- FIM DA MODIFICAÇÃO ---

    const dataInicioProjeto = projeto.data_inicio ? window.formatDate(projeto.data_inicio) : 'Não definido';
    const dataFimProjeto = projeto.data_fim ? window.formatDate(projeto.data_fim) : 'Não definido';

    const dataUltimaAtualizacao = projeto.data_ultima_atualizacao ? window.formatDate(projeto.data_ultima_atualizacao, true) : 'N/A';
    const nomeUltimoAtualizador = projeto.ultimo_atualizador_nome || 'N/A';
    const tipoAtualizacao = projeto.ultima_atualizacao_tipo || 'N/A';

    let equipeText = '';
    if (projeto.equipe_json) {
        try {
            const equipe = JSON.parse(projeto.equipe_json);
            equipeText = Array.isArray(equipe) ? equipe.join(', ') : (typeof equipe === 'string' ? equipe : '');
        } catch (e) {
            equipeText = projeto.equipe_json || '';
        }
    }

    projectDetails.innerHTML = `
        <strong>Coordenador/Gerente:</strong> ${projeto.coordenador || 'Não definido'}<br>
        <strong>Líder:</strong> ${projeto.lider}<br>
        <strong>Equipe:</strong> ${equipeText}<br>
        <strong>Início:</strong> ${dataInicioProjeto}<br>
        <strong>Entrega:</strong> ${dataFimProjeto}<br>
        <strong>Última Atualização: </strong><strong>${nomeUltimoAtualizador}</strong> feita em ${dataUltimaAtualizacao}
    `;

    infoSection.appendChild(projectNameWrapper); // Adiciona o wrapper com nome e botão

    if (projeto.encerrado) {
        const encerradoLabel = document.createElement('span');
        encerradoLabel.className = 'project-status-label encerrado-label';
        encerradoLabel.textContent = 'ENCERRADO';
        infoSection.appendChild(encerradoLabel);
    }
    
    infoSection.appendChild(projectDetails); // Adiciona o container dos detalhes

    // Lógica para o clique do botão
    detailsToggleButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const cardElement = e.target.closest('.project-card');
        cardElement.classList.toggle('details-visible');
    });


    const mainContentWrapper = document.createElement("div");
    mainContentWrapper.className = "project-main-content-wrapper";
    mainContentWrapper.appendChild(infoSection);

    const stepperWrapper = document.createElement("div");
    stepperWrapper.className = "project-stepper-wrapper";
    mainContentWrapper.appendChild(stepperWrapper);

    const stepperContainer = document.createElement('div');
    stepperContainer.className = 'stepper-container';

    if (projeto.customEtapas && projeto.customEtapas.length > 0) {
        projeto.customEtapas.forEach((etapa, index) => {
            const percentual = (projeto.percentuaisPorEtapa && typeof projeto.percentuaisPorEtapa === 'object') ? projeto.percentuaisPorEtapa[etapa.id] || 0 : 0;
            const stageStatus = (projeto.statusPorEtapa && typeof projeto.statusPorEtapa === 'object') ? projeto.statusPorEtapa[etapa.id] || 'pendente' : 'pendente';

            const step = document.createElement('div');
            step.className = 'step';

            if (percentual === 100) {
                const isLateCompletion = (projeto.subEtapas || []).filter(se => se.projeto_etapa_id === etapa.id).some(se => {
                    const dueDate = se.data_prevista_conclusao ? window.parseDDMMYYYYtoDate(se.data_prevista_conclusao) : null;
                    const completionDate = se.data_conclusao ? window.parseDDMMYYYYtoDate(se.data_conclusao) : null;
                    if (dueDate && completionDate) {
                        const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                        const completionDateOnly = new Date(completionDate.getFullYear(), completionDate.getMonth(), completionDate.getDate());
                        return completionDateOnly.getTime() > dueDateOnly.getTime();
                    }
                    return false;
                });
                if (isLateCompletion) {
                    step.classList.add('completed-late');
                } else {
                    step.classList.add('completed');
                }
            } else if (stageStatus === 'atrasado') {
                step.classList.add('delayed');
            } else if (stageStatus === 'andamento' || percentual > 0) {
                step.classList.add('active');
            }

            const stepStartDate = document.createElement('div');
            stepStartDate.className = 'step-start-date';
            stepStartDate.textContent = etapa.data_inicio ? window.formatDate(etapa.data_inicio) : 'Sem Início';
            step.appendChild(stepStartDate);

            const stepEndDate = document.createElement('div');
            stepEndDate.className = 'step-date';
            stepEndDate.textContent = etapa.data_fim ? window.formatDate(etapa.data_fim) : 'Sem Fim';
            step.appendChild(stepEndDate);

            const stepLabel = document.createElement('div');
            stepLabel.className = 'step-label';
            stepLabel.textContent = etapa.nome_etapa;

            step.innerHTML += `<span class="step-percentage">${Math.round(percentual)}%</span>`;
            step.appendChild(stepLabel);
            stepperContainer.appendChild(step);

            step.addEventListener('click', () => {
                window.openSubEtapasModal(projeto.id, etapa.id, etapa.nome_etapa);
            });
        });
    } else {
        const noStagesMsg = document.createElement('p');
        noStagesMsg.textContent = 'Nenhuma etapa definida para este projeto.';
        noStagesMsg.style.textAlign = 'center';
        noStagesMsg.style.color = 'var(--text-muted-color)';
        stepperContainer.appendChild(noStagesMsg);
    }

    stepperWrapper.appendChild(stepperContainer);

    const lastViewedDate = projectWeekStates.get(projeto.id) || new Date();
    const { range, mondayDate, yearMonth } = getWeekDateRange(lastViewedDate);

    const weeklyDeliverableSection = document.createElement("div");
    weeklyDeliverableSection.className = "weekly-deliverable-section";
    weeklyDeliverableSection.dataset.projectId = projeto.id;
    weeklyDeliverableSection.dataset.currentWeek = mondayDate;
    const hasContentClass = projeto.deliverable_content ? 'has-content' : '';
    weeklyDeliverableSection.innerHTML = `
        <div class="deliverable-header">
            <button class="week-nav-btn" data-project-id="${projeto.id}" data-direction="prev">&lt;</button>
            <span class="deliverable-label">Entregável da semana: <span class="deliverable-week-range">(${range})</span></span>
            <button class="week-nav-btn" data-project-id="${projeto.id}" data-direction="next">&gt;</button>
        </div>
        <div class="deliverable-content ${hasContentClass}" data-project-id="${projeto.id}">
            <span class="marquee-text">${projeto.deliverable_content || "Clique para editar..."}</span>
        </div>
    `;

    const projectActions = document.createElement("div");
    projectActions.className = "project-actions";

    const toggleStatusButton = document.createElement("button");
    toggleStatusButton.className = "toggle-status-btn";
    toggleStatusButton.textContent = projeto.encerrado ? "Reabrir Projeto" : "Encerrar Projeto";
    toggleStatusButton.classList.add(projeto.encerrado ? "reopen-btn" : "close-btn");
    toggleStatusButton.onclick = (e) => {
        e.stopPropagation();
        window.toggleProjectStatus(projeto.id, !projeto.encerrado);
    };
    projectActions.appendChild(toggleStatusButton);

    const npsButton = document.createElement("button");
    npsButton.className = "action-button nps-btn";
    npsButton.innerHTML = '<i class="fas fa-poll"></i> Formulários';
    npsButton.onclick = (e) => {
        e.stopPropagation();
        window.openNpsModal(projeto.id, projeto.nome);
    };
    projectActions.appendChild(npsButton);

    const detailsButton = document.createElement("button");
    detailsButton.className = "view-btn";
    detailsButton.textContent = "Detalhes";
    detailsButton.onclick = (e) => {
        e.stopPropagation();
        window.openProjectDetailsModal(projeto.id);
    };
    projectActions.appendChild(detailsButton);

    const editButton = document.createElement("button");
    editButton.className = "edit-btn";
    editButton.textContent = "Editar";
    editButton.onclick = (e) => {
        e.stopPropagation();
        window.openEditProjectModal(projeto.id);
    };
    projectActions.appendChild(editButton);

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-btn";
    deleteButton.textContent = "Excluir";
    deleteButton.onclick = (e) => {
        e.stopPropagation();
        window.openDeleteConfirmModal(projeto.id, projeto.nome);
    };
    projectActions.appendChild(deleteButton);
    
    const partsButton = document.createElement("button");
    partsButton.className = "parts-button";
    partsButton.textContent = "Peças para o Projeto";
    partsButton.onclick = (e) => {
        e.stopPropagation();
        window.openProjectPartsModal(projeto.id, projeto.nome);
    };
    projectActions.appendChild(partsButton);

    const shoppingButton = document.createElement("button");
    shoppingButton.className = "action-button shopping-btn";
    shoppingButton.innerHTML = '<i class="fas fa-shopping-cart"></i> Lista de Compras';
    shoppingButton.onclick = (e) => {
        e.stopPropagation();
        window.openShoppingModal(projeto.id, projeto.nome);
    };
    projectActions.appendChild(shoppingButton);

    card.appendChild(mainContentWrapper);
    card.appendChild(projectActions);
    card.appendChild(weeklyDeliverableSection);

    return card;
};

window.openProjectDetailsModal = async function(projectId) {
    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}`);
        if (!response.ok) throw new Error('Erro ao buscar detalhes do projeto');
        const projeto = await response.json();

        const modal = document.getElementById('projectDetailsModal');
        const projectDetailsContent = document.getElementById('projectDetailsContent');
        projectDetailsContent.innerHTML = '';

        let equipeText = '';
        if (projeto.equipe_json) {
            try {
                const equipe = JSON.parse(projeto.equipe_json);
                if (Array.isArray(equipe)) {
                    equipeText = equipe.join(', ');
                } else if (typeof equipe === 'string') {
                    equipeText = equipe;
                } else {
                    equipeText = '';
                }
            } catch (e) {
                console.error('Erro ao analisar JSON da equipe em openProjectDetailsModal:', e);
                equipeText = projeto.equipe_json || '';
            }
        } else {
            equipeText = '';
        }

        let statusClass = '';
        switch (projeto.status) {
            case 'pendente': statusClass = 'status-pending'; break;
            case 'andamento': statusClass = 'status-in-progress'; break;
            case 'atrasado': statusClass = 'status-delayed'; break;
            case 'concluído': statusClass = 'status-completed'; break;
            default: statusClass = '';
        }
        
        const dataUltimaAtualizacao = projeto.data_ultima_atualizacao ? window.formatDate(projeto.data_ultima_atualizacao, true) : 'N/A';
        const nomeUltimoAtualizador = projeto.ultimo_atualizador_nome || 'N/A';
        const tipoAtualizacao = projeto.ultima_atualizacao_tipo || 'N/A';


        projectDetailsContent.innerHTML = `
            <div class="project-details-container">
                <div class="project-details-header"><h3>${projeto.nome}</h3></div>
                <div class="project-details-sections">
                    <div class="project-details-section">
                        <h4>Informações Gerais</h4>
                        <div class="info-grid">
                            <div class="info-item"><span class="info-label">Coordenador/Gerente:</span><span class="info-value">${projeto.coordenador || 'Não definido'}</span></div>
                            <div class="info-item"><span class="info-label">Líder:</span><span class="info-value">${projeto.lider}</span></div>
                            <div class="info-item"><span class="info-label">Porcentagem de Conclusão:</span><span class="info-value">${projeto.percentual_concluido}%</span></div>
                            <div class="info-item"><span class="info-label">Data de Início:</span><span class="info-value">${projeto.data_inicio ? window.formatDate(projeto.data_inicio) : 'Não definido'}</span></div>
                            <div class="info-item"><span class="info-label">Data de Entrega:</span><span class="info-value">${projeto.data_fim ? window.formatDate(projeto.data_fim) : 'Não definido'}</span></div>
                            <div class="info-item"><span class="info-label">Status:</span><span class="info-value ${statusClass}">${projeto.status.toUpperCase()}</span></div>
                            <div class="info-item"><span class="info-label">Encerrado:</span><span class="info-value ${projeto.encerrado ? 'status-completed' : 'status-pending'}">${projeto.encerrado ? 'Sim' : 'Não'}</span></div>
                            <div class="info-item"><span class="info-label">Última Atualização:</span><span class="info-value">${tipoAtualizacao} por ${nomeUltimoAtualizador} em ${dataUltimaAtualizacao}</span></div>
                        </div>
                    </div>
                    <div class="project-details-section">
                        <h4>Equipe</h4>
                        <p>${equipeText || 'Nenhum membro definido'}</p>
                    </div>
                    <div class="project-details-section">
                        <h4>Cronograma de Etapas</h4>
                        <table class="details-table">
                            <thead><tr><th>Ordem</th><th>Etapa</th><th>Data de Início</th><th>Data de Fim</th><th>Status</th></tr></thead>
                            <tbody>${window.getEtapasTableRows(projeto)}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        window.openModal('projectDetailsModal');
        if (window.applyUIPermissions && window.getCurrentUser) {
            window.applyUIPermissions(window.getCurrentUser()?.role);
        }
    }catch (error) {
        console.error('Erro ao abrir detalhes do projeto:', error);
        window.showError('Erro ao carregar detalhes do projeto: ' + error.message);
    }
};

window.getEtapasTableRows = function(projeto) {
    let rows = '';
    if (!projeto.customEtapas || projeto.customEtapas.length === 0) {
        return '<tr><td colspan="4" style="text-align: center;">Nenhuma etapa definida para este projeto.</td></tr>';
    }
    projeto.customEtapas.forEach(etapa => {
        const dataInicio = etapa.data_inicio ? window.formatDate(etapa.data_inicio) : 'Não definido';
        const dataFim = etapa.data_fim ? window.formatDate(etapa.data_fim) : 'Não definido';

        let status = (projeto.statusPorEtapa && typeof projeto.statusPorEtapa === 'object') ? projeto.statusPorEtapa[etapa.id] : 'Pendente';
        let statusClass = '';
        switch (status) {
            case 'pendente': statusClass = 'status-pending'; break;
            case 'andamento': statusClass = 'status-in-progress'; break;
            case 'atrasado': statusClass = 'status-delayed'; break;
            case 'concluído': statusClass = 'status-completed'; break;
            default: statusClass = 'status-pending'; status = 'Pendente';
        }

        // NOVO: Gera as linhas da tabela de setores para esta etapa
        const setoresHtml = (projeto.setoresPorEtapa[etapa.id] || [])
            .map(setor => {
                let setorDotClass = '';
                if (setor.porcentagem_concluida === 100) {
                    setorDotClass = 'completed-dot';
                } else if (setor.porcentagem_concluida > 0) {
                    setorDotClass = 'in-progress-dot';
                } else {
                    setorDotClass = 'pending-dot';
                }
                
                return `
                    <div class="setor-progress-item">
                        <span class="setor-progress-dot ${setorDotClass}" title="${setor.porcentagem_concluida}% Concluído">${setor.porcentagem_concluida}%</span>
                        <span class="setor-nome">${setor.nome}</span>
                    </div>
                `;
            })
            .join('');

        rows += `
            <tr>
                <td>${etapa.ordem}</td>
                <td class="etapa-nome-cel">
                    <div class="etapa-info">
                        <strong>${etapa.nome_etapa}</strong>
                        <div class="setores-list">
                            ${setoresHtml}
                        </div>
                    </div>
                </td>
                <td>${dataInicio}</td>
                <td>${dataFim}</td>
                <td><span class="${statusClass}">${status}</span></td>
            </tr>
        `;
    });
    return rows;
};

window.openEditProjectModal = async function(projectId) {
    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}`);
        if (!response.ok) throw new Error('Erro ao buscar dados do projeto para edição.');
        const project = await response.json();

        document.getElementById('editProjectId').value = project.id;
        document.getElementById('editProjetoNome').value = project.nome;
        document.getElementById('editProjetoCoordenador').value = project.coordenador || '';
        document.getElementById('editProjetoLider').value = project.lider;
        
        let equipeText = '';
        if (project.equipe_json) {
            try {
                const equipe = JSON.parse(project.equipe_json);
                equipeText = Array.isArray(equipe) ? equipe.join(', ') : (typeof equipe === 'string' ? equipe : '');
            } catch (e) {
                equipeText = project.equipe_json || '';
            }
        }
        document.getElementById('editProjetoEquipe').value = equipeText;

        const editDataInicioInput = document.getElementById('editProjetoDataInicio');
        const editDataFimInput = document.getElementById('editProjetoDataFim');

        // --- INÍCIO DA CORREÇÃO: Pega apenas a parte da data e formata corretamente ---
        if (project.data_inicio) {
            const datePart = project.data_inicio.split(' ')[0]; // Pega 'dd/mm/yyyy'
            const parts = datePart.split('/');
            if (parts.length === 3) {
                editDataInicioInput.value = `${parts[2]}-${parts[1]}-${parts[0]}`; // Formata para 'yyyy-mm-dd'
            }
        } else {
            editDataInicioInput.value = '';
        }

        if (project.data_fim) {
            const datePart = project.data_fim.split(' ')[0]; // Pega 'dd/mm/yyyy'
            const parts = datePart.split('/');
            if (parts.length === 3) {
                editDataFimInput.value = `${parts[2]}-${parts[1]}-${parts[0]}`; // Formata para 'yyyy-mm-dd'
            }
        } else {
            editDataFimInput.value = '';
        }
        // --- FIM DA CORREÇÃO ---

        const editEtapasContainer = document.getElementById('editEtapasContainer');
        editEtapasContainer.innerHTML = '';

        if (project.customEtapas && project.customEtapas.length > 0) {
            project.customEtapas.sort((a, b) => a.ordem - b.ordem).forEach((etapa) => {
                // Passa a etapa completa para a função addDynamicEtapaField
                window.addDynamicEtapaField('editEtapasContainer', 'edit_', etapa);
            });
        } else {
            window.addDynamicEtapaField('editEtapasContainer', 'edit_');
        }
        window.updateEtapaOrder('editEtapasContainer');

        window.openModal('editProjectModal');

        const editProjectForm = document.getElementById('editProjectForm');
        if (editProjectForm) {
            editProjectForm.onsubmit = window.saveProjectChanges;
        }

        const editAddEtapaBtn = document.getElementById('editAddEtapaBtn');
        if (editAddEtapaBtn) {
            editAddEtapaBtn.removeEventListener('click', handleEditAddEtapaClick);
            editAddEtapaBtn.addEventListener('click', handleEditAddEtapaClick);
        }
        if (window.applyUIPermissions) {
            window.applyUIPermissions(window.getCurrentUser()?.role);
        }
        setupDragAndDrop('editEtapasContainer');
    } catch (error) {
        console.error('Erro ao abrir projeto para edição:', error);
        window.showError('Erro ao abrir projeto para edição: ' + error.message);
    }
};

window.saveProjectChanges = async function(event) {
    event.preventDefault();
    const projectId = document.getElementById('editProjectId').value;
    const nome = document.getElementById('editProjetoNome').value.trim();
    const coordenador = document.getElementById('editProjetoCoordenador').value.trim();
    const lider = document.getElementById('editProjetoLider').value.trim();
    const equipe = document.getElementById('editProjetoEquipe').value.trim();
    const data_inicio_iso = document.getElementById('editProjetoDataInicio').value;
    const data_fim_iso = document.getElementById('editProjetoDataFim').value;

    if (!nome || !coordenador || !lider || !equipe || !data_inicio_iso || !data_fim_iso) {
        window.showError('Todos os campos de informação do projeto (Nome, Coordenador, Líder, Equipe, Data de Início e Entrega) são obrigatórios.');
        return;
    }

    const data_inicio_formatado = data_inicio_iso ? window.formatDateForDB(data_inicio_iso) : null;
    const data_fim_formatado = data_fim_iso ? window.formatDateForDB(data_fim_iso) : null;

    try {
        const editEtapasContainer = document.getElementById('editEtapasContainer');
        const currentEtapasElements = editEtapasContainer.querySelectorAll('.etapa-dynamic-item');

        const etapasData = [];
        let newOrderCounter = 1;
        for (const item of currentEtapasElements) {
            const isMarkedForDeletion = item.dataset.isDeleted === 'true';
            if (isMarkedForDeletion) {
                continue; 
            }

            const nomeEtapa = item.querySelector('.nome-etapa-input').value.trim();
            const dataInicioEtapaISO = item.querySelector('.data-inicio-etapa-input').value;
            const dataFimEtapaISO = item.querySelector('.data-fim-etapa-input').value;

            if (!nomeEtapa) {
                window.showError(`O nome da etapa na ordem ${newOrderCounter} é obrigatório.`);
                return;
            }
            if (!dataInicioEtapaISO || !dataFimEtapaISO) {
                window.showError(`As datas de Início (De) e Fim (Até) são obrigatórias para a etapa '${nomeEtapa}'.`);
                return;
            }
            
            const etapaId = item.dataset.etapaId === 'null' ? null : parseInt(item.dataset.etapaId);
            
            // --- INÍCIO DA CORREÇÃO: Usa a função de formatação para data, não data e hora ---
            const formattedEtapaDataInicioForDB = window.formatDateForDB(dataInicioEtapaISO);
            const formattedEtapaDataFimForDB = window.formatDateForDB(dataFimEtapaISO);
            // --- FIM DA CORREÇÃO ---

            etapasData.push({
                id: etapaId,
                nome_etapa: nomeEtapa,
                ordem: newOrderCounter,
                data_inicio: formattedEtapaDataInicioForDB,
                data_fim: formattedEtapaDataFimForDB,
            });
            newOrderCounter++;
        }

        const projectUpdateResponse = await window.authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nome,
                coordenador,
                lider,
                equipe,
                data_inicio: data_inicio_formatado,
                data_fim: data_fim_formatado,
                etapas: etapasData,
            }),
        });
        if (!projectUpdateResponse.ok) {
            const errorData = await projectUpdateResponse.json().catch(() => ({ error: 'Erro desconhecido ao atualizar o projeto.' }));
            throw new Error(errorData.error || 'Erro ao atualizar o projeto.');
        }

        window.showToast('Projeto e etapas atualizados com sucesso!', 'success');
        window.closeModal('editProjectModal');
        window.fetchProjects();
    } catch (error) {
        console.error('Erro ao salvar alterações do projeto:', error);
        window.showError('Erro ao salvar alterações: ' + error.message);
    }
};

window.openDeleteConfirmModal = function(projectId, projectName) {
    document.getElementById('deleteProjectName').textContent = projectName;
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    confirmDeleteBtn.onclick = () => window.deleteProject(projectId);
    window.openModal('confirmDeleteModal');
    if (window.applyUIPermissions && window.getCurrentUser) {
        window.applyUIPermissions(window.getCurrentUser()?.role);
    }
};

window.deleteProject = async function(projectId) {
    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido ao excluir projeto.' }));
            throw new Error(errorData.error || 'Erro ao excluir projeto.');
        }
        const result = await response.json();
        window.showToast(result.message, 'success');
        window.closeModal('confirmDeleteModal');
        window.fetchProjects();
    } catch (error) {
        console.error('Erro ao excluir projeto:', error);
        window.showError('Erro ao excluir projeto: ' + error.message);
    }
};

window.toggleProjectStatus = async function(projectId, newStatus) {
    const actionText = newStatus ? 'encerrar' : 'reabrir';
    if (!confirm(`Tem certeza que deseja ${actionText} este projeto?`)) {
        return;
    }

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}/encerrar`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encerrado: newStatus })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `Erro ao ${actionText} o projeto.` }));
            throw new Error(errorData.error || `Erro ao ${actionText} o projeto.`);
        }

        const result = await response.json();
        window.showToast(result.message, 'success');
        window.fetchProjects();
    } catch (error) {
        console.error(`Erro ao ${actionText} o projeto:`, error);
        window.showError(`Erro ao ${actionText} o projeto: ` + error.message);
    }
};

// #################### INÍCIO DA MODIFICAÇÃO (PAGINAÇÃO) ####################

/**
 * Cria o elemento HTML para uma única sub-etapa.
 * @param {object} subEtapa - O objeto da sub-etapa.
 * @returns {HTMLElement} O elemento HTML criado.
 */
function createSubEtapaElement(subEtapa) {
    let isSubEtapaDelayed = false;
    let isLateCompletion = false;

    if (!subEtapa.concluida && subEtapa.data_prevista_conclusao) {
        try {
            const dueDateObj = window.parseDDMMYYYYtoDate(subEtapa.data_prevista_conclusao);

            const todayObj = new Date();
            todayObj.setHours(0, 0, 0, 0);        
            if (dueDateObj && !isNaN(dueDateObj.getTime()) && dueDateObj.getTime() < todayObj.getTime()) {
                isSubEtapaDelayed = true;
            }
        } catch (e) {
            console.error('ERRO no processamento de data:', e);
        }
    }

    const subEtapaItem = document.createElement('div');
    subEtapaItem.className = 'sub-etapa-item';
    subEtapaItem.dataset.id = subEtapa.sub_etapa_id;
    
if (subEtapa.concluida && subEtapa.data_prevista_conclusao && subEtapa.data_conclusao) {
      try {

        
            const dueDate = subEtapa.data_prevista_conclusao; 
            const completionDate = subEtapa.data_conclusao; 

            if (dueDate && completionDate) {
                 const dueDateOnly = new Date(dueDate);
                 const completionDateOnly = new Date(completionDate);             
                 if (completionDateOnly.getTime() > dueDateOnly.getTime()) {
                      isLateCompletion = true;
                }        
            }
      } catch (e) {
            console.error('Erro ao comparar datas:', e);
      }
 } else if (!subEtapa.concluida && subEtapa.data_prevista_conclusao) {
      try {

        const dueDateObj = window.parseDDMMYYYYtoDate(subEtapa.data_prevista_conclusao);
        
        const todayObj = new Date();
        todayObj.setHours(0, 0, 0, 0);

        if (dueDateObj && !isNaN(dueDateObj.getTime()) && dueDateObj.getTime() < todayObj.getTime()) {
            isSubEtapaDelayed = true;
        }
    } catch (e) {
        isSubEtapaDelayed = false;
    }
}

    if (isLateCompletion) subEtapaItem.classList.add('sub-etapa-concluida-atrasada-visual');
    else if (subEtapa.concluida) subEtapaItem.classList.add('sub-etapa-concluida-visual');
    else if (isSubEtapaDelayed) subEtapaItem.classList.add('sub-etapa-atrasada');
    else subEtapaItem.classList.add('sub-etapa-em-andamento');

    const descricao = document.createElement('div');
    descricao.className = 'sub-etapa-descricao';

    const createdByHtml = subEtapa.nome_criador ? `<span> (Criador: <strong>${subEtapa.nome_criador}</strong>)</span>` : '';
    
    // ***** INÍCIO DA MODIFICAÇÃO *****
    // Mostra a lista de todos os funcionários atribuídos
    let assignedToHtml = '';
    if (subEtapa.assigned_employee_names) {
        assignedToHtml = ` <span class="sub-etapa-atribuicao">(Atribuído a: <strong>${subEtapa.assigned_employee_names}</strong>)</span>`;
    }
    // ***** FIM DA MODIFICAÇÃO *****

    let completionStatusText = '';
    if (subEtapa.concluida && subEtapa.data_conclusao) {
        const completionDate = window.formatDate(subEtapa.data_conclusao, false);
        const completerName = subEtapa.nome_concluidor || 'Usuário desconhecido';
        completionStatusText = ` <span class="sub-etapa-concluida">(Concluída em ${completionDate} por <strong>${completerName}</strong>)</span>`;
    } else if (subEtapa.concluida) {
        completionStatusText = ' <span class="sub-etapa-concluida">(Concluída)</span>';
    }
    
    const dataCompraHtml = subEtapa.data_compra 
        ? ` <span class="sub-etapa-compra">(Compra: <strong>${subEtapa.data_compra}</strong>)</span>` 
        : '';

    descricao.innerHTML = `${subEtapa.descricao}${createdByHtml}${assignedToHtml}${completionStatusText}${dataCompraHtml}`;

    const actions = document.createElement('div');
    actions.className = 'sub-etapa-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn small';
    editBtn.innerHTML = '<i class="fas fa-edit"></i>';
    editBtn.title = 'Editar sub-etapa';
    editBtn.dataset.subEtapaId = subEtapa.sub_etapa_id;
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.openEditSubEtapaModal(subEtapa);
    });
    actions.appendChild(editBtn);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn small';
    deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
    deleteBtn.title = 'Excluir sub-etapa';
    deleteBtn.dataset.subEtapaId = subEtapa.sub_etapa_id;
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.deleteSubEtapa(e.currentTarget.dataset.subEtapaId);
    });
    actions.appendChild(deleteBtn);
    
    subEtapaItem.appendChild(descricao);
    const dueDateDiv = document.createElement('div');
    dueDateDiv.className = 'sub-etapa-due-date';

    let dueDateLabel = 'Vence em:';
    if (subEtapa.descricao.startsWith('Comprar:')) {
        dueDateLabel = 'Previsão de Entrega:';
    }
    
    let dueDateText = `${dueDateLabel} Não definido`;
    if (subEtapa.data_prevista_conclusao) {
         try {
             dueDateText = `${dueDateLabel} ${window.formatDate(subEtapa.data_prevista_conclusao)}`;
         } catch (e) { console.error("Erro ao formatar data de vencimento para exibição:", e); }
    }
    dueDateDiv.textContent = dueDateText;
    subEtapaItem.appendChild(dueDateDiv);

    subEtapaItem.appendChild(actions);
    return subEtapaItem;
}


window.openSubEtapasModal = async function(projectId, etapaId, nomeEtapa) {
    const modalTitle = document.getElementById('subEtapasTitulo');
    const projetoIdInput = document.getElementById('subEtapasProjetoId');
    const etapaIdInput = document.getElementById('subEtapasEtapaId');
    
    modalTitle.textContent = nomeEtapa;
    projetoIdInput.value = projectId;
    etapaIdInput.value = etapaId;

    const setoresContainer = document.getElementById('setoresContainer');
    setoresContainer.innerHTML = '<p>Carregando setores...</p>';
    window.openModal('subEtapasModal');

    // Listener para adicionar novo setor
    const addSetorForm = document.getElementById('addSetorForm');
    addSetorForm.onsubmit = async (e) => {
        e.preventDefault();
        const nomeInput = document.getElementById('newSetorName');
        await createSetor(etapaId, nomeInput.value);
        nomeInput.value = '';
        await window.openSubEtapasModal(projectId, etapaId, nomeEtapa); // Recarrega o modal
    };
    
    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/etapas/${etapaId}/sub_etapas`);
        if (!response.ok) throw new Error('Falha ao buscar dados da etapa.');
        const setores = await response.json();

        setoresContainer.innerHTML = '';
        if (setores.length === 0) {
            setoresContainer.innerHTML = '<p>Nenhum setor criado para esta etapa.</p>';
        } else {
            setores.forEach(setor => {
                setoresContainer.appendChild(createSetorCard(setor));
            });
        }
    } catch (error) {
        console.error("Erro ao abrir modal de sub-etapas:", error);
        setoresContainer.innerHTML = `<p style="color:red;">${error.message}</p>`;
    }
};

window.createSetorCard = function(setor) {
    const card = document.createElement('div');
    card.className = 'setor-card';
    card.dataset.setorId = setor.id;
    
    // Determine a classe da bolinha com base na porcentagem
    let dotClass = '';
    const porcentagem = Math.round(setor.porcentagem_concluida); // Arredonda o valor para exibir
    if (porcentagem === 100) {
        dotClass = 'completed-dot';
    } else if (porcentagem > 0) {
        dotClass = 'in-progress-dot';
    } else {
        dotClass = 'pending-dot';
    }
    
    // Altera a string HTML para incluir a nova bolinha de progresso
    card.innerHTML = `
        <div class="setor-header">
            <h4 class="setor-nome">
                <span class="setor-progress-dot ${dotClass}" title="${porcentagem}% Concluído">${porcentagem}%</span>
                ${setor.nome}
            </h4>
            <div class="setor-actions">
                <button class="action-button secondary small edit-setor-btn">Editar</button>
                <button class="action-button danger small delete-setor-btn">Excluir</button>
            </div>
        </div>
        <div class="setor-body">
            <div class="sub-etapas-list">
                </div>
            <div class="sub-etapas-form">
                <form class="addSubEtapaToSetorForm inline-form">
                    <input type="text" class="subEtapaDescricaoInput form-control" placeholder="Descrição da nova sub-etapa" required>
                    <input type="date" class="subEtapaDataLimiteInput form-control">
                    <button type="submit" class="action-button primary small">Adicionar</button>
                </form>
            </div>
        </div>
    `;

    card._originalSubEtapas = Array.isArray(setor.subEtapas) ? setor.subEtapas.slice() : [];

    let filterControls = card.querySelector('.parts-filter-container')
        || document.querySelector('#subEtapasModal .parts-filter-container')
        || document.querySelector('.parts-filter-container');

    if (!filterControls) {
        filterControls = document.createElement('div');
        filterControls.className = 'parts-filter-container';
        filterControls.innerHTML = `
            <div class="filter-group-subetapas">
                <label for="partStatusFilterSubEtapas">Filtrar por Status:</label>
            </div>
            <div class="filter-group checkboxes">
                <label>
                    <input type="checkbox" id="showPendingParts" checked> Pendentes
                </label>
                <label>
                    <input type="checkbox" id="showCompletedParts"> Concluídas
                </label>
            </div>
        `;
        filterControls._isGenerated = true;
    } else {
        filterControls._isGenerated = false;
    }

    const subEtapasWrapper = card.querySelector('.sub-etapas-list') || card.querySelector('.setor-body');
    if (subEtapasWrapper && subEtapasWrapper.parentNode) {
        subEtapasWrapper.parentNode.insertBefore(filterControls, subEtapasWrapper);
    } else {
        card.insertBefore(filterControls, card.firstChild);
    }

    const statusFilter = filterControls.querySelector('#partStatusFilterSubEtapas');
    const showPending = filterControls.querySelector('#showPendingParts');
    const showCompleted = filterControls.querySelector('#showCompletedParts');
    const subEtapasListDiv = card.querySelector('.sub-etapas-list');

    const applyFiltersToThisSetor = () => {
        const status = statusFilter?.value || 'Todos';
        const includePending = !!showPending?.checked;
        const includeCompleted = !!showCompleted?.checked;

        let list = card._originalSubEtapas.slice();

        list = list.filter(se => {
            const isCompleted = !!se.concluida;
            if (status === 'Expirado') {
                const due = se.data_prevista_conclusao ? window.parseDDMMYYYYtoDate(se.data_prevista_conclusao) : null;
                const today = new Date(); today.setHours(0,0,0,0);
                const isExpired = due && !isNaN(due.getTime()) && due < today && !isCompleted;
                if (!isExpired) return false;
            } else if (status === 'Concluido') {
                if (!isCompleted) return false;
            }
            if (!includePending && !includeCompleted) return false;
            if (!includePending && !isCompleted) return false;
            if (!includeCompleted && isCompleted) return false;
            return true;
        });

        subEtapasListDiv.innerHTML = '';
        if (list.length === 0) {
            subEtapasListDiv.innerHTML = '<p>Nenhuma sub-etapa neste setor.</p>';
        } else {
            list.forEach(se => subEtapasListDiv.appendChild(createSubEtapaElement(se)));
        }
    };

    if (statusFilter) {
        statusFilter.addEventListener('change', applyFiltersToThisSetor);
    }
    if (showPending) {
        showPending.addEventListener('change', applyFiltersToThisSetor);
    }
    if (showCompleted) {
        showCompleted.addEventListener('change', applyFiltersToThisSetor);
    }
    try {
        applyFiltersToThisSetor();
    } catch (e) {
        console.error('Erro ao aplicar filtros iniciais:', e);
    }

    // Adiciona os Event Listeners para as ações do setor
    card.querySelector('.edit-setor-btn').addEventListener('click', async () => {
        const novoNome = prompt('Digite o novo nome para o setor:', setor.nome);
        if (novoNome && novoNome.trim() !== '') {
            await updateSetor(setor.id, novoNome.trim());
            card.querySelector('.setor-nome').textContent = novoNome.trim();
        }
    });

    card.querySelector('.delete-setor-btn').addEventListener('click', async () => {
        if (confirm(`Tem certeza que deseja excluir o setor "${setor.nome}" e todas as suas sub-etapas?`)) {
            await deleteSetor(setor.id);
            card.remove();
        }
    });

    card.querySelector('.addSubEtapaToSetorForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const descricao = e.target.querySelector('.subEtapaDescricaoInput').value;
        const dataLimite = e.target.querySelector('.subEtapaDataLimiteInput').value;
        await createSubEtapa(setor.id, descricao, dataLimite);
        const { projectId, etapaId, nomeEtapa } = {
            projectId: document.getElementById('subEtapasProjetoId').value,
            etapaId: document.getElementById('subEtapasEtapaId').value,
            nomeEtapa: document.getElementById('subEtapasTitulo').textContent
        };
        await window.openSubEtapasModal(projectId, etapaId, nomeEtapa); // Recarrega o modal
    });
    
    return card;
};

// Funções auxiliares para chamar a API de setores
async function createSetor(etapaId, nome) {
    await window.authenticatedFetch(`${API_BASE_URL}/etapas/${etapaId}/setores`, {
        method: 'POST', body: JSON.stringify({ nome })
    });
}
async function updateSetor(setorId, nome) {
    await window.authenticatedFetch(`${API_BASE_URL}/setores/${setorId}`, {
        method: 'PUT', body: JSON.stringify({ nome })
    });
}
async function deleteSetor(setorId) {
    await window.authenticatedFetch(`${API_BASE_URL}/setores/${setorId}`, { method: 'DELETE' });
}

// Nova função para criar sub-etapa DENTRO de um setor
async function createSubEtapa(setorId, descricao, dataLimite) {
    const dataFormatada = dataLimite ? dataLimite.split('-').reverse().join('/') : null;
    await window.authenticatedFetch(`${API_BASE_URL}/setores/${setorId}/sub_etapas`, {
        method: 'POST', body: JSON.stringify({ descricao, data_prevista_conclusao: dataFormatada })
    });
}

// #################### FIM DA MODIFICAÇÃO (PAGINAÇÃO) ####################

window.addSubEtapa = async function(event) {
    event.preventDefault();
    const projetoId = document.getElementById("subEtapasProjetoId").value;
    const etapaId = document.getElementById("subEtapasEtapaId").value;
    const descricao = document.getElementById("subEtapaDescricao").value;
    let dataPrevistaISO = document.getElementById("newSubEtapaDueDate").value;

    
    

    if (!descricao) {
        window.showError('A descrição da sub-etapa é obrigatória.');
        
        return;
    }

    const dataPrevistaFormatada = dataPrevistaISO ? window.formatDateForDB(dataPrevistaISO) : null;

    try {
        const requestUrl = `${API_BASE_URL}/etapas/${etapaId}/sub_etapas`;
        
        const response = await window.authenticatedFetch(requestUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projeto_id: projetoId, descricao, data_prevista_conclusao: dataPrevistaFormatada }),
        });
        

        if (!response.ok) {
            let errorData = { error: 'Erro desconhecido ao adicionar sub-etapa.' };
            try {
                errorData = await response.json();
            } catch (jsonError) {
                const errorText = await response.text().catch(() => 'Resposta não-JSON ou vazia');
                console.error('addSubEtapa: Resposta de erro não é JSON:', errorText);
                errorData.error = `Erro do servidor. Status: ${response.status}. Detalhes: ${errorText.substring(0, 100)}...`;
            }
            throw new Error(errorData.error);
        }

        const result = await response.json();
        
        window.showToast(result.message, 'success');

        window.openSubEtapasModal(projetoId, etapaId, document.getElementById('subEtapasTitulo').textContent);

    }catch (error) {
        
        window.showError('Erro ao adicionar sub-etapa: ' + error.message);
    } finally {
        
    }
};

window.updateSubEtapaStatus = async function(subEtapaId, concluida) {
    const projetoId = document.getElementById("subEtapasProjetoId").value;
    const etapaId = document.getElementById("subEtapasEtapaId").value;
    const nomeEtapa = document.getElementById('subEtapasTitulo').textContent;

    
    

    if (!subEtapaId) {
        
        window.showError("Erro: ID da sub-etapa não encontrado.");
        return;
    }

    try {
        const requestUrl = `${API_BASE_URL}/sub_etapas/${subEtapaId}/concluir`;
        
        const response = await window.authenticatedFetch(requestUrl, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ concluida: concluida })
        });
        

        if (!response.ok) {
            let errorData = { error: "Erro desconhecido ao atualizar status da sub-etapa." };
            try {
                errorData = await response.json();
            } catch (jsonError) {
                const errorText = await response.text().catch(() => 'Resposta não-JSON ou vazia');
                console.error('updateSubEtapaStatus: Resposta de erro não é JSON:', errorText);
                errorData.error = `Erro do servidor. Status: ${response.status}. Detalhes: ${errorText.substring(0, 100)}...`;
            }
            throw new Error(errorData.error || `Erro ao atualizar status da sub-etapa. Status: ${response.status}.`);
        }
        const result = await response.json();
        
        window.showToast(result.message, "success");
        window.closeModal("editSubEtapaModal");
        window.openSubEtapasModal(projetoId, etapaId, document.getElementById('subEtapasTitulo').textContent);
    }
   catch (error) {
        
        window.showError("Erro ao atualizar status da sub-etapa: " + error.message);
    }
    finally {
        
    }
};

window.deleteSubEtapa = async function(subEtapaId) {
    const projetoId = document.getElementById('subEtapasProjetoId').value;
    const etapaId = document.getElementById('subEtapasEtapaId').value;
    const nomeEtapa = document.getElementById('subEtapasTitulo').textContent;

    
    

    if (!confirm('Tem certeza que deseja excluir esta sub-etapa?')) {
        return;
    }

    try {
        const requestUrl = `${API_BASE_URL}/sub_etapas/${subEtapaId}`;
        
        const response = await window.authenticatedFetch(requestUrl, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
        
        if (!response.ok) {
            let errorData = { error: 'Erro desconhecido ao excluir sub-etapa.' };
            try {
                errorData = await response.json();
            } catch (jsonError) {
                const errorText = await response.text().catch(() => 'Resposta não-JSON ou vazia');
                console.error('deleteSubEtapa: Resposta de erro não é JSON:', errorText);
                errorData.error = `Erro do servidor. Status: ${response.status}. Detalhes: ${errorText.substring(0, 100)}...`;
            }
            throw new Error(errorData.error || 'Erro ao excluir sub-etapa.');
        }
        const result = await response.json();
        
        window.showToast(result.message, 'success');
        window.openSubEtapasModal(projetoId, etapaId, nomeEtapa);
    }catch (error) {
        
        window.showError('Erro ao excluir sub-etapa: ' + error.message);
    } finally {
        
    }
};

window.startAutoRefreshProjects = function(intervalSeconds = 10) {
    _internalStopAutoRefresh(); 
    const intervalMs = intervalSeconds * 1000;
    autoRefreshProjectsInterval = setInterval(() => {
        const searchTerm = document.getElementById('projectSearchInput').value;
        window.fetchProjects(searchTerm);
    }, intervalMs);
    window.showToast(`Atualização automática de projetos ativada (${intervalSeconds}s)!`, 'success', 2000);
};

window.stopAutoRefreshProjects = function() {
    if (autoRefreshProjectsInterval) {
        clearInterval(autoRefreshProjectsInterval);
        autoRefreshProjectsInterval = null;
        window.showToast('Atualização automática de projetos desativada.', 'info', 1500);
    }
};

window.openEditSubEtapaModal = async function(subEtapa) {
    document.getElementById("editSubEtapaId").value = subEtapa.sub_etapa_id;
    document.getElementById("editSubEtapaProjetoId").value = document.getElementById("subEtapasProjetoId").value;
    document.getElementById("editSubEtapaEtapaId").value = document.getElementById("subEtapasEtapaId").value;
    document.getElementById("editSubEtapaDescricao").value = subEtapa.descricao;

    const editSubEtapaDueDateInput = document.getElementById("editSubEtapaDueDate");

    editSubEtapaDueDateInput.value = subEtapa.data_prevista_conclusao ? subEtapa.data_prevista_conclusao.split('/').reverse().join('-') : '';

    const editSubEtapaHoursPerDayInput = document.getElementById('editSubEtapaHoursPerDay');
    const editSubEtapaPlannedHoursInput = document.getElementById('editSubEtapaPlannedHours');
    const editSubEtapaDateInput = document.getElementById('editSubEtapaDate');
    const editSubEtapaProjectSelect = document.getElementById('editSubEtapaProject');
    const editSubEtapaOperatorInput = document.getElementById('editSubEtapaOperator');
    const editSubEtapaEndTimeInput = document.getElementById('editSubEtapaEndTime');

    editSubEtapaHoursPerDayInput.value = '';
    editSubEtapaPlannedHoursInput.value = '';
    editSubEtapaDateInput.value = '';
    editSubEtapaOperatorInput.value = '';
    editSubEtapaEndTimeInput.value = '';

    if (editSubEtapaProjectSelect) {
        editSubEtapaProjectSelect.innerHTML = '<option value="">Nenhum Projeto</option>';
        try {
            const projectsResponse = await window.authenticatedFetch(`${API_BASE_URL}/projetos`);
            if (projectsResponse.ok) {
                const projects = await projectsResponse.json();
                projects.forEach(proj => {
                    const option = document.createElement('option');
                    option.value = proj.id;
                    option.textContent = proj.nome;
                    editSubEtapaProjectSelect.appendChild(option);
                });
                editSubEtapaProjectSelect.value = document.getElementById("subEtapasProjetoId").value;
            } else {
                console.error('Erro ao carregar projetos para select de edição de sub-etapa:', await projectsResponse.text());
            }
        } catch (e) {
            console.error('Erro de rede ao carregar projetos para select de edição de sub-etapa:', e);
        }
    }


    window.openModal("editSubEtapaModal");
    const form = document.getElementById("editSubEtapaForm");
    form.onsubmit = null;
    form.onsubmit = window.saveSubEtapaChanges;
    if (window.applyUIPermissions && window.getCurrentUser) {
        window.applyUIPermissions(window.getCurrentUser()?.role);
    }
};

window.saveSubEtapaChanges = async function(event) {
    event.preventDefault();

    const subEtapaId = document.getElementById("editSubEtapaId").value;
    const projetoId = document.getElementById("editSubEtapaProjetoId").value;
    const etapaId = document.getElementById("editSubEtapaEtapaId").value;
    const descricao = document.getElementById("editSubEtapaDescricao").value;
    let dataPrevistaISO = document.getElementById("editSubEtapaDueDate").value;

    if (!descricao) { window.showError("A descrição da sub-etapa é obrigatória."); return; }

    const dataPrevistaFormatada = dataPrevistaISO ? window.formatDateForDB(dataPrevistaISO) : null;

    try {
        const requestUrl = `${API_BASE_URL}/sub_etapas/${subEtapaId}`;
        
        const response = await window.authenticatedFetch(requestUrl, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ descricao: descricao, data_prevista_conclusao: dataPrevistaFormatada })
        });
        if (!response.ok) {
            let errorData = { error: "Erro desconhecido ao atualizar status da sub-etapa." };
            try {
                errorData = await response.json();
            } catch (jsonError) {
                const errorText = await response.text().catch(() => 'Resposta não-JSON ou vazia');
                console.error('saveSubEtapaChanges: Resposta de erro não é JSON:', errorText);
                errorData.error = `Erro do servidor. Status: ${response.status}. Detalhes: ${errorText.substring(0, 100)}...`;
            }
            throw new Error(errorData.error || `Erro ao atualizar status da sub-etapa. Status: ${response.status}.`);
        }
        const result = await response.json();
        
        window.closeModal("editSubEtapaModal");
        window.openSubEtapasModal(projetoId, etapaId, document.getElementById('subEtapasTitulo').textContent);
    }catch (error) {
        
        window.showError("Erro ao salvar alterações: " + error.message);
    }
    finally {
        
    }
};

window.closeAndRefreshProjects = function() {
    window.closeModal('subEtapasModal');
    window.fetchProjects();
};

window.openProjectPartsModal = async function(projectId, projectName) {
    

    const modal = document.getElementById('projectPartsModal');
    const projectNameSpan = document.getElementById('projectPartsProjectName');
    const projectIdInput = document.getElementById('projectPartsProjectId');
    const addPartForm = document.getElementById('addProjectPartForm');

    if (!projectNameSpan || !projectIdInput || !addPartForm) {
        console.error('project-status.js: Elementos essenciais do modal de peças não encontrados!');
        window.showError('Erro ao abrir o modal de peças. Elementos não encontrados.');
        return;
    }

    projectNameSpan.textContent = projectName;
    projectIdInput.value = projectId;

    // ===== INÍCIO DA MODIFICAÇÃO =====
    // Adiciona o HTML dos filtros se ainda não existir
    let filterControls = modal.querySelector('.parts-filter-container');
    if (!filterControls) {
        filterControls = document.createElement('div');
        filterControls.className = 'parts-filter-container';
        
        // Opções para o dropdown de status
        const allStatus = ['Todos', 'Aguardando Análise', 'Falta B.O.M', 'Disponivel', 'Em Processo', 'Na fila para Produção', 'Atrasado'];
        const statusOptions = allStatus.map(s => `<option value="${s}">${s}</option>`).join('');

        filterControls.innerHTML = `
            <div class="filter-group">
                <label for="partStatusFilter">Filtrar por Status:</label>
                <select id="partStatusFilter">${statusOptions}</select>
            </div>
            <div class="filter-group checkboxes">
                <label>
                    <input type="checkbox" id="showPendingParts" checked> Pendentes
                </label>
                <label>
                    <input type="checkbox" id="showCompletedParts"> Concluídas
                </label>
            </div>
        `;
        // Insere os filtros logo após o cabeçalho do modal
        const partsListSection = modal.querySelector('.parts-list-section');
        partsListSection.insertBefore(filterControls, partsListSection.firstChild);
    }

    // Define a função que será chamada pelos filtros
    const applyFilters = () => window.fetchProjectParts(projectId);

    const statusFilter = modal.querySelector('#partStatusFilter');
    const showPendingParts = modal.querySelector('#showPendingParts');
    const showCompletedParts = modal.querySelector('#showCompletedParts');

    if (statusFilter) {
       try { statusFilter.removeEventListener('change', applyFilters); } catch (e) {}
       statusFilter.addEventListener('change', applyFilters);
    }
    if (showPendingParts) {
       try { showPendingParts.removeEventListener('change', applyFilters); } catch (e) {}
       showPendingParts.addEventListener('change', applyFilters);
    }
    if (showCompletedParts) {
       try { showCompletedParts.removeEventListener('change', applyFilters); } catch (e) {}
       showCompletedParts.addEventListener('change', applyFilters);
    }
    if (statusFilter) try { statusFilter.removeEventListener('change', applyFilters); } catch (e) {}
    if (showPendingParts) try { showPendingParts.removeEventListener('change', applyFilters); } catch (e) {}
    if (showCompletedParts) try { showCompletedParts.removeEventListener('change', applyFilters); } catch (e) {}

    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    if (showPendingParts) showPendingParts.addEventListener('change', applyFilters);
    if (showCompletedParts) showCompletedParts.addEventListener('change', applyFilters);

    await window.fetchProjectParts(projectId);

    addPartForm.reset();

    const partStatusSelect = document.getElementById('partStatus');
    if (partStatusSelect) {
        partStatusSelect.innerHTML = `
            <option value="Aguardando Análise">Aguardando Análise</option>
            <option value="Falta B.O.M">Falta B.O.M</option>
            <option value="Disponivel">Disponível</option>
            <option value="Concluído">Concluído</option>
        `;
        partStatusSelect.value = 'Aguardando Análise';
    }

    window.openModal('projectPartsModal');
    if (window.applyUIPermissions && window.getCurrentUser) {
        window.applyUIPermissions(window.getCurrentUser()?.role);
    }
};

window.fetchProjectParts = async function(projectId) {
    
    const projectPartsList = document.getElementById('projectPartsList');
    if (!projectPartsList) {
        console.error('project-status.js: Elemento projectPartsList não encontrado para exibir peças.');
        return;
    }

    if (!projectId || isNaN(parseInt(projectId))) {
        console.error('project-status.js: ID do projeto inválido:', projectId);
        projectPartsList.innerHTML = '<p class="no-parts" style="color:red;">Erro: ID do projeto não é válido. Tente novamente.</p>';
        window.showError('Erro ao carregar peças: ID do projeto é inválido.');
        return;
    }

    try {
        // 1. Busca os timers ATIVOS (correndo ou pausados).
        let activeTimersWithDesc = [];
        try {
            const activeTimersResponse = await window.authenticatedFetch(`${API_BASE_URL}/timers/active`);
            if (activeTimersResponse.ok) {
                activeTimersWithDesc = await activeTimersResponse.json();
            }
        } catch (e) {
            console.warn("Não foi possível buscar os timers ativos.", e);
        }
        
        // 2. Busca TODAS as atividades de produção que estão na fila (pendentes e não concluídas).
        let queuedActivities = [];
        try {
            const queuedActivitiesResponse = await window.authenticatedFetch(`${API_BASE_URL}/ferramentas/queued-activities`);
            if (queuedActivitiesResponse.ok) {
                queuedActivities = await queuedActivitiesResponse.json();
            }
        } catch (e) {
            console.warn("Não foi possível buscar as atividades na fila de produção.", e);
        }

    const params = new URLSearchParams();
    const modal = document.getElementById('projectPartsModal');
    const statusFilterEl = modal ? modal.querySelector('#partStatusFilter') : document.getElementById('partStatusFilter');
    const showPendingEl = modal ? modal.querySelector('#showPendingParts') : document.getElementById('showPendingParts');
    const showCompletedEl = modal ? modal.querySelector('#showCompletedParts') : document.getElementById('showCompletedParts');

    const statusVal = statusFilterEl ? String(statusFilterEl.value || '').trim() : '';
    const statusFilterNormalized = statusVal.toLowerCase();
    const showPending = !!(showPendingEl && showPendingEl.checked);
    const showCompleted = !!(showCompletedEl && showCompletedEl.checked);

    params.append('showPending', showPending);
    params.append('showCompleted', showCompleted);

        const response = await window.authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}/pecas?${params.toString()}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao buscar peças do projeto. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao buscar peças do projeto.');
        }
        let parts = await response.json();
        
        // 3. Mapeia o status da peça com a nova lógica de prioridade.
        parts = parts.map(part => {
            const expectedDescription = `Produção de Peça: ${part.nome} (Qtd: ${part.quantidade})`;
            
            const isPartInProcess = activeTimersWithDesc.some(
                timer => timer.descricao === expectedDescription && timer.status === 'running'
            );
            
            const isPartInQueue = queuedActivities.some(
                activity => activity.descricao === expectedDescription
            );

            if (isPartInProcess) {
                return { ...part, status: 'Em Processo' };
            } else if (isPartInQueue) {
                if (part.status !== 'Concluído') {
                    // ▼▼▼ CORREÇÃO AQUI ▼▼▼
                    return { ...part, status: 'Na fila para Produção' }; // Corrigido de "Na Fila de Produção" para "Na fila para Produção"
                    // ▲▲▲ FIM DA CORREÇÃO ▲▲▲
                }
            }
            
            return part;
        });

        const allToolsResponse = await window.authenticatedFetch(`${API_BASE_URL}/ferramentas`);
        const allTools = allToolsResponse.ok ? await allToolsResponse.json() : [];
        const completedSubStagesMap = new Map();
        allTools.forEach(tool => {
            if (tool.subEtapasProducao) {
                tool.subEtapasProducao.forEach(ss => {
                    if (ss.concluida && ss.descricao.includes('Produção de Peça:')) {
                        const match = ss.descricao.match(/Produção de Peça: (.+) \(Qtd: (\d+)\)/);
                        if (match && match[1] && ss.data_conclusao) {
                            const pieceName = match[1].trim();
                            const existingDate = completedSubStagesMap.get(pieceName);
                            if (!existingDate || new Date(ss.data_conclusao).getTime() > new Date(existingDate).getTime()) {
                                completedSubStagesMap.set(pieceName, ss.data_conclusao);
                            }
                        }
                    }
                });
            }
        });
        parts = parts.map(part => ({ ...part, data_conclusao_producao: completedSubStagesMap.get(part.nome) || null }));

        const filteredParts = parts.filter(part => {
            const statusMatch = (!statusVal) || (statusFilterNormalized === 'todos') || (part.status === statusVal);
            const isCompleted = part.status === 'Concluído';
            const showThisPart = (showPending && !isCompleted) || (showCompleted && isCompleted);
            return statusMatch && showThisPart;
        });

        filteredParts.sort((a, b) => {
            const statusOrder = { 'Em Processo': 0, 'Na fila para Produção': 1, 'Atrasado': 2, 'Aguardando Análise': 3, 'Disponivel': 4, 'Falta B.O.M': 5, 'Concluído': 6 };
            const statusA = statusOrder[a.status] || 99;
            const statusB = statusOrder[b.status] || 99;
            if (statusA !== statusB) return statusA - statusB;
            let dateValA = new Date(a.data_cadastro);
            let dateValB = new Date(b.data_cadastro);
            if (a.status === 'Concluído' && a.data_conclusao_producao) dateValA = window.parseDDMMYYYYtoDate(a.data_conclusao_producao) || dateValA;
            if (b.status === 'Concluído' && b.data_conclusao_producao) dateValB = window.parseDDMMYYYYtoDate(b.data_conclusao_producao) || dateValB;
            return dateValB.getTime() - dateValA.getTime();
        });

        projectPartsList.innerHTML = '';
        if (filteredParts.length === 0) {
            projectPartsList.innerHTML = '<p class="no-parts">Nenhuma peça encontrada com os filtros selecionados.</p>';
        } else {
            filteredParts.forEach(part => {
                const partElement = createProjectPartElement(part);
                projectPartsList.appendChild(partElement);
            });
        }
        if (window.applyUIPermissions && window.getCurrentUser) {
            window.applyUIPermissions(window.getCurrentUser()?.role);
        }
    } catch (error) {
        
        projectPartsList.innerHTML = '<p class="no-parts" style="color:red;">Erro ao carregar peças. Tente novamente.</p>';
        window.showError('Erro ao carregar peças: ' + error.message);
    }
};


function createProjectPartElement(part) {
    const div = document.createElement('div');
    div.className = `part-item`;
    div.dataset.partId = part.id;

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
        case 'Atrasado':
            statusClass = 'status-atrasado';
            statusText = 'Atrasado';
            break;
        case 'Na fila para Produção':
            statusClass = 'status-na-listagem';
            statusText = 'Na Fila para Produção';
            break;
        case 'Em Processo':
            statusClass = 'status-em-processo';
            statusText = 'Em Processo';
            break;
        default:
            statusClass = '';
            statusText = part.status || 'Desconhecido';
    }

    const completionDateHtml = part.data_conclusao_producao
    ? `<br><span>Concluído em: ${window.formatDate(part.data_conclusao_producao)}</span>`
    : '';

const criadorHtml = part.nome_criador
    ? `<span>Adicionado por: <strong>${part.nome_criador}</strong></span>`
    : '';
const dataCadastroHtml = part.data_cadastro
    ? `<span>Adicionado em: ${window.formatDate(part.data_cadastro)}</span>`
    : '';

div.innerHTML = `
    <div class="part-info">
        <strong>${part.nome}</strong>
        <span>Quantidade: ${part.quantidade}</span>
        <span>Status: <span class="part-status-text ${statusClass}">${statusText}</span></span>
        ${completionDateHtml}
        ${criadorHtml}
        ${dataCadastroHtml}
    </div>
    <div class="part-actions">
        <button class="action-button secondary small edit-part-btn" data-part-id="${part.id}"><i class="fas fa-pencil-alt"></i></button>
        <button class="action-button danger small delete-part-btn" data-part-id="${part.id}"><i class="fas fa-trash-alt"></i></button>
        <button class="action-button info small view-attachments-btn" data-part-id="${part.id}" data-part-name="${part.nome}"><i class="fas fa-paperclip"></i></button>
    </div>
`;
    
    div.querySelector('.edit-part-btn').addEventListener('click', () => window.openEditProjectPartModal(part.id));
    div.querySelector('.delete-part-btn').addEventListener('click', () => window.deleteProjectPart(part.id));
    div.querySelector('.view-attachments-btn').addEventListener('click', () => window.openAttachmentsModal(part.id, part.nome));

    return div;
}

window.addProjectPart = async function(event) {
    event.preventDefault();
    

    const projectId = document.getElementById('projectPartsProjectId').value;
    const partName = document.getElementById('partName').value.trim();
    const partQuantity = document.getElementById('partQuantity').value;
    const partStatus = document.getElementById('partStatus').value;

    if (!partName || !partQuantity || !partStatus) {
        window.showError('Por favor, preencha todos os campos da peça.');
        return;
    }
    if (parseInt(partQuantity) <= 0) {
        window.showError('A quantidade deve ser um número positivo.');
        return;
    }

    const partData = {
        nome: partName,
        quantidade: parseInt(partQuantity),
        status: partStatus
    };

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}/pecas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(partData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao adicionar peça. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao adicionar peça.');
        }

        const result = await response.json();
        window.showToast(result.message || 'Peça adicionada com sucesso!', 'success');
        event.target.reset();
        window.fetchProjectParts(projectId);
    } catch (error) {
        
        window.showError('Erro ao adicionar peça: ' + error.message);
    }
};

window.openEditProjectPartModal = async function(partId) {
    

    const modal = document.getElementById('editProjectPartModal');
    const idInput = document.getElementById('editProjectPartId');
    const projectIdInput = document.getElementById('editProjectPartProjectId');
    const nameInput = document.getElementById('editPartName');
    const quantityInput = document.getElementById('editPartQuantity');
    const statusSelect = document.getElementById('editPartStatus');
    const titleElement = document.getElementById('editProjectPartTitle');
    const editForm = document.getElementById('editProjectPartForm');

    if (!modal || !idInput || !projectIdInput || !nameInput || !quantityInput || !statusSelect || !titleElement || !editForm) {
        console.error('project-status.js: Elementos do modal de edição de peça não encontrados!');
        window.showError('Erro ao abrir o modal de edição. Elementos não encontrados.');
        return;
    }

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/pecas/${partId}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao buscar dados da peça. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao buscar dados da peça.');
        }
        const part = await response.json();

        idInput.value = part.id;
        projectIdInput.value = part.projeto_id;
        nameInput.value = part.nome || '';
        quantityInput.value = part.quantidade;

        statusSelect.innerHTML = `
            <option value="Aguardando Análise">Aguardando Análise</option>
            <option value="Falta B.O.M">Falta B.O.M</option>
            <option value="Disponivel">Disponível</option>
            <option value="Concluído">Concluído</option>
        `;
        statusSelect.value = part.status;

        titleElement.textContent = `Editar Peça: ${part.nome}`;

        window.openModal('editProjectPartModal');
        editForm.onsubmit = null;
        editForm.onsubmit = async (event) => {
            event.preventDefault();
            await window.editProjectPart(event);
        };
        
        if (window.applyUIPermissions && window.getCurrentUser) {
            window.applyUIPermissions(window.getCurrentUser()?.role);
        }
    } catch (error) {
        
        window.showError('Erro ao carregar dados para edição: ' + error.message);
    }
};

window.editProjectPart = async function(event) {
    event.preventDefault();
    

    const partId = document.getElementById('editProjectPartId').value;
    const projectId = document.getElementById('editProjectPartProjectId').value;
    const nameInput = document.getElementById('editPartName');
    const quantityInput = document.getElementById('editPartQuantity');
    const statusSelect = document.getElementById('editPartStatus');

    if (!partId || !projectId || !nameInput || !quantityInput || !statusSelect) {
        console.error('project-status.js: Elementos do formulário de edição de peça não encontrados.');
        window.showError('Erro interno: Formulário de edição inválido.');
        return;
    }

    const nome = nameInput.value.trim();
    const quantidade = parseInt(quantityInput.value);
    const status = statusSelect.value;

    if (!nome || isNaN(quantidade) || quantidade <= 0 || !status) {
        window.showError('Por favor, preencha todos os campos com valores válidos.');
        return;
    }

    const partData = {
        nome: nome,
        quantidade: quantidade,
        status: status
    };

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/pecas/${partId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(partData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao salvar alterações da peça. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao salvar alterações.');
        }

        const result = await response.json();
        window.showToast(result.message || 'Alterações salvas com sucesso!', 'success');
        window.closeModal('editProjectPartModal');
        window.fetchProjectParts(projectId);
    } catch (error) {
        
        window.showError('Erro ao salvar alterações: ' + error.message);
    }
};

window.deleteProjectPart = async function(partId) {
    
    const projectIdForRefresh = document.getElementById('projectPartsProjectId').value;

    if (!confirm('Tem certeza que deseja excluir esta peça?')) {
        return;
    }

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/pecas/${partId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao excluir peça. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao excluir peça.');
        }

        const result = await response.json();
        window.showToast(result.message || 'Peça excluída com sucesso!', 'success');
        window.fetchProjectParts(projectIdForRefresh);
    } catch (error) {
        
        window.showError('Erro ao excluir peça: ' + error.message);
    }
};


window.openAttachmentsModal = async function(partId, partName) {
    

    const attachmentsModalPartNameSpan = document.getElementById('attachmentsModalPartName');
    const attachmentsModalPartIdInput = document.getElementById('attachmentsModalPartId');
    const uploadAttachmentBtn = document.getElementById('uploadAttachmentBtn');

    if (!attachmentsModalPartNameSpan || !attachmentsModalPartIdInput || !uploadAttachmentBtn) {
        console.error('project-status.js: Elementos essenciais do modal de anexos não encontrados!');
        window.showError('Erro ao abrir o modal de anexos. Elementos não encontrados.');
        return;
    }

    attachmentsModalPartNameSpan.textContent = partName;
    attachmentsModalPartIdInput.value = partId;

    const fileAttachmentInput = document.getElementById('fileAttachmentInput');
    if(fileAttachmentInput) {
        fileAttachmentInput.value = '';
    }
    uploadAttachmentBtn.style.display = 'none';

    await window.fetchAndRenderAttachments(partId);

    window.openModal('attachmentsModal');
    if (window.applyUIPermissions && window.getCurrentUser) {
        window.applyUIPermissions(window.getCurrentUser()?.role);
    }
};

window.fetchAndRenderAttachments = async function(partId) {
    const attachmentsList = document.getElementById('attachmentsListInModal');
    const otherAttachmentsList = document.getElementById('otherAttachmentsListInModal');

    if (!attachmentsList || !otherAttachmentsList) {
        console.error('project-status.js: Elementos de lista de anexos não encontrados.');
        return;
    }
    attachmentsList.innerHTML = '<p class="no-attachments">Carregando anexos...</p>';
    otherAttachmentsList.innerHTML = '';

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/pecas/${partId}/anexos`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao buscar anexos. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao buscar anexos.');
        }
        const attachments = await response.json();
        

        attachmentsList.innerHTML = '';
        otherAttachmentsList.innerHTML = '';
        
        let hasMiniatureAttachments = false;
        let hasOtherAttachments = false;

        if (attachments.length === 0) {
            attachmentsList.innerHTML = '<p class="no-attachments">Nenhum anexo para esta peça.</p>';
            otherAttachmentsList.innerHTML = '<p class="no-attachments">Nenhum outro anexo para esta peça.</p>';
        } else {
            attachments.forEach(attachment => {
                if (attachment.tipo_anexo_exibicao === 'miniatura') {
                    attachmentsList.appendChild(createAttachmentElement(attachment));
                    hasMiniatureAttachments = true;
                } else {
                    otherAttachmentsList.appendChild(createAttachmentElement(attachment, true));
                    hasOtherAttachments = true;
                }
            });
        }
        
        if (!hasMiniatureAttachments) {
            attachmentsList.innerHTML = '<p class="no-attachments">Nenhum anexo com miniatura para esta peça.</p>';
        }
        if (!hasOtherAttachments) {
            otherAttachmentsList.innerHTML = '<p class="no-attachments">Nenhum outro anexo para esta peça.</p>';
        }

        window.applyUIPermissions(window.getCurrentUser()?.role);
    } catch (error) {
        
        attachmentsList.innerHTML = '<p class="no-attachments" style="color:red;">Erro ao carregar anexos. Tente novamente.</p>';
        otherAttachmentsList.innerHTML = '<p class="no-attachments" style="color:red;">Erro ao carregar outros anexos.</p>';
        window.showError('Erro ao carregar anexos: ' + error.message);
    }
};

function createAttachmentElement(attachment, isOtherAttachment = false) {
    const attachmentItem = document.createElement('div');
    attachmentItem.classList.add('attachment-item');
    
    let thumbnailHtml = '';
    if (!isOtherAttachment) {
        if (attachment.tipo_arquivo.includes('image')) {
            thumbnailHtml = `<div class="attachment-thumbnail-wrapper"><img src="${attachment.url}" alt="${attachment.nome_arquivo}"></div>`;
        } else if (attachment.tipo_arquivo.includes('pdf')) {
            thumbnailHtml = `<div class="attachment-thumbnail-wrapper"><iframe src="${attachment.url}#toolbar=0&navpanes=0&scrollbar=0" title="Pré-visualização de ${attachment.nome_arquivo}"></iframe></div>`;
        }
    } else {
         let iconClass = 'fas fa-file';
         if (attachment.nome_arquivo.toLowerCase().endsWith('.dwg')) {
            iconClass = 'fas fa-ruler-combined';
        } else if (attachment.nome_arquivo.toLowerCase().endsWith('.ipt')) {
            iconClass = 'fas fa-cube';
        } else if (attachment.nome_arquivo.toLowerCase().endsWith('.stp')) {
            iconClass = 'fas fa-cogs';
        } else if (attachment.nome_arquivo.toLowerCase().endsWith('.zip') || attachment.nome_arquivo.toLowerCase().endsWith('.rar')) {
            iconClass = 'fas fa-file-archive';
        }
        thumbnailHtml = `<div class="attachment-thumbnail-wrapper attachment-icon-only"><i class="${iconClass} attachment-icon-large"></i></div>`;
    }

    attachmentItem.innerHTML = `
        ${thumbnailHtml}
        <div class="attachment-info">
            <span class="attachment-name">${attachment.nome_arquivo}</span>
            <span class="attachment-date">(${window.formatDate(attachment.data_upload, true)})</span>
        </div>
        <div class="attachment-actions">
            <a href="${attachment.url}" target="_blank" download="${attachment.nome_arquivo}" class="action-button primary small" title="Download">
                <i class="fas fa-download"></i>
            </a>
            ${!isOtherAttachment ? `
            <button class="action-button info small print-attachment-btn" data-url="${attachment.url}" title="Imprimir">
                <i class="fas fa-print"></i>
            </button>
            ` : ''}
            <button class="action-button danger small delete-attachment-btn" data-id="${attachment.id}" title="Excluir">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `;

    const deleteBtn = attachmentItem.querySelector('.delete-attachment-btn');
    if (deleteBtn) {
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm('Tem certeza que deseja excluir este anexo? Esta ação não pode ser desfeita.')) {
                window.deleteAttachment(attachment.id);
            }
        };
    }
    const printBtn = attachmentItem.querySelector('.print-attachment-btn');
    if (printBtn) {
        printBtn.onclick = (e) => {
            e.stopPropagation();
            window.printFile(attachment.url);
        };
    }
    
    return attachmentItem;
}

window.uploadAttachment = async function(event) {
    event.preventDefault();
    const fileInput = document.getElementById('fileAttachmentInput');
    const partId = document.getElementById('attachmentsModalPartId').value;
    const tipoAnexoExibicao = document.getElementById('tipoAnexoExibicao').value;

    if (!partId) {
        window.showError("Erro: ID da peça para anexar não encontrado. Por favor, reabra o modal.");
        return;
    }
    if (fileInput.files.length === 0) {
        window.showError("Por favor, selecione um arquivo para upload.");
        return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('anexo', file);
    formData.append('tipo_anexo_exibicao', tipoAnexoExibicao);

    

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/pecas/${partId}/anexos`, {
            method: 'POST',
            body: formData
        });

        

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido ao enviar anexo. ' }));
            console.error(`DEBUG UPLOAD FRONTEND: Erro da API (response.ok é false):`, errorData);
            throw new Error(errorData.error || 'Erro ao enviar anexo. ');
        }

        const result = await response.json();
        
        window.showToast(result.message || 'Anexo enviado com sucesso!', 'success');
        fileInput.value = '';
        document.getElementById('uploadAttachmentBtn').style.display = 'none';
        document.getElementById('file-name-display').textContent = 'Nenhum arquivo selecionado';

        await window.fetchAndRenderAttachments(partId);

    } catch (error) {
        
        window.showError('Erro ao enviar anexo: ' + error.message);
    }
};

window.deleteAttachment = async function(attachmentId) {
    if (!confirm('Tem certeza que deseja excluir este anexo? Esta ação não pode ser desfeita.')) {
        return;
    }

    const partIdForRefresh = document.getElementById('attachmentsModalPartId').value;

    try {
        
        const response = await window.authenticatedFetch(`${API_BASE_URL}/anexos/${attachmentId}`, {
            method: 'DELETE'
        });

        

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao excluir anexo. Resposta não-JSON.' }));
            console.error(`DEBUG DELETE ATTACHMENT: Erro da API (response.ok é false) para DELETE:`, errorData);
            throw new Error(errorData.error || 'Erro ao excluir anexo.');
        }

        const result = await response.json();
        
        window.showToast(result.message || 'Anexo excluído com sucesso!', 'success');

        try {
            
            await window.fetchAndRenderAttachments(partIdForRefresh);
            
        } catch (refreshAttachmentsError) {
            console.error('DEBUG DELETE ATTACHMENT: ERRO CRÍTICO ao recarregar anexos após exclusão:', refreshAttachmentsError);
            window.showError('Anexo excluído, mas houve um erro ao atualizar a lista de anexos: ' + refreshAttachmentsError.message);
        }

    } catch (error) {
        
        window.showError('Erro ao excluir anexo: ' + error.message);
    }
};

/**
 * Função principal para alternar a abertura/fechamento da seção "Adicionar Novo Item".
 * É chamada pelo 'onclick' no cabeçalho do modal de compras.
 */
window.toggleAddItemSection = function() {
    const addSection = document.querySelector('#shoppingModal .form-section.collapsible-section');
    if (addSection) {
        addSection.classList.toggle('open');
        const isNowOpen = addSection.classList.contains('open');
        
        // Busca o ícone pela classe toggle-collapse-btn i (usando a estrutura do seu HTML)
        const icon = addSection.querySelector('.toggle-collapse-btn i'); 
        
        if (icon) {
            // Define o ícone com base no estado 'open'
            icon.classList.toggle('fa-chevron-up', isNowOpen);
            icon.classList.toggle('fa-chevron-down', !isNowOpen);
        }
        
    }
};

// Local: project-status.js (Substitua a primeira e a segunda ocorrência por esta única função)

window.openShoppingModal = async function(projectId, projectName) {
    window.openModal('shoppingModal');
    document.getElementById('shoppingProjectId').value = projectId;
    document.getElementById('shoppingProjectName').textContent = projectName;

    // 1. Ação principal: Carrega os itens do usuário (Meu Pedido)
    await fetchAndRenderBomItems(projectId);

    // 2. Carrega o painel de Status (Todos veem)
    await loadSentItemsPanel(projectId); 
    
    // 3. Garante que o formulário de adição sempre funcione
    const form = document.getElementById('addBomItemForm');
    if (form) {
        form.reset();
        form.removeEventListener('submit', addBomItem);
        form.addEventListener('submit', addBomItem);
    }
    
    // 4. Lógica de UI / Acordeão (Garante que a seção de adicionar item comece fechada)
    const addSection = document.querySelector('#shoppingModal .form-section.collapsible-section');
    if (addSection) {
        addSection.classList.remove('open'); 
        const icon = addSection.querySelector('.toggle-collapse-btn i');
        if (icon) {
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        }
    }
    
    // 5. CRÍTICO: Lógica de exibição das abas com base nas permissões
    if (window.applyUIPermissions && window.getCurrentUser) {
        // Aplica permissões gerais ao modal (como esconder o formulário de adição se não tiver bom.create)
        window.applyUIPermissions(window.getCurrentUser()?.role); 
        
        // --- INÍCIO DA ATUALIZAÇÃO (Regras v5 - Com Painel Líder) ---
        
        // 1. Busca os elementos das abas
        const liderApprovalPanelTab = document.getElementById('liderApprovalPanelTabButton'); // <-- ADICIONADO
        const approvalPanelTab = document.getElementById('approvalPanelTabButton');
        const cotacoesPanelTab = document.getElementById('cotacoesPanelTabButton');
        const directorApprovalPanelTab = document.getElementById('directorApprovalPanelTabButton');
        const financialApprovalPanelTab = document.getElementById('financialApprovalPanelTabButton');
        const finalItemsPanelTab = document.getElementById('finalItemsPanelTabButton');
    
        // 2. Oculta todas as abas especiais por padrão (para garantir um estado limpo)
        if (liderApprovalPanelTab) liderApprovalPanelTab.style.display = 'none'; // <-- ADICIONADO
        if (approvalPanelTab) approvalPanelTab.style.display = 'none';
        if (cotacoesPanelTab) cotacoesPanelTab.style.display = 'none';
        if (directorApprovalPanelTab) directorApprovalPanelTab.style.display = 'none';
        if (financialApprovalPanelTab) financialApprovalPanelTab.style.display = 'none';
        if (finalItemsPanelTab) finalItemsPanelTab.style.display = 'none';
    
        // 3. Mostra as abas E CARREGA O CONTEÚDO com base nas permissões granulares
        
        // =================================================================================
        // REGRA 1.A (NOVA): "Painel aprovação Líder" -> Apenas para quem tem 'project.shopping.approve'
        // (A mesma permissão do Gestor, pois ambos aprovam)
        // =================================================================================
        if (liderApprovalPanelTab && window.userPermissions.includes('project.shopping.approve')) {
            liderApprovalPanelTab.style.display = 'flex';
            // Carrega o painel de Líderes
            await loadApprovalPanel(projectId, 'Aguardando Aprovação Líder', 'liderApprovalPanelContent'); 
        }

        // =================================================================================
        // REGRA 1.B (Antiga REGRA 1): "Painel de Aprovação Gestores"
        // =================================================================================
        if (approvalPanelTab && window.userPermissions.includes('project.shopping.approve')) {
            approvalPanelTab.style.display = 'flex';
            // Carrega o painel de Gestores
            await loadApprovalPanel(projectId, 'Aguardando Aprovação', 'approvalPanelContent'); 
        }
    
        // REGRA 2: "Cotações/Compras" -> Apenas para quem tem 'acquisitions.view' (ID 48) ou 'acquisitions.manage' (ID 49)
        if (cotacoesPanelTab && (window.userPermissions.includes('acquisitions.view') || window.userPermissions.includes('acquisitions.manage'))) {
            cotacoesPanelTab.style.display = 'flex'; 
            
            // ▼▼▼ CORREÇÃO AQUI ▼▼▼ 
            // O nome da função estava errado (era loadCotacoesPanel) e ela não recebe argumentos.
            await window.fetchAndRenderCotacoes(); // Carrega o painel de cotações
            // ▲▲▲ FIM DA CORREÇÃO ▲▲▲

        }
    
        // REGRA 3: "Painel de Aprovação Diretoria" E "Aprovação Final"
        //           (Ambos visíveis se tiver 'bom.approve.diretoria' (ID 53))
        const canSeeDiretoria = window.userPermissions.includes('bom.approve.diretoria');
        const canSeeFinal = window.userPermissions.includes('bom.approve.final');

        if (directorApprovalPanelTab && canSeeDiretoria) {
            directorApprovalPanelTab.style.display = 'flex'; 
            // Carrega o painel da Diretoria
            await loadApprovalPanel(projectId, 'Aguardando Aprovação Diretoria', 'directorApprovalPanelContent');
        }

        const canSeeFinanceiro = window.userPermissions.includes('bom.approve.financeiro');
        if (financialApprovalPanelTab && canSeeFinanceiro) {
            financialApprovalPanelTab.style.display = 'flex';
            // Carrega o painel Financeiro
            await loadApprovalPanel(projectId, 'Aguardando Aprovação Financeiro', 'financialApprovalPanelContent');
        }
        
        if (finalItemsPanelTab && (canSeeFinal || canSeeDiretoria || canSeeFinanceiro)) {
            finalItemsPanelTab.style.display = 'flex';
            // Carrega o painel Final
            await loadApprovalPanel(projectId, 'Comprado', 'finalItemsListContainer'); 
        }
        // --- FIM DA ATUALIZAÇÃO (Regras v5) ---
    }

    // 6. Reseta para a primeira aba (Meu Pedido) sempre que o modal abrir
    const myShoppingPanelTabButton = document.getElementById('myShoppingPanelTabButton');
    if (window.switchShoppingPanel && myShoppingPanelTabButton) {
        // O 'true' força o clique sem recarregar os dados, pois já carregamos acima
        window.switchShoppingPanel('myShoppingPanel', myShoppingPanelTabButton, true); 
    }
};

// Renderiza o card de um item da lista de compras com checkbox
function renderBomItemCard(item, panelType = 'meuPedido') { // <-- MUDANÇA: Recebe panelType
    const card = document.createElement('div');
    card.className = `bom-item-card status-${item.status.toLowerCase().replace(/\s+/g, '-')}`;
    card.dataset.itemId = item.id;

    const primeiroOrcamento = (item.orcamentos && item.orcamentos.length > 0) ? item.orcamentos[0] : null;
    const imagemHtml = item.url_imagem ? `<img src="${item.url_imagem}" alt="${item.descricao}">` : '<i class="fas fa-image"></i>';
    const statusClass = item.status.toLowerCase().replace(/ /g, '-');

    let selecionadoHTML = '';
    if (item.fornecedor_aprovado) {
        selecionadoHTML = `<p class="item-info"><strong>Selecionado:</strong> ${item.fornecedor_aprovado} - <strong>Valor:</strong> ${window.formatCurrency(item.valor_aprovado)}</p>`;
    }

    // --- INÍCIO DA LÓGICA DE BOTÕES CORRIGIDA ---
    const isEmElaboracao = item.status === 'Em Elaboração';
    const isReprovado = item.status === 'Reprovado';
    const podeAdicionarOrcamento = (isEmElaboracao || isReprovado) || item.status === 'Em Cotação';
    const showItemActions = (isEmElaboracao || isReprovado); 
    
    let actionsHtml = '';
    
    if (showItemActions) {
        // Ações para "Meu Pedido" (Em Elaboração ou Reprovado)
        if (window.userPermissions.includes('bom.edit') || window.userPermissions.includes('bom.create')) {
            actionsHtml += `<button class="action-button primary small" onclick="window.openEditBomItemModal(${item.id})"><i class="fas fa-edit"></i> Editar Item</button>`;
        }
        
        // ===================== CORREÇÃO AQUI =====================
        // O texto deste botão (individual) está "Enviar p/ Aprovação"
        if (window.userPermissions.includes('bom.submit')) {
            actionsHtml += `<button class="action-button success small" onclick="window.submitBomItemForApproval(${item.id})"><i class="fas fa-paper-plane"></i> Enviar p/ Aprovação</button>`;
        }
        // ========================================================

        if (window.userPermissions.includes('bom.edit') || window.userPermissions.includes('bom.create')) {
            actionsHtml += `<button class="action-button danger small" onclick="window.deleteBomItem(${item.id})"><i class="fas fa-trash"></i> Excluir Item</button>`;
        }
    } else if (panelType === 'sent') {
        // Ações para "Status dos Pedidos"
        const canManageSentItemsStrict = window.userPermissions.includes('project.shopping.approve') || // Gerencia
                                         window.userPermissions.includes('bom.approve.diretoria');   // Diretoria (Software tem ambas)
        
        if ((item.status === 'Aguardando Aprovação' || item.status === 'Reprovado' || item.status === 'Em Cotação' || item.status === 'Aguardando Aprovação Diretoria') && canManageSentItemsStrict) {
            actionsHtml += `
                <button class="action-button warning small" onclick="window.returnBomItemToElaboration(${item.id})">
                    <i class="fas fa-undo-alt"></i> Retornar p/ Elaboração
                </button>
            `;
        }
        
        if (canManageSentItemsStrict && window.userPermissions.includes('bom.edit')) {
             actionsHtml += `
                <button class="action-button danger small" onclick="window.deleteBomItem(${item.id})">
                    <i class="fas fa-trash-alt"></i> Excluir (Permanente)
                </button>
             `;
        }
    }
    // --- FIM DA LÓGICA DE BOTÕES CORRIGIDA ---

    let orcamentos = [];
    try {
        orcamentos = Array.isArray(item.orcamentos) ? item.orcamentos : (item.orcamentos ? JSON.parse(item.orcamentos) : []); 
    } catch (e) {
        console.warn("Erro ao processar orçamentos no card (item ID: " + item.id + "):", e);
        orcamentos = [];
    }
 
    const solicitanteHtml = item.nome_solicitante
        ? `<p class="item-info info-solicitante"><i class="fas fa-user-edit"></i> <strong>Solicitante:</strong> ${item.nome_solicitante}</p>`
        : '';
    const gestorHtml = item.nome_gestor
        ? `<p class="item-info info-gestor"><i class="fas fa-user-check"></i> <strong>Aprov. Gestor:</strong> ${item.nome_gestor}</p>`
        : '';
    const cotacaoHtml = item.nome_cotacao
        ? `<p class="item-info info-cotacao"><i class="fas fa-dollar-sign"></i> <strong>Cotação:</strong> ${item.nome_cotacao}</p>`
        : '';
        
    let finalHtml = '';
    if (item.status === 'Comprado' && item.nome_diretor) {
        finalHtml = `<p class="item-info info-diretor"><i class="fas fa-user-tie"></i> <strong>Aprov. Diretor:</strong> ${item.nome_diretor}</p>`;
    } else if (item.status === 'Reprovado' && item.nome_reprovador) {
        finalHtml = `<p class="item-info info-reprovado"><i class="fas fa-user-times"></i> <strong>Reprovado por:</strong> ${item.nome_reprovador}</p>`;
    }
    
    const quotesHtml = orcamentos.map((quote, index) => {
        const previsaoEntregaHtml = quote.data_previsao_entrega 
            ? `<strong>Previsão Entrega:</strong> ${quote.data_previsao_entrega}<br>` 
            : '';
        const cnpjHtml = quote.cnpj ? `<strong>CNPJ:</strong> ${quote.cnpj}<br>` : '';
        const enderecoHtml = quote.endereco ? `<strong>Endereço:</strong> ${quote.endereco}<br>` : '';
        const contatoHtml = quote.contato ? `<strong>Contato:</strong> ${quote.contato}<br>` : '';
        const emailHtml = quote.email ? `<strong>Email:</strong> ${quote.email}<br>` : '';
            
        // Lógica de botões de orçamento
        let quoteActionsHtml = '';
        if (isEmElaboracao || isReprovado) {
             quoteActionsHtml = `
                <div class="quote-actions">
                    <button class="action-button secondary small" onclick="window.openEditQuoteModal(${item.id}, ${index})"><i class="fas fa-pencil-alt"></i></button>
                    <button class="action-button danger small" onclick="window.deleteQuote(event, ${item.id}, ${index})"><i class="fas fa-trash-alt"></i></button>
                </div>
             `;
        }

        return `
            <div class="quote-item-display quote-color-${index % 5}">
                <div class="quote-info-display">
                    <strong>Fornecedor:</strong> ${quote.fornecedor}<br>
                    ${cnpjHtml}
                    ${enderecoHtml}
                    ${contatoHtml}
                    ${emailHtml}
                    <strong>Valor Unitário:</strong> ${window.formatCurrency(quote.valor_unitario)}<br>
                    ${previsaoEntregaHtml} 
                    ${quote.link_produto ? `<strong>Link:</strong> <a href="${quote.link_produto}" target="_blank" rel="noopener noreferrer">Abrir Link</a>` : ''}
                </div>
                ${quoteActionsHtml}
            </div>
        `;
    }).join('');

    const addQuoteFormHtml = `
    <div class="add-quote-form-container">
        <form onsubmit="event.preventDefault(); window.handleAddNewQuote(event, ${item.id})">
            <h4>Adicionar Novo Orçamento</h4>
            <div class="form-row" style="display: flex; gap: 10px;">
                <input type="text" placeholder="Fornecedor" class="quote-fornecedor-input form-control" required>
                <input type="number" placeholder="Valor Unitário (R$)" class="quote-valor-input form-control" required step="0.01" min="0">
            </div>
            <div class="form-row" style="display: flex; gap: 10px;">
                <input type="text" placeholder="CNPJ" class="quote-cnpj-input form-control">
                <input type="text" placeholder="Contato (Telefone)" class="quote-contato-input form-control">
            </div>
            <input type="email" placeholder="Email" class="quote-email-input form-control">
            <input type="text" placeholder="Endereço" class="quote-endereco-input form-control">
            <div class="form-group">
                <label for="quoteDataEntrega-${item.id}">Previsão de Entrega:</label>
                <input type="date" id="quoteDataEntrega-${item.id}" class="quote-data-entrega-input form-control">
            </div>
            <input type="text" placeholder="Link do Produto (Opcional)" class="quote-link-input form-control">
            <button type="submit" class="action-button primary small" style="align-self: flex-end;"><i class="fas fa-plus"></i> Adicionar</button>
        </form>
    </div>
    `;

    card.innerHTML = `
        <div class="bom-item-main-content">
            <div class="bom-item-checkbox-container" style="display:none;"> 
                ${item.status === 'Aguardando Aprovação' ? `<input type="checkbox" class="bom-item-checkbox" data-item-id="${item.id}">` : ''}
            </div>
            <div class="bom-item-image">${imagemHtml}</div>
            <div class="bom-item-details">
                <p class="item-descricao">${item.descricao}</p>
                <p class="item-info"><strong>Projeto:</strong> ${item.nome_projeto || 'N/A'} | <strong>Setor:</strong> ${item.setor}</p>
                <p class="item-info"><strong>Qtd:</strong> ${item.quantidade} | <strong>Justificativa:</strong> ${item.justificativa || 'N/A'}</p>
                
                ${solicitanteHtml} 
                ${gestorHtml}
                ${cotacaoHtml}
                ${finalHtml}
                ${selecionadoHTML} 
                
                <div class="bom-item-status-badge status-${statusClass}">${item.status}</div>
            </div>
            
            <div class="bom-item-actions" style="grid-row: 1 / 3;">
                ${actionsHtml}
            </div>
        </div>
        
        ${(podeAdicionarOrcamento || orcamentos.length > 0) ? `
        <div class="bom-item-quotes-container">
            <div class="quotes-list">${quotesHtml}</div>
            
            ${(isEmElaboracao || isReprovado) ? addQuoteFormHtml : ''}
        </div>
        <button class="bom-item-quotes-toggle" onclick="toggleQuotesVisibility(this)">
            <i class="fas fa-chevron-down"></i> Ver Orçamentos (${orcamentos.length})
        </button>
        ` : ''}
    `;

    return card;
}

/**
 * Retorna um item de compra para o status 'Em Elaboração'.
 * Isso o moverá da aba 'Status dos Pedidos' de volta para 'Lista de Pedido de Compra'.
 */
window.returnBomItemToElaboration = async function(itemId) {
    if (!confirm("Tem certeza que deseja retornar este item para 'Em Elaboração'?\n\nEle voltará para a aba 'Lista de Pedido de Compra' e o processo de aprovação precisará ser reiniciado.")) {
        return;
    }
    
    const projectId = document.getElementById('shoppingProjectId').value;

    try {
        // Esta rota genérica atualiza o status do item
        const response = await window.authenticatedFetch(`${API_BASE_URL}/bom-items/${itemId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Em Elaboração' })
        });
        
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Falha ao retornar o item.');
        }

        window.showToast(result.message, 'success');
        
        // Recarrega ambas as listas no modal ('Em Elaboração' e 'Status dos Pedidos')
        await fetchAndRenderBomItems(projectId);

    } catch (error) {
        window.showError(error.message);
    }
}

// Lógica principal para as ações em massa
async function handleBulkBomAction(action) {
    const selectedIds = Array.from(document.querySelectorAll('.bom-item-checkbox:checked')).map(cb => cb.dataset.itemId);
    if (selectedIds.length === 0) {
        return window.showToast('Nenhum item selecionado.', 'warning');
    }

    const actionText = action === 'approve' ? 'APROVAR' : (action === 'reprove' ? 'REPROVAR' : 'EXCLUIR');
    if (!confirm(`Tem certeza que deseja ${actionText} ${selectedIds.length} item(ns) selecionado(s)?`)) return;

    try {
        let response;
        if (action === 'delete') {
            response = await window.authenticatedFetch(`${API_BASE_URL}/bom-items`, {
                method: 'DELETE',
                body: JSON.stringify({ itemIds: selectedIds })
            });
        } else {
            // Para aprovar/reprovar, chamamos a API individualmente em um loop
            for (const id of selectedIds) {
                await window.authenticatedFetch(`${API_BASE_URL}/solicitacoes/${id}/${action}`, { method: 'PUT' });
            }
            // Simulamos uma resposta de sucesso se todas as chamadas individuais funcionarem
            response = { ok: true, json: async () => ({ message: `${selectedIds.length} item(ns) processados com sucesso.` }) };
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Falha ao ${actionText.toLowerCase()} itens.`);
        }

        const data = await response.json();
        window.showToast(data.message, 'success');
        
        // Recarrega o modal para refletir as mudanças
        const projectId = document.getElementById('shoppingProjectId').value;
        const projectName = document.getElementById('shoppingProjectName').textContent;
        window.openShoppingModal(projectId, projectName);

    } catch (error) {
        window.showError(`Erro: ${error.message}`);
    }
}

// ===============================================
// LÓGICA DE COMPRAS (BOM) - VISÃO DO PROJETO
// ===============================================

/**
 * Manipula a submissão do formulário para adicionar um novo item à BOM.
 */
async function addBomItem(event) {
    event.preventDefault();
    const projectId = document.getElementById('shoppingProjectId').value;
    
    // Captura o valor do campo de data (YYYY-MM-DD)
    const rawDataEntrega = document.getElementById('bomItemDataEntrega').value;
    
    // Converte para o formato DD/MM/YYYY para armazenar no JSON
    const dataEntregaFormatada = rawDataEntrega ? window.formatDateForDB(rawDataEntrega) : null; 

    const itemData = {
        descricao: document.getElementById('bomItemDescricao').value,
        setor: document.getElementById('bomItemSetor').value,
        quantidade: document.getElementById('bomItemQtd').value,
        justificativa: document.getElementById('bomItemJustificativa').value,
        // Garante que o fornecedor e valor venham do HTML (são campos obrigatórios no HTML)
        fornecedor: document.getElementById('bomItemFornecedor').value,
        valor_unitario: document.getElementById('bomItemValor').value,
        link_produto: document.getElementById('bomItemLink').value,
        url_imagem: document.getElementById('bomItemUrlImagem').value,
        // NOVO: Adiciona a previsão de entrega na payload
        data_previsao_entrega: dataEntregaFormatada, 
        
        // ##### INÍCIO DA ADIÇÃO #####
        cnpj: document.getElementById('bomItemCnpj').value,
        endereco: document.getElementById('bomItemEndereco').value,
        contato: document.getElementById('bomItemContato').value,
        email: document.getElementById('bomItemEmail').value,
        // ##### FIM DA ADIÇÃO #####
    };

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}/bom-items`, {            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itemData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Falha ao adicionar item.');
        }

        const result = await response.json();
        window.showToast(result.message, 'success');

        event.target.reset(); // Limpa o formulário

        // Atualiza apenas a lista de itens, sem recarregar o modal todo
        await fetchAndRenderBomItems(projectId);

    } catch (error) {
        
        window.showError(`Erro: ${error.message}`);
    }
}

/**
 * NOVA FUNÇÃO: Envia todos os itens "Em Elaboração" de um setor específico para aprovação.
 */
async function sendSectorForApproval(projectId, sectorName) {
    if (!projectId || !sectorName) {
        window.showError("ID do projeto ou nome do setor não encontrado.");
        return;
    }

    if (!confirm(`Tem certeza que deseja enviar os itens do setor "${sectorName}" para aprovação?`)) {
        return;
    }

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}/bom/submit-sector`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sector: sectorName }) // Envia o nome do setor no corpo da requisição
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || "Falha ao enviar o setor.");
        }

        window.showToast(result.message, 'success');
        // Recarrega a lista de compras para refletir a mudança
        await fetchAndRenderBomItems(projectId); 

    } catch (error) {
        
        window.showError(`Erro: ${error.message}`);
    }
}

/**
 * Busca e renderiza os itens da BOM para um projeto, incluindo botões de aprovação.
 * Esta é a visão do time de projetos.
 */
async function fetchAndRenderBomItems(projectId) {
    const containerElaboracao = document.getElementById('bomItemsListContainer');
    const containerEnviados = document.getElementById('sentBomItemsListContainer');
    
    if (!containerElaboracao || !containerEnviados) return;

    containerElaboracao.innerHTML = `<p class="no-items-message">Buscando itens...</p>`;
    containerEnviados.innerHTML = `<p class="no-items-message">Buscando itens...</p>`;

    // Função auxiliar para renderizar grupos de setores em um container
    // (O botão de enviar por setor foi REMOVIDO desta função interna)
    const renderGroups = (container, items, currentProjectId, panelType) => {
        // A função renderGroups agora apenas agrupa e renderiza os cards
        // O container principal (containerElaboracao) já foi limpo
        
        const groupedBySector = items.reduce((acc, item) => {
            const sector = item.setor || 'Sem Setor';
            if (!acc[sector]) {
                acc[sector] = [];
            }
            acc[sector].push(item);
            return acc;
        }, {});

        if (Object.keys(groupedBySector).length === 0) {
            // Se não houver grupos (mas o botão mestre pode existir), não faz nada
            // A mensagem de "nenhum item" será tratada fora
        } else {
             // Renderiza os grupos de setores
            for (const sector in groupedBySector) {
                const sectorGroup = document.createElement('div');
                sectorGroup.className = 'sector-group';
                sectorGroup.dataset.sector = sector;

                const titleContainer = document.createElement('div'); 
                titleContainer.className = 'sector-title-container'; 

                const sectorTitle = document.createElement('h4');
                sectorTitle.className = 'sector-title-text'; 
                sectorTitle.textContent = `Setor: ${sector}`;
                titleContainer.appendChild(sectorTitle); 

                // ***** BOTÃO DE ENVIAR POR SETOR FOI REMOVIDO DAQUI *****
                
                sectorGroup.appendChild(titleContainer);

                const itemsContainer = document.createElement('div');
                itemsContainer.className = 'sector-items-container';

                groupedBySector[sector].forEach(item => {
                    const itemCard = renderBomItemCard(item, panelType);
                    itemsContainer.appendChild(itemCard);
                });
                
                sectorGroup.appendChild(itemsContainer);
                container.appendChild(sectorGroup);
            }
        }
         // Re-aplica permissões após renderizar os grupos
         if (window.applyUIPermissions) {
             window.applyUIPermissions(window.getCurrentUser()?.role, `#${container.id}`);
         }
    };

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}/bom-items`);
        if (!response.ok) throw new Error('Falha ao buscar itens.');
        
        const allItems = await response.json();
        
        const itemsEmElaboracao = allItems.filter(item => item.status === 'Em Elaboração' || item.status === 'Reprovado');
        const itemsEnviados = allItems.filter(item => item.status !== 'Em Elaboração' && item.status !== 'Reprovado');

        // ===================== INÍCIO DA CORREÇÃO =====================
        
        // 1. Limpa o container de "Elaboração"
        containerElaboracao.innerHTML = ''; 

        // 2. Adiciona o botão "Enviar Solicitação" (Mestre) APENAS UMA VEZ, no topo
        if (itemsEmElaboracao.length > 0 && window.userPermissions.includes('bom.submit')) {
            const masterSendButtonContainer = document.createElement('div');
            // Usamos 'sector-group-header' para manter um estilo similar
            masterSendButtonContainer.className = 'sector-group-header master-send-button-container'; 
            masterSendButtonContainer.innerHTML = `
                <button class="action-button success" onclick="window.sendShoppingListForApproval()">
                    <i class="fas fa-paper-plane"></i> Enviar Solicitação (Todos os Itens)
                </button>
            `;
            containerElaboracao.appendChild(masterSendButtonContainer);
        }

        // 3. Renderiza os grupos (que agora não têm mais botões de setor)
        renderGroups(containerElaboracao, itemsEmElaboracao, projectId, 'meuPedido');
        
        // 4. Se, após tudo, o container de elaboração estiver vazio (sem botão e sem grupos)
        if (containerElaboracao.innerHTML === '') {
             containerElaboracao.innerHTML = `<p class="no-items-message">Nenhum novo item para enviar.</p>`;
        }
        
        // ===================== FIM DA CORREÇÃO =====================
        
        // Renderiza Enviados/Processados (Painel "Status dos Pedidos")
        renderGroups(containerEnviados, itemsEnviados, projectId, 'sent');

    } catch (error) {
        containerElaboracao.innerHTML = `<p class="error-message">Erro ao carregar itens: ${error.message}</p>`;
        containerEnviados.innerHTML = `<p class="error-message">Erro ao carregar histórico.</p>`;
    }
}

/**
 * Envia todos os itens "Em Elaboração" de um projeto para aprovação.
 */
async function sendShoppingListForApproval() {
    const projectId = document.getElementById('shoppingProjectId').value;
    if (!projectId) {
        window.showError("ID do projeto não encontrado.");
        return;
    }

    if (!confirm("Tem certeza que deseja enviar a lista de compras para aprovação? Após o envio, você não poderá editar os itens nesta tela.")) {
        return;
    }

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}/bom/submit`, {
            method: 'PUT'
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || "Falha ao enviar a lista.");
        }

        window.showToast(result.message, 'success');
        window.closeModal('shoppingModal'); // Fecha o modal após o envio bem-sucedido

    } catch (error) {
        
        window.showError(`Erro: ${error.message}`);
    }
}



/**
 * Alterna a visibilidade da seção de orçamentos de um item.
 */
function toggleQuotesVisibility(button) {
    const card = button.closest('.bom-item-card');
    card.classList.toggle('quotes-open');
    const icon = button.querySelector('i');
    if (card.classList.contains('quotes-open')) {
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
    } else {
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
    }
}

/**
 * Adiciona um novo orçamento a um item existente.
 * O parâmetro 'reloadCotacoesPanel' decide qual painel recarregar após o sucesso.
 */
async function handleAddNewQuote(event, itemId, reloadCotacoesPanel = false) {
    event.preventDefault();
    const form = event.target;

    // Captura o valor do campo de data (YYYY-MM-DD do input type="date")
    const rawDataEntrega = form.querySelector('.quote-data-entrega-input').value; 
    
    // Converte para o formato DD/MM/YYYY para armazenar no JSON
    // Se a data for vazia, envia null.
    const dataEntregaFormatada = rawDataEntrega ? window.formatDateForDB(rawDataEntrega) : null; 

    const quoteData = {
        fornecedor: form.querySelector('.quote-fornecedor-input').value,
        valor_unitario: form.querySelector('.quote-valor-input').value,
        link_produto: form.querySelector('.quote-link-input').value,
        // NOVO: Adiciona a previsão de entrega na payload
        data_previsao_entrega: dataEntregaFormatada, 
        
        // ##### INÍCIO DA ADIÇÃO #####
        cnpj: form.querySelector('.quote-cnpj-input').value,
        endereco: form.querySelector('.quote-endereco-input').value,
        contato: form.querySelector('.quote-contato-input').value,
        email: form.querySelector('.quote-email-input').value
        // ##### FIM DA ADIÇÃO #####
    };

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/bom-items/${itemId}/quotes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(quoteData)
        });
        const result = await response.json();
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido ao adicionar orçamento.' }));
            throw new Error(errorData.error || 'Falha ao adicionar orçamento.');
        }

        window.showToast(result.message, 'success');
        
        // Decide qual painel deve ser atualizado
        if (reloadCotacoesPanel) {
            window.fetchAndRenderCotacoes();
        } else {
            fetchAndRenderBomItems(document.getElementById('shoppingProjectId').value);
        }
        
        form.reset(); // Limpa o formulário após sucesso

    } catch (error) {
        window.showError(error.message);
    }
}

async function openEditBomItemModal(itemId) {
    const projectId = document.getElementById('shoppingProjectId').value;
    
    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}/bom-items`);
        if (!response.ok) throw new Error("Não foi possível buscar os detalhes do item.");
        const items = await response.json();
        const currentItem = items.find(i => i.id === itemId);

        if (!currentItem) {
            window.showError("Item não encontrado.");
            return;
        }
        
        document.getElementById('editBomItemId').value = currentItem.id;
        document.getElementById('editBomItemDescricao').value = currentItem.descricao;
        document.getElementById('editBomItemSetor').value = currentItem.setor;
        document.getElementById('editBomItemQtd').value = currentItem.quantidade;
        document.getElementById('editBomItemJustificativa').value = currentItem.justificativa || '';
        document.getElementById('editBomItemUrlImagem').value = currentItem.url_imagem || '';

        // NOVO: Preenche a data de previsão
        const dataEntregaInput = document.getElementById('editBomItemDataEntrega');
        if (dataEntregaInput) {
            // A data de previsão está no PRIMEIRO ORÇAMENTO (índice 0)
            const orcamentos = Array.isArray(currentItem.orcamentos) ? currentItem.orcamentos : (currentItem.orcamentos ? JSON.parse(currentItem.orcamentos) : []);
            
            if (orcamentos.length > 0 && orcamentos[0].data_previsao_entrega) {
                // Converte DD/MM/YYYY (do JSON) para YYYY-MM-DD (do input type="date")
                const parts = orcamentos[0].data_previsao_entrega.split('/'); 
                if (parts.length === 3) {
                    dataEntregaInput.value = `${parts[2]}-${parts[1]}-${parts[0]}`; 
                }
            } else {
                dataEntregaInput.value = '';
            }
        }

        document.getElementById('editBomItemForm').onsubmit = handleEditBomItemSubmit;

        window.openModal('editBomItemModal');
    } catch (error) {
        window.showError(error.message);
    }
}

async function handleEditBomItemSubmit(event) {
    event.preventDefault();
    const itemId = document.getElementById('editBomItemId').value;
    const projectId = document.getElementById('shoppingProjectId').value;

    // Captura o valor do campo de data (YYYY-MM-DD) do input de edição
    const rawDataEntrega = document.getElementById('editBomItemDataEntrega').value;
    // Converte para o formato DD/MM/YYYY para armazenar no JSON
    const dataEntregaFormatada = rawDataEntrega ? window.formatDateForDB(rawDataEntrega) : null; 

    const updatedData = {
        descricao: document.getElementById('editBomItemDescricao').value,
        setor: document.getElementById('editBomItemSetor').value,
        quantidade: document.getElementById('editBomItemQtd').value,
        justificativa: document.getElementById('editBomItemJustificativa').value,
        url_imagem: document.getElementById('editBomItemUrlImagem').value,
        // NOVO: Adiciona a data de previsão no objeto para a API
        data_previsao_entrega: dataEntregaFormatada
    };

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/bom-items/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });
        
        const result = await response.json();
        // A falha de "Acesso negado" que você viu no console indica que o backend retornou 403 ou 401. 
        // Isso pode ser uma falha de autorização (permissão 'bom.edit' ausente ou expirada).
        if (!response.ok) throw new Error(result.error);

        window.showToast(result.message, 'success');
        window.closeModal('editBomItemModal');
        // A chamada fetchAndRenderBomItems recarrega o item e garante que a data editada seja visível.
        fetchAndRenderBomItems(projectId);
    } catch (error) {
        window.showError(error.message);
    }
}

async function deleteBomItem(itemId) {
    if (!confirm("Tem certeza que deseja excluir este item da lista de compras?")) {
        return;
    }
    const projectId = document.getElementById('shoppingProjectId').value;

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/bom-items/${itemId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        window.showToast(result.message, 'success');
        fetchAndRenderBomItems(projectId);
    } catch (error) {
        window.showError(error.message);
    }
}

function formatCurrency(value) {
    if (value === null || value === undefined) return 'R$ 0,00';
    return parseFloat(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ==========================================================
// INÍCIO: NOVA SEÇÃO - PAINEL DE COTAÇÕES PARA AQUISIÇÕES
// ==========================================================



/**
 * Renderiza o card de item para o Painel de Cotações.
 * É muito semelhante ao renderBomItemCard, mas adaptado para a visão de Aquisições.
 */
window.createCotacaoCard = function(item, sectorColor) { 
    const card = document.createElement('div');
    card.className = `bom-item-card status-${item.status.toLowerCase().replace(/\s+/g, '-')} quotes-open`; 
    card.dataset.itemId = item.id;
    card.style.borderLeftColor = sectorColor;

    const imagemHtml = item.url_imagem 
        ? `<img src="${item.url_imagem}" alt="${item.descricao}">` 
        : '<i class="fas fa-image"></i>';

    let selecionadoHTML = '';
    if (item.status === 'Cotação Finalizada' && item.fornecedor_aprovado) {
        selecionadoHTML = `<p class="item-info" style="font-weight: bold; color: var(--success-color);">
            <i class="fas fa-certificate"></i> SELECIONADO: ${item.fornecedor_aprovado} - ${window.formatCurrency(item.valor_aprovado)}
        </p>`;
    }

    let orcamentos = [];
    try {
        orcamentos = Array.isArray(item.orcamentos) ? item.orcamentos : (item.orcamentos ? JSON.parse(item.orcamentos) : []);
    } catch (e) {
        orcamentos = [];
    }
    

    const quotesHtml = orcamentos.map((quote, index) => {
        const isSelected = item.status === 'Cotação Finalizada' && 
                           item.fornecedor_aprovado === quote.fornecedor && 
                           parseFloat(item.valor_aprovado).toFixed(2) === parseFloat(quote.valor_unitario).toFixed(2);
                           
        
        // CORREÇÃO: Define classes distintas para Sugestão (Index 0) e Novos Orçamentos (Index > 0)
        let quoteClass;
        if (isSelected) {
            quoteClass = 'quote-selected';
        } else if (index === 0) {
            // Orçamento inicial cadastrado com o item
            quoteClass = 'quote-color-suggestion'; 
        } else {
            // Novos orçamentos adicionados (index > 0)
            quoteClass = 'quote-color-new-quote'; 
        }
        
        // Adiciona a tag de sugestão APENAS ao primeiro orçamento
        const isOriginalSuggestion = index === 0;
        const suggestionTag = isOriginalSuggestion 
            ? '<span class="suggestion-tag" style="margin-right: 10px;">(Sugestão de Compra)</span>'
            : '';
        
        // Exibe a data de previsão de entrega, se existir
        const previsaoEntregaHtml = quote.data_previsao_entrega 
            ? `<strong>Previsão Entrega:</strong> ${quote.data_previsao_entrega}<br>` 
            : '';

        // ##### INÍCIO DA MODIFICAÇÃO (Novos campos de exibição) #####
        const cnpjHtml = quote.cnpj ? `<strong>CNPJ:</strong> ${quote.cnpj}<br>` : '';
        const enderecoHtml = quote.endereco ? `<strong>Endereço:</strong> ${quote.endereco}<br>` : '';
        const contatoHtml = quote.contato ? `<strong>Contato:</strong> ${quote.contato}<br>` : '';
        const emailHtml = quote.email ? `<strong>Email:</strong> ${quote.email}<br>` : '';
        // ##### FIM DA MODIFICAÇÃO #####

        return `
            <div class="quote-item-display ${quoteClass}" data-quote-index="${index}" style="${isSelected ? 'border-color: var(--success-color); background-color: #eaf6ec;' : ''}">
                <div class="quote-info-display">
                    <strong>Fornecedor:</strong> ${quote.fornecedor} ${suggestionTag}<br>
                    ${cnpjHtml}
                    ${enderecoHtml}
                    ${contatoHtml}
                    ${emailHtml}
                    <strong>Valor Unitário:</strong> ${window.formatCurrency(quote.valor_unitario)}<br>
                    ${previsaoEntregaHtml}  ${quote.link_produto ? `<strong>Link:</strong> <a href="${quote.link_produto}" target="_blank" rel="noopener noreferrer">Abrir Link</a>` : 'Link: N/A'}
                </div>
                
                <div class="quote-actions">
                    <button class="action-button secondary small" onclick="window.openEditQuoteModal(${item.id}, ${index}, true)" title="Editar Orçamento"><i class="fas fa-pencil-alt"></i></button>
                    <button class="action-button danger small" onclick="window.deleteQuote(event, ${item.id}, ${index}, true)" title="Excluir Orçamento"><i class="fas fa-trash-alt"></i></button>
                    
                    ${isSelected ? `
                        <span class="status-badge status-aprovado" style="background-color: var(--success-color);">SELECIONADO</span>
                    ` : `
                        <button class="action-button success small" onclick="window.selecionarOrcamento(${item.id}, ${index})" title="Marcar como orçamento final selecionado">
                            <i class="fas fa-check-double"></i> Selecionar
                        </button>
                    `}
                </div>
                
            </div>
        `;
    }).join('');

    // Formulário de adição de orçamento (mantido)
    // ##### INÍCIO DA CORREÇÃO (Adicionando form-group) #####
    const addQuoteFormHtml = `
        <div class="add-quote-form-container" data-item-id="${item.id}" style="display: none; margin-top: 15px; padding: 0 10px 15px 10px; border-top: 1px dashed var(--divider-color);">
            <form id="addQuoteForm-${item.id}" onsubmit="event.preventDefault(); window.handleAddNewQuote(event, ${item.id}, true)">
                <h4>Adicionar Novo Orçamento</h4>
                <div class="form-row" style="display: flex; gap: 10px;">
                    <input type="text" placeholder="Fornecedor" class="quote-fornecedor-input form-control" required>
                    <input type="number" placeholder="Valor Unitário (R$)" class="quote-valor-input form-control" required step="0.01" min="0">
                </div>
                
                <div class="form-row" style="display: flex; gap: 10px;">
                    <input type="text" placeholder="CNPJ" class="quote-cnpj-input form-control">
                    <input type="text" placeholder="Contato (Telefone)" class="quote-contato-input form-control">
                </div>
                
                <div class="form-group">
                    <input type="email" placeholder="Email" class="quote-email-input form-control">
                </div>
                <div class="form-group">
                    <input type="text" placeholder="Endereço" class="quote-endereco-input form-control">
                </div>

                <div class="form-group"> <label>Previsão de Entrega:</label>
                    <input type="date" class="quote-data-entrega-input form-control">
                </div>
                
                <div class="form-group">
                    <input type="text" placeholder="Link do Produto (Opcional)" class="quote-link-input form-control">
                </div>
                
                <button type="submit" class="action-button primary small" style="align-self: flex-end;"><i class="fas fa-plus"></i> Cadastrar Orçamento</button>
            </form>
        </div>
    `;
    // ##### FIM DA CORREÇÃO #####


    card.innerHTML = `
        <div class="bom-item-main-content">
            <div class="bom-item-image">${imagemHtml}</div>
            <div class="bom-item-details">
                <p class="item-descricao"><strong>${item.descricao}</strong></p>
                <p class="item-info"><strong>Projeto:</strong> ${item.nome_projeto} | <strong>Setor:</strong> ${item.setor}</p>
                <p class="item-info"><strong>Qtd:</strong> ${item.quantidade} | <strong>Justificativa:</strong> ${item.justificativa || 'N/A'}</p>
                ${selecionadoHTML}
                <div class="bom-item-status-badge status-${item.status.toLowerCase().replace(/ /g, '-')}">${item.status}</div>
            </div>
            
            <div class="bom-item-actions action-stack">
                <button class="action-button info small" onclick="window.openProjectDetailsModal(${item.projeto_id})"><i class="fas fa-info-circle"></i> Detalhes Projeto</button>
                
                ${item.status === 'Em Cotação' ? `
                    <button class="action-button success small" onclick="window.submitBomItemForApproval(${item.id})"><i class="fas fa-check-square"></i> Finalizar Cotação</button>
                    
                    <button class="action-button primary small add-quote-btn-quick" 
                            data-item-id="${item.id}" 
                            onclick="window.toggleQuickAddQuote(this)">
                        <i class="fas fa-plus"></i> Add Orçamento
                    </button>
                ` : ''}
            </div>

        </div>
        
        <div class="bom-item-quotes-container quotes-open" style="max-height: none; overflow: visible; padding: 0 10px 15px 10px; width: 100%; box-sizing: border-box;">
            <div class="quotes-list">${quotesHtml}</div>
            ${addQuoteFormHtml}
        </div>
    `;
    return card;
}

// NOVO: Função para o botão de ação rápida de adicionar orçamento
window.toggleQuickAddQuote = function(button) {
    const itemId = button.dataset.itemId;
    // Seleciona o container do formulário específico dentro do card do item
    const formContainer = document.querySelector(`.bom-item-card[data-item-id="${itemId}"] .add-quote-form-container`);
    
    if (formContainer) {
        const isCurrentlyHidden = formContainer.style.display === 'none';

        if (isCurrentlyHidden) {
            // MOSTRAR: Define como 'flex' para exibir o formulário e rola a tela
            formContainer.style.display = 'flex'; 
            
            formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const firstInput = formContainer.querySelector('input');
            if (firstInput) {
                firstInput.focus();
            }
            button.innerHTML = '<i class="fas fa-minus"></i> Fechar Orçamento';
            button.classList.remove('primary');
            button.classList.add('secondary');
            
        } else {
            // ESCONDER: Define como 'none' para ocultar
            formContainer.style.display = 'none';
            button.innerHTML = '<i class="fas fa-plus"></i> Add Orçamento';
            button.classList.remove('secondary');
            button.classList.add('primary');
        }
    }
};


/**
 * Busca e renderiza os itens que estão com o status 'Em Cotação' ou 'Cotação Finalizada'
 * no painel de cotações, agrupando-os por Projeto e Setor, com cores.
 */
window.fetchAndRenderCotacoes = async function() {
    const container = document.getElementById('cotacoesListContainer');
    if (!container) return; 

    // ***** INÍCIO DA CORREÇÃO *****
    // 1. Pega o ID do projeto que está aberto no modal.
    const currentProjectId = document.getElementById('shoppingProjectId').value;
    if (!currentProjectId) {
        container.innerHTML = '<p class="error-message">Erro: ID do projeto não encontrado.</p>';
        return;
    }
    // ***** FIM DA CORREÇÃO *****

    container.innerHTML = '<p class="loading-message"><i class="fas fa-spinner fa-spin"></i> Carregando itens para cotação...</p>';

    try {
        // A chamada à API continua a mesma, buscando todos os itens.
        const response = await window.authenticatedFetch(`${API_BASE_URL}/cotacoes`);
        if (!response.ok) throw new Error('Falha ao buscar itens para cotação.');
        
        const allItems = await response.json();
        
        // ***** INÍCIO DA CORREÇÃO *****
        // 2. Filtra a lista completa para manter apenas os itens do projeto atual.
        const items = allItems.filter(item => String(item.projeto_id) === String(currentProjectId));
        // ***** FIM DA CORREÇÃO *****
        
        container.innerHTML = '';
        if (items.length === 0) {
            container.innerHTML = '<p class="no-items-message">Nenhum item deste projeto aguardando cotação.</p>';
            return;
        }

        // O restante da lógica para agrupar por setor e renderizar os cards permanece o mesmo.
        const groupedBySector = items.reduce((acc, item) => {
            const sector = item.setor || 'Setor Não Classificado';
            if (!acc[sector]) {
                acc[sector] = [];
            }
            acc[sector].push(item);
            return acc;
        }, {});

        for (const sectorName in groupedBySector) {
            const sectorColor = SECTOR_COLORS[sectorName] || SECTOR_COLORS['Geral'];
            
            const sectorContainer = document.createElement('div');
            sectorContainer.className = 'cotacao-sector-subgroup';
            sectorContainer.style.borderLeft = `5px solid ${sectorColor}`;
            sectorContainer.innerHTML = `<h5 style="color: ${sectorColor};">Setor: ${sectorName}</h5>`;
            
            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'sector-items-container';

            groupedBySector[sectorName].forEach(item => {
                const itemCard = window.createCotacaoCard(item, sectorColor);
                itemsContainer.appendChild(itemCard);
            });
            
            sectorContainer.appendChild(itemsContainer);
            container.appendChild(sectorContainer);
        }
        
    } catch (error) {
        container.innerHTML = `<p class="error-message">Erro ao carregar itens: ${error.message}</p>`;
    }
};

/**
 * Rota que envia o orçamento selecionado para a API para marcar a compra.
 * (Função exportada no item 3 da última resposta)
 */
window.selecionarOrcamento = async function(itemId, quoteIndex) {
    // 1. Mensagem de confirmação atualizada
    if (!confirm("Tem certeza que deseja selecionar este orçamento? O item será enviado para a aprovação final da Diretoria.")) {
        return;
    }
    
    try {
        // A. Chama a API para registrar o orçamento selecionado
        // Esta rota é permitida para 'Compras' (acquisitions.manage)
        // e o backend já atualiza o status para 'Aguardando Aprovação Diretoria'
        const response = await window.authenticatedFetch(`${API_BASE_URL}/cotacoes/${itemId}/selecionar`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quoteIndex })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Falha ao selecionar o orçamento.');
        }

        // B. (REMOVIDO) O bloco que chamava /api/bom-items/:itemId/status foi removido
        // pois era redundante e causava o erro 403.
        
        // C. Mensagem de sucesso e recarga de painéis
        window.showToast("Orçamento selecionado! Item enviado para Aprovação da Diretoria.", 'success');
        
        // Recarrega os painéis relevantes
        window.fetchAndRenderCotacoes(); // Recarrega "Cotações" (onde você está)
        
        // Tenta recarregar os outros painéis caso o usuário tenha permissão para vê-los
        if (window.loadDirectorApprovalPanel) {
            window.loadDirectorApprovalPanel(); 
        }
        if (window.loadApprovalPanel) {
            window.loadApprovalPanel();
        }
        
        const projectId = document.getElementById('shoppingProjectId').value;
        if (projectId) {
            window.fetchAndRenderBomItems(projectId); // Recarrega "Meu Pedido" e "Status"
        }

    } catch (error) {
        window.showError(error.message);
    }
}

/**
 * Carrega e renderiza os itens que estão 'Aguardando Aprovação Diretoria'.
 */
window.loadFinancialApprovalPanel = async (currentProjectId = null) => {
    if (!currentProjectId) {
        currentProjectId = document.getElementById('shoppingProjectId').value;
    }
    
    const listContainer = document.getElementById('financialApprovalPanelContent');
    const countSpan = document.getElementById('financialApprovalCount');
    const countBadge = document.getElementById('financialApprovalCountBadge');
    
    listContainer.innerHTML = '<p class="loading-message"><i class="fas fa-spinner fa-spin"></i> Buscando itens...</p>';
    
    try {
        // Busca as solicitações filtrando pelo status do Financeiro
        const response = await window.authenticatedFetch(`${API_BASE_URL}/solicitacoes?status=Aguardando Aprovação Financeiro`);
        
        if (!response.ok) {
            throw new Error('Falha ao buscar itens para aprovação do Financeiro.');
        }
        
        const allSolicitacoes = await response.json();
        const solicitacoes = allSolicitacoes.filter(item => item.projeto_id == currentProjectId); 
        
        // Atualiza contadores
        countSpan.textContent = solicitacoes.length;
        if (countBadge) countBadge.textContent = solicitacoes.length;
        
        if (solicitacoes.length === 0) {
            listContainer.innerHTML = '<p class="no-items-message">Nenhuma solicitação aguardando aprovação para este projeto.</p>';
            return;
        }
        
        listContainer.innerHTML = ''; // Limpa antes de renderizar
        
        // CRÍTICO: Itera sobre as solicitações e renderiza o card usando a função auxiliar.
        solicitacoes.forEach(item => {
            // Reutiliza a função que monta o card de aprovação (já atualizada na resposta anterior)
            const card = createSolicitacaoCard(item); 
            listContainer.appendChild(card);
        });
        
    } catch (error) {
        
        countSpan.textContent = 'ERRO';
        listContainer.innerHTML = `<p class="error-message">Erro ao carregar painel.</p>`;
    }
};

window.loadDirectorApprovalPanel = async (currentProjectId = null) => {
    if (!currentProjectId) {
        currentProjectId = document.getElementById('shoppingProjectId').value;
    }
    
    const listContainer = document.getElementById('directorApprovalPanelContent');
    const countSpan = document.getElementById('directorApprovalCount');
    const countBadge = document.getElementById('directorApprovalCountBadge');
    
    listContainer.innerHTML = '<p class="loading-message"><i class="fas fa-spinner fa-spin"></i> Buscando itens...</p>';
    
    try {
        // Busca as solicitações filtrando pelo status da Diretoria
        const response = await window.authenticatedFetch(`${API_BASE_URL}/solicitacoes?status=Aguardando Aprovação Diretoria`);
        
        if (!response.ok) {
            throw new Error('Falha ao buscar itens para aprovação da Diretoria.');
        }
        
        const allSolicitacoes = await response.json();
        const solicitacoes = allSolicitacoes.filter(item => item.projeto_id == currentProjectId); 
        
        // Atualiza contadores
        countSpan.textContent = solicitacoes.length;
        if (countBadge) countBadge.textContent = solicitacoes.length;
        
        if (solicitacoes.length === 0) {
            listContainer.innerHTML = '<p class="no-items-message">Nenhum item aguardando aprovação final.</p>';
            return;
        }
        
        listContainer.innerHTML = ''; // Limpa antes de renderizar
        
        // CRÍTICO: Itera sobre as solicitações e renderiza o card usando a função auxiliar.
        solicitacoes.forEach(item => {
            // Reutiliza a função que monta o card de aprovação (já atualizada na resposta anterior)
            const card = createSolicitacaoCard(item); 
            listContainer.appendChild(card);
        });
        
    } catch (error) {
        
        countSpan.textContent = 'ERRO';
        listContainer.innerHTML = `<p class="error-message">Erro ao carregar painel.</p>`;
    }
};

/**
 * Processa a aprovação/reprovação da Diretoria (Aprovação Final)
 */
window.processFinancialAction = async (itemId, action) => {
    // Se aprovado, o item vai para 'Comprado'. Se reprovado, volta para 'Reprovado'.
    
    let endpoint = '';
    let confirmMessage = '';
    
    if (action === 'approve') {
        endpoint = `/solicitacoes/${itemId}/approve-financeiro`; // Rota do Financeiro (que envia para Comprado)
        confirmMessage = "Confirma a aprovação do FINANCEIRO? O item será alterado para 'Comprado' (Aprovação Final).";
    } else if (action === 'reprove') {
        endpoint = `/solicitacoes/${itemId}/reprove`; // Rota de Reprovação (que volta para Reprovado)
        confirmMessage = "Confirma a REPROVAÇÃO? O item voltará para o status 'Reprovado'.";
    } else {
        console.error("Ação desconhecida:", action);
        return;
    }

    if (!confirm(confirmMessage)) return;

    try {
        // Rota que altera o status do item
        const response = await window.authenticatedFetch(`${API_BASE_URL}${endpoint}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            // Não precisa de body para aprovação/reprovação simples
        });
        
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || `Falha ao ${action} o item.`);
        }

        window.showToast(result.message, 'success');
        
        // Recarrega os painéis relevantes
        const projectId = document.getElementById('shoppingProjectId').value;
        window.loadDirectorApprovalPanel(projectId); // Recarrega o painel da Diretoria (de onde o item saiu)
        window.loadFinancialApprovalPanel(projectId); // Recarrega o painel do Financeiro (para onde o item foi)
        window.loadFinalItemsPanel(); // Recarrega o painel Final
        window.fetchAndRenderProjects(); // Recarrega a lista de projetos
        
    } catch (error) {
        console.error(`Erro ao ${action} item de BOM ID ${itemId} (Financeiro):`, error);
        window.showError(error.message || `Erro ao ${action} o item.`);
    }
};

window.processDirectorAction = async (itemId, action) => {
    // Se aprovado, o item vai para 'Aguardando Aprovação Financeiro'. Se reprovado, volta para 'Reprovado'.
    
    let endpoint = '';
    let confirmMessage = '';
    
    if (action === 'approve') {
        endpoint = `/solicitacoes/${itemId}/approve-final`; // Rota da Diretoria (que envia para o Financeiro)
        confirmMessage = "Confirma a aprovação da DIRETORIA? O item será enviado para 'Aguardando Aprovação Financeiro'.";
    } else if (action === 'reprove') {
        endpoint = `/solicitacoes/${itemId}/reprove`; // Rota de Reprovação (que volta para Reprovado)
        confirmMessage = "Confirma a REPROVAÇÃO? O item voltará para o status 'Reprovado'.";
    } else {
        console.error("Ação desconhecida:", action);
        return;
    }

    if (!confirm(confirmMessage)) return;

    try {
        // Rota que altera o status do item
        const response = await window.authenticatedFetch(`${API_BASE_URL}${endpoint}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            // Não precisa de body para aprovação/reprovação simples
        });
        
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || `Falha ao ${action} o item.`);
        }
        
        window.showToast(result.message, 'success');
        
        // Recarrega os painéis afetados
        const projectId = document.getElementById('shoppingProjectId').value; // Movido para cima
        window.loadDirectorApprovalPanel(); 
        
        // ##### INÍCIO DA MODIFICAÇÃO #####
        // Esta linha recarrega a aba "Aprovação Final"
        window.loadFinalItemsPanel(projectId); 
        // ##### FIM DA MODIFICAÇÃO #####
        
        window.fetchAndRenderCotacoes(); 
        window.fetchAndRenderBomItems(projectId);

    } catch (error) {
        window.showError(error.message);
    }
}

// ==========================================================
// FIM: NOVO PAINEL - COTAÇÕES PARA AQUISIÇÕES
// ==========================================================

// ==========================================================
// INÍCIO: FUNÇÃO DE TROCA DE PAINEL ATUALIZADA
// ==========================================================
// Atualiza a função principal de troca de painel (switchShoppingPanel)
window.switchShoppingPanel = async function(panelId) {
    const projectId = document.getElementById('shoppingProjectId').value;
    
    // 1. Remove 'active' de todos os botões de aba
    document.querySelectorAll('.shopping-panel-tabs .tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 2. Remove 'active' de todo o conteúdo das abas
    document.querySelectorAll('.shopping-panel-wrapper .tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // 3. Adiciona 'active' ao botão e ao conteúdo do painel selecionado
    const selectedButton = document.getElementById(panelId + 'TabButton');
    const selectedContent = document.getElementById(panelId);
    
    if (selectedButton) {
        selectedButton.classList.add('active');
    }
    if (selectedContent) {
        selectedContent.classList.add('active');
    }
    
    // 4. CRÍTICO: Carrega os dados da aba selecionada (Refatorado com Dispatch Map)
    // Este objeto substitui toda a cadeia 'if/else if', removendo o aviso do VSCode
    // e tornando o código mais fácil de manter.
    const panelLoaders = {
        'liderApprovalPanel': () => window.loadApprovalPanel(projectId, 'Aguardando Aprovação Líder', 'liderApprovalPanelContent'),
        'approvalPanel': () => window.loadApprovalPanel(projectId),
        'cotacoesPanel': () => window.fetchAndRenderCotacoes(), // Não usava projectId no original
        'directorApprovalPanel': () => window.loadDirectorApprovalPanel(projectId),
        'finalItemsPanel': () => window.loadFinalItemsPanel(projectId),
        'myShoppingPanel': () => window.fetchAndRenderBomItems(projectId),
        'sentItemsPanel': () => window.loadSentItemsPanel(projectId)
    };

    // Encontra a função de carregamento correspondente ao panelId
    const loadFunction = panelLoaders[panelId];

    if (loadFunction) {
        // Se a função existir, ela é executada
        await loadFunction();
    } else {
        // Opcional: Avisa no console se um painel for clicado mas não tiver uma função definida
        console.warn(`Função de carregamento não definida para o painel: ${panelId}`);
    }
    
    // 5. Aplica permissões UI para a aba recém-aberta
    if (window.applyUIPermissions && window.getCurrentUser) {
        window.applyUIPermissions(window.getCurrentUser()?.role);
    }
};

/**
 * Carrega e renderiza a lista de itens de BOM que estão 'Comprado'.
 * @param {number} currentProjectId - O ID do projeto atualmente selecionado no modal.
 */
window.loadFinalItemsPanel = async (currentProjectId = null) => {
    if (!currentProjectId) {
        currentProjectId = document.getElementById('shoppingProjectId').value;
    }
    
    const listContainer = document.getElementById('finalItemsListContainer');
    const countBadge = document.getElementById('finalItemsCountBadge');
    
    const panel = document.getElementById('finalItemsPanel');
    if (!panel || !listContainer || !countBadge) {
        console.error("Elementos do 'Painel de Aprovação Final' não encontrados.");
        return;
    }
    const header = panel.querySelector('.approval-header-info'); // Acha o cabeçalho
    
    // Procura pelos botões que ESTÃO NO SEU NOVO INDEX.HTML
    const pdfBtn = document.getElementById('downloadFinalItemsPdfBtn');
    const xlsxBtn = document.getElementById('downloadFinalItemsXlsxBtn'); 

    // Esconde botões por padrão
    if(pdfBtn) pdfBtn.style.display = 'none';
    if(xlsxBtn) xlsxBtn.style.display = 'none';

    listContainer.innerHTML = '<p class="loading-message"><i class="fas fa-spinner fa-spin"></i> Buscando itens comprados...</p>';
    
    try {
        // Busca as solicitações filtrando pelo status "Comprado"
        const response = await window.authenticatedFetch(`${API_BASE_URL}/solicitacoes?status=Comprado`);
        
        if (!response.ok) {
            throw new Error('Falha ao buscar itens com aprovação final.');
        }
        
        const allSolicitacoes = await response.json();
        const solicitacoes = allSolicitacoes.filter(item => item.projeto_id == currentProjectId); 
        
        // Atualiza contador
        countBadge.textContent = solicitacoes.length;
        
        if (solicitacoes.length === 0) {
            listContainer.innerHTML = '<p class="no-items-message">Nenhum item com aprovação final (Comprado) para este projeto.</p>';
            if(pdfBtn) pdfBtn.style.display = 'none';
            if(xlsxBtn) xlsxBtn.style.display = 'none';
            return;
        }

        // Agrupa por setor
        const groupedBySector = solicitacoes.reduce((acc, item) => {
            const sector = item.setor || 'Geral';
            if (!acc[sector]) {
                acc[sector] = [];
            }
            acc[sector].push(item);
            return acc;
        }, {});

        // Mostra os botões e anexa os eventos
        if(pdfBtn) {
            pdfBtn.style.display = 'inline-flex';
            pdfBtn.onclick = () => generateFinalReportPDF(groupedBySector, solicitacoes);
        }
        if(xlsxBtn) {
            xlsxBtn.style.display = 'inline-flex';
            xlsxBtn.onclick = () => generateFinalReportXLSX(groupedBySector, solicitacoes);
        }

        listContainer.innerHTML = ''; // Limpa antes de renderizar
        
        for (const sector in groupedBySector) {
            const sectorGroup = document.createElement('div');
            sectorGroup.className = 'approval-sector-group'; // Reutiliza o estilo
            sectorGroup.dataset.sector = sector;

            const header = document.createElement('div');
            header.className = 'approval-sector-header';
            header.innerHTML = `<h4>Setor: ${sector} (${groupedBySector[sector].length} itens)</h4>`;
            sectorGroup.appendChild(header);

            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'approval-items-container';

            groupedBySector[sector].forEach(item => {
                // Reutiliza a função que monta o card de solicitação
                // Ela já lida com os status 'Comprado' (apenas esconde os botões)
                const card = createSolicitacaoCard(item); 
                itemsContainer.appendChild(card);
            });
            
            sectorGroup.appendChild(itemsContainer);
            listContainer.appendChild(sectorGroup);
        }
        
    } catch (error) {
        
        countBadge.textContent = '0';
        listContainer.innerHTML = `<p class="error-message">Erro ao carregar painel.</p>`;
        if(pdfBtn) pdfBtn.style.display = 'none';
        if(xlsxBtn) xlsxBtn.style.display = 'none';
    }
};
// ==========================================================
// FIM: FUNÇÃO DE TROCA DE PAINEL ATUALIZADA
// ==========================================================

/**
 * NOVA FUNÇÃO: Gera um HTML para impressão (PDF) dos itens aprovados, agrupados por setor.
 * @param {object} groupedData - Os itens agrupados por setor.
 * @param {Array} items - A lista total de itens (para obter o nome do projeto).
 */
function generateFinalReportPDF(groupedData, items) {
    const projectName = items.length > 0 ? items[0].nome_projeto : 'Relatório';
    
    let htmlContent = `
        <html>
        <head>
            <title>Relatório de Itens Aprovados - ${projectName}</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.5; }
                h1 { color: #007bff; border-bottom: 2px solid #007bff; padding-bottom: 5px; }
                h2 { background-color: #f0f0f0; padding: 10px; border-radius: 5px; margin-top: 25px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #ccc; padding: 8px; text-align: left; word-break: break-word; vertical-align: middle; }
                th { background-color: #e9ecef; }
                tr:nth-child(even) { background-color: #f8f9fa; }
                .currency { text-align: right; }
                .total-row { font-weight: bold; background-color: #dee2e6; }
                .total-row .currency { color: #007bff; }
                img { max-width: 60px; max-height: 60px; object-fit: contain; border-radius: 4px; }
                a { color: #0000EE; text-decoration: none; }
                .no-wrap { white-space: nowrap; }
                td:nth-child(2), td:nth-child(4) { text-align: center; }
                @page { size: A4 landscape; margin: 20mm; }
                @media print {
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    h1, h2, th { color: #000 !important; }
                    a { text-decoration: none; color: #0000EE !important; }
                }
            </style>
        </head>
        <body>
            <h1>Relatório de Itens Aprovados (Status: Comprado)</h1>
            <p><strong>Projeto:</strong> ${projectName}</p>
    `;

    let totalGeral = 0;

    for (const sector in groupedData) {
        htmlContent += `<h2>Setor: ${sector}</h2>`;
        htmlContent += `
            <table>
                <thead>
                    <tr>
                        <th style="width: 5%;">ID</th>
                        <th style="width: 10%;">Imagem</th>
                        <th style="width: 30%;">Descrição</th>
                        <th style="width: 5%;">Qtd.</th>
                        <th style="width: 20%;">Fornecedor Aprovado</th>
                        <th style="width: 10%;">Valor Unit.</th>
                        <th style="width: 10%;">Valor Total</th>
                        <th style="width: 10%;">Link</th>
                    </tr>
                </thead>
                <tbody>
        `;
        let totalSetor = 0;
        groupedData[sector].forEach(item => {
            const valorUnit = parseFloat(item.valor_aprovado) || 0;
            const valorTotal = parseFloat(item.valor_total_item) || (valorUnit * item.quantidade);
            totalSetor += valorTotal;

            const imagemHtml = item.url_imagem 
                ? `<img src="${item.url_imagem}" alt="${item.descricao}">` 
                : 'N/A';
            
            const linkHtml = item.link_produto 
                ? `<a href="${item.link_produto}" target="_blank">Abrir Link</a>`
                : 'N/A';

            htmlContent += `
                <tr>
                    <td>${item.id}</td>
                    <td>${imagemHtml}</td>
                    <td>${item.descricao}</td>
                    <td>${item.quantidade}</td>
                    <td>${item.fornecedor_aprovado || 'N/A'}</td>
                    <td class="currency">${window.formatCurrency(valorUnit)}</td>
                    <td class="currency">${window.formatCurrency(valorTotal)}</td>
                    <td class="no-wrap">${linkHtml}</td>
                </tr>
            `;
        });

        htmlContent += `
                <tr class="total-row">
                    <td colspan="7">Total do Setor</td>
                    <td class="currency">${window.formatCurrency(totalSetor)}</td>
                </tr>
            </tbody>
            </table>
        `;
        totalGeral += totalSetor;
    }

    htmlContent += `
        <h2 style="margin-top: 30px; background-color: #343a40; color: white !important; text-align: right; padding-right: 20px;">
            Total Geral Aprovado: ${window.formatCurrency(totalGeral)}
        </h2>
        </body></html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
    }, 500);
}


/**
 * NOVA FUNÇÃO: Gera um arquivo XLSX (Excel) dos itens aprovados, agrupados por setor.
 * @param {object} groupedData - Os itens agrupados por setor.
 * @param {Array} items - A lista total de itens (para obter o nome do projeto).
 */
async function generateFinalReportXLSX(groupedData, items) {
    const projectName = items.length > 0 ? items[0].nome_projeto : 'Relatório';
    
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DashboardDelta';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Aprovação Final');

    worksheet.mergeCells('A1:H1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `Relatório de Itens Aprovados (Comprado) - Projeto: ${projectName}`;
    titleCell.font = { size: 16, bold: true, color: { argb: 'FF007BFF' } };
    titleCell.alignment = { horizontal: 'center' };
    worksheet.addRow([]); 

    worksheet.columns = [
        { header: 'ID Item', key: 'id', width: 10 },
        { header: 'Setor', key: 'setor', width: 25 },
        { header: 'Descrição', key: 'descricao', width: 60 },
        { header: 'Qtd.', key: 'quantidade', width: 10, style: { numFmt: '#,##0.00' } },
        { header: 'Fornecedor Aprovado', key: 'fornecedor', width: 35 },
        { header: 'Valor Unitário', key: 'valorUnit', width: 20, style: { numFmt: '"R$ "#,##0.00' } },
        { header: 'Valor Total', key: 'valorTotal', width: 20, style: { numFmt: '"R$ "#,##0.00' } },
        { header: 'Link', key: 'link', width: 40 },
    ];
    
    worksheet.getRow(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(3).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF007BFF' } 
    };

    let totalGeral = 0;

    for (const sector in groupedData) {
        worksheet.addRow({ id: `Setor: ${sector}` });
        const sectorRow = worksheet.lastRow;
        sectorRow.font = { bold: true, size: 14, color: { argb: 'FF0056b3' } }; 
        worksheet.mergeCells(`A${sectorRow.number}:H${sectorRow.number}`);
        
        let totalSetor = 0;
        
        groupedData[sector].forEach(item => {
            const valorUnit = parseFloat(item.valor_aprovado) || 0;
            const valorTotal = parseFloat(item.valor_total_item) || (valorUnit * item.quantidade);
            totalSetor += valorTotal;

            worksheet.addRow({
                id: item.id,
                setor: item.setor,
                descricao: item.descricao,
                quantidade: item.quantidade,
                fornecedor: item.fornecedor_aprovado || 'N/A',
                valorUnit: valorUnit,
                valorTotal: valorTotal,
                link: item.link_produto || ''
            });
            
            const linkCell = worksheet.lastRow.getCell('link');
            if (item.link_produto) {
                linkCell.value = { text: 'Abrir Link', hyperlink: item.link_produto };
                linkCell.font = { color: { argb: 'FF0000EE' }, underline: true };
            }
        });

        worksheet.addRow({
            descricao: `Total Setor (${sector})`,
            valorTotal: totalSetor
        });
        const totalSetorRow = worksheet.lastRow;
        totalSetorRow.font = { bold: true };
        totalSetorRow.getCell('G').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9ECEF' } };
        totalSetorRow.getCell('F').value = 'Total do Setor:';
        totalSetorRow.getCell('F').alignment = { horizontal: 'right' };
        worksheet.mergeCells(`A${totalSetorRow.number}:F${totalSetorRow.number}`);
        
        totalGeral += totalSetor;
    }
    
    worksheet.addRow([]);
    worksheet.addRow({
        descricao: 'TOTAL GERAL APROVADO',
        valorTotal: totalGeral
    });
    const totalGeralRow = worksheet.lastRow;
    totalGeralRow.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    totalGeralRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF343A40' } }; 
    totalGeralRow.getCell('G').alignment = { horizontal: 'left' };
    totalGeralRow.getCell('F').value = 'TOTAL GERAL APROVADO:';
    totalGeralRow.getCell('F').alignment = { horizontal: 'right' };
    worksheet.mergeCells(`A${totalGeralRow.number}:F${totalGeralRow.number}`);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Relatorio_Aprovacao_Final_${projectName.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link); 
    URL.revokeObjectURL(link.href);
    
    window.showToast("Relatório XLSX baixado!", "success");
}

// ==========================================================
// INÍCIO: RESTANTE DAS FUNÇÕES DE COTAÇÃO/AQUISIÇÃO
// ==========================================================

/**
 * Abre o modal para editar um orçamento específico.
 * @param {number} itemId - O ID do item da BOM.
 * @param {number} quoteIndex - O índice do orçamento no array.
 * @param {boolean} isCotacoesPanel - Flag para saber qual painel recarregar.
 */
window.openEditQuoteModal = async function(itemId, quoteIndex, isCotacoesPanel = false) {
    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/bom-items/${itemId}/details`);
        if (!response.ok) throw new Error("Não foi possível buscar os detalhes do item.");
        const item = await response.json();
        
        const index = parseInt(quoteIndex);
        const quote = item.orcamentos[index];
        
        if (!quote) {
            window.showError("Orçamento não encontrado. A lista pode ter sido atualizada.");
            return;
        }

        document.getElementById('editQuoteItemId').value = itemId;
        document.getElementById('editQuoteIndex').value = index;
        document.getElementById('editQuoteFornecedor').value = quote.fornecedor;
        document.getElementById('editQuoteValor').value = parseFloat(quote.valor_unitario).toFixed(2);
        document.getElementById('editQuoteLink').value = quote.link_produto || '';

        // ##### INÍCIO DA ADIÇÃO #####
        document.getElementById('editQuoteCnpj').value = quote.cnpj || '';
        document.getElementById('editQuoteEndereco').value = quote.endereco || '';
        document.getElementById('editQuoteContato').value = quote.contato || '';
        document.getElementById('editQuoteEmail').value = quote.email || '';
        // ##### FIM DA ADIÇÃO #####

        // NOVO: Preenche a data de previsão de entrega
        const dataEntregaInput = document.getElementById('editQuoteDataEntrega');
        if (dataEntregaInput) {
            if (quote.data_previsao_entrega) {
                // Converte DD/MM/YYYY (do banco) para YYYY-MM-DD (do input type="date")
                const parts = quote.data_previsao_entrega.split('/'); 
                if (parts.length === 3) {
                    dataEntregaInput.value = `${parts[2]}-${parts[1]}-${parts[0]}`; 
                }
            } else {
                dataEntregaInput.value = ''; // Limpa se não houver data
            }
        }

        const form = document.getElementById('editQuoteForm');
        form.onsubmit = (event) => window.handleEditQuoteSubmit(event, isCotacoesPanel);

        window.openModal('editQuoteModal');

    } catch (error) {
        window.showError(error.message);
    }
}

/**
 * Manipula a submissão do formulário de edição de orçamento.
 * @param {Event} event - O evento de submissão do formulário.
 * @param {boolean} isCotacoesPanel - Flag para saber qual painel recarregar.
 */
window.handleEditQuoteSubmit = async function(event, isCotacoesPanel) {
    event.preventDefault();
    const itemId = document.getElementById('editQuoteItemId').value;
    const quoteIndex = document.getElementById('editQuoteIndex').value;
    
    // NOVO: Captura o valor do campo de data (YYYY-MM-DD)
    const rawDataEntrega = document.getElementById('editQuoteDataEntrega').value;
    
    // Converte para o formato DD/MM/YYYY para armazenar no JSON
    const dataEntregaFormatada = rawDataEntrega ? window.formatDateForDB(rawDataEntrega) : null;
    
    const updatedQuote = {
        fornecedor: document.getElementById('editQuoteFornecedor').value,
        valor_unitario: document.getElementById('editQuoteValor').value,
        link_produto: document.getElementById('editQuoteLink').value,
        // NOVO: Adiciona a previsão de entrega na payload
        data_previsao_entrega: dataEntregaFormatada,

        // ##### INÍCIO DA ADIÇÃO #####
        cnpj: document.getElementById('editQuoteCnpj').value,
        endereco: document.getElementById('editQuoteEndereco').value,
        contato: document.getElementById('editQuoteContato').value,
        email: document.getElementById('editQuoteEmail').value
        // ##### FIM DA ADIÇÃO #####
    };

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/bom-items/${itemId}/quotes/${quoteIndex}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedQuote)
        });
        const result = await response.json();
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido ao atualizar orçamento.' }));
            throw new Error(errorData.error || 'Falha ao atualizar orçamento.');
        }

        window.showToast(result.message, 'success');
        window.closeModal('editQuoteModal');

        if (isCotacoesPanel) {
            window.fetchAndRenderCotacoes();
        } else {
            window.fetchAndRenderBomItems(document.getElementById('shoppingProjectId').value);
        }

    } catch (error) {
        window.showError(error.message);
    }
}

/**
 * Exclui um orçamento de um item, removendo-o da tela imediatamente.
 * @param {Event} event - O evento de clique do mouse.
 * @param {number} itemId - O ID do item da BOM.
 * @param {number} quoteIndex - O índice do orçamento no array.
 * @param {boolean} isCotacoesPanel - Flag para saber se a ação veio do painel de cotações.
 */
window.deleteQuote = async function(event, itemId, quoteIndex, isCotacoesPanel = false) {
    if (!confirm("Tem certeza que deseja excluir este orçamento?")) {
        return;
    }

    const button = event.currentTarget;
    const quoteElement = button.closest('.quote-item-display');

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/bom-items/${itemId}/quotes/${quoteIndex}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido ao excluir orçamento.' }));
            throw new Error(errorData.error || 'Falha ao excluir orçamento.');
        }

        window.showToast(result.message, 'success');
        
        // Remove o elemento do orçamento da tela
        if (quoteElement) {
            quoteElement.remove();
        }
        
        if (isCotacoesPanel) {
            window.fetchAndRenderCotacoes();
        } else {
            // Recarrega a lista de elaboração para sincronizar
            window.fetchAndRenderBomItems(document.getElementById('shoppingProjectId').value);
        }

    } catch (error) {
        window.showError(error.message);
    }
}

/**
 * Funções auxiliares para delegar a ação individual ao processador central.
 * Estes são os event handlers dos botões 'Aprovar' e 'Reprovar' individuais.
 */
window.aprovarSolicitacao = async function(itemId) {
    if (!confirm("Aprovar esta solicitação? O item será movido para cotação e uma sub-etapa de compra será criada.")) return;
    
    // Chama a função central de processamento
    await window.processApprovalAction(itemId, 'approve'); 
}

window.reprovarSolicitacao = async function(itemId) {
    if (!confirm("Reprovar esta solicitação?")) return;
    
    // Chama a função central de processamento
    await window.processApprovalAction(itemId, 'reprove'); 
}



// ===============================================
// Funções para Gerenciamento de Atividades (NOVO)
// ===============================================

window.openProjectActivitiesModal = async function(projectId, projectName) {
    

    const activitiesProjectNameSpan = document.getElementById('projectActivitiesProjectName');
    const activitiesProjectIdInput = document.getElementById('projectActivitiesProjectId');
    const addActivityForm = document.getElementById('addProjectActivityForm');
    const editActivityForm = document.getElementById('editProjectActivityForm');

    if (!activitiesProjectNameSpan || !activitiesProjectIdInput || !addActivityForm || !editActivityForm) {
        console.error('project-status.js: Elementos essenciais do modal de atividades não encontrados!');
        window.showError('Erro ao abrir o modal de atividades. Elementos não encontrados.');
        return;
    }

    activitiesProjectNameSpan.textContent = projectName;
    activitiesProjectIdInput.value = projectId;

    addActivityForm.removeEventListener('submit', addProjectActivity);
    addActivityForm.addEventListener('submit', addProjectActivity);
    
    editActivityForm.removeEventListener('submit', editProjectActivity);
    editActivityForm.addEventListener('submit', editProjectActivity);

    await fetchProjectActivities(projectId);

    addActivityForm.reset();

    window.openModal('projectActivitiesModal');
    window.applyUIPermissions(window.getCurrentUser()?.role);
};

async function fetchProjectActivities(projectId) {
    
    const projectActivitiesList = document.getElementById('projectActivitiesList');
    if (!projectActivitiesList) {
        console.error('project-status.js: Elemento projectActivitiesList não encontrado para exibir atividades.');
        return;
    }
    projectActivitiesList.innerHTML = '<p class="no-activities">Carregando atividades...</p>';

    if (!projectId || isNaN(parseInt(projectId))) {
        console.error('project-status.js: ID do projeto inválido:', projectId);
        projectActivitiesList.innerHTML = '<p class="no-activities" style="color:red;">Erro: ID do projeto não é válido. Tente novamente.</p>';
        window.showError('Erro ao carregar atividades: ID do projeto é inválido.');
        return;
    }

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}/atividades`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao buscar atividades do projeto. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao buscar atividades do projeto.');
        }
        const activities = await response.json();
        

        projectActivitiesList.innerHTML = '';
        if (activities.length === 0) {
            projectActivitiesList.innerHTML = '<p class="no-activities">Nenhuma atividade registrada para este projeto.</p>';
        } else {
            activities.forEach(activity => {
                projectActivitiesList.appendChild(createProjectActivityElement(activity));
            });
        }
        if (window.applyUIPermissions && window.getCurrentUser) {
            window.applyUIPermissions(window.getCurrentUser()?.role);
        }
    } catch (error) {
        
        projectActivitiesList.innerHTML = '<p class="no-activities" style="color:red;">Erro ao carregar atividades. Tente novamente.</p>';
        window.showError('Erro ao carregar atividades: ' + error.message);
    }
}

function createProjectActivityElement(activity) {
    const div = document.createElement('div');
    div.className = 'activity-item';
    div.dataset.activityId = activity.id;

    let statusClass = '';
    let statusText = activity.concluida ? 'Concluído' : 'Pendente';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let isDelayed = false;

    if (!activity.concluida && activity.data_limite) {
        const dueDate = new Date(activity.data_limite);
        dueDate.setHours(0, 0, 0, 0);
        if (dueDate < today) {
            isDelayed = true;
            statusText = 'Atrasado';
        }
    }

    if (activity.concluida) {
        statusClass = 'status-concluido';
    } else if (isDelayed) {
        statusClass = 'status-atrasado';
    } else {
        statusClass = 'status-pendente';
    }

    const completionDateHtml = activity.data_conclusao ?
        `<br><span>Concluído em: ${window.formatDate(activity.data_conclusao)}</span>` : '';
    
    div.innerHTML = `
        <div class="activity-info">
            <span class="activity-name"><strong>${activity.descricao}</strong></span>
            <span>Data Limite: ${window.formatDate(activity.data_limite)}</span>
            <span>Status: <span class="activity-status-text ${statusClass}">${statusText}</span></span>
            ${completionDateHtml}
        </div>
        <div class="activity-actions">
            <button class="action-button secondary small edit-activity-btn" data-activity-id="${activity.id}">
                <i class="fas fa-pencil-alt"></i>
            </button>
            <button class="action-button danger small delete-activity-btn" data-activity-id="${activity.id}">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `;

    div.querySelector('.edit-activity-btn').addEventListener('click', () => window.openEditProjectActivityModal(activity.id));
    div.querySelector('.delete-activity-btn').addEventListener('click', () => window.deleteProjectActivity(activity.id));
    
    return div;
}

async function addProjectActivity(event) {
    event.preventDefault();
    const projectId = document.getElementById('projectActivitiesProjectId').value;
    const description = document.getElementById('activityDescription').value.trim();
    const dueDate = document.getElementById('activityDueDate').value;

    if (!description || !dueDate) {
        window.showError('Descrição e data limite da atividade são obrigatórios.');
        return;
    }

    const activityData = {
        descricao: description,
        data_limite: dueDate
    };

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}/atividades`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(activityData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao adicionar atividade. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao adicionar atividade.');
        }

        const result = await response.json();
        window.showToast(result.message || 'Atividade adicionada com sucesso!', 'success');
        event.target.reset();
        window.fetchProjectActivities(projectId);
    } catch (error) {
        
        window.showError('Erro ao adicionar atividade: ' + error.message);
    }
}

window.openEditProjectActivityModal = async function(activityId) {
    

    const modal = document.getElementById('editProjectActivityModal');
    const idInput = document.getElementById('editProjectActivityId');
    const descriptionInput = document.getElementById('editActivityDescription');
    const dueDateInput = document.getElementById('editActivityDueDate');
    const editForm = document.getElementById('editProjectActivityForm');

    if (!modal || !idInput || !descriptionInput || !dueDateInput || !editForm) {
        console.error('project-status.js: Elementos do modal de edição de atividade não encontrados!');
        window.showError('Erro ao abrir o modal de edição. Elementos não encontrados.');
        return;
    }

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/atividades/${activityId}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao buscar dados da atividade. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao buscar dados da atividade.');
        }
        const activity = await response.json();
        
        

        idInput.value = activity.id;
        descriptionInput.value = activity.descricao || '';
        dueDateInput.value = activity.data_limite || '';

        window.openModal('editProjectActivityModal');
        editForm.onsubmit = null;
        editForm.onsubmit = async (event) => {
            event.preventDefault();
            await window.editProjectActivity(event);
        };
        if (window.applyUIPermissions && window.getCurrentUser) {
            window.applyUIPermissions(window.getCurrentUser()?.role);
        }
    } catch (error) {
        
        window.showError('Erro ao carregar dados para edição: ' + error.message);
    }
};

async function editProjectActivity(event) {
    event.preventDefault();
    

    const activityId = document.getElementById('editProjectActivityId').value;
    const projectId = document.getElementById('projectActivitiesProjectId').value;
    const description = document.getElementById('editActivityDescription').value.trim();
    const dueDate = document.getElementById('editActivityDueDate').value;

    if (!description || !dueDate) {
        window.showError('Descrição e data limite da atividade são obrigatórios.');
        return;
    }

    const activityData = {
        descricao: description,
        data_limite: dueDate
    };

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/atividades/${activityId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(activityData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao salvar alterações da atividade. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao salvar alterações.');
        }

        const result = await response.json();
        window.showToast(result.message || 'Alterações salvas com sucesso!', 'success');
        window.closeModal('editProjectActivityModal');
        window.fetchProjectActivities(projectId);
    } catch (error) {
        
        window.showError('Erro ao salvar alterações: ' + error.message);
    }
}

window.deleteProjectActivity = async function(activityId) {
    
    const projectIdForRefresh = document.getElementById('projectActivitiesProjectId').value;

    if (!confirm('Tem certeza que deseja excluir esta atividade?')) {
        return;
    }

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/atividades/${activityId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro ao excluir atividade. Resposta não-JSON.' }));
            throw new Error(errorData.error || 'Erro ao excluir atividade.');
        }

        const result = await response.json();
        window.showToast(result.message || 'Atividade excluída com sucesso!', 'success');
        window.fetchProjectActivities(projectIdForRefresh);
    } catch (error) {
        
        window.showError('Erro ao excluir atividade: ' + error.message);
    }
};

// ===============================================
// INÍCIO: LISTENERS DE EVENTO GLOBAIS
// ===============================================
document.addEventListener('DOMContentLoaded', function() {
    

    // Listeners para a busca e atualização de projetos
    const projectSearchInput = document.getElementById('projectSearchInput');
    if (projectSearchInput) {
        projectSearchInput.addEventListener('input', () => window.fetchProjects(projectSearchInput.value));
    }

    const searchProjectsBtn = document.getElementById('searchProjectsBtn');
    if (searchProjectsBtn) {
        searchProjectsBtn.addEventListener('click', () => window.fetchProjects(document.getElementById('projectSearchInput').value));
    }

    const refreshProjectsBtn = document.getElementById('refreshProjects');
    if (refreshProjectsBtn) {
        refreshProjectsBtn.addEventListener('click', () => {
            if (projectSearchInput) projectSearchInput.value = '';
            window.fetchProjects('');
        });
    }

    const showEncerradosCheckbox = document.getElementById('showEncerradosCheckbox');
    if (showEncerradosCheckbox) {
        showEncerradosCheckbox.addEventListener('change', () => window.fetchProjects(document.getElementById('projectSearchInput').value));
    }

    // Listeners para o formulário de peças do projeto
    const addProjectPartForm = document.getElementById('addProjectPartForm');
    if (addProjectPartForm) {
        addProjectPartForm.addEventListener('submit', window.addProjectPart);
    }

    // Listeners para anexos de peças
    const fileAttachmentInput = document.getElementById('fileAttachmentInput');
    const uploadAttachmentBtn = document.getElementById('uploadAttachmentBtn');
    if (fileAttachmentInput && uploadAttachmentBtn) {
        fileAttachmentInput.addEventListener('change', () => {
            uploadAttachmentBtn.style.display = fileAttachmentInput.files.length > 0 ? 'inline-block' : 'none';
        });
        uploadAttachmentBtn.addEventListener('click', window.uploadAttachment);
    }

    
});

function setupDragAndDrop(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let dragSrcEl = null;

    function handleDragStart(e) {
        const draggedElement = e.target.closest('.drag-item');
        if (!draggedElement) return;

        draggedElement.style.opacity = '0.4';
        dragSrcEl = draggedElement;

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', draggedElement.innerHTML);
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const targetElement = e.target.closest('.drag-item');
        if (targetElement && targetElement !== dragSrcEl) {
            const container = targetElement.parentElement;
            const boundingBox = targetElement.getBoundingClientRect();
            const offset = boundingBox.y + (boundingBox.height / 2);

            if (e.clientY > offset) {
                container.insertBefore(dragSrcEl, targetElement.nextSibling);
            } else {
                container.insertBefore(dragSrcEl, targetElement);
            }
        }
        return false;
    }

    function handleDragEnter(e) {
        e.preventDefault();
        this.classList.add('over');
    }

    function handleDragLeave(e) {
        this.classList.remove('over');
    }

    function handleDrop(e) {
        e.stopPropagation();
        e.preventDefault();
        
        const droppedOn = e.target.closest('.drag-item');
        if (droppedOn) {
            droppedOn.classList.remove('over');
        }

        if (dragSrcEl != this) {
            const containerId = this.parentElement.id;
            window.updateEtapaOrder(containerId);
        }

        return false;
    }

    function handleDragEnd(e) {
        const items = document.querySelectorAll(`#${containerId} .drag-item`);
        items.forEach(function (item) {
            item.classList.remove('over');
            item.style.opacity = '1';
        });
        window.updateEtapaOrder(containerId);
    }

    container.addEventListener('dragstart', handleDragStart, false);
    container.addEventListener('dragend', handleDragEnd, false);
    
    const items = container.querySelectorAll('.drag-item');
    items.forEach(item => {
        item.addEventListener('dragover', handleDragOver, false);
        item.addEventListener('dragenter', handleDragEnter, false);
        item.addEventListener('dragleave', handleDragLeave, false);
        item.addEventListener('drop', handleDrop, false);
    });
}

// ===============================================
// LÓGICA DE FORMULÁRIOS (NPS)
// ===============================================

const questionsForm1 = [
    { id: 'q1', text: '1. Em uma escala de 1 a 5, o quanto você recomendaria a Delta para um colega ou parceiro de negócios?' },
    { id: 'q2', text: '2. Como você avalia a qualidade dos produtos? (1 = Muito ruim / 5 = Excelente)' },
    { id: 'q3', text: '3. O atendimento comercial atendeu às suas expectativas? (1 = Muito abaixo / 5 = Muito acima)' },
    { id: 'q4', text: '4. A entrega ocorreu dentro do prazo acordado? (1 = Nunca / 5 = Sempre)' },
    { id: 'q5', text: '5. Como você avalia o suporte técnico? (1 = Muito insatisfatório / 5 = Muito satisfatório)' },
    { id: 'q6', text: '6. O custo-benefício dos nossos produtos é adequado? (1 = Muito ruim / 5 = Excelente)' },
    { id: 'q7', text: '7. A comunicação com a equipe da Delta foi clara e eficiente? (1 = Nada clara / 5 = Muito clara)' },
    { id: 'q8', text: '8. Você pretende continuar comprando da Delta nos próximos 12 meses? (1 = Definitivamente não / 5 = Com certeza)' },
    { id: 'q9', text: '9. Você gostaria de ser contatado para compartilhar mais detalhes? (1 = Não / 5 = Sim)' }
];

const questionsForm2 = [
    { id: 'q1', text: '1. Em uma escala de 1 a 5, o quanto você recomendaria a solução da Delta para outro profissional da área?' },
    { id: 'q2', text: '2. A solução é fácil de operar e configurar? (1 = Muito difícil / 5 = Muito fácil)' },
    { id: 'q3', text: '3. A interface ou painel de controle é intuitivo? (1 = Nada intuitivo / 5 = Muito intuitivo)' },
    { id: 'q4', text: '4. A documentação técnica foi útil para a operação? (1 = Nada útil / 5 = Muito útil)' },
    { id: 'q5', text: '5. Você encontrou falhas ou dificuldades técnicas durante o uso? (1 = Muitas falhas / 5 = Nenhuma falha)' },
    { id: 'q6', text: '6. O suporte técnico foi eficaz na resolução de problemas operacionais? (1 = Nada eficaz / 5 = Muito eficaz)' },
    { id: 'q7', text: '7. A solução contribuiu para melhorar seu desempenho ou produtividade? (1 = Piorou / 5 = Melhorou muito)' },
    { id: 'q8', text: '8. O equipamento apresenta boa ergonomia para o operador? (1 = Muito desconfortável / 5 = Muito confortável)' },
    { id: 'q9', text: '9. A disposição dos comandos facilita o uso diário? (1 = Nada funcional / 5 = Muito funcional)' }
];

function generateNpsQuestions(questions, formElement) {
    questions.forEach(q => {
        const questionContainer = document.createElement('div');
        questionContainer.className = 'nps-question-container';

        let ratingHTML = '';
        for (let i = 1; i <= 5; i++) {
            ratingHTML += `
                <div class="rating-option">
                    <input type="radio" id="${formElement.id}-${q.id}-${i}" name="${q.id}" value="${i}" required>
                    <label for="${formElement.id}-${q.id}-${i}">${i}</label>
                </div>
            `;
        }

        questionContainer.innerHTML = `
            <p class="nps-question-text">${q.text}</p>
            <div class="rating-scale-container">${ratingHTML}</div>
        `;
        formElement.appendChild(questionContainer);
    });

    const commentsContainer = document.createElement('div');
    commentsContainer.className = 'form-group';
    commentsContainer.innerHTML = `
        <label for="npsComments-${formElement.id}">10. Comentários adicionais ou sugestões:</label>
        <textarea id="npsComments-${formElement.id}" class="nps-comments-textarea" rows="3"></textarea>
    `;
    formElement.appendChild(commentsContainer);
}

window.openNpsModal = async function(projectId, projectName) {
    document.getElementById('npsProjectName').textContent = projectName;
    const form1 = document.getElementById('npsFormEncomendante');
    const form2 = document.getElementById('npsFormUsuarioFinal');
    const submitBtn = document.getElementById('submitNpsFormBtn');
    const deleteBtn = document.getElementById('deleteNpsFormBtn');

    const header1 = form1.querySelector('.nps-form-header');
    const header2 = form2.querySelector('.nps-form-header');
    form1.innerHTML = '';
    form2.innerHTML = '';
    if (header1) form1.appendChild(header1);
    if (header2) form2.appendChild(header2);

    generateNpsQuestions(questionsForm1, form1);
    generateNpsQuestions(questionsForm2, form2);

    submitBtn.disabled = false;
    submitBtn.textContent = 'Enviar';
    deleteBtn.style.display = 'none';
    form1.querySelectorAll('input, textarea').forEach(el => el.disabled = false);
    form2.querySelectorAll('input, textarea').forEach(el => el.disabled = false);

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}/nps-responses`);
        if (response.ok) {
            const savedResponses = await response.json();
            
            savedResponses.forEach(res => {
                let formToPopulate, questionsToUse;
                if (res.form_type === 'encomendante') {
                    formToPopulate = form1;
                    questionsToUse = questionsForm1;
                } else if (res.form_type === 'usuario_final') {
                    formToPopulate = form2;
                    questionsToUse = questionsForm2;
                }

                if (formToPopulate && questionsToUse) {
                    questionsToUse.forEach(question => {
                        const questionKey = question.id;
                        const scoreKey = `${questionKey}_score`;
                        const score = res[scoreKey];
                        if (score !== null && score !== undefined) {
                            const radio = formToPopulate.querySelector(`input[name="${questionKey}"][value="${score}"]`);
                            if (radio) {
                                radio.checked = true;
                            }
                        }
                    });
                    const commentsTextarea = formToPopulate.querySelector('.nps-comments-textarea');
                    if (commentsTextarea && res.comments) {
                        commentsTextarea.value = res.comments;
                    }
                    formToPopulate.querySelectorAll('input, textarea').forEach(el => el.disabled = true);
                }
            });
        }
    } catch (error) {
        
        window.showError("Não foi possível carregar as respostas salvas.");
    }

    switchNpsTab('npsForm1', document.querySelector('.nps-tab-button'));
    submitBtn.onclick = () => submitNpsForm(projectId);
    deleteBtn.onclick = () => deleteNpsResponse(projectId);
    window.openModal('npsFormModal');

    window.applyUIPermissions(window.getCurrentUser()?.role);
};



async function submitNpsForm(projectId) {
    const activeFormElement = document.querySelector('.nps-tab-content.active .nps-form');
    if (!activeFormElement) {
        window.showError("Nenhum formulário ativo encontrado.");
        return;
    }

    const formData = new FormData(activeFormElement);
    const responses = {};
    let allAnswered = true;
    const totalQuestions = activeFormElement.id === 'npsFormEncomendante' ? questionsForm1.length : questionsForm2.length;

    for (let i = 1; i <= totalQuestions; i++) {
        const value = formData.get(`q${i}`);
        if (!value) {
            allAnswered = false;
            break;
        }
        responses[`q${i}`] = parseInt(value);
    }

    if (!allAnswered) {
        window.showError("Por favor, responda a todas as perguntas de 1 a 9.");
        return;
    }

    const formType = activeFormElement.id === 'npsFormEncomendante' ? 'encomendante' : 'usuario_final';
    const comments = activeFormElement.querySelector('.nps-comments-textarea').value;

    const dataToSend = {
        projectId,
        formType,
        responses,
        comments
    };

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/nps-responses`, {
            method: 'POST',
            body: JSON.stringify(dataToSend)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        
        window.showToast(result.message, 'success');
        window.closeModal('npsFormModal');

    } catch (error) {
        
        window.showError("Erro ao enviar pesquisa: " + error.message);
    }
}

async function deleteNpsResponse(projectId) {
    const activeTab = document.querySelector('.nps-tab-content.active');
    if (!activeTab) {
        window.showError("Nenhuma aba de formulário ativa para exclusão.");
        return;
    }

    const formType = activeTab.id === 'npsForm1' ? 'encomendante' : 'usuario_final';
    
    if (!confirm(`Tem certeza que deseja excluir a resposta do formulário "${formType}" para este projeto? Esta ação não pode ser desfeita.`)) {
        return;
    }

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}/nps-responses/${formType}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Erro ao excluir a resposta.');
        }

        window.showToast(result.message, 'success');
        
        const projectName = document.getElementById('npsProjectName').textContent;
        await window.openNpsModal(projectId, projectName);

    } catch (error) {
        
        window.showError(error.message);
    }
}

window.switchNpsTab = function(formId, clickedButton) {
    document.querySelectorAll('.nps-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    document.querySelectorAll('.nps-tab-button').forEach(button => {
        button.classList.remove('active');
    });

    const activeContent = document.getElementById(formId);
    activeContent.classList.add('active');
    clickedButton.classList.add('active');

    const submitBtn = document.getElementById('submitNpsFormBtn');
    const deleteBtn = document.getElementById('deleteNpsFormBtn');
    const formElement = activeContent.querySelector('form');

    const isAnswered = formElement.querySelector('input:disabled');

    if (isAnswered) {
        submitBtn.textContent = 'Respondido';
        submitBtn.disabled = true;
        deleteBtn.style.display = 'inline-flex';
    } else {
        submitBtn.textContent = 'Enviar';
        submitBtn.disabled = false;
        deleteBtn.style.display = 'none';
    }
};

window.printNpsForm = function() {
    const activeForm = document.querySelector('.nps-tab-content.active');
    if (!activeForm) return;

    const projectName = document.getElementById('npsProjectName').textContent;
    const printWindow = window.open('', '_blank', 'height=600,width=800');

    printWindow.document.write('<html><head><title>Pesquisa de Satisfação - ' + projectName + '</title>');
    printWindow.document.write('<style>body { font-family: sans-serif; } .nps-question { margin-bottom: 20px; } textarea { width: 100%; border: 1px solid #ccc; } h3, p { margin: 5px 0; }</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write('<h1>Pesquisa de Satisfação</h1>');
    printWindow.document.write('<p><strong>Projeto:</strong> ' + projectName + '</p>');
    printWindow.document.write(activeForm.innerHTML);
    printWindow.document.write('</body></html>');
    
    printWindow.document.close();
    printWindow.focus(); 
    
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
};

// ===============================================
// FUNÇÕES AUXILIARES E DE ATUALIZAÇÃO DE UI
// ===============================================

function updateSingleProjectCard(updatedProjectData) {
    const oldCard = document.querySelector(`.project-card[data-project-id="${updatedProjectData.id}"]`);
    if (oldCard) {
        const newCard = window.createProjectCard(updatedProjectData);
        oldCard.replaceWith(newCard);
        if (window.applyUIPermissions) {
            window.applyUIPermissions(window.getCurrentUser()?.role);
        }
    }
}

async function updateShoppingFileStatus(fileId, newStatus, projectId) {
    const actionText = newStatus === 'Aprovado' ? 'aprovar' : 'reprovar';
    if (!confirm(`Tem certeza que deseja ${actionText} esta lista de compras?`)) {
        return;
    }

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/shopping-file/${fileId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        window.showToast(result.message, 'success');
        await fetchAndRenderShoppingFile(projectId);

    } catch (error) {
        console.error(`Erro ao ${actionText} o arquivo:`, error);
        window.showError(`Erro ao ${actionText} o arquivo: ${error.message}`);
    }
}

async function openFileViewerModal(fileId, fileName) {
    const titleSpan = document.getElementById('fileViewerTitle');
    const contentDiv = document.getElementById('fileViewerContent');
    const formatCurrency = (value) => {
        const number = parseFloat(value) || 0;
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number);
    };

    titleSpan.textContent = fileName;
    contentDiv.innerHTML = '<p>Carregando visualização...</p>';
    window.openModal('fileViewerModal');

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/shopping-file/${fileId}/view`);
        
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao carregar o arquivo.');
        }
        
        const bomItems = data.bomItems;

        if (!bomItems || bomItems.length === 0) {
            contentDiv.innerHTML = '<p>Não foram encontrados itens nesta lista de compras.</p>';
            return;
        }

        let totalGeral = 0;
        let tableHtml = `
            <table class="bom-viewer-table">
                <thead>
                    <tr>
                        <th>Foto</th>
                        <th>Cód. Fabricante / Link</th>
                        <th>Material ou Produto</th>
                        <th>Qtd.</th>
                        <th>Justificativa</th>
                        <th>Valor Unitário</th>
                        <th>Valor Total</th>
                    </tr>
                </thead>
                <tbody>
        `;

        bomItems.forEach(item => {
            const fornecedor = item.fornecedor || 'N/A';
            const valorUnitario = item.valor_unitario || 0;
            const valorTotal = item.valor_total_item || 0;
            const justificativa = item.justificativa || 'N/A';
            
            const imagemHtml = item.url_imagem
                ? `<a href="${fornecedor.startsWith('http') ? fornecedor : '#'}" target="_blank"><img src="${item.url_imagem}" alt="${item.descricao}"></a>`
                : 'N/A';
                
            const fornecedorHtml = fornecedor.startsWith('http')
                ? `<a href="${fornecedor}" target="_blank" rel="noopener noreferrer" title="${fornecedor}">Abrir Link Externo</a>`
                : fornecedor;

            totalGeral += parseFloat(valorTotal);

            tableHtml += `
                <tr>
                    <td>${imagemHtml}</td>
                    <td>${fornecedorHtml}</td>
                    <td>${item.descricao}</td>
                    <td>${item.quantidade}</td>
                    <td>${justificativa}</td>
                    <td>${formatCurrency(valorUnitario)}</td>
                    <td>${formatCurrency(valorTotal)}</td>
                </tr>
            `;
        });

        tableHtml += `
                </tbody>
                <tfoot>
                    <tr class="total-geral-row">
                        <td colspan="6">TOTAL GERAL</td>
                        <td>${formatCurrency(totalGeral)}</td>
                    </tr>
                </tfoot>
            </table>
        `;

        contentDiv.innerHTML = tableHtml;

    } catch (error) {
        console.error('ERRO CAPTURADO:', error);
        contentDiv.innerHTML = `<p style="color:red;">Falha ao carregar visualização: ${error.message}</p>`;
    }
}


// Função principal que busca e renderiza os itens na tela de Aprovações
window.fetchAndRenderSolicitacoes = async function() {
    const listContainer = document.getElementById('solicitacoesList');
    const countSpan = document.getElementById('solicitacoesCount');
    listContainer.innerHTML = '<div class="loading-message">Carregando solicitações...</div>';
    
    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/solicitacoes`);
        const solicitacoes = await response.json();
        
        // Atualiza a contagem de solicitações na aba
        countSpan.textContent = solicitacoes.length; 
        
        if (solicitacoes.length === 0) {
            listContainer.innerHTML = '<p class="no-items-message">Nenhuma solicitação aguardando aprovação.</p>';
            return;
        }

        listContainer.innerHTML = solicitacoes.map(item => {
            // Lógica para renderizar o card de aprovação
            // Você precisará de uma função auxiliar para renderizar os orçamentos (item.orcamentos)
            return `
                <div class="solicitacao-card" data-item-id="${item.id}">
                    <div class="solicitacao-checkbox-container">
                        <input type="checkbox" class="solicitacao-checkbox" data-item-id="${item.id}">
                    </div>
                    <div class="bom-item-details">
                        <p class="item-descricao">${item.descricao}</p>
                        <p class="item-info">
                            Qtd: <strong>${item.quantidade}</strong> | 
                            Setor: <strong>${item.setor}</strong> | 
                            Solicitante: <strong>${item.nome_solicitante || 'N/A'}</strong>
                        </p>
                        <p class="item-justificativa">Justificativa: ${item.justificativa || 'N/A'}</p>
                    </div>
                    <div class="solicitacao-actions">
                        <button class="action-button success" onclick="window.approveSolicitacao(${item.id})">
                            <i class="fas fa-check"></i> Aprovar
                        </button>
                        <button class="action-button danger" onclick="window.reproveSolicitacao(${item.id})">
                            <i class="fas fa-times"></i> Reprovar
                        </button>
                        </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        listContainer.innerHTML = `<p class="no-items-message error">Erro ao carregar solicitações: ${error.message}</p>`;
        countSpan.textContent = 'ERRO';
        window.showError(`Erro ao carregar solicitações: ${error.message}`);
    }
};



/**
 * NOVO: Exibe os itens da BOM na aba "Status dos Pedidos".
 * Mostra o histórico de status com nomes e datas.
 * (Esta função substitui a antiga 'displayBomItemsStatus' e agora busca seus próprios dados)
 */
window.loadSentItemsPanel = async function(projectId) {
    const container = document.getElementById('sentBomItemsListContainer'); // ID correto do container da aba
    if (!container) {
        console.error("Container 'sentBomItemsListContainer' não encontrado para Status dos Pedidos.");
        return;
    }
    container.innerHTML = '<p class="no-items-message">Buscando histórico de pedidos...</p>';

    try {
        // 1. Buscar os dados (esta rota já inclui os nomes e datas de log do server.js)
        const response = await window.authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}/bom-items`);
        if (!response.ok) throw new Error('Falha ao buscar itens.');
        
        const allItems = await response.json();
        
        // 2. Filtra apenas itens que já saíram da elaboração
        const items = allItems.filter(item => item.status !== 'Em Elaboração');

        container.innerHTML = ''; // Limpa antes de adicionar

        if (!items || items.length === 0) {
            container.innerHTML = '<p class="no-items-message">Nenhum item enviado ou em processamento.</p>';
            return;
        }

        // 3. Agrupa por setor
        const itemsBySector = items.reduce((acc, item) => {
            const sector = item.setor || 'Geral';
            if (!acc[sector]) {
                acc[sector] = [];
            }
            acc[sector].push(item);
            return acc;
        }, {});

        // 4. Itera sobre os setores agrupados
        for (const sector in itemsBySector) {
            if(itemsBySector[sector].length === 0) continue;

            const sectorGroupDiv = document.createElement('div');
            sectorGroupDiv.className = 'sector-group status-sector-group';
            sectorGroupDiv.dataset.sector = sector;

            const sectorTitle = document.createElement('h4');
            sectorTitle.className = 'sector-title';
            sectorTitle.textContent = `Setor: ${sector}`;
            sectorGroupDiv.appendChild(sectorTitle);

            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'sector-items-container';

            itemsBySector[sector].forEach(item => {
                const itemCard = document.createElement('div');
                itemCard.className = `bom-item-card status-item-card status-${getStatusClass(item.status)}`;
                itemCard.dataset.itemId = item.id;

                // ############# INÍCIO DA ATUALIZAÇÃO (Formato de Data) #############
                // Formata as datas (vindo do server.js) para dd/mm/aaaa
                // Usa '' (vazio) se a data for nula
                const dataSolicitanteFormatada = item.data_solicitante ? (window.formatDate(item.data_solicitante, false) || '') : '';
                const dataLiderFormatada = item.data_lider ? (window.formatDate(item.data_lider, false) || '') : ''; // <-- CRÍTICO: NOVO
                const dataGestorFormatada = item.data_gestor ? (window.formatDate(item.data_gestor, false) || '') : '';
                const dataCotacaoFormatada = item.data_cotacao ? (window.formatDate(item.data_cotacao, false) || '') : '';
                const dataAprovadorFinalFormatada = item.data_aprovador_final ? (window.formatDate(item.data_aprovador_final, false) || '') : ''; 
                // ############# FIM DA ATUALIZAÇÃO (Formato de Data) #############

// Determina o label e nome para a última etapa
	                let finalApprovalLabel = "Aprov. Final:";
	                let finalApprovalName = item.nome_aprovador_final || 'Pendente';
	                let finalApprovalClass = "info-aprovado";

	                // Adiciona a informação do Financeiro
	                const financeiroInfo = item.financeiro_info ? item.financeiro_info.split('|') : null;
	                const financeiroHtml = financeiroInfo 
	                    ? `<p class="item-info info-financeiro"><i class="fas fa-money-check-alt"></i> <strong>Aprov. Financeiro:</strong> Aprovado por ${financeiroInfo[0]} em ${window.formatDate(financeiroInfo[1], false)}</p>`
	                    : `<p class="item-info info-financeiro"><i class="fas fa-money-check-alt"></i> <strong>Aprov. Financeiro:</strong> Pendente</p>`;

	                // Adiciona a informação da Diretoria
	                const diretorInfo = item.diretor_info ? item.diretor_info.split('|') : null;
	                const diretorHtml = diretorInfo 
	                    ? `<p class="item-info info-diretor"><i class="fas fa-user-tie"></i> <strong>Aprov. Diretoria:</strong> Aprovado por ${diretorInfo[0]} em ${window.formatDate(diretorInfo[1], false)}</p>`
	                    : `<p class="item-info info-diretor"><i class="fas fa-user-tie"></i> <strong>Aprov. Diretoria:</strong> Pendente</p>`;
                
                if (item.status === 'Reprovado') {
                    finalApprovalLabel = "Reprovado por:";
                    finalApprovalClass = "info-reprovado";
                } else if (item.status !== 'Comprado') {
                     finalApprovalName = 'Pendente'; 
                }
                
                // ############# INÍCIO DA ATUALIZAÇÃO (Seleção de Orçamento) #############
                // Exibe o fornecedor e valor TOTAL APROVADOS
                let selectedQuoteHtml = '';
                if (item.fornecedor_aprovado && item.valor_total_item) {
                    selectedQuoteHtml = `
                        <p class="item-info info-selecionado" style="color: var(--success-color); font-weight: bold;">
                            <i class="fas fa-check-double"></i> <strong>Selecionado:</strong> ${item.fornecedor_aprovado} - <strong>Valor:</strong> ${window.formatCurrency(item.valor_total_item)}
                        </p>`;
                } else if (item.status === 'Aguardando Aprovação Diretoria') {
                     selectedQuoteHtml = `<p class="item-info info-selecionado"><strong>Aguardando aprovação final do orçamento.</strong></p>`;
                }
                // ############# FIM DA ATUALIZAÇÃO (Seleção de Orçamento) #############

                // Monta o HTML do card
                itemCard.innerHTML = `
                    <div class="bom-item-main-content">
                        <div class="bom-item-image">
                            ${item.url_imagem ? `<img src="${item.url_imagem}" alt="Imagem do item" onerror="this.onerror=null; this.src='img/placeholder.png';">` : '<i class="fas fa-image"></i>'}
                        </div>
                        <div class="bom-item-details">
                            <p class="item-descricao">${item.descricao}</p>
                            <p class="item-info"><strong>Projeto:</strong> ${item.nome_projeto || 'N/A'} | <strong>Setor:</strong> ${item.setor || 'N/A'}</p>
                            <p class="item-info"><strong>Qtd:</strong> ${parseFloat(item.quantidade).toFixed(2)} | <strong>Justificativa:</strong> ${item.justificativa || 'N/A'}</p>
                            
                            <p class="item-info info-solicitante">
                                <i class="fas fa-user-edit"></i> <strong>Solicitante:</strong> ${item.nome_solicitante || 'Pendente'} ${dataSolicitanteFormatada}
                            </p>
                            
                            <p class="item-info info-lider">
                                <i class="fas fa-user-check"></i> <strong>Aprov. Líder:</strong> ${item.nome_lider || 'Pendente'} ${dataLiderFormatada}
                            </p>
                            
                            <p class="item-info info-gestor">
                                <i class="fas fa-user-check"></i> <strong>Aprov. Gestor:</strong> ${item.nome_gestor || 'Pendente'} ${dataGestorFormatada}
                            </p>
<p class="item-info info-cotacao">
	                                <i class="fas fa-dollar-sign"></i> <strong>Cotações:</strong> ${item.nome_cotacao || 'Pendente'} ${dataCotacaoFormatada}
	                            </p>
	                            ${diretorHtml}
	                            ${financeiroHtml}
	                            <p class="item-info ${finalApprovalClass}">
	                               ${item.status === 'Reprovado' ? '<i class="fas fa-times-circle"></i>' : '<i class="fas fa-check-circle"></i>'} 
	                               <strong>${finalApprovalLabel}</strong> ${finalApprovalName} ${dataAprovadorFinalFormatada}
	                            </p>
                            ${selectedQuoteHtml} 
                        </div>
                        <div class="bom-item-actions action-stack"> 
                            <span class="bom-item-status-badge status-${getStatusClass(item.status)}">${item.status}</span>
                            <button class="action-button warning small" onclick="window.returnBomItemToElaboration(${item.id})">
                               <i class="fas fa-undo"></i> Retornar p/ Elaboração
                            </button>
                            <button class="action-button danger small" onclick="window.deleteBomItem(${item.id})">
                               <i class="fas fa-trash-alt"></i> Excluir (Permanente)
                            </button>
                        </div>
                    </div>
                    
                     <button class="bom-item-quotes-toggle" onclick="toggleQuotesVisibility(this)">
                         <i class="fas fa-chevron-down"></i> Ver Orçamentos (${item.orcamentos ? item.orcamentos.length : 0})
                     </button>
                     <div class="bom-item-quotes-container" id="quotes-container-${item.id}">
                        </div>
                `;
                itemsContainer.appendChild(itemCard);
            });

            sectorGroupDiv.appendChild(itemsContainer);
            container.appendChild(sectorGroupDiv);
        }
         // Aplica permissões
         if (window.applyUIPermissions) {
             window.applyUIPermissions(window.getCurrentUser()?.role, `#${container.id}`); 
         }

    } catch (err) {
         
         container.innerHTML = `<p class="error-message">Erro ao carregar histórico de pedidos: ${err.message}</p>`;
    }
}

// ==========================================================
// INÍCIO: FUNÇÕES AUXILIARES (APENAS PARA GARANTIR)
// ==========================================================

// Função auxiliar para obter a classe CSS do status (se ainda não existir)
function getStatusClass(status) {
    if (!status) return 'pendente';
    return status.toLowerCase()
        .replace(/\s+/g, '-') // substitui espaços por hífens
        .replace(/[^a-z0-9-]/g, ''); // remove caracteres não alfanuméricos exceto hífen
}

// Função para parsear JSON (assumindo que já existe no seu script.js ou similar)
function parseJsonField(jsonString) {
    if (!jsonString) return [];
    try {
        const parsed = (typeof jsonString === 'string') ? JSON.parse(jsonString) : jsonString;
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.warn("Falha ao parsear campo JSON:", jsonString, e);
        return [];
    }
}


// project-status.js: Adicionar a função loadApprovalPanel e dependências.

/**
 * Carrega e renderiza a lista de itens de BOM que estão 'Aguardando Aprovação',
 * agrupando-os por SETOR.
 * @param {number} currentProjectId - O ID do projeto atualmente selecionado no modal.
 */
window.loadApprovalPanel = async (currentProjectId = null, status = 'Aguardando Aprovação', containerId = 'approvalPanelContent') => {
    if (!currentProjectId) {
        currentProjectId = document.getElementById('shoppingProjectId').value;
    }
    
    const listContainer = document.getElementById(containerId);
    // Seleciona os contadores corretos com base no containerId
    const countSpan = document.getElementById(containerId === 'approvalPanelContent' ? 'solicitacoesCount' : (containerId === 'liderApprovalPanelContent' ? 'liderSolicitacoesCount' : 'directorApprovalCount'));
    const countBadge = document.getElementById(containerId === 'approvalPanelContent' ? 'solicitacoesCountBadge' : (containerId === 'liderApprovalPanelContent' ? 'liderApprovalCountBadge' : 'directorApprovalCountBadge'));
    
    // Seleciona os controles dentro do 'tab-content' pai
    const controls = listContainer.closest('.tab-content').querySelector('.solicitacoes-controls');

    listContainer.innerHTML = '<p class="loading-message"><i class="fas fa-spinner fa-spin"></i> Carregando solicitações...</p>';
    
    try {
        // ATUALIZADO: Busca a rota correta de solicitações (que filtra por status)
        const response = await window.authenticatedFetch(`${API_BASE_URL}/solicitacoes?status=${encodeURIComponent(status)}`);
        
        if (!response.ok) {
            throw new Error('Falha ao buscar solicitações.');
        }

        const allSolicitacoes = await response.json();
        
        // Filtra para mostrar apenas as solicitações do projeto ATUAL
        const solicitacoes = allSolicitacoes.filter(item => item.projeto_id == currentProjectId); 

        // Atualiza os contadores
        countSpan.textContent = solicitacoes.length;
        if (countBadge) countBadge.textContent = solicitacoes.length;
        
        if (solicitacoes.length === 0) {
            listContainer.innerHTML = '<p class="no-items-message">Nenhuma solicitação aguardando aprovação para este projeto.</p>';
            if (controls) controls.style.display = 'none';
            return;
        }

        if (controls) controls.style.display = 'flex'; // Mostra os botões de ação em massa

        // 1. Agrupa as solicitações por setor
        const groupedBySector = solicitacoes.reduce((acc, item) => {
            const sector = item.setor || 'Geral';
            if (!acc[sector]) {
                acc[sector] = [];
            }
            acc[sector].push(item);
            return acc;
        }, {});

        listContainer.innerHTML = ''; // Limpa antes de renderizar
        
        // 2. Itera sobre os grupos e renderiza o cabeçalho do setor e os cards
        for (const sector in groupedBySector) {
            const sectorGroup = document.createElement('div');
            sectorGroup.className = 'approval-sector-group';
            sectorGroup.dataset.sector = sector; // Adiciona o data attribute para cores

            const header = document.createElement('div');
            header.className = 'approval-sector-header';
            header.innerHTML = `<h4>Setor: ${sector} (${groupedBySector[sector].length} itens)</h4>`;
            sectorGroup.appendChild(header);

            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'approval-items-container';

            groupedBySector[sector].forEach(item => {
                const card = createSolicitacaoCard(item);
                itemsContainer.appendChild(card);
            });
            
            sectorGroup.appendChild(itemsContainer);
            listContainer.appendChild(sectorGroup);
        }
        
        // 3. Re-anexa os listeners de ação em massa e de seleção de todos
        // window.setupBulkActionListeners(); // Removido: função não definida ou não exposta corretamente.
        
    } catch (error) {
        
        countSpan.textContent = '0';
        if (solicitacoesCountBadge) solicitacoesCountBadge.textContent = '0';
        listContainer.innerHTML = `<p class="error-message">Erro ao carregar solicitações: ${error.message}</p>`;
    }
};

/* ===================== INÍCIO DA ADIÇÃO (Ação do Líder) ===================== */
/**
 * Processa a aprovação ou reprovação do Líder.
 */
window.processLiderAction = async function(itemId, action) {
    // Se aprovado, o item vai para 'Aguardando Aprovação' (Gestor). Se reprovado, volta para 'Reprovado'.
    const newStatus = action === 'approve' ? 'Aguardando Aprovação' : 'Reprovado';
    const confirmMessage = action === 'approve' 
        ? "Confirma a APROVAÇÃO do Líder? O item será enviado ao Gestor."
        : "Confirma a REPROVAÇÃO? O item voltará para 'Em Elaboração'.";

    if (!confirm(confirmMessage)) return;

    try {
        // Rota que altera o status do item
        const response = await window.authenticatedFetch(`${API_BASE_URL}/bom-items/${itemId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || `Falha ao ${action} o item.`);
        }
        
        window.showToast(result.message, 'success');
        
        // Recarrega os painéis afetados
        const projectId = document.getElementById('shoppingProjectId').value;
        // Recarrega o painel do Líder (de onde o item saiu)
        window.loadApprovalPanel(projectId, 'Aguardando Aprovação Líder', 'liderApprovalPanelContent'); 
        // Recarrega o painel do Gestor (para onde o item foi, se aprovado)
        window.loadApprovalPanel(projectId); 
        // Recarrega o "Meu Pedido" (para onde o item foi, se reprovado)
        window.fetchAndRenderBomItems(projectId);

    } catch (error) {
        window.showError(error.message);
    }
}
/* ===================== FIM DA ADIÇÃO ===================== */


/**
 * Cria o card visual para um item de solicitação de compra (a ser usado por loadApprovalPanel e loadDirectorApprovalPanel).
 */
function createSolicitacaoCard(item) {
    const card = document.createElement('div');
    card.className = 'solicitacao-card bom-item-card status-aguardando-aprovacao';
    card.setAttribute('data-item-id', item.id);

    // --- Lógica de extração de dados ---
    const imageUrl = item.url_imagem || '';
    const imageHtml = imageUrl ?
        `<img src="${imageUrl}" alt="Imagem do item" onerror="this.onerror=null; this.src='img/default-part.png';">` :
        `<i class="fas fa-image"></i>`;

    let orcamentos = [];
    try {
        // Assume-se que 'parseJsonField' está definido globalmente no seu escopo
        orcamentos = Array.isArray(item.orcamentos) ? item.orcamentos : (item.orcamentos ? parseJsonField(item.orcamentos) : []);
    } catch (e) {
        orcamentos = [];
    }
    
    // VARIÁVEIS DE EXIBIÇÃO - Inicializam com o status pendente
    let fornecedorLabel = 'N/A (Aprovação Pendente)';
    let valorTotalFinal = 0;
    let linkProdutoHtml = `<p class="item-info">Link: N/A</p>`;

    // 1. Encontra a sugestão inicial (primeiro orçamento)
    const sugestaoInicial = orcamentos.length > 0 ? orcamentos[0] : null;
    
    // =================================================================================
    //  BLOCO DE LÓGICA DE EXIBIÇÃO (PRIORIZA O VALOR FINAL SALVO NO DB)
    // =================================================================================

    // 2. Se há dados aprovados salvos no item (Fase de Cotação concluída com sucesso)
    if (item.fornecedor_aprovado && item.valor_aprovado) {
        
        fornecedorLabel = item.fornecedor_aprovado;
        valorTotalFinal = item.valor_total_item || (parseFloat(item.valor_aprovado) * item.quantidade);

        // Adiciona a tag para informar qual orçamento foi escolhido
        const quoteSelected = orcamentos.findIndex(q =>
            q.fornecedor === item.fornecedor_aprovado && parseFloat(q.valor_unitario).toFixed(2) === parseFloat(item.valor_aprovado).toFixed(2)
        );
        
        if (quoteSelected !== -1 && !item.status.includes('Diretoria')) {
            fornecedorLabel += ` (Orçamento Selecionado #${quoteSelected + 1})`;
        }
        
        // Usa o link do produto salvo
        if (item.link_produto) {
            linkProdutoHtml = `<p class="item-info">Link Selecionado: <strong><a href="${item.link_produto}" target="_blank">Abrir Link</a></strong></p>`;
        }

    } else if (sugestaoInicial) {
        // 3. FALLBACK: Usa a sugestão inicial (Seja na 1ª aprovação, seja no erro da 2ª fase)
        const valorUnitario = parseFloat(sugestaoInicial.valor_unitario) || 0;
        
        // Define a label de acordo com a fase atual
        // ATUALIZADO: Mostra (Sugestão) também para o Líder
        let labelSuffix = (item.status === 'Aguardando Aprovação' || item.status === 'Aguardando Aprovação Líder') ? ' (Sugestão)' : ' (Fallback Sugestão Inicial)';
        
        fornecedorLabel = sugestaoInicial.fornecedor + labelSuffix;
        valorTotalFinal = valorUnitario * item.quantidade;

        if (sugestaoInicial.link_produto) {
            linkProdutoHtml = `<p class="item-info">Link Sugerido${(item.status === 'Aguardando Aprovação' || item.status === 'Aguardando Aprovação Líder') ? '' : ' (Fallback)'}: <strong><a href="${sugestaoInicial.link_produto}" target="_blank">Abrir Link</a></strong></p>`;
        }
    }
    // =================================================================================
    
    const valorInfo = window.formatCurrency(valorTotalFinal);
    const justificativaText = (item.justificativa && item.justificativa.trim() !== '') ? item.justificativa : 'N/A';
    
    // ##### INÍCIO DA MODIFICAÇÃO (V5 - Painel Líder) #####
    // Refatorado com "Dispatch Map" para remover o aviso de complexidade
    
    // 1. Mapeia os status para os botões de ação correspondentes
    const actionButtonMap = {
        'Aguardando Aprovação Líder': `
            <button onclick="window.processLiderAction(${item.id}, 'approve')" class="action-button success small" data-action="approve-individual">
                <i class="fas fa-check"></i> Aprovar (Líder)
            </button>
            <button onclick="window.processLiderAction(${item.id}, 'reprove')" class="action-button danger small" data-action="reprove-individual">
                <i class="fas fa-times"></i> Reprovar
            </button>
        `,
        'Aguardando Aprovação Diretoria': `
            <button onclick="window.processDirectorAction(${item.id}, 'approve')" class="action-button success small" data-action="approve-individual">
                <i class="fas fa-check"></i> Aprovar Diretoria
            </button>
            <button onclick="window.processDirectorAction(${item.id}, 'reprove')" class="action-button danger small" data-action="reprove-individual">
                <i class="fas fa-times"></i> Reprovar
            </button>
        `,
        'Aguardando Aprovação Financeiro': `
            <button onclick="window.processFinancialAction(${item.id}, 'approve')" class="action-button success small" data-action="approve-individual">
                <i class="fas fa-check"></i> Aprovar Final
            </button>
            <button onclick="window.processFinancialAction(${item.id}, 'reprove')" class="action-button danger small" data-action="reprove-individual">
                <i class="fas fa-times"></i> Reprovar
            </button>
        `,
        'Aguardando Aprovação': `
            <button onclick="window.processApprovalAction(${item.id}, 'approve')" class="action-button success small" data-action="approve-individual">
                <i class="fas fa-check"></i> Aprovar
            </button>
            <button onclick="window.processApprovalAction(${item.id}, 'reprove')" class="action-button danger small" data-action="reprove-individual">
                <i class="fas fa-times"></i> Reprovar
            </button>
        `
    };

    // 2. Busca o HTML correspondente ao status do item.
    // Se o status não estiver no mapa (ex: 'Comprado', 'Reprovado'), o valor será '' (vazio).
    const actionButtonsHtml = actionButtonMap[item.status] || '';
    
    // ##### FIM DA MODIFICAÇÃO #####
    
    const cardStatusClass = item.status.toLowerCase().replace(/\s+/g, '-');

    // ===================== INÍCIO DA CORREÇÃO (Checkbox) =====================
    // Verifica se o item está em QUALQUER status de aprovação
    const isAwaitingApproval = item.status.startsWith('Aguardando Aprovação');
    
    // Define se o checkbox deve aparecer
    const checkboxHtml = isAwaitingApproval 
        ? `<div class="solicitacao-checkbox-container">
               <input type="checkbox" class="solicitacao-checkbox" data-item-id="${item.id}">
           </div>`
        : `<div class="solicitacao-checkbox-container" style="display:none;"></div>`; // Esconde se não estiver em aprovação
    // ===================== FIM DA CORREÇÃO (Checkbox) =====================
    
    // A estrutura HTML é um grid para organizar: Imagem | Detalhes | Ações
    card.innerHTML = `
        ${checkboxHtml}
        
        <div class="bom-item-image" style="grid-column: 1 / 2; grid-row: 1 / 3;">
            ${imageHtml}
        </div>
        
        <div class="bom-item-details" style="grid-column: 2 / 4; grid-row: 1 / 3;">
            <p class="item-descricao"><strong>${item.descricao}</strong></p>
            <p class="item-info">Projeto: <strong>${item.nome_projeto || 'N/A'}</strong> | Setor: <strong>${item.setor}</strong></p>
            
            <p class="item-info">Fornecedor Selecionado: <strong>${fornecedorLabel}</strong></p>
            <p class="item-info" style="font-weight: bold; color: var(--primary-color);">Valor Final: <strong>${valorInfo}</strong></p>
            ${linkProdutoHtml}
            <p class="item-info">Justificativa: <strong>${justificativaText}</strong></p>
            <div class="bom-item-status-badge status-${cardStatusClass}" style="margin-top: 10px;">${item.status}</div>
        </div>
        
        <div class="solicitacao-actions" style="grid-column: 4 / 5; grid-row: 1 / 3; align-self: center;">
            ${actionButtonsHtml}
        </div>
    `;

    return card;
}

/**
 * Função central para processar a aprovação ou reprovação de um item individual
 * ou em massa (chamada por handleBulkApprovalAction).
 * @param {number} itemId - ID do item da BOM.
 * @param {'approve'|'reprove'} action - Ação a ser realizada.
 * @param {boolean} isBulk - Indica se a chamada faz parte de uma ação em massa.
 */
window.processApprovalAction = async function(itemId, action, panelId = 'approvalPanelContent') {
    const statusMap = {
        'approve': 'Em Cotação',
        'reprove': 'Reprovado'
    };
    const newStatus = statusMap[action];

    if (!newStatus) {
        console.error("Ação inválida:", action);
        return;
    }

    // Adiciona uma mensagem de confirmação
    const actionText = action === 'approve' ? 'aprovar' : 'reprovar';
    if (!confirm(`Tem certeza que deseja ${actionText} este item?`)) {
        return;
    }

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/bom-items/${itemId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || `Falha ao ${actionText} o item.`);
        }

        window.showToast(result.message, 'success');

        // Recarrega o painel de aprovação atual
        if (panelId === 'approvalPanelContent' && window.loadApprovalPanel) {
            window.loadApprovalPanel();
        } else if (panelId === 'directorApprovalPanelContent' && window.loadDirectorApprovalPanel) {
            window.loadDirectorApprovalPanel();
        }

        // ▼▼▼ INÍCIO DA CORREÇÃO ▼▼▼
        // Recarrega o painel de cotações SOMENTE se o usuário tiver permissão para vê-lo
        if (window.userPermissions && window.userPermissions.includes('acquisitions.view')) {
            if (window.fetchAndRenderCotacoes) {
                window.fetchAndRenderCotacoes();
            }
        }
        // ▲▲▲ FIM DA CORREÇÃO ▲▲▲

        // Recarrega a lista principal de itens BOM (Meu Pedido / Status)
        const projectId = document.getElementById('shoppingProjectId')?.value;
        if (projectId && window.fetchAndRenderBomItems) {
            window.fetchAndRenderBomItems(projectId);
        }

    } catch (error) {
        window.showError(error.message);
        console.error(`Erro ao ${actionText} item ${itemId}:`, error);
    }
};

// NOVO: Adicionar a função de processamento de aprovação/reprovação em massa
// Esta função precisará de uma rota no server.js para processamento em lote
window.massApprovalAction = async (action) => {
    // 1. Identificar o painel ativo
    let panelId = null;
    if (document.getElementById('liderApprovalPanelContent') && document.getElementById('liderApprovalPanelContent').closest('.tab-content.active')) {
        panelId = 'liderApprovalPanelContent';
    } else if (document.getElementById('approvalPanelContent') && document.getElementById('approvalPanelContent').closest('.tab-content.active')) {
        panelId = 'approvalPanelContent';
    }
    
    if (!panelId) {
        window.showError('Não foi possível identificar o painel de aprovação ativo.', 'error');
        return;
    }
    
    // A função processLiderAction só deve ser chamada se o painel ativo for o do Líder
    const isLiderPanel = panelId === 'liderApprovalPanelContent';

    // 2. Coletar os itens selecionados
    const checkboxes = document.querySelectorAll(`#${panelId} .solicitacao-checkbox:checked, #${panelId} .solicitacao-card input[type="checkbox"]:checked`);
    const itemIds = Array.from(checkboxes).map(cb => parseInt(cb.dataset.itemId || cb.closest('.solicitacao-card')?.dataset.itemId));

    if (itemIds.length === 0) {
        window.showToast('Nenhum item selecionado para a ação.', 'info');
        return;
    }

    const actionText = action === 'approve' ? 'APROVAR' : 'REPROVAR';
    if (!confirm(`Tem certeza que deseja ${actionText} ${itemIds.length} item(ns) selecionado(s)?`)) return;

    let successCount = 0;
    let failedCount = 0;
    
    // 3. Chama a função de processamento correta em loop
    for (const itemId of itemIds) {
        let success;
        if (isLiderPanel) {
            // Se for o painel do Líder, chama processLiderAction
            success = await window.processLiderAction(itemId, action, true);
        } else {
            // Caso contrário, chama processApprovalAction (Gestor, Diretor, Financeiro, etc.)
            success = await window.processApprovalAction(itemId, action, true);
        }
        
        if (success) {
            successCount++;
        } else {
            failedCount++;
        }
    }

    if (successCount > 0) {
        window.showToast(`${successCount} item(ns) ${actionText.toLowerCase()} com sucesso!`, 'success');
    }
    if (failedCount > 0) {
        window.showError(`${failedCount} item(ns) falharam.`, 'error');
    }
    
    // 4. Recarrega o painel correto
    const projectId = document.getElementById('shoppingProjectId').value;
    if (isLiderPanel) {
        // Recarrega o painel do Líder (de onde o item saiu)
        window.loadApprovalPanel(projectId, 'Aguardando Aprovação Líder', 'liderApprovalPanelContent'); 
        // A função processLiderAction já recarrega o painel do Gestor, então não precisa fazer mais nada.
    } else {
    // Recarrega o painel atual (Gestor, Diretor, etc.)
    window.loadApprovalPanel(projectId, null, panelId); 
}

    // Ação do "Selecionar Todos"
    // Adiciona o listener para o checkbox do Líder também
    const selectAllLiderCheckbox = document.getElementById('selectAllSolicitacoesLider');
    
    const applySelectAllLogic = (selectAllCheckbox) => {
        selectAllCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            // Encontra o painel pai do checkbox "Selecionar Todos"
            const panel = e.target.closest('.tab-content');
            if (panel) {
                // Seleciona todos os checkboxes de item dentro do painel
                panel.querySelectorAll('.solicitacao-checkbox').forEach(cb => cb.checked = isChecked);
            }
        });
    };

    if (selectAllCheckbox) applySelectAllLogic(selectAllCheckbox);
    if (selectAllLiderCheckbox) applySelectAllLogic(selectAllLiderCheckbox);

    // Ação dos checkboxes individuais (para desmarcar o "Selecionar Todos" se um for desmarcado)
    document.querySelectorAll('.solicitacao-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            // Encontra o painel pai do item
            const panel = e.target.closest('.tab-content');
            if (panel) {
                const allItems = Array.from(panel.querySelectorAll('.solicitacao-checkbox'));
                const allChecked = allItems.length > 0 && allItems.every(cb => cb.checked);
                
                // Atualiza o checkbox "Selecionar Todos" específico do painel
                // Procura pelo checkbox de seleção de todos dentro do painel
                const selectAllPanelCheckbox = panel.querySelector('.solicitacao-select-all');
                if (selectAllPanelCheckbox) {
                    selectAllPanelCheckbox.checked = allChecked;
                }
            }
        });
    });

    // Ações dos botões de aprovar/reprovar
    const approveSelectedBtn = document.getElementById('approveSelectedBtn');
    const reproveSelectedBtn = document.getElementById('reproveSelectedBtn');
    if (approveSelectedBtn) {
        approveSelectedBtn.onclick = () => handleBulkApprovalAction('approve');
    }
    if (reproveSelectedBtn) {
        reproveSelectedBtn.onclick = () => handleBulkApprovalAction('reprove');
    }
}

/**
 * Processa a aprovação ou reprovação em massa.
 * @param {'approve'|'reprove'} action - Ação a ser realizada.
 */
window.handleBulkApprovalAction = async (action) => {
    const checkboxes = document.querySelectorAll('#approvalPanelContent .solicitacao-checkbox:checked');
    const selectedIds = Array.from(checkboxes).map(cb => parseInt(cb.dataset.id));

    if (selectedIds.length === 0) {
        window.showToast('Nenhum item selecionado para a ação.', 'info');
        return;
    }

    const actionText = action === 'approve' ? 'APROVAR' : 'REPROVAR';
    if (!confirm(`Tem certeza que deseja ${actionText} ${selectedIds.length} item(ns) selecionado(s)?`)) return;

    let successCount = 0;
    let failedCount = 0;
    
    // Processamento sequencial (menos eficiente, mas mais seguro e simples)
    for (const itemId of selectedIds) {
        const success = await window.processApprovalAction(itemId, action, true); // Passa 'true' para isBulk
        if (success) {
            successCount++;
        } else {
            failedCount++;
        }
    }

    if (successCount > 0) {
        window.showToast(`${successCount} item(ns) ${actionText.toLowerCase()} com sucesso!`, 'success');
    }
    if (failedCount > 0) {
        window.showError(`${failedCount} item(ns) falharam. Verifique o console.`, 'error');
    }
    
    // Recarrega uma vez no final para garantir a sincronização do painel e dos contadores
    window.loadApprovalPanel();
}

// Função que inicializa a tela de Aprovações
window.initializeAprovacaoScreen = function() {
    
    window.fetchAndRenderSolicitacoes();
};

// Registra a função de inicialização para ser chamada pelo script.js
if (window.screenInitializers) {
    window.screenInitializers['telaAprovacao'] = window.initializeAprovacaoScreen;
}

// --- FIM DO CÓDIGO PARA APROVAÇÃO EM MASSA ---

window.toggleQuotes = function(itemId) {
    // Encontra o card principal do item de compra pelo seu ID
    const bomItemCard = document.querySelector(`.bom-item-card[data-item-id='${itemId}']`);
    
    if (bomItemCard) {
        // Adiciona ou remove a classe 'quotes-open' no card.
        // O CSS é responsável por mostrar ou esconder a seção de orçamentos com base nessa classe.
        bomItemCard.classList.toggle('quotes-open');
    } else {
        console.error(`Card do item de compra com ID ${itemId} não encontrado.`);
    }
};


window.submitBomItemForApproval = async function(itemId) {
    if (!confirm('Deseja enviar este item para aprovação?')) return;
    
    // Rota que muda o status para 'Aguardando Aprovação' no backend
    const endpoint = `${API_BASE_URL}/bom-items/${itemId}/submit-for-approval`;
    
    try {
        const response = await window.authenticatedFetch(endpoint, { method: 'PUT' });
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || 'Falha no envio.');
        
        window.showToast('Item enviado para aprovação!', 'success');
        
        // Recarrega as listas relevantes
        const projectId = document.getElementById('shoppingProjectId').value;
        await window.fetchAndRenderBomItems(projectId); // Recarrega "Meu Pedido" e "Status dos Pedidos"

        // --- INÍCIO DA CORREÇÃO ---
        // SÓ tenta recarregar o painel de aprovação do Gestor se o usuário tiver permissão
        if (window.userPermissions.includes('project.shopping.approve')) {
             // O terceiro argumento 'approvalPanelContent' é o ID padrão do container
            await window.loadApprovalPanel(projectId, 'Aguardando Aprovação', 'approvalPanelContent');
        }
        // --- FIM DA CORREÇÃO ---

        // A linha "await window.loadSentItemsPanel(projectId);" foi removida daqui
        // porque fetchAndRenderBomItems já atualiza a aba "Status dos Pedidos".

    } catch (error) {
        window.showError(error.message);
    }
};

// ✅ NOVA FUNÇÃO: Carrega e exibe a lista de compras do projeto
window.openShoppingList = async function(projectId) {
    
    const container = document.getElementById('shoppingListContainer');
    if (!container) {
        console.error("❌ Container 'shoppingListContainer' não encontrado no HTML.");
        return;
    }

    container.innerHTML = '<div class="loading-spinner"></div>';
    container.style.display = 'block';

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/shopping-list/${projectId}`);
        if (!response.ok) throw new Error("Falha ao buscar lista de compras.");

        const data = await response.json();
        if (!data || data.length === 0) {
            container.innerHTML = '<p class="no-shopping-items">Nenhum item de compra encontrado para este projeto.</p>';
            return;
        }

        const html = data.map(item => `
            <div class="shopping-item">
                <div><strong>${item.descricao}</strong></div>
                <div>Fornecedor: ${item.fornecedor || '—'}</div>
                <div>Data Compra: ${window.formatDate(item.data_compra)}</div>
                <div>Entrega Prevista: ${window.formatDate(item.data_prevista_entrega)}</div>
                <div>Status: ${item.status || '—'}</div>
            </div>
        `).join('');

        container.innerHTML = `<div class="shopping-list">${html}</div>`;
    } catch (err) {
        
        container.innerHTML = `<p class="error-msg">Erro ao carregar lista de compras.</p>`;
    }
};

// ===================================================================
// FUNÇÃO PRINCIPAL PARA RENDERIZAR ITENS DA BOM
// ===================================================================
function renderBomItems(items, containerId, panelType = 'meuPedido') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container de BOM #${containerId} não encontrado.`);
        return;
    }

    // Agrupa por setor
    const itemsBySector = items.reduce((acc, item) => {
        const sector = item.setor || 'Geral';
        if (!acc[sector]) {
            acc[sector] = [];
        }
        acc[sector].push(item);
        return acc;
    }, {});

    // Limpa o container
    container.innerHTML = '';

    if (items.length === 0) {
        // ... (código para mensagem de "nenhum item" - sem alterações) ...
        if (panelType === 'meuPedido') {
            container.innerHTML = '<p class="no-items-message">Nenhum item em elaboração. Adicione um item usando o formulário acima.</p>';
        } else if (panelType === 'sent') {
             container.innerHTML = '<p class="no-items-message">Nenhum item enviado ou em processamento.</p>';
        } else if (panelType === 'approval') {
             container.innerHTML = '<p class="no-items-message">Nenhum item aguardando aprovação do Gestor.</p>';
        } else if (panelType === 'cotacoes') {
             container.innerHTML = '<p class="no-items-message">Nenhum item em cotação.</p>';
        } else if (panelType === 'director') {
             container.innerHTML = '<p class="no-items-message">Nenhum item aguardando aprovação da Diretoria.</p>';
        } else if (panelType === 'final') {
             container.innerHTML = '<p class="no-items-message">Nenhum item com status "Comprado".</p>';
        } else {
            container.innerHTML = '<p class="no-items-message">Nenhum item encontrado para este status.</p>';
        }
        return;
    }

    // Ordena os setores por nome
    const sortedSectors = Object.keys(itemsBySector).sort();

    // Renderiza cada grupo de setor
    for (const sector of sortedSectors) {
        const sectorItems = itemsBySector[sector];

        // Cria o card do grupo do setor
        const sectorGroup = document.createElement('div');
        sectorGroup.className = 'sector-group';
        sectorGroup.setAttribute('data-sector', sector); // Para estilização CSS

        const sectorTitle = document.createElement('div');
        sectorTitle.className = 'sector-title';

        const sectorName = document.createElement('h4');
        sectorName.textContent = sector;
        sectorTitle.appendChild(sectorName);

        // Adiciona botão "Enviar Setor" apenas no painel 'meuPedido'
        if (panelType === 'meuPedido' && window.userPermissions.includes('bom.submit')) {
            const sendSectorBtn = document.createElement('button');
            sendSectorBtn.className = 'action-button primary small send-sector-btn';
            sendSectorBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Setor p/ Aprovação';
            sendSectorBtn.setAttribute('data-permission', 'bom.submit');
            sendSectorBtn.onclick = () => window.submitBomSector(items[0].projeto_id, sector); // Assumindo que todos os itens no loop são do mesmo projeto
            sectorTitle.appendChild(sendSectorBtn);
        }

        sectorGroup.appendChild(sectorTitle);

        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'sector-items-container';

        // Renderiza cada item dentro do grupo do setor
        sectorItems.forEach(item => {
            const itemCard = document.createElement('div');
            const statusClass = item.status ? item.status.toLowerCase().replace(/ /g, '-') : 'status-desconhecido';
            itemCard.className = `bom-item-card ${statusClass}`;
            itemCard.id = `bom-item-${item.id}`;

            let actionsHtml = '';
            let statusBadgeHtml = '';

            // Lógica de Ações e Status por tipo de painel
            if (panelType === 'meuPedido') {
                 // ... (ações para Meu Pedido - sem alterações) ...
                if (item.status === 'Em Elaboração' || item.status === 'Reprovado') {
                     // Botão Editar (Requer bom.edit ou bom.create)
                    if (window.userPermissions.includes('bom.edit') || window.userPermissions.includes('bom.create')) {
                        actionsHtml += `
                            <button class="action-button info small" onclick="window.openEditBomItemModal(${item.id})" data-permission="bom.edit">
                                <i class="fas fa-edit"></i> Editar
                            </button>`;
                    }
                    // Botão Enviar (Requer bom.submit)
                    if (window.userPermissions.includes('bom.submit')) {
                         actionsHtml += `
                            <button class="action-button success small" onclick="window.submitBomItemForApproval(${item.id})" data-permission="bom.submit">
                                <i class="fas fa-paper-plane"></i> Enviar
                            </button>`;
                    }
                    // Botão Excluir (Requer bom.edit ou bom.create)
                    if (window.userPermissions.includes('bom.edit') || window.userPermissions.includes('bom.create')) {
                         actionsHtml += `
                            <button class="action-button danger small" onclick="window.deleteBomItem(${item.id})" data-permission="bom.edit">
                                <i class="fas fa-trash"></i> Excluir
                            </button>
                        `;
                    }
                }

            } else if (panelType === 'approval') {
                // ... (ações para Aprovação Gestores - sem alterações) ...
                statusBadgeHtml = getStatusBadgeHtml(item.status);
                 // Botões Aprovar/Reprovar (Requer project.shopping.approve)
                if (window.userPermissions.includes('project.shopping.approve')) {
                    actionsHtml = `
                        <div class="bom-item-approval-actions" data-permission="project.shopping.approve">
                            <button class="action-button danger small" onclick="window.approveOrReproveBomItem(${item.id}, 'Reprovado')">
                                <i class="fas fa-times"></i> Reprovar
                            </button>
                            <button class="action-button success small" onclick="window.approveOrReproveBomItem(${item.id}, 'Em Cotação')">
                                <i class="fas fa-check"></i> Aprovar
                            </button>
                        </div>`;
                }

            } else if (panelType === 'cotacoes') {
                 // ... (ações para Cotações - sem alterações) ...
                statusBadgeHtml = getStatusBadgeHtml(item.status);
                // Botão "Enviar p/ Diretoria" (Requer acquisitions.manage)
                if (item.status === 'Em Cotação' && window.userPermissions.includes('acquisitions.manage')) {
                    actionsHtml += `
                        <button class="action-button success small" onclick="window.finalizeCotacao(${item.id})" data-permission="acquisitions.manage">
                            <i class="fas fa-check-double"></i> Enviar p/ Diretoria
                        </button>`;
                } else if (item.status === 'Cotação Finalizada') {
                     actionsHtml += '<span class="status-badge status-cotacao-finalizada">Cotação Finalizada</span>';
                }

            } else if (panelType === 'director') {
                 // ... (ações para Aprovação Diretoria - sem alterações) ...
                statusBadgeHtml = getStatusBadgeHtml(item.status);
                 // Botões Aprovar/Reprovar (Requer bom.approve.diretoria)
                 if (window.userPermissions.includes('bom.approve.diretoria')) {
                    actionsHtml = `
                        <div class="bom-item-approval-actions" data-permission="bom.approve.diretoria">
                            <button class="action-button danger small" onclick="window.approveOrReproveBomItem(${item.id}, 'Reprovado')">
                                <i class="fas fa-times"></i> Reprovar
                            </button>
                            <button class="action-button success small" onclick="window.approveOrReproveBomItem(${item.id}, 'Comprado')">
                                <i class="fas fa-check"></i> Aprovar Compra
                            </button>
                        </div>`;
                 }

            } else if (panelType === 'final') {
                 // ... (ações para Aprovação Final - sem alterações) ...
                statusBadgeHtml = getStatusBadgeHtml(item.status);

            } else if (panelType === 'sent') {
                // ############# INÍCIO DA MODIFICAÇÃO (AÇÕES) #############
                // Ações para "Status dos Pedidos"
                statusBadgeHtml = getStatusBadgeHtml(item.status);

                const canManageSentItemsStrict = window.userPermissions.includes('project.shopping.approve') ||
                                                 window.userPermissions.includes('bom.approve.diretoria');

                // Botão "Retornar p/ Elaboração"
                if ((item.status === 'Aguardando Aprovação' || item.status === 'Reprovado' || item.status === 'Em Cotação' || item.status === 'Aguardando Aprovação Diretoria') && canManageSentItemsStrict) {
                    actionsHtml += `
                        <button class="action-button warning small" onclick="window.returnBomItemToElaboration(${item.id})">
                            <i class="fas fa-undo"></i> Retornar p/ Elaboração
                        </button>`;
                }

                // Botão "Excluir (Permanente)"
                if (canManageSentItemsStrict && window.userPermissions.includes('bom.edit')) {
                     actionsHtml += `
                        <button class="action-button danger small" onclick="window.deleteBomItem(${item.id})">
                            <i class="fas fa-trash"></i> Excluir (Permanente)
                        </button>
                     `;
                }
                // ############# FIM DA MODIFICAÇÃO (AÇÕES) #############
            }

            // --- Montagem do Card ---

            // Orçamentos (parse seguro)
            let quotes = [];
            if (item.orcamentos) {
                try {
                    // Tenta parsear se for string, caso contrário assume que já é objeto/array
                    quotes = typeof item.orcamentos === 'string' ? JSON.parse(item.orcamentos) : item.orcamentos;
                } catch (e) {
                    console.error("Erro ao parsear orçamentos do item:", item.id, e);
                }
            }
             // Garante que é um array
            if (!Array.isArray(quotes)) {
                quotes = [];
            }

            const firstQuote = quotes.length > 0 ? quotes[0] : {};

            // Detalhes do item
            let detailsHtml = `
                <p class="item-info"><strong>Projeto:</strong> ${item.nome_projeto || 'N/A'}</p>
                <p class="item-info"><strong>Justificativa:</strong> ${item.justificativa || 'N/A'}</p>
            `;

            // ############# INÍCIO DA MODIFICAÇÃO (EXIBIÇÃO DAS DATAS) #############
            // Mostra informações de status APENAS no painel 'sent'
            if (panelType === 'sent') {
                
                // Formata as datas (vindo do server.js)
                const dataSolicitanteFmt = item.data_solicitante ? `<em>(${window.formatDate(item.data_solicitante, false) || 'Data Inválida'})</em>` : '<em>(Pendente)</em>';
                const dataGestorFmt = item.data_gestor ? `<em>(${window.formatDate(item.data_gestor, false) || 'Data Inválida'})</em>` : '<em>(Pendente)</em>';
                const dataCotacaoFmt = item.data_cotacao ? `<em>(${window.formatDate(item.data_cotacao, false) || 'Data Inválida'})</em>` : '<em>(Pendente)</em>';
                const dataAprovadorFinalFmt = item.data_aprovador_final ? `<em>(${window.formatDate(item.data_aprovador_final, false) || 'Data Inválida'})</em>` : '<em>(Pendente)</em>';

                let finalApprovalLabel = "Aprov. Diretor:";
                let finalApprovalName = item.nome_aprovador_final || 'Pendente'; // Usa o campo 'nome_aprovador_final'
                let finalApprovalClass = "info-diretor";
                let finalApprovalIcon = "fa-user-tie";

                if (item.status === 'Reprovado') {
                    finalApprovalLabel = "Reprovado por:";
                    finalApprovalName = item.nome_aprovador_final || 'Pendente'; // 'nome_aprovador_final' também armazena o reprovador
                    finalApprovalClass = "info-reprovado";
                    finalApprovalIcon = "fa-user-times";
                }

                // Constroi o HTML com os nomes E as datas
                detailsHtml += `
                    <p class="item-info info-solicitante">
                        <i class="fas fa-user-edit"></i> <strong>Solicitante:</strong> ${item.nome_solicitante || 'Pendente'} ${dataSolicitanteFmt}
                    </p>
                    <p class="item-info info-gestor">
                        <i class="fas fa-user-check"></i> <strong>Aprov. Gestor:</strong> ${item.nome_gestor || 'Pendente'} ${dataGestorFmt}
                    </p>
                    <p class="item-info info-cotacao">
                        <i class="fas fa-dollar-sign"></i> <strong>Cotação:</strong> ${item.nome_cotacao || 'Pendente'} ${dataCotacaoFmt}
                    </p>
                    <p class="item-info ${finalApprovalClass}">
                       <i class="fas ${finalApprovalIcon}"></i>
                       <strong>${finalApprovalLabel}</strong> ${finalApprovalName} ${dataAprovadorFinalFmt}
                    </p>
                `;
            } else if (panelType !== 'director' && panelType !== 'final') {
                 // Mostra fornecedor/valor sugerido se NÃO estiver nos painéis de aprovação final
                 detailsHtml += `
                    <p class="item-info"><strong>Fornecedor Sugerido:</strong> ${firstQuote.fornecedor || 'N/A'}</p>
                    <p class="item-info"><strong>Valor Sugerido (Unit):</strong> ${window.formatCurrency(firstQuote.valor_unitario)}</p>
                 `;
             }
             // ############# FIM DA MODIFICAÇÃO (EXIBIÇÃO DAS DATAS) #############


            // Adiciona informações do orçamento APROVADO (para painéis 'director', 'final' e 'sent')
             if (panelType === 'director' || panelType === 'final' || (panelType === 'sent')) { 
                 if (item.fornecedor_aprovado && item.valor_aprovado) {
                     detailsHtml += `
                        <hr style="border: 0; border-top: 1px dashed var(--info-color); margin: 10px 0;">
                        <p class="item-info"><strong>Selecionado:</strong> ${item.fornecedor_aprovado}</p>
                        <p class="item-info"><strong>Valor (Unit):</strong> ${window.formatCurrency(item.valor_aprovado)}</p>
                        <p class="item-info"><strong>Valor Total (Qtd: ${item.quantidade}):</strong> ${window.formatCurrency(item.valor_total_item || (item.valor_aprovado * item.quantidade))}</p>
                        ${item.link_produto ? `<p class="item-info"><strong>Link:</strong> <a href="${item.link_produto}" target="_blank" rel="noopener noreferrer">Abrir Link</a></p>` : ''}
                     `;
                 } else if (panelType !== 'sent' || item.status === 'Aguardando Aprovação Diretoria' || item.status === 'Cotação Finalizada') {
                    detailsHtml += `
                        <hr style="border: 0; border-top: 1px dashed var(--warning-color); margin: 10px 0;">
                        <p class="item-info" style="color: var(--warning-color);"><strong>Aguardando seleção/aprovação final do orçamento.</strong></p>
                     `;
                 }
            }


            itemCard.innerHTML = `
                <div class="bom-item-main-content">
                    ${panelType === 'approval' || panelType === 'director' ? `<div class="solicitacao-checkbox-container"><input type="checkbox" class="solicitacao-checkbox" data-id="${item.id}"></div>` : ''}

                    <div class="bom-item-image">
                        ${item.url_imagem ? `<img src="${item.url_imagem}" alt="Imagem do Item">` : '<i class="fas fa-image"></i>'}
                    </div>

                    <div class="bom-item-details">
                        <p class="item-descricao">${item.descricao} (Qtd: ${item.quantidade})</p>
                        ${detailsHtml}
                        ${statusBadgeHtml ? `<div class="bom-item-status-badge ${statusClass}">${item.status}</div>` : ''}
                    </div>

                    <div class="bom-item-actions action-stack">
                        ${actionsHtml}
                    </div>
                </div>

                 ${(window.userPermissions.includes('acquisitions.view') || window.userPermissions.includes('acquisitions.manage') || panelType === 'meuPedido') ? `
                    <button class="bom-item-quotes-toggle" onclick="window.toggleBomItemQuotes(this, ${item.id}, '${panelType}')">
                        <i class="fas fa-chevron-down"></i> Ver Orçamentos (${quotes.length})
                    </button>
                    <div class="bom-item-quotes-container" id="quotes-container-${item.id}">
                        </div>
                ` : ''}
            `;

            itemsContainer.appendChild(itemCard);
        });

        sectorGroup.appendChild(itemsContainer);
        container.appendChild(sectorGroup);
    }

    // Re-aplica as permissões de UI após a renderização (para botões dinâmicos)
    if (window.applyUIPermissions) {
        window.applyUIPermissions(window.getCurrentUser()?.role, `#${containerId}`); // Passa o ID do container para aplicar apenas nele
    }
}

// ===================================================================
// NOVA FUNÇÃO: CARREGAR PAINEL DE COTAÇÕES (AQUISIÇÕES)
// ===================================================================
async function loadCotacoesPanel(projectId) {
    // Esta verificação é crucial e redundante para segurança.
    if (!window.userPermissions.includes('acquisitions.view') && !window.userPermissions.includes('acquisitions.manage')) {
        
        return; 
    }

    const container = document.getElementById('cotacoesListContainer');
    if (!container) return;
    container.innerHTML = '<p class="loading-message">Carregando itens para cotação...</p>';

    try {
        // Esta rota busca itens com status 'Em Cotação' ou 'Cotação Finalizada'
        const response = await window.authenticatedFetch(`/api/cotacoes`);
        if (!response.ok) {
            throw new Error('Falha ao buscar itens para cotação');
        }
        const items = await response.json();
        
        // Filtra os itens para mostrar APENAS os do projeto atual
        const projectItems = items.filter(item => item.projeto_id == projectId);

        if (projectItems.length === 0) {
            container.innerHTML = '<p class="no-items-message">Nenhum item deste projeto aguardando cotação.</p>';
            return;
        }

        // A função renderBomItems (que já existe no seu arquivo) será chamada para desenhar os cards
        renderBomItems(projectItems, container.id, 'cotacoes');
    } catch (error) {
        
        container.innerHTML = `<p class="no-items-message error-message">Erro ao carregar cotações. ${error.message}</p>`;
    }
}


// ===============================================
// INÍCIO: NOVAS FUNÇÕES DE ALERTA DO DASHBOARD
// ===============================================

/**
 * NOVO: Filtra a lista de projetos visíveis na Tela 2.
 * @param {number[]} projectIdsToShow - Um array de IDs de projeto a serem exibidos. Se nulo, mostra todos.
 */
function filterProjectsByAlert(projectIdsToShow = null) {
    const projectsContainer = document.getElementById('projectsContainer');
    if (!projectsContainer) return;

    const allProjectCards = projectsContainer.querySelectorAll('.project-card');
    let projectsFound = 0;

    allProjectCards.forEach(card => {
        // Se projectIdsToShow for nulo (ou seja, limpando o filtro), mostra todos.
        // Se não for nulo, verifica se o ID do card está na lista.
        if (projectIdsToShow === null || projectIdsToShow.includes(parseInt(card.dataset.projectId))) {
            card.style.display = 'grid'; // 'grid' é o display padrão do card
            projectsFound++;
        } else {
            card.style.display = 'none';
        }
    });

    // Limpa mensagens de "nenhum projeto" se houver
    let noProjectsMessage = projectsContainer.querySelector('.no-projects');
    if (noProjectsMessage) noProjectsMessage.remove();

    if (projectsFound === 0 && projectIdsToShow !== null) {
        // Adiciona uma mensagem de "nenhum projeto" se o filtro não retornar nada
        const message = document.createElement('p');
        message.className = 'no-projects';
        message.textContent = 'Nenhum projeto ativo corresponde ao seu filtro de alerta.';
        projectsContainer.appendChild(message);
    } else if (allProjectCards.length > 0 && projectsFound === 0 && projectIdsToShow === null) {
        // Caso em que limpamos o filtro, mas não havia projetos (improvável, mas seguro)
        const message = document.createElement('p');
        message.className = 'no-projects';
        message.textContent = 'Nenhum projeto ativo encontrado.';
        projectsContainer.appendChild(message);
    }
}


/**
 * NOVO: Função auxiliar para criar o HTML do alerta.
 */
function createAlertElement(className, iconName, message, actionText) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `dashboard-alert ${className}`;
    alertDiv.innerHTML = `
        <div class="alert-text">
            <i class="${iconName}"></i>
            ${message}
        </div>
        <div class="alert-action">
            ${actionText}
        </div>
    `;
    return alertDiv;
}

// ===============================================
// FIM: NOVAS FUNÇÕES DE ALERTA DO DASHBOARD
// ===============================================



/**
 * Cria o HTML para exibir o status de uma etapa específica do fluxo de aprovação da BOM.
 * Esta função utiliza a lógica de inferência para corrigir o bug de logs ausentes
 * em etapas intermediárias já superadas.
 * * @param {object} item - O item da BOM com os campos processados do backend.
 * @param {string} etapa - A chave do nome da etapa (ex: 'Solicitante', 'Lider', 'Gestor', 'Cotacao', 'Diretor', 'Financeiro').
 * @returns {string} HTML formatado.
 */
window.retornarParaElaboracao = async function(itemId) {
    if (!confirm('Tem certeza que deseja retornar este item para Elaboração? Todo o histórico de aprovação será apagado.')) return;

    const endpoint = `${API_BASE_URL}/bom-items/${itemId}/status`;
    
    try {
        const response = await window.authenticatedFetch(endpoint, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'Em Elaboração' }),
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Falha ao retornar para elaboração.');

        window.showToast('Item retornado para Elaboração. Histórico de aprovação apagado.', 'success');
        
        // Recarrega as listas relevantes
        const projectId = document.getElementById('shoppingProjectId').value;
        await window.fetchAndRenderBomItems(projectId); 

    } catch (error) {
        
        window.showError(error.message);
    }
};

function renderBomItemSentStatus(item, etapa) {
    // Mapeamento das chaves para os dados do item
    const chaveMap = {
        'Solicitante': { nome: item.nome_solicitante, data: item.data_solicitante, statusClass: 'info-solicitante' },
        'Lider': { nome: item.nome_lider, data: item.data_lider, statusClass: 'info-lider' },
        'Gestor': { nome: item.nome_gestor, data: item.data_gestor, statusClass: 'info-gestor' },
        'Cotacao': { nome: item.nome_cotacao, data: item.data_cotacao, statusClass: 'info-cotacao' },
        'Diretor': { nome: item.nome_diretor, data: item.data_diretor, statusClass: 'info-diretor' },
        'Financeiro': { nome: item.nome_financeiro, data: item.data_financeiro, statusClass: 'info-financeiro' }
    };

    const etapaData = chaveMap[etapa];
    
    // Mapeamento de rótulos para exibição
    const etapaLabelMap = {
        'Solicitante': 'Solicitante',
        'Lider': 'Aprov. Líder',
        'Gestor': 'Aprov. Gestor',
        'Cotacao': 'Cotações',
        'Diretor': 'Aprov. Diretoria',
        'Financeiro': 'Aprov. Financeiro',
        'Aprov. Final': 'Aprov. Final'
    };
    const etapaLabel = etapaLabelMap[etapa] || etapa;

    let icon = 'fas fa-hourglass-half';
    let statusClass = 'pending-status';
    let statusText = 'Pendente';
    let detail = 'Pendente';
    
    // Processamento da etapa atual (Solicitante, Líder, Gestor, Diretoria, Financeiro)
    if (etapaData) {
        const { nome, data, statusClass: defaultClass } = etapaData;
        const dataObj = data ? new Date(data) : null;
        const dataFormatada = dataObj && !isNaN(dataObj.getTime()) ? dataObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null;
        
	        if (nome && dataFormatada) {
	            // Lógica de correção para o Solicitante: Sempre exibe o nome e a data de envio (se existirem)
	            if (etapa === 'Solicitante') {
	                statusText = 'Enviado';
	                icon = 'fas fa-paper-plane';
	                statusClass = defaultClass;
	                detail = `${nome} em ${dataFormatada}`;
	            } else {
	                statusText = etapa === 'Cotacao' ? 'Cotação Selecionada' : 'Aprovado';
	                icon = etapa === 'Cotacao' ? 'fas fa-hand-holding-usd' : 'fas fa-check-circle';
	                statusClass = defaultClass;
	                detail = `${statusText} por ${nome} em ${dataFormatada}`;
	            }
	        } else {
	             // Lógica para Reprovado em etapas iniciais (onde o log de reprovação é mais recente)
	            if (item.status === 'Reprovado' && item.nome_reprovador) {
	                 statusText = 'Reprovado';
	                 icon = 'fas fa-times-circle';
	                 statusClass = 'info-reprovado';
	                 detail = `Reprovado`;
	            }
	        }
	        
	        // Lógica para o Solicitante quando não há log (está 'Em Elaboração' ou 'Pendente')
	        if (etapa === 'Solicitante' && !nome) {
	            if (item.status === 'Em Elaboração') {
	                statusText = 'Em Elaboração';
	                icon = 'fas fa-edit';
	                statusClass = 'info-solicitante';
	                detail = statusText;
	            } else {
	                // Se for Solicitante e ainda estiver pendente (sem log de envio), exibe Pendente
	                statusText = 'Pendente';
	                icon = 'fas fa-hourglass-half';
	                statusClass = 'pending-status';
	                detail = statusText;
	            }
	        }
    }

    // Lógica para a linha FINAL (Sobrescreve qualquer inferência se o status final for claro)
    if (etapa === 'Aprov. Final') {
        if (item.status === 'Comprado') {
            const dataFinal = item.data_aprovador_final ? new Date(item.data_aprovador_final).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A';
            icon = 'fas fa-star';
            statusClass = 'info-financeiro'; // Usando financeiro/Diretoria para o final
            statusText = 'Comprado';
            detail = `${item.nome_aprovador_final || 'N/A'} em ${dataFinal}`;
        } else if (item.status === 'Reprovado' && item.nome_reprovador) {
            const dataReprovada = item.data_reprovador ? new Date(item.data_reprovador).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A';
             
            icon = 'fas fa-times-circle';
            statusClass = 'info-reprovado';
            statusText = 'Reprovado';
            detail = `Por ${item.nome_reprovador} em ${dataReprovada}`;
        } else if (item.status === 'Em Elaboração') {
            icon = 'fas fa-edit';
            statusClass = 'info-solicitante';
            statusText = 'Em Elaboração';
            detail = statusText;
        } else {
            icon = 'fas fa-hourglass-half';
            statusClass = 'pending-status';
            statusText = 'Em Fluxo';
            detail = `Status: ${item.status}`;
        }
    }
    
    // Conserta a exibição de 'Pendente' para 'Aprovado' em etapas iniciais, SE A PRÓXIMA JÁ EXISTE (A correção do bug)
    // Se o Gestor aprovou (tem nome_gestor), o Líder deve ser considerado Aprovado.
    if (etapa === 'Lider' && item.nome_gestor) {
        if (etapaData.nome === null) {
            statusText = 'Aprovado (Inferido)';
            icon = 'fas fa-check-circle';
            statusClass = 'info-lider';
            detail = `Aprovado (Log Ausente)`;
        }
    }
    // Se a Cotação foi selecionada (tem nome_cotacao), o Gestor deve ser considerado Aprovado.
    if (etapa === 'Gestor' && item.nome_cotacao) {
         if (etapaData.nome === null) {
            statusText = 'Aprovado (Inferido)';
            icon = 'fas fa-check-circle';
            statusClass = 'info-gestor';
            detail = `Aprovado (Log Ausente)`;
         }
    }
    
    // Se a Diretoria aprovou, Gestor e Líder devem ser considerados Aprovados (e Gestor aprovado se o Líder foi pulado).
    if ((etapa === 'Lider' || etapa === 'Gestor') && item.nome_diretor) {
        if (etapaData.nome === null) {
            statusText = 'Aprovado (Inferido)';
            icon = 'fas fa-check-circle';
            statusClass = etapa === 'Lider' ? 'info-lider' : 'info-gestor';
            detail = `Aprovado (Log Ausente)`;
        }
    }


    const finalDetail = detail || 'Pendente';

    return `
        <div class="item-info">
            <i class="${icon} ${statusClass}"></i>
            <strong>${etapaLabel}:</strong>
            <span class="activity-status-text ${statusClass}">${finalDetail}</span>
        </div>
    `;
}

window.approveDiretoriaBomItem = async function(itemId) {
    if (!confirm('Tem certeza que deseja aprovar este item? Ele será enviado para aprovação do Financeiro.')) {
        return;
    }
    
    // 1. Captura o ID do projeto do modal (necessário para recarregar a lista)
    const projectId = document.getElementById('shoppingProjectId').value;
    if (!projectId) {
        window.showError('ID do Projeto não encontrado no modal.', 'error');
        return;
    }

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/solicitacoes/${itemId}/approve-final`, {
            method: 'PUT'
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Falha na aprovação da Diretoria.');
        }

        window.showToast(data.message, 'success');
        
        // =========================================================================
        // CRÍTICO: RECARREGA A LISTA DE COMPRAS E MUDA PARA A ABA CORRETA
        // =========================================================================
        const updatedProjectId = data.projeto_id || projectId;
        if (updatedProjectId) {
            // 1. Força o recarregamento do conteúdo da BOM, atualizando todas as abas.
            await window.fetchAndRenderProjectBOM(updatedProjectId); 
            
            // 2. Muda a aba ativa para "Painel Aprovação Financeiro"
            window.switchShoppingPanel('financialApprovalPanel');
        }
        // FIM DA CORREÇÃO
        
    } catch (error) {
        
        window.showError('Erro ao aprovar item pela Diretoria: ' + error.message);
    }
};