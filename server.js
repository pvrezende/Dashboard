// ========================================================
// server.js — PARTE 1/6  (linhas 1–727 do arquivo processado)
// ATENÇÃO: Este arquivo foi gerado automaticamente a partir do server.js original.
//          Esta parte inclui comentários automáticos em rotas que não possuíam.
//          Mantenha a ordem das partes ao recombinar o código.
// ========================================================

// server.js (CORRIGIDO PARA SINCRONIZAR USUÁRIOS E FUNCIONÁRIOS AO ATRIBUIR ATIVIDADE)

require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ExcelJS = require('exceljs');
const mime = require('mime-types');
const xlsx = require('xlsx');

console.log("--- SERVIDOR REINICIADO COM SUCESSO --- Versão 2.0 ---"); // <-- ADICIONE ESTA LINHA

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Adicione um log para cada requisição recebida
app.use((req, res, next) => {
    console.log(`Recebida requisição: ${req.method} ${req.url}`);
    next();
});

app.use(express.static(__dirname, {
    setHeaders: (res, path) => {
        if (path.endsWith(".css")) {
            res.setHeader("Content-Type", "text/css");
        } else if (path.endsWith(".js")) {
            res.setHeader("Content-Type", "application/javascript");
        }
    }
}));

// Serve arquivos estáticos da pasta 'uploads'
app.use(express.static(path.join(__dirname, 'public')));

// Crítico: Manipuladores de erro globais para diagnóstico de falhas
process.on('uncaughtException', (err) => {
    console.error('EXCEÇÃO CRÍTICA NÃO CAPTURADA! O servidor está prestes a falhar:', err.stack || err.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('REJEIÇÃO DE PROMISE CRÍTICA NÃO MANIPULADA! O servidor está prestas a falhar:', reason);
    promise.catch(err => {
        console.error('Razão da rejeição (erro completo):', err.stack || err.message);
    });
    process.exit(1);
});

// Conexão com banco de dados
console.log("DB_HOST que está sendo usado: ", process.env.DB_HOST);
const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "root",
    database: process.env.DB_DATABASE || "producao",
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
    charset: 'utf8mb4'
});

/**
 * Função auxiliar para registrar uma ação na tabela de logs de auditoria.
 * @param {object} connection - A conexão ativa com o banco de dados.
 * @param {number} usuario_id - O ID do usuário que realizou a ação.
 * @param {string} usuario_nome - O nome do usuário que realizou a ação.
 * @param {'CRIACAO'|'EDICAO'|'EXCLUSAO'} acao - O tipo de ação.
 * @param {string} entidade - O tipo de entidade que foi afetada (ex: 'Projeto', 'Usuário').
 * @param {number} entidade_id - O ID da entidade que foi afetada.
 * @param {string} detalhes - Uma descrição detalhada da ação.
 */
async function registrarAcao(connection, usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes) {
    try {
        const logQuery = `
            INSERT INTO audit_logs (usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        await connection.query(logQuery, [usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes]);
        console.log(`[LOG DE AUDITORIA] Ação registrada: ${detalhes}`);
    } catch (error) {
        // Loga o erro, mas não interrompe a operação principal.
        console.error("FALHA AO REGISTRAR LOG DE AUDITORIA:", error);
    }
}

/**
 * Função auxiliar para registrar uma ação na tabela de log de aprovação da BOM.
 * @param {object} connection - A conexão ativa com o banco de dados.
 * @param {number} bom_item_id - O ID do item da BOM.
 * @param {'Solicitante'|'Líder'|'Gestor'|'Cotação'|'Diretoria'|'Financeiro'} etapa - A etapa do fluxo.
 * @param {'Solicitado'|'Aprovado'|'Reprovado'|'Cotação Selecionada'|'Retornado'} acao - A ação realizada.
 * @param {number} usuario_id - O ID do usuário que realizou a ação.
 * @param {string} usuario_nome - O nome do usuário que realizou a ação.
 */
async function logBomApproval(connection, bom_item_id, etapa, acao, usuario_id, usuario_nome) {
    try {
        const logQuery = `
            INSERT INTO bom_approval_log (bom_item_id, etapa, acao, usuario_id, usuario_nome, timestamp)
            VALUES (?, ?, ?, ?, ?, NOW())
        `;
        // Garante que o ID do usuário seja nulo se não for um número válido (evita erros de FK)
        const validUserId = (typeof usuario_id === 'number' && !isNaN(usuario_id)) ? usuario_id : null;
        
        await connection.query(logQuery, [bom_item_id, etapa, acao, validUserId, usuario_nome]);
        console.log(`[LOG DE APROVAÇÃO BOM] Item ID ${bom_item_id}: Etapa '${etapa}' registrada como '${acao}' por '${usuario_nome}'.`);
    } catch (error) {
        // Loga o erro, mas não interrompe a operação principal.
        console.error("FALHA AO REGISTRAR LOG DE APROVAÇÃO BOM:", error);
    }
}

// Teste a conexão do pool uma vez para garantir que está funcionando
db.promise().getConnection()
    .then(connection => {
        console.log("Conectado ao banco de dados via Pool.");
        connection.release();
    })
    .catch(err => {
        console.error("Erro ao conectar ao banco de dados via Pool:", err);
        process.exit(1);
    });

const pecasPorCaixa = 12;

// Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        // CORREÇÃO: Melhor tratamento de encoding para nomes de arquivos
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const extension = path.extname(originalName);
        const baseName = path.basename(originalName, extension);
        cb(null, `${file.fieldname}-${uniqueSuffix}-${baseName}${extension}`);
    }
});

const fileFilter = (req, file, cb) => {
    let allowedExtensionsRegex;

    if (req.url.includes('/shopping-file')) {
        // ATUALIZADO: Aceita .xlsx e .xls para a lista de compras
        allowedExtensionsRegex = /\.(xlsx|xls)$/i;
    } else {
        // Mantém as outras extensões para anexos de peças
        allowedExtensionsRegex = /\.(jpeg|jpg|png|pdf|dwg|dxf|ipt|idw|iam|ipn|stp|zip|rar)$/i;
    }
    
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const isExtensionAllowed = allowedExtensionsRegex.test(fileExtension);

    // ATUALIZAÇÃO: A verificação agora se baseia apenas na extensão do arquivo, que é mais confiável.
    if (isExtensionAllowed) {
        return cb(null, true);
    }

    const errorMessage = `Tipo de arquivo não suportado. Apenas os seguintes tipos são permitidos: ${allowedExtensionsRegex.source}.`;
    cb(new Error(errorMessage), false);
};

const upload = multer({ storage: storage, limits: { fileSize: 1024 * 1024 * 10 }, fileFilter: fileFilter });


// ===============================================
// Funções Auxiliares para Manipulação de Datas e Normalização de Entrada
// ===============================================

/**
 * Converte uma string de data/hora no formato DD/MM/YYYY [HH:MM:SS] para um objeto Date.
 * Retorna null se a string for inválida.
 * @param {string} dateString - A string de data/hora no formato DD/MM/YYYY [HH:MM:SS] ou DD/MM/YYYY.
 * @returns {Date|null} Objeto Date ou null.
 */
function parseDDMMYYYYtoDate(dateString) {
    if (!dateString || typeof dateString !== "string" || dateString.trim() === "") {
        return null;
    }
    const parts = dateString.split(" ");
    const dateParts = parts[0].split("/");
    
    if (dateParts.length !== 3) {
        return null;
    }

    const [day, month, year] = dateParts;
    const timePart = parts[1] || '00:00:00';

    const [hours, minutes, seconds] = timePart.split(':').map(Number);
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hours, minutes, seconds || 0);
    return isNaN(dateObj.getTime()) ? null : dateObj;
}

/**
 * Converte uma string de data no formato YYYY-MM-DD (vindo de input type="date") para DD/MM/YYYY.
 * Retorna null se a string for inválida.
 * @param {string} dateString - A string de data no formato YYYY-MM-DD.
 * @returns {string|null} A string de data no formato DD/MM/YYYY ou null.
 */
function formatYYYYMMDDtoDDMMYYYY(dateString) {
    if (!dateString || typeof dateString !== "string" || dateString.trim() === "") {
        return null;
    }
    if (dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        return dateString;
    }
    const parts = dateString.split("-");
    if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${day}/${month}/${year}`;
    }
    return null;
}

/**
 * Converte uma string de data no formato YYYY-MM-DD (vindo de input type="date") para YYYY-MM-DD.
 * Retorna null se a string for inválida.
 * @param {string} dateString - A string de data no formato YYYY-MM-DD.
 * @returns {string|null} A string de data no formato YYYY-MM-DD ou null.
 */
function formatYYYYMMDDForDB(dateString) {
    if (!dateString || typeof dateString !== "string" || dateString.trim() === "") {
        return null;
    }
    return dateString;
}


/**
 * Formata um objeto Date vindo do MySQL (que pode ser um objeto Date ou string ISO) para DD/MM/YYYY.
 * @param {Date|string|null} date - Objeto Date, string ISO ou null/undefined.
 * @returns {string|null} Data formatada ou null.
 */
function formatDateFromMySQL(date) {
    if (!date) return null;
    let d = date;
    if (typeof date === 'string') {
        if (date.includes('/') && date.includes(':')) {
            d = parseDDMMYYYYtoDate(date);
        } else if (date.includes('-')) {
            d = new Date(date + 'T00:00:00');
        } else {
            d = new Date(date);
        }
    } else if (!(date instanceof Date)) {
        return null;
    }

    if (!d || isNaN(d.getTime())) return null;

    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

/**
 * Formata um objeto Date para o formato de string 'DD/MM/YYYY HH:MM:SS', adequado para o MySQL.
 * Retorna null se o objeto Date for inválido.
 * @param {Date|null} dateObj - Objeto Date.
 * @returns {string|null} String de data/hora formatada ou null.
 */
function formatToMySQLDateTime(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return null;

    // Usar getDate(), getMonth() etc., que retornam componentes baseados no fuso horário LOCAL do objeto Date.
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Normaliza uma string de tempo. Retorna a string de tempo se não for vazia, caso contrário, retorna null.
 * @param {string} timeString - A string de tempo.
 * @returns {string|null} A string de tempo normalizada ou null.
 */
function normalizeTimeInput(timeString) {
    return timeString && timeString.trim() !== '' ? timeString.trim() : null;
}

// ===============================================
// JWT e Middlewares de Autenticação/Autorização
// ===============================================

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';
const JWT_EXPIRATION_TIME = '3d';

/**
 * Middleware para autenticar o token JWT.
 * Adiciona `req.user` com `id`, `username` e `role` se o token for válido.
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        console.warn('Autenticação: Token não fornecido.');
        return res.status(401).json({ error: 'Token de autenticação necessário.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('Autenticação: Erro na verificação do token:', err.message);
            return res.status(403).json({ error: 'Token de autenticação inválido ou expirado.' });
        }
        req.user = user;
        console.log(`Autenticação: Usuário '${req.user.username}' (ID: ${req.user.id}, Nível Acesso ID: ${req.user.nivel_acesso_id}) autenticado.`);
        next();
    });
}

/**
 * Middleware para autorizar o acesso com base na permissão.
 * @param {string} permissionKey - A chave da permissão a ser verificada (ex: 'canDeleteProject').
 */
function authorizePermission(permissionKey) {
    return async (req, res, next) => {
        if (!req.user || !req.user.nivel_acesso_id) {
            console.warn(`Autorização: Usuário não autenticado ou sem nível de acesso definido para a permissão '${permissionKey}'.`);
            return res.status(401).json({ error: 'Usuário não autenticado ou sem nível de acesso.' });
        }

        const { nivel_acesso_id } = req.user;
        let connection;
        try {
            connection = await db.promise().getConnection();
            const [permissions] = await connection.query(
                `SELECT p.chave FROM nivel_acesso_permissoes nap JOIN permissoes p ON nap.permissao_id = p.id WHERE nap.nivel_acesso_id = ?`,
                [nivel_acesso_id]
            );
            
            const userPermissions = permissions.map(p => p.chave);
            const hasPermission = userPermissions.includes(permissionKey);

            if (hasPermission) {
                console.log(`Autorização: Usuário '${req.user.username}' TEM permissão para '${permissionKey}'.`);
                next();
            } else {
                console.warn(`Autorização: Usuário '${req.user.username}' NÃO TEM permissão para '${permissionKey}'.`);
                res.status(403).json({ error: 'Acesso negado. Você não tem permissão para realizar esta ação.' });
            }
        } catch (err) {
            console.error("Erro no middleware de autorização:", err);
            res.status(500).json({ error: "Erro interno ao verificar permissões." });
        } finally {
            if (connection) connection.release();
        }
    };
}

/**
 * NOVA FUNÇÃO: Middleware para autorizar edição de usuário com lógica condicional.
 * Permite que usuários editem seu próprio perfil OU que usuários com canManageUsers editem qualquer perfil.
 */
async function authorizeUserEdit(req, res, next) {
    if (!req.user || !req.user.nivel_acesso_id) {
        return res.status(401).json({ error: 'Usuário não autenticado ou sem nível de acesso.' });
    }

    const { nivel_acesso_id, id: requestingUserId } = req.user;
    const targetUserId = parseInt(req.params.id);
    const isEditingOwnProfile = requestingUserId === targetUserId;

    let connection;
    try {
        connection = await db.promise().getConnection();
        const [permissions] = await connection.query(
            `SELECT p.chave FROM nivel_acesso_permissoes nap JOIN permissoes p ON nap.permissao_id = p.id WHERE nap.nivel_acesso_id = ?`,
            [nivel_acesso_id]
        );
        const userPermissions = permissions.map(p => p.chave);

        // Se o usuário está editando o próprio perfil
        if (isEditingOwnProfile) {
            if (userPermissions.includes('user.edit.own')) {
                // Se ele tenta mudar a própria role, mas não tem permissão para editar qualquer usuário, bloqueia.
                if (req.body.role && !userPermissions.includes('user.edit.any')) {
                     const [currentUserData] = await connection.query('SELECT role FROM usuarios WHERE id = ?', [requestingUserId]);
                     if (currentUserData.length > 0 && currentUserData[0].role !== req.body.role) {
                         return res.status(403).json({ error: "Você não tem permissão para alterar seu próprio nível de acesso." });
                     }
                }
                return next(); // Permite a edição do próprio perfil
            }
        }

        // Se está editando o perfil de outro usuário
        if (userPermissions.includes('user.edit.any')) {
            return next(); // Permite a edição de qualquer perfil
        }

        // Se nenhuma das condições acima foi atendida, nega o acesso.
        return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para realizar esta ação.' });

    } catch (err) {
        console.error("Erro no middleware de autorização de edição de usuário:", err);
        return res.status(500).json({ error: "Erro interno ao verificar permissões." });
    } finally {
        if (connection) connection.release();
    }
}

/**
 * NOVO MIDDLEWARE: Autoriza acesso a painéis de aprovação.
 * Permite acesso se o usuário tiver QUALQUER UMA das permissões de aprovação.
 */
async function authorizeApprovalAccess(req, res, next) {
    if (!req.user || !req.user.nivel_acesso_id) {
        return res.status(401).json({ error: 'Usuário não autenticado ou sem nível de acesso.' });
    }

    const { nivel_acesso_id } = req.user;
    let connection;
    try {
        connection = await db.promise().getConnection();
        const [permissions] = await connection.query(
            `SELECT p.chave FROM nivel_acesso_permissoes nap JOIN permissoes p ON nap.permissao_id = p.id WHERE nap.nivel_acesso_id = ?`,
            [nivel_acesso_id]
        );
        const userPermissions = permissions.map(p => p.chave);

        // Verifica se o usuário tem PELO MENOS UMA das permissões de aprovação
        const hasApprovalAccess = 
            userPermissions.includes('project.shopping.approve') ||  // Gestor
            userPermissions.includes('bom.approve.diretoria')   ||  // Diretoria
            userPermissions.includes('bom.approve.final')       ||  // Diretoria (para Aprovação Final)
            userPermissions.includes('acquisitions.view')       ||  // Aquisições (para ver cotações)
            userPermissions.includes('bom.approve.financeiro');     // <-- CORREÇÃO: ADICIONADA ESTA LINHA

        if (hasApprovalAccess) {
            next();
        } else {
            res.status(403).json({ error: 'Acesso negado. Você não tem permissão para visualizar este painel.' });
        }
    } catch (err) {
        console.error("Erro no middleware authorizeApprovalAccess:", err);
        return res.status(500).json({ error: "Erro interno ao verificar permissões de aprovação." });
    } finally {
        if (connection) connection.release();
    }
}

// ===============================================
// Rotas da API (Protegidas com autenticação e autorização)
// ===============================================

// Rota inicial - acessível publicamente
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

// Rotas de Autenticação (Públicas)
app.post("/api/login", async (req, res) => {
    console.log('API: /api/login - INÍCIO');
    const { username, password } = req.body;

    if (!username || !password) {
        console.log('API: /api/login - Erro de validação: username ou password não fornecidos.');
        return res.status(400).json({ error: 'Nome de usuário e senha são obrigatórios.' });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        console.log('API: /api/login - Conexão com o BD obtida.');

        const [users] = await connection.query('SELECT id, username, password_hash, nome, role, nivel_acesso_id FROM usuarios WHERE username = ?', [username]);
        console.log('API: /api/login - Consulta de usuário concluída.');

        if (users.length === 0) {
            console.log(`API: /api/login - Tentativa de login para '${username}': Usuário não encontrado.`);
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        const user = users[0];
        let isPasswordValid = false;

        try {
            isPasswordValid = await bcrypt.compare(password, user.password_hash);
            console.log(`API: /api/login - Comparação com bcrypt para '${username}': ${isPasswordValid}.`);
        } catch (e) {
            console.warn(`API: /api/login - Erro na comparação com bcrypt para '${username}', tentando fallback.`, e);
            isPasswordValid = false;
        }

        if (!isPasswordValid) {
            if (!user.password_hash.startsWith('$2a$')) {
                if (password === user.password_hash) {
                    isPasswordValid = true;
                    console.log(`API: /api/login - Comparação em texto simples bem-sucedida para '${username}'.`);
                    
                    const salt = await bcrypt.genSalt(10);
                    const newPasswordHash = await bcrypt.hash(password, salt);
                    await connection.query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [newPasswordHash, user.id]);
                    console.log(`API: /api/login - Senha do usuário '${username}' atualizada e criptografada com sucesso.`);
                }
            }
        }
        
        if (!isPasswordValid) {
            console.log(`API: /api/login - Tentativa de login para '${username}': Senha inválida após todas as tentativas.`);
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }
        
        const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, nome: user.nome, nivel_acesso_id: user.nivel_acesso_id },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRATION_TIME }
);

console.log(`API: /api/login - Usuário '${username}' logado com sucesso. Role: ${user.role}, Nivel Acesso ID: ${user.nivel_acesso_id}.`);
        res.json({ message: 'Login bem-sucedido!', token, role: user.role, nome: user.nome, id: user.id, nivel_acesso_id: user.nivel_acesso_id });

    } catch (err) {
        console.error('API: /api/login - Erro no login:', err);
        res.status(500).json({ error: 'Erro interno do servidor ao tentar fazer login.' });
    } finally {
        if (connection) {
            connection.release();
            console.log('API: /api/login - Conexão com o BD liberada.');
        }
    }
});

// Rota para registrar um novo usuário (apenas para a role 'Software')
app.post("/api/register", authenticateToken, authorizePermission('user.create'), async (req, res) => {
    console.log('API: /api/register - INÍCIO');
    // ATENÇÃO: Os dados do corpo da requisição são { username, password, nome, role }
    const { username, password, nome, role } = req.body;

    if (!username || !password || !nome || !role) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // 1. Validação Dinâmica: Verifica se o nível de acesso (role) existe
        const [nivelResult] = await connection.query('SELECT id FROM niveis_acesso WHERE nome = ?', [role]);
        if (nivelResult.length === 0) {
            await connection.rollback();
            return res.status(400).json({ error: `O nível de acesso '${role}' não é válido.` });
        }
        const nivel_acesso_id = nivelResult[0].id;

        // 2. Criptografia da Senha
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // 3. Insere na tabela de usuários
        const [result] = await connection.query(
            'INSERT INTO usuarios (username, password_hash, nome, role, nivel_acesso_id) VALUES (?, ?, ?, ?, ?)',
            [username, passwordHash, nome, role, nivel_acesso_id]
        );
        const newUserId = result.insertId;

        // 4. Log de Auditoria
        await registrarAcao(
            connection, 
            req.user.id, 
            req.user.nome, 
            'CRIACAO', 
            'Usuário', 
            newUserId, 
            `Novo usuário '${username}' (Nome: ${nome}) registrado com nível de acesso '${role}'.`
        );
        
        await connection.commit();
        res.status(201).json({ message: 'Usuário registrado com sucesso!', id: newUserId });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error('API: /api/register - Erro no registro:', err);
        if (err.code === 'ER_DUP_ENTRY') {
             return res.status(409).json({ error: "Nome de usuário já existe." });
        }
        res.status(500).json({ error: 'Erro interno do servidor ao registrar usuário.' });
    } finally {
        if (connection) connection.release();
    }
});



// ROTA RESTAURADA: Para a Tela 7, buscando TODOS os usuários
app.get("/api/users", authenticateToken, authorizePermission('user.view'), async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 4; // <-- ALTERADO DE 3 PARA 6
    const search = req.query.search || '';
    const offset = (page - 1) * limit;
    const searchTerm = `%${search}%`;

    let connection;
    try {
        connection = await db.promise().getConnection();

        const dataQuery = `
            SELECT MAX(id) as id, MAX(username) as username, nome, MAX(role) as role, MAX(created_at) as created_at
            FROM usuarios
            WHERE (nome LIKE ? OR username LIKE ?)
            GROUP BY nome
            ORDER BY nome
            LIMIT ? OFFSET ?
        `;
        const [users] = await connection.query(dataQuery, [searchTerm, searchTerm, limit, offset]);

        const countQuery = `SELECT COUNT(DISTINCT nome) as total FROM usuarios WHERE (nome LIKE ? OR username LIKE ?)`;
        const [countResult] = await connection.query(countQuery, [searchTerm, searchTerm]);
        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        res.json({
            users,
            pagination: {
                totalItems: total,
                totalPages,
                currentPage: page,
                limit: limit
            }
        });
    } catch (err) {
        console.error("Erro ao buscar usuários:", err);
        res.status(500).json({ error: "Erro ao buscar usuários." });
    } finally {
        if (connection) connection.release();
    }
});


// Rota para a Tela 8, buscando TODOS os usuários e indicando se têm atividades
app.get("/api/users-with-activities", authenticateToken, authorizePermission('management.view.assigned'), async (req, res) => {
    console.log('API: /api/users-with-activities (GET) para TELA 8 - INÍCIO');
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit);
    const search = req.query.search || '';
    const offset = (page - 1) * limit;
    const searchTerm = `%${search}%`;

    const requestingUser = req.user;

    let connection;
    try {
        connection = await db.promise().getConnection();

        const [permissions] = await connection.query(
            `SELECT p.chave FROM nivel_acesso_permissoes nap JOIN permissoes p ON nap.permissao_id = p.id WHERE nap.nivel_acesso_id = ?`,
            [requestingUser.nivel_acesso_id]
        );
        const userPermissions = permissions.map(p => p.chave);
        const canViewAll = userPermissions.includes('management.view.all_activities');

        // A consulta SQL foi corrigida para contar APENAS timers com status 'running'
        let dataQuery = `
            SELECT
                u.id, u.username, u.nome, u.role, u.created_at,
                (SELECT COUNT(*) FROM management_activities ma WHERE ma.employee_id = u.id AND ma.status <> 'Concluida') > 0 AS has_active_activities,
                (SELECT COUNT(*) FROM employee_activity_timers eat WHERE eat.employee_id = u.id AND eat.status = 'running') AS running_timers_count
            FROM
                usuarios u
            WHERE
                (u.nome LIKE ? OR u.username LIKE ?)
        `;

        const queryParams = [searchTerm, searchTerm];
        let countQuery = `SELECT COUNT(*) as total FROM usuarios u WHERE (u.nome LIKE ? OR u.username LIKE ?)`;
        const countParams = [searchTerm, searchTerm];

        if (!canViewAll) {
            console.log(`Usuário '${requestingUser.username}' não tem permissão para ver todos. Buscando apenas seu próprio ID.`);
            dataQuery += ` AND u.id = ?`;
            queryParams.push(requestingUser.id);

            countQuery += ` AND u.id = ?`;
            countParams.push(requestingUser.id);
        }

        dataQuery += ` GROUP BY u.id ORDER BY u.nome`;

        if (!isNaN(limit) && !isNaN(page) && limit > 0 && page > 0) {
            dataQuery += ` LIMIT ? OFFSET ?`;
            queryParams.push(limit, offset);
        }

        const [users] = await connection.query(dataQuery, queryParams);
        const [countResult] = await connection.query(countQuery, countParams);

        const total = countResult[0].total;
        const totalPages = !isNaN(limit) && limit > 0 ? Math.ceil(total / limit) : 1;

        // Corrigido para garantir que has_active_activities seja um booleano
        const finalUsers = users.map(user => ({
            ...user,
            has_active_activities: user.has_active_activities > 0
        }));

        res.json({
            users: finalUsers,
            pagination: {
                totalItems: total,
                totalPages,
                currentPage: !isNaN(page) ? page : 1,
                limit: !isNaN(limit) ? limit : total
            }
        });
    } catch (err) {
        console.error("Erro ao buscar usuários com status de atividades:", err);
        res.status(500).json({ error: "Erro ao buscar usuários com status de atividades." });
    } finally {
        if (connection) connection.release();
    }
});


// ========================================================
// server.js — PARTE 2/6  (linhas 728–1422 do arquivo processado)
// ATENÇÃO: Este arquivo foi gerado automaticamente a partir do server.js original.
//          Esta parte inclui comentários automáticos em rotas que não possuíam.
//          Mantenha a ordem das partes ao recombinar o código.
// ========================================================

