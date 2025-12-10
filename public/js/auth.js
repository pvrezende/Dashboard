// auth.js (ATUALIZADO PARA REDIRECIONAMENTO INTELIGENTE PÓS-LOGIN)

// Variáveis globais para o estado de autenticação
window.currentUser = null;
window.userToken = null;

// NOVA FUNÇÃO AJUDANTE para decodificar o token de forma segura
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Erro ao decodificar o JWT:", e);
        return null;
    }
}

/**
 * Realiza o login do usuário, envia as credenciais e armazena o JWT.
 */
window.loginUser = async function(event) {
    event.preventDefault();
    const usernameInput = document.getElementById("loginUsername");
    const passwordInput = document.getElementById("loginPassword");
    const loginStatusMessage = document.getElementById("loginStatusMessage");

    const username = usernameInput.value;
    const password = passwordInput.value;
    loginStatusMessage.style.display = "none";

    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Erro ao fazer login.");
        }

        const data = await response.json();
        
        window.userToken = data.token;
        window.currentUser = {
            id: data.id,
            // ▼▼▼ CORREÇÃO AQUI ▼▼▼
            username: username, // Usando a variável 'username' do formulário
            // ▲▲▲ FIM DA CORREÇÃO ▲▲▲
            role: data.role,
            nome: data.nome,
            nivel_acesso_id: data.nivel_acesso_id 
        };

        localStorage.setItem("jwtToken", window.userToken);
        localStorage.setItem("currentUser", JSON.stringify(window.currentUser));

        window.showToast("Login realizado com sucesso!", "success");
        window.closeModal("loginModal");

        document.getElementById("appContent").style.display = "block";
        
        await window.fetchUserPermissions(); 
        
        // ▼▼▼ REMOVIDO DEPOIS DO LOGIN (Conforme instrução) ▼▼▼
        // (O código já não estava aqui no arquivo que você forneceu,
        // mas as instruções pediam para garantir a remoção)
        // if (window.checkAndDisplayDashboardAlerts) {
        //     window.checkAndDisplayDashboardAlerts();
        // }
        // ▲▲▲ FIM DA REMOÇÃO ▲▲▲
        
        const screenOrder = ['tela1', 'tela2', 'tela3', 'tela4', 'tela5', 'tela6', 'tela7', 'tela8'];
        let targetScreen = 'tela1';

        for (const screenId of screenOrder) {
            const permissionKey = window.UI_ELEMENT_PERMISSIONS[`button[onclick="switchScreen('${screenId}')"]`];
            if (window.userPermissions.includes(permissionKey)) {
                targetScreen = screenId;
                break;
            }
        }
        
        window.switchScreen(targetScreen, true); 
        window.updateNavBarDisplay();
        
        usernameInput.value = "";
        passwordInput.value = "";

    } catch (error) {
        console.error("Erro no login:", error);
        loginStatusMessage.textContent = error.message || "Erro ao conectar com o servidor.";
        loginStatusMessage.classList.remove("success");
        loginStatusMessage.classList.add("error");
        loginStatusMessage.style.display = "block";
    }
};

/**
 * Realiza o logout do usuário.
 */
window.logoutUser = function() {
    // Encontra e fecha todos os modais que estiverem abertos.
    document.querySelectorAll('.modal').forEach(modal => {
        if (modal.style.display !== 'none' && modal.style.display !== '') {
            window.closeModal(modal.id);
        }
    });

    window.userToken = null;
    window.currentUser = null;
    localStorage.removeItem("jwtToken");
    localStorage.removeItem("currentUser");
    window.userPermissions = []; // Limpa as permissões

    window.showToast("Logout realizado com sucesso.", "info");
    
    document.getElementById("appContent").style.display = "none";
    
    window.updateNavBarDisplay();
    window.openModal("loginModal");
};

/**
 * Verifica o status de login ao carregar a página.
 */
