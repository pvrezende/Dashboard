// user-management.js (VERSÃO FINAL COM CORREÇÃO DO ERRO 'editUser is not defined' E CONFLITO DE LISTENER)

/**
 * Abre o modal de gerenciamento de usuários e popula todos os dados dinâmicos.
 */
window.openManageUsersModal = async function() {
    const currentUser = window.getCurrentUser();
    if (!currentUser) {
        window.showError("Nenhum usuário logado. Por favor, faça login.");
        return;
    }

    const modal = document.getElementById("manageUsersModal");
    if (!modal) {
        console.error("Modal 'manageUsersModal' não encontrado no DOM.");
        return;
    }

    window.openModal("manageUsersModal");
    document.getElementById("registerUserForm").reset();
    document.getElementById("createRoleForm").reset();
    document.getElementById("registerStatusMessage").style.display = "none";
    
    const searchInput = document.getElementById('userSearchInput');
    if(searchInput) searchInput.value = '';

    // =================================================================
    // INÍCIO DA CORREÇÃO: Listener de Evento Local para o Acordeão
    // =================================================================
    
    // 1. Remove qualquer listener antigo para evitar duplicação
    if (modal.dataset.accordionListener === 'true') {
        // Se já temos um listener, não precisamos adicionar outro.
        // A lógica de reset abaixo cuidará do estado visual.
    } else {
        // 2. Adiciona um ÚNICO listener ao próprio modal
        modal.addEventListener('click', function(event) {
            // Procura pelo cabeçalho clicado mais próximo
            const header = event.target.closest('.collapsible-header');
            
            // Se não clicou em um cabeçalho, não faz nada
            if (!header) return;

            // Impede que o clique se propague para outros elementos
            event.stopPropagation();
            
            const section = header.closest('.collapsible-section');
            if (section) {
                // Alterna a classe 'open' para abrir/fechar
                section.classList.toggle('open');
                const isNowOpen = section.classList.contains('open');
                
                const icon = header.querySelector('.toggle-collapse-btn i');
                if (icon) {
                    // Sincroniza o ícone de seta
                    icon.classList.toggle('fa-chevron-up', isNowOpen);
                    icon.classList.toggle('fa-chevron-down', !isNowOpen);
                }
            }
        });
        // 3. Marca o modal para sabermos que o listener já foi adicionado
        modal.dataset.accordionListener = 'true';
    }
    
    // =================================================================
    // FIM DA CORREÇÃO
    // =================================================================

    // Força o fechamento de todas as seções do acordeão ao abrir o modal
    document.querySelectorAll('#manageUsersModal .collapsible-section').forEach(section => {
        section.classList.remove('open');
        const icon = section.querySelector('.collapsible-header .toggle-collapse-btn i');
        if (icon) {
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        }
    });

    // Anexa os listeners de formulário e busca (sua lógica original mantida)
    const searchBtn = document.getElementById('userSearchBtn');
    if (searchBtn && searchInput) {
        searchBtn.onclick = () => fetchAndRenderUsers(searchInput.value);
        searchInput.onkeypress = (e) => {
            if (e.key === 'Enter') fetchAndRenderUsers(searchInput.value);
        };
    }
    document.getElementById("registerUserForm").onsubmit = registerUser;
    document.getElementById("editUserForm").onsubmit = editUser;
    document.getElementById("editMyProfileForm").onsubmit = editMyProfile;
    document.getElementById("createRoleForm").onsubmit = createRole;
    document.getElementById("editRoleForm").onsubmit = saveRoleChanges;

    // Carrega os dados dinâmicos do modal (sua lógica original mantida)
    const permissions = window.userPermissions || [];
    const loadPromises = [];

    if (permissions.includes('user.list.view')) {
        loadPromises.push(fetchAndRenderUsers(''));
    } else {
        const userListDiv = document.getElementById("userList");
        if (userListDiv) userListDiv.innerHTML = '<p class="no-users">Acesso negado.</p>';
    }

    if ((permissions.includes('role.create.form') || permissions.includes('user.edit.any')) && permissions.includes('permissions.view')) {
        loadPromises.push(populatePermissionsCheckbox('permissionsCheckboxContainer').catch(e => console.warn("Falha ao carregar 'permissionsCheckboxContainer'", e.message)));
    }

    if (permissions.includes('user.create.form') || permissions.includes('user.edit.role')) {
        loadPromises.push(populateRolesDropdowns());
    }

    if (permissions.includes('role.list.view')) {
        loadPromises.push(fetchAndRenderRoles());
    } else {
        const rolesListDiv = document.getElementById("rolesList");
        if (rolesListDiv) rolesListDiv.innerHTML = '<p class="no-roles">Acesso negado.</p>';
    }

    try {
        await Promise.all(loadPromises);
    } catch (e) {
        console.error("Erro ao carregar componentes do modal de usuário:", e);
        window.showError("Erro ao carregar dados do modal: " + e.message);
    }
    
    window.applyUIPermissions(currentUser.role);

    if (currentUser.role === 'Software') {
        const rolesListSection = document.getElementById('rolesListSection');
        if (rolesListSection) rolesListSection.style.display = 'block';
    }
};