// Rota para obter uma lista simples de todos os usuários (id e nome)
app.get("/api/users/list", authenticateToken, authorizePermission('management.assign.activity'), async (req, res) => {
    let connection;
    try {
        connection = await db.promise().getConnection();
        const [users] = await connection.query('SELECT id, nome FROM usuarios ORDER BY nome ASC');
        res.json(users);
    } catch (err) {
        console.error("Erro ao buscar a lista de usuários:", err);
        res.status(500).json({ error: "Erro ao buscar a lista de usuários." });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para buscar um único usuário por ID (agora com permissão para todos verem)
app.get("/api/users/:id", authenticateToken, authorizePermission('user.view'), async (req, res) => {
    console.log('API: /api/users/:id (GET) - INÍCIO');
    const { id } = req.params;
    console.log(`DEBUG SERVER: Requisição recebida para buscar o usuário com ID: ${id}`);
    let connection;
    try {
        connection = await db.promise().getConnection();
        const [users] = await connection.query('SELECT id, username, nome, role, created_at FROM usuarios WHERE id = ?', [id]);
        if (users.length === 0) {
            console.log('API: /api/users/:id (GET) - Usuário não encontrado.');
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        const user = users[0];
        console.log('DEBUG SERVER: Dados do usuário ENCONTRADOS no banco de dados:', user);
        res.json(user);
    } finally {
        if (connection) connection.release();
    }
});


// Rota para atualizar um usuário (com lógica condicional de permissões)
app.put("/api/users/:id", authenticateToken, authorizeUserEdit, async (req, res) => {
    console.log("API: /api/users/:id (PUT) - INÍCIO");
    const { id } = req.params;
    const { username, nome, role, password, project_ids } = req.body;
    const requestingUser = req.user;

    if (!username || !nome || !role || !Array.isArray(project_ids)) {
        return res.status(400).json({ error: "Username, nome, role e a lista de permissões de projeto são obrigatórios." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // Busca as permissões do usuário que está fazendo a requisição
        const [permissions] = await connection.query(
            `SELECT p.chave FROM nivel_acesso_permissoes nap JOIN permissoes p ON nap.permissao_id = p.id WHERE nap.nivel_acesso_id = ?`,
            [requestingUser.nivel_acesso_id]
        );
        const userPermissions = permissions.map(p => p.chave);

        // Busca os dados atuais do usuário que está sendo editado
        const [targetUser] = await connection.query('SELECT username, nome, role FROM usuarios WHERE id = ?', [id]);
        if (targetUser.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Usuário a ser editado não encontrado." });
        }
        const currentUserData = targetUser[0];

        // --- INÍCIO DA NOVA VERIFICAÇÃO DE SEGURANÇA ---
        // Se o NOME DE USUÁRIO ou NOME COMPLETO foi alterado E o usuário não tem a permissão para isso, bloqueia a requisição
        if ((currentUserData.username !== username || currentUserData.nome !== nome) && !userPermissions.includes('user.edit.credentials')) {
            await connection.rollback();
            return res.status(403).json({ error: "Acesso negado. Você não tem permissão para alterar o nome de usuário ou nome completo." });
        }
        // --- FIM DA NOVA VERIFICAÇÃO DE SEGURANÇA ---

        // Verificação de segurança para o NÍVEL DE ACESSO (já existente)
        if (currentUserData.role !== role && !userPermissions.includes('user.edit.role')) {
            await connection.rollback();
            return res.status(403).json({ error: "Acesso negado. Você não tem permissão para alterar o Nível de Acesso de usuários." });
        }
        
        const [roleData] = await connection.query('SELECT id FROM niveis_acesso WHERE nome = ?', [role]);
        if (roleData.length === 0) {
            await connection.rollback();
            return res.status(400).json({ error: `O nível de acesso '${role}' não é válido.` });
        }
        const newNivelAcessoId = roleData[0].id;

        // Atualiza os dados básicos do usuário
        let updateUserQuery = "UPDATE usuarios SET username = ?, nome = ?, role = ?, nivel_acesso_id = ?";
        const queryParams = [username, nome, role, newNivelAcessoId];

        if (password && password.trim() !== "") {
            updateUserQuery += ", password_hash = ?";
            queryParams.push(await bcrypt.hash(password, 10));
        }
        updateUserQuery += " WHERE id = ?";
        queryParams.push(id);
        await connection.query(updateUserQuery, queryParams);

        // Sincroniza as permissões de projeto
        await connection.query("DELETE FROM usuario_projeto_permissoes WHERE usuario_id = ?", [id]);
        if (project_ids.length > 0) {
            const permissionValues = project_ids.map(projectId => [id, projectId]);
            await connection.query(
                "INSERT INTO usuario_projeto_permissoes (usuario_id, projeto_id) VALUES ?",
                [permissionValues]
            );
        }

        await connection.commit();
        res.json({ message: "Usuário e permissões atualizados com sucesso!" });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error("API: /api/users/:id (PUT) - Erro:", err);
        if (err.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ error: "Nome de usuário já existe." });
        }
        res.status(500).json({ error: "Erro ao atualizar usuário." });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para deletar um usuário (apenas para a role 'Software')
app.delete("/api/users/:id", authenticateToken, authorizePermission('user.delete'), async (req, res) => {
    console.log('API: /api/users/:id (DELETE) - INÍCIO');
    const { id } = req.params;
    let connection;
    try {
        connection = await db.promise().getConnection();
        const [result] = await connection.query("DELETE FROM usuarios WHERE id = ?", [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        res.json({ message: 'Usuário excluído com sucesso!' });
        console.log('API: /api/users/:id (DELETE) - FIM (Sucesso)');
    } finally {
        if (connection) connection.release();
    }
});


// Rotas Protegidas - Aplicação dos Middlewares de Autenticação e Autorização
app.get("/api/indicadores", authenticateToken, authorizePermission('dashboard.view'), async (req, res) => {
    const { selectedDate } = req.query;
    let dateFilterDDMMYYYY;

    if (selectedDate) {
        dateFilterDDMMYYYY = formatYYYYMMDDtoDDMMYYYY(selectedDate);
    } else {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        dateFilterDDMMYYYY = `${day}/${month}/${year}`;
    }

    let queryProducao = `SELECT HOUR(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) as hora, SUM(CAST(qtd_dados AS UNSIGNED)) as total_pecas FROM dados_hora_a_hora`;
    let queryMeta = `SELECT meta FROM meta_dia`;
    let queryTotalPecas = `SELECT SUM(CAST(qtd_dados AS UNSIGNED)) as totalPecasProduzidas FROM dados_hora_a_hora`;
    let queryReprovados = `SELECT SUM(CAST(qtd AS UNSIGNED)) as totalReprovados FROM eficiencia WHERE flag = 'rejeitada'`;

    queryProducao += ` WHERE DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) = STR_TO_DATE(?, '%d/%m/%Y')`;
    queryTotalPecas += ` WHERE DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) = STR_TO_DATE(?, '%d/%m/%Y')`;
    queryReprovados += ` AND DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) = STR_TO_DATE(?, '%d/%m/%Y')`;
    queryMeta += ` WHERE STR_TO_DATE(data_hora, '%d/%m/%Y') = STR_TO_DATE(?, '%d/%m/%Y')`;

    queryProducao += ` GROUP BY HOUR(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) ORDER BY hora ASC`;

    console.log('CHAMADA DA API: /api/indicadores - INÍCIO');
    let connection;
    try {
        connection = await db.promise().getConnection();
        console.log('CHAMADA DA API: /api/indicadores - Conexão com o banco de dados obtida');
        const [producaoPorHora] = await connection.query(queryProducao, [dateFilterDDMMYYYY]);
        const [metaDiaria] = await connection.query(queryMeta, [dateFilterDDMMYYYY]);
        const [totalPecasResult] = await connection.query(queryTotalPecas, [dateFilterDDMMYYYY]);
        const [reprovadosResult] = await connection.query(queryReprovados, [dateFilterDDMMYYYY]);
        console.log('CHAMADA DA API: /api/indicadores - Todas as consultas ao BD concluídas');

        const totalCaixasProduzidas = Number(totalPecasResult[0]?.totalPecasProduzidas) || 0;
        const totalReprovados = Number(reprovadosResult[0]?.totalReprovados) || 0;

        const totalPecasProduzidasInUnits = totalCaixasProduzidas * pecasPorCaixa;
        const totalAprovados = totalPecasProduzidasInUnits - totalReprovados;

        res.json({
            producaoPorHora,
            metaDiaria: metaDiaria.length > 0 ? metaDiaria : [{ meta: 0 }],
            totalPecasProduzidas: totalCaixasProduzidas,
            totalAprovados,
            totalReprovados
        });
        console.log('CHAMADA DA API: /api/indicadores - FIM (Sucesso)');
    } catch (err) {
        console.error("Erro ao buscar indicadores:", err);
        res.status(500).json({ error: "Erro ao buscar indicadores." });
        console.log('CHAMADA DA API: /api/indicadores - FIM (Erro)');
    } finally {
        if (connection) {
            connection.release();
            console.log('CHAMADA DA API: /api/indicadores - Conexão com o BD liberada');
        }
    }
});

// ROTA: PUT /api/meta_dia — comentário automático gerado para documentação
app.put("/api/meta_dia", authenticateToken, authorizePermission('dashboard.update.meta'), async (req, res) => {
    console.log('CHAMADA DA API: /api/meta_dia - INÍCIO');
    const { date, meta } = req.body;
    const dateDDMMYYYY = formatYYYYMMDDtoDDMMYYYY(date);

    if (!dateDDMMYYYY || meta === undefined || meta < 0) {
        console.log('CHAMADA DA API: /api/meta_dia - Erro de validação');
        return res.status(400).json({ error: "Data e meta válidas são obrigatórias." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        console.log('CHAMADA DA API: /api/meta_dia - Conexão com o banco de dados obtida');
        const [results] = await connection.query(`SELECT id FROM meta_dia WHERE data_hora = ?`, [dateDDMMYYYY]);

        if (results.length > 0) {
            await connection.query(`UPDATE meta_dia SET meta = ? WHERE id = ?`, [meta, results[0].id]);
            res.json({ message: "Meta diária atualizada com sucesso." });
        } else {
            await connection.query(`INSERT INTO meta_dia (data_hora, meta) VALUES (?, ?)`, [dateDDMMYYYY, meta]);
            res.status(201).json({ message: "Meta diária registrada com sucesso." });
        }
        console.log('CHAMADA DELLA API: /api/meta_dia - FIM (Sucesso)');
    } catch (err) {
        console.error("Erro ao gerenciar meta diária:", err);
        res.status(500).json({ error: "Erro ao gerenciar meta diária no banco de dados." });
        console.log('CHAMADA DELLA API: /api/meta_dia - FIM (Erro)');
    } finally {
        if (connection) {
            connection.release();
            console.log('CHAMADA DA API: /api/meta_dia - Conexão com o BD liberada');
        }
    }
});

// ROTA: POST /api/producao — comentário automático gerado para documentação
app.post("/api/producao", authenticateToken, authorizePermission('dashboard.register.production'), async (req, res) => {
    console.log('CHAMADA DA API: /api/producao - INÍCIO');
    const { qtdDados, dataHora } = req.body;
    if (qtdDados === undefined || qtdDados < 0 || !dataHora) {
        console.log('CHAMADA DA API: /api/producao - Erro de validação');
        return res.status(400).json({ error: "Quantidade de dados e data/hora são obrigatórios." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        console.log('CHAMADA DA API: /api/producao - Conexão com o banco de dados obtida');
        await connection.query("INSERT INTO dados_hora_a_hora (qtd_dados, data_hora) VALUES (?, ?)", [qtdDados, dataHora]);
        res.status(201).json({ message: "Produção registrada com sucesso" });
        console.log('CHAMADA DA API: /api/producao - FIM (Sucesso)');
    } catch (err) {
        console.error("Erro ao inserir dados de produção:", err);
        res.status(500).json({ error: "Erro ao registrar produção no banco de dados." });
        console.log('CHAMADA DA API: /api/producao - FIM (Erro)');
    } finally {
        if (connection) {
            connection.release();
            console.log('CHAMADA DA API: /api/producao - Conexão com o BD liberada');
        }
    }
});

// ROTA: POST /api/eficiencia — comentário automático gerado para documentação
app.post("/api/eficiencia", authenticateToken, authorizePermission('dashboard.register.production'), async (req, res) => {
    console.log('CHAMADA DA API: /api/eficiencia - INÍCIO');
    const { qtd, flag, dataHora } = req.body;

    if (qtd === undefined || qtd < 0 || !flag || flag !== "rejeitada" || !dataHora) {
        console.log('CHAMADA DA API: /api/eficiencia - Erro de validação');
        return res.status(400).json({ error: "Quantidade, flag (rejeitada) e data/hora válidas são obrigatórias para registrar eficiência." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        console.log('CHAMADA DA API: /api/eficiencia - Conexão com o banco de dados obtida');
        await connection.query("INSERT INTO eficiencia (qtd, flag, data_hora) VALUES (?, ?, ?)", [qtd, flag, dataHora]);
        res.status(201).json({ message: "Registro de eficiência (peças reprovadas) realizado com sucesso" });
        console.log('CHAMADA DA API: /api/eficiencia - FIM (Sucesso)');
    } catch (err) {
        console.error("Erro ao inserir dados de eficiência (reprovados):", err);
        res.status(500).json({ error: "Erro ao registrar peças reprovadas no banco de dados." });
        console.log('CHAMADA DA API: /api/eficiencia - FIM (Erro)');
    } finally {
        if (connection) {
            connection.release();
            console.log('CHAMADA DA API: /api/eficiencia - Conexão com o BD liberada');
        }
    }
});

// ROTA: GET /api/relatorio — comentário automático gerado para documentação
app.get("/api/relatorio", authenticateToken, authorizePermission('dashboard.generate.report'), async (req, res) => {
    console.log('CHAMADA DA API: /api/relatorio - INÍCIO');
    const { startDate, endDate } = req.query;
    const startDateDDMMYYYY = formatYYYYMMDDtoDDMMYYYY(startDate);
    const endDateDDMMYYYY = formatYYYYMMDDtoDDMMYYYY(endDate);

    if (!startDateDDMMYYYY || !endDateDDMMYYYY) {
        console.log('CHAMADA DA API: /api/relatorio - Erro de validação');
        return res.status(400).json({ error: "As datas de início e fim são obrigatórias para gerar o relatório." });
    }

    const sql = `
        WITH RECURSIVE DateSeries AS (
            SELECT STR_TO_DATE(?, '%d/%m/%Y') AS report_date
            UNION ALL
            SELECT DATE_ADD(report_date, INTERVAL 1 DAY)
            FROM DateSeries
            WHERE DATE_ADD(report_date, INTERVAL 1 DAY) <= STR_TO_DATE(?, '%d/%m/%Y')
        ),
        ProducedData AS (
            SELECT
                DATE_FORMAT(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s'), '%Y-%m-%d') AS produced_date,
                SUM(CAST(qtd_dados AS UNSIGNED)) AS daily_produzido_total_boxes_raw
            FROM
                dados_hora_a_hora
            WHERE
                DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) BETWEEN STR_TO_DATE(?, '%d/%m/%Y') AND STR_TO_DATE(?, '%d/%m/%Y')
            GROUP BY
                produced_date
        ),
        RejectedData AS (
            SELECT
                DATE_FORMAT(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s'), '%Y-%m-%d') AS rejected_date,
                SUM(CAST(qtd AS UNSIGNED)) AS daily_reprovado_total_pieces_raw
            FROM
                eficiencia
            WHERE
                flag = 'rejeitada' AND DATE(STR_TO_DATE(data_hora, '%d/%m/%Y %H:%i:%s')) BETWEEN STR_TO_DATE(?, '%d/%m/%Y') AND STR_TO_DATE(?, '%d/%m/%Y')
            GROUP BY
                rejected_date
        )
        SELECT
            DATE_FORMAT(DS.report_date, '%Y-%m-%d') AS report_date,
            COALESCE(MAX(PD.daily_produzido_total_boxes_raw), 0) AS total_produzido_dia,
            COALESCE(MAX(RD.daily_reprovado_total_pieces_raw), 0) AS total_reprovado_dia,
            COALESCE(MAX(MD.meta), 0) AS meta_dia_total
        FROM
            DateSeries DS
        LEFT JOIN
            ProducedData PD ON DS.report_date = STR_TO_DATE(PD.produced_date, '%Y-%m-%d')
        LEFT JOIN
            RejectedData RD ON DS.report_date = STR_TO_DATE(RD.rejected_date, '%Y-%m-%d')
        LEFT JOIN
            meta_dia MD ON DS.report_date = STR_TO_DATE(MD.data_hora, '%d/%m/%Y')
        GROUP BY
            DS.report_date
        ORDER BY
            DS.report_date ASC;
    `;

    let connection;
    try {
        connection = await db.promise().getConnection();
        console.log('CHAMADA DA API: /api/relatorio - Conexão com o banco de dados obtida');
        const [results] = await connection.query(sql, [
            startDateDDMMYYYY, endDateDDMMYYYY,
            startDateDDMMYYYY, endDateDDMMYYYY,
            startDateDDMMYYYY, endDateDDMMYYYY
        ]);
        res.json(results);
        console.log('CHAMADA DA API: /api/relatorio - FIM (Sucesso)');
    } catch (err) {
        console.error("Erro ao gerar relatório:", err);
        res.status(500).json({ error: "Erro ao buscar indicadores." });
        console.log('CHAMADA DA API: /api/relatorio - FIM (Erro)');
    } finally {
        if (connection) {
            connection.release();
            console.log('CHAMADA DA API: /api/relatorio - Conexão com o BD liberada');
        }
    }
});

// Rota para buscar projetos (agora com busca, filtro de encerrados e entregável da semana)
app.get("/api/projetos", authenticateToken, authorizePermission('project.view.status'), async (req, res) => {
    console.log('CHAMADA DA API: /api/projetos - INÍCIO');
    let connection;
    try {
        connection = await db.promise().getConnection();
        const { status, searchTerm } = req.query;
        const requestingUser = req.user;

        const [permissions] = await connection.query(
            `SELECT p.chave FROM nivel_acesso_permissoes nap JOIN permissoes p ON nap.permissao_id = p.id WHERE nap.nivel_acesso_id = ?`,
            [requestingUser.nivel_acesso_id]
        );
        const userPermissions = permissions.map(p => p.chave);
        const canViewAllProjects = userPermissions.includes('project.view.all') || ['Software', 'Diretoria'].includes(requestingUser.role);

        let sql;
        const params = [];
        

        const selectFields = `
            p.id, p.nome, p.lider, p.coordenador, p.equipe_json,
            p.data_inicio, p.data_fim, p.percentual_concluido, p.encerrado,
            p.data_ultima_atualizacao, u.nome AS ultimo_atualizador_nome,
            wd.content AS deliverable_content 
        `;
        
        const deliverableJoin = `
            LEFT JOIN weekly_deliverables wd ON p.id = wd.project_id 
                AND wd.week_start_date = (DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY))
        `;

        if (canViewAllProjects) {
            console.log(`Usuário '${requestingUser.username}' tem permissão para ver todos os projetos.`);
            sql = `
                SELECT ${selectFields}
                FROM projetos p
                LEFT JOIN usuarios u ON p.ultima_atualizacao_por_usuario_id = u.id
                ${deliverableJoin}
                WHERE 1=1
            `;
        } else {
            console.log(`Usuário '${requestingUser.username}' tem permissão restrita. Buscando apenas projetos permitidos.`);
            sql = `
                SELECT ${selectFields}
                FROM projetos p
                INNER JOIN usuario_projeto_permissoes upp ON p.id = upp.projeto_id
                LEFT JOIN usuarios u ON p.ultima_atualizacao_por_usuario_id = u.id
                ${deliverableJoin}
                WHERE upp.usuario_id = ?
            `;
            params.push(requestingUser.id);
        }

        if (searchTerm && searchTerm.trim() !== '') {
            sql += ` AND p.nome LIKE ?`;
            params.push(`%${searchTerm.trim()}%`);
        }

        if (status === 'encerrado') {
            sql += ` AND p.encerrado = 1`;
        } else {
            sql += ` AND p.encerrado = 0`;
        }
        
        sql += ` ORDER BY p.nome ASC`;

        const [projetos] = await connection.query(sql, params);

        if (projetos.length === 0) {
            return res.json([]);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const projetosComDados = await Promise.all(projetos.map(async (projeto) => {
            const [customEtapas] = await connection.query("SELECT id, ordem, nome_etapa, DATE_FORMAT(data_inicio, '%d/%m/%Y %H:%i:%s') as data_inicio, DATE_FORMAT(data_fim, '%d/%m/%Y %H:%i:%s') as data_fim FROM projeto_etapas WHERE projeto_id = ? ORDER BY ordem", [projeto.id]);
            const [subEtapas] = await connection.query("SELECT projeto_etapa_id, concluida, data_prevista_conclusao FROM sub_etapas WHERE projeto_id = ?", [projeto.id]);

            let percentuaisPorEtapa = {};
            let statusPorEtapa = {};

            for (const etapa of customEtapas) {
                const subEtapasDaEtapa = subEtapas.filter(se => se.projeto_etapa_id === etapa.id);
                const totalSubEtapas = subEtapasDaEtapa.length;
                let percentage = 0;
                let stageStatus = "pendente";

                if (totalSubEtapas > 0) {
                    const concluidas = subEtapasDaEtapa.filter(se => se.concluida).length;
                    percentage = (concluidas / totalSubEtapas) * 100;
                    const hasDelayed = subEtapasDaEtapa.some(st => !st.concluida && st.data_prevista_conclusao && new Date(st.data_prevista_conclusao) < today);
                    if (percentage === 100) {
                        stageStatus = "concluído";
                    } else if (hasDelayed) {
                        stageStatus = "atrasado";
                    } else if (concluidas > 0 || percentage > 0) {
                        stageStatus = "andamento";
                    }
                }
                percentuaisPorEtapa[etapa.id] = parseFloat(percentage.toFixed(2));
                statusPorEtapa[etapa.id] = stageStatus;
            }
            
            return {
                ...projeto,
                data_inicio: formatDateFromMySQL(projeto.data_inicio),
                data_fim: formatDateFromMySQL(projeto.data_fim),
                data_ultima_atualizacao: formatDateFromMySQL(projeto.data_ultima_atualizacao),
                customEtapas,
                percentuaisPorEtapa,
                statusPorEtapa
            };
        }));

        res.json(projetosComDados);

    } catch (err) {
        console.error("Erro ao buscar projetos com dados:", err);
        res.status(500).json({ error: "Erro ao buscar projetos no banco de dados." });
    } finally {
        if (connection) connection.release();
    }
});

// --- INÍCIO DA MODIFICAÇÃO: Nova rota para salvar o entregável da semana ---
app.post("/api/projetos/:projectId/deliverable", authenticateToken, authorizePermission('project.edit'), async (req, res) => {
    const { projectId } = req.params;
    const { content, weekDate } = req.body; // weekDate vem do front, ex: "2025-10-20"
    const { id: userId } = req.user;

    if (content === undefined) {
        return res.status(400).json({ error: "O conteúdo do entregável é obrigatório." });
    }

    if (!weekDate || !/^\d{4}-\d{2}-\d{2}$/.test(weekDate)) {
         return res.status(400).json({ error: "Data da semana inválida ou não fornecida." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();   
        const upsertQuery = `
            INSERT INTO weekly_deliverables (project_id, week_start_date, content)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE content = VALUES(content), updated_at = NOW()
        `;
        
        await connection.query(upsertQuery, [projectId, weekDate, content]);
        
        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userId, projectId]
        );

        await connection.commit();
        res.status(200).json({ message: "Entregável salvo com sucesso!" });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao salvar entregável da semana:", err);
        res.status(500).json({ error: "Erro ao salvar entregável da semana." });
    } finally {
        if (connection) connection.release();
    }
});
// --- FIM DA MODIFICAÇÃO ---

// --- INÍCIO DA ADIÇÃO: Nova rota para buscar um entregável de uma semana específica ---
app.get("/api/projetos/:projectId/deliverables", authenticateToken, authorizePermission('project.view.status'), async (req, res) => {
    const { projectId } = req.params;
    const { weekDate } = req.query; // Espera uma data no formato YYYY-MM-DD

    if (!weekDate) {
        return res.status(400).json({ error: "A data da semana (weekDate) é obrigatória." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        const query = `
            SELECT content 
            FROM weekly_deliverables 
            WHERE project_id = ? AND week_start_date = ?
        `;
        const [rows] = await connection.query(query, [projectId, weekDate]);

        if (rows.length > 0) {
            res.json({ content: rows[0].content });
        } else {
            res.json({ content: null }); // Retorna nulo se não houver entregável para a semana
        }
    } catch (err) {
        console.error("Erro ao buscar entregável da semana:", err);
        res.status(500).json({ error: "Erro ao buscar entregável da semana." });
    } finally {
        if (connection) connection.release();
    }
});
// --- FIM DA ADIÇÃO ---

// Detalhes do Projeto (GET por ID) - Autenticada
app.get("/api/projetos/:id", authenticateToken, authorizePermission('project.view.status'), async (req, res) => {
    console.log('CHAMADA DA API: /api/projetos/:id - INÍCIO');
    const { id } = req.params;
    let connection;
    try {
        connection = await db.promise().getConnection();
        console.log('CHAMADA DA API: /api/projetos/:id - Conexão com o banco de dados obtida');
        const [projetoResults] = await connection.query(
            `SELECT p.id, p.nome, p.lider, p.coordenador, p.equipe_json, p.data_inicio, p.data_fim, p.percentual_concluido, p.encerrado, p.data_ultima_atualizacao, u.nome AS ultimo_atualizador_nome,
                CASE
                    WHEN p.data_ultima_atualizacao IS NULL THEN 'N/A'
                    WHEN (SELECT data_cadastro FROM projeto_pecas WHERE projeto_id = p.id ORDER BY data_cadastro DESC LIMIT 1) = p.data_ultima_atualizacao
                        THEN CONCAT('Peça: ', (SELECT nome FROM projeto_pecas WHERE projeto_id = p.id ORDER BY data_cadastro DESC LIMIT 1))
                    WHEN (SELECT data_criacao FROM sub_etapas WHERE projeto_id = p.id ORDER BY data_criacao DESC LIMIT 1) = p.data_ultima_atualizacao
                        THEN CONCAT('Sub-etapa: ', (SELECT descricao FROM sub_etapas WHERE projeto_id = p.id ORDER BY data_criacao DESC LIMIT 1))
                    WHEN (SELECT data_inicio FROM projeto_etapas WHERE projeto_id = p.id ORDER BY data_inicio DESC LIMIT 1) = p.data_ultima_atualizacao
                        THEN CONCAT('Etapa: ', (SELECT nome_etapa FROM projeto_etapas WHERE projeto_id = p.id ORDER BY data_inicio DESC LIMIT 1))
                    WHEN (SELECT data_upload FROM projeto_shopping_files WHERE projeto_id = p.id ORDER BY data_upload DESC LIMIT 1) = p.data_ultima_atualizacao
                        THEN CONCAT('Arquivo de Compras: ', (SELECT nome_arquivo FROM projeto_shopping_files WHERE projeto_id = p.id ORDER BY data_upload DESC LIMIT 1))
                    ELSE 'Informações do projeto'
                END AS ultima_atualizacao_tipo
             FROM projetos p
             LEFT JOIN usuarios u ON p.ultima_atualizacao_por_usuario_id = u.id
             WHERE p.id = ?`,
            [id]
        );
        console.log('CHAMADA DA API: /api/projetos/:id - Projeto bruto buscado');

        if (projetoResults.length === 0) {
            console.log('CHAMADA DA API: /api/projetos/:id - Projeto não encontrado');
            return res.status(404).json({ error: "Projeto não encontrado." });
        }

        const projeto = projetoResults[0];

        const [customEtapas] = await connection.query(
            "SELECT id, ordem, nome_etapa, DATE_FORMAT(data_inicio, '%d/%m/%Y %H:%i:%s') as data_inicio, DATE_FORMAT(data_fim, '%d/%m/%Y %H:%i:%s') as data_fim, duracao_planejada_dias FROM projeto_etapas WHERE projeto_id = ? ORDER BY ordem",
            [projeto.id]
        );

        // MODIFICADO: Inclui o nome do setor na consulta de sub-etapas.
        const [subEtapas] = await connection.query(
            `SELECT
                se.projeto_etapa_id,
                se.id as sub_etapa_id,
                se.descricao,
                se.concluida,
                DATE_FORMAT(se.data_prevista_conclusao, '%d/%m/%Y') as data_prevista_conclusao,
                DATE_FORMAT(se.data_conclusao, '%d/%m/%Y %H:%i:%s') as data_conclusao,
                u.nome AS nome_criador,
                s.nome as setor_nome
            FROM sub_etapas se
            LEFT JOIN usuarios u ON se.criado_por_usuario_id = u.id
            LEFT JOIN setores s ON se.setor_id = s.id
            WHERE se.projeto_id = ?
            ORDER BY se.id`,
            [projeto.id]
        );

        // NOVO: Calcula a porcentagem de conclusão para cada setor
        const setoresPorEtapa = {};
        for (const etapa of customEtapas) {
            const subEtapasDaEtapa = subEtapas.filter(se => se.projeto_etapa_id === etapa.id);
            const setoresNaEtapa = [...new Set(subEtapasDaEtapa.map(se => se.setor_nome))];
            
            setoresPorEtapa[etapa.id] = setoresNaEtapa.map(nomeSetor => {
                const subEtapasDoSetor = subEtapasDaEtapa.filter(se => se.setor_nome === nomeSetor);
                const totalSubEtapasDoSetor = subEtapasDoSetor.length;
                const concluidasDoSetor = subEtapasDoSetor.filter(se => se.concluida).length;
                const porcentagem = totalSubEtapasDoSetor > 0 ? (concluidasDoSetor / totalSubEtapasDoSetor) * 100 : 0;

                return {
                    nome: nomeSetor,
                    porcentagem_concluida: parseFloat(porcentagem.toFixed(2))
                };
            });
        }
        
        let finalPercentuaisPorEtapa = {};
        let finalAtrasosPorEtapa = {};
        let finalStatusPorEtapa = {};

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (customEtapas.length === 0) {
                 projeto.percentual_concluido = 0.00;
                 projeto.status = "pendente";
                 console.log('CHAMADA DA API: /api/projetos/:id - Nenhuma etapa encontrada, retornando informações padrão do projeto');
                 return res.json({
                     ...projeto,
                     data_inicio: formatDateFromMySQL(projeto.data_inicio),
                     data_fim: formatDateFromMySQL(projeto.data_fim),
                     customEtapas: [],
                     setoresPorEtapa: {}, // Adiciona o objeto de setores vazio
                     percentuaisPorEtapa: finalPercentuaisPorEtapa,
                     atrasosPorEtapa: finalAtrasosPorEtapa,
                     statusPorEtapa: finalStatusPorEtapa,
                     data_ultima_atualizacao: formatDateFromMySQL(projeto.data_ultima_atualizacao),
                 });
            }

            for (const etapa of customEtapas) {
                const subEtapasDaEtapa = subEtapas.filter(se => se.projeto_etapa_id === etapa.id);
                const totalSubEtapas = subEtapasDaEtapa.length;
                let percentage = 0;
                let isDelayedForThisStage = false;
                let stageStatus = "pendente";

                if (totalSubEtapas === 0) {
                    percentage = 0;
                    stageStatus = "pendente";

                    const dataFimEtapa = etapa.data_fim ? parseDDMMYYYYtoDate(etapa.data_fim) : null;
                    if (dataFimEtapa && !isNaN(dataFimEtapa.getTime()) && today > dataFimEtapa) {
                        stageStatus = "atrasado";
                    }
                } else {
                    const concluidas = subEtapasDaEtapa.filter(se => se.concluida).length;
                    percentage = (concluidas / totalSubEtapas) * 100;

                    const hasDelayedSubTask = subEtapasDaEtapa.some(subTask => {
                        const subTaskDueDate = subTask.data_prevista_conclusao ? parseDDMMYYYYtoDate(subTask.data_prevista_conclusao) : null;
                        return subTaskDueDate && !isNaN(subTaskDueDate.getTime()) && !subTask.concluida && today > subTaskDueDate;
                    });
                    isDelayedForThisStage = hasDelayedSubTask;

                    const hasInProgressSubTask = subEtapasDaEtapa.some(subTask => {
                        if (!subTask.concluida) {
                            const subTaskDueDate = subTask.data_prevista_conclusao ? parseDDMMYYYYtoDate(subTask.data_prevista_conclusao) : null;
                            if (subTaskDueDate && !isNaN(subTaskDueDate.getTime())) {
                                return today <= subTaskDueDate;
                            }
                            return true;
                        }
                        return false;
                    });

                    if (percentage === 100) {
                        stageStatus = "concluido";
                    } else if (isDelayedForThisStage) {
                        stageStatus = "atrasado";
                    } else if (percentage > 0 || hasInProgressSubTask) {
                        stageStatus = "andamento";
                    } else {
                        stageStatus = "pendente";
                    }
                }

                finalPercentuaisPorEtapa[etapa.id] = parseFloat(percentage.toFixed(2));
                finalAtrasosPorEtapa[etapa.id] = isDelayedForThisStage;
                finalStatusPorEtapa[etapa.id] = stageStatus;
            }

            let sumOfStagePercentages = 0;
            let totalStagesConsidered = 0;
            for (const etapa of customEtapas) {
                sumOfStagePercentages += (finalPercentuaisPorEtapa[etapa.id] || 0);
                totalStagesConsidered++;
            }
            let overallPercentConcluido = totalStagesConsidered > 0 ? sumOfStagePercentages / totalStagesConsidered : 0;
            projeto.percentual_concluido = parseFloat(overallPercentConcluido.toFixed(2));

            let projetoStatus = "pendente";
            const allStagesCompleted = customEtapas.length > 0 &&
                                   finalPercentuaisPorEtapa && typeof finalPercentuaisPorEtapa === 'object' &&
                                   Object.values(finalPercentuaisPorEtapa).every(p => p === 100);

            if (allStagesCompleted) {
                projetoStatus = "concluido";
            } else {
                const anyStageDelayed = finalAtrasosPorEtapa && typeof finalAtrasosPorEtapa === 'object' &&
                                        Object.values(finalAtrasosPorEtapa).some(d => d === true);
            if (anyStageDelayed) {
                projetoStatus = "atrasado";
            } else {
                const anyStageInProgress = finalStatusPorEtapa && typeof finalStatusPorEtapa === 'object' &&
                                                Object.values(finalStatusPorEtapa).some(s => s === 'andamento');
                const projetoDataInicio = projeto.data_inicio ? parseDDMMYYYYtoDate(projeto.data_inicio) : null;
                const projetoDataFim = projeto.data_fim ? parseDDMMYYYYtoDate(projeto.data_fim) : null;

                const isWithinProjectDates = projetoDataInicio && projetoDataFim &&
                                                  !isNaN(projetoDataInicio.getTime()) && !isNaN(projetoDataFim.getTime()) &&
                                                  today >= projetoDataInicio &&
                                                  today <= projetoDataFim;

                if (anyStageInProgress || overallPercentConcluido > 0 || isWithinProjectDates) {
                    projetoStatus = "andamento";
                }
            }
        }
        projeto.status = projetoStatus;

        res.json({
            ...projeto,
            data_inicio: formatDateFromMySQL(projeto.data_inicio),
            data_fim: formatDateFromMySQL(projeto.data_fim),
            customEtapas,
            subEtapas, // Inclui as sub-etapas para serem usadas no cálculo
            setoresPorEtapa, // NOVO: Adiciona o objeto de setores processado
            percentuaisPorEtapa: finalPercentuaisPorEtapa,
            atrasosPorEtapa: finalAtrasosPorEtapa,
            statusPorEtapa: finalStatusPorEtapa,
            data_ultima_atualizacao: formatDateFromMySQL(projeto.data_ultima_atualizacao)
        });
        console.log('CHAMADA DA API: /api/projetos/:id - FIM (Sucesso)');
    } catch (err) {
        console.error("Erro ao buscar projeto:", err);
        res.status(500).json({ error: "Erro ao buscar projeto no banco de dados." });
        console.log('CHAMADA DA API: /api/projetos/:id - FIM (Erro)');
    } finally {
        if (connection) connection.release();
    }
});

// Criar um novo projeto (POST)
app.post("/api/projetos", authenticateToken, authorizePermission('project.create'), async (req, res) => {
    const { nome, lider, equipe, data_inicio, data_fim, etapas, coordenador } = req.body;
    const { id: userId, nome: userName } = req.user; // LOG DE AUDITORIA

    if (!nome || !lider) {
        return res.status(400).json({ error: "Nome e líder do projeto são obrigatórios." });
    }
    if (!etapas || !Array.isArray(etapas) || etapas.length === 0) {
        return res.status(400).json({ error: "O projeto deve ter pelo menos uma etapa." });
    }

    const equipeArray = equipe.split(',').map(name => name.trim()).filter(name => name);
    const equipe_json = JSON.stringify(equipeArray);

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        const [projectResult] = await connection.query(
            "INSERT INTO projetos (nome, lider, equipe_json, data_inicio, data_fim, ultima_atualizacao_por_usuario_id, data_ultima_atualizacao, coordenador) VALUES (?, ?, ?, STR_TO_DATE(?, '%d/%m/%Y'), STR_TO_DATE(?, '%d/%m/%Y'), ?, NOW(), ?)",
            [nome, lider, equipe_json, data_inicio, data_fim, userId, coordenador]
        );
        const newProjectId = projectResult.insertId;
        // Adiciona permissão automática para o criador do projeto
            await connection.query(
                "INSERT INTO usuario_projeto_permissoes (usuario_id, projeto_id) VALUES (?, ?)",
                [userId, newProjectId]
            );
            console.log(`Permissão automática concedida para o usuário ID ${userId} no novo projeto ID ${newProjectId}.`);

        for (const etapa of etapas) {
            const formattedDataInicio = etapa.data_inicio || null;
            const formattedDataFim = etapa.data_fim || null;

            await connection.query(
                "INSERT INTO projeto_etapas (projeto_id, nome_etapa, ordem, data_inicio, data_fim) VALUES (?, ?, ?, STR_TO_DATE(?, '%d/%m/%Y %H:%i:%s'), STR_TO_DATE(?, '%d/%m/%Y %H:%i:%s'))",
                [newProjectId, etapa.nome_etapa, etapa.ordem, formattedDataInicio, formattedDataFim]
            );
        }

        // LOG DE AUDITORIA: Registra a criação do projeto
        await registrarAcao(
            connection,
            userId,
            userName,
            'CRIACAO',
            'Projeto',
            newProjectId,
            `Projeto '${nome}' (ID: ${newProjectId}) foi criado.`
        );
        // FIM LOG DE AUDITORIA

        await connection.commit();
        res.status(201).json({ message: "Projeto e etapas registrados com sucesso!", id: newProjectId });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao registrar novo projeto:", err);
        res.status(500).json({ error: "Erro ao registrar novo projeto." });
    } finally {
        if (connection) connection.release();
    }
});

// ========================================================
// server.js — PARTE 3/6  (linhas 1423–2203 do arquivo processado)
// ATENÇÃO: Este arquivo foi gerado automaticamente a partir do server.js original.
//          Esta parte inclui comentários automáticos em rotas que não possuíam.
//          Mantenha a ordem das partes ao recombinar o código.
// ========================================================

// Atualizar um projeto existente (PUT)
app.put("/api/projetos/:id", authenticateToken, authorizePermission('project.edit'), async (req, res) => {
    console.log('CHAMADA DA API: /api/projetos/:id (PUT) - INÍCIO');
    const { id: projectId } = req.params;
    const { nome, lider, equipe, data_inicio, data_fim, etapas, coordenador } = req.body;
    const { id: userId, nome: userName } = req.user; // LOG DE AUDITORIA: Captura nome do usuário

    if (!nome || !lider) {
        return res.status(400).json({ error: "Nome e líder do projeto são obrigatórios." });
    }
    if (!Array.isArray(etapas)) {
        return res.status(400).json({ error: "O campo 'etapas' deve ser um array." });
    }

    const equipeArray = equipe.split(',').map(name => name.trim()).filter(name => name);
    const equipe_json = JSON.stringify(equipeArray);

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // LOG DE AUDITORIA: Busca o estado anterior do projeto para comparar e logar as mudanças
        const [projetosAntes] = await connection.query("SELECT * FROM projetos WHERE id = ?", [projectId]);
        if (projetosAntes.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Projeto não encontrado." });
        }
        const projetoAntes = projetosAntes[0];
        // FIM DO LOG DE AUDITORIA

        // 1. Atualiza as informações básicas do projeto
        await connection.query(
            "UPDATE projetos SET nome = ?, lider = ?, equipe_json = ?, data_inicio = STR_TO_DATE(?, '%d/%m/%Y'), data_fim = STR_TO_DATE(?, '%d/%m/%Y'), ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW(), coordenador = ? WHERE id = ?",
            [nome, lider, equipe_json, data_inicio, data_fim, userId, coordenador, projectId]
        );
        
        // LOG DE AUDITORIA: Compara e registra as mudanças nos campos do projeto
        const mudancasProjeto = [];
        if (projetoAntes.nome !== nome) mudancasProjeto.push(`nome de '${projetoAntes.nome}' para '${nome}'`);
        if (projetoAntes.lider !== lider) mudancasProjeto.push(`líder de '${projetoAntes.lider}' para '${lider}'`);
        if (projetoAntes.coordenador !== coordenador) mudancasProjeto.push(`coordenador de '${projetoAntes.coordenador}' para '${coordenador}'`);
        if (mudancasProjeto.length > 0) {
            await registrarAcao(
                connection, userId, userName, 'EDICAO', 'Projeto', projectId,
                `Detalhes do projeto '${nome}' foram atualizados: ${mudancasProjeto.join(', ')}.`
            );
        }
        // FIM DO LOG DE AUDITORIA

        // 2. Busca as etapas existentes
        const [etapasAtuais] = await connection.query("SELECT id, nome_etapa FROM projeto_etapas WHERE projeto_id = ?", [projectId]);
        const mapaEtapasAtuais = new Map(etapasAtuais.map(e => [e.id, e.nome_etapa]));
        const idsEtapasAtuais = new Set(mapaEtapasAtuais.keys());

        const etapasDoRequest = etapas.map(e => ({ id: e.id, nome_etapa: e.nome_etapa, ordem: e.ordem, data_inicio: e.data_inicio, data_fim: e.data_fim }));

        // 3. Identifica e loga as etapas a serem deletadas
        const idsEtapasDoRequest = new Set(etapasDoRequest.map(e => e.id).filter(id => id !== null));
        const idsParaDeletar = [...idsEtapasAtuais].filter(id => !idsEtapasDoRequest.has(id));
        
        if (idsParaDeletar.length > 0) {
            for (const idParaDeletar of idsParaDeletar) {
                await registrarAcao(
                    connection, userId, userName, 'EXCLUSAO', 'Etapa de Projeto', idParaDeletar,
                    `Etapa '${mapaEtapasAtuais.get(idParaDeletar)}' foi removida do projeto '${nome}'.`
                );
            }
            await connection.query("DELETE FROM projeto_etapas WHERE id IN (?)", [idsParaDeletar]);
            console.log(`Etapas excluídas: ${idsParaDeletar.join(', ')}`);
        }
        
        // 4. Desabilita temporariamente a restrição UNIQUE para reordenar
        await connection.query("ALTER TABLE projeto_etapas DROP KEY idx_projeto_ordem");

        // 5. Atualiza, insere e loga as etapas restantes
        for (const etapa of etapasDoRequest) {
            const dataInicioEtapa = etapa.data_inicio || null;
            const dataFimEtapa = etapa.data_fim || null;
            if (etapa.id === null) {
                // Inserir nova etapa e logar
                const [insertResult] = await connection.query(
                    "INSERT INTO projeto_etapas (projeto_id, nome_etapa, ordem, data_inicio, data_fim) VALUES (?, ?, ?, STR_TO_DATE(?, '%d/%m/%Y %H:%i:%s'), STR_TO_DATE(?, '%d/%m/%Y %H:%i:%s'))",
                    [projectId, etapa.nome_etapa, etapa.ordem, dataInicioEtapa, dataFimEtapa]
                );
                await registrarAcao(
                    connection, userId, userName, 'CRIACAO', 'Etapa de Projeto', insertResult.insertId,
                    `Nova etapa '${etapa.nome_etapa}' foi adicionada ao projeto '${nome}'.`
                );
            } else {
                // Atualizar etapa existente e logar se houver mudança
                if(mapaEtapasAtuais.has(etapa.id) && mapaEtapasAtuais.get(etapa.id) !== etapa.nome_etapa) {
                     await registrarAcao(
                        connection, userId, userName, 'EDICAO', 'Etapa de Projeto', etapa.id,
                        `Nome da etapa no projeto '${nome}' foi alterado de '${mapaEtapasAtuais.get(etapa.id)}' para '${etapa.nome_etapa}'.`
                    );
                }
                await connection.query(
                    "UPDATE projeto_etapas SET nome_etapa = ?, ordem = ?, data_inicio = STR_TO_DATE(?, '%d/%m/%Y %H:%i:%s'), data_fim = STR_TO_DATE(?, '%d/%m/%Y %H:%i:%s') WHERE id = ?",
                    [etapa.nome_etapa, etapa.ordem, dataInicioEtapa, dataFimEtapa, etapa.id]
                );
            }
        }
        
        // 6. Reativa a restrição UNIQUE
        await connection.query("ALTER TABLE projeto_etapas ADD UNIQUE KEY `idx_projeto_ordem` (`projeto_id`,`ordem`)");

        await connection.commit();
        res.json({ message: "Projeto atualizado com sucesso!" });
    } catch (err) {
        if (connection) {
            await connection.rollback();
            try {
                // Tenta restaurar a chave única em caso de erro para não deixar o DB inconsistente
                await connection.query("ALTER TABLE projeto_etapas ADD UNIQUE KEY `idx_projeto_ordem` (`projeto_id`,`ordem`)");
            } catch (addKeyErr) {
                console.error("Erro ao tentar adicionar a chave de volta:", addKeyErr);
            }
        }
        console.error("Erro ao atualizar projeto:", err);
        res.status(500).json({ error: "Erro ao atualizar projeto." });
    } finally {
        if (connection) connection.release();
    }
});

// Excluir um projeto (DELETE)
app.delete("/api/projetos/:id", authenticateToken, authorizePermission('project.delete'), async (req, res) => {
    const { id: projectId } = req.params;
    const userId = req.user.id;
    const userName = req.user.nome; // Nome do usuário para o log

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // ADICIONAR: BUSCAR ANTES DE DELETAR
        const [projetos] = await connection.query("SELECT nome FROM projetos WHERE id = ?", [projectId]);
        if (projetos.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Projeto não encontrado." });
        }
        const nomeProjeto = projetos[0].nome;
        // FIM DA ADIÇÃO

        const [result] = await connection.query("DELETE FROM projetos WHERE id = ?", [projectId]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Projeto não encontrado." });
        }
        
        // ADICIONAR: REGISTRAR O LOG
        await registrarAcao(
            connection,
            userId,
            userName,
            'EXCLUSAO',
            'Projeto',
            projectId,
            `Projeto '${nomeProjeto}' (ID: ${projectId}) foi excluído.`
        );
        // FIM DA ADIÇÃO

        await connection.commit();
        res.json({ message: "Projeto excluído com sucesso!" });
    } finally {
        if (connection) connection.release();
    }
});

// NOVA ROTA: Encerrar ou Reabrir um projeto
app.put("/api/projetos/:id/encerrar", authenticateToken, authorizePermission('project.end'), async (req, res) => {
    console.log('API: /api/projetos/:id/encerrar (PUT) - INÍCIO');
    const { id } = req.params;
    const { encerrado } = req.body;
    const userId = req.user.id;

    if (typeof encerrado !== 'boolean') {
        console.log('API: /api/projetos/:id/encerrar (PUT) - Erro de validação: status de encerrado inválido.');
        return res.status(400).json({ error: "Status 'encerrado' deve ser um valor booleano (true/false)." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        console.log('API: /api/projetos/:id/encerrar (PUT) - Conexão com o banco de dados obtida');

        const [result] = await connection.query(
            "UPDATE projetos SET encerrado = ?, ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [encerrado ? 1 : 0, userId, id]
        );

        if (result.affectedRows === 0) {
            console.log('API: /api/projetos/:id/encerrar (PUT) - Projeto não encontrado.');
            return res.status(404).json({ error: "Projeto não encontrado." });
        }

        res.json({ message: `Projeto ${encerrado ? 'encerrado' : 'reaberto'} com sucesso!` });
        console.log('API: /api/projetos/:id/encerrar (PUT) - FIM (Sucesso)');
    } catch (err) {
        console.error("Erro ao encerrar/reabrir projeto:", err);
        res.status(500).json({ error: "Erro ao atualizar status do projeto." });
        console.log('API: /api/projetos/:id/encerrar (PUT) - FIM (Erro)');
    } finally {
        if (connection) {
            connection.release();
            console.log('CHAMADA DA API: /api/projetos/:id/encerrar (PUT) - Conexão com o BD liberada');
        }
    }
});


// ROTA: POST /api/projetos/:id/etapas — Adicionar uma nova etapa a um projeto existente
app.post("/api/projetos/:id/etapas", authenticateToken, authorizePermission('project.edit'), async (req, res) => {
    console.log('CHAMADA DA API: /api/projetos/:id/etapas (POST) - INÍCIO');
    const { id: projeto_id } = req.params;
    const { nome_etapa, ordem, data_inicio, data_fim, duracao_planejada_dias } = req.body;
    const { id: userId, nome: userName } = req.user; // LOG DE AUDITORIA: Captura nome do usuário

    if (!nome_etapa || ordem === undefined || ordem < 1) {
        console.log('CHAMADA DA API: /api/projetos/:id/etapas (POST) - Erro de validação');
        return res.status(400).json({ error: "Nome da etapa e ordem são obrigatórios." });
    }

    const dataInicioFormatted = data_inicio;
    const dataFimFormatted = data_fim;

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        console.log('CHAMADA DA API: /api/projetos/:id/etapas (POST) - Conexão com o banco de dados obtida');

        // LOG DE AUDITORIA: Busca o nome do projeto para um log mais descritivo
        const [projetoData] = await connection.query("SELECT nome FROM projetos WHERE id = ?", [projeto_id]);
        if (projetoData.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Projeto não encontrado." });
        }
        const nomeProjeto = projetoData[0].nome;
        // FIM DO LOG DE AUDITORIA

        const insertQuery = `INSERT INTO projeto_etapas (projeto_id, nome_etapa, ordem, data_inicio, data_fim, duracao_planejada_dias) VALUES (?, ?, ?, STR_TO_DATE(?, '%d/%m/%Y %H:%i:%s'), STR_TO_DATE(?, '%d/%m/%Y %H:%i:%s'), ?)`;
        const insertParams = [
            projeto_id,
            nome_etapa,
            ordem,
            dataInicioFormatted,
            dataFimFormatted,
            duracao_planejada_dias || null
        ];

        const [result] = await connection.query(insertQuery, insertParams);
        const newEtapaId = result.insertId; // LOG DE AUDITORIA: Captura o ID da nova etapa

        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userId, projeto_id]
        );

        // LOG DE AUDITORIA: Registra a criação da etapa
        await registrarAcao(
            connection,
            userId,
            userName,
            'CRIACAO',
            'Etapa de Projeto',
            newEtapaId,
            `Etapa '${nome_etapa}' foi adicionada ao projeto '${nomeProjeto}' (ID do Projeto: ${projeto_id}).`
        );
        // FIM DO LOG DE AUDITORIA

        await connection.commit();

        res.status(201).json({ message: "Etapa adicionada com sucesso!", id: newEtapaId });
        console.log('CHAMADA DA API: /api/projetos/:id/etapas (POST) - FIM (Sucesso)');

    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao adicionar etapa:", err);
        if (err.code === 'ER_DUP_ENTRY') {
            console.log('CHAMADA DA API: /api/projetos/:id/etapas (POST) - Erro de Entrada Duplicada');
            return res.status(409).json({ error: `Já existe uma etapa com a ordem ${ordem} para este projeto.` });
        }
        res.status(500).json({ error: "Erro ao adicionar etapa no banco de dados." });
        console.log('CHAMADA DA API: /api/projetos/:id/etapas - FIM (Erro)');
    } finally {
        if (connection) {
            connection.release();
            console.log('CHAMADA DA API: /api/projetos/:id/etapas - Conexão com o BD liberada');
        }
    }
});

// ROTA: PUT /api/etapas/:id — comentário automático gerado para documentação
app.put("/api/etapas/:id", authenticateToken, authorizePermission('project.edit'), async (req, res) => {
    console.log('CHAMADA DA API: /api/etapas/:id (PUT) - INÍCIO');
    const { id } = req.params;
    const { nome_etapa, ordem, data_inicio, data_fim, duracao_planejada_dias } = req.body;
    const userId = req.user.id;

    if (!nome_etapa || ordem === undefined || ordem < 1) {
        console.log('CHAMADA DA API: /api/etapas/:id (PUT) - Erro de validação');
        return res.status(400).json({ error: "Nome da etapa e ordem são obrigatórios." });
    }

    const dataInicioFormatted = data_inicio;
    const dataFimFormatted = data_fim;

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        console.log('CHAMADA DA API: /api/etapas/:id (PUT) - Conexão com o banco de dados obtida');

        const [etapaExistente] = await connection.query("SELECT projeto_id FROM projeto_etapas WHERE id = ?", [id]);
        if (etapaExistente.length === 0) {
             await connection.rollback();
             return res.status(404).json({ error: "Etapa não encontrada." });
        }
        const projetoId = etapaExistente[0].projeto_id;

        let updateQuery = `UPDATE projeto_etapas SET nome_etapa = ?, ordem = ?, data_inicio = STR_TO_DATE(?, '%d/%m/%Y %H:%i:%s'), data_fim = STR_TO_DATE(?, '%d/%m/%Y %H:%i:%s'), duracao_planejada_dias = ? WHERE id = ?`;
        const updateParams = [
            nome_etapa,
            ordem,
            dataInicioFormatted,
            dataFimFormatted,
            duracao_planejada_dias || null,
            id
        ];

        const [result] = await connection.query(updateQuery, updateParams);
        if (result.affectedRows === 0) {
            console.log('CHAMADA DA API: /api/etapas/:id (PUT) - Etapa não encontrada');
            await connection.rollback();
            return res.status(404).json({ error: "Etapa não encontrada." });
        }

        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userId, projetoId]
        );

        await connection.commit();

        res.json({ message: "Etapa atualizada com sucesso!" });
        console.log('CHAMADA DA API: /api/etapas/:id (PUT) - FIM (Sucesso)');
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao atualizar etapa:", err);
        if (err.code === 'ER_DUP_ENTRY') {
            console.log('CHAMADA DA API: /api/etapas/:id (PUT) - Erro de Entrada Duplicada');
            return res.status(409).json({ error: `Já existe uma etapa com a ordem ${ordem} para este projeto.` });
        }
        res.status(500).json({ error: "Erro ao atualizar etapa." });
        console.log('CHAMADA DA API: /api/etapas/:id (PUT) - FIM (Erro)');
    } finally {
        if (connection) connection.release();
    }
});

// ROTA: DELETE /api/etapas/:id — comentário automático gerado para documentação
app.delete("/api/etapas/:id", authenticateToken, authorizePermission('project.edit'), async (req, res) => {
    console.log('CHAMADA DA API: /api/etapas/:id (DELETE) - INÍCIO');
    const { id } = req.params;
    const userId = req.user.id;
    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        console.log('CHAMADA DA API: /api/etapas/:id (DELETE) - Transação iniciada para exclusão de etapa');

        const [etapaExistente] = await connection.query("SELECT projeto_id FROM projeto_etapas WHERE id = ?", [id]);
        if (etapaExistente.length === 0) {
             await connection.rollback();
             return res.status(404).json({ error: "Etapa não encontrada." });
        }
        const projetoId = etapaExistente[0].projeto_id;

        const [result] = await connection.query("DELETE FROM projeto_etapas WHERE id = ?", [id]);
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Etapa não encontrada." });
        }

        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userId, projetoId]
        );

        await connection.commit();
        console.log('CHAMADA DA API: /api/etapas/:id (DELETE) - Transação confirmada. Etapa e suas sub-etapas excluídas com sucesso.');
        res.status(200).json({ message: "Etapa e suas sub-etapas excluídas com sucesso!" });
        console.log('CHAMADA DA API: /api/etapas/:id (DELETE) - FIM (Sucesso)');
    } finally {
        if (connection) {
            connection.release();
            console.log('CHAMADA DA API: /api/etapas/:id (DELETE) - Conexão com o BD liberada');
        }
    }
});

// Rota para buscar sub-etapas de uma etapa, agora incluindo o nome de quem concluiu e os comentários
app.get("/api/etapas/:etapaId/sub_etapas", authenticateToken, authorizePermission('project.view.status'), async (req, res) => {
    const { etapaId } = req.params;
    let connection;
    try {
        connection = await db.promise().getConnection();
        const [setores] = await connection.query("SELECT * FROM setores WHERE projeto_etapa_id = ? ORDER BY ordem", [etapaId]);

        for (const setor of setores) {
            // Busca as sub-etapas para o setor
            const [subEtapas] = await connection.query(
                `SELECT
                    se.id AS sub_etapa_id, se.descricao, se.concluida,
                    DATE_FORMAT(se.data_prevista_conclusao, '%d/%m/%Y') AS data_prevista_conclusao,
                    DATE_FORMAT(se.data_compra, '%d/%m/%Y') AS data_compra,
                    DATE_FORMAT(se.data_conclusao, '%d/%m/%Y %H:%i:%s') AS data_conclusao, 
                    u_criador.nome AS nome_criador, u_concluidor.nome AS nome_concluidor,
                    (SELECT GROUP_CONCAT(u_assign.nome SEPARATOR ', ') FROM management_activities ma
                     JOIN usuarios u_assign ON ma.employee_id = u_assign.id
                     WHERE ma.sub_etapa_id = se.id AND ma.status <> 'Concluida'
                    ) AS assigned_employee_names
                FROM sub_etapas se
                LEFT JOIN usuarios u_criador ON se.criado_por_usuario_id = u_criador.id
                LEFT JOIN usuarios u_concluidor ON se.concluido_por_usuario_id = u_concluidor.id
                WHERE se.setor_id = ?
                ORDER BY se.id`,
                [setor.id]
            );

            // Calcula a porcentagem de conclusão para o setor
            const totalSubEtapas = subEtapas.length;
            const subEtapasConcluidas = subEtapas.filter(se => se.concluida).length;
            const porcentagem = totalSubEtapas > 0 ? (subEtapasConcluidas / totalSubEtapas) * 100 : 0;
            
            // Adiciona a porcentagem e as sub-etapas ao objeto do setor
            setor.porcentagem_concluida = parseFloat(porcentagem.toFixed(2));
            setor.subEtapas = subEtapas;
        }

        res.json(setores);
    } catch (err) {
        console.error("Erro ao buscar setores e sub-etapas:", err);
        res.status(500).json({ error: "Erro ao buscar dados da etapa." });
    } finally {
        if (connection) connection.release();
    }
});



// Nova rota para atribuir uma sub-etapa a múltiplos funcionários
app.post("/api/sub-etapas/:subEtapaId/assign", authenticateToken, authorizePermission('management.assign.activity'), async (req, res) => {
    const { subEtapaId } = req.params;
    const { employeeIds } = req.body; // Espera um array de IDs
    const { id: assignerId, nome: assignerName } = req.user;

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
        return res.status(400).json({ error: "É necessário fornecer uma lista de IDs de funcionários." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        const [subEtapa] = await connection.query(`SELECT descricao, data_prevista_conclusao FROM sub_etapas WHERE id = ?`, [subEtapaId]);
        if (subEtapa.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Sub-etapa não encontrada." });
        }
        const { descricao, data_prevista_conclusao } = subEtapa[0];

        for (const employeeId of employeeIds) {
            // Remove atribuições antigas (não concluídas) para este usuário e sub-etapa para evitar duplicatas
            await connection.query("DELETE FROM management_activities WHERE employee_id = ? AND sub_etapa_id = ? AND status <> 'Concluida'", [employeeId, subEtapaId]);

            // Insere a nova atribuição
            await connection.query(
                "INSERT INTO management_activities (employee_id, descricao, data_limite, criado_por_usuario_id, data_criacao, sub_etapa_id) VALUES (?, ?, ?, ?, NOW(), ?)",
                [employeeId, descricao, data_prevista_conclusao, assignerId, subEtapaId]
            );
            
            // Log de auditoria para cada atribuição
            const [employee] = await connection.query(`SELECT nome FROM usuarios WHERE id = ?`, [employeeId]);
            if(employee.length > 0) {
                await registrarAcao(connection, assignerId, assignerName, 'EDICAO', 'Sub-Etapa', subEtapaId, `Sub-etapa '${descricao}' foi atribuída ao funcionário '${employee[0].nome}'.`);
            }
        }

        await connection.commit();
        res.status(201).json({ message: "Atividade(s) atribuída(s) com sucesso!" });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao atribuir atividade a múltiplos funcionários:", err);
        res.status(500).json({ error: "Erro ao atribuir atividade." });
    } finally {
        if (connection) connection.release();
    }
});



// ROTA: POST /api/etapas/:etapaId/sub_etapas — Adicionar uma nova sub-etapa a uma etapa
app.post("/api/etapas/:etapaId/sub_etapas", authenticateToken, authorizePermission('project.edit'), async (req, res) => {
    const { etapaId } = req.params;
    const { descricao, data_prevista_conclusao } = req.body;
    const { id: userId, nome: userName } = req.user; // LOG DE AUDITORIA

    if (!descricao) {
        return res.status(400).json({ error: "Descrição da sub-etapa é obrigatória." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // LOG DE AUDITORIA: Busca nomes para um log mais descritivo
        const [etapaResult] = await connection.query("SELECT projeto_id, nome_etapa FROM projeto_etapas WHERE id = ?", [etapaId]);
        if (etapaResult.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Etapa pai não encontrada." });
        }
        const { projeto_id, nome_etapa } = etapaResult[0];
        const [projetoResult] = await connection.query("SELECT nome FROM projetos WHERE id = ?", [projeto_id]);
        const nomeProjeto = projetoResult.length > 0 ? projetoResult[0].nome : 'Desconhecido';
        // FIM LOG DE AUDITORIA

        const dataPrevistaFormatted = data_prevista_conclusao;

        const insertQuery = `INSERT INTO sub_etapas (projeto_id, projeto_etapa_id, descricao, data_prevista_conclusao, criado_por_usuario_id) VALUES (?, ?, ?, STR_TO_DATE(?, '%d/%m/%Y'), ?)`;
        const insertParams = [projeto_id, etapaId, descricao, dataPrevistaFormatted, userId];

        const [result] = await connection.query(insertQuery, insertParams);
        const newSubEtapaId = result.insertId;

        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userId, projeto_id]
        );

        // LOG DE AUDITORIA: Registra a criação da sub-etapa
        await registrarAcao(
            connection,
            userId,
            userName,
            'CRIACAO',
            'Sub-Etapa',
            newSubEtapaId,
            `Sub-etapa '${descricao}' foi criada na etapa '${nome_etapa}' do projeto '${nomeProjeto}'.`
        );
        // FIM LOG DE AUDITORIA

        await connection.commit();
        res.status(201).json({ message: "Sub-etapa adicionada com sucesso!", id: newSubEtapaId });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao adicionar sub-etapa:", err);
        res.status(500).json({ error: "Erro ao adicionar sub-etapa." });
    } finally {
        if (connection) connection.release();
    }
});

// ROTA: PUT /api/sub_etapas/:id — comentário automático gerado para documentação
app.put("/api/sub_etapas/:id", authenticateToken, authorizePermission('project.edit'), async (req, res) => {
    const { id } = req.params;
    const { descricao, data_prevista_conclusao } = req.body;
    const { id: userId, nome: userName } = req.user; // LOG DE AUDITORIA

    if (!descricao) {
        return res.status(400).json({ error: "Descrição da sub-etapa é obrigatória." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // LOG DE AUDITORIA: Busca o estado anterior para logar as mudanças
        const [subEtapaAntesResult] = await connection.query(
            `SELECT se.descricao, DATE_FORMAT(se.data_prevista_conclusao, '%d/%m/%Y') as data_prevista_conclusao, p.nome as nome_projeto 
             FROM sub_etapas se JOIN projetos p ON se.projeto_id = p.id WHERE se.id = ?`, [id]
        );
        if (subEtapaAntesResult.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Sub-etapa não encontrada." });
        }
        const subEtapaAntes = subEtapaAntesResult[0];
        // FIM LOG DE AUDITORIA

        const dataPrevistaFormatted = data_prevista_conclusao;
        const [result] = await connection.query(
            "UPDATE sub_etapas SET descricao = ?, data_prevista_conclusao = STR_TO_DATE(?, '%d/%m/%Y') WHERE id = ?",
            [descricao, dataPrevistaFormatted, id]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Sub-etapa não encontrada." });
        }

        // LOG DE AUDITORIA: Compara e registra as mudanças
        const mudancas = [];
        if (subEtapaAntes.descricao !== descricao) mudancas.push(`descrição de '${subEtapaAntes.descricao}' para '${descricao}'`);
        if (subEtapaAntes.data_prevista_conclusao !== data_prevista_conclusao) mudancas.push(`prazo de '${subEtapaAntes.data_prevista_conclusao || 'N/A'}' para '${data_prevista_conclusao || 'N/A'}'`);

        if (mudancas.length > 0) {
            await registrarAcao(
                connection, userId, userName, 'EDICAO', 'Sub-Etapa', id,
                `Sub-etapa no projeto '${subEtapaAntes.nome_projeto}' foi atualizada: ${mudancas.join(', ')}.`
            );
        }
        // FIM LOG DE AUDITORIA

        await connection.commit();
        res.json({ message: "Sub-etapa atualizada com sucesso!" });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao atualizar sub-etapa:", err);
        res.status(500).json({ error: "Erro ao atualizar sub-etapa." });
    } finally {
        if (connection) connection.release();
    }
});

// ROTA: PUT /api/sub_etapas/:id/concluir — comentário automático gerado para documentação
app.put("/api/sub_etapas/:id/concluir", authenticateToken, authorizePermission('project.edit'), async (req, res) => {
    console.log('CHAMADA DA API: /api/sub_etapas/:id/concluir (PUT) - INÍCIO');
    const { id } = req.params;
    const { concluida } = req.body;
    const userId = req.user.id; // ID do usuário que está fazendo a ação

    if (concluida === undefined) {
        return res.status(400).json({ error: "Status de conclusão (concluida) é obrigatório." });
    }

    const dataConclusao = concluida ? new Date() : null;
    const concluidoPor = concluida ? userId : null; // Define o ID do usuário ou NULL

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        const [subEtapaExistente] = await connection.query("SELECT projeto_id FROM sub_etapas WHERE id = ?", [id]);
        if (subEtapaExistente.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Sub-etapa não encontrada." });
        }
        const projetoId = subEtapaExistente[0].projeto_id;

        const [result] = await connection.query(
            "UPDATE sub_etapas SET concluida = ?, data_conclusao = ?, concluido_por_usuario_id = ? WHERE id = ?",
            [concluida, dataConclusao, concluidoPor, id]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(500).json({ error: "Falha ao atualizar status da sub-etapa." });
        }

        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userId, projetoId]
        );
        
        await connection.commit();
        res.status(200).json({ message: `Sub-etapa marcada como ${concluida ? 'concluída' : 'pendente'} com sucesso!` });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao concluir atividade:", err);
        res.status(500).json({ error: "Erro interno do servidor ao concluir atividade.", details: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// ROTA: DELETE /api/sub_etapas/:id — comentário automático gerado para documentação
app.delete("/api/sub_etapas/:id", authenticateToken, authorizePermission('project.edit'), async (req, res) => {
    const { id } = req.params;
    const { id: userId, nome: userName } = req.user; // LOG DE AUDITORIA

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        
        // LOG DE AUDITORIA: Busca os dados antes de deletar
        const [subEtapaParaDeletarResult] = await connection.query(
            `SELECT se.descricao, p.nome as nome_projeto 
             FROM sub_etapas se JOIN projetos p ON se.projeto_id = p.id WHERE se.id = ?`, [id]
        );
        if (subEtapaParaDeletarResult.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Sub-etapa não encontrada." });
        }
        const subEtapaParaDeletar = subEtapaParaDeletarResult[0];
        // FIM LOG DE AUDITORIA

        const [result] = await connection.query("DELETE FROM sub_etapas WHERE id = ?", [id]);
        
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Sub-etapa não encontrada." });
        }

        // LOG DE AUDITORIA: Registra a exclusão
        await registrarAcao(
            connection, userId, userName, 'EXCLUSAO', 'Sub-Etapa', id,
            `Sub-etapa '${subEtapaParaDeletar.descricao}' do projeto '${subEtapaParaDeletar.nome_projeto}' foi excluída.`
        );
        // FIM LOG DE AUDITORIA

        await connection.commit();
        res.status(200).json({ message: "Sub-etapa excluída com sucesso!" });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao excluir sub-etapa:", err);
        res.status(500).json({ error: "Erro ao excluir sub-etapa." });
    } finally {
        if (connection) connection.release();
    }
});


// Rotas de Ferramentas (ferramentas)
app.get("/api/ferramentas", authenticateToken, authorizePermission('tooling.view'), async (req, res) => {
    console.log('CHAMADA DA API: /api/ferramentas - INÍCIO');
    let connection;
    try {
        connection = await db.promise().getConnection();
        console.log('CHAMADA DA API: /api/ferramentas - Conexão com o banco de dados obtida');
        
        const [ferramentas] = await connection.query(`
            SELECT
                f.id,
                f.nome,
                f.descricao,
                DATE_FORMAT(f.data_cadastro, '%d/%m/%Y %H:%i:%s') as data_cadastro,
                f.operador
            FROM ferramentas f
            ORDER BY f.nome;
        `);

        const finalFerramentas = await Promise.all(ferramentas.map(async (f) => {
            const [allSubEtapas] = await connection.query(`
                SELECT
                    fs.id,
                    fs.descricao,
                    fs.concluida,
                    fs.ordem,
                    DATE_FORMAT(fs.data_criacao, '%d/%m/%Y %H:%i:%s') as data_criacao,
                    DATE_FORMAT(fs.data_conclusao, '%d/%m/%Y %H:%i:%s') AS data_conclusao,
                    DATE_FORMAT(fs.data_prevista_conclusao, '%d/%m/%Y') AS data_prevista_conclusao,
                    CAST(fs.horas_trabalhadas_dia AS DECIMAL(10,4)) AS horas_trabalhadas_dia,
                    CAST(fs.horas_previstas_conclusao AS DECIMAL(10,4)) AS horas_previstas_conclusao,
                    fs.projeto_id,
                    DATE_FORMAT(fs.data_sub_etapa, '%d/%m/%Y') AS data_sub_etapa,
                    TIME_FORMAT(fs.hora_inicio_turno, '%H:%i') AS hora_inicio_turno,
                    TIME_FORMAT(fs.hora_fim_turno, '%H:%i') AS hora_fim_turno,
                    fs.operador,
                    p.nome AS nome_projeto,
                    pa.id AS anexo_id,
                    pa.nome_arquivo AS anexo_nome_arquivo,
                    pa.caminho_arquivo AS anexo_caminho_arquivo,
                    pa.tipo_arquivo AS anexo_tipo_arquivo
                FROM ferramenta_sub_etapas_producao fs
                LEFT JOIN projetos p ON fs.projeto_id = p.id
                LEFT JOIN projeto_pecas pp ON fs.descricao LIKE CONCAT('Produção de Peça: ', pp.nome, ' (Qtd: %)') AND pp.projeto_id = fs.projeto_id
                LEFT JOIN pecas_anexos pa ON pa.peca_id = pp.id AND pa.id = (
                    SELECT id FROM pecas_anexos
                    WHERE peca_id = pp.id
                    ORDER BY
                        CASE WHEN tipo_anexo_exibicao = 'miniatura' THEN 0 ELSE 1 END,
                        data_upload DESC
                    LIMIT 1
                )
                WHERE fs.ferramenta_id = ?
                ORDER BY fs.ordem ASC;
            `, [f.id]);

            f.subEtapasProducao = allSubEtapas.map(se => {
                const transformedSe = { ...se };
                if (transformedSe.anexo_caminho_arquivo) {
                    transformedSe.anexo_url = `/uploads/${transformedSe.anexo_caminho_arquivo}`;
                }
                return transformedSe;
            });
            return f;
        }));

        res.json(finalFerramentas);
        console.log('CHAMADA DA API: /api/ferramentas - FIM (Sucesso)');
    } catch (err) {
        console.error("Erro ao buscar ferramentas:", err);
        res.status(500).json({ error: "Erro ao buscar ferramentas." });
        console.log('CHAMADA DA API: /api/ferramentas - FIM (Erro)');
    } finally {
        if (connection) {
            connection.release();
            console.log('CHAMADA DA API: /api/ferramentas - Conexão com o BD liberada');
        }
    }
});

// *** INÍCIO DA CORREÇÃO ***
// Rota para buscar as descrições de sub-etapas de produção que estão na fila de máquinas ativas
app.get("/api/ferramentas/queued-activities", authenticateToken, authorizePermission('production.view'), async (req, res) => {
    console.log('API: /api/ferramentas/queued-activities (GET) - INÍCIO');
    let connection;
    try {
        connection = await db.promise().getConnection();
        
        // Esta consulta busca todas as sub-etapas que ainda não foram concluídas
        // e não têm um cronômetro rodando ativamente para elas.
        const [queuedActivities] = await connection.query(`
            SELECT fsep.descricao
            FROM ferramenta_sub_etapas_producao fsep
            WHERE
                fsep.concluida = 0
                AND fsep.id NOT IN (SELECT sub_etapa_producao_id FROM timers_ativos WHERE status = 'running')
        `);
        
        res.json(queuedActivities);
    } catch (err) {
        console.error('API: /api/ferramentas/queued-activities (GET) - Erro:', err);
        res.status(500).json({ error: 'Erro ao buscar atividades na fila de produção.' });
    } finally {
        if (connection) connection.release();
    }
});
// *** FIM DA CORREÇÃO ***

// ROTA: GET /api/ferramentas/:id — comentário automático gerado para documentação
app.get("/api/ferramentas/:id", authenticateToken, authorizePermission('tooling.view'), async (req, res) => {
    console.log('CHAMADA DA API: /api/ferramentas/:id - INÍCIO');
    const { id } = req.params;
    let connection;
    try {
        connection = await db.promise().getConnection();
        console.log('CHAMADA DA API: /api/ferramentas/:id - Conexão com o banco de dados obtida');
        const [results] = await connection.query("SELECT id, nome, descricao, DATE_FORMAT(data_cadastro, '%d/%m/%Y %H:%i:%s') as data_cadastro, operador FROM ferramentas WHERE id = ?", [id]);
        if (results.length === 0) {
            console.log('CHAMADA DA API: /api/ferramentas/:id - Ferramenta não encontrada');
            return res.status(404).json({ error: "Ferramenta não encontrada." });
        }
        res.json(results[0]);
        console.log('CHAMADA DA API: /api/ferramentas/:id - FIM (Sucesso)');
    } finally {
        if (connection) {
            connection.release();
            console.log('CHAMADA DA API: /api/ferramentas/:id - Conexão com o BD liberada');
        }
    }
});

// ROTA: POST /api/ferramentas — comentário automático gerado para documentação
app.post("/api/ferramentas", authenticateToken, authorizePermission('tooling.create.tool'), async (req, res) => {
    console.log('CHAMADA DA API: /api/ferramentas (POST) - INÍCIO');
    const { nome, descricao, operador } = req.body;
    if (!nome) {
        console.log('CHAMADA DA API: /api/ferramentas (POST) - Erro de validação');
        return res.status(400).json({ error: "Nome da ferramenta é obrigatório." });
    }
    let connection;
    try {
        connection = await db.promise().getConnection();
        console.log('CHAMADA DA API: /api/ferramentas (POST) - Conexão com o banco de dados obtida');
        const [result] = await connection.query("INSERT INTO ferramentas (nome, descricao, operador) VALUES (?, ?, ?)", [nome, descricao || null, operador || null]);
        res.status(201).json({ message: "Ferramenta adicionada com sucesso!", id: result.insertId });
        console.log('CHAMADA DA API: /api/ferramentas (POST) - FIM (Sucesso)');
    }
    catch (err) {
        console.error("Erro ao adicionar ferramenta:", err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: `Já existe outra ferramenta com o nome '${nome}'.` });
        }
        res.status(500).json({ error: "Erro ao adicionar ferramenta." });
    } finally {
        if (connection) {
            connection.release();
            console.log('CHAMADA DA API: /api/ferramentas (POST) - Conexão com o BD liberada');
        }
    }
});

// ROTA: PUT /api/ferramentas/:id — comentário automático gerado para documentação
app.put("/api/ferramentas/:id", authenticateToken, authorizePermission('tooling.edit.tool'), async (req, res) => {
    console.log('CHAMADA DA API: /api/ferramentas/:id (PUT) - INÍCIO');
    const { id } = req.params;
    const { nome, descricao, operador } = req.body;
    if (!nome) {
        console.log('CHAMADA DA API: /api/ferramentas/:id (PUT) - Erro de validação');
        return res.status(400).json({ error: "Nome da ferramenta é obrigatório." });
    }
    let connection;
    try {
        connection = await db.promise().getConnection();
        console.log('CHAMADA DA API: /api/ferramentas/:id (PUT) - Conexão com o banco de dados obtida');
        const [result] = await connection.query("UPDATE ferramentas SET nome = ?, descricao = ?, operador = ? WHERE id = ?", [nome, descricao || null, operador || null, id]);
        if (result.affectedRows === 0) {
            console.log('CHAMADA DA API: /api/ferramentas/:id (PUT) - Ferramenta não encontrada');
            return res.status(404).json({ error: "Ferramenta não encontrada." });
        }
        res.json({ message: "Ferramenta atualizada com sucesso!" });
    }
    catch (err) {
        console.error("Erro ao atualizar ferramenta:", err);
         if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: `Já existe outra ferramenta com o nome '${nome}'.` });
        }
        res.status(500).json({ error: "Erro ao atualizar ferramenta." });
    } finally {
        if (connection) {
            connection.release();
            console.log('CHAMADA DA API: /api/ferramentas/:id (PUT) - Conexão com o BD liberada');
        }
    }
});

// ROTA: DELETE /api/ferramentas/:id — comentário automático gerado para documentação
app.delete("/api/ferramentas/:id", authenticateToken, authorizePermission('tooling.delete.tool'), async (req, res) => {
    console.log('CHAMADA DA API: /api/ferramentas/:id (DELETE) - INÍCIAO');
    const { id } = req.params;
    let connection;
    try {
        connection = await db.promise().getConnection();
        console.log('CHAMADA DA API: /api/ferramentas/:id (DELETE) - Conexão com o banco de dados obtida');
        const [result] = await connection.query("DELETE FROM ferramentas WHERE id = ?", [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Ferramenta não encontrada." });
        }
        res.json({ message: "Ferramenta excluída com sucesso!" });
        console.log('CHAMADA DA API: /api/ferramentas/:id (DELETE) - FIM (Sucesso)');
    } finally {
        if (connection) {
            connection.release();
            console.log('CHAMADA DA API: /api/ferramentas/:id (DELETE) - Conexão com o BD liberada');
        }
    }
});


// ========================================================
// server.js — PARTE 4/6  (linhas 2204–2906 do arquivo processado)
// ATENÇÃO: Este arquivo foi gerado automaticamente a partir do server.js original.
//          Esta parte inclui comentários automáticos em rotas que não possuíam.
//          Mantenha a ordem das partes ao recombinar o código.
// ========================================================


// Rotas de Sub-etapas de Produção (ferramenta_sub_etapas_producao)
app.get("/api/ferramentas/:toolId/sub_etapas_producao", authenticateToken, authorizePermission('tooling.view'), async (req, res) => {
    console.log('CHAMADA DA API: /api/ferramentas/:toolId/sub_etapas_producao - INÍCIO');
    const { toolId } = req.params;

    let sql = `
        SELECT
            fs.id,
            fs.descricao,
            fs.concluida,
            fs.ordem,
            DATE_FORMAT(fs.data_criacao, '%d/%m/%Y %H:%i:%s') as data_criacao,
            DATE_FORMAT(fs.data_conclusao, '%d/%m/%Y %H:%i:%s') AS data_conclusao,
            DATE_FORMAT(fs.data_prevista_conclusao, '%d/%m/%Y') AS data_prevista_conclusao,
            CAST(fs.horas_trabalhadas_dia AS DECIMAL(10,4)) AS horas_trabalhadas_dia,
            CAST(fs.horas_previstas_conclusao AS DECIMAL(10,4)) AS horas_previstas_conclusao,
            fs.projeto_id,
            DATE_FORMAT(fs.data_sub_etapa, '%d/%m/%Y') AS data_sub_etapa,
            TIME_FORMAT(fs.hora_inicio_turno, '%H:%i') AS hora_inicio_turno,
            TIME_FORMAT(fs.hora_fim_turno, '%H:%i') AS hora_fim_turno,
            fs.operador,
            p.nome AS nome_projeto,
            pa.id AS anexo_id,
            pa.nome_arquivo AS anexo_nome_arquivo,
            pa.caminho_arquivo AS anexo_caminho_arquivo,
            pa.tipo_arquivo AS anexo_tipo_arquivo
        FROM ferramenta_sub_etapas_producao fs
        LEFT JOIN projetos p ON fs.projeto_id = p.id
        LEFT JOIN projeto_pecas pp ON fs.descricao LIKE CONCAT('Produção de Peça: ', pp.nome, ' (Qtd: %)') AND pp.projeto_id = fs.projeto_id
        LEFT JOIN pecas_anexos pa ON pa.peca_id = pp.id AND pa.id = (
            SELECT id FROM pecas_anexos
            WHERE peca_id = pp.id
            ORDER BY
                CASE WHEN tipo_anexo_exibicao = 'miniatura' THEN 0 ELSE 1 END,
                data_upload DESC
            LIMIT 1
        )
        WHERE fs.ferramenta_id = ?
        ORDER BY fs.ordem ASC;
    `;

    let connection;
    try {
        connection = await db.promise().getConnection();
        console.log('CHAMADA DA API: /api/ferramentas/:toolId/sub_etapas_producao - Conexão com o banco de dados obtida');
        const [subEtapas] = await connection.query(sql, [toolId]);

        const transformedSubEtapas = subEtapas.map(se => {
            const transformedSe = { ...se };
            if (transformedSe.anexo_caminho_arquivo) {
                transformedSe.anexo_url = `/uploads/${transformedSe.anexo_caminho_arquivo}`;
            }
            return transformedSe;
        });

        res.json(transformedSubEtapas);
        console.log('CHAMADA DA API: /api/ferramentas/:toolId/sub_etapas_producao - FIM (Sucesso)');
    } catch (err) {
        console.error("Erro ao buscar sub-etapas:", err);
        res.status(500).json({ error: "Erro ao buscar sub-etapas." });
        console.log('CHAMADA DA API: /api/ferramentas/:toolId/sub_etapas_producao - FIM (Erro)');
    } finally {
        if (connection) {
            connection.release();
            console.log('CHAMADA DA API: /api/ferramentas/:toolId/sub_etapas_producao - Conexão com o BD liberada');
        }
    }
});



app.put("/api/ferramentas/:toolId/sub_etapas_producao/:subStageId/reorder", authenticateToken, authorizePermission('tooling.manage.substages'), async (req, res) => {
    console.log('CHAMADA DA API: /api/ferramentas/:toolId/sub_etapas_producao/:subStageId/reorder - INÍCIO');
    const { toolId } = req.params;
    const { order } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(order) || order.length === 0) {
        console.log('CHAMADA DA API: /api/ferramentas/:toolId/sub_etapas_producao/:subStageId/reorder - Erro de validação: A ordem é uma array vazia ou inválida.');
        return res.status(400).json({ error: 'Lista de ordem de sub-etapas é inválida.' });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        for (let i = 0; i < order.length; i++) {
            const { id } = order[i];
            const newOrder = i + 1;
            await connection.execute(
                "UPDATE ferramenta_sub_etapas_producao SET ordem = ? WHERE id = ? AND ferramenta_id = ?",
                [newOrder, id, toolId]
            );
        }

        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = (SELECT projeto_id FROM ferramenta_sub_etapas_producao WHERE ferramenta_id = ? LIMIT 1)",
            [userId, toolId]
        );

        await connection.commit();
        res.status(200).json({ message: 'Ordem das sub-etapas atualizada com sucesso.' });
        console.log('CHAMADA DA API: /api/ferramentas/:toolId/sub_etapas_producao/reorder - FIM (Sucesso)');
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Erro ao atualizar a ordem das sub-etapas:', err);
        res.status(500).json({ error: 'Erro ao atualizar a ordem das sub-etapas.' });
        console.log('CHAMADA DA API: /api/ferramentas/:toolId/sub_etapas_producao/reorder - FIM (Erro)');
    } finally {
        if (connection) connection.release();
    }
});


// ROTA: GET /api/sub_etapas_producao/:id — comentário automático gerado para documentação
app.get("/api/sub_etapas_producao/:id", authenticateToken, authorizePermission('tooling.view'), async (req, res) => {
    console.log('CHAMADA DA API: /api/sub_etapas_producao/:id - INÍCIO');
    const { id } = req.params;

    let sql = `
        SELECT
            fs.id,
            fs.ferramenta_id,
            fs.descricao,
            fs.concluida,
            DATE_FORMAT(fs.data_criacao, '%d/%m/%Y %H:%i:%s') as data_criacao,
            DATE_FORMAT(fs.data_conclusao, '%d/%m/%Y %H:%i:%s') as data_conclusao,
            DATE_FORMAT(fs.data_prevista_conclusao, '%d/%m/%Y') as data_prevista_conclusao,
            CAST(fs.horas_trabalhadas_dia AS DECIMAL(10,4)) AS horas_trabalhadas_dia,
            CAST(fs.horas_previstas_conclusao AS DECIMAL(10,4)) AS horas_previstas_conclusao,
            fs.projeto_id,
            DATE_FORMAT(fs.data_sub_etapa, '%d/%m/%Y') AS data_sub_etapa,
            TIME_FORMAT(fs.hora_inicio_turno, '%H:%i') AS hora_inicio_turno,
            TIME_FORMAT(fs.hora_fim_turno, '%H:%i') AS hora_fim_turno,
            fs.operador,
            p.nome as nome_projeto
        FROM ferramenta_sub_etapas_producao fs
        LEFT JOIN projetos p ON fs.projeto_id = p.id
        WHERE fs.id = ?
    `;

    let connection;
    try {
        connection = await db.promise().getConnection();
        const [results] = await connection.query(sql, [id]);

        if (results.length === 0) {
            console.log('CHAMADA DA API: /api/sub_etapas_producao/:id - Sub-etapa não encontrada');
            return res.status(404).json({ error: "Sub-etapa de produção não encontrada." });
        }
        
        res.json(results[0]);
        console.log('CHAMADA DA API: /api/sub_etapas_producao/:id - FIM (Sucesso)');
    } finally {
        if (connection) {
            connection.release();
            console.log('CHAMADA DA API: /api/sub_etapas_producao/:id - Conexão com o BD liberada');
        }
    }
});


// ROTA: POST /api/ferramentas/:toolId/sub_etapas_producao — comentário automático gerado para documentação
app.post("/api/ferramentas/:toolId/sub_etapas_producao", authenticateToken, authorizePermission('tooling.manage.substages'), async (req, res) => {
    console.log('CHAMADA DA API: /api/ferramentas/:toolId/sub_etapas_producao (POST) - START');
    const { toolId } = req.params;
    const { descricao, data_prevista_conclusao, horas_trabalhadas_dia, horas_previstas_conclusao, data_sub_etapa, projeto_id, operador, hora_inicio_turno, hora_fim_turno } = req.body;
    const userId = req.user.id;

    if (!descricao) {
        console.log('CHAMADA DA API: /api/ferramentas/:toolId/sub_etapas_producao (POST) - Validation Error: Description ausente.');
        return res.status(400).json({ error: "Description of the sub-stage is required." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        console.log('API: /api/ferramentas/:toolId/sub_etapas_producao (POST) - Database connection obtained, transaction started.');

        const [existingSubStage] = await connection.query(
            `SELECT id FROM ferramenta_sub_etapas_producao WHERE ferramenta_id = ? AND descricao = ? AND concluida = 0`,
            [toolId, descricao]
        );

        if (existingSubStage.length > 0) {
            await connection.rollback();
            console.warn(`API: /api/ferramentas/:toolId/sub_etapas_producao (POST) - Duplicate active sub-stage detected.`);
            return res.status(409).json({ error: `Esta peça ("${descricao}") já está em produção ou agendada para esta ferramenta e não foi concluída. Por favor, conclua a atividade existente antes de atribuí-la novamente.` });
        }
        
        const [lastOrder] = await connection.query(`SELECT MAX(ordem) AS max_ordem FROM ferramenta_sub_etapas_producao WHERE ferramenta_id = ?`, [toolId]);
        const newOrder = (lastOrder[0].max_ordem || 0) + 1;

        const dataPrevistaFormatted = data_prevista_conclusao;
        const dataSubEtapaFormatted = data_sub_etapa;
        const normalizedHoraInicioTurno = normalizeTimeInput(hora_inicio_turno);
        const normalizedHoraFimTurno = normalizeTimeInput(hora_fim_turno);

        const finalHorasTrabalhadasDia = (typeof horas_trabalhadas_dia === 'number' && !isNaN(horas_trabalhadas_dia)) ? parseFloat(parseFloat(horas_trabalhadas_dia).toFixed(4)) : null;
        const finalHorasPrevistasConclusao = (typeof horas_previstas_conclusao === 'number' && !isNaN(horas_previstas_conclusao)) ? parseFloat(parseFloat(horas_previstas_conclusao).toFixed(4)) : null;

        const insertQuery = `INSERT INTO ferramenta_sub_etapas_producao (
            ferramenta_id, descricao, data_prevista_conclusao, horas_trabalhadas_dia,
            horas_previstas_conclusao, data_sub_etapa, hora_inicio_turno,
            hora_fim_turno, projeto_id, operador, criado_por_usuario_id, ordem
        ) VALUES (
            ?, ?, STR_TO_DATE(?, '%d/%m/%Y'), ?,
            ?, STR_TO_DATE(?, '%d/%m/%Y'), TIME(?),
            TIME(?), ?, ?, ?, ?
        )`;

        const queryParams = [
            toolId,
            descricao,
            dataPrevistaFormatted,
            finalHorasTrabalhadasDia,
            finalHorasPrevistasConclusao,
            dataSubEtapaFormatted,
            normalizedHoraInicioTurno,
            normalizedHoraFimTurno,
            projeto_id || null,
            operador && operador.trim() !== '' ? operador.trim() : null,
            userId,
            newOrder
        ];

        console.log('API: /api/ferramentas/:toolId/sub_etapas_producao (POST) - Parameters for database:', queryParams);

        const [result] = await connection.query(insertQuery, queryParams);
        
        // --- INÍCIO DA CORREÇÃO ---
        // Atualizar o status da peça para "Na fila para Produção" quando atribuída a uma ferramenta
        if (projeto_id && descricao) {
            const match = descricao.match(/Produção de Peça: (.+) \(Qtd: \d+\)/);
            if (match && match[1]) {
                const nomePeca = match[1].trim();
                const [pecaResult] = await connection.query(
                    `SELECT id, status FROM projeto_pecas WHERE projeto_id = ? AND nome = ?`,
                    [projeto_id, nomePeca]
                );
                
                if (pecaResult.length > 0) {
                    const peca = pecaResult[0];
                    if (peca.status !== 'Em Processo' && peca.status !== 'Concluído') {
                        await connection.query(
                            `UPDATE projeto_pecas SET status = 'Na fila para Produção' WHERE id = ?`,
                            [peca.id]
                        );
                        console.log(`API: .../sub_etapas_producao (POST) - Status da peça ${peca.id} atualizado para "Na fila para Produção"`);
                    }
                }
            }
        }
        // --- FIM DA CORREÇÃO ---
        
        await connection.commit();
        res.status(201).json({ message: "Production sub-stage added successfully!", id: result.insertId });
        console.log('API: /api/ferramentas/:toolId/sub_etapas_producao (POST) - END (Success)');
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("API: /api/ferramentas/:toolId/sub_etapas_producao (POST) - Error adding production sub-stage:", err);
        if (err.code === 'ER_DUP_ENTRY') {
             res.status(409).json({ error: `A sub-etapa "${descricao}" já existe como ativa para esta ferramenta. Conclua a existente antes de atribuí-la novamente.` });
        } else {
             res.status(500).json({ error: "Internal server error while adding production sub-stage." });
        }
        console.log('API: /api/ferramentas/:toolId/sub_etapas_producao (POST) - END (Error)');
    } finally {
        if (connection) connection.release();
    }
});

// ROTA: PUT /api/ferramentas/:toolId/sub_etapas_producao/:subStageId — comentário automático gerado para documentação
app.put("/api/ferramentas/:toolId/sub_etapas_producao/:subStageId", authenticateToken, authorizePermission('tooling.manage.substages'), async (req, res) => {
    console.log('CHAMADA DA API: /api/ferramentas/:toolId/sub_etapas_producao/:subStageId (PUT) - INÍCIO');
    const { toolId, subStageId } = req.params;
    const { descricao, data_prevista_conclusao, horas_trabalhadas_dia, horas_previstas_conclusao, data_sub_etapa, projeto_id, operador, hora_inicio_turno, hora_fim_turno, ordem } = req.body;
    const userId = req.user.id;

    console.log('DEBUG (server.js PUT sub_etapas_producao): req.body recebido:', req.body);

    if (!descricao) {
        console.log('CHAMADA DA API: /api/ferramentas/:toolId/sub_etapas_producao/:subStageId (PUT) - Erro de validação');
        return res.status(400).json({ error: "Descrição da sub-etapa é obrigatória." });
    }

    const dataPrevistaFormatted = data_prevista_conclusao;
    const dataSubEtapaFormatted = data_sub_etapa;
    const normalizedHoraInicioTurno = normalizeTimeInput(hora_inicio_turno);
    const normalizedHoraFimTurno = normalizeTimeInput(hora_fim_turno);

    const finalHorasTrabalhadasDia = (horas_trabalhadas_dia !== null && horas_trabalhadas_dia !== undefined && horas_trabalhadas_dia !== '')
        ? parseFloat(parseFloat(horas_trabalhadas_dia).toFixed(4))
        : null;

    const finalHorasPrevistasConclusao = (horas_previstas_conclusao !== null && horas_previstas_conclusao !== undefined && horas_previstas_conclusao !== '')
        ? parseFloat(parseFloat(horas_previstas_conclusao).toFixed(4))
        : null;

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        console.log('CHAMADA DA API: /api/ferramentas/:toolId/sub_etapas_producao/:subStageId (PUT) - Conexão com o banco de dados obtida');

        const [subEtapaExistente] = await connection.query("SELECT projeto_id FROM ferramenta_sub_etapas_producao WHERE id = ?", [subStageId]);
        if (subEtapaExistente.length === 0) {
             await connection.rollback();
             return res.status(404).json({ error: "Sub-etapa não encontrada." });
        }
        const projetoIdFromDb = subEtapaExistente[0].projeto_id;
        
        const updateQuery = `UPDATE ferramenta_sub_etapas_producao SET
            descricao = ?,
            data_prevista_conclusao = STR_TO_DATE(?, '%d/%m/%Y'),
            horas_trabalhadas_dia = ?,
            horas_previstas_conclusao = ?,
            data_sub_etapa = STR_TO_DATE(?, '%d/%m/%Y'),
            hora_inicio_turno = TIME(?),
            hora_fim_turno = TIME(?),
            projeto_id = ?,
            operador = ?,
            ordem = ?
        WHERE id = ? AND ferramenta_id = ?`;

        const queryParams = [
            descricao,
            dataPrevistaFormatted,
            finalHorasTrabalhadasDia,
            finalHorasPrevistasConclusao,
            dataSubEtapaFormatted,
            normalizedHoraInicioTurno,
            normalizedHoraFimTurno,
            projeto_id || null,
            operador && operador.trim() !== '' ? operador.trim() : null,
            ordem || null,
            subStageId,
            toolId
        ];

        console.log('DEBUG (server.js PUT sub_etapas_producao): queryParams para o banco:', queryParams);

        const [result] = await connection.query(updateQuery, queryParams);
        if (result.affectedRows === 0) {
            console.log('CHAMADA DA API: /api/ferramentas/:toolId/sub_etapas_producao/:subStageId (PUT) - Sub-etapa não encontrada ou não pertence à ferramenta');
            await connection.rollback();
            return res.status(404).json({ error: "Sub-etapa de produção não encontrada ou não pertence a esta ferramenta." });
        }

        const finalProjectId = projeto_id || projetoIdFromDb;
        if (finalProjectId) { 
            await connection.query(
                "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
                [userId, finalProjectId]
            );
            console.log(`DEBUG: Projeto pai ID ${finalProjectId} atualizado. Última atualização por usuário ID ${userId}.`);
        }

        await connection.commit();
        res.json({ message: "Sub-etapa de produção atualizada com sucesso!" });
        console.log('CHAMADA DA API: /api/ferramentas/:toolId/sub_etapas_producao/:subStageId - FIM (Sucesso)');
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao atualizar sub-etapa de produção:", err);
        res.status(500).json({ error: "Erro ao atualizar sub-etapa de produção." });
        console.log('CHAMADA DA API: /api/ferramentas/:toolId/sub_etapas_producao/:subStageId - FIM (Erro)');
    } finally {
        if (connection) connection.release();
    }
});

// ROTA: PUT /api/ferramentas_sub_etapas_producao/:id/concluir — comentário automático gerado para documentação
app.put("/api/ferramentas_sub_etapas_producao/:id/concluir", authenticateToken, authorizePermission('production.manage.timer'), async (req, res) => {
    console.log('CHAMADA DA API: /api/ferramentas_sub_etapas_producao/:id/concluir (PUT) - INÍCIO');
    const { id } = req.params;
    const { concluida } = req.body;
    const userId = req.user.id;

    if (concluida === undefined) {
        console.log('CHAMADA DA API: /api/ferramentas_sub_etapas_producao/:id/concluir (PUT) - Erro de validação: Status de conclusão (concluida) é obrigatório.');
        return res.status(400).json({ error: "Status de conclusão (concluida) é obrigatório." });
    }

    const dataConclusao = concluida ? new Date() : null;
    console.log(`DEBUG CONCLUIR: Data de Conclusão definida como: ${dataConclusao}`);

    let connection;
    try {
        connection = await db.promise().getConnection();
        console.log('CHAMADA DA API: /api/ferramentas_sub_etapas_producao/:id/concluir (PUT) - Transação iniciada.');
        await connection.beginTransaction();

        const [currentSubEtapaState] = await connection.query(
            "SELECT id, ferramenta_id, descricao, concluida FROM ferramenta_sub_etapas_producao WHERE id = ?",
            [id]
        );

        if (currentSubEtapaState.length === 0) {
            console.log('CHAMADA DA API: /api/ferramentas_sub_etapas_producao/:id/concluir (PUT) - Sub-etapa de produção não encontrada.');
            await connection.rollback();
            return res.status(404).json({ error: "Sub-etapa de produção não encontrada." });
        }

        const isAlreadyInDesiredState = currentSubEtapaState[0].concluida === (concluida ? 1 : 0);
        if (isAlreadyInDesiredState) {
            console.log(`CHAMADA DA API: /api/ferramentas_sub_etapas_producao/:id/concluir (PUT) - Sub-etapa já estava no estado desejado. Concluida: ${concluida}`);
            await connection.commit();
            return res.status(200).json({ message: `Sub-etapa já estava marcada como ${concluida ? 'concluída' : 'pendente'}.` });
        }

        const [result] = await connection.query(
            "UPDATE ferramenta_sub_etapas_producao SET concluida = ?, data_conclusao = ? WHERE id = ?",
            [concluida, dataConclusao, id]
        );

        if (result.affectedRows === 0) {
            console.log('CHAMADA DA API: /api/ferramentas_sub_etapas_producao/:id/concluir (PUT) - Sub-etapa de produção não afetada pela atualização. Revertendo transação.');
            await connection.rollback();
            return res.status(500).json({ error: "Falha ao atualizar status da sub-etapa de produção." });
        }
        console.log(`DEBUG CONCLUIR: Sub-etapa de produção ID ${id} atualizada no DB. Affected rows: ${result.affectedRows}`);


        const descricaoSubEtapa = currentSubEtapaState[0].descricao;
        console.log(`DEBUG CONCLUIR: Descrição da sub-etapa para ID ${id} recuperada: ${descricaoSubEtapa}`);
        if (descricaoSubEtapa) {
            console.log(`DEBUG CONCLUIR: Tentando extrair peça da descrição: "${descricaoSubEtapa}"`);
            const match = descricaoSubEtapa.match(/Produção de Peça: (.+) \(Qtd: (\d+)\)/);

            if (match) {
                const nomePeca = match[1].trim();
                console.log(`DEBUG CONCLUIR: Peça extraída: "${nomePeca}"`);

                let newPartStatus = concluida ? 'Concluído' : 'Disponivel';
                let updatePecaStatusQuery = "UPDATE projeto_pecas SET status = ? WHERE nome = ? AND projeto_id = (SELECT projeto_id FROM ferramenta_sub_etapas_producao WHERE id = ?)";
                let updatePecaStatusParams = [newPartStatus, nomePeca, id];

                const [pecaResult] = await connection.query(updatePecaStatusQuery, updatePecaStatusParams);

                if (pecaResult.affectedRows > 0) {
                    console.log(`CHAMADA DA API: /api/ferramentas_sub_etapas_producao/:id/concluir (PUT) - Status da peça '${nomePeca}' atualizado para '${newPartStatus}'.`);
                } else {
                    console.log(`CHAMADA DA API: /api/ferramentas_sub_etapas_producao/:id/concluir (PUT) - Peça '${nomePeca}' não encontrada ou status já era o desejado, ou não precisa ser atualizada.`);
                }
            } else {
                console.log(`CHAMADA DA API: /api/ferramentas_sub_etapas_producao/:id/concluir (PUT) - Descrição da sub-etapa não corresponde ao formato esperado para extrair nome da peça. Nenhuma atualização de status de peça realizada. Descrição: "${descricaoSubEtapa}"`);
            }
        } else {
            console.warn('DEBUG CONCLUIR: Não foi possível obter a descrição da sub-etapa para atualizar o status da peça.');
        }

        if (concluida) {
            const [timerDeleteResult] = await connection.query(
                `DELETE FROM timers_ativos WHERE sub_etapa_producao_id = ?`,
                [id]
            );
            if (timerDeleteResult.affectedRows > 0) {
                console.log(`DEBUG CONCLUIR: Timer ativo para sub-etapa ${id} removido do DB.`);
            } else {
                console.warn(`DEBUG CONCLUIR: Nenhum timer ativo encontrado para sub-etapa ${id} para remoção.`);
            }
        }

        const [ferramentaSubEtapaResult] = await connection.query("SELECT projeto_id FROM ferramenta_sub_etapas_producao WHERE id = ?", [id]);
        if (ferramentaSubEtapaResult.length > 0) {
            const projetoId = ferramentaSubEtapaResult[0].projeto_id;
            await connection.query(
                "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
                [userId, projetoId]
            );
        }

        await connection.commit();
        console.log('CHAMADA DA API: /api/ferramentas_sub_etapas_producao/:id/concluir (PUT) - Transação confirmada. Sub-etapa e peça atualizadas.');
        res.status(200).json({ message: `Sub-etapa marcada como ${concluida ? 'concluída' : 'pendente'} com sucesso!` });
        console.log('CHAMADA DA API: /api/ferramentas_sub_etapas_producao/:id/concluir (PUT) - FIM (Sucesso)');
    } catch (err) {
        if (connection) {
            await connection.rollback();
            console.log('CHAMADA DA API: /api/ferramentas_sub_etapas_producao/:id/concluir (PUT) - Transação revertida devido a erro.');
        }
        console.error("Erro ao concluir atividade e atualizar peça:", err);
        res.status(500).json({ error: "Erro interno do servidor ao concluir atividade.", details: err.message });
        console.log('CHAMADA DA API: /api/ferramentas_sub_etapas_producao/:id/concluir (PUT) - FIM (Erro)');
    } finally {
        if (connection) {
            connection.release();
            console.log('CHAMADA DA API: /api/ferramentas_sub_etapas_producao/:id/concluir (PUT) - Conexão com o BD liberada');
        }
    }
});

// ROTA: DELETE /api/sub_etapas_producao/:id — comentário automático gerado para documentação
app.delete("/api/sub_etapas_producao/:id", authenticateToken, authorizePermission('tooling.manage.substages'), async (req, res) => {
    console.log('CHAMADA DA API: /api/sub_etapas_producao/:id (DELETE) - INÍCIO');
    const { id } = req.params;
    let connection;
    try {
        connection = await db.promise().getConnection();
        console.log('CHAMADA DA API: /api/sub_etapas_producao/:id (DELETE) - Conexão com o banco de dados obtida');

        await connection.beginTransaction();

        const [deleteTimersResult] = await connection.query(
            "DELETE FROM timers_ativos WHERE sub_etapa_producao_id = ?",
            [id]
        );
        console.log(`CHAMADA DA API: /api/sub_etapas_producao/:id (DELETE) - ${deleteTimersResult.affectedRows} temporizadores ativos excluídos para sub-etapa ${id}.`);

        const [result] = await connection.query("DELETE FROM ferramenta_sub_etapas_producao WHERE id = ?", [id]);
        
        if (result.affectedRows === 0) {
            console.log('CHAMADA DA API: /api/sub_etapas_producao/:id (DELETE) - Sub-etapa de produção não encontrada, revertendo transação.');
            await connection.rollback();
            return res.status(404).json({ error: "Sub-etapa de produção não encontrada." });
        }

        await connection.commit();
        console.log('CHAMADA DA API: /api/sub_etapas_producao/:id (DELETE) - FIM (Sucesso)');
        res.status(200).json({ message: "Sub-etapa excluída com sucesso!" });
    } catch (err) {
        if (connection) {
            await connection.rollback();
            console.log('CHAMADA DA API: /api/sub_etapas_producao/:id (DELETE) - Transação revertida devido a erro.');
        }
        console.error("Erro ao excluir sub-etapa de produção:", err);
        res.status(500).json({ error: "Erro ao excluir sub-etapa de produção." });
        console.log('CHAMADA DA API: /api/sub_etapas_producao/:id (DELETE) - FIM (Erro)');
    } finally {
        if (connection) {
            connection.release();
            console.log('CHAMADA DA API: /api/sub_etapas_producao/:id (DELETE) - Conexão com o BD liberada');
        }
    }
});


// Rotas de Peças de Projeto (projeto_pecas)
app.get("/api/projetos/:projectId/pecas", authenticateToken, authorizePermission('project.view.status'), async (req, res) => {
    console.log('CHAMADA DA API: /api/projetos/:projectId/pecas - INÍCIO');
    const { projectId } = req.params;
    let connection;
    try {
        connection = await db.promise().getConnection();
        console.log('CHAMADA DA API: /api/projetos/:projectId/pecas - Conexão com o banco de dados obtida');
        const [pecas] = await connection.query(
            `SELECT pp.id, pp.nome, pp.quantidade, pp.status,
            DATE_FORMAT(pp.data_cadastro, '%d/%m/%Y %H:%i:%s') as data_cadastro,
            u.nome AS nome_criador,
            (SELECT SUM(fs.horas_previstas_conclusao) FROM ferramenta_sub_etapas_producao fs WHERE fs.descricao LIKE CONCAT('Produção de Peça: ', pp.nome, ' (Qtd: %)') AND fs.projeto_id = pp.projeto_id) AS horas_previstas,
            (SELECT SUM(fs.horas_trabalhadas_dia) FROM ferramenta_sub_etapas_producao fs WHERE fs.descricao LIKE CONCAT('Produção de Peça: ', pp.nome, ' (Qtd: %)') AND fs.projeto_id = pp.projeto_id) AS horas_realizadas
            FROM projeto_pecas pp
            LEFT JOIN usuarios u ON pp.criado_por_usuario_id = u.id
            WHERE pp.projeto_id = ? ORDER BY pp.nome ASC`,
            [projectId]
        );
        res.json(pecas);
        console.log('CHAMADA DA API: /api/projetos/:projectId/pecas - FIM (Sucesso)');
    } catch (err) {
        console.error("Erro ao buscar peças do projeto:", err);
        res.status(500).json({ error: "Erro ao buscar peças do projeto." });
        console.log('CHAMADA DA API: /api/projetos/:projectId/pecas - FIM (Erro)');
    } finally {
        if (connection) {
            connection.release();
            console.log('CHAMADA DA API: /api/projetos/:projectId/pecas - Conexão com o BD liberada');
        }
    }
});

// ROTA: GET /api/projetos_pecas_disponiveis — comentário automático gerado para documentação
app.get("/api/projetos_pecas_disponiveis", authenticateToken, authorizePermission('tooling.view'), async (req, res) => {
    console.log('CHAMADA DA API: /api/projetos_pecas_disponiveis - INÍCIO');
    const { searchTerm } = req.query;
    let connection;
    try {
        connection = await db.promise().getConnection();
        console.log('CHAMADA DA API: /api/projetos_pecas_disponiveis - Conexão com o banco de dados obtida');

        let sql = `
            SELECT
                pp.id,
                pp.projeto_id,
                pp.nome,
                pp.quantidade,
                pp.status,
                p.nome AS nome_projeto
            FROM
                projeto_pecas pp
            JOIN
                projetos p ON pp.projeto_id = p.id
            WHERE
                pp.status <> 'Concluído'
        `;
        const queryParams = [];

        if (searchTerm) {
            sql += ` AND pp.nome LIKE ?`;
            queryParams.push(`%${searchTerm}%`);
        }

        sql += ` ORDER BY pp.nome ASC`;

        const [pecas] = await connection.query(sql, queryParams);
        res.json(pecas);
        console.log('CHAMADA DA API: /api/projetos_pecas_disponiveis - FIM (Sucesso)');
    } catch (err) {
        console.error("Erro ao buscar peças disponíveis do projeto:", err);
        res.status(500).json({ error: "Erro ao buscar peças disponíveis do projeto." });
        console.log('CHAMADA DA API: /api/projetos_pecas_disponiveis - FIM (Erro)');
    } finally {
        if (connection) {
            connection.release();
            console.log('CHAMADA DA API: /api/projetos_pecas_disponiveis - Conexão com o BD liberada');
        }
    }
});

// ***** INÍCIO DA NOVA ROTA *****
// Rota para resetar (apenas deletar) um cronômetro de ferramentaria
app.post("/api/timers/reset", authenticateToken, authorizePermission('production.manage.timer'), async (req, res) => {
    console.log('API: /api/timers/reset (POST) - INÍCIO');
    const { ferramenta_id, sub_etapa_producao_id } = req.body;

    if (!ferramenta_id || !sub_etapa_producao_id) {
        return res.status(400).json({ error: 'Dados incompletos para resetar o temporizador.' });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        const [result] = await connection.query(
            `DELETE FROM timers_ativos WHERE ferramenta_id = ? AND sub_etapa_producao_id = ?`,
            [ferramenta_id, sub_etapa_producao_id]
        );

        if (result.affectedRows === 0) {
            // Não retorna erro se o timer não existir, pois o objetivo é garantir que ele não exista.
            console.log(`API: /api/timers/reset - Nenhum timer encontrado para resetar para ferramenta ${ferramenta_id}, mas a operação é considerada bem-sucedida.`);
        }
        
        res.status(200).json({ message: 'Temporizador resetado com sucesso.' });
        console.log('API: /api/timers/reset (POST) - FIM (Sucesso)');
    } catch (err) {
        console.error('API: /api/timers/reset - Erro:', err);
        res.status(500).json({ error: 'Erro ao resetar temporizador.' });
    } finally {
        if (connection) connection.release();
    }
});
// ***** FIM DA NOVA ROTA *****

// ROTA: GET /api/pecas/:id — comentário automático gerado para documentação
app.get("/api/pecas/:id", authenticateToken, authorizePermission('project.view.status'), async (req, res) => {
    console.log('CHAMADA DA API: /api/pecas/:id - INÍCIO');
    const { id } = req.params;
    let connection;
    try {
        connection = await db.promise().getConnection();
        console.log('CHAMADA DA API: /api/pecas/:id - Conexão com o banco de dados obtida');
        const [results] = await connection.query(
            "SELECT id, projeto_id, nome, quantidade, status, DATE_FORMAT(data_cadastro, '%d/%m/%Y %H:%i:%s') as data_cadastro FROM projeto_pecas WHERE id = ?",
            [id]
        );
        if (results.length === 0) {
            console.log('CHAMADA DA API: /api/pecas/:id - Peça não encontrada');
            return res.status(404).json({ error: "Peça não encontrada." });
        }
        res.json(results[0]);
        console.log('CHAMADA DA API: /api/pecas/:id - FIM (Sucesso)');
    } finally {
        if (connection) {
            connection.release();
            console.log('CHAMADA DA API: /api/pecas/:id - Conexão com o BD liberada');
        }
    }
});

// Rota para adicionar uma nova peça a um projeto
app.post("/api/projetos/:projectId/pecas", authenticateToken, authorizePermission('project.manage.parts'), async (req, res) => {
    const { projectId } = req.params;
    const { nome, quantidade, status } = req.body;
    const { id: userId, nome: userName } = req.user; // LOG DE AUDITORIA

    if (!nome || quantidade === undefined || quantidade <= 0 || !status) {
        return res.status(400).json({ error: "Nome, quantidade e status são obrigatórios para a peça, e a quantidade deve ser positiva." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // LOG DE AUDITORIA: Busca o nome do projeto para o log
        const [projetoResult] = await connection.query("SELECT nome FROM projetos WHERE id = ?", [projectId]);
        const nomeProjeto = projetoResult.length > 0 ? projetoResult[0].nome : 'Desconhecido';
        // FIM LOG DE AUDITORIA

        const [result] = await connection.query(
            "INSERT INTO projeto_pecas (projeto_id, nome, quantidade, status, criado_por_usuario_id, data_cadastro) VALUES (?, ?, ?, ?, ?, NOW())",
            [projectId, nome, quantidade, status, userId]
        );
        const newPecaId = result.insertId;

        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userId, projectId]
        );
        
        // LOG DE AUDITORIA: Registra a criação da peça
        await registrarAcao(
            connection,
            userId,
            userName,
            'CRIACAO',
            'Peça de Projeto',
            newPecaId,
            `Peça '${nome}' (Qtd: ${quantidade}) foi adicionada ao projeto '${nomeProjeto}'.`
        );
        // FIM LOG DE AUDITORIA

        await connection.commit();
        res.status(201).json({ message: "Peça adicionada com sucesso!", id: newPecaId });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao adicionar peça do projeto:", err);
        res.status(500).json({ error: "Erro ao adicionar peça do projeto." });
    } finally {
        if (connection) connection.release();
    }
});

// ========================================================
// server.js — PARTE 5/6  (linhas 2906–3652 do arquivo processado)
// ATENÇÃO: Este arquivo foi gerado automaticamente a partir do server.js original.
//          Esta parte inclui comentários automáticos em rotas que não possuíam.
//          Mantenha a ordem das partes ao recombinar o código.
// ========================================================


// Rota para atualizar uma peça existente
app.put("/api/pecas/:id", authenticateToken, authorizePermission('project.manage.parts'), async (req, res) => {
    const { id } = req.params;
    const { nome, quantidade, status } = req.body;
    const { id: userId, nome: userName } = req.user; // LOG DE AUDITORIA

    if (!nome || quantidade === undefined || quantidade <= 0 || !status) {
        return res.status(400).json({ error: "Nome, quantidade e status são obrigatórios." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // LOG DE AUDITORIA: Busca o estado anterior da peça
        const [pecaAntesResult] = await connection.query(
            `SELECT pp.nome, pp.quantidade, pp.status, p.nome as nome_projeto, pp.projeto_id 
             FROM projeto_pecas pp JOIN projetos p ON pp.projeto_id = p.id WHERE pp.id = ?`, [id]
        );
        if (pecaAntesResult.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Peça não encontrada." });
        }
        const pecaAntes = pecaAntesResult[0];
        // FIM LOG DE AUDITORIA

        const [result] = await connection.query(
            "UPDATE projeto_pecas SET nome = ?, quantidade = ?, status = ? WHERE id = ?",
            [nome, quantidade, status, id]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Peça não encontrada." });
        }

        // LOG DE AUDITORIA: Compara e registra as mudanças
        const mudancas = [];
        if (pecaAntes.nome !== nome) mudancas.push(`nome de '${pecaAntes.nome}' para '${nome}'`);
        if (pecaAntes.quantidade != quantidade) mudancas.push(`quantidade de '${pecaAntes.quantidade}' para '${quantidade}'`);
        if (pecaAntes.status !== status) mudancas.push(`status de '${pecaAntes.status}' para '${status}'`);
        
        if (mudancas.length > 0) {
            await registrarAcao(
                connection, userId, userName, 'EDICAO', 'Peça de Projeto', id,
                `Peça no projeto '${pecaAntes.nome_projeto}' foi atualizada: ${mudancas.join(', ')}.`
            );
        }
        // FIM LOG DE AUDITORIA

        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userId, pecaAntes.projeto_id]
        );

        await connection.commit();
        res.json({ message: "Peça atualizada com sucesso!" });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao atualizar peça do projeto:", err);
        res.status(500).json({ error: "Erro ao atualizar peça do projeto." });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para excluir uma peça de um projeto
app.delete("/api/pecas/:id", authenticateToken, authorizePermission('project.manage.parts'), async (req, res) => {
    const { id } = req.params;
    const { id: userId, nome: userName } = req.user; // LOG DE AUDITORIA

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // LOG DE AUDITORIA: Busca os dados da peça antes de deletar
        const [pecaParaDeletarResult] = await connection.query(
            `SELECT pp.nome, pp.projeto_id, p.nome as nome_projeto 
             FROM projeto_pecas pp JOIN projetos p ON pp.projeto_id = p.id WHERE pp.id = ?`, [id]
        );
        if (pecaParaDeletarResult.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Peça não encontrada." });
        }
        const pecaParaDeletar = pecaParaDeletarResult[0];
        // FIM LOG DE AUDITORIA

        const [result] = await connection.query("DELETE FROM projeto_pecas WHERE id = ?", [id]);
        
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Peça não encontrada." });
        }

        // LOG DE AUDITORIA: Registra a exclusão
        await registrarAcao(
            connection, userId, userName, 'EXCLUSAO', 'Peça de Projeto', id,
            `Peça '${pecaParaDeletar.nome}' foi excluída do projeto '${pecaParaDeletar.nome_projeto}'.`
        );
        // FIM LOG DE AUDITORIA

        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userId, pecaParaDeletar.projeto_id]
        );
        
        await connection.commit();
        res.status(200).json({ message: "Peça excluída com sucesso!" });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao excluir peça:", err);
        res.status(500).json({ error: "Erro ao excluir peça." });
    } finally {
        if (connection) connection.release();
    }
});


// ===============================================
// Rotas de Anexos de Peças (NOVO)
// ===============================================

app.post("/api/pecas/:pecaId/anexos", authenticateToken, authorizePermission('project.manage.attachments'), upload.single('anexo'), async (req, res) => {
    console.log('CHAMADA DA API: /api/pecas/:pecaId/anexos (POST) - INÍCIO');
    const { pecaId } = req.params;
    const { tipo_anexo_exibicao } = req.body; // NOVO: Captura o tipo de exibição
    const userId = req.user.id;

    if (!req.file) {
        console.log('CHAMADA DA API: /api/pecas/:pecaId/anexos (POST) - Erro: Nenhum arquivo enviado.');
        return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }

    const { originalname, mimetype, filename, path: filePath } = req.file;
    const caminho_relativo = path.relative(path.join(__dirname, 'uploads'), filePath);
    const correctedOriginalName = Buffer.from(originalname, 'latin1').toString('utf8');

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        console.log('CHAMADA DA API: /api/pecas/:pecaId/anexos (POST) - Conexão com o banco de dados obtida');

        const [pecaExists] = await connection.query("SELECT projeto_id FROM projeto_pecas WHERE id = ?", [pecaId]);
        if (pecaExists.length === 0) {
            console.log('CHAMADA DA API: /api/pecas/:pecaId/anexos (POST) - Erro: Peça não encontrada.');
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlink(req.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error("Erro ao remover arquivo órfão:", unlinkErr);
                });
            }
            await connection.rollback();
            return res.status(404).json({ error: "Peça não encontrada." });
        }

        const projetoId = pecaExists[0].projeto_id;
        const insertQuery = `INSERT INTO pecas_anexos (peca_id, nome_arquivo, caminho_arquivo, tipo_arquivo, tipo_anexo_exibicao) VALUES (?, ?, ?, ?, ?)`;
        const [result] = await connection.query(insertQuery, [pecaId, correctedOriginalName, caminho_relativo, mimetype, tipo_anexo_exibicao]);
        console.log(`DEBUG UPLOAD: Anexo inserido no DB com ID: ${result.insertId}`);

        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userId, projetoId]
        );

        await connection.commit();
        res.status(201).json({ message: "Anexo enviado com sucesso!", id: result.insertId, filename: correctedOriginalName, filePath: `/uploads/${caminho_relativo}` });
        console.log('CHAMADA DA API: /api/pecas/:pecaId/anexos (POST) - FIM (Sucesso)');
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao enviar anexo:", err);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error("Erro ao remover arquivo órfão:", unlinkErr);
            });
        }
        res.status(500).json({ error: "Erro ao salvar anexo no banco de dados." });
        console.log('CHAMADA DA API: /api/pecas/:pecaId/anexos (POST) - FIM (Erro)');
    } finally {
        if (connection) {
            connection.release();
            console.log('CHAMADA DA API: /api/pecas/:pecaId/anexos (POST) - Conexão com o BD liberada');
        }
    }
});

