// script.js (VERSÃO FINAL ESTÁVEL COM CORREÇÃO DE ACORDEÃO GLOBAL)

// URL base da API. Adapte para o seu ambiente (IP da EC2) quando em produção.
const API_BASE_URL = 'http://98.84.113.180:3000//api'; // Este deve ser o IP correto da sua EC2, e com /api no final
//const API_BASE_URL = 'http://localhost:3000/api'; // ip local




// Constantes globais (se aplicável a múltiplas telas)
const pecasPorCaixa = 12;

// Variáveis para intervalos de atualização automática (para serem parados globalmente)
let updateCurrentDateTimeInterval = null;

// ===============================================
// Funções Utilitárias (Globais para todas as telas)
// ===============================================

/**
 * Exibe uma notificação pop-up (toast) no canto superior direito da tela.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} type - O tipo de notificação ('info', 'success', 'error', 'warning').
 * @param {number} duration - Duração em milissegundos antes da notificação desaparecer.
 */
window.showNotification = function(message, type = 'info', duration = 3000) {
    let wrapper = document.getElementById('notification-wrapper');
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = 'notification-wrapper';
        document.body.appendChild(wrapper);
    }
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.classList.add('notification-message', type);
    wrapper.appendChild(notification);
    // Força o reflow para a transição CSS começar imediatamente
    void notification.offsetWidth;
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
        notification.addEventListener('transitionend', function handler() {
            notification.remove();
            notification.removeEventListener('transitionend', handler);
        }, { once: true });
    }, duration);
};

window.showError = function(message, duration = 5000) {
    window.showNotification(message, 'error', duration);
};

window.showToast = function(message, type = 'success', duration = 3000) {
    window.showNotification(message, type, duration);
};

/**
 * Abre um modal específico.
 * @param {string} modalId - O ID do elemento modal a ser aberto.
 */
window.openModal = function(modalId) {

    if (window.pauseProjectRefreshForModal) {
        window.pauseProjectRefreshForModal();
    }
    
    if (window.pauseProducaoTimersForModal) {
        window.pauseProducaoTimersForModal();
    }

    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.classList.add('show');
        }
        document.body.classList.add('modal-open'); 
    }
};

/**
 * Fecha um modal específico.
 * @param {string} modalId - O ID do elemento modal a ser fechado.
 */
window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.classList.remove('show');

        const hideModalNow = () => {
            modal.style.display = 'none';
            modal.classList.remove('active');
            document.body.classList.remove('modal-open');
        };

        let called = false;
        const onEnd = () => {
            if (called) return;
            called = true;
            hideModalNow();
        };
        modalContent.addEventListener('transitionend', onEnd, { once: true });

        setTimeout(() => {
            if (!called) onEnd();
        }, 350);
    } else {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    }

    console.log("funcionou");
};

window.closeModalTest = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.classList.remove('show');
            modalContent.addEventListener('transitionend', function handler() {
                modal.style.display = 'none';
            modal.classList.remove('active');
                modalContent.removeEventListener('transitionend', handler);
            }, { once: true });
        } else {
            modal.style.display = 'none';
            modal.classList.remove('active');
        }
        document.body.classList.remove('modal-open');
    }
};

/**
 * Formata uma string de data (DD/MM/YYYY, ISO-8601, ou Date Object) para o formato 'DD/MM/YYYY' ou 'DD/MM/YYYY HH:MM:SS'.
 * @param {string|Date} dateInput - A string de data ou objeto Date.
 * @param {boolean} includeTime - Se true, inclui a hora na formatação.
 * @returns {string} Data formatada ou string vazia se inválida.
 */
