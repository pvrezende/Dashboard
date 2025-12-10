// tablet-mode.js (ATUALIZADO PARA RBAC - CHAMA applyUIPermissions)

// Função de inicialização para a tela do Modo Tablet
window.initializeTabletModeScreen = function() {
    console.log('Modo Tablet: Inicializando tela...');
    // Esta tela é um menu simples, então não há necessidade de carregar dados complexos.
    // Os botões já chamam funções globais ou redirecionam para outras telas.
    // Certifique-se de que as funções como window.openModal e switchScreen estão disponíveis globalmente.
    
    // CRÍTICO: Aplica as permissões da UI ao carregar a tela
    if (window.applyUIPermissions && window.getCurrentUser) { // Garante que as funções necessárias foram carregadas
        window.applyUIPermissions(window.getCurrentUser()?.role);
    } else {
        console.error("permissions-ui.js não foi carregado ou applyUIPermissions/getCurrentUser não está definido!");
    }
};

// Opcional: Se houver alguma lógica específica para parar/limpar a tela do tablet
// ao sair dela, você pode adicioná-la aqui.
window.stopTabletMode = function() {
    console.log('Modo Tablet: Parando atividades...');
    // Ex: parar animações, limpar ouvintes de eventos se tivessem sido adicionados, etc.
};

// Registra a função de inicialização no objeto global screenInitializers
if (typeof window.screenInitializers === 'undefined') {
    window.screenInitializers = {};
}
window.screenInitializers['tela6'] = window.initializeTabletModeScreen; // Registra a função de inicialização da tela6.

// Registra a função de parada no objeto global screenStoppers
if (typeof window.screenStoppers === 'undefined') {
    window.screenStoppers = {};
}
window.screenStoppers['tela6'] = window.stopTabletMode;