// ROTA: GET /api/pecas/:pecaId/anexos — Busca todos os anexos de uma peça
app.get("/api/pecas/:pecaId/anexos", authenticateToken, authorizePermission('project.view.status'), async (req, res) => {
    console.log('CHAMADA DA API: /api/pecas/:pecaId/anexos (GET) - INÍCIO');
    const { pecaId } = req.params;

    let connection;
    try {
        connection = await db.promise().getConnection();
        console.log('CHAMADA DA API: /api/pecas/:pecaId/anexos (GET) - Conexão com o banco de dados obtida');

        const [anexos] = await connection.query(
            "SELECT id, nome_arquivo, caminho_arquivo, tipo_arquivo, tipo_anexo_exibicao, DATE_FORMAT(data_upload, '%d/%m/%Y %H:%i:%s') as data_upload FROM pecas_anexos WHERE peca_id = ? ORDER BY id DESC",
            [pecaId]
        );

        // INÍCIO DA CORREÇÃO
        // Adiciona o prefixo correto /uploads ao caminho do arquivo para que o frontend possa acessá-lo.
        const anexosComCaminhoCompleto = anexos.map(anexo => ({
            ...anexo,
            url: `/uploads/${anexo.caminho_arquivo.replace(/\\/g, '/')}` // Garante que as barras sejam corretas para URL
        }));
        // FIM DA CORREÇÃO

        res.json(anexosComCaminhoCompleto);
        console.log('CHAMADA DA API: /api/pecas/:pecaId/anexos (GET) - FIM (Sucesso)');
    } catch (err) {
        console.error("Erro ao buscar anexos:", err);
        res.status(500).json({ error: "Erro ao buscar anexos." });
        console.log('CHAMADA DA API: /api/pecas/:pecaId/anexos (GET) - FIM (Erro)');
    } finally {
        if (connection) {
            connection.release();
            console.log('CHAMADA DA API: /api/pecas/:pecaId/anexos (GET) - Conexão com o BD liberada');
        }
    }
});