// NOVA FUNÇÃO: Renderiza os controles de paginação para a lista de usuários no modal
function renderUserListPagination(pagination, searchTerm) {
    let paginationContainer = document.getElementById('userListPagination');
    const userListSection = document.getElementById('userListSection');
    if (!userListSection) return;

    if (!paginationContainer) {
        paginationContainer = document.createElement('div');
        paginationContainer.id = 'userListPagination';
        paginationContainer.className = 'pagination-controls';
        userListSection.querySelector('.collapsible-content').appendChild(paginationContainer); // Adiciona ao final do conteúdo
    }
    paginationContainer.innerHTML = '';

    const { totalPages, currentPage } = pagination;
    if (totalPages <= 1) return;

    const prevButton = document.createElement('button');
    prevButton.innerHTML = '&laquo; Anterior';
    prevButton.className = 'action-button secondary small';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => {
        fetchAndRenderUsers(searchTerm, currentPage - 1);
    });
    paginationContainer.appendChild(prevButton);

    const pageInfo = document.createElement('span');
    pageInfo.className = 'page-info';
    pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
    paginationContainer.appendChild(pageInfo);

    const nextButton = document.createElement('button');
    nextButton.innerHTML = 'Próximo &raquo;';
    nextButton.className = 'action-button secondary small';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => {
        fetchAndRenderUsers(searchTerm, currentPage + 1);
    });
    paginationContainer.appendChild(nextButton);
}

/**
 * Busca todas as permissões da API e as renderiza como checkboxes em um container específico.
 * @param {string} containerId - O ID do container onde as checkboxes serão inseridas.
 */
async function populatePermissionsCheckbox(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<p>Carregando permissões...</p>';
    
    try {
        // Esta chamada requer a permissão 'permissions.view'
        const response = await window.authenticatedFetch(`${API_BASE_URL}/permissions`);
        if (!response.ok) {
             const errorData = await response.json();
             throw new Error(errorData.error || 'Falha ao carregar permissões.');
        }
        
        const permissions = await response.json();
        container.innerHTML = ''; 

        permissions.forEach(permission => {
            const item = document.createElement('div');
            item.className = 'permission-item';
            item.innerHTML = `
                <input type="checkbox" id="perm-${containerId}-${permission.id}" value="${permission.id}">
                <label for="perm-${containerId}-${permission.id}" title="${permission.chave}">${permission.descricao}</label>
            `;
            container.appendChild(item);
        });

    } catch (error) {
        console.error(`Erro ao popular permissões em #${containerId}:`, error);
        container.innerHTML = `<p style="color:red;">${error.message}</p>`;
        // Lança o erro para que a promessa em openManageUsersModal possa capturá-lo
        throw error;
    }
}

/**
 * Busca todos os níveis de acesso e popula os selects de cadastro e edição de usuário.
 */
