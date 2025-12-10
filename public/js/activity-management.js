// =================================================================
// NOVA FUNÇÃO (CORREÇÃO)
// Esta é a nova função dedicada para ser chamada pelo botão no index.html
// =================================================================
window.handleOpenAssignModal_Tela7 = function() {
    console.log("Botão da Tela 7 clicado, chamando modal de atribuição...");
    // Chama a função já existente neste arquivo que abre o modal
    window.openAssignManagementActivityModal(); 
};
// =================================================================

// activity-management.js (VERSÃO FINAL E COMPLETA)
window.initializeManagementActivitiesScreen = function() {
    console.log('Tela 7: Inicializando Gerenciamento de Atividades...');

    // --- INÍCIO DA CORREÇÃO ---
    // Adiciona o listener para o botão principal de abrir o modal
    const openModalBtn = document.getElementById('openAssignActivityModalBtn');
    if (openModalBtn) {
        // Previne múltiplos listeners se a tela for recarregada
        if (!openModalBtn.dataset.listenerAttached) {
            openModalBtn.addEventListener('click', () => {
                // Chama a função global que já existe neste arquivo
                window.openAssignManagementActivityModal(); 
            });
            openModalBtn.dataset.listenerAttached = 'true';
        }
    }
    // --- FIM DA CORREÇÃO ---
    
    window.fetchAndRenderUsersAsEmployees('', 1); 

    const searchInput = document.getElementById('employeeSearchInput');
    const searchButton = document.getElementById('searchEmployeesBtn');

    if (searchInput && searchButton) {
        searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                window.fetchAndRenderUsersAsEmployees(searchInput.value, 1);
            }
        });

        searchButton.addEventListener('click', () => {
            window.fetchAndRenderUsersAsEmployees(searchInput.value, 1);
        });
    }
    
    const assignForm = document.getElementById('assignManagementActivityForm');
    if (assignForm) {
        assignForm.addEventListener('submit', assignManagementActivity);
        
        const searchInputAssign = document.getElementById('employeeSearchAssignInput');
        if (searchInputAssign) {
            searchInputAssign.addEventListener('input', () => {
                const modal = document.getElementById('addManagementActivityModal');
                const allEmployees = JSON.parse(modal.dataset.allEmployees || '[]');
                renderEmployeeSelectionList(allEmployees, searchInputAssign.value);
            });
        }
    }

    const editForm = document.getElementById('editManagementActivityModal');
    if (editForm) {
        editForm.addEventListener('submit', editManagementActivity);
    }
    
    if (window.applyUIPermissions) {
        window.applyUIPermissions(window.getCurrentUser()?.role);
    }
};

window.fetchAndRenderUsersAsEmployees = async function(searchTerm = '', page = 1) {
    const employeeListContainer = document.getElementById('employeeList');
    const paginationControls = document.getElementById('employeeListPagination');

    if (!employeeListContainer) return;
    employeeListContainer.innerHTML = '<p class="no-tools">Carregando funcionários...</p>';
    if (paginationControls) paginationControls.innerHTML = '';

    try {
        const limit = 10;
        const url = `${API_BASE_URL}/employees?search=${encodeURIComponent(searchTerm.trim())}&page=${page}&limit=${limit}`;
        const response = await window.authenticatedFetch(url);
        if (!response.ok) throw new Error('Erro ao buscar funcionários.');

        const { users: employees, pagination } = await response.json();
        
        employeeListContainer.innerHTML = '';

        if (employees.length === 0) {
            employeeListContainer.innerHTML = '<p class="no-tools">Nenhum funcionário encontrado.</p>';
            return;
        }

        for (const employee of employees) {
            const employeeCard = createEmployeeCardForManagement(employee);
            employeeListContainer.appendChild(employeeCard);
            await fetchAndStoreEmployeeActivities(employee.id, employeeCard);
        }
        
        renderPaginationControls(pagination, searchTerm);
        
        if (window.applyUIPermissions) window.applyUIPermissions(window.getCurrentUser()?.role);

    } catch (error) {
        console.error('Erro ao carregar funcionários (Tela 7):', error);
        employeeListContainer.innerHTML = `<p class="no-tools" style="color:red;">Erro ao carregar funcionários.</p>`;
    }
};

