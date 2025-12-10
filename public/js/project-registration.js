// project-registration.js (VERSÃO ORIGINAL ATUALIZADA COM AS CORREÇÕES)

// Variável para o contador de etapas dinâmicas (usado no registro e edição)
let dynamicEtapaCounter = 0;

// ===============================================
// Funções para Tela 3 (Registro de Projeto)
// ===============================================

/**
 * Inicializa a tela de Registro de Projeto (Tela 3).
 * Esta função será chamada pelo seu script.js sempre que a tela 3 for ativada.
 */
window.initializeProjectRegistrationScreen = function() {
    console.log('Tela 3: Inicializando Cadastro de Projeto...');

    const cadastroProjetoForm = document.getElementById('cadastroProjetoForm');
    const addEtapaBtn = document.getElementById('addEtapaBtn');
    const openNewProjectBtn = document.getElementById('openNewProjectModalBtn'); // Botão que abre o modal

    // Garante que os listeners de evento sejam adicionados apenas uma vez
    if (cadastroProjetoForm && !cadastroProjetoForm.dataset.listenerAttached) {
        cadastroProjetoForm.addEventListener('submit', window.cadastrarProjeto);
        cadastroProjetoForm.dataset.listenerAttached = 'true';
    }

    if (addEtapaBtn && !addEtapaBtn.dataset.listenerAttached) {
        addEtapaBtn.addEventListener('click', () => window.addDynamicEtapaField('etapasContainer'));
        addEtapaBtn.dataset.listenerAttached = 'true';
    }
    
    // Adiciona o listener para o botão que abre o modal de cadastro
    if (openNewProjectBtn && !openNewProjectBtn.dataset.listenerAttached) {
        openNewProjectBtn.addEventListener('click', window.openProjectRegistrationModal);
        openNewProjectBtn.dataset.listenerAttached = 'true';
        console.log('Listener adicionado ao botão "Projeto Novo" com sucesso!');
    }

    // Aplica permissões de UI assim que a tela é inicializada
    if (window.applyUIPermissions && window.getCurrentUser) {
        window.applyUIPermissions(window.getCurrentUser()?.role);
    }
};

/**
 * Abre e prepara o modal de cadastro de projeto.
 */
window.openProjectRegistrationModal = function() {
    console.log('Project Registration: Abrindo modal de cadastro...');
    const cadastroProjetoForm = document.getElementById('cadastroProjetoForm');
    const etapasContainer = document.getElementById('etapasContainer');

    if (cadastroProjetoForm && etapasContainer) {
        cadastroProjetoForm.reset();
        etapasContainer.innerHTML = ''; // Limpa etapas antigas

        const defaultStages = [
            "Requisitos", "Des. MEC/HW/SW", "Aquisições",
            "Usinagem/Montagem", "Teste e validação", "Entrega"
        ];

        defaultStages.forEach(stageName => {
            window.addDynamicEtapaField('etapasContainer', '', { nome_etapa: stageName });
        });
        
        setupDragAndDrop('etapasContainer'); // Configura o drag-and-drop para as novas etapas
    }
    
    window.openModal('projectRegistrationModal');
    
    // Aplica permissões aos elementos dentro do modal
    if (window.applyUIPermissions && window.getCurrentUser) {
        window.applyUIPermissions(window.getCurrentUser()?.role);
    }
};


/**
 * Adiciona um novo campo de etapa dinâmica a um contêiner.
 */
