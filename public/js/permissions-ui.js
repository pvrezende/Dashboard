// Array global que armazenará as chaves de permissão do usuário logado (ex: ['dashboard.view', 'project.create'])
window.userPermissions = [];

/**
 * Mapeamento central de seletores de UI para as chaves de permissão necessárias.
 */
window.UI_ELEMENT_PERMISSIONS = {
    // ---- Navegação Principal ----
    'button[onclick="switchScreen(\'tela1\')"]': 'dashboard.view',
    'button[onclick="switchScreen(\'tela2\')"]': 'project.view.status',
    'button[onclick="switchScreen(\'tela3\')"]': 'project.create',
    'button[onclick="switchScreen(\'tela4\')"]': 'tooling.view',
    'button[onclick="switchScreen(\'tela5\')"]': 'production.view',
    'button[onclick="switchScreen(\'tela6\')"]': 'tablet.view',
    'button[onclick="switchScreen(\'tela7\')"]': 'management.view.activities',
    'button[onclick="switchScreen(\'tela8\')"]': 'management.view.assigned',
    '#manageUsersBtn': 'user.view',
    
    // ---- Dashboard (Tela 1) e Modais ----
    '#registerProductionBtn': 'dashboard.register.production',
    '#updateMetaBtn': 'dashboard.update.meta',
    '#registerProductionForm button[type="submit"]': 'dashboard.register.production',
    '#generateReportModalBtn': 'dashboard.generate.report',
    '#downloadOptions': 'dashboard.generate.report',

    // ---- Status do Projeto (Tela 2) e Modais ----
    '.project-card .edit-btn': 'project.edit',
    '.project-card .delete-btn': 'project.delete',
    '.project-card .end-project-btn': 'project.end',
    '.project-card .parts-button': 'project.manage.parts',
    '.project-card .shopping-btn': 'project.manage.shopping',
    '.project-card .activities-button': 'management.assign.activity',
    '#addProjectPartForm': 'project.manage.parts',
    '#attachmentsModal .upload-attachment-form': 'project.manage.attachments',
    '#projectPartsList .delete-part-btn': 'project.manage.parts',
    '#attachmentsListInModal .delete-attachment-btn': 'project.manage.attachments',
    '#deleteShoppingFileBtn': 'project.manage.shopping',
    '#uploadShoppingFileBtn': 'project.manage.shopping',
    '#addProjectActivityForm': 'management.assign.activity',
    '#editProjectActivityForm': 'management.edit.activity',
    '#subEtapasModal .sub-etapas-form': 'project.edit',
    '#subEtapasList .edit-btn': 'project.edit',
    '#subEtapasList .delete-btn': 'project.edit',
    // Mapeamento do container dos botões do card para corrigir o bug de 'display: block'
    '.project-card-buttons': 'project.view.status', 

    // ---- Cadastro de Projetos (Tela 3) ----
    '#cadastroProjetoForm': 'project.create',

    // ---- Ferramentaria (Tela 4) e Modais ----
    '#addToolForm': 'tooling.create.tool',
    '#generateToolingReportBtn': 'tooling.generate.report',
    '.tool-card .edit-btn': 'tooling.edit.tool',
    '.tool-card .delete-btn': 'tooling.delete.tool',
    '.tool-card .view-sub-stages': 'tooling.manage.substages',
    '.tool-card .details-btn': 'tooling.view',
    '#toolSubStagesModal .select-part-for-production-section': 'tooling.manage.substages',
    '#editToolSubStageForm': 'tooling.manage.substages',

    // ---- Produção (Tela 5) ----
    '.timer-section .start-btn': 'production.manage.timer',
    '.timer-section .pause-btn': 'production.manage.timer',
    '.timer-section .stop-btn': 'production.manage.timer',
    '.timer-section .save-btn': 'production.manage.timer',
    '.timer-section .complete-activity-btn': 'production.manage.timer',

    // ---- Gerenciamento de Atividades (Tela 7) ----
    '#employeeList .assign-activity-btn': 'management.assign.activity',
    '#employeeList .edit-employee-btn': 'user.edit.any',
    '#employeeList .delete-employee-btn': 'user.delete',
    '#editManagementActivityForm': 'management.edit.activity',

    // ---- Gerenciamento de Usuários (Modal) ----
    '#registerUserSection': 'user.create',
    '#createRoleSection': 'user.create',
    '#userList .delete-user-btn': 'user.delete',
    '#userList .edit-user-btn': 'user.edit.any',
    '#rolesList .edit-role-btn': 'user.edit.any',

    // ---- Consulta de Atividades (Tela 8) ----
    '.employee-dashboard-card .start-timer-btn': 'management.manage.timer',
    '.employee-dashboard-card .pause-timer-btn': 'management.manage.timer',
    '.employee-dashboard-card .stop-timer-btn': 'management.manage.timer',
    '.employee-dashboard-card .save-time-btn': 'management.manage.timer',
    '.employee-dashboard-card .complete-activity-btn': 'management.manage.timer',

    // ---- Permissões Adicionais (da sua lista) ----
    '.project-card .toggle-status-btn': 'project.end',
    '.form-check.form-switch': 'project.view.closed',
    '#registerUserSection': 'user.create.form',
    '#createRoleSection': 'role.create.form',
    '#userListSection': 'user.list.view',
    '#rolesListSection': 'role.list.view',
    '#projectAccessSection': 'user.manage.project.permissions',
    '#editRole': 'user.edit.role',
    '#editUsername': 'user.edit.credentials',
    '#editName': 'user.edit.credentials',
    '.project-card .nps-btn': 'nps.view.form',
    '#deleteNpsFormBtn': 'nps.delete.response',
    '#employeeList .edit-management-activity-btn': 'management.edit.activity',

    // =================================================================
    // ATUALIZAÇÃO - Gestão de Compras/BOM (Shopping)
    // =================================================================
    
    // ---- Permissão Geral para Abrir Modal ----
    'button[data-action="open-shopping-modal"]': 'project.manage.shopping', 

    // ---- Painel 1: Adicionar Itens (Elaboração) ----
    '#bomItemsListTabButton': 'bom.create',
    '#addBomItemForm': 'bom.create',
    '.edit-bom-item-btn': 'bom.edit',
    '.delete-bom-item-btn': 'bom.edit',
    '.send-bom-item-btn': 'bom.submit',

    // ---- Painel 2: Aprovação Líder ----
    '#liderApprovalPanelTabButton': 'project.shopping.approve',
    '.lider-approve-btn': 'project.shopping.approve',
    '.lider-reprove-btn': 'project.shopping.approve',
    '#selectAllLider': 'project.shopping.approve',
    '#bulkApproveLiderBtn': 'project.shopping.approve',
    '#bulkReproveLiderBtn': 'project.shopping.approve',

    // ---- Painel 3: Aprovação Gestor ----
    '#approvalPanelTabButton': 'project.shopping.approve',
    '#selectAllSolicitacoes': 'project.shopping.approve', 
    '#approveSelectedBtn': 'project.shopping.approve',
    '#reproveSelectedBtn': 'project.shopping.approve',
    '.solicitacao-card .action-button[data-action="approve-individual"]': 'project.shopping.approve',
    '.solicitacao-card .action-button[data-action="reprove-individual"]': 'project.shopping.approve',

    // ---- Painel 4: Cotações ----
    '#cotacoesPanelTabButton': 'acquisitions.view',
    '.open-cotacao-btn': 'acquisitions.manage',
    '.finalize-cotacao-btn': 'acquisitions.manage',
    '.edit-quote-btn': 'acquisitions.manage',
    '.delete-quote-btn': 'acquisitions.manage',
    '.select-quote-btn': 'acquisitions.manage',
    '.approve-orcamento-btn': 'acquisitions.manage', // (Mantido da sua lista)

    // ---- Painel 5: Aprovação Diretoria ----
    '#directorApprovalPanel': 'bom.approve.diretoria',
    '#directorApprovalPanelTabButton': 'bom.approve.diretoria',
    '.director-approve-btn': 'bom.approve.diretoria',
    '.director-reprove-btn': 'bom.approve.diretoria',
    '#bulkApproveDiretorBtn': 'bom.approve.diretoria',
    '#bulkReproveDiretorBtn': 'bom.approve.diretoria',
    '#selectAllSolicitacoesDiretoria': 'bom.approve.diretoria',

    // ---- Painel 6: Aprovação Financeiro ----
    '#financialApprovalPanelTabButton': 'bom.approve.financeiro',
    '#financialApprovalPanel': 'bom.approve.financeiro',
    '.financeiro-approve-btn': 'bom.approve.financeiro',
    '.financeiro-reprove-btn': 'bom.approve.financeiro',
    '#selectAllSolicitacoesFinanceiro': 'bom.approve.financeiro',
    '#bulkApproveFinanceiroBtn': 'bom.approve.financeiro',
    '#bulkReproveFinanceiroBtn': 'bom.approve.financeiro',

    // ---- Painel 7: Status dos Pedidos ----
    '#finalItemsPanelTabButton': 'acquisitions.view',
    '.return-to-elaboration-btn': 'bom.edit'
};