function renderPaginationControls(pagination, searchTerm) {
    let paginationContainer = document.getElementById('employeeListPagination');
    if (!paginationContainer) {
        paginationContainer = document.createElement('div');
        paginationContainer.id = 'employeeListPagination';
        paginationContainer.className = 'pagination-controls';
        document.querySelector('.management-activities-container').appendChild(paginationContainer);
    }
    paginationContainer.innerHTML = '';

    const { totalPages, currentPage } = pagination;
    if (totalPages <= 1) return;

    const prevButton = document.createElement('button');
    prevButton.innerHTML = '&laquo; Anterior';
    prevButton.className = 'page-btn';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => {
        window.fetchAndRenderUsersAsEmployees(searchTerm, currentPage - 1);
    });
    paginationContainer.appendChild(prevButton);

    const pageInfo = document.createElement('span');
    pageInfo.className = 'page-info';
    pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
    paginationContainer.appendChild(pageInfo);

    const nextButton = document.createElement('button');
    nextButton.innerHTML = 'Próximo &raquo;';
    nextButton.className = 'page-btn';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => {
        window.fetchAndRenderUsersAsEmployees(searchTerm, currentPage + 1);
    });
    paginationContainer.appendChild(nextButton);
}

async function fetchAndStoreEmployeeActivities(employeeId, employeeCard) {
    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/employees/${employeeId}/activities`);
        if (!response.ok) throw new Error('Falha ao carregar as atividades.');
        const activities = await response.json();

        employeeCard.dataset.activities = JSON.stringify(activities);
        
        employeeCard.classList.remove('has-activities', 'no-activities');

        const hasPendingActivities = activities.some(activity => activity.status !== 'Concluida');

        if (hasPendingActivities) {
            employeeCard.classList.add('has-activities');
        } else {
            employeeCard.classList.add('no-activities');
        }
        
        renderActivitiesForEmployee(employeeCard, 1);

    } catch (error) {
        const activitiesListContainer = employeeCard.querySelector('.employee-activities-list');
        if (activitiesListContainer) {
            activitiesListContainer.innerHTML = `<p class="no-activities-found" style="color:red;">Erro ao carregar atividades.</p>`;
        }
    }
}

function updateActivityIndicator(employeeCard, activities) {
    employeeCard.classList.remove('has-activities', 'no-activities');
    
    const placeholder = employeeCard.querySelector('.activity-indicator-placeholder');
    if (!placeholder) {
        console.error("Placeholder do indicador de atividade não encontrado no card.");
        return;
    }
    placeholder.innerHTML = '';

    if (activities.length > 0) {
        employeeCard.classList.add('has-activities'); 

        const indicator = document.createElement('div');
        indicator.className = 'activity-indicator';
        indicator.title = `${activities.length} atividade(s) atribuída(s)`;
        indicator.innerHTML = `
            <i class="fas fa-clock"></i>
            <span class="activity-count-badge">${activities.length}</span>
        `;

        placeholder.appendChild(indicator);

    } else {
        employeeCard.classList.add('no-activities');
    }
}

function renderActivitiesForEmployee(employeeCard, page) {
    const activitiesListContainer = employeeCard.querySelector('.employee-activities-list');
    const allActivities = JSON.parse(employeeCard.dataset.activities || '[]'
);
    const noActivitiesMsg = employeeCard.querySelector('.no-activities-found');

    const showConcluidas = employeeCard.querySelector('.filter-checkbox[value="concluida"]').checked;
    const showPendentes = employeeCard.querySelector('.filter-checkbox[value="pendente"]').checked;
    const searchTerm = employeeCard.querySelector('.activity-search-input').value.toLowerCase();

    const filteredActivities = allActivities.filter(activity => {
        const isConcluida = activity.status === 'Concluida';
        
        let matchesCheckbox = false;
        if (showConcluidas && isConcluida) matchesCheckbox = true;
        if (showPendentes && !isConcluida) matchesCheckbox = true;
        
        const activityDescription = activity.descricao.toLowerCase();
        const projectName = (activity.projeto_nome || '').toLowerCase();

        const matchesSearch = searchTerm === '' || 
                              activityDescription.includes(searchTerm) || 
                              projectName.includes(searchTerm);

        return matchesCheckbox && matchesSearch;
    });
    
    const itemsPerPage = 6;
    const totalItems = filteredActivities.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedActivities = filteredActivities.slice(start, end);

    activitiesListContainer.innerHTML = '';
    if (paginatedActivities.length > 0) {
        paginatedActivities.forEach(activity => {
            activitiesListContainer.appendChild(createActivityItemForManagement(activity));
        });
    }

    if (noActivitiesMsg) {
        if (totalItems === 0 && allActivities.length > 0) {
           noActivitiesMsg.textContent = 'Nenhuma atividade corresponde ao filtro.';
           noActivitiesMsg.style.display = 'block';
           activitiesListContainer.appendChild(noActivitiesMsg);
        } else if (allActivities.length === 0) {
           noActivitiesMsg.textContent = 'Nenhuma atividade atribuída.';
           noActivitiesMsg.style.display = 'block';
           activitiesListContainer.appendChild(noActivitiesMsg);
        }
   }
   
    renderPaginationControlsForEmployee(employeeCard, page, totalPages);

    if (window.applyUIPermissions) window.applyUIPermissions(window.getCurrentUser()?.role);
}

function renderPaginationControlsForEmployee(employeeCard, currentPage, totalPages) {
    const paginationContainer = employeeCard.querySelector('.activities-pagination-controls');
    paginationContainer.innerHTML = '';

    if (totalPages <= 1) return;

    const prevButton = document.createElement('button');
    prevButton.innerHTML = '&laquo; Anterior';
    prevButton.className = 'page-btn';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentPageNum = parseInt(employeeCard.dataset.currentActivityPage, 10) || 1;
        renderActivitiesForEmployee(employeeCard, currentPageNum - 1);
    });
    paginationContainer.appendChild(prevButton);

    const pageInfo = document.createElement('span');
    pageInfo.className = 'page-info';
    pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
    paginationContainer.appendChild(pageInfo);

    const nextButton = document.createElement('button');
    nextButton.innerHTML = 'Próximo &raquo;';
    nextButton.className = 'page-btn';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentPageNum = parseInt(employeeCard.dataset.currentActivityPage, 10) || 1;
        renderActivitiesForEmployee(employeeCard, currentPageNum + 1);
    });
    paginationContainer.appendChild(nextButton);
}

function createEmployeeCardForManagement(employee) {
    const card = document.createElement('div');
    card.className = 'employee-card';
    card.dataset.employeeId = employee.id;

    const hasActivities = employee.has_active_activities > 0;
    card.classList.toggle('has-activities', hasActivities);
    card.classList.toggle('no-activities', !hasActivities);

    // Header
    const header = document.createElement('div');
    header.className = 'employee-card-header';
    
    // Wrapper de Informações
    const infoWrapper = document.createElement('div');
    infoWrapper.className = 'employee-info-wrapper';
    
    const name = document.createElement('h4');
    name.textContent = employee.nome;
    infoWrapper.appendChild(name);
    
    const role = document.createElement('p');
    role.textContent = employee.role || 'Cargo não definido';
    infoWrapper.appendChild(role);
    header.appendChild(infoWrapper);

    // Wrapper da Direita (Indicador + Botões)
    const rightWrapper = document.createElement('div');
    rightWrapper.className = 'employee-header-right';
    
    // Placeholder do Indicador de Atividade
    const indicatorPlaceholder = document.createElement('div');
    indicatorPlaceholder.className = 'activity-indicator-placeholder';
    // O indicador (relógio) será preenchido por fetchAndStoreEmployeeActivities
    rightWrapper.appendChild(indicatorPlaceholder);

    // Wrapper de Ações (Botões)
    const actionsWrapper = document.createElement('div');
    actionsWrapper.className = 'employee-actions';

    // Botão Atribuir Atividade
    const assignButton = document.createElement('button');
    assignButton.className = 'action-button primary assign-activity-btn';
    assignButton.innerHTML = '<i class="fas fa-plus-circle"></i> Atribuir Atividade';
    assignButton.dataset.employeeId = employee.id;
    assignButton.dataset.employeeName = employee.nome;
    
    // --- INÍCIO DA CORREÇÃO ---
    // Adiciona o listener de clique que estava faltando
    assignButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Impede que o clique no botão expanda/recolha o card
        // Chama a função global para abrir o modal com os dados deste funcionário
        window.openAssignManagementActivityModal(employee.id, employee.nome);
    });
    // --- FIM DA CORREÇÃO ---
    
    actionsWrapper.appendChild(assignButton);

    // Botão Ver Atividades (Tela 8)
    const viewButton = document.createElement('button');
    viewButton.className = 'action-button info view-activities-btn';
    viewButton.innerHTML = '<i class="fas fa-eye"></i> Ver Atividades';
    viewButton.dataset.employeeId = employee.id;
    viewButton.addEventListener('click', (e) => {
        e.stopPropagation();
        window.switchScreen('tela8', false, { employeeId: employee.id });
    });
    actionsWrapper.appendChild(viewButton);
    
    rightWrapper.appendChild(actionsWrapper);
    header.appendChild(rightWrapper);

    // Ícone de Expandir
    const expandIcon = document.createElement('i');
    expandIcon.className = 'fas fa-chevron-down expand-icon';
    header.appendChild(expandIcon);
    
    card.appendChild(header);

    // Corpo (Conteúdo expansível)
    const body = document.createElement('div');
    body.className = 'employee-card-body';
    body.innerHTML = `
        <div class="activity-filter-controls">
            <div class="filter-search-group">
                <input type="text" class="activity-search-input" placeholder="Buscar atividade por descrição...">
            </div>
            <div class="filter-checkbox-group">
                <label><input type="checkbox" class="activity-status-filter" value="Pendente" checked> Pendente</label>
                <label><input type="checkbox" class="activity-status-filter" value="Em Andamento" checked> Em Andamento</label>
                <label><input type="checkbox" class="activity-status-filter" value="Concluida"> Concluída</label>
            </div>
        </div>
        <div class="employee-activities-list-container">
            <div class="employee-activities-list">
                <p class="no-activities-found">Carregando atividades...</p>
            </div>
            <div class="activities-pagination-controls"></div>
        </div>
    `;
    card.appendChild(body);

    // Event listener para expandir/recolher
    header.addEventListener('click', () => {
        card.classList.toggle('expanded');
    });

    return card;
}

function createActivityItemForManagement(activity) {
    const item = document.createElement('div');
    item.className = 'activity-item';
    item.dataset.activityId = activity.id;

    let statusClass = 'status-pendente';
    let statusText = activity.status;
    if (activity.status === 'Concluida') {
        statusClass = 'status-concluida';
        if (activity.data_conclusao) statusText += ` em ${window.formatDate(activity.data_conclusao, true)}`;
    } else if (activity.status === 'Em Andamento') {
        statusClass = 'status-em-andamento';
    } else if (activity.data_limite && new Date(activity.data_limite) < new Date(new Date().toDateString())) {
        statusClass = 'status-atrasado';
        statusText = 'Atrasado';
    }

   const parseComments = (comments, type) => {
    if (!comments) return [];
    const commentStrings = comments.trim().split('\n[');

    return commentStrings.filter(c => c.trim()).map((commentString, index) => {
        let fullCommentText = commentString;

        if (index > 0) {
            fullCommentText = '[' + commentString;
        }
        const match = fullCommentText.match(/^\[(\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2})\] (.*?): ([\s\S]*)$/);

        if (match) {
            const [, timestamp, author, commentText] = match;
            
            const parts = timestamp.split(', ');
            const dateParts = parts[0].split('/');
            const timeParts = parts[1].split(':');
            const newDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1]);
            
            return { 
                timestamp: newDate, 
                author, 
                text: commentText.trim(), 
                type 
            };
        }
        return null;
    }).filter(Boolean); 
};

function getStringHash(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; 
    }
    return Math.abs(hash); 
}

const AUTHOR_CLASSES = {
    numColors: 5,
    authorMap: new Map(),
    lastColorIndex: 0, 
    
    getClassForAuthor(author) {
        if (this.authorMap.has(author)) {
            return this.authorMap.get(author);
        }
        
        this.lastColorIndex = (this.lastColorIndex % this.numColors) + 1;
        const className = `user-color-${this.lastColorIndex}`;
        
        this.authorMap.set(author, className);
        return className;
    }
};

    const allComments = [
        ...parseComments(activity.comentarios, 'employee'),
        ...parseComments(activity.leader_comments, 'leader')
    ];

    allComments.sort((a, b) => a.timestamp - b.timestamp);

    const commentsHtml = allComments.map(comment => {
    
    let commentClass = 'comment-item';

    if (comment.type === 'leader') {
        commentClass += ' leader-comment';
    } else {
        commentClass += ' ' + AUTHOR_CLASSES.getClassForAuthor(comment.author);
    }
    
    const formattedDate = window.formatDate(comment.timestamp, true);
    
    return `
        <div class="${commentClass}">
            <strong>[${formattedDate}] ${comment.author}:</strong> ${comment.text}
        </div>
    `;
}).join('');

    item.innerHTML = `
        <div class="activity-layout-grid">
            <div class="activity-item-header">
                <div class="activity-hierarchy-info">
                    <div class="hierarchy-level">
                        <span class="hierarchy-label">Projeto:</span>
                        <span class="hierarchy-value">${activity.projeto_nome || 'N/A'}</span>
                    </div>
                    <div class="hierarchy-level">
                        <span class="hierarchy-label">Etapa:</span>
                        <span class="hierarchy-value">${activity.etapa_nome || 'N/A'}</span>
                    </div>
                    <div class="hierarchy-level">
                        <span class="hierarchy-label">Setor:</span>
                        <span class="hierarchy-value">${activity.setor_nome || 'N/A'}</span>
                    </div>
                    <div class="hierarchy-level">
                        <span class="hierarchy-label">Sub-Etapa:</span>
                        <span class="hierarchy-value">${activity.descricao || 'N/A'}</span>
                    </div>
                </div>

                <div class="activity-top-right-wrapper">
                    <div class="activity-meta-info">
                        <div class="meta-item">
                            <strong>Status:</strong>
                            <span class="${statusClass}">${statusText}</span>
                        </div>
                        <div class="meta-item">
                            <strong>Data Limite:</strong>
                            <span>${window.formatDate(activity.data_limite) || 'N/A'}</span>
                        </div>
                    </div>
                    <div class="activity-actions">
                    </div>
                </div>
            </div>

            <div class="activity-comments-unified">
                ${commentsHtml || '<p>Nenhum comentário.</p>'}
            </div>

            <form class="employee-comment-form">
                <textarea class="employee-comment-input" placeholder="Adicionar comentário como colaborador..."></textarea>
                <div class="employee-actions-wrapper">
                    <button type="submit" class="action-button primary small add-employee-comment-btn" data-activity-id="${activity.id}" data-user-name="${window.getCurrentUser()?.nome || 'Colaborador'}">
                        <i class="fas fa-paper-plane"></i> Enviar Comentário
                    </button>
                </div>
            </form>
        </div>
    `;

    const actionsContainer = item.querySelector('.activity-actions');
    if (activity.status === 'Concluida') {
        const reopenBtn = document.createElement('button');
        reopenBtn.className = 'action-button warning small reopen-management-activity-btn';
        reopenBtn.title = 'Reabrir Atividade';
        reopenBtn.innerHTML = '<i class="fas fa-undo"></i>';
        reopenBtn.addEventListener('click', () => window.reopenManagementActivity(activity.id));
        actionsContainer.appendChild(reopenBtn);
    }
    const editBtn = document.createElement('button');
    editBtn.className = 'action-button info small edit-management-activity-btn';
    editBtn.title = 'Editar Atividade';
    editBtn.innerHTML = '<i class="fas fa-edit"></i>';
    editBtn.addEventListener('click', () => window.openEditManagementActivityModal(activity.id));
    actionsContainer.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-button danger small delete-management-activity-btn';
    deleteBtn.title = 'Excluir Atividade';
    deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
    deleteBtn.addEventListener('click', () => window.deleteManagementActivity(activity.id));
    actionsContainer.appendChild(deleteBtn);

    item.querySelector('.employee-comment-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const input = form.querySelector('.employee-comment-input');
        const comentario = input.value.trim();
        const activityId = form.querySelector('.add-employee-comment-btn').dataset.activityId;
        
        if (comentario) {
            try {
                const response = await window.authenticatedFetch(`${API_BASE_URL}/management-activities/${activityId}/comment`, {
                    method: 'POST',
                    body: JSON.stringify({ comentario: comentario })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Erro ao enviar comentário.');
                }
                
                input.value = '';
                window.fetchAndRenderUsersAsEmployees(document.getElementById('employeeSearchInput').value);
                
            } catch (error) {
                console.error("Erro ao adicionar comentário:", error);
                window.showError(error.message);
            }
        }
    });

    return item;
}

// ========================================================
// FUNÇÕES DE LÓGICA DO MODAL DE ATRIBUIÇÃO (CORRIGIDAS)
// ========================================================

async function fetchEtapasForProject(projectId) {
    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/projetos/${projectId}/etapas`);
        if (!response.ok) throw new Error('Falha ao carregar etapas.');
        return await response.json();
    } catch (error) {
        console.error("Erro ao buscar etapas do projeto:", error);
        window.showError("Erro ao carregar etapas: " + error.message);
        return [];
    }
}