window.formatDate = function(dateInput, includeTime = false) {
    if (!dateInput) return '';
    let date;
    try {
        if (dateInput instanceof Date) {
            date = dateInput;
        } 
        else if (typeof dateInput === 'string' && dateInput.includes('/')) {
            const [day, month, year] = dateInput.split(' ')[0].split('/');
            
            date = new Date(
                parseInt(year), 
                parseInt(month) - 1, 
                parseInt(day)
            );
        }
        else if (typeof dateInput === 'string' && dateInput.includes('-')) {
            const [year, month, day] = dateInput.split('T')[0].split('-');
            
            date = new Date(
                parseInt(year), 
                parseInt(month) - 1, 
                parseInt(day)
            );
        }
        else {
            date = new Date(dateInput);
        }

        if (isNaN(date.getTime())) {
            console.error('[formatDate] Data inválida após criação');
            return '';
        }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    if (includeTime) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const result = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
        return result;
        }

        const result = `${day}/${month}/${year}`;
        return result;

    } catch (e) {
        return '';
    }
};


/**
 * Converte uma string de data/hora no formato DD/MM/YYYY [HH:MM:SS] para um objeto Date.
 * @param {string} dateString - A string de data/hora no formato DD/MM/YYYY [HH:MM:SS] ou DD/MM/YYYY.
 * @returns {Date|null} Objeto Date ou null se a string for inválida.
 */
window.parseDDMMYYYYtoDate = function(dateString) {

    if (!dateString || typeof dateString !== "string" || dateString.trim() === "") {
        return null;
    }

    const parts = dateString.split(" ");
    const dateParts = parts[0].split("/");

    if (dateParts.length === 3) {
        const [day, month, year] = dateParts;
        const timePart = parts[1] || '00:00:00';
        const [hours, minutes, seconds] = timePart.split(':').map(Number);

        const dateObj = new Date(
            parseInt(year),
            parseInt(month) - 1, 
            parseInt(day),
            hours,
            minutes,
            seconds
        );

        const originalDay = parseInt(day);
        const originalMonth = parseInt(month);
        const originalYear = parseInt(year);

        if (
            dateObj.getDate() !== originalDay ||
            dateObj.getMonth() + 1 !== originalMonth ||
            dateObj.getFullYear() !== originalYear
        ) {
            console.error('[parseDDMMYYYYtoDate] Data inválida - valores não correspondem:', {
                original: `${day}/${month}/${year}`,
                criada: `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`
            });
            return null;
        }
        return dateObj;
    }
    return null;
};

/**
 * Formata um objeto Date para o formato de string 'DD/MM/YYYY HH:MM:SS', adequado para o MySQL.
 * @param {Date|null} dateObj - Objeto Date a ser formatado.
 * @returns {string|null} String de data/hora formatada ou null.
 */