/**
 * Busca as permissões do usuário logado na API e as armazena.
 */
window.fetchUserPermissions = async function() {
    const currentUser = window.getCurrentUser();
    if (!currentUser || !currentUser.nivel_acesso_id) {
        window.userPermissions = [];
        window.applyUIPermissions();
        return;
    }

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/roles/${currentUser.nivel_acesso_id}/permissions`);
        if (!response.ok) {
            throw new Error('Falha ao buscar permissões do usuário.');
        }
        window.userPermissions = await response.json();
        console.log("Permissões do usuário carregadas:", window.userPermissions);
        
        window.applyUIPermissions();

    } catch (error) {
        console.error("Erro ao buscar permissões do usuário:", error);
        window.userPermissions = [];
        window.applyUIPermissions();
    }
}

/**
 * Aplica as permissões à interface, escondendo ou desabilitando elementos.
 */
window.applyUIPermissions = function() {
    console.log("Aplicando permissões na UI com base nas chaves:", window.userPermissions);

    for (const selector in window.UI_ELEMENT_PERMISSIONS) {
        const requiredPermission = window.UI_ELEMENT_PERMISSIONS[selector];
        const elements = document.querySelectorAll(selector);

        elements.forEach(element => {
            const isAllowed = window.userPermissions.includes(requiredPermission);
            
            const shouldBeHidden = ['FORM', 'DIV', 'SECTION'].includes(element.tagName);

            // ===================== INÍCIO DA CORREÇÃO =====================
            if (element.tagName === 'BUTTON') {
                // Para botões, usamos 'inline-flex' para que o ícone e o texto fiquem alinhados.
                element.style.display = isAllowed ? 'inline-flex' : 'none';
            
            } else if (shouldBeHidden) {
                // CORREÇÃO AQUI:
                // Se for permitido, removemos o 'display' inline (usando '') 
                // para que o CSS original (ex: 'flex', 'grid', 'block') seja aplicado.
                // Se não for permitido, escondemos com 'none'.
                element.style.display = isAllowed ? '' : 'none'; 
            
            } else {
            // ===================== FIM DA CORREÇÃO =====================
                // Para outros elementos (como inputs), apenas desabilita
                element.disabled = !isAllowed;
                if (!isAllowed) {
                    element.classList.add('disabled-by-permission');
                    element.title = 'Acesso negado';
                } else {
                    element.classList.remove('disabled-by-permission');
                    element.title = '';
                }
            }
        });
    }
    
    // Lógica especial para o botão de editar usuário (permitir editar a si mesmo)
    if (window.userPermissions.includes('user.edit.own')) {
        const currentUser = window.getCurrentUser();
        if (currentUser) {
            document.querySelectorAll('.edit-user-btn').forEach(btn => {
                const targetUserId = btn.dataset.userId;
                if (currentUser.id.toString() === targetUserId) {
                     btn.style.display = 'inline-flex'; // Garante que ele apareça
                     btn.disabled = false;
                     btn.classList.remove('disabled-by-permission');
                     btn.title = 'Editar meu perfil';
                }
            });
        }
    }
};