async function populateRolesDropdowns() {
    const registerRoleSelect = document.getElementById('registerRole');
    const editRoleSelect = document.getElementById('editRole');
    
    if (!registerRoleSelect || !editRoleSelect) return;

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/roles`);
        if (!response.ok) throw new Error('Falha ao carregar níveis de acesso.');
        
        const roles = await response.json();

        // Limpa as opções existentes
        registerRoleSelect.innerHTML = '';
        editRoleSelect.innerHTML = '';
        
        roles.forEach(role => {
            const option1 = document.createElement('option');
            option1.value = role.nome;
            option1.textContent = role.nome;
            registerRoleSelect.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = role.nome;
            option2.textContent = role.nome;
            editRoleSelect.appendChild(option2);
        });

    } catch (error) {
        console.error('Erro ao popular dropdown de Níveis de Acesso:', error);
        registerRoleSelect.innerHTML = '<option value="">Erro ao carregar</option>';
        editRoleSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}


/**
 * Cria um novo Nível de Acesso com as permissões selecionadas.
 */
async function createRole(event) {
    event.preventDefault();
    const roleName = document.getElementById('newRoleName').value.trim();
    if (!roleName) {
        window.showError("O nome do novo nível de acesso é obrigatório.");
        return;
    }

    const selectedPermissions = [];
    document.querySelectorAll('#permissionsCheckboxContainer input[type="checkbox"]:checked').forEach(checkbox => {
        selectedPermissions.push(parseInt(checkbox.value));
    });

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/roles`, {
            method: 'POST',
            body: JSON.stringify({ nome: roleName, permissionIds: selectedPermissions })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Erro desconhecido');

        window.showToast(result.message, 'success');
        document.getElementById('createRoleForm').reset();
        
        await populateRolesDropdowns();
        await fetchAndRenderRoles();

    } catch (error) {
        console.error("Erro ao criar Nível de Acesso:", error);
        window.showError(error.message);
    }
}

/**
 * Busca e renderiza a lista de níveis de acesso existentes para edição.
 */
async function fetchAndRenderRoles() {
    const rolesListDiv = document.getElementById("rolesList");
    if (!rolesListDiv) return;
    rolesListDiv.innerHTML = '<p class="no-roles">Carregando...</p>';

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/roles`);
        if (!response.ok) throw new Error('Falha ao carregar níveis de acesso.');

        const roles = await response.json();
        rolesListDiv.innerHTML = '';

        if (roles.length === 0) {
            rolesListDiv.innerHTML = '<p class="no-roles">Nenhum nível de acesso criado.</p>';
            return;
        }

        roles.forEach(role => {
            const roleItem = document.createElement('div');
            roleItem.className = 'role-item';
            roleItem.innerHTML = `
                <span>${role.nome}</span>
                <div class="role-item-actions">
                    <button class="action-button secondary small edit-role-btn" data-role-id="${role.id}" title="Editar Permissões">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-button danger small delete-role-btn" data-role-id="${role.id}" data-role-name="${role.nome}" title="Excluir Nível">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `;
            rolesListDiv.appendChild(roleItem);
        });

        rolesListDiv.querySelectorAll('.edit-role-btn').forEach(btn => {
            btn.addEventListener('click', (e) => openEditRoleModal(e.currentTarget.dataset.roleId));
        });
        
        rolesListDiv.querySelectorAll('.delete-role-btn').forEach(btn => {
            btn.addEventListener('click', (e) => openDeleteRoleConfirm(e.currentTarget.dataset.roleId, e.currentTarget.dataset.roleName));
        });
        
    } catch (error) {
        console.error("Erro ao renderizar níveis de acesso:", error);
        rolesListDiv.innerHTML = '<p class="no-roles" style="color:red;">Erro ao carregar níveis.</p>';
    }
}

/**
 * Abre o modal para editar um nível de acesso existente.
 */