window.addDynamicEtapaField = function(containerId, prefix = '', etapaData = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const newEtapaDiv = document.createElement('div');
    newEtapaDiv.className = 'etapa-item etapa-dynamic-item drag-item';
    newEtapaDiv.draggable = true;

    if (etapaData && etapaData.id) {
        newEtapaDiv.dataset.etapaId = etapaData.id;
        newEtapaDiv.dataset.isNew = 'false';
        newEtapaDiv.dataset.isDeleted = 'false';
    } else {
        newEtapaDiv.dataset.etapaId = 'null';
        newEtapaDiv.dataset.isNew = 'true';
        newEtapaDiv.dataset.isDeleted = 'false';
    }

    const nomeEtapaValue = etapaData ? etapaData.nome_etapa : '';

    let dataInicioValue = '';
    if (etapaData && etapaData.data_inicio) {
        const datePart = etapaData.data_inicio.split(' ')[0];
        const parts = datePart.split('/');
        if (parts.length === 3) {
            dataInicioValue = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
    }

    let dataFimValue = '';
    if (etapaData && etapaData.data_fim) {
        const datePart = etapaData.data_fim.split(' ')[0];
        const parts = datePart.split('/');
        if (parts.length === 3) {
            dataFimValue = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
    }

    newEtapaDiv.innerHTML = `
        <h4>Etapa <span class="etapa-order"></span>:
            <input type="text" class="nome-etapa-input" value="${nomeEtapaValue}" placeholder="Nome da Etapa" required>
        </h4>
        <div class="form-row">
            <div class="form-group">
                <label>De:</label>
                <input type="date" class="data-inicio-etapa-input" value="${dataInicioValue}">
            </div>
            <div class="form-group">
                <label>Até:</label>
                <input type="date" class="data-fim-etapa-input" value="${dataFimValue}">
            </div>
        </div>
        <button type="button" class="action-button danger remove-etapa-btn">Remover Etapa</button>
    `;
    container.appendChild(newEtapaDiv);

    const removeBtn = newEtapaDiv.querySelector('.remove-etapa-btn');

    removeBtn.addEventListener('click', (event) => {
        const itemToRemove = event.target.closest('.etapa-dynamic-item');
        if (itemToRemove) {
            if (itemToRemove.dataset.etapaId && itemToRemove.dataset.etapaId !== 'null') {
                if (confirm('Tem certeza que deseja excluir esta etapa? Isso removerá todas as sub-etapas vinculadas.')) {
                    itemToRemove.dataset.isDeleted = 'true';
                    itemToRemove.style.display = 'none';
                    window.updateEtapaOrder(containerId);
                }
            } else {
                itemToRemove.remove();
                window.updateEtapaOrder(containerId);
            }
        }
    });

    window.updateEtapaOrder(containerId);
    if (window.applyUIPermissions && window.getCurrentUser) {
        window.applyUIPermissions(window.getCurrentUser()?.role);
    }
};

/**
 * Atualiza os números de ordem das etapas dinâmicas no frontend.
 */
window.updateEtapaOrder = function(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const etapas = container.querySelectorAll('.etapa-dynamic-item:not([data-is-deleted="true"])');
    etapas.forEach((etapaDiv, index) => {
        const orderSpan = etapaDiv.querySelector('.etapa-order');
        if (orderSpan) {
            orderSpan.textContent = index + 1;
        }
    });
};

/**
 * Registra um novo projeto.
 */
window.cadastrarProjeto = async function(event) {
    // ***** AQUI ESTÁ A CORREÇÃO PRINCIPAL *****
    event.preventDefault(); // Impede que o formulário recarregue a página.
    // ***** FIM DA CORREÇÃO *****

    const nome = document.getElementById('projetoNome').value.trim();
    const coordenador = document.getElementById('projetoCoordenador').value.trim();
    const lider = document.getElementById('projetoLider').value.trim();
    const equipe = document.getElementById('projetoEquipe').value.trim();
    const data_inicio_iso = document.getElementById('projetoDataInicio').value;
    const data_fim_iso = document.getElementById('projetoDataFim').value;

    if (!nome || !coordenador || !lider || !equipe || !data_inicio_iso || !data_fim_iso) {
        window.showError('Todos os campos de informação do projeto (Nome, Coordenador, Líder, Equipe, Data de Início e Entrega) são obrigatórios.');
        return;
    }

    const data_inicio_formatado = window.formatDateForDB(data_inicio_iso);
    const data_fim_formatado = window.formatDateForDB(data_fim_iso);

    const equipeArray = equipe.split(',').map(name => name.trim()).filter(name => name);
    const equipe_json = JSON.stringify(equipeArray);

    const etapasInputs = document.querySelectorAll('#etapasContainer .etapa-dynamic-item');
    const etapasToSave = [];

    for (let i = 0; i < etapasInputs.length; i++) {
        const item = etapasInputs[i];
        if (item.dataset.isDeleted === 'true') {
            continue; 
        }

        const nomeEtapa = item.querySelector('.nome-etapa-input').value.trim();
        const dataInicioEtapaISO = item.querySelector('.data-inicio-etapa-input').value;
        const dataFimEtapaISO = item.querySelector('.data-fim-etapa-input').value;

        if (!nomeEtapa) { 
            window.showError(`O nome da Etapa ${i + 1} é obrigatório.`); 
            return; 
        }
        if (!dataInicioEtapaISO || !dataFimEtapaISO) {
            window.showError(`As datas de Início (De) e Fim (Até) são obrigatórias para a Etapa ${i + 1}: '${nomeEtapa}'.`);
            return;
        }

        const formattedEtapaDataInicio = window.formatDateForDB(dataInicioEtapaISO);
        const formattedEtapaDataFim = window.formatDateForDB(dataFimEtapaISO);

        etapasToSave.push({
            nome_etapa: nomeEtapa,
            ordem: i + 1,
            data_inicio: formattedEtapaDataInicio,
            data_fim: formattedEtapaDataFim,
        });
    }

    if (etapasToSave.length === 0) { 
        window.showError('Por favor, adicione pelo menos uma etapa para o projeto.'); 
        return; 
    }

    try {
        const projectResponse = await window.authenticatedFetch(`${API_BASE_URL}/projetos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nome,
                coordenador,
                lider,
                equipe: equipe_json,
                data_inicio: data_inicio_formatado,
                data_fim: data_fim_formatado,
                etapas: etapasToSave
            }),
        });
        if (!projectResponse.ok) {
            const errorData = await projectResponse.json().catch(() => ({ error: 'Erro desconhecido ao registrar o projeto.' }));
            throw new Error(errorData.error || 'Erro ao registrar o projeto.');
        }
        
        window.showToast('Projeto e etapas registrados com sucesso!', 'success');
        window.closeModal('projectRegistrationModal');
        
        setTimeout(() => {
            window.switchScreen('tela2');
        }, 1500);

    } catch (error) {
        console.error('Erro ao registrar projeto:', error);
        window.showError('Erro ao registrar projeto: ' + error.message);
    }
};

// --- Funções de Drag and Drop ---
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

    function handleDragEnd(e) {
        const items = document.querySelectorAll(`#${containerId} .drag-item`);
        items.forEach(item => {
            item.style.opacity = '1';
        });
        window.updateEtapaOrder(containerId);
    }

    container.removeEventListener('dragstart', handleDragStart);
    container.removeEventListener('dragend', handleDragEnd);
    container.querySelectorAll('.drag-item').forEach(item => {
        item.removeEventListener('dragover', handleDragOver);
    });

    container.addEventListener('dragstart', handleDragStart);
    container.addEventListener('dragend', handleDragEnd);
    container.querySelectorAll('.drag-item').forEach(item => {
        item.addEventListener('dragover', handleDragOver);
    });
}

// Listeners de Evento para elementos de Registro de Projeto (Tela 3)
document.addEventListener('DOMContentLoaded', function() {
    console.log("project-registration.js: DOMContentLoaded disparado.");

    const cadastroProjetoForm = document.getElementById('cadastroProjetoForm');
    const addEtapaBtn = document.getElementById('addEtapaBtn');

    if (cadastroProjetoForm) {
        cadastroProjetoForm.addEventListener('submit', window.cadastrarProjeto);
    }
    if (addEtapaBtn) {
        addEtapaBtn.addEventListener('click', () => window.addDynamicEtapaField('etapasContainer'));
    }
});