// ROTA: DELETE /api/anexos/:id — comentário automático gerado para documentação
app.delete("/api/anexos/:id", authenticateToken, authorizePermission('project.manage.attachments'), async (req, res) => {
    console.log('CHAMADA DA API: /api/anexos/:id (DELETE) - INÍCIO');
    const { id } = req.params;
    const userId = req.user.id;

    let connection;
    try {
        connection = await db.promise().getConnection();
        console.log('CHAMADA DA API: /api/anexos/:id (DELETE) - Conexão com o banco de dados obtida');
        await connection.beginTransaction();

        const [anexoData] = await connection.query("SELECT peca_id, caminho_arquivo FROM pecas_anexos WHERE id = ?", [id]);

        if (anexoData.length === 0) {
            console.log('CHAMADA DA API: /api/anexos/:id (DELETE) - Anexo não encontrado.');
            await connection.rollback();
            return res.status(404).json({ error: "Anexo não encontrado." });
        }

        const pecaId = anexoData[0].peca_id;
        const filePathToDelete = path.join(__dirname, 'uploads', anexoData[0].caminho_arquivo);

        const [result] = await connection.query("DELETE FROM pecas_anexos WHERE id = ?", [id]);
        if (result.affectedRows === 0) {
            console.log('CHAMADA DA API: /api/anexos/:id (DELETE) - Anexo não encontrado no DB.');
            await connection.rollback();
            return res.status(404).json({ error: "Anexo não encontrado no banco de dados." });
        }
        
        const [pecaExistente] = await connection.query("SELECT projeto_id FROM projeto_pecas WHERE id = ?", [pecaId]);
        if (pecaExistente.length > 0) {
            await connection.query(
                "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
                [userId, pecaExistente[0].projeto_id]
            );
        }

        if (fs.existsSync(filePathToDelete)) {
            await fs.promises.unlink(filePathToDelete);
            console.log(`CHAMADA DA API: /api/anexos/:id (DELETE) - Arquivo físico '${filePathToDelete}' excluído.`);
        } else {
            console.warn(`CHAMADA DA API: /api/anexos/:id (DELETE) - Arquivo físico não encontrado para exclusão: '${filePathToDelete}'.`);
        }

        await connection.commit();
        res.status(200).json({ message: "Anexo excluído com sucesso!" });
        console.log('CHAMADA DA API: /api/anexos/:id (DELETE) - FIM (Sucesso)');
    } catch (err) {
        if (connection) {
            await connection.rollback();
        }
        console.error("Erro ao excluir anexo:", err);
        res.status(500).json({ error: "Erro ao excluir anexo." });
        console.log('CHAMADA DA API: /api/anexos/:id (DELETE) - FIM (Erro)');
    } finally {
        if (connection) {
            connection.release();
            console.log('CHAMADA DA API: /api/anexos/:id (DELETE) - Conexão com o BD liberada');
        }
    }
});