async function fetchSetoresForEtapa(etapaId) {
    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/etapas/${etapaId}/sub_etapas`);
        if (!response.ok) throw new Error('Falha ao carregar setores.');
        return await response.json();
    } catch (error) {
        console.error("Erro ao buscar setores da etapa:", error);
        window.showError("Erro ao carregar setores: " + error.message);
        return [];
    }
}

window.openAssignManagementActivityModal = async function(employeeId, employeeName) {
    console.log(`[DEBUG] Abrindo modal para atribuir atividade...`);
    
    const modal = document.getElementById('addManagementActivityModal');
    const employeeNameSpan = modal.querySelector('#employeeNameInModal');
    const employeeIdInput = modal.querySelector('#employeeIdForActivity');
    const projectSelect = modal.querySelector('#activityProjectSelect');
    const etapaSelect = modal.querySelector('#activityEtapaSelect');
    const setorSelect = modal.querySelector('#activitySetorSelect');
    const subEtapasContainer = modal.querySelector('#subEtapasListContainer'); // MODIFICADO
    const employeeListContainer = modal.querySelector('#employeeListContainer');
    const employeeSearchInput = modal.querySelector('#employeeSearchAssignInput');
    const employeePaginationControls = modal.querySelector('#employeePaginationControls');

    if (!modal || !employeeNameSpan || !employeeIdInput || !projectSelect || !etapaSelect || !setorSelect || !subEtapasContainer || !employeeListContainer || !employeeSearchInput || !employeePaginationControls) { // MODIFICADO
        console.error("Erro: Um ou mais elementos do modal de atribuição de atividade não foram encontrados. Verifique o HTML.");
        window.showError("Erro interno ao carregar o formulário. Por favor, entre em contato com o suporte.");
        return;
    }

    employeeNameSpan.textContent = employeeName;
    employeeIdInput.value = employeeId;
    projectSelect.innerHTML = '<option value="">Carregando projetos...</option>';
    etapaSelect.innerHTML = '<option value="">Selecione um projeto</option>';
    setorSelect.innerHTML = '<option value="">Selecione uma etapa</option>';
    subEtapasContainer.innerHTML = '<p class="no-tools">Selecione um setor primeiro</p>'; // MODIFICADO
    etapaSelect.disabled = true;
    setorSelect.disabled = true;
    employeeSearchInput.value = '';
    employeeListContainer.innerHTML = '';
    employeePaginationControls.innerHTML = '';
    
    window.openModal('addManagementActivityModal');

    try {
        const usersResponse = await window.authenticatedFetch(`${API_BASE_URL}/users/list`);
        if (!usersResponse.ok) throw new Error('Falha ao carregar colaboradores.');
        const allEmployees = await usersResponse.json();
        
        modal.dataset.allEmployees = JSON.stringify(allEmployees);
        renderEmployeeSelectionList(allEmployees);

        const projectsResponse = await window.authenticatedFetch(`${API_BASE_URL}/projetos?status=ativo`);
        if (!projectsResponse.ok) throw new Error('Falha ao carregar projetos.');
        const projects = await projectsResponse.json();
        
        projectSelect.innerHTML = '<option value="">Selecione um Projeto</option>';
        projects.forEach(proj => {
            const option = new Option(proj.nome, proj.id);
            projectSelect.appendChild(option);
        });

    } catch (error) {
        console.error("Erro ao carregar dados do modal de atribuição:", error);
        projectSelect.innerHTML = '<option value="">Erro ao carregar projetos</option>';
        window.showError("Erro ao carregar dados do formulário: " + error.message);
    }
    
    projectSelect.onchange = async () => {
        const projectId = projectSelect.value;
        etapaSelect.innerHTML = '<option value="">Carregando etapas...</option>';
        setorSelect.innerHTML = '<option value="">Selecione uma etapa</option>';
        subEtapasContainer.innerHTML = '<p class="no-tools">Selecione um setor primeiro</p>'; // MODIFICADO
        etapaSelect.disabled = !projectId;
        setorSelect.disabled = true;

        if (projectId) {
            const etapas = await fetchEtapasForProject(projectId);
            etapaSelect.innerHTML = '<option value="">Selecione uma Etapa</option>';
            etapas.forEach(etapa => {
                const option = new Option(etapa.nome_etapa, etapa.id);
                etapaSelect.appendChild(option);
            });
            etapaSelect.disabled = false;
        }
    };

    etapaSelect.onchange = async () => {
        const etapaId = etapaSelect.value;
        setorSelect.innerHTML = '<option value="">Carregando setores...</option>';
        subEtapasContainer.innerHTML = '<p class="no-tools">Selecione um setor primeiro</p>'; // MODIFICADO
        setorSelect.disabled = !etapaId;

        if (etapaId) {
            const setores = await fetchSetoresForEtapa(etapaId);
            setorSelect.innerHTML = '<option value="">Selecione um Setor</option>';
            setores.forEach(setor => {
                const option = new Option(setor.nome, setor.id);
                setorSelect.appendChild(option);
            });
            setorSelect.disabled = false;
        }
    };

    setorSelect.onchange = async () => {
    const etapaId = etapaSelect.value;
    const setorId = setorSelect.value;
    subEtapasContainer.innerHTML = '<p class="no-tools">Carregando sub-etapas...</p>';

    if (setorId) {
        try {
            const setores = await fetchSetoresForEtapa(etapaId);
            const setorSelecionado = setores.find(s => s.id == setorId);
            subEtapasContainer.innerHTML = '';

            if (setorSelecionado?.subEtapas?.length > 0) {
                
                const subEtapasNaoConcluidas = setorSelecionado.subEtapas.filter(sub => !sub.concluida);
                if (subEtapasNaoConcluidas.length > 0) {
                    subEtapasNaoConcluidas.forEach(sub => {
                        const item = document.createElement('div');
                        item.className = 'multi-select-item';
                        item.innerHTML = `
                            <input type="checkbox" 
                                   id="subetapa-${sub.sub_etapa_id}" 
                                   value="${sub.sub_etapa_id}" 
                                   class="sub-etapa-checkbox">
                            <label for="subetapa-${sub.sub_etapa_id}">
                                ${sub.descricao}
                                ${sub.status ? `<span class="status-badge ${sub.status.toLowerCase()}">${sub.status}</span>` : ''}
                            </label>
                        `;
                        subEtapasContainer.appendChild(item);
                        
                        item.addEventListener('click', (e) => {
                            const checkbox = item.querySelector('input[type="checkbox"]');
                            if (e.target !== checkbox) {
                                checkbox.checked = !checkbox.checked;
                            }
                            item.classList.toggle('selected', checkbox.checked);
                        });
                    });
                } else {
                    subEtapasContainer.innerHTML = '<p class="no-tools">Todas as sub-etapas deste setor já foram concluídas.</p>';
                }
            } else {
                subEtapasContainer.innerHTML = '<p class="no-tools">Nenhuma sub-etapa encontrada neste setor.</p>';
            }
        } catch (error) {
            subEtapasContainer.innerHTML = '<p class="no-tools error">Erro ao carregar sub-etapas. Tente novamente.</p>';
        }
    } else {
        subEtapasContainer.innerHTML = '<p class="no-tools">Selecione um setor primeiro</p>';
    }
}
}
const EMPLOYEES_PER_PAGE_ASSIGN = 6;
let currentEmployeePage = 1;

function renderEmployeeSelectionList(employees, searchTerm = '') {
    const listContainer = document.getElementById('employeeListContainer');
    const paginationControls = document.getElementById('employeePaginationControls');
    const employeeIdForActivity = document.getElementById('employeeIdForActivity').value;
    listContainer.innerHTML = '';
    paginationControls.innerHTML = '';

    const filtered = employees.filter(emp => emp.nome.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (filtered.length === 0) {
        listContainer.innerHTML = '<p class="no-tools">Nenhum colaborador encontrado.</p>';
        return;
    }

    const totalPages = Math.ceil(filtered.length / EMPLOYEES_PER_PAGE_ASSIGN);
    const start = (currentEmployeePage - 1) * EMPLOYEES_PER_PAGE_ASSIGN;
    const end = start + EMPLOYEES_PER_PAGE_ASSIGN;
    const paginatedEmployees = filtered.slice(start, end);

    paginatedEmployees.forEach(employee => {
        const item = document.createElement('div');
        item.className = 'multi-select-item';
        const isSelected = employee.id === parseInt(employeeIdForActivity);
        item.classList.toggle('selected', isSelected);

        item.innerHTML = `
            <input type="checkbox" id="employee-${employee.id}" value="${employee.id}" ${isSelected ? 'checked' : ''}>
            <label for="employee-${employee.id}">${employee.nome}</label>
        `;
        listContainer.appendChild(item);

        item.addEventListener('click', (e) => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
            }
            item.classList.toggle('selected', checkbox.checked);
        });
    });

    if (totalPages > 1) {
        const prevButton = document.createElement('button');
        prevButton.textContent = 'Anterior';
        prevButton.className = 'action-button secondary small';
        prevButton.disabled = currentEmployeePage === 1;
        prevButton.addEventListener('click', (e) => {
            e.stopPropagation();
            currentEmployeePage--;
            renderEmployeeSelectionList(employees, searchTerm);
        });
        paginationControls.appendChild(prevButton);

        const pageInfo = document.createElement('span');
        pageInfo.textContent = `Página ${currentEmployeePage} de ${totalPages}`;
        paginationControls.appendChild(pageInfo);

        const nextButton = document.createElement('button');
        nextButton.textContent = 'Próximo';
        nextButton.className = 'action-button secondary small';
        nextButton.disabled = currentEmployeePage === totalPages;
        nextButton.addEventListener('click', (e) => {
            e.stopPropagation();
            currentEmployeePage++;
            renderEmployeeSelectionList(employees, searchTerm);
        });
        paginationControls.appendChild(nextButton);
    }
}


async function assignManagementActivity(event) {
    event.preventDefault();
    const selectedSubEtapaIds = Array.from(document.querySelectorAll('#subEtapasListContainer input[type="checkbox"]:checked')).map(checkbox => checkbox.value);
    const selectedEmployeeIds = Array.from(document.querySelectorAll('#employeeListContainer input[type="checkbox"]:checked')).map(checkbox => checkbox.value);

    if (selectedSubEtapaIds.length === 0) {
        window.showError("Por favor, selecione pelo menos uma sub-etapa para atribuir.");
        return;
    }
    if (selectedEmployeeIds.length === 0) {
        window.showError("Por favor, selecione pelo menos um colaborador.");
        return;
    }

    try {
        for (const subEtapaId of selectedSubEtapaIds) {
            const response = await window.authenticatedFetch(`${API_BASE_URL}/sub-etapas/${subEtapaId}/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employeeIds: selectedEmployeeIds })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Falha ao atribuir a sub-etapa ID ${subEtapaId}.`);
            }
        }

        window.showToast("Atividade(s) atribuída(s) com sucesso!", 'success');
        window.closeModal('addManagementActivityModal');
        
        window.fetchAndRenderUsersAsEmployees(document.getElementById('employeeSearchInput').value);

    } catch (error) {
        console.error("Erro ao atribuir atividade(s):", error);
        window.showError(`Erro: ${error.message}`);
    }
}

window.openEditManagementActivityModal = async function(activityId) {
    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/management-activities/${activityId}`);
        if (!response.ok) throw new Error('Falha ao buscar dados da atividade.');
        const activity = await response.json();

        document.getElementById('editManagementActivityId').value = activity.id;
        document.getElementById('editManagementActivityDescription').value = activity.descricao;

        const dueDateInput = document.getElementById('editManagementActivityDueDate');
        if (activity.data_limite) {
            dueDateInput.value = activity.data_limite.split('T')[0];
        } else {
            dueDateInput.value = '';
        }

        window.openModal('editManagementActivityModal');
    } catch (error) {
        console.error('Erro ao abrir modal de edição de atividade:', error);
        window.showError(`Erro: ${error.message}`);
    }
};