async function openEditRoleModal(roleId) {
    
    // ▼▼▼ INÍCIO DA CORREÇÃO 2 ▼▼▼
    // Só tenta popular as permissões se o usuário tiver a permissão 'permissions.view'
    if (window.userPermissions.includes('permissions.view')) {
        await populatePermissionsCheckbox('editPermissionsCheckboxContainer'); 
    } else {
        // Se não tiver permissão, mostra uma mensagem de erro no container
        const container = document.getElementById('editPermissionsCheckboxContainer');
        if (container) {
            container.innerHTML = '<p style="color:red;">Acesso negado para visualizar a lista de permissões.</p>';
        }
    }
    // ▲▲▲ FIM DA CORREÇÃO 2 ▲▲▲

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/roles/${roleId}`);
        if (!response.ok) throw new Error('Falha ao buscar dados do nível de acesso.');

        const roleData = await response.json();

        document.getElementById('editRoleId').value = roleData.id;
        document.getElementById('editRoleName').value = roleData.nome;

        // Limpa checkboxes anteriores (segurança)
        document.querySelectorAll('#editPermissionsCheckboxContainer input[type="checkbox"]').forEach(cb => cb.checked = false);

        // Marca as permissões que este nível possui
        roleData.permissionIds.forEach(permissionId => {
            const checkbox = document.getElementById(`perm-editPermissionsCheckboxContainer-${permissionId}`);
            if (checkbox) {
                checkbox.checked = true;
            }
        });

        const searchInput = document.getElementById('editPermissionsSearchInput');
        searchInput.value = ''; 

        // Listener do filtro (é seguro adicionar de novo, pois o onsubmit abaixo é o principal)
        searchInput.oninput = () => {
            const searchTerm = searchInput.value.toLowerCase();
            const permissions = document.querySelectorAll('#editPermissionsCheckboxContainer .permission-item');
            
            permissions.forEach(item => {
                const label = item.querySelector('label');
                const labelText = label.textContent.toLowerCase();
                
                if (labelText.includes(searchTerm)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        };
        
        document.getElementById('editRoleForm').onsubmit = saveRoleChanges;

        window.openModal('editRoleModal');

    } catch (error) {
        console.error("Erro ao abrir modal de edição de nível:", error);
        window.showError(error.message);
    }
}

/**
 * Salva as alterações de um nível de acesso editado.
 */
async function saveRoleChanges(event) {
    event.preventDefault();
    const roleId = document.getElementById('editRoleId').value;
    const roleName = document.getElementById('editRoleName').value.trim();
    if (!roleName) {
        window.showError("O nome do nível de acesso é obrigatório.");
        return;
    }

    const selectedPermissions = [];
    document.querySelectorAll('#editPermissionsCheckboxContainer input[type="checkbox"]:checked').forEach(checkbox => {
        selectedPermissions.push(parseInt(checkbox.value));
    });

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/roles/${roleId}`, {
            method: 'PUT',
            body: JSON.stringify({ nome: roleName, permissionIds: selectedPermissions })
        });
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Erro desconhecido');
        
        window.showToast(result.message, 'success');
        window.closeModal('editRoleModal');
        
        await fetchAndRenderRoles();
        await populateRolesDropdowns();

    } catch (error) {
        console.error("Erro ao salvar alterações do nível de acesso:", error);
        window.showError(error.message);
    }
}

/**
 * Abre a confirmação para excluir um nível de acesso.
 */
function openDeleteRoleConfirm(roleId, roleName) {
    // Impede a exclusão dos 7 primeiros níveis (padrão)
    if (parseInt(roleId) <= 7) {
        window.showError("Não é permitido excluir os níveis de acesso padrão do sistema.");
        return;
    }
    const message = `Tem certeza que deseja excluir o nível "${roleName}"?\n\nTodos os usuários neste nível serão movidos para o próximo nível disponível ou para "Visualização". Esta ação não pode ser desfeita.`;
    if (confirm(message)) {
        deleteRole(roleId);
    }
}

/**
 * Exclui um nível de acesso.
 */
async function deleteRole(roleId) {
    // Dupla verificação para segurança
    if (parseInt(roleId) <= 7) {
        window.showError("Não é permitido excluir os níveis de acesso padrão do sistema.");
        return;
    }
    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/roles/${roleId}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Erro desconhecido');

        window.showToast(result.message, 'success');
        
        await fetchAndRenderUsers('');
        await populateRolesDropdowns();
        await fetchAndRenderRoles();

    } catch (error) {
        console.error("Erro ao excluir nível de acesso:", error);
        window.showError(error.message);
    }
}


// --- Funções de Gerenciamento de Usuário (Mantidas e Adaptadas) ---