// ===============================================
// NOVAS ROTAS DE SINCRONIZAÇÃO DO TEMPORIZADOR
// ===============================================

// Rota para buscar todos os temporizadores ativos, incluindo a descrição da sub-etapa
app.get("/api/timers/active", authenticateToken, authorizePermission('production.view'), async (req, res) => {
    console.log('API: /api/timers/active (GET) - INÍCIO');
    let connection;
    try {
        connection = await db.promise().getConnection();
        const [timers] = await connection.query(`
            SELECT
                ta.id,
                ta.ferramenta_id,
                ta.sub_etapa_producao_id,
                ta.status,
                ta.tempo_acumulado_ms,
                ta.ultimo_inicio_timestamp,
                fsep.descricao
            FROM timers_ativos ta
            JOIN ferramenta_sub_etapas_producao fsep ON ta.sub_etapa_producao_id = fsep.id
            WHERE ta.status = 'running' OR ta.tempo_acumulado_ms > 0
        `);
        res.json(timers);
    } catch (err) {
        console.error('API: /api/timers/active (GET) - Erro:', err);
        res.status(500).json({ error: 'Erro ao buscar temporizadores ativos.' });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para iniciar ou retomar um temporizador
app.post("/api/timers/start", authenticateToken, authorizePermission('production.manage.timer'), async (req, res) => {
    console.log('API: /api/timers/start (POST) - INÍCIO');
    const { ferramenta_id, sub_etapa_producao_id, tempo_acumulado_ms, ultimo_inicio_timestamp: raw_ultimo_inicio_timestamp } = req.body;
    const operador_id = req.user.id;

    if (!ferramenta_id || !sub_etapa_producao_id || tempo_acumulado_ms === undefined || raw_ultimo_inicio_timestamp === undefined) {
        return res.status(400).json({ error: 'Dados incompletos para iniciar/retomar o temporizador.' });
    }

    let formatted_ultimo_inicio_timestamp = null;
    try {
        const dateObj = new Date(raw_ultimo_inicio_timestamp);
        if (isNaN(dateObj.getTime())) {
            throw new Error("Data de início inválida.");
        }
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        const hours = String(dateObj.getHours()).padStart(2, '0');
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');
        const seconds = String(dateObj.getSeconds()).padStart(2, '0');
        formatted_ultimo_inicio_timestamp = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

    } catch (e) {
        console.error("Erro de formatação de data para ultimo_inicio_timestamp:", e);
        return res.status(400).json({ error: "Formato de data de início inválido." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        
        const sql = `
            INSERT INTO timers_ativos 
              (ferramenta_id, sub_etapa_producao_id, status, tempo_acumulado_ms, ultimo_inicio_timestamp, operador_id)
            VALUES (?, ?, 'running', ?, STR_TO_DATE(?, '%d/%m/%Y %H:%i:%s'), ?)
            ON DUPLICATE KEY UPDATE
              status = 'running',
              tempo_acumulado_ms = VALUES(tempo_acumulado_ms),
              ultimo_inicio_timestamp = VALUES(ultimo_inicio_timestamp),
              operador_id = VALUES(operador_id)
        `;
        
        await connection.query(sql, [ferramenta_id, sub_etapa_producao_id, tempo_acumulado_ms, formatted_ultimo_inicio_timestamp, operador_id]);
        
        // --- INÍCIO DA CORREÇÃO ---
        const [subEtapaResult] = await connection.query(
            `SELECT projeto_id, descricao FROM ferramenta_sub_etapas_producao WHERE id = ?`,
            [sub_etapa_producao_id]
        );
        
        if (subEtapaResult.length > 0) {
            const { projeto_id, descricao } = subEtapaResult[0];
            if (projeto_id && descricao) {
                const match = descricao.match(/Produção de Peça: (.+) \(Qtd: \d+\)/);
                if (match && match[1]) {
                    const nomePeca = match[1].trim();
                    
                    const [pecaResult] = await connection.query(
                        `SELECT id, status FROM projeto_pecas WHERE projeto_id = ? AND nome = ?`,
                        [projeto_id, nomePeca]
                    );
                    
                    if (pecaResult.length > 0) {
                        const peca = pecaResult[0];
                        if (peca.status !== 'Em Processo') {
                            await connection.query(
                                `UPDATE projeto_pecas SET status = 'Em Processo' WHERE id = ?`,
                                [peca.id]
                            );
                            console.log(`API: /api/timers/start - Status da peça ${peca.id} atualizado para "Em Processo"`);
                        }
                    }
                }
            }
        }
        // --- FIM DA CORREÇÃO ---
        
        console.log(`API: /api/timers/start - Cronômetro para ferramenta ${ferramenta_id} e sub-etapa ${sub_etapa_producao_id} iniciado/atualizado.`);
        res.status(200).json({ message: 'Cronômetro iniciado com sucesso.' });
        
    } catch (err) {
        console.error('API: /api/timers/start - Erro:', err);
        if (err.sqlMessage) console.error('SQL Error Message:', err.sqlMessage);
        res.status(500).json({ error: 'Erro ao iniciar cronômetro.' });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para pausar um temporizador
app.put("/api/timers/pause", authenticateToken, authorizePermission('production.manage.timer'), async (req, res) => {
    console.log('API: /api/timers/pause (PUT) - INÍCIO');
    const { ferramenta_id, sub_etapa_producao_id, tempo_acumulado_ms } = req.body;

    if (!ferramenta_id || !sub_etapa_producao_id || tempo_acumulado_ms === undefined) {
        return res.status(400).json({ error: 'Dados incompletos para pausar o temporizador.' });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        const [result] = await connection.query(
            `UPDATE timers_ativos SET status = 'paused', tempo_acumulado_ms = ?, ultimo_inicio_timestamp = NULL WHERE ferramenta_id = ? AND sub_etapa_producao_id = ?`,
            [tempo_acumulado_ms, ferramenta_id, sub_etapa_producao_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Temporizador não encontrado ou não está ativo.' });
        }
        res.status(200).json({ message: 'Temporizador pausado com sucesso.' });
    } catch (err) {
        console.error('API: /api/timers/pause - Erro:', err);
        res.status(500).json({ error: 'Erro ao pausar temporizador.' });
    } finally {
        if (connection) connection.release();
    }
});

// ROTA: POST /api/timers/stop — comentário automático gerado para documentação
app.post("/api/timers/stop", authenticateToken, authorizePermission('production.manage.timer'), async (req, res) => {
    console.log('API: /api/timers/stop (POST) - START');
    const { ferramenta_id, sub_etapa_producao_id, horas_trabalhadas } = req.body;
    const userId = req.user.id;

    if (!ferramenta_id || !sub_etapa_producao_id || horas_trabalhadas === undefined || isNaN(parseFloat(horas_trabalhadas))) {
        console.log('API: /api/timers/stop - Validation Error: Incomplete or invalid data.');
        return res.status(400).json({ error: 'Incomplete or invalid data to finalize timer.' });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        const [subEtapaRows] = await connection.query(
            `SELECT horas_trabalhadas_dia FROM ferramenta_sub_etapas_producao WHERE id = ?`,
            [sub_etapa_producao_id]
        );

        if (subEtapaRows.length === 0) {
            console.log('API: /api/timers/stop - Production sub-stage not found to update hours.');
            await connection.rollback();
            return res.status(404).json({ error: 'Production sub-stage not found to register hours.' });
        }

        const horasAtuaisNoBancoDecimal = parseFloat(subEtapaRows[0].horas_trabalhadas_dia) || 0;
        const totalHorasAtualizadasDecimal = horasAtuaisNoBancoDecimal + parseFloat(horas_trabalhadas);
        
        await connection.query(
            `UPDATE ferramenta_sub_etapas_producao SET horas_trabalhadas_dia = ? WHERE id = ?`,
            [totalHorasAtualizadasDecimal.toFixed(4), sub_etapa_producao_id]
        );
        console.log(`API: /api/timers/stop - Hours (${parseFloat(horas_trabalhadas).toFixed(4)}) added to sub-etapa ${sub_etapa_producao_id}. Total updated: ${totalHorasAtualizadasDecimal.toFixed(4)}.`);


        const [deleteResult] = await connection.query(
            `DELETE FROM timers_ativos WHERE ferramenta_id = ? AND sub_etapa_producao_id = ?`,
            [ferramenta_id, sub_etapa_producao_id]
        );

        if (deleteResult.affectedRows === 0) {
            console.warn('API: /api/timers/stop - Timer not found in `timers_ativos`, but hours were registered. Not rolling back.');
        }

        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = (SELECT projeto_id FROM ferramenta_sub_etapas_producao WHERE id = ?)",
            [userId, sub_etapa_producao_id]
        );

        await connection.commit();
        res.status(200).json({ message: 'Timer finalized and hours registered successfully.' });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('API: /api/timers/stop - Error during timer stop/hour registration:', err);
        res.status(500).json({ error: 'Internal server error while finalizing timer and registering hours.' });
    } finally {
        if (connection) connection.release();
    }
});




// Rota para reordenar ferramentas
app.post("/ferramentas/reorder", authenticateToken, authorizePermission("tooling.edit.tool"), async (req, res) => {
    const { ordered_tool_ids } = req.body;

    if (!Array.isArray(ordered_tool_ids) || ordered_tool_ids.length === 0) {
        return res.status(400).json({ error: "Lista de IDs de ferramentas inválida." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        for (let i = 0; i < ordered_tool_ids.length; i++) {
            const toolId = ordered_tool_ids[i];
            const newOrder = i + 1;
            await connection.execute(
                "UPDATE ferramentas SET ordem_exibicao = ? WHERE id = ?",
                [newOrder, toolId]
            );
        }

        await connection.commit();
        res.status(200).json({ message: "Ordem das ferramentas atualizada com sucesso." });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Erro ao reordenar ferramentas:", error);
        res.status(500).json({ error: "Erro interno do servidor ao reordenar ferramentas." });
    } finally {
        if (connection) connection.release();
    }
});

// ========================================================
// FUNÇÕES AUXILIARES CORRIGIDAS PARA LEITURA DE EXCEL
// ========================================================

/**
 * NOVA FUNÇÃO: Lê arquivo Excel de forma mais robusta
 */
function readExcelFileRobust(filePath) {
    try {
        console.log(`Tentando ler arquivo Excel: ${filePath}`);
        
        if (!fs.existsSync(filePath)) {
            throw new Error(`Arquivo não encontrado: ${filePath}`);
        }

        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        console.log(`Lendo planilha: ${sheetName}`);
        
        if (!sheetName) {
            throw new Error('Nenhuma planilha encontrada no arquivo');
        }

        const worksheet = workbook.Sheets[sheetName];
        
        // Simplificação: A biblioteca 'xlsx' usa a primeira linha como cabeçalho por padrão, que é o correto.
        const bomDataRaw = xlsx.utils.sheet_to_json(worksheet, { defval: "" });

        if (!bomDataRaw || bomDataRaw.length === 0) {
            throw new Error('Nenhum dado encontrado na planilha. Verifique se a primeira linha contém os cabeçalhos.');
        }

        console.log(`Total de linhas de dados lidas (excluindo cabeçalho): ${bomDataRaw.length}`);
        return bomDataRaw;

    } catch (error) {
        console.error(`Erro ao ler arquivo Excel ${filePath}:`, error);
        throw error; // Propaga o erro para ser pego pelo handler da rota
    }
}

/**
 * NOVA FUNÇÃO: Normaliza dados do Excel de forma mais robusta
 */
function normalizeExcelData(bomDataRaw) {
    console.log('Normalizando dados do Excel...');
    
    const bomData = bomDataRaw.map((row) => {
        const normalizedRow = {};
        
        for (const key in row) {
            if (Object.prototype.hasOwnProperty.call(row, key)) {
                const normalizedKey = String(key)
                    .toLowerCase()
                    .trim()
                    .replace(/[áàâãä]/g, 'a')
                    .replace(/[éèêë]/g, 'e')
                    .replace(/[íìîï]/g, 'i')
                    .replace(/[óòôõö]/g, 'o')
                    .replace(/[úùûü]/g, 'u')
                    .replace(/[ç]/g, 'c')
                    .replace(/[^a-z0-9\s_.-]/g, '') // Permite ponto, hífen e underline
                    .replace(/\s+/g, ' ')
                    .trim();
                
                normalizedRow[normalizedKey] = row[key];
            }
        }
        return normalizedRow;
    });

    console.log(`Dados normalizados: ${bomData.length} linhas`);
    return bomData;
}

/**
 * NOVA FUNÇÃO: Busca valor em objeto com múltiplas chaves possíveis
 */
function getValueByKeys(obj, possibleKeys) {
    for (const key of possibleKeys) {
        if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== '') {
            return obj[key];
        }
    }
    return undefined;
}


// ROTAS PARA O ARQUIVO DE COMPRAS (Shopping File)

// Rota para fazer upload ou atualizar o arquivo de compras de um projeto
// app.post("/api/projetos/:projectId/shopping-file", authenticateToken, authorizePermission('project.manage.shopping'), upload.array('shoppingFiles', 10), async (req, res) => {
    
//     function readExcelFileRobust(filePath) {
//         try {
//             console.log(`Tentando ler arquivo Excel: ${filePath}`);
//             if (!fs.existsSync(filePath)) { throw new Error(`Arquivo não encontrado: ${filePath}`); }
//             const workbook = xlsx.readFile(filePath);
//             const sheetName = workbook.SheetNames[0];
//             console.log(`Lendo planilha: ${sheetName}`);
//             if (!sheetName) { throw new Error('Nenhuma planilha encontrada no arquivo'); }
//             const worksheet = workbook.Sheets[sheetName];
//             const rowsAsArrays = xlsx.utils.sheet_to_json(worksheet, { header: 1, range: 'A1:K10', raw: false });
//             let headerRowIndex = -1;
//             for (let i = 0; i < rowsAsArrays.length; i++) {
//                 const row = rowsAsArrays[i].map(cell => String(cell).toLowerCase());
//                 const rowString = row.join(' ');
//                 if ((rowString.includes('item') || rowString.includes('descrição')) && (rowString.includes('qtd') || rowString.includes('quantidade'))) {
//                     headerRowIndex = i;
//                     break;
//                 }
//             }
//             if (headerRowIndex === -1) { throw new Error('Não foi possível encontrar a linha de cabeçalho. Verifique se o arquivo contém colunas como "Item", "Descrição" e "Qtd".'); }
//             console.log(`Linha de cabeçalho encontrada na linha do Excel: ${headerRowIndex + 1}`);
//             const bomDataRaw = xlsx.utils.sheet_to_json(worksheet, { range: headerRowIndex });
//             if (!bomDataRaw || bomDataRaw.length === 0) { throw new Error('Nenhum dado encontrado abaixo da linha de cabeçalho.'); }
//             console.log(`Total de linhas de dados lidas (excluindo cabeçalho): ${bomDataRaw.length}`);
//             return bomDataRaw;
//         } catch (error) {
//             console.error(`Erro ao ler arquivo Excel ${filePath}:`, error);
//             throw error;
//         }
//     }

//     function normalizeExcelData(bomDataRaw) {
//         console.log('Normalizando dados do Excel...');
//         const bomData = bomDataRaw.map((row) => {
//             const normalizedRow = {};
//             for (const key in row) {
//                 if (Object.prototype.hasOwnProperty.call(row, key)) {
//                     const normalizedKey = String(key).toLowerCase().trim()
//                         .replace(/[áàâãä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i')
//                         .replace(/[óòôõö]/g, 'o').replace(/[úùûü]/g, 'u').replace(/[ç]/g, 'c')
//                         .replace(/[^a-z0-9\s_.-]/g, '')
//                         .replace(/\s+/g, ' ').trim();
//                     normalizedRow[normalizedKey] = row[key];
//                 }
//             }
//             return normalizedRow;
//         });
//         console.log(`Dados normalizados: ${bomData.length} linhas`);
//         return bomData;
//     }

//     function getValueByKeys(obj, possibleKeys) {
//         for (const key of possibleKeys) {
//             if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== '') {
//                 return obj[key];
//             }
//         }
//         return undefined;
//     }
    
//     console.log('=== INÍCIO DO UPLOAD DE SHOPPING FILE ===');
//     const { projectId } = req.params;
//     const userId = req.user?.id || 1;

//     if (!req.files || req.files.length === 0) {
//         return res.status(400).json({ error: "Nenhum arquivo enviado." });
//     }
//     console.log(`Processando ${req.files.length} arquivo(s) para o projeto ${projectId}`);

//     let connection;
//     try {
//         connection = await db.promise().getConnection();
//         for (const file of req.files) {
//             console.log(`\n--- Processando arquivo: ${file.originalname} ---`);
//             await connection.beginTransaction();
//             try {
//                 const correctedOriginalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
//                 const caminho_relativo = file.filename;
//                 console.log(`Nome corrigido: ${correctedOriginalName}`);
//                 console.log(`Caminho do arquivo: ${file.path}`);
//                 const match = correctedOriginalName.match(/^BOM[\s_-]+(.*?)\.(xlsx|xls)/i);
//                 const setor = match && match[1] ? match[1].trim() : 'Geral';
//                 console.log(`Setor identificado: ${setor}`);
//                 let bomDataRaw = readExcelFileRobust(file.path);
//                 const bomData = normalizeExcelData(bomDataRaw);

//                 const validBomData = bomData.filter((row, index) => {
//                     const descricaoKeys = ['descricao completa do item', 'descricao', 'item', 'peca', 'material ou produto', 'produto', 'material', 'nome', 'description'];
//                     const quantidadeKeys = ['quantidade', 'qtd', 'qtd.', 'qty', 'quantity'];
//                     const descricao = getValueByKeys(row, descricaoKeys);
//                     const quantidade = getValueByKeys(row, quantidadeKeys);
//                     const hasDescricao = descricao && String(descricao).trim() !== '';
//                     const hasQuantidade = quantidade !== undefined && quantidade !== null && String(quantidade).trim() !== '';
//                     if (!hasDescricao || !hasQuantidade) {
//                         console.log(`Linha ${index + 1} ignorada - Descrição: "${descricao}", Quantidade: "${quantidade}"`);
//                         return false;
//                     }
//                     return true;
//                 });
//                 if (validBomData.length === 0) {
//                     throw new Error(`Nenhuma linha com dados válidos foi encontrada no arquivo '${correctedOriginalName}'. Verifique se o arquivo contém colunas 'Descrição' e 'Quantidade'.`);
//                 }
//                 const [fileResult] = await connection.query(
//                     "INSERT INTO projeto_shopping_files (projeto_id, nome_arquivo, caminho_arquivo, setor, data_upload, status) VALUES (?, ?, ?, ?, NOW(), 'Pendente')",
//                     [projectId, correctedOriginalName, caminho_relativo, setor]
//                 );
//                 const shoppingFileId = fileResult.insertId;
//                 console.log(`Arquivo inserido no BD com ID: ${shoppingFileId}`);

//                 const bomItemsValues = validBomData.map((row, index) => {
//                     // >>> INÍCIO DA LINHA DE DEPURAÇÃO <<<
//                     if (index === 0) { 
//                         console.log('\n--- DEBUG: Objeto da primeira linha de dados VÁLIDA (após normalização) ---');
//                         console.log(row);
//                         console.log('--- DEBUG: Chaves disponíveis na linha ---');
//                         console.log(Object.keys(row));
//                         console.log('--- FIM DO DEBUG ---\n');
//                     }
//                     // >>> FIM DA LINHA DE DEPURAÇÃO <<<

//                     const descricaoKeys = ['descricao completa do item', 'descricao', 'item', 'peca', 'material ou produto', 'produto', 'material', 'nome', 'description'];
//                     const quantidadeKeys = ['quantidade', 'qtd', 'qtd.', 'qty', 'quantity'];
//                     const unidadeKeys = ['un', 'unidade', 'unit'];
//                     const fornecedorKeys = ['codigo do fabricante', 'cod. fabricante link', 'cod. fabricante / link', 'fornecedor', 'fabricante', 'supplier'];
//                     const valorUnitarioKeys = ['valor unitario', 'valor unitario r$', 'preco unitario', 'unit price'];
//                     const valorTotalKeys = ['valor total', 'valor total r$', 'preco total', 'total price'];
//                     const statusKeys = ['status', 'situacao'];
//                     const imagemKeys = ['foto do item', 'imagem', 'photo'];
//                     const justificativaKeys = ['justificativa de aquisicao', 'justificativa', 'observacao'];
//                     const descricao = getValueByKeys(row, descricaoKeys) || '';
//                     const quantidade = parseFloat(String(getValueByKeys(row, quantidadeKeys) || 0).replace(',', '.'));
//                     const unidade = getValueByKeys(row, unidadeKeys) || '';
//                     const fornecedor = getValueByKeys(row, fornecedorKeys) || null;
//                     const valorUnitario = parseFloat(String(getValueByKeys(row, valorUnitarioKeys) || 0).replace(',', '.'));
//                     const valorTotalItem = parseFloat(String(getValueByKeys(row, valorTotalKeys) || 0).replace(',', '.'));
//                     const status = getValueByKeys(row, statusKeys) || 'Pendente';
//                     const url_imagem = getValueByKeys(row, imagemKeys) || null;
//                     const justificativa = getValueByKeys(row, justificativaKeys) || null;
                    
//                     // Debug adicional para primeira linha
//                     if (index === 0) {
//                         console.log('--- DEBUG: Valores encontrados ---');
//                         console.log('Fornecedor/Link:', fornecedor);
//                         console.log('URL Imagem:', url_imagem);
//                         console.log('--- FIM DEBUG VALORES ---');
//                     }
//                     const dados_adicionais = {};

//                     return [
//                         shoppingFileId, projectId, setor, descricao, quantidade, unidade, 
//                         fornecedor, valorUnitario, valorTotalItem, status, url_imagem, justificativa, 
//                         JSON.stringify(dados_adicionais)
//                     ];
//                 });
                
//                 await connection.query(
//                     `INSERT INTO bom_items (
//                         shopping_file_id, projeto_id, setor, descricao, quantidade, unidade, 
//                         fornecedor, valor_unitario, valor_total_item, status, url_imagem, justificativa, dados_adicionais
//                     ) VALUES ?`, 
//                     [bomItemsValues]
//                 );
                
//                 console.log(`${bomItemsValues.length} itens inseridos na tabela bom_items`);
//                 await connection.commit();
//                 console.log(`Arquivo ${correctedOriginalName} processado com sucesso!`);
//             } catch (loopError) {
//                 console.error(`Erro ao processar arquivo ${file.originalname}:`, loopError);
//                 await connection.rollback();
//                 throw loopError;
//             }
//         }
        
//         const [projetos] = await connection.query("SELECT * FROM projetos WHERE id = ?", [projectId]);
//         const updatedProjectData = projetos.length > 0 ? projetos[0] : null;
//         console.log('=== UPLOAD CONCLUÍDO COM SUCESSO ===');
//         res.status(201).json({ 
//             message: "Arquivos de compras enviados com sucesso! Aguardando aprovação.",
//             updatedProject: updatedProjectData
//         });
//     } catch (err) {
//         console.error("=== ERRO FINAL NO UPLOAD ===", err);
//         res.status(500).json({ 
//             error: err.message || "Ocorreu um erro inesperado ao processar os arquivos.",
//             details: process.env.NODE_ENV === 'development' ? err.stack : undefined
//         });
//     } finally {
//         if (connection) connection.release();
//     }
// });

// NOVA ROTA: Aprovar ou Reprovar um arquivo de compras e criar sub-etapas
app.put("/api/shopping-file/:fileId/status", authenticateToken, authorizePermission('project.shopping.approve'), async (req, res) => {
    const { fileId } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    if (!status || !['Aprovado', 'Reprovado'].includes(status)) {
        return res.status(400).json({ error: "Status inválido. Use 'Aprovado' ou 'Reprovado'." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        const [fileInfo] = await connection.query("SELECT projeto_id, setor FROM projeto_shopping_files WHERE id = ?", [fileId]);
        if (fileInfo.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Arquivo de compras não encontrado." });
        }
        const { projeto_id, setor } = fileInfo[0];

        await connection.query(
            "UPDATE projeto_shopping_files SET status = ?, status_alterado_por_usuario_id = ?, data_status_alterado = NOW() WHERE id = ?",
            [status, userId, fileId]
        );

        if (status === 'Aprovado') {
            const [bomItems] = await connection.query("SELECT * FROM bom_items WHERE shopping_file_id = ?", [fileId]);

            if (bomItems.length > 0) {
                const [etapaAquisicoes] = await connection.query("SELECT id FROM projeto_etapas WHERE projeto_id = ? AND nome_etapa LIKE 'Aquisições'", [projeto_id]);
                if (etapaAquisicoes.length > 0) {
                    const etapaAquisicoesId = etapaAquisicoes[0].id;
                    let setorId;
                    const [setorExistente] = await connection.query("SELECT id FROM setores WHERE projeto_etapa_id = ? AND nome = ?", [etapaAquisicoesId, setor]);

                    if (setorExistente.length > 0) {
                        setorId = setorExistente[0].id;
                    } else {
                        const [maxOrder] = await connection.query("SELECT MAX(ordem) as max_ordem FROM setores WHERE projeto_etapa_id = ?", [etapaAquisicoesId]);
                        const newOrder = (maxOrder[0].max_ordem || 0) + 1;
                        const [newSetorResult] = await connection.query("INSERT INTO setores (projeto_etapa_id, projeto_id, nome, ordem) VALUES (?, ?, ?, ?)", [etapaAquisicoesId, projeto_id, setor, newOrder]);
                        setorId = newSetorResult.insertId;
                    }

                    for (const item of bomItems) {
                        const subEtapaDesc = `Comprar: ${item.descricao} (Qtd: ${item.quantidade})`;
                        await connection.query(
                            "INSERT INTO sub_etapas (projeto_id, projeto_etapa_id, setor_id, descricao, criado_por_usuario_id) VALUES (?, ?, ?, ?, ?)",
                            [projeto_id, etapaAquisicoesId, setorId, subEtapaDesc, userId]
                        );
                    }
                }
            }
        }
        
        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userId, projeto_id]
        );

        await connection.commit();
        res.status(200).json({ message: `Lista de compras marcada como '${status}' com sucesso!` });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao atualizar status do arquivo de compras:", err);
        res.status(500).json({ error: "Erro ao atualizar status do arquivo de compras." });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para buscar o arquivo de compras de um projeto
// app.get("/api/projetos/:projectId/shopping-file", authenticateToken, authorizePermission('project.manage.shopping'), async (req, res) => {
//     const { projectId } = req.params;

//     let connection;
//     try {
//         connection = await db.promise().getConnection();
//         const [files] = await connection.query(
//                 `SELECT
//                     psf.id,
//                     psf.nome_arquivo,
//                     psf.caminho_arquivo,
//                     psf.setor,
//                     psf.status,
//                     psf.data_upload,
//                     psf.data_status_alterado,
//                     u.nome AS status_alterado_por_nome
//                 FROM projeto_shopping_files psf
//                 LEFT JOIN usuarios u ON psf.status_alterado_por_usuario_id = u.id
//                 WHERE psf.projeto_id = ?
//                 ORDER BY psf.data_upload DESC`,
//                 [projectId]
//             );

//         // CORREÇÃO: Retorna array vazio ao invés de erro 404
//         if (files.length === 0) {
//             return res.json([]);
//         }
        
//         const responseFiles = files.map(file => ({
//             id: file.id,
//             nome_arquivo: file.nome_arquivo,
//             setor: file.setor,
//             status: file.status,
//             filePath: file.caminho_arquivo ? `/uploads/${file.caminho_arquivo.replace(/\\/g, '/')}` : null,
//             data_upload: file.data_upload,
//             data_status_alterado: file.data_status_alterado,
//             status_alterado_por_nome: file.status_alterado_por_nome
//         }));

//         res.json(responseFiles);

//     } catch (err) {
//         console.error("Erro ao buscar os arquivos de compras:", err);
//         res.status(500).json({ error: "Erro ao buscar os arquivos de compras." });
//     } finally {
//         if (connection) connection.release();
//     }
// });


// NOVA ROTA: Excluir um arquivo de compras específico (por ID do arquivo)
app.delete("/api/shopping-file/:fileId", authenticateToken, authorizePermission('project.manage.shopping'), async (req, res) => {
    const { fileId } = req.params;
    const userId = req.user.id;

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // 1. Encontrar o arquivo para obter o caminho e o ID do projeto
        const [fileToDelete] = await connection.query("SELECT id, caminho_arquivo, projeto_id FROM projeto_shopping_files WHERE id = ?", [fileId]);

        if (fileToDelete.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Arquivo de compras não encontrado." });
        }
        const { caminho_arquivo, projeto_id } = fileToDelete[0];
        const filePath = path.join(__dirname, 'uploads', caminho_arquivo);

        // 2. Excluir os itens da BOM associados a este arquivo
        await connection.query("DELETE FROM bom_items WHERE shopping_file_id = ?", [fileId]);

        // 3. Excluir o registro do arquivo de compras
        const [deleteResult] = await connection.query("DELETE FROM projeto_shopping_files WHERE id = ?", [fileId]);
        if (deleteResult.affectedRows === 0) {
            // Verificação extra caso algo dê errado entre as consultas
            await connection.rollback();
            return res.status(404).json({ error: "Arquivo de compras não encontrado para exclusão." });
        }

        // 4. Excluir o arquivo físico do servidor
        if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
        }

        // 5. Atualizar o timestamp do projeto pai
        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userId, projeto_id]
        );

        await connection.commit();
        res.status(200).json({ message: "Arquivo de compras e itens associados foram excluídos com sucesso." });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao excluir o arquivo de compras:", err);
        res.status(500).json({ error: "Erro ao excluir o arquivo de compras." });
    } finally {
        if (connection) connection.release();
    }
});

// ===============================================
// Rotas de Atividades do Projeto (NOVO)
// ===============================================

// Rota para buscar todas as atividades de um projeto
app.get("/api/projetos/:projectId/atividades", authenticateToken, authorizePermission('project.view.status'), async (req, res) => {
    console.log('API: /api/projetos/:projectId/atividades (GET) - INÍCIO');
    const { projectId } = req.params;
    let connection;
    try {
        connection = await db.promise().getConnection();
        
        const [atividades] = await connection.query(
            `SELECT
                pa.id,
                pa.projeto_id,
                pa.descricao,
                pa.data_limite,
                pa.concluida,
                u.nome AS assigned_employee_name
            FROM
                projeto_atividades pa
            LEFT JOIN
                management_activities ma 
                    ON pa.descricao = ma.descricao 
                AND ma.status <> 'Concluida'
            LEFT JOIN
                usuarios u 
                    ON ma.employee_id = u.id
            WHERE
                pa.projeto_id = ?
            ORDER BY
                pa.data_limite ASC`,
            [projectId]
        );

        res.json(atividades);
        console.log('API: /api/projetos/:projectId/atividades (GET) - FIM (Sucesso)');
    } catch(err) {
        console.error("Erro ao buscar atividades:", err);
        res.status(500).json({ error: "Erro ao buscar atividades." });
    } finally {
        if (connection) connection.release();
    }
});



// Rota para buscar uma única atividade por ID (NECESSÁRIO para o modal de edição)
app.get("/api/atividades/:id", authenticateToken, authorizePermission('management.view.activities'), async (req, res) => {
    console.log('API: /api/atividades/:id (GET) - INÍCIO');
    const { id } = req.params;
    let connection;
    try {
        connection = await db.promise().getConnection();
        const [atividade] = await connection.query(
            `SELECT id, projeto_id, descricao, data_limite, concluida, data_conclusao, criado_por_usuario_id 
             FROM projeto_atividades WHERE id = ?`,
            [id]
        );

        if (atividade.length === 0) {
            console.log('API: /api/atividades/:id (GET) - Atividade não encontrada.');
            return res.status(404).json({ error: "Atividade não encontrada." });
        }
        res.json(atividade[0]);
        console.log('API: /api/atividades/:id (GET) - FIM (Sucesso)');
    } catch(err) {
        console.error("Erro ao buscar atividade por ID:", err);
        res.status(500).json({ error: "Erro ao buscar atividade." });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para adicionar uma nova atividade a um projeto
app.post("/api/projetos/:projectId/atividades", authenticateToken, authorizePermission('management.assign.activity'), async (req, res) => {
    const { projectId } = req.params;
    const { descricao, data_limite } = req.body;
    const userId = req.user.id;

    if (!descricao || !data_limite) {
        return res.status(400).json({ error: "Descrição e data limite da atividade são obrigatórios." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        const [result] = await connection.query(
            "INSERT INTO projeto_atividades (projeto_id, descricao, data_limite, criado_por_usuario_id) VALUES (?, ?, ?, ?)",
            [projectId, descricao, data_limite, userId]
        );

        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userId, projectId]
        );

        await connection.commit();
        res.status(201).json({ message: "Atividade adicionada com sucesso!", id: result.insertId });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao adicionar atividade:", err);
        res.status(500).json({ error: "Erro ao adicionar atividade." });
    } finally {
        if (connection) connection.release();
    }
});

// ========================================================
// server.js — PARTE 6/6  (linhas 3652–4404 do arquivo processado)
// ATENÇÃO: Este arquivo foi gerado automaticamente a partir do server.js original.
//          Esta parte inclui comentários automáticos em rotas que não possuíam.
//          Mantenha a ordem das partes ao recombinar o código.
// ========================================================

// Rota para editar uma atividade
app.put("/api/atividades/:id", authenticateToken, authorizePermission('management.edit.activity'), async (req, res) => {
    const { id } = req.params;
    const { descricao, data_limite, concluida } = req.body;
    const userId = req.user.id;

    if (!descricao || !data_limite) {
        return res.status(400).json({ error: "Descrição e data limite da atividade são obrigatórios." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        const [result] = await connection.query(
            "UPDATE projeto_atividades SET descricao = ?, data_limite = ?, concluida = ?, data_conclusao = NOW() WHERE id = ?",
            [descricao, data_limite, concluida, id]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Atividade não encontrada." });
        }
        
        // Obter o ID do projeto a partir da atividade
        const [activity] = await connection.query("SELECT projeto_id FROM projeto_atividades WHERE id = ?", [id]);
        if (activity.length > 0) {
            await connection.query(
                "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
                [userId, activity[0].projeto_id]
            );
        }

        await connection.commit();
        res.json({ message: "Atividade atualizada com sucesso!" });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao editar atividade:", err);
        res.status(500).json({ error: "Erro ao editar atividade." });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para excluir uma atividade
app.delete("/api/atividades/:id", authenticateToken, authorizePermission('management.delete.activity'), async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        const [activity] = await connection.query("SELECT projeto_id FROM projeto_atividades WHERE id = ?", [id]);
        if (activity.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Atividade não encontrada." });
        }

        const [result] = await connection.query("DELETE FROM projeto_atividades WHERE id = ?", [id]);
        
        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userId, activity[0].projeto_id]
        );

        await connection.commit();
        res.json({ message: "Atividade excluída com sucesso!" });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao excluir atividade:", err);
        res.status(500).json({ error: "Erro ao excluir atividade." });
    } finally {
        if (connection) connection.release();
    }
});

// ===============================================
// Rotas de Funcionários (NOVO)
// ===============================================

// Rota para buscar funcionários (agora busca da tabela usuarios)
app.get("/api/employees", authenticateToken, authorizePermission('management.view.activities'), async (req, res) => {
    console.log('API: /api/employees (GET) para TELA 7 - INÍCIO');
    const { search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const searchTerm = `%${search || ''}%`;

    let connection;
    try {
        connection = await db.promise().getConnection();

        // ***** INÍCIO DA MODIFICAÇÃO *****
        // A consulta agora junta com a tabela de timers e soma apenas os que têm status 'running'
        const dataQuery = `
            SELECT 
                u.nome,
                MAX(u.id) AS id,
                MAX(u.role) AS cargo,
                SUM(CASE WHEN eat.status = 'running' THEN 1 ELSE 0 END) AS running_timers_count
            FROM usuarios u
            LEFT JOIN employee_activity_timers eat ON u.id = eat.employee_id
            WHERE u.nome LIKE ?
            GROUP BY u.nome
            ORDER BY u.nome
            LIMIT ? OFFSET ?
        `;
        const [users] = await connection.query(dataQuery, [searchTerm, parseInt(limit), parseInt(offset)]);
        // ***** FIM DA MODIFICAÇÃO *****

        const countQuery = `
            SELECT COUNT(DISTINCT nome) as total
            FROM usuarios
            WHERE nome LIKE ?
        `;
        
        const [countResult] = await connection.query(countQuery, [searchTerm]);
        const total = countResult[0].total;

        res.json({
            users: users,
            pagination: {
                totalItems: total,
                totalPages: Math.ceil(total / limit),
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        });

    } catch (err) {
        console.error("Erro ao buscar funcionários:", err);
        res.status(500).json({ error: "Erro ao buscar funcionários." });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para buscar um único funcionário por ID (NECESSÁRIO para o modal de edição)
app.get("/api/employees/:id", authenticateToken, authorizePermission('management.view.activities'), async (req, res) => {
    console.log('API: /api/employees/:id (GET) - INÍCIO');
    const { id } = req.params;
    let connection;
    try {
        connection = await db.promise().getConnection();
        // CORREÇÃO: Busca em 'usuarios' e renomeia 'role' para 'cargo'
        const [employee] = await connection.query('SELECT id, nome, role as cargo FROM usuarios WHERE id = ?', [id]);
        if (employee.length === 0) {
            return res.status(404).json({ error: "Funcionário não encontrado." });
        }
        res.json(employee[0]);
        console.log('API: /api/employees/:id (GET) - FIM (Sucesso)');
    } catch(err) {
        console.error("Erro ao buscar funcionário por ID:", err);
        res.status(500).json({ error: "Erro ao buscar funcionário." });
    } finally {
        if (connection) connection.release();
    }
});

// ROTA: PUT /api/employees/:id — Atualiza funcionário na tabela 'usuarios'
app.put("/api/employees/:id", authenticateToken, authorizePermission('user.edit.any'), async (req, res) => {
    console.log('API: /api/employees/:id (PUT) - INÍCIO');
    const { id } = req.params;
    const { nome, cargo } = req.body; // 'cargo' = role do usuário

    if (!nome || !cargo) {
        return res.status(400).json({ error: "Nome e cargo do funcionário são obrigatórios." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();

        const [roleRows] = await connection.query(
            "SELECT id FROM niveis_acesso WHERE nome = ?",
            [cargo]
        );

        if (roleRows.length === 0) {
            return res.status(400).json({ error: `O nível/cargo '${cargo}' não é válido.` });
        }

        const novoNivelAcessoId = roleRows[0].id;

        const [result] = await connection.query(
            "UPDATE usuarios SET nome = ?, role = ?, nivel_acesso_id = ? WHERE id = ?",
            [nome, cargo, novoNivelAcessoId, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Funcionário não encontrado." });
        }

        res.json({ message: "Funcionário atualizado com sucesso!" });
        console.log('API: /api/employees/:id (PUT) - FIM (Sucesso)');
    } catch (err) {
        console.error("Erro ao atualizar funcionário:", err);
        res.status(500).json({ error: "Erro ao atualizar funcionário." });
    } finally {
        if (connection) connection.release();
    }
});



// ===============================================
// Rotas de Atribuição de Atividades a Funcionários (NOVO)
// ===============================================

// Rota para buscar todas as atividades de gerenciamento de um funcionário (CORRIGIDA)
app.get("/api/employees/:employeeId/activities", authenticateToken, authorizePermission('management.view.assigned'), async (req, res) => {
    const { employeeId } = req.params;
    let connection;
    try {
        connection = await db.promise().getConnection();
        const [activities] = await connection.query(
            `SELECT
                ma.id, ma.employee_id, ma.descricao, ma.status, ma.data_limite, ma.data_criacao,
                DATE_FORMAT(ma.data_conclusao, '%d/%m/%Y %H:%i:%s') as data_conclusao,
                ma.comentarios, ma.leader_comments,
                u.nome AS nome_criador,
                p.nome AS projeto_nome,
                pe.nome_etapa AS etapa_nome,
                s.nome as setor_nome,
                (SELECT COUNT(id) FROM management_activities ma2 WHERE ma2.employee_id = ma.employee_id AND ma2.data_criacao <= ma.data_criacao) AS ordem
             FROM 
                management_activities ma
             LEFT JOIN usuarios u ON ma.criado_por_usuario_id = u.id
             LEFT JOIN sub_etapas se ON ma.sub_etapa_id = se.id
             LEFT JOIN projetos p ON se.projeto_id = p.id
             LEFT JOIN projeto_etapas pe ON se.projeto_etapa_id = pe.id
             LEFT JOIN setores s ON se.setor_id = s.id
             WHERE ma.employee_id = ?
             ORDER BY ma.data_criacao ASC`,
            [employeeId]
        );
        res.json(activities);
    } catch (err) {
        console.error("Erro ao buscar atividades do funcionário:", err);
        res.status(500).json({ error: "Erro ao buscar atividades." });
    } finally {
        if (connection) connection.release();
    }
});

// NOVA ROTA: Para COLABORADOR adicionar um comentário e atualizar a previsão de entrega
app.post("/api/management-activities/:id/comment", authenticateToken, authorizePermission('management.edit.activity'), async (req, res) => {
    const { id: activityId } = req.params;
    const { comentario } = req.body;
    const { id: userId, nome: userName } = req.user;

    if (!comentario || comentario.trim() === '') {
        return res.status(400).json({ error: "O comentário não pode estar vazio." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction(); // Inicia a transação

        const previsaoRegex = /Previsão de Entrega:\s*(\d{2}\/\d{2}\/\d{4})/i;
        const match = comentario.match(previsaoRegex);

        if (match && match[1]) {
            const dataEntrega = match[1];
            const [activityLink] = await connection.query('SELECT sub_etapa_id FROM management_activities WHERE id = ?', [activityId]);
            
            if (activityLink.length > 0 && activityLink[0].sub_etapa_id) {
                const subEtapaId = activityLink[0].sub_etapa_id;
                await connection.query(
                    "UPDATE sub_etapas SET data_prevista_conclusao = STR_TO_DATE(?, '%d/%m/%Y') WHERE id = ?",
                    [dataEntrega, subEtapaId]
                );
            }
        }

        const now = new Date();
        const timestamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const formattedComment = `\n[${timestamp}] ${userName}: ${comentario}`;
        
        await connection.query(
            `UPDATE management_activities SET comentarios = CONCAT(IFNULL(comentarios, ''), ?) WHERE id = ?`,
            [formattedComment, activityId]
        );

        await connection.commit(); // Confirma as alterações
        res.json({ message: "Comentário adicionado com sucesso!" });
    } catch (err) {
        if (connection) await connection.rollback(); // Desfaz em caso de erro
        console.error("Erro ao adicionar comentário do colaborador:", err);
        res.status(500).json({ error: "Erro ao salvar comentário." });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para LÍDER adicionar um comentário a uma atividade
app.post("/api/management-activities/:id/leader-comment", authenticateToken, authorizePermission('management.edit.activity'), async (req, res) => {
    const { id: activityId } = req.params;
    const { comentario } = req.body;
    const { id: userId, nome: userName } = req.user;

    if (!comentario || comentario.trim() === '') {
        return res.status(400).json({ error: "O comentário não pode estar vazio." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction(); // Inicia a transação

        // Lógica para atualizar a previsão de entrega se o comentário a contiver
        const previsaoRegex = /Previsão de Entrega:\s*(\d{2}\/\d{2}\/\d{4})/i;
        const match = comentario.match(previsaoRegex);

        if (match && match[1]) {
            const dataEntrega = match[1];
            const [activityLink] = await connection.query('SELECT sub_etapa_id FROM management_activities WHERE id = ?', [activityId]);
            
            if (activityLink.length > 0 && activityLink[0].sub_etapa_id) {
                const subEtapaId = activityLink[0].sub_etapa_id;
                await connection.query(
                    "UPDATE sub_etapas SET data_prevista_conclusao = STR_TO_DATE(?, '%d/%m/%Y') WHERE id = ?",
                    [dataEntrega, subEtapaId]
                );
            }
        }

        const now = new Date();
        const timestamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const formattedComment = `\n[${timestamp}] ${userName}: ${comentario}`;

        await connection.query(
            `UPDATE management_activities SET leader_comments = CONCAT(IFNULL(leader_comments, ''), ?) WHERE id = ?`,
            [formattedComment, activityId]
        );

        await connection.commit(); // Confirma as alterações
        res.json({ message: "Comentário adicionado com sucesso!" });
    } catch (err) {
        if (connection) await connection.rollback(); // Desfaz em caso de erro
        console.error("Erro ao adicionar comentário do líder:", err);
        res.status(500).json({ error: "Erro ao salvar comentário." });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para pausar cronômetro de atividade de gerenciamento
app.put("/api/timers/activities/pause", authenticateToken, authorizePermission('management.manage.timer'), async (req, res) => {
    console.log('API: /api/timers/activities/pause (PUT) - INÍCIO');
    const { employee_id, activity_id, tempo_acumulado_ms, comentario } = req.body;
    const userName = req.user.nome;

    if (employee_id === undefined || activity_id === undefined || tempo_acumulado_ms === undefined) {
        return res.status(400).json({ error: 'Dados incompletos para pausar o cronômetro.' });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        const [result] = await connection.query(
            `UPDATE employee_activity_timers SET status = 'paused', tempo_acumulado_ms = ?, ultimo_inicio_timestamp = NULL WHERE employee_id = ? AND activity_id = ?`,
            [tempo_acumulado_ms, employee_id, activity_id]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Cronômetro não encontrado ou não está ativo.' });
        }

        if (comentario && comentario.trim() !== '') {
            // Lógica para extrair a data do comentário (ADICIONADA AQUI)
            const previsaoRegex = /Previsão de Entrega:\s*(\d{2}\/\d{2}\/\d{4})/i;
            const match = comentario.match(previsaoRegex);

            if (match && match[1]) {
                const dataEntrega = match[1];
                const [activityLink] = await connection.query('SELECT sub_etapa_id FROM management_activities WHERE id = ?', [activity_id]);
                
                if (activityLink.length > 0 && activityLink[0].sub_etapa_id) {
                    const subEtapaId = activityLink[0].sub_etapa_id;
                    await connection.query(
                        "UPDATE sub_etapas SET data_prevista_conclusao = STR_TO_DATE(?, '%d/%m/%Y') WHERE id = ?",
                        [dataEntrega, subEtapaId]
                    );
                    console.log(`[pause-timer] Previsão de entrega atualizada para a sub-etapa ${subEtapaId}.`);
                }
            }
            // Fim da lógica de data

            const timestamp = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const formattedComment = `\n[${timestamp}] ${userName}: ${comentario}`;
            
            await connection.query(
                `UPDATE management_activities SET comentarios = CONCAT(IFNULL(comentarios, ''), ?) WHERE id = ?`,
                [formattedComment, activity_id]
            );
        }
        
        await connection.commit();
        res.status(200).json({ message: 'Cronômetro pausado com sucesso.' });
        console.log('API: /api/timers/activities/pause (PUT) - FIM (Sucesso)');
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('API: /api/timers/activities/pause - Erro:', err);
        res.status(500).json({ error: 'Erro ao pausar cronômetro.' });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para buscar as Etapas de um projeto específico
app.get("/api/projetos/:projectId/etapas", authenticateToken, authorizePermission('management.view.activities'), async (req, res) => {
    const { projectId } = req.params;
    let connection;
    try {
        connection = await db.promise().getConnection();
        const [etapas] = await connection.query(
            `SELECT id, nome_etapa, ordem FROM projeto_etapas WHERE projeto_id = ? ORDER BY ordem ASC`,
            [projectId]
        );
        res.json(etapas);
    } catch (err) {
        console.error("Erro ao buscar etapas do projeto:", err);
        res.status(500).json({ error: "Erro ao buscar etapas do projeto." });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para atribuir uma nova atividade (agora baseada em SUB-ETAPA) a um funcionário
app.post("/api/employees/:employeeId/activities", authenticateToken, authorizePermission('management.assign.activity'), async (req, res) => {
    const { employeeId } = req.params;
    const { sub_etapa_id } = req.body;
    const { id: userId, nome: userName } = req.user;

    if (!sub_etapa_id) {
        return res.status(400).json({ error: "ID da sub-etapa do projeto é obrigatório." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        const [employee] = await connection.query(`SELECT nome FROM usuarios WHERE id = ?`, [employeeId]);
        const [subEtapa] = await connection.query(`SELECT descricao, data_prevista_conclusao FROM sub_etapas WHERE id = ?`, [sub_etapa_id]);
        
        if (employee.length === 0 || subEtapa.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Funcionário ou Sub-etapa não encontrados." });
        }

        const nomeFuncionario = employee[0].nome;
        const { descricao, data_prevista_conclusao } = subEtapa[0];

        // ***** BLOCO DE CÓDIGO REMOVIDO *****
        // A verificação abaixo foi removida para permitir múltiplas atribuições.
        /*
        const [existingAssignment] = await connection.query(`SELECT id FROM management_activities WHERE sub_etapa_id = ? AND status <> 'Concluida'`, [sub_etapa_id]);
        if (existingAssignment.length > 0) {
            await connection.rollback();
            return res.status(409).json({ error: "Esta sub-etapa já está atribuída a um funcionário e não foi concluída." });
        }
        */
        // ***** FIM DA REMOÇÃO *****

        const [result] = await connection.query(
            "INSERT INTO management_activities (employee_id, descricao, data_limite, criado_por_usuario_id, data_criacao, sub_etapa_id) VALUES (?, ?, ?, ?, NOW(), ?)",
            [employeeId, descricao, data_prevista_conclusao, userId, sub_etapa_id]
        );

        await registrarAcao(
            connection, userId, userName, 'EDICAO', 'Sub-Etapa', sub_etapa_id,
            `Sub-etapa '${descricao}' foi atribuída ao funcionário '${nomeFuncionario}'.`
        );

        await connection.commit();
        res.status(201).json({ message: "Atividade atribuída com sucesso!", id: result.insertId });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao atribuir atividade a funcionário:", err);
        res.status(500).json({ error: "Erro ao atribuir atividade." });
    } finally {
        if (connection) connection.release();
    }
});



// Rota para buscar detalhes de uma atividade de gerenciamento
app.get("/api/management-activities/:id", authenticateToken, authorizePermission('management.view.activities'), async (req, res) => {
    console.log('API: /api/management-activities/:id (GET) - INÍCIO');
    const { id } = req.params;
    let connection;
    try {
        connection = await db.promise().getConnection();
        const [activity] = await connection.query(
            `SELECT id, employee_id, descricao, data_limite, status
             FROM management_activities WHERE id = ?`,
            [id]
        );
        if (activity.length === 0) {
            return res.status(404).json({ error: "Atividade não encontrada." });
        }
        res.json(activity[0]);
    } finally {
        if (connection) connection.release();
    }
});

// Rota para editar uma atividade de gerenciamento
app.put("/api/management-activities/:id", authenticateToken, authorizePermission('management.edit.activity'), async (req, res) => {
    console.log('API: /api/management-activities/:id (PUT) - INÍCIO');
    const { id } = req.params;
    const { descricao, data_limite } = req.body;
    const userId = req.user.id;

    if (!descricao || !data_limite) {
        return res.status(400).json({ error: "Descrição e data limite são obrigatórios." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        const [result] = await connection.query(
            `UPDATE management_activities SET descricao = ?, data_limite = ? WHERE id = ?`,
            [descricao, data_limite, id]
        );
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Atividade não encontrada." });
        }
        await connection.commit();
        res.json({ message: "Atividade atualizada com sucesso!" });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao editar atividade de gerenciamento:", err);
        res.status(500).json({ error: "Erro ao editar atividade de gerenciamento." });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para excluir uma atividade de gerenciamento
app.delete("/api/management-activities/:id", authenticateToken, authorizePermission('management.delete.activity'), async (req, res) => {
    console.log('API: /api/management-activities/:id (DELETE) - INÍCIO');
    const { id } = req.params;
    let connection;
    try {
        connection = await db.promise().getConnection();
        const [result] = await connection.query("DELETE FROM management_activities WHERE id = ?", [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Atividade não encontrada." });
        }
        res.json({ message: "Atividade excluída com sucesso!" });
    } catch (err) {
        console.error("Erro ao excluir atividade de gerenciamento:", err);
        res.status(500).json({ error: "Erro ao excluir atividade de gerenciamento." });
    } finally {
        if (connection) connection.release();
    }
});



// ===============================================
// ROTAS PARA CRONÔMETRO DE ATIVIDADES DE GERENCIAMENTO
// ===============================================

// Rota para buscar todos os timers ativos de atividades de gerenciamento
app.get("/api/employee-timers/active", authenticateToken, authorizePermission('management.view.assigned'), async (req, res) => {
    console.log('API: /api/employee-timers/active (GET) - INÍCIO');
    let connection;
    try {
        connection = await db.promise().getConnection();
        const [timers] = await connection.query(`
            SELECT
                et.employee_id,
                et.activity_id,
                et.status,
                et.tempo_acumulado_ms,
                et.ultimo_inicio_timestamp
            FROM employee_activity_timers et
            WHERE et.status = 'running' OR et.tempo_acumulado_ms > 0
        `);
        res.json(timers);
        console.log('API: /api/employee-timers/active (GET) - FIM (Sucesso)');
    } catch (err) {
        console.error('API: /api/employee-timers/active (GET) - Erro:', err);
        res.status(500).json({ error: 'Erro ao buscar timers ativos de funcionários.' });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para iniciar cronômetro de atividade de gerenciamento
app.post("/api/timers/activities/start", authenticateToken, authorizePermission('management.manage.timer'), async (req, res) => {
    console.log('API: /api/timers/activities/start (POST) - INÍCIO');
    const { employee_id, activity_id, tempo_acumulado_ms, ultimo_inicio_timestamp: raw_ultimo_inicio_timestamp } = req.body;
    const operador_id = req.user.id;

    if (!employee_id || !activity_id || tempo_acumulado_ms === undefined || raw_ultimo_inicio_timestamp === undefined) {
        return res.status(400).json({ error: 'Dados incompletos para iniciar o cronômetro.' });
    }

    let formatted_ultimo_inicio_timestamp = null;
    try {
        const dateObj = new Date(raw_ultimo_inicio_timestamp);
        if (isNaN(dateObj.getTime())) {
            throw new Error("Data de início inválida.");
        }
        // Correção no formato de data para o MySQL
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        const hours = String(dateObj.getHours()).padStart(2, '0');
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');
        const seconds = String(dateObj.getSeconds()).padStart(2, '0');
        formatted_ultimo_inicio_timestamp = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

    } catch (e) {
        console.error("Erro de formatação de data para ultimo_inicio_timestamp:", e);
        return res.status(400).json({ error: "Formato de data de início inválido." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();

        const sql = `
            INSERT INTO employee_activity_timers
              (employee_id, activity_id, status, tempo_acumulado_ms, ultimo_inicio_timestamp, operador_id)
            VALUES (?, ?, 'running', ?, STR_TO_DATE(?, '%d/%m/%Y %H:%i:%s'), ?)
            ON DUPLICATE KEY UPDATE
              status = 'running',
              tempo_acumulado_ms = VALUES(tempo_acumulado_ms),
              ultimo_inicio_timestamp = VALUES(ultimo_inicio_timestamp),
              operador_id = VALUES(operador_id)
        `;

        await connection.query(sql, [employee_id, activity_id, tempo_acumulado_ms, formatted_ultimo_inicio_timestamp, operador_id]);

        console.log(`API: /api/timers/activities/start - Cronômetro para funcionário ${employee_id} e atividade ${activity_id} iniciado/atualizado.`);
        res.status(200).json({ message: 'Cronômetro iniciado com sucesso.' });

    } catch (err) {
        console.error('API: /api/timers/activities/start - Erro:', err);
        if (err.sqlMessage) console.error('SQL Error Message:', err.sqlMessage);
        res.status(500).json({ error: 'Erro ao iniciar cronômetro.' });
    } finally {
        if (connection) connection.release();
    }
});



// Rota para parar/resetar cronômetro de atividade de gerenciamento
app.post("/api/timers/activities/stop", authenticateToken, authorizePermission('management.manage.timer'), async (req, res) => {
    console.log('API: /api/timers/activities/stop (POST) - INÍCIO');
    const { employee_id, activity_id } = req.body;

    if (!employee_id || !activity_id) {
        return res.status(400).json({ error: 'Dados incompletos para parar o cronômetro.' });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // Remove o timer ativo
        const [result] = await connection.query(
            `DELETE FROM employee_activity_timers WHERE employee_id = ? AND activity_id = ?`,
            [employee_id, activity_id]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Cronômetro não encontrado.' });
        }

        // NOVO: Exclui os comentários do colaborador e do líder
        await connection.query(
            `UPDATE management_activities SET comentarios = NULL, leader_comments = NULL WHERE id = ?`,
            [activity_id]
        );
        
        await connection.commit();
        res.status(200).json({ message: 'Cronômetro resetado e comentários excluídos com sucesso.' });
        console.log('API: /api/timers/activities/stop (POST) - FIM (Sucesso)');
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('API: /api/timers/activities/stop - Erro:', err);
        res.status(500).json({ error: 'Erro ao parar cronômetro.' });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para salvar tempo trabalhado em atividade de gerenciamento
app.post("/api/timers/activities/save", authenticateToken, authorizePermission('management.manage.timer'), async (req, res) => {
    console.log('API: /api/timers/activities/save (POST) - INÍCIO');
    const { employee_id, activity_id, tempo_trabalhado_ms } = req.body;

    if (!employee_id || !activity_id || tempo_trabalhado_ms === undefined) {
        return res.status(400).json({ error: 'Dados incompletos para salvar o tempo.' });
    }

    const horas_trabalhadas = (tempo_trabalhado_ms / (1000 * 60 * 60)); // Converte ms para horas decimais

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // Acumula o tempo na tabela management_activities
        await connection.query(
            `UPDATE management_activities SET horas_trabalhadas = horas_trabalhadas + ? WHERE id = ?`,
            [horas_trabalhadas, activity_id]
        );

        // Remove o timer ativo
        await connection.query(
            `DELETE FROM employee_activity_timers WHERE employee_id = ? AND activity_id = ?`,
            [employee_id, activity_id]
        );

        await connection.commit();
        res.status(200).json({ message: 'Tempo salvo com sucesso.', horas_trabalhadas: horas_trabalhadas });
        console.log('API: /api/timers/activities/save (POST) - FIM (Sucesso)');
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('API: /api/timers/activities/save - Erro:', err);
        res.status(500).json({ error: 'Erro ao salvar tempo trabalhado.' });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para concluir atividade de gerenciamento e sincronizar com sub-etapa
app.post("/api/timers/activities/complete", authenticateToken, authorizePermission('management.manage.timer'), async (req, res) => {
    console.log('API: /api/timers/activities/complete (POST) - INÍCIO');
    const { employee_id, activity_id, tempo_trabalhado_ms } = req.body;
    const userId = req.user.id; // Usuário que está executando a ação (logado)

    if (!employee_id || !activity_id || tempo_trabalhado_ms === undefined) {
        return res.status(400).json({ error: 'Dados incompletos para concluir a atividade.' });
    }

    const horas_trabalhadas = (tempo_trabalhado_ms / (1000 * 60 * 60));

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // --- INÍCIO DA MODIFICAÇÃO ---
        const [activityDetails] = await connection.query(
            `SELECT sub_etapa_id, descricao FROM management_activities WHERE id = ?`,
            [activity_id]
        );
        const subEtapaId = activityDetails.length > 0 ? activityDetails[0].sub_etapa_id : null;
        const activityDescription = activityDetails.length > 0 ? activityDetails[0].descricao : '';
        // --- FIM DA MODIFICAÇÃO ---

        await connection.query(
            `UPDATE management_activities SET horas_trabalhadas = horas_trabalhadas + ? WHERE id = ?`,
            [horas_trabalhadas, activity_id]
        );

        await connection.query(
            `UPDATE management_activities SET status = 'Concluida', data_conclusao = NOW() WHERE id = ?`,
            [activity_id]
        );

        if (subEtapaId) {
            await connection.query(
                `UPDATE sub_etapas SET concluida = 1, data_conclusao = NOW(), concluido_por_usuario_id = ? WHERE id = ?`,
                [employee_id, subEtapaId]
            );

            // --- INÍCIO DA MODIFICAÇÃO ---
            // Se for uma atividade de compra, atualiza a data_compra
            if (activityDescription.startsWith('Comprar:')) {
                await connection.query(
                    `UPDATE sub_etapas SET data_compra = CURDATE() WHERE id = ?`,
                    [subEtapaId]
                );
                console.log(`Atividade de compra (sub_etapa_id: ${subEtapaId}) concluída. Data da compra registrada.`);
            }
            // --- FIM DA MODIFICAÇÃO ---
        }

        await connection.query(
            `DELETE FROM employee_activity_timers WHERE employee_id = ? AND activity_id = ?`,
            [employee_id, activity_id]
        );

        await connection.commit();
        res.status(200).json({ message: 'Atividade concluída com sucesso.', horas_trabalhadas: horas_trabalhadas });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('API: /api/timers/activities/complete - Erro:', err);
        res.status(500).json({ error: 'Erro ao concluir atividade.' });
    } finally {
        if (connection) connection.release();
    }
});


// Rota para reabrir uma atividade de gerenciamento (marcar como 'Pendente')
app.put("/api/management-activities/:id/reopen", authenticateToken, authorizePermission('management.edit.activity'), async (req, res) => {
    console.log('API: /api/management-activities/:id/reopen (PUT) - INÍCIO');
    const { id } = req.params;

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // ***** INÍCIO DA MODIFICAÇÃO *****
        // 1. Busca o ID da atividade original do projeto
        const [activityDetails] = await connection.query(
            `SELECT projeto_atividade_id FROM management_activities WHERE id = ?`,
            [id]
        );
        const projetoAtividadeId = activityDetails.length > 0 ? activityDetails[0].projeto_atividade_id : null;

        // 2. Reabre a atividade de gerenciamento
        const [result] = await connection.query(
            `UPDATE management_activities SET status = 'Pendente', data_conclusao = NULL WHERE id = ?`,
            [id]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Atividade não encontrada." });
        }

        // 3. Se houver um vínculo, reabre a atividade original do projeto também
        if (projetoAtividadeId) {
            await connection.query(
                `UPDATE projeto_atividades SET concluida = 0, data_conclusao = NULL WHERE id = ?`,
                [projetoAtividadeId]
            );
        }
        // ***** FIM DA MODIFICAÇÃO *****
        
        await connection.commit();
        res.json({ message: "Atividade reaberta com sucesso!" });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao reabrir atividade de gerenciamento:", err);
        res.status(500).json({ error: "Erro ao reabrir atividade de gerenciamento." });
    } finally {
        if (connection) connection.release();
    }
});

// ===============================================
// Rotas de Gerenciamento de Níveis de Acesso e Permissões (NOVO)
// ===============================================

// Rota para buscar todas as permissões disponíveis
app.get("/api/permissions", authenticateToken, authorizePermission('permissions.view'), async (req, res) => {
    let connection;
    try {
        connection = await db.promise().getConnection();
        const [permissions] = await connection.query('SELECT id, chave, descricao FROM permissoes ORDER BY chave');
        res.json(permissions);
    } catch (err) {
        console.error("Erro ao buscar permissões:", err);
        res.status(500).json({ error: "Erro ao buscar permissões." });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para criar um novo nível de acesso com permissões
app.post("/api/roles", authenticateToken, authorizePermission('user.create'), async (req, res) => {
    const { nome, permissionIds } = req.body;

    if (!nome || !Array.isArray(permissionIds)) {
        return res.status(400).json({ error: "Nome do nível de acesso e um array de IDs de permissão são obrigatórios." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // Insere o novo nível de acesso
        const [roleResult] = await connection.query('INSERT INTO niveis_acesso (nome) VALUES (?)', [nome]);
        const newRoleId = roleResult.insertId;

        // Insere as permissões associadas
        if (permissionIds.length > 0) {
            const permissionValues = permissionIds.map(permissionId => [newRoleId, permissionId]);
            await connection.query('INSERT INTO nivel_acesso_permissoes (nivel_acesso_id, permissao_id) VALUES ?', [permissionValues]);
        }

        await connection.commit();
        res.status(201).json({ message: "Nível de acesso criado com sucesso!", id: newRoleId });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao criar nível de acesso:", err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: `O nível de acesso '${nome}' já existe.` });
        }
        res.status(500).json({ error: "Erro ao criar nível de acesso." });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para buscar as permissões de um nível de acesso específico
app.get("/api/roles/:roleId/permissions", authenticateToken, async (req, res) => {
    const { roleId } = req.params;
    let connection;
    try {
        connection = await db.promise().getConnection();
        const [permissions] = await connection.query(
            `SELECT p.chave FROM nivel_acesso_permissoes nap JOIN permissoes p ON nap.permissao_id = p.id WHERE nap.nivel_acesso_id = ?`,
            [roleId]
        );
        const permissionKeys = permissions.map(p => p.chave);
        res.json(permissionKeys);
    } catch (err) {
        console.error("Erro ao buscar permissões do nível de acesso:", err);
        res.status(500).json({ error: "Erro ao buscar permissões do nível de acesso." });
    } finally {
        if (connection) connection.release();
    }
});

// ========================================================
// ADIÇÃO DE ROTAS PARA EDITAR NÍVEIS DE ACESSO
// ========================================================

// Rota para buscar todos os níveis de acesso (ID e nome)
app.get("/api/roles", authenticateToken, authorizePermission('user.view'), async (req, res) => {
    let connection;
    try {
        connection = await db.promise().getConnection();
        const [roles] = await connection.query('SELECT id, nome FROM niveis_acesso ORDER BY nome');
        res.json(roles);
    } catch (err) {
        console.error("Erro ao buscar níveis de acesso:", err);
        res.status(500).json({ error: "Erro ao buscar níveis de acesso." });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para buscar um nível de acesso específico com suas permissões
app.get("/api/roles/:id", authenticateToken, authorizePermission('user.view'), async (req, res) => {
    const { id } = req.params;
    let connection;
    try {
        connection = await db.promise().getConnection();
        
        // Busca o nome do nível
        const [roleResult] = await connection.query('SELECT id, nome FROM niveis_acesso WHERE id = ?', [id]);
        if (roleResult.length === 0) {
            return res.status(404).json({ error: "Nível de acesso não encontrado." });
        }
        
        // Busca os IDs das permissões associadas
        const [permissionsResult] = await connection.query('SELECT permissao_id FROM nivel_acesso_permissoes WHERE nivel_acesso_id = ?', [id]);
        const permissionIds = permissionsResult.map(p => p.permissao_id);

        res.json({
            ...roleResult[0],
            permissionIds: permissionIds
        });

    } catch (err) {
        console.error(`Erro ao buscar nível de acesso ${id}:`, err);
        res.status(500).json({ error: "Erro ao buscar detalhes do nível de acesso." });
    } finally {
        if (connection) connection.release();
    }
});


// Rota para atualizar um nível de acesso
app.put("/api/roles/:id", authenticateToken, authorizePermission('user.edit.any'), async (req, res) => {
    const { id } = req.params;
    const { nome, permissionIds } = req.body;

    if (!nome || !Array.isArray(permissionIds)) {
        return res.status(400).json({ error: "Nome e um array de IDs de permissão são obrigatórios." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // 1. Atualiza o nome do nível de acesso
        // CORREÇÃO: Altera 'roles' para 'niveis_acesso'
        await connection.query('UPDATE niveis_acesso SET nome = ? WHERE id = ?', [nome, id]);

        // 2. Remove todas as permissões antigas para este nível
        // CORREÇÃO: Altera 'role_permissions' para 'nivel_acesso_permissoes'
        await connection.query('DELETE FROM nivel_acesso_permissoes WHERE nivel_acesso_id = ?', [id]);

        // 3. Insere as novas permissões, se houver alguma
        if (permissionIds.length > 0) {
            const permissionValues = permissionIds.map(permissionId => [id, permissionId]);
            // CORREÇÃO: Altera 'role_permissions' para 'nivel_acesso_permissoes'
            await connection.query('INSERT INTO nivel_acesso_permissoes (nivel_acesso_id, permissao_id) VALUES ?', [permissionValues]);
        }

        await connection.commit();
        res.json({ message: "Nível de acesso atualizado com sucesso!" });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error(`Erro ao atualizar nível de acesso ${id}:`, err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: `O nível de acesso '${nome}' já existe.` });
        }
        res.status(500).json({ error: "Erro ao atualizar nível de acesso." });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para excluir um nível de acesso e reatribuir usuários
app.delete("/api/roles/:id", authenticateToken, authorizePermission('user.delete'), async (req, res) => {
    const idToDelete = parseInt(req.params.id);

    // Medida de segurança: impede a exclusão dos 7 primeiros níveis padrão
    if (idToDelete <= 7) {
        return res.status(403).json({ error: "Não é permitido excluir os níveis de acesso padrão do sistema." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // 1. Encontrar o próximo nível de acesso para mover os usuários
        let [nextRole] = await connection.query(
            'SELECT id FROM niveis_acesso WHERE id > ? ORDER BY id ASC LIMIT 1', 
            [idToDelete]
        );
        
        let fallbackRoleId;
        
        if (nextRole.length > 0) {
            fallbackRoleId = nextRole[0].id;
        } else {
            // Se não houver um próximo (é o último), usa o 'Visualização' como fallback
            let [visualizationRole] = await connection.query(
                "SELECT id FROM niveis_acesso WHERE nome = 'Visualização' LIMIT 1"
            );
            if (visualizationRole.length === 0) {
                // Caso extremo onde nem 'Visualização' existe.
                throw new Error("Nível de acesso 'Visualização' para fallback não foi encontrado.");
            }
            fallbackRoleId = visualizationRole[0].id;
        }

        // 2. Reatribuir todos os usuários do nível a ser excluído para o nível de fallback
        await connection.query(
            'UPDATE usuarios SET nivel_acesso_id = ? WHERE nivel_acesso_id = ?',
            [fallbackRoleId, idToDelete]
        );

        // 3. Excluir o nível de acesso
        const [deleteResult] = await connection.query('DELETE FROM niveis_acesso WHERE id = ?', [idToDelete]);

        if (deleteResult.affectedRows === 0) {
            throw new Error("O nível de acesso não foi encontrado para exclusão.");
        }

        await connection.commit();
        res.json({ message: `Nível de acesso excluído com sucesso! Usuários foram movidos para o nível de acesso ID ${fallbackRoleId}.` });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error(`Erro ao excluir nível de acesso ${idToDelete}:`, err);
        res.status(500).json({ error: err.message || "Erro ao excluir o nível de acesso." });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para LISTAR usuários com acesso a um projeto
app.get("/api/projetos/:projectId/permissions", authenticateToken, authorizePermission('user.edit.any'), async (req, res) => {
    const { projectId } = req.params;
    let connection;
    try {
        connection = await db.promise().getConnection();
        const [users] = await connection.query(
            `SELECT u.id, u.nome, u.username 
             FROM usuarios u 
             JOIN usuario_projeto_permissoes upp ON u.id = upp.usuario_id 
             WHERE upp.projeto_id = ?`,
            [projectId]
        );
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar permissões do projeto." });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para CONCEDER acesso a um usuário em um projeto
app.post("/api/projetos/:projectId/permissions", authenticateToken, authorizePermission('user.edit.any'), async (req, res) => {
    const { projectId } = req.params;
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).json({ error: "O ID do usuário é obrigatório." });
    }
    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.query(
            "INSERT INTO usuario_projeto_permissoes (usuario_id, projeto_id) VALUES (?, ?)",
            [userId, projectId]
        );
        res.status(201).json({ message: "Permissão concedida com sucesso!" });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Este usuário já tem acesso a este projeto.' });
        }
        res.status(500).json({ error: "Erro ao conceder permissão." });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para REVOGAR acesso de um usuário a um projeto
app.delete("/api/projetos/:projectId/permissions/:userId", authenticateToken, authorizePermission('user.edit.any'), async (req, res) => {
    const { projectId, userId } = req.params;
    let connection;
    try {
        connection = await db.promise().getConnection();
        const [result] = await connection.query(
            "DELETE FROM usuario_projeto_permissoes WHERE usuario_id = ? AND projeto_id = ?",
            [userId, projectId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Permissão não encontrada para este usuário/projeto.' });
        }
        res.json({ message: "Permissão revogada com sucesso!" });
    } catch (err) {
        res.status(500).json({ error: "Erro ao revogar permissão." });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para buscar as permissões de projeto de um usuário específico
app.get("/api/users/:userId/project-permissions", authenticateToken, authorizePermission('user.view'), async (req, res) => {
    const { userId } = req.params;
    let connection;
    try {
        connection = await db.promise().getConnection();
        const [permissions] = await connection.query(
            `SELECT projeto_id FROM usuario_projeto_permissoes WHERE usuario_id = ?`,
            [userId]
        );
        // Retorna apenas um array de IDs para facilitar no frontend
        const projectIds = permissions.map(p => p.projeto_id);
        res.json(projectIds);
    } catch (err) {
        console.error("Erro ao buscar permissões de projeto do usuário:", err);
        res.status(500).json({ error: "Erro ao buscar permissões de projeto do usuário." });
    } finally {
        if (connection) connection.release();
    }
});


// ---------------------------------------------------------------
// Rota para CRIAR um novo setor em uma etapa
app.post("/api/etapas/:etapaId/setores", authenticateToken, authorizePermission('project.edit'), async (req, res) => {
    const { etapaId } = req.params;
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: "O nome do setor é obrigatório." });

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        const [etapaData] = await connection.query("SELECT projeto_id FROM projeto_etapas WHERE id = ?", [etapaId]);
        if (etapaData.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Etapa não encontrada." });
        }
        const projetoId = etapaData[0].projeto_id;

        const [maxOrder] = await connection.query("SELECT MAX(ordem) as max_ordem FROM setores WHERE projeto_etapa_id = ?", [etapaId]);
        const newOrder = (maxOrder[0].max_ordem || 0) + 1;

        const [result] = await connection.query(
            "INSERT INTO setores (projeto_etapa_id, projeto_id, nome, ordem) VALUES (?, ?, ?, ?)",
            [etapaId, projetoId, nome, newOrder]
        );
        
        await connection.commit();
        res.status(201).json({ message: "Setor criado com sucesso!", id: result.insertId });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao criar setor:", err);
        res.status(500).json({ error: "Erro ao criar setor." });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para EDITAR um setor
app.put("/api/setores/:id", authenticateToken, authorizePermission('project.edit'), async (req, res) => {
    const { id } = req.params;
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: "O nome do setor é obrigatório." });

    let connection;
    try {
        connection = await db.promise().getConnection();
        const [result] = await connection.query("UPDATE setores SET nome = ? WHERE id = ?", [nome, id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: "Setor não encontrado." });
        res.json({ message: "Setor atualizado com sucesso!" });
    } catch (err) {
        console.error("Erro ao atualizar setor:", err);
        res.status(500).json({ error: "Erro ao atualizar setor." });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para EXCLUIR um setor
app.delete("/api/setores/:id", authenticateToken, authorizePermission('project.edit'), async (req, res) => {
    const { id } = req.params;
    let connection;
    try {
        connection = await db.promise().getConnection();
        const [result] = await connection.query("DELETE FROM setores WHERE id = ?", [id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: "Setor não encontrado." });
        res.json({ message: "Setor e todas as suas sub-etapas foram excluídos com sucesso!" });
    } catch (err) {
        console.error("Erro ao excluir setor:", err);
        res.status(500).json({ error: "Erro ao excluir setor." });
    } finally {
        if (connection) connection.release();
    }
});

// Em server.js, ADICIONE esta NOVA rota para adicionar sub-etapas a um SETOR
app.post("/api/setores/:setorId/sub_etapas", authenticateToken, authorizePermission('project.edit'), async (req, res) => {
    const { setorId } = req.params;
    const { descricao, data_prevista_conclusao } = req.body;
    const { id: userId } = req.user;

    if (!descricao) return res.status(400).json({ error: "Descrição da sub-etapa é obrigatória." });

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        const [setorData] = await connection.query("SELECT projeto_id, projeto_etapa_id FROM setores WHERE id = ?", [setorId]);
        if (setorData.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Setor não encontrado." });
        }
        const { projeto_id, projeto_etapa_id } = setorData[0];

        const dataPrevistaFormatted = data_prevista_conclusao ? data_prevista_conclusao.split('/').reverse().join('-') : null;

        const [result] = await connection.query(
            "INSERT INTO sub_etapas (projeto_id, projeto_etapa_id, setor_id, descricao, data_prevista_conclusao, criado_por_usuario_id) VALUES (?, ?, ?, ?, ?, ?)",
            [projeto_id, projeto_etapa_id, setorId, descricao, dataPrevistaFormatted, userId]
        );

        await connection.commit();
        res.status(201).json({ message: "Sub-etapa adicionada com sucesso!", id: result.insertId });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao adicionar sub-etapa:", err);
        res.status(500).json({ error: "Erro ao adicionar sub-etapa." });
    } finally {
        if (connection) connection.release();
    }
});

// NOVA ROTA: Salvar uma resposta do formulário NPS
app.post("/api/nps-responses", authenticateToken, async (req, res) => {
    const {
        projectId,
        formType,
        responses,
        comments
    } = req.body;
    const userId = req.user.id;

    if (!projectId || !formType || !responses) {
        return res.status(400).json({ error: "Dados incompletos para salvar a resposta." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        const sql = `
            INSERT INTO nps_responses 
            (projeto_id, form_type, q1_score, q2_score, q3_score, q4_score, q5_score, q6_score, q7_score, q8_score, q9_score, comments, submitted_by_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            projectId,
            formType,
            responses['q1'] || null,
            responses['q2'] || null,
            responses['q3'] || null,
            responses['q4'] || null,
            responses['q5'] || null,
            responses['q6'] || null,
            responses['q7'] || null,
            responses['q8'] || null,
            responses['q9'] || null,
            comments,
            userId
        ];
        
        await connection.query(sql, params);
        res.status(201).json({ message: "Pesquisa enviada com sucesso!" });

    } catch (err) {
        console.error("Erro ao salvar resposta NPS:", err);
        res.status(500).json({ error: "Erro interno ao salvar a resposta." });
    } finally {
        if (connection) connection.release();
    }
});

// ROTA ADICIONADA: Buscar respostas NPS existentes para um projeto
app.get("/api/projetos/:projectId/nps-responses", authenticateToken, authorizePermission('project.view.status'), async (req, res) => {
    const { projectId } = req.params;
    let connection;
    try {
        connection = await db.promise().getConnection();
        const [responses] = await connection.query(
            "SELECT * FROM nps_responses WHERE projeto_id = ?",
            [projectId]
        );
        res.json(responses);
    } catch (err) {
        console.error("Erro ao buscar respostas NPS:", err);
        res.status(500).json({ error: "Erro ao buscar respostas da pesquisa." });
    } finally {
        if (connection) connection.release();
    }
});



// NOVA ROTA: Para visualizar o conteúdo de um arquivo de compras como HTML
app.get("/api/shopping-file/:fileId/view", authenticateToken, authorizePermission('project.manage.shopping'), async (req, res) => {
    const { fileId } = req.params;

    let connection;
    try {
        connection = await db.promise().getConnection();
        
        // Busca os itens da BOM associados ao arquivo
        const [items] = await connection.query("SELECT * FROM bom_items WHERE shopping_file_id = ?", [fileId]);

        if (items.length === 0) {
            return res.status(404).json({ error: "Nenhum item de compra encontrado para este arquivo." });
        }

        // LINHA CORRETA: Envia um objeto JSON com a chave "bomItems"
        res.json({ bomItems: items });

    } catch (err) {
        console.error("Erro ao buscar itens do arquivo para visualização:", err);
        res.status(500).json({ error: "Erro ao processar o arquivo para visualização." });
    } finally {
        if (connection) connection.release();
    }
});

// ROTA ADICIONADA: Excluir uma resposta NPS específica (por tipo de formulário)
app.delete("/api/projetos/:projectId/nps-responses/:formType", authenticateToken, authorizePermission('nps.delete.response'), async (req, res) => {
    const { projectId, formType } = req.params;
    const { id: userId } = req.user;

    if (!['encomendante', 'usuario_final'].includes(formType)) {
        return res.status(400).json({ error: "Tipo de formulário inválido." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        const [result] = await connection.query(
            "DELETE FROM nps_responses WHERE projeto_id = ? AND form_type = ?",
            [projectId, formType]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Nenhuma resposta encontrada para este formulário e projeto." });
        }
        
        // Atualiza o timestamp do projeto
        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userId, projectId]
        );

        await connection.commit();
        res.json({ message: `Resposta do formulário '${formType}' excluída com sucesso!` });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error(`Erro ao excluir resposta NPS para o projeto ${projectId}:`, err);
        res.status(500).json({ error: "Erro ao excluir a resposta da pesquisa." });
    } finally {
        if (connection) connection.release();
    }
});


// ===============================================
// INÍCIO: NOVAS ROTAS PARA GERENCIAMENTO DE BOM VIA FORMULÁRIO
// ===============================================

app.get("/api/projetos/:projectId/bom-items", authenticateToken, authorizePermission('project.manage.shopping'), async (req, res) => {
    const projetoId = req.params.projectId;
    
    let connection;
    try {
        connection = await db.promise().getConnection();

        // ##### QUERY OTIMIZADA USANDO CTE (Common Table Expression) E FUNÇÕES DE JANELA (MySQL 8.0+) #####
        const [bomItems] = await connection.query(`
            WITH RankedLogs AS (
                SELECT
                    bal.bom_item_id,
                    CONCAT(bal.usuario_nome, '|', bal.timestamp) AS info,
                    bal.etapa,
                    bal.acao,
                    -- Ranking para as ações MAIS RECENTES (ÚLTIMO Aprovado/Selecionado)
                    ROW_NUMBER() OVER (
                        PARTITION BY bal.bom_item_id, bal.etapa, bal.acao
                        ORDER BY bal.timestamp DESC
                    ) AS rn_desc,
                    -- Ranking para as ações MAIS ANTIGAS (PRIMEIRO Solicitado)
                    ROW_NUMBER() OVER (
                        PARTITION BY bal.bom_item_id, bal.etapa, bal.acao
                        ORDER BY bal.timestamp ASC
                    ) AS rn_asc,
                    -- Ranking para a ÚLTIMA Reprovação (em qualquer etapa)
                    ROW_NUMBER() OVER (
                        PARTITION BY bal.bom_item_id
                        ORDER BY CASE WHEN bal.acao = 'Reprovado' THEN bal.timestamp ELSE NULL END DESC
                    ) AS rn_reprovado_desc
                FROM bom_approval_log bal
            )
            SELECT 
                b.*, 
                p.nome AS nome_projeto,
                
                -- Solicitante (PRIMEIRO 'Solicitado' de 'Solicitante')
                MAX(CASE 
                    WHEN rl.etapa = 'Solicitante' AND rl.acao = 'Solicitado' AND rl.rn_asc = 1
                    THEN rl.info
                END) AS solicitante_info,
                
                -- Líder (ÚLTIMO 'Aprovado' de 'Líder')
                MAX(CASE 
                    WHEN rl.etapa = 'Líder' AND rl.acao = 'Aprovado' AND rl.rn_desc = 1
                    THEN rl.info
                END) AS lider_info,
                
                -- Gestor (ÚLTIMO 'Aprovado' de 'Gestor')
                MAX(CASE 
                    WHEN rl.etapa = 'Gestor' AND rl.acao = 'Aprovado' AND rl.rn_desc = 1
                    THEN rl.info
                END) AS gestor_info,
                
                -- Cotação (ÚLTIMO 'Cotação Selecionada' de 'Cotação')
                MAX(CASE 
                    WHEN rl.etapa = 'Cotação' AND rl.acao = 'Cotação Selecionada' AND rl.rn_desc = 1
                    THEN rl.info
                END) AS cotacao_info,
                
                -- Diretoria (ÚLTIMO 'Aprovado' de 'Diretoria')
                MAX(CASE 
                    WHEN rl.etapa = 'Diretoria' AND rl.acao = 'Aprovado' AND rl.rn_desc = 1
                    THEN rl.info
                END) AS diretor_info,
                
                -- Financeiro (ÚLTIMO 'Aprovado' de 'Financeiro')
                MAX(CASE 
                    WHEN rl.etapa = 'Financeiro' AND rl.acao = 'Aprovado' AND rl.rn_desc = 1
                    THEN rl.info
                END) AS financeiro_info,

                -- Reprovação (ÚLTIMO 'Reprovado' de QUALQUER etapa)
                MAX(CASE 
                    WHEN rl.acao = 'Reprovado' AND rl.rn_reprovado_desc = 1
                    THEN rl.info
                END) AS reprovador_info

            FROM bom_items b
            JOIN projetos p ON b.projeto_id = p.id
            LEFT JOIN RankedLogs rl ON rl.bom_item_id = b.id
            WHERE b.projeto_id = ? 
            GROUP BY b.id, p.nome 
            ORDER BY b.setor, b.id DESC;
        `, [projetoId]);
        // ##### FIM DA QUERY OTIMIZADA #####

        // O restante do código de processamento no Node.js é mantido inalterado.
        // Helper para parsear 'Nome|Data' ou retornar nulls
        const parseInfo = (infoString) => {
            if (!infoString) return { nome: null, data: null };
            const parts = infoString.split('|');
            if (parts.length >= 2) {
                 const nome = parts.slice(0, -1).join('|'); 
                 const data = parts[parts.length - 1];
                 // Verifica se a string de data parece um timestamp válido
                 return (nome && data && data.includes('-') && data.includes(':')) ? { nome, data } : { nome: null, data: null };
            }
            return { nome: null, data: null };
        };

        // Processa os resultados para formatar e extrair nomes/datas
        const processedItems = bomItems.map(item => {
            // Nota: Assumindo que parseJsonField está definido em algum lugar (ex: no server.js)
            const orcamentosArray = parseJsonField(item.orcamentos); 
            
            const solicitante = parseInfo(item.solicitante_info);
            const lider = parseInfo(item.lider_info);
            const gestor = parseInfo(item.gestor_info);
            const cotacao = parseInfo(item.cotacao_info);
            const diretor = parseInfo(item.diretor_info);
            const financeiro = parseInfo(item.financeiro_info);
            const reprovador = parseInfo(item.reprovador_info); 
            
            // Determina o nome e data final de aprovação/reprovação
            let nomeFinalizador = null;
            let dataFinalizador = null;
            
            // Se a última ação foi uma reprovação E ela é MAIS RECENTE que a última aprovação da diretoria
            if (reprovador.nome && (!diretor.data || new Date(reprovador.data) > new Date(diretor.data))) {
                 nomeFinalizador = reprovador.nome;
                 dataFinalizador = reprovador.data;
            } 
            // Se a última ação foi uma aprovação da diretoria
            else if (diretor.nome) {
                 nomeFinalizador = diretor.nome;
                 dataFinalizador = diretor.data;
            }

            return {
                ...item, 
                orcamentos: orcamentosArray,
                nome_solicitante: solicitante.nome,
                data_solicitante: solicitante.data, 
                nome_lider: lider.nome,
                data_lider: lider.data,
                nome_gestor: gestor.nome,
                data_gestor: gestor.data,
                nome_cotacao: cotacao.nome,
                data_cotacao: cotacao.data,
                nome_diretor: diretor.nome, 
                data_diretor: diretor.data, 
                nome_financeiro: financeiro.nome, // Adicionado campo para Financeiro
                data_financeiro: financeiro.data, // Adicionado campo para Financeiro
                nome_reprovador: reprovador.nome, // Adicionado campo para Reprovador
                data_reprovador: reprovador.data, // Adicionado campo para Reprovador
                nome_aprovador_final: nomeFinalizador, 
                data_aprovador_final: dataFinalizador 
            };
        });

        res.json(processedItems);

    } catch (err) {
        console.error("Erro ao buscar itens da BOM com detalhes de status (OTIMIZADO):", err);
        if (err.sql) {
            console.error("SQL com Erro:", err.sql);
        }
        res.status(500).json({ error: "Erro interno ao buscar itens da BOM com detalhes." });
    } finally {
        if (connection) connection.release();
    }
});

// ROTA para adicionar um novo item de BOM a um projeto
app.post("/api/projetos/:projectId/bom-items", authenticateToken, authorizePermission('bom.create'), async (req, res) => {
    const projetoId = req.params.projectId;
    const { 
        descricao, setor, quantidade, justificativa, url_imagem, 
        fornecedor, valor_unitario, link_produto, 
        data_previsao_entrega,
        cnpj, endereco, contato, email
    } = req.body;
    const solicitante_id = req.user.id;
    const solicitante_nome = req.user.nome;

    if (!descricao || !setor || !quantidade || !fornecedor || !valor_unitario) {
        return res.status(400).json({ error: "Campos obrigatórios do item não preenchidos." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        const orcamentos = [{
            fornecedor: fornecedor,
            valor_unitario: parseFloat(valor_unitario).toFixed(2), 
            link_produto: link_produto || null,
            data_previsao_entrega: data_previsao_entrega || null, 
            cnpj: cnpj || null,
            endereco: endereco || null,
            contato: contato || null,
            email: email || null,
            // ADICIONADO: Data do orçamento inicial
            data_orcamento: new Date().toISOString() 
        }];
        
        const orcamentosJson = JSON.stringify(orcamentos); 

        const insertQuery = `
            INSERT INTO bom_items 
            (projeto_id, descricao, setor, quantidade, justificativa, url_imagem, orcamentos, status, criado_por_usuario_id, link_produto) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Em Elaboração', ?, ?) 
        `;
        const [result] = await connection.query(insertQuery, [
            projetoId, descricao, setor, quantidade, justificativa, url_imagem || null, orcamentosJson, solicitante_id, link_produto || null
        ]);
        const newBomItemId = result.insertId;

        // ===== INÍCIO DA ATUALIZAÇÃO (LOG BOM) =====
        await logBomApproval(connection, newBomItemId, 'Solicitante', 'Solicitado', solicitante_id, solicitante_nome);
        // ===== FIM DA ATUALIZAÇÃO (LOG BOM) =====

        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [solicitante_id, projetoId]
        );

        const [projectNameResult] = await connection.query('SELECT nome FROM projetos WHERE id = ?', [projetoId]);
        const projectName = projectNameResult.length > 0 ? projectNameResult[0].nome : 'Projeto Desconhecido';
        
        await registrarAcao(
            connection, solicitante_id, solicitante_nome, 'CRIACAO', 'BOM Item', newBomItemId, 
            `Item BOM '${descricao}' (Qtd: ${quantidade}) adicionado ao projeto '${projectName}'.`
        );

        await connection.commit();
        res.status(201).json({ message: "Item BOM adicionado com sucesso!", itemId: newBomItemId });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao adicionar item BOM:", err);
        res.status(500).json({ error: "Erro interno ao adicionar item BOM." });
    } finally {
        if (connection) connection.release();
    }
});

// NOVA ROTA para ENVIAR uma lista de compras para aprovação
app.put("/api/projetos/:projectId/bom/submit", authenticateToken, authorizePermission('project.manage.shopping'), async (req, res) => {
    const { projectId } = req.params;
    const { id: userId } = req.user;

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // Atualiza todos os itens 'Em Elaboração' para 'Aguardando Aprovação Líder'
        const [result] = await connection.query(
            "UPDATE bom_items SET status = 'Aguardando Aprovação Líder' WHERE projeto_id = ? AND status = 'Em Elaboração'",
            [projectId]
        );

        // Se nenhum item foi atualizado (nenhum item estava 'Em Elaboração'), informa o usuário.
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Nenhum item em elaboração encontrado para ser enviado." });
        }

        // Atualiza o timestamp do projeto
        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userId, projectId]
        );
        
        await connection.commit();
        res.json({ message: `${result.affectedRows} item(ns) enviado(s) para aprovação com sucesso!` });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao enviar lista de compras:", err);
        res.status(500).json({ error: "Erro ao enviar lista de compras para aprovação." });
    } finally {
        if (connection) connection.release();
    }
});

// NOVA ROTA para ENVIAR uma lista de compras de um SETOR específico para aprovação
app.put("/api/projetos/:projectId/bom/submit-sector", authenticateToken, authorizePermission('project.manage.shopping'), async (req, res) => {
    const { projectId } = req.params;
    const { sector } = req.body; // Recebe o nome do setor no corpo da requisição
    const { id: userId } = req.user;

    if (!sector) {
        return res.status(400).json({ error: "O nome do setor é obrigatório." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // Atualiza todos os itens 'Em Elaboração' para 'Aguardando Aprovação Líder' APENAS do setor especificado
        const [result] = await connection.query(
            "UPDATE bom_items SET status = 'Aguardando Aprovação Líder' WHERE projeto_id = ? AND status = 'Em Elaboração' AND setor = ?",
            [projectId, sector]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: `Nenhum item em elaboração encontrado no setor '${sector}' para ser enviado.` });
        }

        // Atualiza o timestamp do projeto
        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userId, projectId]
        );
        
        await connection.commit();
        res.json({ message: `${result.affectedRows} item(ns) do setor '${sector}' enviado(s) para aprovação com sucesso!` });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao enviar lista de compras por setor:", err);
        res.status(500).json({ error: "Erro ao enviar lista de compras para aprovação." });
    } finally {
        if (connection) connection.release();
    }
});

// ROTA para adicionar um novo orçamento a um item da BOM
app.post("/api/bom-items/:itemId/quotes", authenticateToken, authorizePermission('project.manage.shopping'), async (req, res) => {
    const { itemId } = req.params;
    // ##### INÍCIO DA CORREÇÃO #####
    const { 
        fornecedor, valor_unitario, link_produto, data_previsao_entrega,
        cnpj, endereco, contato, email 
    } = req.body;
    // ##### FIM DA CORREÇÃO #####

    if (!fornecedor || valor_unitario === undefined) {
        return res.status(400).json({ error: "Fornecedor e Valor Unitário são obrigatórios." });
    }

    const newQuote = {
        fornecedor,
        valor_unitario: parseFloat(valor_unitario),
        link_produto: link_produto || null,
        data_orcamento: new Date().toISOString(),
        data_previsao_entrega: data_previsao_entrega || null,
        // ##### INÍCIO DA CORREÇÃO #####
        cnpj: cnpj || null,
        endereco: endereco || null,
        contato: contato || null,
        email: email || null
        // ##### FIM DA CORREÇÃO #####
    };

    let connection;
    try {
        connection = await db.promise().getConnection();
        // Utiliza JSON_ARRAY_APPEND para adicionar o novo orçamento ao array existente
        await connection.query(
            "UPDATE bom_items SET orcamentos = JSON_ARRAY_APPEND(IFNULL(orcamentos, JSON_ARRAY()), '$', CAST(? AS JSON)) WHERE id = ?",
            [JSON.stringify(newQuote), itemId] // Stringify explícito
        );

        res.status(201).json({ message: "Orçamento adicionado com sucesso!", newQuote });

    } catch (err) {
        console.error("Erro ao adicionar orçamento:", err);
        res.status(500).json({ error: "Erro ao adicionar orçamento." });
    } finally {
        if (connection) connection.release();
    }
});

// ROTA para aprovar um orçamento específico
app.put("/api/bom-items/:itemId/approve-quote", authenticateToken, authorizePermission('project.shopping.approve'), async (req, res) => {
    const { itemId } = req.params;
    const { quoteIndex } = req.body; // Recebe o índice do orçamento a ser aprovado

    if (quoteIndex === undefined) {
        return res.status(400).json({ error: "O índice do orçamento é obrigatório." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        
        // 1. Busca o item e seus orçamentos
        const [items] = await connection.query("SELECT orcamentos, quantidade FROM bom_items WHERE id = ?", [itemId]);
        if (items.length === 0 || !items[0].orcamentos) {
            return res.status(404).json({ error: "Item ou orçamentos não encontrados." });
        }
        const orcamentos = items[0].orcamentos;
        const selectedQuote = orcamentos[quoteIndex];

        if (!selectedQuote) {
            return res.status(400).json({ error: "Índice do orçamento inválido." });
        }

        // Calcula o valor total APROVADO: valor_unitario * quantidade do item
        const valorTotalItem = parseFloat(selectedQuote.valor_unitario) * parseFloat(items[0].quantidade);

        // 2. Atualiza o item com os dados selecionados E MANTÉM STATUS SEM ALTERAÇÃO
        await connection.query(
            "UPDATE bom_items SET fornecedor_aprovado = ?, valor_aprovado = ?, valor_total_item = ? WHERE id = ?",
            [selectedQuote.fornecedor, selectedQuote.valor_unitario, valorTotalItem, itemId]
        );

        res.json({ message: "Orçamento aprovado e item atualizado com sucesso!" });

    } catch (err) {
        console.error("Erro ao aprovar orçamento:", err);
        res.status(500).json({ error: "Erro ao aprovar orçamento." });
    } finally {
        if (connection) connection.release();
    }
});

// ===============================================
// INÍCIO: NOVAS ROTAS PARA EDITAR E EXCLUIR ITENS DA BOM
// ===============================================

// ROTA para ATUALIZAR um item de BOM existente
app.put("/api/bom-items/:itemId", authenticateToken, authorizePermission('bom.edit'), async (req, res) => {
    const itemId = req.params.itemId;
    const { 
        descricao, setor, quantidade, justificativa, url_imagem,
        // NOVO CAMPO: Contém a data formatada DD/MM/YYYY ou null
        data_previsao_entrega 
    } = req.body;
    const userId = req.user.id;
    const userName = req.user.nome;

    if (!descricao || !setor || !quantidade) {
        return res.status(400).json({ error: "Campos obrigatórios não preenchidos." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // 1. Busca o item existente para obter o campo orcamentos e o projeto_id
        const [existingItems] = await connection.query("SELECT orcamentos, projeto_id, descricao AS old_descricao FROM bom_items WHERE id = ?", [itemId]);
        if (existingItems.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Item de compra não encontrado." });
        }
        const { orcamentos: existingOrcamentosJson, projeto_id, old_descricao } = existingItems[0];
        
        // 2. Processa os orçamentos existentes (CORREÇÃO DE PARSE ROBUSTO)
        let orcamentosArray = [];
        let orcamentosString = existingOrcamentosJson;
        
        // Garante que a variável seja uma string para o JSON.parse
        if (typeof orcamentosString !== 'string') {
             orcamentosString = String(orcamentosString);
        }

        try {
            // Tenta parsear se a string não for o erro literal [object Object]
            if (orcamentosString && orcamentosString !== '[object Object]') {
                orcamentosArray = JSON.parse(orcamentosString);
            } else if (existingItems[0].orcamentos && typeof existingItems[0].orcamentos === 'object') {
                // Fallback: se o driver retornou um objeto JS, use-o diretamente
                 orcamentosArray = existingItems[0].orcamentos;
            }
        } catch (e) {
            console.error("Erro ao fazer parse do JSON de orçamentos (Tentativa 2):", e);
            // Em caso de erro, inicia com array vazio para não quebrar a aplicação
            orcamentosArray = [];
        }
        
        // Garante que é um array antes de prosseguir
        if (!Array.isArray(orcamentosArray)) {
             orcamentosArray = [];
        }

        // 3. Atualiza a data de previsão no PRIMEIRO orçamento (que é o da sugestão do solicitante)
        if (orcamentosArray.length > 0) {
            orcamentosArray[0].data_previsao_entrega = data_previsao_entrega || null;
        }
        
        const updatedOrcamentosJson = JSON.stringify(orcamentosArray);

        // 4. Constrói a query de atualização (REMOVIDO data_atualizacao = NOW() para evitar erro de coluna)
        const updateQuery = `
            UPDATE bom_items 
            SET descricao = ?, setor = ?, quantidade = ?, justificativa = ?, url_imagem = ?, orcamentos = ? 
            WHERE id = ?
        `;
        const updateValues = [
            descricao, setor, quantidade, justificativa, url_imagem || null, updatedOrcamentosJson, itemId
        ];

        await connection.query(updateQuery, updateValues);

        // 5. Atualiza a data de modificação do projeto
        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userId, projeto_id]
        );
        
        // 6. Log de Auditoria
        const [projectNameResult] = await connection.query('SELECT nome FROM projetos WHERE id = ?', [projeto_id]);
        const projectName = projectNameResult.length > 0 ? projectNameResult[0].nome : 'Projeto Desconhecido';
        
        await registrarAcao(
            connection, userId, userName, 'EDICAO', 'BOM Item', parseInt(itemId), 
            `Item BOM '${old_descricao}' (${descricao} - Qtd: ${quantidade}) editado no projeto '${projectName}'.`
        );

        await connection.commit();
        res.json({ message: "Item BOM atualizado com sucesso!" });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao editar item BOM:", err);
        res.status(500).json({ error: "Erro interno ao editar item BOM." });
    } finally {
        if (connection) connection.release();
    }
});

// ROTA para EXCLUIR um item de BOM
app.delete("/api/bom-items/:itemId", authenticateToken, authorizePermission('project.manage.shopping'), async (req, res) => {
    const { itemId } = req.params;
    const { id: userId } = req.user;
    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        
        // Pega o ID do projeto antes de deletar
        const [itemData] = await connection.query("SELECT projeto_id FROM bom_items WHERE id = ?", [itemId]);
        if (itemData.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Item da BOM não encontrado." });
        }
        const { projeto_id } = itemData[0];

        // Deleta o item
        await connection.query("DELETE FROM bom_items WHERE id = ?", [itemId]);

        // Atualiza o projeto
        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userId, projeto_id]
        );

        await connection.commit();
        res.json({ message: "Item excluído com sucesso." });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao excluir item da BOM:", err);
        res.status(500).json({ error: "Erro ao excluir item da BOM." });
    } finally {
        if (connection) connection.release();
    }
});

// ===============================================
// FIM: NOVAS ROTAS
// ===============================================

// ===============================================
// INÍCIO: NOVAS ROTAS PARA GERENCIAR ORÇAMENTOS
// ===============================================

// ROTA para buscar detalhes de um ÚNICO item da BOM (necessário para a edição)
app.get("/api/bom-items/:itemId/details", authenticateToken, authorizePermission('project.manage.shopping'), async (req, res) => {
    const { itemId } = req.params;
    let connection;
    try {
        connection = await db.promise().getConnection();
        const [items] = await connection.query("SELECT * FROM bom_items WHERE id = ?", [itemId]);
        if (items.length === 0) {
            return res.status(404).json({ error: "Item não encontrado." });
        }
        
        const item = items[0];
        // Normaliza o campo orcamentos para garantir que seja sempre um array
        let quotes = [];
        try {
            if (item.orcamentos) {
                quotes = typeof item.orcamentos === 'string' ? JSON.parse(item.orcamentos) : item.orcamentos;
            }
        } catch (e) {
            console.error("Erro ao parsear orçamentos do item:", item.id, e);
        }
        item.orcamentos = Array.isArray(quotes) ? quotes : [];

        res.json(item);
    } catch (err) {
        console.error("Erro ao buscar detalhes do item da BOM:", err);
        res.status(500).json({ error: "Erro ao buscar detalhes do item." });
    } finally {
        if (connection) connection.release();
    }
});

// ROTA para ATUALIZAR um orçamento específico de um item
app.put("/api/bom-items/:itemId/quotes/:quoteIndex", authenticateToken, authorizePermission('project.manage.shopping'), async (req, res) => {
    const { itemId, quoteIndex } = req.params;
    // ##### INÍCIO DA CORREÇÃO #####
    const { 
        fornecedor, valor_unitario, link_produto, data_previsao_entrega,
        cnpj, endereco, contato, email
    } = req.body;
    // ##### FIM DA CORREÇÃO #####

    if (!fornecedor || valor_unitario === undefined) {
        return res.status(400).json({ error: "Fornecedor e Valor Unitário são obrigatórios." });
    }

    const updatedQuote = {
        fornecedor,
        valor_unitario: parseFloat(valor_unitario),
        link_produto: link_produto || null,
        data_orcamento: new Date().toISOString(), // Atualiza a data da cotação
        data_previsao_entrega: data_previsao_entrega || null,
        // ##### INÍCIO DA CORREÇÃO #####
        cnpj: cnpj || null,
        endereco: endereco || null,
        contato: contato || null,
        email: email || null
        // ##### FIM DA CORREÇÃO #####
    };

    let connection;
    try {
        connection = await db.promise().getConnection();
        
        // JSON_SET substitui o valor no índice especificado
        const [result] = await connection.query(
            "UPDATE bom_items SET orcamentos = JSON_SET(orcamentos, '$[?]', CAST(? AS JSON)) WHERE id = ?",
            [parseInt(quoteIndex), JSON.stringify(updatedQuote), itemId] // Stringify explícito
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Item da BOM não encontrado." });
        }

        res.json({ message: "Orçamento atualizado com sucesso!" });
    } catch (err) {
        console.error("Erro ao atualizar orçamento:", err);
        res.status(500).json({ error: "Erro ao atualizar orçamento." });
    } finally {
        if (connection) connection.release();
    }
});

// ROTA para EXCLUIR um orçamento específico de um item
app.delete("/api/bom-items/:itemId/quotes/:quoteIndex", authenticateToken, authorizePermission('project.manage.shopping'), async (req, res) => {
    const { itemId, quoteIndex } = req.params;

    let connection;
    try {
        connection = await db.promise().getConnection();

        // JSON_REMOVE remove o elemento no índice especificado
        const [result] = await connection.query(
            "UPDATE bom_items SET orcamentos = JSON_REMOVE(orcamentos, '$[?]') WHERE id = ?",
            [parseInt(quoteIndex), itemId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Item da BOM não encontrado." });
        }

        res.json({ message: "Orçamento excluído com sucesso." });
    } catch (err) {
        console.error("Erro ao excluir orçamento:", err);
        res.status(500).json({ error: "Erro ao excluir orçamento." });
    } finally {
        if (connection) connection.release();
    }
});

// ===============================================
// FIM: NOVAS ROTAS PARA GERENCIAMENTO DE BOM VIA FORMULÁRIO
// ===============================================



// ROTA para o Painel de Cotações (Aquisições) buscar todos os itens pendentes
app.get("/api/cotacoes", authenticateToken, authorizePermission('acquisitions.view'), async (req, res) => {
    let connection;
    try {
        connection = await db.promise().getConnection();
       const [itemsParaCotar] = await connection.query(`
            SELECT 
                b.*,
                p.nome AS nome_projeto
            FROM bom_items b
            JOIN projetos p ON b.projeto_id = p.id
            WHERE b.status IN ('Em Cotação', 'Cotação Finalizada')
            ORDER BY p.nome, b.id;
        `);         
        // Garante que o campo 'orcamentos' seja sempre um array
        const processedItems = itemsParaCotar.map(item => {
            // CORREÇÃO APLICADA: Usa a função robusta para evitar o erro de parsing
            const quotes = parseJsonField(item.orcamentos);
            
            return { ...item, orcamentos: Array.isArray(quotes) ? quotes : [] };
        });

        res.json(processedItems);
    } catch (err) {
        console.error("Erro ao buscar itens para cotação:", err);
        res.status(500).json({ error: "Erro ao buscar itens para cotação." });
    } finally {
        if (connection) connection.release();
    }
});

// ROTA para Aquisições SELECIONAR o melhor orçamento
app.put("/api/cotacoes/:itemId/selecionar", authenticateToken, authorizePermission('acquisitions.manage'), async (req, res) => {
    const { itemId } = req.params;
    const { quoteIndex } = req.body;
    const userId = req.user.id;
    const userName = req.user.nome;

    if (quoteIndex === undefined) {
        return res.status(400).json({ error: "O índice do orçamento é obrigatório." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        const [items] = await connection.query("SELECT orcamentos, quantidade, projeto_id, status FROM bom_items WHERE id = ?", [itemId]);
        
        if (items.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Item não encontrado." });
        }

        const currentStatus = items[0].status;
        // CORREÇÃO DE LÓGICA: Permite selecionar cotação também se já estiver finalizada (para re-selecionar)
        if (currentStatus !== 'Em Cotação' && currentStatus !== 'Cotação Finalizada') { 
            await connection.rollback();
            return res.status(409).json({ error: `Este item não pode ser selecionado para cotação, pois seu status é '${currentStatus}', não 'Em Cotação'.` });
        }

        const orcamentos = parseJsonField(items[0].orcamentos);
        const selectedQuote = orcamentos[quoteIndex];

        if (!selectedQuote) {
            await connection.rollback();
            return res.status(400).json({ error: "Índice do orçamento inválido." });
        }

        const projetoId = items[0].projeto_id;
        const valorUnitarioAprovado = parseFloat(selectedQuote.valor_unitario);
        const valorTotalItem = valorUnitarioAprovado * parseFloat(items[0].quantidade);
        const linkProdutoAprovado = selectedQuote.link_produto || null;

        const [result] = await connection.query(
            `UPDATE bom_items SET 
                fornecedor_aprovado = ?, 
                valor_aprovado = ?, 
                valor_total_item = ?, 
                link_produto = ?,
                status = 'Aguardando Aprovação Diretoria',
                verificado_por_usuario_id = ? 
             WHERE id = ? AND status IN ('Em Cotação', 'Cotação Finalizada')`, // <-- Check de segurança
            [
                selectedQuote.fornecedor, 
                valorUnitarioAprovado.toFixed(2), 
                valorTotalItem.toFixed(2),
                linkProdutoAprovado, 
                userId,
                itemId
            ]
        );
        
        await registrarAcao(
            connection, userId, userName, 'EDICAO', 'BOM Item', parseInt(itemId), 
            `Orçamento '${selectedQuote.fornecedor}' (R$ ${valorUnitarioAprovado.toFixed(2)}) selecionado para o item ID ${itemId}. Item movido para Aprovação da Diretoria.`
        );
        
        // ===== INÍCIO DA ATUALIZAÇÃO (LOG BOM) =====
        await logBomApproval(connection, itemId, 'Cotação', 'Cotação Selecionada', userId, userName);
        // ===== FIM DA ATUALIZAÇÃO (LOG BOM) =====
        
        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userId, projetoId]
        );

        await connection.commit();
        res.json({ message: "Orçamento selecionado com sucesso! Item enviado para Aprovação da Diretoria." });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao selecionar orçamento:", err);
        res.status(500).json({ error: "Erro ao selecionar orçamento." });
    } finally {
        if (connection) connection.release();
    }
});

// ▼▼▼ INÍCIO DA ADIÇÃO ▼▼▼
// NOVO: ROTA para buscar contagens de solicitações pendentes
app.get("/api/solicitacoes/counts", authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await db.promise().getConnection();
        const [counts] = await connection.query(`
            SELECT status, COUNT(*) as count 
            FROM bom_items 
            WHERE status IN (
                'Aguardando Aprovação Líder', /* <-- ADICIONADO */
                'Aguardando Aprovação', 
                'Em Cotação', 
                'Aguardando Aprovação Diretoria',
                'Aguardando Aprovação Financeiro'
            ) 
            GROUP BY status;
        `);
        
        // Formata a resposta como um objeto chave-valor
        const result = {
            'Aguardando Aprovação Líder': 0, /* <-- ADICIONADO */
            'Aguardando Aprovação': 0,
            'Em Cotação': 0,
'Aguardando Aprovação Diretoria': 0,
            'Aguardando Aprovação Financeiro': 0
        };

        counts.forEach(row => {
            if (result.hasOwnProperty(row.status)) {
                result[row.status] = row.count;
            }
        });

        res.json(result);
    } catch (error) {
        console.error("Erro ao buscar contagem de solicitações:", error);
        res.status(500).json({ error: "Erro interno ao buscar contagem de solicitações." });
    } finally {
        if (connection) connection.release();
    }
});
// ▲▲▲ FIM DA ADIÇÃO ▲▲▲

// NOVO: ROTA para buscar contagens de solicitações POR PROJETO
app.get("/api/solicitacoes/counts-by-project", authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await db.promise().getConnection();
        const [rows] = await connection.query(`
            SELECT status, projeto_id 
            FROM bom_items 
            WHERE status IN (
                'Aguardando Aprovação Líder', /* <-- ADICIONADO */
                'Aguardando Aprovação', 
                'Em Cotação', 
                'Aguardando Aprovação Diretoria',
                'Aguardando Aprovação Financeiro'
            ) 
            GROUP BY status, projeto_id;
        `);
        
        const result = {
            'Aguardando Aprovação Líder': [], /* <-- ADICIONADO */
            'Aguardando Aprovação': [],
            'Em Cotação': [],
'Aguardando Aprovação Diretoria': [],
            'Aguardando Aprovação Financeiro': []
        };

        rows.forEach(row => {
            if (result.hasOwnProperty(row.status)) {
                result[row.status].push(row.projeto_id);
            }
        });

        res.json(result);
    } catch (error) {
        console.error("Erro ao buscar contagem de solicitações por projeto:", error);
        res.status(500).json({ error: "Erro interno ao buscar contagem por projeto." });
    } finally {
        if (connection) connection.release();
    }
});

// ===============================================
// INÍCIO: NOVAS ROTAS PARA O PAINEL DE APROVAÇÃO DE COMPRAS
// ===============================================

// ROTA para buscar todos os itens "Aguardando Aprovação"
app.get("/api/solicitacoes", authenticateToken, authorizeApprovalAccess, async (req, res) => {
    const { status } = req.query; // Pega o status da query string (ex: ?status=Aguardando Aprovação Diretoria)
    let connection;
    try {
        connection = await db.promise().getConnection();

        // ##### INÍCIO DA CORREÇÃO #####
        // Adicionados os campos: b.fornecedor_aprovado, b.valor_aprovado, b.valor_total_item, b.link_produto
        let sql = `
            SELECT 
                b.id, b.projeto_id, b.descricao, b.quantidade, b.justificativa, b.setor, b.url_imagem, b.orcamentos, b.status,
                b.fornecedor_aprovado, b.valor_aprovado, b.valor_total_item, b.link_produto,
                p.nome AS nome_projeto,
                u.nome AS nome_solicitante
            FROM bom_items b
            JOIN projetos p ON b.projeto_id = p.id
            LEFT JOIN usuarios u ON b.criado_por_usuario_id = u.id 
            WHERE 1=1
        `;
        // ##### FIM DA CORREÇÃO #####

        const params = [];

        // Lógica de filtro: Se o status for fornecido na URL, filtra por ele.
        // Caso contrário, usa o status padrão 'Aguardando Aprovação' (Gestor).
        const targetStatus = status || 'Aguardando Aprovação'; 
        
        sql += ` AND b.status = ?`;
        params.push(targetStatus);

        sql += ` ORDER BY b.id DESC`;

        const [solicitacoes] = await connection.query(sql, params);

        res.json(solicitacoes);

    } catch (error) {
        console.error("Erro ao buscar solicitações pendentes:", error);
        res.status(500).json({ error: "Erro interno ao buscar solicitações." });
    } finally {
        if (connection) connection.release();
    }
});


// Rota para Aprovar um Item de BOM
app.put("/api/solicitacoes/:itemId/approve", authenticateToken, authorizePermission('project.shopping.approve'), async (req, res) => {
    const { itemId } = req.params;
    const userId = req.user.id; 
    const userName = req.user.nome;

    let connection;
    try {
        connection = await db.promise().getConnection(); 
        await connection.beginTransaction();
        
        // Verifica se o usuário logado existe
        let userIdToUse = req.user.id;
        const [userCheck] = await connection.query('SELECT id FROM usuarios WHERE id = ?', [userIdToUse]);

        if (userCheck.length === 0) {
            console.warn(`AVISO: O ID do usuário logado (${userIdToUse}) não existe na tabela de usuários. Usando NULL para evitar erro de FK.`);
            userIdToUse = null; 
        }

        const [itemCurrentStatus] = await connection.query('SELECT status, projeto_id, setor, descricao, quantidade FROM bom_items WHERE id = ?', [itemId]);
        
        if (itemCurrentStatus.length === 0) {
             await connection.rollback();
             return res.status(404).json({ error: "Item não encontrado." });
        }
        
        const currentStatus = itemCurrentStatus[0].status;
        const { projeto_id, setor, descricao, quantidade } = itemCurrentStatus[0];

        let newStatus;
        let logMessage;
        let setVerifiedUser = false;
        let etapaLog = null;
        let acaoLog = 'Aprovado';

        // Lógica de Transição de Status
        if (currentStatus === 'Aguardando Aprovação Líder') {
            newStatus = 'Aguardando Aprovação'; // Move para o Gestor
            logMessage = `Item BOM '${descricao}' do projeto '${projeto_id}' aprovado pelo Líder (${userName}). Item movido para Aprovação da Gerência.`;
            etapaLog = 'Líder';
        } else if (currentStatus === 'Aguardando Aprovação') {
            newStatus = 'Em Cotação'; // Move para Cotação
            logMessage = `Item BOM '${descricao}' do projeto '${projeto_id}' aprovado pelo Gestor (${userName}). Item movido para Cotação.`;
            setVerifiedUser = true; // Marca como verificado pelo Gestor
            etapaLog = 'Gestor';
        } else {
             await connection.rollback();
             return res.status(409).json({ error: `Item não está em um status que possa ser aprovado por este nível. Status atual: ${currentStatus}.` });
        }

        // 1. Atualiza o status do item
        const [result] = await connection.execute(
            `UPDATE bom_items SET status = ?, verificado_por_usuario_id = ? WHERE id = ? AND status = ?`,
            [newStatus, setVerifiedUser ? userIdToUse : null, itemId, currentStatus] 
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(409).json({ error: "Item não encontrado ou status foi alterado recentemente." }); 
        }
        
        // 2. CRIA SUB-ETAPA DE COMPRA (SOMENTE APÓS APROVAÇÃO DO GESTOR)
        if (newStatus === 'Em Cotação') {
            // ... (Lógica para criar sub-etapa de compra, como em seu código) ...
            const [etapaAquisicoes] = await connection.query(
                "SELECT id FROM projeto_etapas WHERE projeto_id = ? AND nome_etapa LIKE 'Aquisições'", 
                [projeto_id]
            );
            if (etapaAquisicoes.length > 0) {
                const etapaAquisicoesId = etapaAquisicoes[0].id;
                let setorId;
                const [setorExistente] = await connection.query(
                    "SELECT id FROM setores WHERE projeto_etapa_id = ? AND nome = ?", 
                    [etapaAquisicoesId, setor]
                );
                if (setorExistente.length > 0) {
                    setorId = setorExistente[0].id;
                } else {
                    const [maxOrder] = await connection.query(
                        "SELECT MAX(ordem) as max_ordem FROM setores WHERE projeto_etapa_id = ?", 
                        [etapaAquisicoesId]
                    );
                    const newOrder = (maxOrder[0].max_ordem || 0) + 1;
                    const [newSetorResult] = await connection.query(
                        "INSERT INTO setores (projeto_etapa_id, projeto_id, nome, ordem) VALUES (?, ?, ?, ?)", 
                        [etapaAquisicoesId, projeto_id, setor, newOrder]
                    );
                    setorId = newSetorResult.insertId; 
                }
                const subEtapaDesc = `Comprar: ${descricao} (Qtd: ${quantidade})`;
                await connection.query(
                    "INSERT INTO sub_etapas (projeto_id, projeto_etapa_id, setor_id, descricao, criado_por_usuario_id) VALUES (?, ?, ?, ?, ?)",
                    [projeto_id, etapaAquisicoesId, setorId, subEtapaDesc, userIdToUse]
                );
            }
        }
        
        // 3. LOG DE AUDITORIA
        const [projectNameResult] = await connection.query('SELECT nome FROM projetos WHERE id = ?', [projeto_id]);
        const projectName = projectNameResult.length > 0 ? projectNameResult[0].nome : 'Projeto Desconhecido';
        
        await registrarAcao(
            connection, userId, userName, 'EDICAO', 'BOM Item', parseInt(itemId), 
            logMessage.replace(`ID ${projeto_id}`, `'${projectName}'`)
        );
        
        // 4. LOG DE APROVAÇÃO BOM
        if (etapaLog) {
            await logBomApproval(connection, itemId, etapaLog, acaoLog, userIdToUse, userName);
        }
        
        // 5. Atualiza o timestamp do projeto
        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userIdToUse, projeto_id]
        );

        await connection.commit();
        res.status(200).json({ message: "Item aprovado com sucesso e movido para a próxima etapa." });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error(`Erro ao aprovar item de BOM ID ${itemId}:`, error);
        res.status(500).json({ error: "Erro interno ao processar a aprovação." });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para REPROVAR um item (Líder, Gestor, Diretoria, ou Financeiro)
app.put("/api/solicitacoes/:itemId/reprove", authenticateToken, authorizePermission('project.shopping.approve'), async (req, res) => {
    console.log('API: /api/solicitacoes/:itemId/reprove (PUT) - INÍCIO');
    const itemId = req.params.itemId;
    const userId = req.user.id;
    const userName = req.user.nome;
    let connection;

    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        const [itemInfo] = await connection.query(
            'SELECT b.descricao, p.nome, b.projeto_id, b.status FROM bom_items b JOIN projetos p ON b.projeto_id = p.id WHERE b.id = ?',
            [itemId]
        );

        if (itemInfo.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Item não encontrado." });
        }
        
        const currentStatus = itemInfo[0].status;
        const itemDesc = itemInfo[0].descricao;
        const projectName = itemInfo[0].nome;
        const projeto_id = itemInfo[0].projeto_id;
        
        let etapaReprovacao;
        
        // ===================== INÍCIO DA CORREÇÃO (Permitir Reprovação) =====================
        // Permite a reprovação de qualquer um destes estágios
        if (currentStatus === 'Aguardando Aprovação Líder') {
            etapaReprovacao = 'Líder';
        } else if (currentStatus === 'Aguardando Aprovação') {
            etapaReprovacao = 'Gestor';
        } else if (currentStatus === 'Aguardando Aprovação Diretoria') { 
            etapaReprovacao = 'Diretoria';
        } else if (currentStatus === 'Aguardando Aprovação Financeiro') { 
            etapaReprovacao = 'Financeiro';
        // ===================== FIM DA CORREÇÃO =====================
        } else {
            // Se o status não for um dos acima, bloqueia a reprovação
            await connection.rollback();
            return res.status(409).json({ error: `Item não pode ser reprovado neste estágio. Status atual: ${currentStatus}.` });
        }

        // 2. Altera o status para 'Reprovado'
        // ===================== INÍCIO DA CORREÇÃO (Atualizar Query) =====================
        const [result] = await connection.execute(
            'UPDATE bom_items SET status = ?, verificado_por_usuario_id = NULL WHERE id = ? AND status IN (?, ?, ?, ?)',
            ['Reprovado', itemId, 'Aguardando Aprovação Líder', 'Aguardando Aprovação', 'Aguardando Aprovação Diretoria', 'Aguardando Aprovação Financeiro']
        );
        // ===================== FIM DA CORREÇÃO =====================

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(409).json({ error: "Item não encontrado ou status foi alterado." });
        }

        // 3. Registra a ação no log de auditoria
        await registrarAcao(
            connection, userId, userName, 'EDICAO', 'BOM Item', parseInt(itemId), 
            `Item BOM '${itemDesc}' do projeto '${projectName}' reprovado.`
        );

        // 4. Registra no log de aprovação
        await logBomApproval(connection, itemId, etapaReprovacao, 'Reprovado', userId, userName);

        // 5. Atualiza o timestamp do projeto
        if (projeto_id) {
             await connection.query(
                "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
                [userId, projeto_id]
            );
        }

        await connection.commit();
        res.status(200).json({ message: "Item reprovado com sucesso. Status alterado para 'Reprovado'." });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Erro CRÍTICO ao reprovar item BOM:", error.stack || error.message);
        res.status(500).json({ error: "Erro interno do servidor ao reprovar item." });
    } finally {
        if (connection) connection.release();
    }
});

// ROTA para EXCLUIR múltiplos itens de BOM
app.delete("/api/bom-items", authenticateToken, authorizePermission('project.manage.shopping'), async (req, res) => {
    const { itemIds } = req.body; // Espera um array de IDs: { itemIds: [1, 2, 3] }
    const { id: userId } = req.user;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({ error: "É necessário fornecer uma lista de IDs de itens para excluir." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // Pega o ID do projeto do primeiro item para poder registrar a última modificação
        const [itemData] = await connection.query("SELECT projeto_id FROM bom_items WHERE id = ?", [itemIds[0]]);
        if (itemData.length === 0) {
            // Se o primeiro item não existe, não há necessidade de prosseguir
            await connection.rollback();
            return res.status(404).json({ error: "Nenhum item válido encontrado para exclusão." });
        }
        const { projeto_id } = itemData[0];

        // Deleta os itens
        const [result] = await connection.query("DELETE FROM bom_items WHERE id IN (?)", [itemIds]);
        
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Nenhum item foi encontrado para exclusão." });
        }

        // Atualiza o projeto
        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userId, projeto_id]
        );

        await connection.commit();
        res.json({ message: `${result.affectedRows} item(ns) excluído(s) com sucesso.` });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao excluir itens da BOM:", err);
        res.status(500).json({ error: "Erro ao excluir itens da BOM." });
    } finally {
        if (connection) connection.release();
    }
});



// ROTA para ENVIAR um item individual para aprovação
app.put("/api/bom-items/:itemId/submit-for-approval", authenticateToken, authorizePermission('project.manage.shopping'), async (req, res) => {
    const { itemId } = req.params;
    const { id: userId, nome: userName } = req.user;

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

const [result] = await connection.execute(
            'UPDATE bom_items SET status = ?, verificado_por_usuario_id = NULL WHERE id = ? AND status IN (?, ?)',
            ['Aguardando Aprovação Líder', itemId, 'Em Elaboração', 'Reprovado']
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(409).json({ error: "Item não encontrado ou não está em elaboração." });
        }
        
        const [itemDetails] = await connection.query("SELECT projeto_id, descricao FROM bom_items WHERE id = ?", [itemId]);
        const { projeto_id, descricao } = itemDetails[0];
        
        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userId, projeto_id]
        );
        
        const [projectNameResult] = await connection.query('SELECT nome FROM projetos WHERE id = ?', [projeto_id]);
        const projectName = projectNameResult.length > 0 ? projectNameResult[0].nome : 'Projeto Desconhecido';
        
        await registrarAcao(
            connection, userId, userName, 'EDICAO', 'BOM Item', parseInt(itemId), 
            `Item BOM '${descricao}' do projeto '${projectName}' enviado para aprovação do Líder.`
        );

        // ===== INÍCIO DA ATUALIZAÇÃO (LOG BOM) =====
        await logBomApproval(connection, itemId, 'Líder', 'Solicitado', userId, userName);
        // ===== FIM DA ATUALIZAÇÃO (LOG BOM) =====

        await connection.commit();
        res.json({ message: "Item enviado para aprovação do Líder com sucesso!" });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erro ao enviar item individual para aprovação:", err);
        res.status(500).json({ error: "Erro interno ao enviar item para aprovação." });
    } finally {
        if (connection) connection.release();
    }
});

// NOVO: ROTA para atualização genérica de status de item da BOM
app.put("/api/bom-items/:itemId/status", authenticateToken, authorizePermission('project.shopping.approve'), async (req, res) => {
    const { itemId } = req.params;
    const { status } = req.body; 
    const userId = req.user.id;
    const userName = req.user.nome;

    if (!status) {
        return res.status(400).json({ error: "O campo 'status' é obrigatório." });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // ===== INÍCIO DA ATUALIZAÇÃO (LOG BOM) =====
        let etapaLog = 'Gestor'; // Padrão
        let acaoLog = null;
        
        const [itemStatus] = await connection.query('SELECT status FROM bom_items WHERE id = ?', [itemId]);
        if (itemStatus.length > 0) {
            const currentStatus = itemStatus[0].status;
            if (currentStatus === 'Aguardando Aprovação Líder') etapaLog = 'Líder';
            if (currentStatus === 'Aguardando Aprovação') etapaLog = 'Gestor';
            if (currentStatus === 'Em Cotação' || currentStatus === 'Cotação Finalizada') etapaLog = 'Cotação';
            if (currentStatus === 'Aguardando Aprovação Diretoria') etapaLog = 'Diretoria';
        }
        
        if (status === 'Reprovado') {
            acaoLog = 'Reprovado';
        } else if (status === 'Em Elaboração') {
            acaoLog = 'Retornado';
        }
        // ===== FIM DA ATUALIZAÇÃO (LOG BOM) =====

        // 1. Executa a atualização de status na tabela bom_items
        const [result] = await connection.query(
            "UPDATE bom_items SET status = ?, verificado_por_usuario_id = ? WHERE id = ?",
            [status, userId, itemId]
        );
        
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Item não encontrado." });
        }

        // 2. CRÍTICO: Se o status for 'Em Elaboração', limpa o histórico de aprovação.
        if (status === 'Em Elaboração') {
            await connection.query(
                "DELETE FROM bom_approval_log WHERE bom_item_id = ?",
                [itemId]
            );
            console.log(`[LIMPEZA DE LOG] Histórico de aprovação excluído para o item BOM ID: ${itemId}.`);
        }

        const [itemDetails] = await connection.query("SELECT projeto_id, descricao FROM bom_items WHERE id = ?", [itemId]); 
        
        if (itemDetails.length === 0) {
             await connection.rollback();
            return res.status(404).json({ error: "Item não encontrado após atualização." });
        }
        const { projeto_id, descricao } = itemDetails[0];

        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userId, projeto_id]
        );

        // 3. Log de Auditoria (mantido para ações importantes)
        if (status === 'Comprado' || status === 'Reprovado' || status === 'Em Elaboração') {
            const [projectNameResult] = await connection.query('SELECT nome FROM projetos WHERE id = ?', [projeto_id]);
            const projectName = projectNameResult.length > 0 ? projectNameResult[0].nome : 'Projeto Desconhecido';
            
            await registrarAcao(
                connection, userId, userName, 'EDICAO', 'BOM Item', parseInt(itemId), 
                `Item BOM '${descricao}' (Projeto: '${projectName}') teve o status atualizado para '${status}'.`
            );
        }
        
        // 4. Log BOM Approval (registra apenas o retorno para elaboração)
        if (acaoLog) { 
             await logBomApproval(connection, itemId, etapaLog, acaoLog, userId, userName);
        }

        await connection.commit();
        res.json({ message: `Status do item atualizado para '${status}' com sucesso! O histórico de aprovação foi resetado.` });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Erro ao atualizar status do item BOM:", error);
        res.status(500).json({ error: "Erro interno ao atualizar status." });
    } finally {
        if (connection) connection.release();
    }
});

//Adicione esta nova ROTA para Aprovação FINAL da Diretoria (Comprado)
app.put("/api/solicitacoes/:itemId/approve-final", authenticateToken, authorizePermission('project.shopping.approve'), async (req, res) => {
    const { itemId } = req.params;
    const userId = req.user.id;
    const userName = req.user.nome;

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

       // CORREÇÃO: Removidas colunas inexistentes (aprovacao_diretoria_status, etc.)
       // A lógica agora atualiza o status e o verificado_por_usuario_id (para registrar QUEM aprovou esta etapa)
       const [result] = await connection.execute(
            'UPDATE bom_items SET status = ?, verificado_por_usuario_id = ? WHERE id = ? AND status = ?',
            ['Aguardando Aprovação Financeiro', userId, itemId, 'Aguardando Aprovação Diretoria'] 
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            // CORREÇÃO: Mensagem de erro mais clara
            return res.status(409).json({ error: "Item não encontrado ou não estava 'Aguardando Aprovação Diretoria'." }); 
        }
        
        const [itemDetails] = await connection.query("SELECT projeto_id, descricao FROM bom_items WHERE id = ?", [itemId]);
        const { projeto_id, descricao } = itemDetails[0];

        const [projectNameResult] = await connection.query('SELECT nome FROM projetos WHERE id = ?', [projeto_id]);
        const projectName = projectNameResult.length > 0 ? projectNameResult[0].nome : 'Projeto Desconhecido';
        
        await registrarAcao(
            connection, userId, userName, 'EDICAO', 'BOM Item', parseInt(itemId), 
            `Aprovação da Diretoria: Item BOM '${descricao}' do projeto '${projectName}' teve o status atualizado para 'Aguardando Aprovação Financeiro' pelo Diretor (${userName}).`
        );
        
        // ===== LOG BOM (Correto, antes do commit) =====
        await logBomApproval(connection, itemId, 'Diretoria', 'Aprovado', userId, userName);
        
        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userId, projeto_id]
        );

        await connection.commit();
        // CRÍTICO: Adição do projeto_id no retorno
        res.status(200).json({ 
            message: "Item aprovado pela Diretoria e enviado ao Financeiro.",
            projeto_id: projeto_id // <--- NOVO RETORNO
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error(`Erro ao aprovar item de BOM ID ${itemId} (Aprovação Final):`, error);
        res.status(500).json({ error: "Erro interno ao processar a aprovação final." });
    } finally {
        if (connection) connection.release();
    }
});

function parseJsonField(fieldValue) {
    if (fieldValue === null || fieldValue === undefined) {
        return [];
    }
    // Se for uma string, tenta fazer o parse
    if (typeof fieldValue === 'string') {
        try {
            return JSON.parse(fieldValue);
        } catch (e) {
            // Se falhar no parse de string, algo está muito errado, retorna vazio.
            return [];
        }
    }
    // Se for um objeto (o que o mysql2 retorna para JSON válidos), retorna o objeto.
    if (typeof fieldValue === 'object' && Array.isArray(fieldValue)) {
         return fieldValue;
    }
    // Para qualquer outra coisa (incluindo objetos malformados como {a:1}), retorna array vazio.
    return [];
}






// Rota para Aprovação do Financeiro
app.put("/api/solicitacoes/:itemId/approve-financeiro", authenticateToken, authorizePermission('project.shopping.approve'), async (req, res) => {
    const { itemId } = req.params;
    const userId = req.user.id;
    const userName = req.user.nome;

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // **CORREÇÃO: Altera o status para 'Comprado' após a aprovação do Financeiro.**
        const [result] = await connection.query(
            'UPDATE bom_items SET status = ?, verificado_por_usuario_id = ? WHERE id = ? AND status = ?',
            ['Comprado', userId, itemId, 'Aguardando Aprovação Financeiro'] 
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(409).json({ error: "Item não encontrado ou não estava aguardando aprovação do Financeiro." });
        }

        const [itemDetails] = await connection.query("SELECT projeto_id, descricao FROM bom_items WHERE id = ?", [itemId]);
        const { projeto_id, descricao } = itemDetails[0];

        // Log da aprovação do Financeiro
        await logBomApproval(connection, itemId, 'Financeiro', 'Aprovado', userId, userName);

        // LOG DE AUDITORIA para a mudança de status final para 'Comprado'
        const [projectNameResult] = await connection.query('SELECT nome FROM projetos WHERE id = ?', [projeto_id]);
        const projectName = projectNameResult.length > 0 ? projectNameResult[0].nome : 'Projeto Desconhecido';
        
        await registrarAcao(
            connection, userId, userName, 'EDICAO', 'BOM Item', parseInt(itemId), 
            `Diretor atualizou o status do item BOM '${descricao}' (Projeto: '${projectName}') para 'Comprado'.`
        );

        // Atualiza o timestamp do projeto
        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userId, projeto_id]
        );

        await connection.commit();
        res.status(200).json({ message: "Item aprovado pelo Financeiro. Status alterado para 'Comprado'!" });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Erro ao aprovar item pelo Financeiro:", error);
        res.status(500).json({ error: "Erro interno ao aprovar item." });
    } finally {
        if (connection) connection.release();
    }
});

// Rota para Submeter um Item de BOM para o primeiro nível de Aprovação (Líder ou Gestor)
app.put('/api/solicitacoes/:id/submit-for-approval', authenticateToken, async (req, res) => {
    const itemId = parseInt(req.params.id);
    const userId = req.user.id;
    const userName = req.user.nome;

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Verifica status atual
        const [checkResult] = await connection.query(
            "SELECT status_id, projeto_id, descricao FROM solicitacoes WHERE id = ?",
            [itemId]
        );

        if (checkResult.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Item de BOM não encontrado." });
        }

        const currentStatusId = checkResult[0].status_id;
        const projeto_id = checkResult[0].projeto_id;
        const descricao = checkResult[0].descricao;

        // VERIFICAÇÃO CRÍTICA: Permite submeter APENAS se estiver 'Em Elaboração' (status_id = 1)
        if (currentStatusId !== 1) {
            await connection.rollback();
            // Resposta de erro personalizada (409 Conflict)
            const statusName = currentStatusId === 2 ? 'Aguardando Aprovação Líder' : `Status ID ${currentStatusId}`;
            return res.status(409).json({ error: `Item não pode ser submetido. Status atual: ${statusName}. A submissão só é permitida no status 'Em Elaboração'.` });
        }

        // 1.1. Atualiza o status para 'Aguardando Aprovação Líder' (presumindo status_id = 2)
        const [updateResult] = await connection.query(
            "UPDATE solicitacoes SET status_id = 2, data_submissao_lider = NOW() WHERE id = ? AND status_id = 1",
            [itemId]
        );

        if (updateResult.affectedRows === 0) {
            await connection.rollback();
            // Erro de concorrência ou status alterado antes do UPDATE.
            return res.status(409).json({ error: "Item não encontrado ou status foi alterado recentemente." }); 
        }
        
        // 2. LOG DE AUDITORIA
        const [projectNameResult] = await connection.query('SELECT nome FROM projetos WHERE id = ?', [projeto_id]);
        const projectName = projectNameResult.length > 0 ? projectNameResult[0].nome : 'Projeto Desconhecido';
        
        await registrarAcao(
            connection, userId, userName, 'EDICAO', 'BOM Item', parseInt(itemId), 
            `Item BOM '${descricao}' do projeto '${projectName}' submetido para aprovação por ${userName}.`
        );
        
        // 3. Atualiza o timestamp do projeto
        await connection.query(
            "UPDATE projetos SET ultima_atualizacao_por_usuario_id = ?, data_ultima_atualizacao = NOW() WHERE id = ?",
            [userId, projeto_id]
        );

        await connection.commit();
        res.status(200).json({ message: `Item submetido para aprovação do Líder com sucesso!`, projeto_id: projeto_id });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error(`Erro ao submeter item de BOM ID ${itemId}:`, error);
        res.status(500).json({ error: "Erro interno ao processar a submissão." });
    } finally {
        if (connection) connection.release();
    }
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