window.checkLoginStatus = async function() {
    const storedToken = localStorage.getItem("jwtToken");
    const storedUser = localStorage.getItem("currentUser");

    if (storedToken && storedUser) {
        try {
            const parsedUser = JSON.parse(storedUser);
            // Verificação crucial para garantir que o usuário salvo localmente tem os dados mínimos
            if (parsedUser && parsedUser.username && parsedUser.role && parsedUser.nivel_acesso_id && storedToken) {
                
                const decodedToken = parseJwt(storedToken);

                if (!decodedToken) {
                    console.error("Não foi possível decodificar o token. Efetuando logout.");
                    window.logoutUser();
                    return false;
                }

                const nowInSeconds = Math.floor(Date.now() / 1000);
                
                if (decodedToken.exp < nowInSeconds) {
                    window.logoutUser();
                    return false;
                }
                
                window.userToken = storedToken;
                window.currentUser = parsedUser;
                
                await window.fetchUserPermissions();

                // ▼▼▼ REMOVIDO DO RECARREGAMENTO DA PÁGINA ▼▼▼
                // if (window.checkAndDisplayDashboardAlerts) {
                //     window.checkAndDisplayDashboardAlerts();
                // }
                // ▲▲▲ FIM DA REMOÇÃO ▲▲▲
                
                window.updateNavBarDisplay();
                document.getElementById("appContent").style.display = "flex"; // Usar 'flex' para consistência
                
                const urlParams = new URLSearchParams(window.location.search);
                const screenIdFromUrl = urlParams.get('screen') || 'tela1';
                
                // Lógica de redirecionamento para a tela correta...
                window.switchScreen(screenIdFromUrl, true);

                return true;
            } else {
                // Se o usuário salvo está malformado, força o logout
                console.warn("Dados do usuário no localStorage estão incompletos ou corrompidos.");
                window.logoutUser();
                return false;
            }
        } catch (e) {
            console.error("Erro ao restaurar sessão do localStorage:", e);
            window.logoutUser();
            return false;
        }
    }
    
    // Se não encontrou token, apenas mostra a tela de login
    window.updateNavBarDisplay();
    document.getElementById("appContent").style.display = "none";
    return false;
};


/**
 * Obtém o objeto do usuário logado.
 */
window.getCurrentUser = function() {
    return window.currentUser;
};

/**
 * Atualiza a barra de navegação.
 */
window.updateNavBarDisplay = function() {
    const loggedInUserDisplay = document.getElementById("loggedInUserDisplay");
    const loginButton = document.getElementById("loginButton");
    const logoutButton = document.getElementById("logoutButton");
    const manageUsersBtn = document.getElementById("manageUsersBtn");

    if (window.currentUser) {
        // Usuário está logado
        loggedInUserDisplay.style.display = "inline";
        loggedInUserDisplay.innerHTML = `Bem-vindo, <strong>${window.currentUser.nome}</strong> (${window.currentUser.role})`;
        loginButton.style.display = "none";
        logoutButton.style.display = "inline-block";
        if (manageUsersBtn) {
            manageUsersBtn.style.display = "inline-block"; 
        }
    } else {
        // Usuário não está logado
        loggedInUserDisplay.style.display = "none";
        loginButton.style.display = "inline-block";
        logoutButton.style.display = "none";
        if (manageUsersBtn) {
            manageUsersBtn.style.display = "none"; 
        }
    }
};

// Listeners de evento para login e logout
document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", window.loginUser);
    }

    const logoutButton = document.getElementById("logoutButton");
    if (logoutButton) {
        logoutButton.addEventListener("click", window.logoutUser);
    }

    // Adiciona evento de clique para o nome do usuário para editar o perfil
    const loggedInUserDisplay = document.getElementById("loggedInUserDisplay");
    if(loggedInUserDisplay) {
        loggedInUserDisplay.addEventListener('click', () => {
            if(window.openMyProfileModal) {
                window.openMyProfileModal();
            }
        });
        loggedInUserDisplay.style.cursor = 'pointer';
        loggedInUserDisplay.title = 'Clique para editar seu perfil';
    }
});