async function fetchAndRenderUsers(searchTerm = '', page = 1) {
    const userListDiv = document.getElementById("userList");
    if (!userListDiv) return;
    userListDiv.innerHTML = '<p class="no-users">Carregando usuários...</p>';
    try {
        const limit = 4;
        const url = `${API_BASE_URL}/users?search=${encodeURIComponent(searchTerm)}&page=${page}&limit=${limit}`;
        const response = await window.authenticatedFetch(url);
        if (!response.ok) throw new Error('Falha ao carregar a lista de usuários.');
        
        const { users: allUsers, pagination } = await response.json();
        
        const currentUser = window.currentUser;
        let usersToRender = Array.isArray(allUsers) ? allUsers : [];
        
        // CORREÇÃO: A lógica de filtro estava errada. Usuários não-Software/Diretoria não devem ver NENHUM usuário.
        // A permissão 'user.list.view' já controla isso no lado do frontend (em applyUIPermissions)
        // e no backend (a API não retornaria nada). Esta lógica local é redundante, mas mantida por segurança.
        if (currentUser && !window.userPermissions.includes('user.list.view')) {
             usersToRender = []; // Se não tem permissão para ver a lista, não mostra ninguém.
        }

        userListDiv.innerHTML = '';
        if (usersToRender.length === 0) {
            userListDiv.innerHTML = '<p class="no-users">Nenhum usuário encontrado.</p>';
        } else {
            usersToRender.forEach(user => {
                const userNameDisplay = user.nome || user.username || 'Não informado';
                const userCard = document.createElement('div');
                userCard.className = 'user-card-item';
                userCard.innerHTML = `
                    <div class="tool-info">
                        <h4>${userNameDisplay} (${user.username})</h4>
                        <p><strong>Nível de Acesso:</strong> ${user.role}</p>
                        <p><strong>Criado em:</strong> ${window.formatDate(user.created_at, true)}</p>
                    </div>
                    <div class="tool-actions">
                        <button class="action-button primary small edit-user-btn" data-user-id="${user.id}"><i class="fas fa-edit"></i> Editar</button>
                        <button class="action-button danger small delete-user-btn" data-user-id="${user.id}" data-username="${user.username}"><i class="fas fa-trash-alt"></i> Excluir</button>
                    </div>
                `;
                userListDiv.appendChild(userCard);
            });
            userListDiv.querySelectorAll('.edit-user-btn').forEach(btn => btn.addEventListener('click', (e) => openEditUserModal(e.currentTarget.dataset.userId)));
            userListDiv.querySelectorAll('.delete-user-btn').forEach(btn => btn.addEventListener('click', (e) => openDeleteUserConfirmModal(e.currentTarget.dataset.userId, e.currentTarget.dataset.username)));
        }

        renderUserListPagination(pagination, searchTerm);
        window.applyUIPermissions(window.currentUser?.role);
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        userListDiv.innerHTML = '<p class="no-users" style="color:red;">Erro ao carregar usuários.</p>';
    }
}

async function registerUser(event) {
    event.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const password = document.getElementById('registerPassword').value;
    const nome = document.getElementById('registerName').value;
    const role = document.getElementById('registerRole').value;
    const statusMessage = document.getElementById('registerStatusMessage');
    statusMessage.style.display = 'none';
    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            body: JSON.stringify({ username, password, nome, role })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erro desconhecido');
        window.showToast(data.message, 'success');
        document.getElementById('registerUserForm').reset();
        fetchAndRenderUsers();
    } catch (error) {
        console.error('Erro ao registrar usuário:', error);
        statusMessage.textContent = error.message;
        statusMessage.classList.remove('success');
        statusMessage.classList.add('error');
        statusMessage.style.display = 'block';
    }
}

window.openEditUserModal = async function(userId) {
    try {
        await populateRolesDropdowns();

        const userResponse = await window.authenticatedFetch(`${API_BASE_URL}/users/${userId}`);
        if (!userResponse.ok) throw new Error('Falha ao buscar dados do usuário.');
        const user = await userResponse.json();

        const projectsResponse = await window.authenticatedFetch(`${API_BASE_URL}/projetos`);
        if (!projectsResponse.ok) throw new Error('Falha ao carregar a lista de projetos.');
        const allProjects = await projectsResponse.json();

        const permissionsResponse = await window.authenticatedFetch(`${API_BASE_URL}/users/${userId}/project-permissions`);
        if (!permissionsResponse.ok) throw new Error('Falha ao carregar as permissões do usuário.');
        const permittedProjectIds = await permissionsResponse.json();
        const permittedIdsSet = new Set(permittedProjectIds);

        document.getElementById('editUserId').value = user.id;
        document.getElementById('editUsername').value = user.username;
        document.getElementById('editName').value = user.nome;
        document.getElementById('editRole').value = user.role;
        document.getElementById('editPassword').value = '';

        const projectsListDiv = document.getElementById('editUserProjectsList');
        projectsListDiv.innerHTML = '';
        if (allProjects.length === 0) {
            projectsListDiv.innerHTML = '<p>Nenhum projeto cadastrado no sistema.</p>';
        } else {
            allProjects.forEach(project => {
                const hasAccess = permittedIdsSet.has(project.id);
                const projectItem = document.createElement('div');
                projectItem.className = 'permission-item';
                projectItem.innerHTML = `
                    <input type="checkbox" id="proj-perm-${project.id}" value="${project.id}" ${hasAccess ? 'checked' : ''}>
                    <label for="proj-perm-${project.id}" title="${project.nome}">${project.nome}</label>
                `;
                projectsListDiv.appendChild(projectItem);
            });
        }

        window.openModal('editUserModal');
        window.applyUIPermissions(window.currentUser?.role);

        document.getElementById('editRole').disabled = !window.userPermissions.includes('user.edit.role');

    } catch (error) {
        console.error("Erro ao abrir modal de edição de usuário:", error);
        window.showError(error.message);
    }
};