async function editManagementActivity(event) {
    event.preventDefault();
    const activityId = document.getElementById('editManagementActivityId').value;
    const description = document.getElementById('editManagementActivityDescription').value;
    const dueDate = document.getElementById('editManagementActivityDueDate').value;

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/management-activities/${activityId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ descricao: description, data_limite: dueDate })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Falha ao atualizar a atividade.');
        }

        const result = await response.json();
        window.showToast(result.message, 'success');
        window.closeModal('editManagementActivityModal');
        window.fetchAndRenderUsersAsEmployees(document.getElementById('employeeSearchInput').value);
    } catch (error) {
        console.error('Erro ao editar atividade de gerenciamento:', error);
        window.showError(`Erro: ${error.message}`);
    }
}

window.deleteManagementActivity = async function(activityId) {
    if (!confirm('Tem certeza que deseja excluir esta atividade? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/management-activities/${activityId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Falha ao excluir a atividade.');
        }

        const result = await response.json();
        window.showToast(result.message, 'success');
        
        window.fetchAndRenderUsersAsEmployees(document.getElementById('employeeSearchInput').value);

    } catch (error) {
        console.error('Erro ao excluir atividade de gerenciamento:', error);
        window.showError(`Erro: ${error.message}`);
    }
};

window.reopenManagementActivity = async function(activityId) {
    if (!confirm('Tem certeza que deseja reabrir esta atividade? Ela voltará ao status "Pendente".')) {
        return;
    }

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/management-activities/${activityId}/reopen`, {
            method: 'PUT'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Falha ao reabrir a atividade.');
        }

        const result = await response.json();
        window.showToast(result.message, 'success');
        window.fetchAndRenderUsersAsEmployees(document.getElementById('employeeSearchInput').value);
    } catch (error) {
        console.error('Erro ao reabrir atividade de gerenciamento:', error);
        window.showError(`Erro: ${error.message}`);
    }
};

window.screenInitializers['tela7'] = window.initializeManagementActivitiesScreen;

window.stopManagementActivitiesScreen = function() {
    console.log('Parando tela de Gerenciamento de Atividades (Tela 7)...');
};
window.screenStoppers['tela7'] = window.stopManagementActivitiesScreen;