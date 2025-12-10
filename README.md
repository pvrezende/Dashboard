🏭 Sistema de Gestão de Produção e Projetos Industriais
Este é um sistema Web completo (Fullstack) desenvolvido para gerenciamento de processos industriais, focado em controle de produção, gestão de projetos de engenharia, ferramentaria e fluxo de compras (BOM) com aprovações hierárquicas.

O sistema permite o acompanhamento em tempo real via Dashboard, controle de horas trabalhadas por operadores (Timers), e gestão granular de permissões de usuários (RBAC).

🚀 Funcionalidades Principais
1. 📊 Dashboard Gerencial (Tela 1)
Visualização em tempo real da produção (Peças estimadas vs. Produzidas).

Gráficos de eficiência (OEE) hora a hora usando Chart.js.

Indicadores de aprovação/reprovação de peças.

Geração de relatórios em PDF e Excel.

2. 📌 Gestão de Projetos (Tela 2 e 3)
CRUD completo de projetos (Cadastro, Edição, Encerramento).

Kanban/Timeline Dinâmico: Criação e ordenação de etapas do projeto via Drag-and-Drop.

Acompanhamento visual do progresso por etapa.

Vinculação de equipe (Líder, Coordenador, Membros).

3. 🛒 Gestão de Compras e BOM (Bill of Materials)
Fluxo de aprovação complexo e multinível:

Solicitante: Cria a lista de materiais.

Líder & Gestor: Aprovam a necessidade técnica.

Compras: Realiza cotações (múltiplos orçamentos por item).

Diretoria: Aprovação final de valores elevados.

Financeiro: Liberação de verba.

Status Final: Pedido realizado/recebido.

Upload de anexos e visualização de itens.

4. 🛠️ Ferramentaria e Produção (Tela 4 e 5)
Gestão de ferramentas e sub-etapas de produção.

Controle de Tempo Real: Operadores iniciam, pausam e finalizam atividades com cronômetros sincronizados no servidor.

Modo "Tela Cheia" para chão de fábrica.

Associação de peças de projetos à fila de produção.

5. 👥 Gestão de Pessoas e Acesso (Tela 7, 8 e Admin)
RBAC (Role-Based Access Control): Sistema de permissões dinâmicas onde o admin define o que cada cargo pode ver ou clicar (ex: botões de aprovar somem se o usuário não tiver permissão).

Monitoramento de atividades dos colaboradores.

Cadastro de usuários e níveis de acesso.

💻 Tecnologias Utilizadas
Frontend
Linguagens: HTML5, CSS3, JavaScript (Vanilla ES6+).

Bibliotecas:

Chart.js: Para gráficos de produção.

ExcelJS: Para geração de relatórios .xlsx.

html2canvas: Para exportação de visualizações.

FontAwesome: Ícones.

Arquitetura: SPA-like (Single Page Application) controlada via script.js sem uso de frameworks pesados (React/Vue), garantindo leveza e performance.

Backend
Runtime: Node.js.

Framework: Express.js.

Autenticação: JWT (JSON Web Tokens) para sessões seguras.

Segurança: bcrypt para hash de senhas e middleware de validação de permissões.

Uploads: multer para gerenciamento de arquivos e imagens.

Banco de Dados
SGBD: MySQL.

Driver: mysql2 (com suporte a Promises/Async-Await).

Estrutura: Relacional, com tabelas para usuários, projetos, ferramentas, cronômetros ativos, BOMs e orçamentos.

⚙️ Como Rodar Localmente
Siga os passos abaixo para configurar o ambiente de desenvolvimento:

1. Pré-requisitos
Certifique-se de ter instalado:

Node.js (versão 14 ou superior)

MySQL Server (ou MariaDB)

Git

2. Configuração do Banco de Dados
Abra seu cliente MySQL (Workbench, DBeaver, etc).

Crie um banco de dados chamado producao_db.

Importe os arquivos SQL fornecidos na seguinte ordem:

Primeiro o arquivo que cria a estrutura das tabelas (10-11-2025-parte1.sql).

Depois o arquivo que popula os dados iniciais (10-11-2025-parte2.sql - se houver dados).

3. Instalação do Backend
Clone o repositório ou baixe os arquivos.

Abra o terminal na pasta raiz do projeto.

Instale as dependências:

Bash

npm install
4. Configuração de Ambiente
⚠️ Importante: O projeto original está configurado para um IP de produção. Você precisa ajustar para local.

No Backend (server.js):

Verifique a conexão com o banco de dados (por volta da linha 20). Ajuste o user, password e database conforme sua instalação local do MySQL:

JavaScript

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root', // Seu usuário
    password: 'sua_senha', // Sua senha
    database: 'producao_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
No Frontend (public/js/script.js):

Altere a constante API_BASE_URL (logo no início do arquivo) para apontar para o localhost:

JavaScript

// Comente a linha do IP de produção e descomente a local:
// const API_BASE_URL = 'http://98.84.113.180:3000//api'; 
const API_BASE_URL = 'http://localhost:3000/api'; 
5. Rodando o Projeto
No terminal, inicie o servidor:

Bash

node server.js
Você deve ver a mensagem: Servidor rodando na porta 3000.

Abra seu navegador e acesse:

http://localhost:3000
Faça login com um usuário cadastrado no banco de dados (tabela usuarios).

📂 Estrutura de Pastas
/
├── public/              # Arquivos do Frontend (Estáticos)
│   ├── css/             # Estilos separados por módulos
│   ├── js/              # Lógica do cliente (dashboard.js, producao.js, etc)
│   ├── img/             # Imagens e ícones
│   └── index.html       # Ponto de entrada da aplicação
├── uploads/             # Pasta onde anexos e imagens são salvos
├── server.js            # Ponto de entrada da API e Lógica do Servidor
├── package.json         # Dependências do Node.js
└── *.sql                # Scripts de Banco de Dados
👨‍💻 Autor
Desenvolvido por Paulo Victor Rezende Virginio. Desenvolvedor Fullstack Jr.