async function editUser(event) {
    event.preventDefault();
    const userId = document.getElementById('editUserId').value;
    const username = document.getElementById('editUsername').value;
    const password = document.getElementById('editPassword').value;
    const nome = document.getElementById('editName').value;
    const role = document.getElementById('editRole').value;

    const selectedProjectIds = Array.from(document.querySelectorAll('#editUserProjectsList input[type="checkbox"]:checked')).map(cb => cb.value);

    const userData = { username, nome, role, project_ids: selectedProjectIds };
    if (password) {
        userData.password = password;
    }

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erro desconhecido');
        window.showToast(data.message, 'success');
        window.closeModal('editUserModal');
        fetchAndRenderUsers();
    } catch (error) {
        window.showError(error.message);
    }
}

window.openEditEmployeeModal = async function(employeeId) {
    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/employees/${employeeId}`);
        if (!response.ok) throw new Error('Falha ao buscar dados do funcionário.');
        const employee = await response.json();

        document.getElementById('editEmployeeId').value = employee.id;
        document.getElementById('editEmployeeName').value = employee.nome;
        document.getElementById('editEmployeeRole').value = employee.cargo;

        window.openModal('editEmployeeModal');
    } catch (error) {
        console.error('Erro ao abrir modal de edição de funcionário:', error);
        window.showError(`Erro: ${error.message}`);
    }
};

window.openDeleteUserConfirmModal = function(userId, username) {
    document.getElementById('deleteUserName').textContent = username;
    const confirmDeleteBtn = document.getElementById('confirmDeleteUserBtn');
    confirmDeleteBtn.onclick = () => deleteUser(userId);
    window.openModal('confirmDeleteUserConfirmModal');
};

async function deleteUser(userId) {
    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/users/${userId}`, { method: 'DELETE' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erro desconhecido');
        window.showToast(data.message, 'success');
        window.closeModal('confirmDeleteUserConfirmModal');
        fetchAndRenderUsers();
    } catch (error) {
        window.showError(error.message);
    }
}

window.openMyProfileModal = async function() {
    let currentUser = window.getCurrentUser();
    if (!currentUser || !currentUser.id) return;
    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/users/${currentUser.id}`);
        const user = await response.json();
        document.getElementById("editMyProfileId").value = user.id;
        document.getElementById("editMyProfileUsername").value = user.username;
        document.getElementById("editMyProfileName").value = user.nome;
        document.getElementById("editMyProfileRole").value = user.role;
        document.getElementById("editMyProfilePassword").value = '';
        window.openModal("editMyProfileModal");
    } catch (error) {
        window.showError(error.message);
    }
};

async function editMyProfile(event) {
    event.preventDefault();
    const userId = document.getElementById("editMyProfileId").value;
    const username = document.getElementById("editMyProfileUsername").value;
    const password = document.getElementById("editMyProfilePassword").value;
    const nome = document.getElementById("editMyProfileName").value;
    const role = document.getElementById("editMyProfileRole").value;
    
    // Para o próprio perfil, a lista de projetos não é editável, então enviamos um array vazio.
    const userData = { username, password, nome, role, project_ids: [] };

    try {
        const response = await window.authenticatedFetch(`${API_BASE_URL}/users/${userId}`, {
            method: "PUT",
            body: JSON.stringify(userData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erro desconhecido');
        window.showToast(data.message, "success");
        window.closeModal("editMyProfileModal");
        window.currentUser.username = username;
        window.currentUser.nome = nome;
        localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
        window.updateNavBarDisplay();
    } catch (error) {
        window.showError(error.message);
    }
}