window.formatDateTimeForDB = function(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return null;

    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

/**
 * Formata uma string de data 'YYYY-MM-DD' (vindo de input type="date") para 'DD/MM/YYYY'.
 * @param {string} dateString - A string de data no formato 'YYYY-MM-DD'.
 * @returns {string|null} A string de data no formato 'DD/MM/YYYY' ou null.
 */
window.formatDateForDB = function(dateString) {
    if (!dateString) return null;
    const parts = dateString.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`; // Converte para DD/MM/YYYY
    }
    return null;
};

/**
 * Alterna a visibilidade da senha em um campo de input.
 * @param {string} inputId - O ID do campo de input da senha.
 * @param {HTMLElement} buttonElement - O botão que acionou a função (para mudar o ícone).
 */
window.togglePasswordVisibility = function(inputId, buttonElement) {
    const passwordInput = document.getElementById(inputId);
    const icon = buttonElement.querySelector('i');
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
};

/**
 * Wrapper para a função `fetch` que automaticamente inclui o token JWT no cabeçalho `Authorization`.
 * @param {string} url - URL da requisição.
 * @param {Object} options - Opções da requisição (método, headers, body, etc.).
 * @returns {Promise<Response>} A Promise da resposta da requisição.
 */
window.authenticatedFetch = async function(url, options = {}) {
    const headers = {
        ...options.headers,
    };

    if (window.userToken) {
        headers['Authorization'] = `Bearer ${window.userToken}`;
    }
    // Correção: Garante que o Content-Type não seja definido para FormData
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    } else {
         delete headers['Content-Type'];
    }

    try {
        const response = await fetch(url, { ...options, headers });
        console.log(`[authenticatedFetch] Resposta recebida para ${url}. Status: ${response.status}`);

        if (!response.ok) {
            let errorData = { error: `Erro na requisição: Status ${response.status}` };
            try {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    errorData = await response.json();
                } else {
                    const textError = await response.text();
                    errorData.error = textError;
                }
            } catch (jsonError) {
                errorData.error = `Erro do servidor: Status ${response.status} ${response.statusText}`;
            }

            if ((response.status === 401 || response.status === 403) && !url.includes('/api/login')) {
                window.showError(errorData.error || 'Acesso negado. Por favor, faça login novamente.');
            } else {
                console.error(`[authenticatedFetch] Erro HTTP não-autenticação para ${url}. Status: ${response.status}. Erro:`, errorData);
            }
            throw new Error(errorData.error);
        }

        console.log(`[authenticatedFetch] Requisição bem-sucedida para ${url}. Status: ${response.status}`);
        return response;
    } catch (error) {
        console.error(`[authenticatedFetch] ERRO DE REDE ou REJEIÇÃO DE PROMISE em fetch para ${url}:`, error);
        throw error;
    }
};

/**
 * Função para imprimir um arquivo.
 * @param {string} fileUrl - O URL do arquivo a ser impresso.
 */
window.printFile = function(fileUrl) {
    const printWindow = window.open(fileUrl, '_blank');
    if (printWindow) {
        printWindow.onload = function() {
            try {
                setTimeout(() => {
                    printWindow.focus();
                    printWindow.print();
                }, 500); 
            } catch (e) {
                console.error("Erro ao tentar imprimir o arquivo:", e);
                window.showError("Erro ao imprimir o arquivo. Verifique se o bloqueador de pop-ups está desativado ou tente baixar.");
            }
        };
        printWindow.onerror = function(msg, url, line) {
            console.error(`Erro ao carregar arquivo para impressão: ${msg} na linha ${line} de ${url}`);
            window.showError("Não foi possível carregar o arquivo para impressão. Verifique o console para detalhes.");
        };
    } else {
        window.showError("Falha ao abrir a janela de impressão. Verifique seu bloqueador de pop-ups.");
    }
};


// ===============================================
// Lógica de Troca de Tela (Global)
// ===============================================

/**
 * Atualiza a URL do navegador para refletir a tela atual.
 * @param {string} screenId - O ID da tela a ser exibida.
 */
function updateUrl(screenId) {
    const currentUrlParams = new URLSearchParams(window.location.search);
    const currentScreenIdInUrl = currentUrlParams.get('screen');

    if (currentScreenIdInUrl !== screenId) {
        const newUrl = `${window.location.pathname}?screen=${screenId}`;
        history.pushState({ screenId: screenId }, '', newUrl);
        console.log(`[switchScreen] URL atualizada para: ${newUrl}`);
    }
}

/**
 * Manipula o evento `popstate` do navegador (botões de voltar/avançar).
 * @param {PopStateEvent} event - O evento popstate.
 */
function handlePopState(event) {
    console.log('[handlePopState] Evento popstate disparado. State:', event.state);
    const urlParams = new URLSearchParams(window.location.search);
    const screenIdFromUrl = urlParams.get('screen') || 'tela1'; 

    if (window.getCurrentUser && window.getCurrentUser()) {
        window.switchScreen(screenIdFromUrl, true);
    } else {
        window.history.replaceState(null, '', window.location.pathname);
        const appContent = document.getElementById('appContent');
        if (appContent) {
            appContent.style.display = 'none';
        }
        window.openModal('loginModal');
    }
}

/**
 * Alterna entre as diferentes telas da aplicação.
 * RESTAURADA a lógica original de if/else if para garantir estabilidade.
 * @param {string} screenId - O ID da tela para a qual mudar (ex: 'tela1', 'tela2').
 * @param {boolean} isPopState - Indica se a chamada veio de um evento `popstate` ou inicialização.
 */
window.switchScreen = function(screenId, isPopState = false) {
    // 1. Validação de Login (Mantida)
    if (!window.getCurrentUser || !window.getCurrentUser()) {
        console.warn(`[switchScreen] Tentativa de trocar para '${screenId}' sem login. Redirecionando para login.`);
        const appContent = document.getElementById('appContent');
        if (appContent) {
            appContent.style.display = 'none'; 
        }
        window.openModal('loginModal'); 
        return;
    }

    // 2. Lógica para parar scripts da tela anterior (Mantida)
    document.querySelectorAll('.tela').forEach(screen => {
        if (screen.classList.contains('active')) {
            const stopper = window.screenStoppers?.[screen.id];
            if (stopper) {
                stopper();
            }
        }
        screen.classList.remove('active');
        screen.style.display = 'none'; 
    });

    // 3. Lógica de UI para botões e telas (Mantida)
    document.querySelectorAll('.screen-selector button').forEach(btn => btn.classList.remove('active'));
    const selectedButton = document.querySelector(`.screen-selector button[onclick="switchScreen('${screenId}')"]`);
    if (selectedButton) {
        selectedButton.classList.add('active');
        const navTitle = document.querySelector('.nav-title');
        if (navTitle) {
            navTitle.textContent = selectedButton.textContent.trim();
        }
    }
    const selectedScreen = document.getElementById(screenId);
    if (selectedScreen) {
        selectedScreen.classList.add('active');
        selectedScreen.style.display = 'block'; 
    }

    // 4. Atualização de URL (Mantida)
    if (!isPopState && window.updateUrl) {
        window.updateUrl(screenId);
    }

    // 5. Limpeza de intervalos e menu (Mantida)
    if (window.updateCurrentDateTimeInterval) {
        clearInterval(window.updateCurrentDateTimeInterval);
        window.updateCurrentDateTimeInterval = null;
    }
    const screenSelector = document.querySelector('.screen-selector');
    if (screenSelector && screenSelector.classList.contains('open')) {
        screenSelector.classList.remove('open');
    }

    // =================================================================
    // 6. LÓGICA DE INICIALIZAÇÃO DE TELA (CORRIGIDA PARA INCLUIR TUDO)
    // =================================================================
    
    if (screenId === 'tela1') {
        if (window.initializeDashboardScreen) {
            window.initializeDashboardScreen();
        }
    } else if (screenId === 'tela2') {
        // *** AQUI ESTÁ A CORREÇÃO PRINCIPAL ***
        // Chamamos a função que inicializa os botões e a busca da tela de projetos.
        if (window.initializeProjectStatusScreen) {
            window.initializeProjectStatusScreen();
        } else {
            console.error("Erro: a função initializeProjectStatusScreen() não foi encontrada.");
        }
        
        // Mantemos a sua lógica original para os alertas.
        if (window.checkAndDisplayDashboardAlerts) {
            window.checkAndDisplayDashboardAlerts();
        }
    } else if (screenId === 'tela3') {
        // A tela 3 agora é um modal, mas mantemos a chamada caso você a reutilize.
        if (window.initializeProjectRegistrationScreen) {
            window.initializeProjectRegistrationScreen();
        }
    } else if (screenId === 'tela4') {
        if (window.initializeToolingScreen) {
            window.initializeToolingScreen();
        }
    } else if (screenId === 'tela5') {
        if (window.initializeProducaoScreen) {
            window.initializeProducaoScreen();
        }
    } else if (screenId === 'tela6') {
        if (window.initializeTabletModeScreen) {
            window.initializeTabletModeScreen();
        }
    } else if (screenId === 'tela7') {
        if (window.initializeManagementActivitiesScreen) {
            window.initializeManagementActivitiesScreen();
        }
    } else if (screenId === 'tela8') {
        if (window.initializeManagementActivitiesDashboard) {
            window.initializeManagementActivitiesDashboard();
        }
    } else if (screenId === 'tela9') {
        // A tela 9 é o modal de gerenciamento de usuários, chamado por um botão.
        // Mas se houver uma inicialização específica, ela pode ser chamada aqui.
        if (window.openManageUsersModal) {
            window.openManageUsersModal();
        }
    }
    
    // 7. Aplica permissões após a troca de tela (Mantida)
    if (window.applyUIPermissions && window.getCurrentUser) {
        window.applyUIPermissions(window.getCurrentUser()?.role);
    }
};


// ===============================================
// Inicialização Global ao Carregar o DOM
// ===============================================

// Os objetos de registro são definidos em outros arquivos e chamados aqui.
document.addEventListener('DOMContentLoaded', async function() {
    console.log("script.js: DOMContentLoaded disparado.");

    // --- LÓGICA GLOBAL PARA SEÇÕES SANFONA (ACORDEÃO) ---
    // O listener é mantido aqui para funcionar em todos os modais.
    document.body.addEventListener('click', function(event) {
        const header = event.target.closest('.collapsible-header');
        if (header) {
            event.stopPropagation();
            
            const section = header.closest('.collapsible-section');
            if (section) {
                section.classList.toggle('open');
                const isNowOpen = section.classList.contains('open');

                const icon = header.querySelector('.toggle-collapse-btn i');
                if (icon) {
                    // Alterna o ícone de seta para cima/baixo de forma robusta
                    icon.classList.toggle('fa-chevron-up', isNowOpen);
                    icon.classList.toggle('fa-chevron-down', !isNowOpen);
                }
            }
        }
    });

    const appContent = document.getElementById('appContent');
    const loginModal = document.getElementById('loginModal');
    const manageUsersBtn = document.getElementById('manageUsersBtn');

    if (appContent) {
        appContent.style.display = 'none';
    }

    // Configura o menu hambúrguer (global)
    const menuToggle = document.getElementById('menuToggle');
    const screenSelector = document.querySelector('.screen-selector');
    if (menuToggle && screenSelector) {
        menuToggle.addEventListener('click', () => {
            screenSelector.classList.toggle('open');
        });
    }

    // Configura o botão de "Gerenciar Usuários" (global)
    if (manageUsersBtn) {
        // Assume que openManageUsersModal é definido em user-management.js
        manageUsersBtn.addEventListener('click', () => {
            if (window.openManageUsersModal) {
                 window.openManageUsersModal();
            } else {
                 console.error("window.openManageUsersModal não está definido.");
                 window.showError("Funcionalidade de Gerenciamento de Usuários não carregada.");
            }
        });
    }
    
    // Adiciona listener para o evento popstate (botão de voltar/avançar do navegador)
    window.addEventListener('popstate', handlePopState);

    // Configura listeners para fechar modais (globais)
    document.querySelectorAll('.close-modal, .close, .close-modal-btn').forEach(element => {
        element.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                window.closeModal(modal.id);
            }
        });
    });
    window.addEventListener('click', function(event) {
        document.querySelectorAll('.modal').forEach(modal => {
            if (event.target === modal) {
                window.closeModal(modal.id);
            }
        });
    });

    // Inicia a verificação de login e a tela inicial
    if (window.checkLoginStatus) {
        const loggedIn = await window.checkLoginStatus();
        if (loggedIn) {
            if (appContent) appContent.style.display = 'flex';
            
            const initialUrlParams = new URLSearchParams(window.location.search);
            const initialScreenId = initialUrlParams.get('screen') || 'tela1';
            window.switchScreen(initialScreenId, true);
        } else {
            if (loginModal) {
                window.openModal('loginModal');
            }
            if (appContent) appContent.style.display = 'none';
        }
    } else {
        console.error("window.checkLoginStatus not found. Ensure auth.js is loaded correctly.");
        if (loginModal) {
            window.openModal('loginModal');
        }
        if (appContent) appContent.style.display = 'none';
    }
});