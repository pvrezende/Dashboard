// management-activities.js (REESCRITO para o layout de grade de cards com corpo expansível)

(function() {
    const activeDashboardTimers = new Map();
    let currentPageTela8 = 1;
    const limitTela8 = 18;

    function updateChronometerIndicator(employeeId, change) {
        const card = document.querySelector(`.employee-dashboard-card[data-employee-id='${employeeId}']`);
        if (!card) return;

        const indicator = card.querySelector('.chronometer-indicator');
        if (!indicator) return;

        const countSpan = indicator.querySelector('span');
        let currentCount = parseInt(countSpan.textContent, 10);
        let newCount = currentCount + change;

        if (newCount < 0) newCount = 0;

        countSpan.textContent = newCount;
        indicator.title = newCount > 0 ? `${newCount} cronômetro(s) ativo(s)` : 'Nenhum cronômetro ativo';

        if (newCount > 0) {
            indicator.classList.add('active');
            indicator.classList.remove('inactive');
        } else {
            indicator.classList.add('inactive');
            indicator.classList.remove('active');
        }
    }

    function convertMillisecondsToHMMSS(ms) {
        if (ms === null || isNaN(ms)) return '00:00:00';
        let totalSeconds = Math.floor(ms / 1000);
        const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        totalSeconds %= 3600;
        const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    window.initializeManagementActivitiesDashboard = function() {
        console.log('Tela 8: Inicializando Consulta de Atividades (Grid Layout)...');
        fetchAndRenderActivityDashboard(1, '');

        const searchInput = document.getElementById('consultarAtividadesSearchInput');
        const searchBtn = document.getElementById('consultarAtividadesSearchBtn');

        if (searchBtn) {
            searchBtn.onclick = () => {
                currentPageTela8 = 1;
                fetchAndRenderActivityDashboard(currentPageTela8, searchInput.value);
            };
        }
        if (searchInput) {
            searchInput.onkeypress = (e) => {
                if (e.key === 'Enter') {
                    currentPageTela8 = 1;
                    fetchAndRenderActivityDashboard(currentPageTela8, searchInput.value);
                }
            };
        }
    };

    async function fetchAndRenderActivityDashboard(page = 1, searchTerm = '') {
        const container = document.getElementById('activitiesDetailsDisplay');
        if (!container) return;
        container.innerHTML = '<p class="no-tools">Carregando atividades...</p>';
        
        activeDashboardTimers.forEach(timer => {
            if (timer.intervalId) clearInterval(timer.intervalId);
        });
        activeDashboardTimers.clear();

        try {
            const usersResponse = await window.authenticatedFetch(`${API_BASE_URL}/users-with-activities?page=${page}&limit=${limitTela8}&search=${encodeURIComponent(searchTerm)}`);
            if (!usersResponse.ok) throw new Error('Erro ao buscar usuários.');
            const { users, pagination } = await usersResponse.json();

            const timerStateResponse = await window.authenticatedFetch(`${API_BASE_URL}/employee-timers/active`);
            const activeBackendTimers = timerStateResponse.ok ? await timerStateResponse.json() : [];

            container.innerHTML = '';
            
            if (users.length === 0) {
                container.innerHTML = '<p class="no-tools">Nenhum funcionário encontrado.</p>';
            } else {
                for (const user of users) {
                    let activeActivities = [];
                    if (user.has_active_activities) {
                        const activitiesResponse = await window.authenticatedFetch(`${API_BASE_URL}/employees/${user.id}/activities`);
                        if (activitiesResponse.ok) {
                            const allActivities = await activitiesResponse.json();
                            activeActivities = allActivities.filter(a => a.status !== 'Concluida');
                        }
                    }

                    const employee = { id: user.id, nome: user.nome, cargo: user.role, running_timers_count: user.running_timers_count };
                    const card = createEmployeeDashboardCard(employee, activeActivities);
                    container.appendChild(card);
                    
                    renderActivitiesForEmployeePage(card, 1);
                }
            }

            renderPaginationControls(pagination, searchTerm);

        } catch (error) {
            console.error("Tela 8: Erro ao renderizar o dashboard de atividades:", error);
            container.innerHTML = `<p class="no-tools" style="color:red;">${error.message}</p>`;
        }
    }
    
    function renderActivitiesForEmployeePage(card, page) {
        const activitiesContainer = card.querySelector('.employee-dashboard-activities');
        const paginationContainer = card.querySelector('.activities-pagination-controls');
        const allActivities = JSON.parse(card.dataset.activities || '[]');
        const employeeId = card.dataset.employeeId;
        
        if (!activitiesContainer || !paginationContainer) return;
        
        // --- INÍCIO DA CORREÇÃO: Limpa os timers das atividades que estão sendo removidas da visualização ---
        activitiesContainer.querySelectorAll('.dashboard-activity-item').forEach(item => {
            const activityId = parseInt(item.dataset.activityId, 10);
            if (activeDashboardTimers.has(activityId)) {
                const timerState = activeDashboardTimers.get(activityId);
                if (timerState.intervalId) {
                    clearInterval(timerState.intervalId);
                }
                activeDashboardTimers.delete(activityId);
            }
        });
        // --- FIM DA CORREÇÃO ---

        activitiesContainer.innerHTML = '';
        card.dataset.currentActivityPage = page; // Armazena a página atual no card

        const itemsPerPage = 3;
        const totalItems = allActivities.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const paginatedActivities = allActivities.slice(start, end);
        
        if (paginatedActivities.length > 0) {
            window.authenticatedFetch(`${API_BASE_URL}/employee-timers/active`)
                .then(res => res.ok ? res.json() : [])
                .then(activeBackendTimers => {
                    paginatedActivities.forEach(activity => {
                        const activityElement = createActivityElement(activity);
                        activitiesContainer.appendChild(activityElement);
                        
                        const backendTimerState = activeBackendTimers.find(t => t.activity_id === activity.id);
                        setupTimerControlsForActivity(activityElement, employeeId, activity.id, backendTimerState);
                    });
                });
        } else if (allActivities.length === 0) {
            activitiesContainer.innerHTML = '<p class="no-activities-found">Nenhuma atividade pendente para este funcionário.</p>';
        }

        renderPaginationControlsForCard(card, page, totalPages);
    }
    
    function createActivityElement(activity) {
    const activityItem = document.createElement('div');
    activityItem.className = `dashboard-activity-item status-${activity.status.toLowerCase().replace(' ', '-')}`;
    activityItem.dataset.activityId = activity.id;

    const projectHtml = activity.projeto_nome
        ? `<span class="activity-project-name"><strong>Projeto:</strong> ${activity.projeto_nome}</span>`
        : '';

    activityItem.innerHTML = `
        <div class="dashboard-activity-info">
            <div class="dashboard-activity-description">
                <i class="fas fa-clipboard-list"></i>
                <span>(${activity.ordem || 'N/A'}) ${activity.descricao}</span>
            </div>
            <div class="dashboard-activity-details">
                ${projectHtml}
                <span class="status-pendente">${activity.status}</span>
                <span>Data Limite: ${window.formatDate(activity.data_limite)}</span>
            </div>
        </div>
        <div class="timer-section">
            <div class="timer-display">00:00:00</div>
            <div class="timer-progress-bar-container">
                <div class="timer-progress-bar-fill" style="width: 0%;"></div>
            </div>
            <div class="timer-controls">
                <button class="start-btn action-button success"><i class="fas fa-play"></i> Iniciar</button>
                <button class="pause-btn action-button warning hidden-control"><i class="fas fa-pause"></i> Pausar</button>
                <button class="stop-btn action-button danger hidden-control"><i class="fas fa-stop"></i> Resetar</button>
                <button class="complete-activity-btn action-button secondary hidden-control"><i class="fas fa-check-double"></i> Concluir</button>
            </div>
        </div>
    `;
    return activityItem;
}

    function renderPaginationControlsForCard(card, currentPage, totalPages) {
        const paginationContainer = card.querySelector('.activities-pagination-controls');
        paginationContainer.innerHTML = '';

        if (totalPages <= 1) return;

        const prevButton = document.createElement('button');
        prevButton.innerHTML = '&laquo; Anterior';
        prevButton.className = 'page-btn';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', (e) => {
            e.stopPropagation();
            // --- INÍCIO DA CORREÇÃO: Lê a página atual do dataset para robustez ---
            const currentPageNum = parseInt(card.dataset.currentActivityPage, 10) || 1;
            renderActivitiesForEmployeePage(card, currentPageNum - 1);
            // --- FIM DA CORREÇÃO ---
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
            // --- INÍCIO DA CORREÇÃO: Lê a página atual do dataset para robustez ---
            const currentPageNum = parseInt(card.dataset.currentActivityPage, 10) || 1;
            renderActivitiesForEmployeePage(card, currentPageNum + 1);
            // --- FIM DA CORREÇÃO ---
        });
        paginationContainer.appendChild(nextButton);
    }

    function renderPaginationControls(pagination, searchTerm) {
        const { totalPages, currentPage } = pagination;
        const paginationContainer = document.getElementById('paginationControls');
        if (!paginationContainer) return;

        paginationContainer.innerHTML = '';
        
        if (totalPages < 1) {
            return;
        }

        const prevButton = document.createElement('button');
        prevButton.innerHTML = '&laquo; Anterior';
        prevButton.className = 'page-btn';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => {
            currentPageTela8--;
            fetchAndRenderActivityDashboard(currentPageTela8, searchTerm);
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
            currentPageTela8++;
            fetchAndRenderActivityDashboard(currentPageTela8, searchTerm);
        });
        paginationContainer.appendChild(nextButton);
    }
    
    function createEmployeeDashboardCard(employee, activities) {
        const card = document.createElement('div');
        card.className = 'employee-dashboard-card';
        card.dataset.employeeId = employee.id;
        card.dataset.activities = JSON.stringify(activities);

        const avatarClass = activities.length > 0 ? 'has-activities' : 'no-activities';

        const activityIndicatorHtml = activities.length > 0 ? `
            <div class="activity-indicator" title="${activities.length} atividade(s) pendente(s)">
                <i class="fas fa-clock"></i>
                <span class="activity-count-badge">${activities.length}</span>
            </div>
        ` : '';
        
        const runningCount = employee.running_timers_count || 0;
        const chronometerClass = runningCount > 0 ? 'active' : 'inactive';
        const chronometerTitle = runningCount > 0 ? `${runningCount} cronômetro(s) ativo(s)` : 'Nenhum cronômetro ativo';
        const chronometerIndicatorHtml = `
            <div class="chronometer-indicator ${chronometerClass}" title="${chronometerTitle}">
                <i class="fas fa-stopwatch"></i>
                <span>${runningCount}</span>
            </div>
        `;

        card.innerHTML = `
            <div class="employee-card-header">
                <div class="employee-avatar ${avatarClass}"><i class="fas fa-user-circle"></i></div>
                <div class="employee-info-main">
                    <h3>${employee.nome}</h3>
                    <p>${employee.cargo}</p>
                </div>
                <div class="header-meta">
                    ${activityIndicatorHtml}
                    ${chronometerIndicatorHtml} 
                    <i class="fas fa-chevron-down expand-icon"></i>
                </div>
            </div>
            <div class="employee-card-body">
                <div class="employee-dashboard-activities">
                </div>
                <div class="activities-pagination-controls">
                </div>
            </div>
        `;

        const header = card.querySelector('.employee-card-header');
        header.addEventListener('click', () => {
            card.classList.toggle('expanded');
        });

        return card;
    }


    function setupTimerControlsForActivity(activityItemElement, employeeId, activityId, backendTimerState) {
        let elapsedTime = 0;
        let isRunning = false;

        if (backendTimerState) {
            elapsedTime = backendTimerState.tempo_acumulado_ms;
            isRunning = backendTimerState.status === 'running';
            if (isRunning && backendTimerState.ultimo_inicio_timestamp) {
                const lastStart = new Date(backendTimerState.ultimo_inicio_timestamp).getTime();
                elapsedTime += (Date.now() - lastStart);
            }
        }

        activeDashboardTimers.set(activityId, {
            intervalId: null,
            elapsedTime: elapsedTime,
            startTime: isRunning ? Date.now() - elapsedTime : null,
            isRunning: isRunning,
            employeeId: employeeId,
            activityId: activityId,
            activityItemElement: activityItemElement
        });
        
        const startBtn = activityItemElement.querySelector('.start-btn');
        const pauseBtn = activityItemElement.querySelector('.pause-btn');
        const stopBtn = activityItemElement.querySelector('.stop-btn');
        const completeBtn = activityItemElement.querySelector('.complete-activity-btn');

        startBtn.onclick = () => startEmployeeTimer(employeeId, activityId);
        pauseBtn.onclick = () => pauseEmployeeTimer(employeeId, activityId);
        stopBtn.onclick = () => stopEmployeeTimer(employeeId, activityId);
        completeBtn.onclick = () => completeEmployeeActivity(employeeId, activityId);
        
        updateTimerDisplay(activityId);
        updateTimerButtonVisibility(activityId);

        if (isRunning) {
            const timerState = activeDashboardTimers.get(activityId);
            if(timerState.intervalId) clearInterval(timerState.intervalId);
            timerState.intervalId = setInterval(() => updateTimerAndDisplay(activityId), 1000);
        }
    }

    function updateTimerAndDisplay(activityId) {
        const timerState = activeDashboardTimers.get(activityId);
        if (!timerState || !timerState.isRunning) return;
        
        timerState.elapsedTime = Date.now() - timerState.startTime;
        updateTimerDisplay(activityId);
    }

    function updateTimerDisplay(activityId) {
        const timerState = activeDashboardTimers.get(activityId);
        if (!timerState) return;

        const { activityItemElement, elapsedTime } = timerState;
        const displayElement = activityItemElement.querySelector('.timer-display');
        const progressBarFill = activityItemElement.querySelector('.timer-progress-bar-fill');
        
        if (displayElement) {
            displayElement.textContent = convertMillisecondsToHMMSS(elapsedTime);
        }

        if (progressBarFill) {
            const plannedHours = 8;
            const plannedSeconds = plannedHours * 3600;
            const elapsedSeconds = elapsedTime / 1000;
            
            let percentage = plannedSeconds > 0 ? (elapsedSeconds / plannedSeconds) * 100 : 0;
            percentage = Math.min(percentage, 100);
            
            progressBarFill.style.width = `${percentage}%`;
            progressBarFill.style.backgroundColor = elapsedSeconds >= plannedSeconds ? 'var(--danger-color)' : 'var(--success-color)';
        }
    }

    function updateTimerButtonVisibility(activityId) {
        const timerState = activeDashboardTimers.get(activityId);
        if (!timerState) return;
        
        const container = timerState.activityItemElement.querySelector('.timer-controls');
        if (!container) return;

        const startBtn = container.querySelector('.start-btn');
        const pauseBtn = container.querySelector('.pause-btn');
        const stopBtn = container.querySelector('.stop-btn');
        const completeBtn = container.querySelector('.complete-activity-btn');
        
        if (timerState.isRunning) {
            startBtn.classList.add('hidden-control');
            pauseBtn.classList.remove('hidden-control');
            stopBtn.classList.remove('hidden-control');
            completeBtn.classList.remove('hidden-control');
        } else {
            pauseBtn.classList.add('hidden-control');
            if (timerState.elapsedTime > 0) {
                startBtn.classList.remove('hidden-control');
                stopBtn.classList.remove('hidden-control');
                completeBtn.classList.remove('hidden-control');
            } else {
                startBtn.classList.remove('hidden-control');
                stopBtn.classList.add('hidden-control');
                completeBtn.classList.add('hidden-control');
            }
        }
    }

    async function startEmployeeTimer(employeeId, activityId) {
        const timerState = activeDashboardTimers.get(activityId);
        if (!timerState || timerState.isRunning) return;
        
        try {
            await window.authenticatedFetch(`${API_BASE_URL}/timers/activities/start`, {
                method: 'POST', 
                body: JSON.stringify({ 
                    employee_id: employeeId, 
                    activity_id: activityId, 
                    tempo_acumulado_ms: timerState.elapsedTime, 
                    ultimo_inicio_timestamp: new Date().toISOString() 
                })
            });
            
            timerState.isRunning = true;
            timerState.startTime = Date.now() - timerState.elapsedTime;
            if(timerState.intervalId) clearInterval(timerState.intervalId);
            timerState.intervalId = setInterval(() => updateTimerAndDisplay(activityId), 1000);
            
            updateTimerButtonVisibility(activityId);
            updateChronometerIndicator(employeeId, 1);
            window.showToast("Cronômetro iniciado!", "success");

        } catch (error) { 
            console.error('Erro ao iniciar cronômetro:', error);
            window.showError(error.message); 
        }
    }

    async function pauseEmployeeTimer(employeeId, activityId) {
        const timerState = activeDashboardTimers.get(activityId);
        if (!timerState || !timerState.isRunning) return;

        const comentario = prompt("Deseja adicionar um comentário para esta pausa? (Opcional)");
        timerState.elapsedTime = Date.now() - timerState.startTime;

        try {
            await window.authenticatedFetch(`${API_BASE_URL}/timers/activities/pause`, {
                method: 'PUT', 
                body: JSON.stringify({ 
                    employee_id: employeeId, 
                    activity_id: activityId, 
                    tempo_acumulado_ms: timerState.elapsedTime,
                    comentario: comentario 
                })
            });
            
            timerState.isRunning = false;
            if (timerState.intervalId) {
                clearInterval(timerState.intervalId);
                timerState.intervalId = null;
            }
            
            updateTimerButtonVisibility(activityId);
            updateChronometerIndicator(employeeId, -1);
            window.showToast("Cronômetro pausado!", "info");
        } catch (error) { 
            console.error('Erro ao pausar cronômetro:', error);
            window.showError(error.message); 
        }
    }

    async function stopEmployeeTimer(employeeId, activityId) {
        const timerState = activeDashboardTimers.get(activityId);
        if (!timerState) return;

        const wasRunning = timerState.isRunning;

        try {
            await window.authenticatedFetch(`${API_BASE_URL}/timers/activities/stop`, {
                method: 'POST', 
                body: JSON.stringify({ 
                    employee_id: employeeId, 
                    activity_id: activityId 
                })
            });
            
            timerState.isRunning = false;
            timerState.elapsedTime = 0;
            if (timerState.intervalId) {
                clearInterval(timerState.intervalId);
                timerState.intervalId = null;
            }
            
            updateTimerDisplay(activityId);
            updateTimerButtonVisibility(activityId);
            if (wasRunning) {
                updateChronometerIndicator(employeeId, -1);
            }
            window.showToast("Cronômetro resetado!", "info");
        } catch (error) { 
            console.error('Erro ao resetar cronômetro:', error);
            window.showError(error.message); 
        }
    }
    
    async function completeEmployeeActivity(employeeId, activityId) {
        const timerState = activeDashboardTimers.get(activityId);
        if (!timerState) return;

        const wasRunningBeforeComplete = timerState.isRunning;

        const activityName = timerState.activityItemElement.querySelector('.dashboard-activity-description span')?.textContent || "esta atividade";
        if (!confirm(`Tem certeza que deseja concluir a atividade "${activityName}"? O tempo atual será salvo.`)) return;

        try {
            const response = await window.authenticatedFetch(`${API_BASE_URL}/timers/activities/complete`, {
                method: 'POST', 
                body: JSON.stringify({ 
                    employee_id: employeeId, 
                    activity_id: activityId, 
                    tempo_trabalhado_ms: timerState.elapsedTime 
                })
            });
            
            const result = await response.json();
            
            if (timerState.intervalId) clearInterval(timerState.intervalId);
            activeDashboardTimers.delete(activityId);
            
            window.showToast(`Atividade concluída! Tempo registrado: ${result.horas_trabalhadas.toFixed(2)} horas`, "success");
            
            if (wasRunningBeforeComplete) {
                updateChronometerIndicator(employeeId, -1);
            }

            const searchInput = document.getElementById('consultarAtividadesSearchInput');
            fetchAndRenderActivityDashboard(currentPageTela8, searchInput.value);
            
        } catch (error) { 
            console.error('Erro ao concluir atividade:', error);
            window.showError(error.message); 
        }
    }

    window.stopManagementActivitiesDashboard = function() {
        console.log('Tela 8: Parando atividades...');
        for (const timerState of activeDashboardTimers.values()) {
            if (timerState.intervalId) {
                clearInterval(timerState.intervalId);
            }
        }
        activeDashboardTimers.clear();
    };

    if (typeof window.screenInitializers === 'undefined') {
        window.screenInitializers = {};
    }
    if (typeof window.screenStoppers === 'undefined') {
        window.screenStoppers = {};
    }
    window.screenInitializers['tela8'] = window.initializeManagementActivitiesDashboard;
    window.screenStoppers['tela8'] = window.stopManagementActivitiesDashboard;

})();