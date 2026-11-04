# Manual Completo e Especificação Técnica do Sistema Sistrastreamento
> **Ao Ponto Carnes & Massas — Gestão Logística, Rastreamento GPS e Repasse Financeiro**  
> *Versão de Produção — Documentação Unificada de Engenharia e Operação*

---

## Sumário
1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Arquitetura de Engenharia e Tecnologias](#2-arquitetura-de-engenharia-e-tecnologias)
3. [Banco de Dados e Modelagem de Dados](#3-banco-de-dados-e-modelagem-de-dados)
4. [Módulo Back-End e Rotas da API](#4-módulo-back-end-e-rotas-da-api)
5. [Regras de Negócio e Cálculo Automático de Taxas](#5-regras-de-negócio-e-cálculo-automático-de-taxas)
6. [Módulo Front-End: Painel Administrativo e Cozinha](#6-módulo-front-end-painel-administrativo-e-cozinha)
7. [Módulo Front-End: Aplicativo Mobile do Motoboy (PWA)](#7-módulo-front-end-aplicativo-mobile-do-motoboy-pwa)
8. [Aplicativo Android Nativo em Segundo Plano](#8-aplicativo-android-nativo-em-segundo-plano)
9. [Integrações Externas (iFood, 99Food e Traccar)](#9-integrações-externas-ifood-99food-e-traccar)
10. [Instruções de Acesso e Download](#10-instruções-de-acesso-e-download)

---

## 1. Visão Geral do Sistema

O **Sistrastreamento** é uma plataforma completa e integrada de gestão de entregas em tempo real desenvolvida sob medida para o restaurante **Ao Ponto Carnes & Massas**.

O sistema elimina o atrito entre a expedição dos pedidos na cozinha e a entrega na casa do cliente através de três pilares:
1. **Entrada Automatizada de Pedidos:** Captação de pedidos via Webhooks oficiais do **iFood** e **99Food**, além de suporte a lançamentos manuais no balcão.
2. **Rastreamento Geográfico e Despacho Eficiente:** Painel de controle em tempo real para a cozinha, com mapa dinâmico de entregadores em trânsito, histórico de rotas e atribuição inteligente para dois grupos operacionais de entregadores (**VELOZ** e **SPEED**).
3. **App Mobile do Motoboy e Repasse Financeiro:** Aplicativo PWA/Android para os motoboys retirarem pedidos no balcão com um clique, abrirem navegação no Waze/Google Maps, ligarem para o cliente ou copiarem o PIN do iFood, enquanto o sistema audita quilometragem, rotas e calcula o fechamento diário/semanal dos repasses de taxas com registro de pagamento via PIX.

---

## 2. Arquitetura de Engenharia e Tecnologias

A aplicação foi projetada com arquitetura serverless de alta performance, sem dependência de frameworks monolíticos pesados, garantindo tempos de resposta na casa dos milissegundos e custo operacional mínimo.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        INTERFACES DE USUÁRIO                           │
│   ┌──────────────────────────────┐  ┌──────────────────────────────┐   │
│   │ Painel Admin / Cozinha       │  │ App Motoboy (PWA / Android)  │   │
│   │ (HTML5 / Vanilla JS / CSS3)  │  │ (HTML5 / WakeLock / Leaflet) │   │
│   └──────────────┬───────────────┘  └──────────────┬───────────────┘   │
└──────────────────┼─────────────────────────────────┼───────────────────┘
                   │ HTTPS / JSON                    │ HTTPS / GPS WGS84
                   ▼                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      NÚCLEO DO BACK-END (NODE.JS)                      │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ server.js: HTTP Server Nativo + Router Ultrarrápido            │   │
│   ├────────────────────────────────────────────────────────────────┤   │
│   │ Middlewares: requireAuth, requireAdmin (Tokens HMAC-SHA256)    │   │
│   ├────────────────────────────────────────────────────────────────┤   │
│   │ Controllers: admin, pedidos, posicao, auth, ifood, 99food      │   │
│   ├────────────────────────────────────────────────────────────────┤   │
│   │ Utils: rateResolver (58 bairros), memoryCache, password        │   │
│   └──────────────────────────────┬─────────────────────────────────┘   │
└──────────────────────────────────┼─────────────────────────────────────┘
                                   │
      ┌────────────────────────────┴───────────────────────────┐
      ▼                                                        ▼
┌──────────────────────────────┐             ┌───────────────────────────────────┐
│ BANCO DE DADOS SERVERLESS    │             │ INTEGRAÇÕES EXTERNAS              │
│ Turso (libSQL Edge SQLite)   │             │ - iFood Developer API v2          │
│ Índices compostos de leitura │             │ - 99Food Webhooks                 │
│ Conexão resiliente com retry │             │ - OSRM Routing (Snap-to-Roads)   │
└──────────────────────────────┘             │ - Traccar Client GPS Protocol     │
                                             └───────────────────────────────────┘
```

### Tecnologias Utilizadas:
* **Linguagem / Runtime:** Node.js (v18+) utilizando APIs nativas (`node:http`, `node:crypto`, `node:fs`, `node:path`).
* **Banco de Dados em Nuvem:** **Turso (libSQL)** — SQLite distribuído globalmente em Edge Computing através do driver oficial `@libsql/client`.
* **Banco de Dados Local (Dev):** SQLite nativo (`node:sqlite`).
* **Mapeamento e Cartografia:** Leaflet.js com tiles escuros de alta densidade da CartoDB (*Dark Matter*) e OpenStreetMap.
* **Ícones de Interface:** Pacote Lucide Icons via CDN para iconografia vetorial nítida.
* **Segurança e Criptografia:** Hashing de senhas via **SHA-256**, tokens de sessão sem estado criptografados via **HMAC-SHA256**, proteção de senha master para dados sensíveis.
* **Deploy e Hospedagem:** Vercel Serverless Functions com proxy e fallback de rotas estáticas via `vercel.json`.

---

## 3. Banco de Dados e Modelagem de Dados

O banco de dados foi estruturado e indexado para suportar milhões de leituras e escritas sem degradação de performance.

### 3.1. Tabela `motoboys`
Armazena o cadastro, credenciais e localização atualizada dos entregadores:
* `id` (INTEGER PRIMARY KEY): Identificador único do entregador.
* `nome` (TEXT NOT NULL): Nome completo do motoboy.
* `telefone` (TEXT UNIQUE NOT NULL): Telefone de contato (utilizado como login).
* `senha` (TEXT NOT NULL): Hash SHA-256 da senha do entregador.
* `traccar_device_id` (TEXT UNIQUE NOT NULL): Identificador de dispositivo usado no envio de telemetria GPS.
* `grupo` (TEXT NOT NULL DEFAULT 'VELOZ'): Grupo logístico do entregador (`VELOZ` ou `SPEED`).
* `status` (TEXT NOT NULL DEFAULT 'aprovado'): Estado do cadastro (`pendente`, `aprovado`, `recusado`).
* `chave_pix` (TEXT): Chave PIX cadastrada pelo próprio motoboy no perfil para recebimento de repasses.
* `latitude` / `longitude` (REAL): Última coordenada geográfica captada.
* `velocidade` (REAL DEFAULT 0): Velocidade instantânea do entregador em km/h.
* `ultima_atualizacao` (DATETIME): Carimbo de data/hora da última coordenada enviada.
* `criado_em` (DATETIME): Data e hora de criação do cadastro.

### 3.2. Tabela `pedidos`
Armazena todas as entregas do sistema:
* `id` (INTEGER PRIMARY KEY): ID sequencial do pedido.
* `numero_pedido` (TEXT NOT NULL): Código visível do pedido (ex: `#4921`, `99F-841`, `BALCAO-102`).
* `motoboy_id` (INTEGER): Chave estrangeira referenciando o motoboy que assumiu o pedido.
* `status` (TEXT NOT NULL DEFAULT 'disponivel'): Situação atual da entrega (`disponivel`, `em_rota`, `entregue`, `cancelado`).
* `grupo` (TEXT NULL): Grupo de entregadores designado para retirar o pedido (`VELOZ`, `SPEED` ou `NULL` para ambos).
* `origem` (TEXT DEFAULT 'MANUAL'): Canal de onde o pedido surgiu (`IFOOD`, `99FOOD`, `MANUAL`, `SPOOLER`).
* `pedido_id_origem` (TEXT): ID de rastreamento do parceiro (ex: UUID do iFood ou ID da 99Food) para controle de idempotência.
* `cliente` (TEXT): Nome do cliente destinatário.
* `endereco` (TEXT): Logradouro completo de entrega (Rua, Número, Complemento).
* `bairro` (TEXT): Nome do bairro (utilizado para precificação da taxa).
* `taxa_entrega` (REAL DEFAULT 0.0): Valor financeiro a ser repassado ao motoboy pela corrida.
* `telefone_cliente` (TEXT): Telefone de contato do destinatário para ligação direta.
* `localizador` (TEXT): Código de confirmação / PIN (iFood/99Food) para validação da entrega.
* `texto_bruto` (TEXT): JSON ou payload completo do pedido com itens e comandas.
* `data_inicio` (DATETIME NULL): Momento exato em que o motoboy retirou o pedido no balcão.
* `data_fim` (DATETIME NULL): Momento exato em que o pedido foi finalizado como entregue.
* `criado_em` (DATETIME): Data e hora de inclusão do pedido no sistema.

### 3.3. Tabela `pedido_rotas`
Histórico de trilhas geográficas percorridas:
* `id` (INTEGER PRIMARY KEY): ID sequencial do ponto de trajeto.
* `pedido_id` (INTEGER NOT NULL): Chave estrangeira ligada a `pedidos(id)`.
* `motoboy_id` (INTEGER NOT NULL): Chave estrangeira ligada a `motoboys(id)`.
* `latitude` / `longitude` (REAL NOT NULL): Coordenadas WGS84 do ponto intermediário.
* `velocidade` (REAL): Velocidade no ponto.
* `criado_em` (DATETIME): Momento da leitura.

### 3.4. Tabelas `taxa_bairro` e `taxa_bairro_speed`
Tabelas de tarifação configuráveis pelo painel administrativo para cada bairro:
* `id` (INTEGER PRIMARY KEY)
* `bairro` (TEXT NOT NULL UNIQUE COLLATE NOCASE)
* `taxa` (REAL NOT NULL): Valor da taxa em Reais (R$).

### 3.5. Tabela `pagamentos_motoboys`
Auditoria de repasses financeiros:
* `id` (INTEGER PRIMARY KEY)
* `motoboy_id` (INTEGER NOT NULL): Referência ao entregador.
* `periodo` (TEXT NOT NULL): Código do período pago (ex: `hoje`, `ontem`, `semana`, `2026-10-21`).
* `data_referencia` (TEXT NOT NULL): Data da operação contábil.
* `valor` (REAL NOT NULL): Montante financeiro pago.
* `status` (TEXT DEFAULT 'confirmado')
* `confirmado_em` (DATETIME DEFAULT CURRENT_TIMESTAMP)
* `confirmado_por` (TEXT DEFAULT 'ADMIN')

### 3.6. Tabela `ifood_events`
Tabela de idempotência e auditoria de Webhooks recebidos da API oficial do iFood:
* `id` (TEXT PRIMARY KEY): Event ID único emitido pelo iFood.
* `code` (TEXT NOT NULL): Código do evento (ex: `PLC` - Placed, `CFM` - Confirmed, `DIS` - Dispatched, `CAN` - Cancelled).
* `order_id` (TEXT): UUID do pedido.
* `merchant_id` (TEXT): ID do restaurante na plataforma iFood.
* `payload` (TEXT): Conteúdo bruto do evento.
* `created_at` (DATETIME)

---

## 4. Módulo Back-End e Rotas da API

O servidor opera em `server.js` com roteador customizado e zero dependências externas para roteamento.

### 4.1. Autenticação e Sessão
* `POST /api/auth/login`: Autentica o motoboy por telefone e senha. Retorna dados do entregador e Token HMAC.
* `POST /api/auth/register`: Cadastro público de novo entregador via app (cria cadastro como `pendente` ou `aprovado` conforme política).
* `POST /api/auth/admin-login`: Autentica a administração/cozinha via senha master do restaurante.
* `POST /api/auth/session-token`: Validação e renovação contínua de token de sessão sem interrupção de uso.
* `POST /api/auth/admin-alterar-senha`: Permite ao administrador alterar a senha master do painel (Requer Admin).

### 4.2. Gestão de Pedidos
* `GET /api/pedidos/disponiveis`: Lista pedidos no balcão prontos para retirada, filtrados pelo grupo do motoboy autenticado.
* `POST /api/pedidos/retirar`: O motoboy assume a entrega do pedido com um toque. Move status de `disponivel` para `em_rota`, carimba `data_inicio` e vincula o `motoboy_id`.
* `POST /api/pedidos/finalizar`: Conclui a entrega. Move status de `em_rota` para `entregue` e carimba `data_fim`.
* `POST /api/pedidos/abandonar`: Permite ao motoboy devolver a entrega ao balcão caso tenha retirado por engano. O pedido volta a ficar `disponivel` para outros entregadores.
* `GET /api/pedidos/motoboy`: Retorna o histórico de entregas e a entrega ativa do motoboy logado.
* `GET /api/motoboy/rendimentos`: Consolida os ganhos de taxas do motoboy logado por período (`hoje`, `semana`, `mes`).
* `POST /api/motoboys/chave-pix`: Atualiza a Chave PIX do entregador.

### 4.3. Rastreamento e Telemetria GPS
* `POST /api/motoboy/posicao`: Endpoint REST que recebe coordenadas `{ latitude, longitude, velocidade }` do App PWA.
* `GET / POST /api/traccar/location`: Endpoint padrão do protocolo Traccar Client / OsmAnd, processando dados de GPS em segundo plano com filtro de ruído estacionário.

### 4.4. Administração e Cozinha (Requer Token Admin)
* `GET /api/admin/stats`: Métricas resumidas de pedidos, entregadores e taxas do turno.
* `GET /api/admin/pedidos`: Lista completa de pedidos em tempo real para o Kanban do Admin.
* `GET /api/admin/posicoes-mapa`: Coordenadas em tempo real de todos os motoboys cadastrados.
* `GET /api/admin/historico`: Relatório detalhado de corridas concluídas com tempo de viagem.
* `GET /api/admin/historico/rota`: Pontos geográficos GPS para desenhar a linha do trajeto no mapa.
* `GET /api/admin/fechamento`: Balanço financeiro de taxas a repassar, agrupado por motoboy e por grupo (VELOZ / SPEED).
* `POST /api/admin/confirmar-pagamento`: Registra o pagamento efetuado ao motoboy.
* `POST /api/admin/pedidos/manual`: Lançamento manual de pedidos de balcão ou telefone.
* `POST /api/admin/pedidos/atribuir`: Atribuição forçada de um pedido a um motoboy específico pela gerência.
* `POST /api/admin/pedidos/alterar-taxa`: Ajuste manual da taxa de entrega de um pedido.
* `POST /api/admin/pedidos/descartar`: Cancelamento / exclusão definitiva de pedido indevido.
* `POST /api/admin/pedidos/limpar-pendentes-antigos`: Expira entregas pendentes de dias anteriores.
* `POST /api/admin/motoboys/verificar-senha`: Validação de senha para liberar acesso à aba sensível de Motoboys.
* `POST /api/admin/motoboys/cadastrar`: Cadastro de motoboy realizado diretamente pela gerência.
* `POST /api/admin/motoboys/atualizar`: Edição de dados, grupo (VELOZ/SPEED) ou senha do entregador.
* `POST /api/admin/motoboys/aprovar`: Aprovação de novos entregadores cadastrados via App.
* `POST /api/admin/motoboys/recusar` / `excluir`: Bloqueio ou remoção de entregadores.
* `GET /api/admin/taxas` e `POST /api/admin/taxas/atualizar`: Leitura e alteração da tabela de taxas por bairro.

### 4.5. Webhooks Oficiais de Integração
* `GET / POST / HEAD /api/ifood/webhook`: Recepção contínua e validação de eventos da API iFood.
* `GET / POST /api/99food/webhook`: Recepção e processamento de pedidos multi-loja da 99Food.

---

## 5. Regras de Negócio e Cálculo Automático de Taxas

O módulo `src/utils/rateResolver.js` resolve o bairro e a taxa correta para cada entrega de forma automática:
* **Tabela Oficial com mais de 50 Bairros Mapeados:** Várzea, Alto, Barra do Imbuí, Tijuca, Vale do Paraíso, Comary, Granja Guarani, Albuquerque, Ermitage, Meudon, Golf, Posse, etc.
* **Tolerância Avançada a Impressão Térmica (Fuzzy Matching):** Mapeamento com correção de espaços quebrados em comandas (ex: `"Al to"`, `"Varz ea"`, `"Ermit ag"`, `"Vila Nova"`).
* **Diferenciação por Grupo:** Cada bairro possui valor configurado independentemente para os entregadores do grupo **VELOZ** e para o grupo **SPEED**.
* **Cache em Memória Resiliente:** As tabelas de taxas são sincronizadas no startup do servidor e mantidas em memória RAM, impedindo consultas repetitivas ao banco durante a chegada de pedidos.
* **Turno Noturno Operacional Estendido:** O sistema considera o turno das entregas ativo das **10h00 da manhã até as 02h00 da madrugada** do dia seguinte, evitando que pedidos da noite se misturem ou sejam fechados indevidamente à meia-noite.

---

## 6. Módulo Front-End: Painel Administrativo e Cozinha

Localizado em `public/admin.html`, o painel é uma Single Page Application (SPA) ultrarrápida, com visual moderno em modo escuro (Dark Theme) e identidade visual dourada da marca **Ao Ponto Carnes & Massas**.

### 6.1. Barra Superior e Ações Globais
* **Logo Ao Ponto Carnes:** Identidade visual com o slogan da marca.
* **Badge de Status da Conexão:** Indicador verde pulsante que atesta comunicação com o servidor e atualizações automáticas via polling de 5 segundos.
* **Botão "Novo Pedido" (`abrirModalNovoPedido()`):** Abre o modal para cadastro de pedidos manuais (pedidos de telefone, WhatsApp ou balcão).
* **Botão "Taxas" (`abrirModalTabelaTaxas()`):** Abre o editor visual da tabela de repasse por bairro para os grupos VELOZ e SPEED.
* **Botão "Senha" (`abrirModalAlterarSenha()`):** Permite alterar a senha de acesso ao painel admin.
* **Botão "Limpar" (`limparPendentesAntigos()`):** Limpa com um clique pedidos não entregues de turnos passados.
* **Botão "Atualizar" (`carregarTudo(true)`):** Força a atualização manual de todas as abas e métricas.
* **Botão "Sair" (`realizarLogoutAdmin()`):** Encerra a sessão administrativa e bloqueia a tela com o modal de login.

---

### 6.2. Navegação Lateral (Sidebar)
A barra lateral permite alternar entre 6 visões operacionais especializadas:

```
[Início] ───► Dashboard com Resumo e Métricas Operacionais
[Pedidos] ──► Kanban de Pedidos (Balcão, Em Rota, Entregues)
[Mapa] ─────► Rastreamento GPS ao vivo dos Motoboys
[Motoboys] ─► Gestão de Entregadores, Grupos e Aprovações (Protegido)
[Histórico] ► Auditoria de Corridas com Traçado da Rota
[Fechamento]► Prestação de Contas, Repasse de Taxas e Baixa PIX
```

---

### 6.3. Visão 1: Início (Dashboard / Visão Geral)
* **Cards de Indicadores de Desempenho (KPIs):**
  * *Pedidos Hoje:* Quantidade total de pedidos gerados no turno.
  * *Entregadores Ativos:* Quantidade de motoboys conectados e transmitindo GPS.
  * *Em Rota:* Quantidade de entregas na rua neste instante.
  * *No Balcão:* Quantidade de pedidos aguardando retirada.
  * *Total em Taxas:* Montante financeiro acumulado das taxas de entrega a serem repassadas.
* **Feed Rápido da Cozinha:** Atalho para os últimos pedidos despachados e tempo decorrido.

---

### 6.4. Visão 2: Pedidos (Kanban e Lista de Produção)
* **Filtros Rápidos por Status:**
  * Botão **"Todos"** (`filtrarStatusLista('todos')`): Exibe todos os pedidos do turno.
  * Botão **"No Balcão"** (`filtrarStatusLista('disponivel')`): Filtra pedidos prontos que aguardam motoboy.
  * Botão **"Em rota"** (`filtrarStatusLista('em_rota')`): Filtra entregas em trânsito com o nome do motoboy responsável em destaque.
  * Botão **"Entregues"** (`filtrarStatusLista('entregue')`): Filtra os pedidos finalizados com sucesso.
* **Campo de Busca:** Permite localizar qualquer pedido por número, nome do cliente ou logradouro com resposta instantânea.
* **Cards de Pedido Interativos:**
  * *Badge da Origem:* Etiqueta vermelha para **iFood**, amarela para **99Food**, azul para **Balcão/Manual**.
  * *Badge do Grupo:* Identificação se o pedido é exclusivo para entregadores **VELOZ** ou **SPEED**.
  * *Dados do Destinatário:* Nome, Telefone, Endereço e Bairro.
  * *Taxa de Entrega:* Exibição clara do valor em R$ calculado para o bairro.
  * *Botão "Atribuir Entregador" (`abrirModalAtribuirEntregador(id)`):* Abre modal para forçar a entrega para um motoboy específico da casa.
  * *Botão "Alterar Taxa":* Permite ajustar o valor da taxa do pedido caso haja cobrança diferenciada.
  * *Botão "Descartar":* Remove o pedido da esteira caso tenha sido cancelado pelo cliente.
  * *Botão "Ver Itens / Comanda":* Abre a visualização detalhada da comanda com todos os itens do pedido.

---

### 6.5. Visão 3: Mapa & Rotas (Rastreamento Geográfico ao Vivo)
* **Visualizador Leaflet:** Mapa estilizado com visual escuro de alto contraste.
* **Marcadores Dinâmicos de Motoboys:**
  * Ícone verde para motoboy com entrega em andamento.
  * Ícone dourado para motoboy disponível / parado na loja.
  * Popup interativo ao clicar no motoboy com nome, telefone, velocidade instantânea e tempo desde a última transmissão de GPS.
* **Botão "Enquadrar Todos" (`focarTodosMotoboys()`):** Ajusta o zoom e a centralização do mapa automaticamente para exibir todos os motoboys e o restaurante em uma única tela.
* **Botão "Loja Matriz" (`centralizarRestaurante()`):** Centraliza imediatamente a visão sobre a loja do Ao Ponto Carnes.
* **Card Flutuante de Corrida:** Exibe a entrega selecionada com endereço de destino e botão **"Detalhes >"**.

---

### 6.6. Visão 4: Motoboys (Controle de Entregadores — Área Protegida)
* **Barreira de Proteção:** Exige senha master de gerência para exibição dos dados. Botão **"DESBLOQUEAR ACESSO"** (`desbloquearAbaMotoboys()`).
* **Botão "Bloquear" (`bloquearAbaMotoboys()`):** Bloqueia a visualização novamente a qualquer momento para evitar olhares indesejados no balcão.
* **Sub-abas de Organização:**
  * Botão **"Entregadores Ativos"** (`alternarSubabaMotoboys('ativos')`): Lista motoboys com acesso liberado ao sistema.
  * Botão **"Cadastros Pendentes"** (`alternarSubabaMotoboys('pendentes')`): Exibe novos motoboys que baixaram o app e fizeram o cadastro, aguardando aprovação. Acompanha badge vermelho na sidebar com a quantidade pendente.
* **Filtros por Grupo:**
  * Botões **"Todos"**, **"VELOZ"**, **"SPEED"** para visualização segmentada.
* **Botão "Novo Entregador" (`abrirModalCadastrarMotoboy()`):** Cadastra manualmente um novo motoboy informando Nome, Telefone, Senha e Grupo.
* **Ações por Card de Motoboy:**
  * *Botão "Aprovar":* Libera o acesso de um motoboy pendente.
  * *Botão "Recusar":* Rejeita o cadastro de um solicitante.
  * *Botão "Editar":* Altera dados cadastrais, redefine a senha ou troca o motoboy de grupo (ex: de VELOZ para SPEED).
  * *Botão "Excluir":* Remove o motoboy da base.

---

### 6.7. Visão 5: Histórico de Entregas
* **Lista Completa de Corridas Finalizadas:**
  * Exibição do número do pedido, motoboy executor, horário de saída da loja e horário de entrega ao cliente.
  * **Tempo de Viagem Calculado:** Exibe o tempo decorrido exato da corrida (ex: *14 minutos*).
* **Botão "Ver Rota no Mapa" (`carregarRotaHistorico(pedidoId)`):** Ao clicar em qualquer entrega, o mapa traça a rota real percorrida pelo motoboy com linha neon e pontos intermediários, permitindo auditoria de percurso.

---

### 6.8. Visão 6: Fechamento (Módulo Financeiro e Repasse de Taxas)
* **Filtros por Período de Apuração:**
  * Botão **"Hoje"** (`selecionarPeriodoFechamento('hoje')`)
  * Botão **"Ontem"** (`selecionarPeriodoFechamento('ontem')`)
  * Botão **"Esta Semana"** (`selecionarPeriodoFechamento('semana')`)
  * Botão **"Este Mês"** (`selecionarPeriodoFechamento('mes')`)
  * Botão **"Personalizado"** (`selecionarPeriodoFechamento('personalizado')`): Abre seletores de data inicial e final com botão **"Consultar Período"**.
  * Botão **"Todos"** (`selecionarPeriodoFechamento('todos')`)
* **Filtros por Grupo Operacional:**
  * Botões **"Todos Grupos"**, **"VELOZ"**, **"SPEED"**.
* **Painel Resumo:**
  * Total de entregas do período selecionado.
  * Montante bruto total de taxas a pagar.
* **Tabela de Acerto por Motoboy:**
  * Nome do Entregador e Grupo.
  * Quantidade de entregas realizadas.
  * Valor total de taxas a repassar (R$).
  * Chave PIX cadastrada (para cópia rápida no aplicativo bancário da loja).
  * **Botão "Confirmar Pagamento" (`confirmarPagamentoMotoboy(id)`):** Registra que o acerto daquele motoboy foi quitado no banco de dados, marcando o status como pago.
* **Botão "Imprimir" (`imprimirFechamento()`):** Abre a folha de prestação de contas formatada especificamente para impressão em impressora A4 ou salvamento em PDF.

---

### 6.9. Modais do Painel Administrativo
1. **Modal "Novo Pedido" (`modalNovoPedido`):** Formulário com campos: Origem (Manual, Telefone, WhatsApp), Número do Pedido, Nome do Cliente, Telefone, Endereço de Entrega, Bairro (com seleção inteligente que sugere o valor de taxa oficial), Taxa de Entrega (preenchida automaticamente ou editável) e Campo de Observações/Itens.
2. **Modal "Tabela de Taxas" (`modalTabelaTaxas`):** Alternância entre as abas **VELOZ** e **SPEED**, listando todos os 58 bairros de Teresópolis com campo de valor editável em Reais e botão **"Salvar Alterações"**.
3. **Modal "Alterar Senha do Admin" (`modalAlterarSenha`):** Campos: Senha Atual, Nova Senha e Confirmação de Nova Senha.
4. **Modal "Cadastrar Entregador" (`modalCadastrarMotoboy`):** Nome, Telefone (com máscara), Senha de Acesso e Seleção do Grupo Logístico.
5. **Modal "Atribuir Entregador" (`modalAtribuirEntregador`):** Seleção suspensa com todos os motoboys ativos para despacho direto de pedidos da cozinha.

---

## 7. Módulo Front-End: Aplicativo Mobile do Motoboy (PWA)

Localizado em `public/motoboy.html`, foi desenvolvido com padrão **Mobile-First**, projetado para ser usado com uma só mão em suportes de moto ou com luvas.

### 7.1. Características Técnicas do App
* **Instalável (PWA):** Suporta instalação como aplicativo na tela inicial do celular através do arquivo `manifest-motoboy.json`.
* **Screen Wake Lock API:** O aplicativo solicita permissão ao sistema operacional para **manter a tela do smartphone sempre acesa** enquanto houver corrida em andamento, impedindo que o aparelho bloqueie durante a pilotagem.
* **Transmissão Contínua de GPS:** O app ativa o geolocalizador com alta precisão (`enableHighAccuracy: true`) e transmite a posição a cada intervalo pré-determinado para o servidor.

---

### 7.2. Tela de Autenticação (Login e Cadastro)
* **Botão "Entrar" (`trocarAbaAuth('login')`):** Formulário com campos: Telefone e Senha. Botão **"ENTRAR NO SISTEMA"**.
* **Botão "Cadastrar" (`trocarAbaAuth('register')`):** Formulário de autocadastro para novos entregadores com campos: Nome Completo, Telefone, Senha e Seleção do Grupo (**VELOZ** ou **SPEED**). Botão **"CRIAR CADASTRO"**.
* **Aviso de Cadastro Pendente:** Caso a empresa configure aprovação manual, o app exibe tela amigável informando que o cadastro foi enviado e aguarda liberação da gerência na cozinha.

---

### 7.3. Barra Inferior de Navegação (Bottom Bar)
A navegação do aplicativo do entregador possui 4 abas acessíveis pelo polegar:

```
[Início] ────► Minha Entrega Ativa / Navegação GPS
[Balcão] ────► Pedidos Prontos para Retirada
[Mapa] ──────► Visão de Rota e Localização
[Perfil] ────► Chave PIX, Rendimentos e Extrato
```

---

### 7.4. Aba 1: Início (Corrida em Andamento)
Quando o motoboy retira um pedido, esta aba se transforma na central da corrida:
* **Identificação do Pedido:** Código grande em destaque (ex: `#4921`).
* **Origem e Bairro:** Badge colorido da plataforma (iFood / 99Food) e o bairro de destino com o valor da taxa a receber em destaque (ex: `+ R$ 10,00`).
* **Endereço Completo:** Rua, número e ponto de referência.
* **Botão "Navegar no Waze / Maps":** Abre diretamente o aplicativo de GPS instalado no celular (Waze ou Google Maps) com as coordenadas e endereço do cliente já preenchidos.
* **Bloco de Contato do Cliente:**
  * *Botão de Ligação Telefônica Direta:* Disca imediatamente para o número do cliente (`tel:XXXXXXXXX`).
  * *Botão "Copiar PIN / Localizador":* Se o pedido exigir código de confirmação (comum no iFood), o botão copia o código com um toque para a área de transferência com confirmação visual.
* **Botão "SIM, ENTREGUE" (`confirmarFinalizarPedido()`):** Finaliza a entrega. Abre modal de confirmação com botão de segurança para evitar cliques acidentais no bolso da jaqueta.
* **Botão "Abandonar Entrega" (`abandonarPedido()`):** Permite devolver o pedido para o balcão caso tenha retirado o pacote errado.

---

### 7.5. Aba 2: Balcão (Pedidos Disponíveis)
* **Contador de Pedidos no Balcão:** Exibe quantos pacotes estão prontos para saída no restaurante.
* **Barra de Pesquisa:** Permite filtrar pedidos digitando o número ou bairro, com botão de limpeza rápida `✕`.
* **Cards de Pedidos Disponíveis:**
  * Exibição do número do pedido, bairro, endereço e valor da taxa.
  * Pedidos são filtrados automaticamente de acordo com o grupo do motoboy (pedidos para VELOZ aparecem para a equipe Veloz; pedidos para SPEED aparecem para a equipe Speed).
* **Botão "RETIRAR PEDIDO" (`assumirPedido(id)`):** Vincula a entrega ao motoboy instantaneamente no banco de dados, remove o pedido do balcão de todos os outros motoboys, ativa o rastreador GPS da rota e abre a tela de navegação da corrida.

---

### 7.6. Aba 3: Mapa
* Exibe a localização geográfica atual do motoboy e a rota traçada sobre o mapa interativo.

---

### 7.7. Aba 4: Perfil (Rendimentos e Configurações)
* **Identificação do Entregador:** Nome, Telefone e Grupo ao qual pertence.
* **Campo de Cadastro da Chave PIX:** Permite ao entregador cadastrar e atualizar sua chave PIX (CPF, Telefone, E-mail ou Chave Aleatória) para recebimento das taxas pela administração.
* **Painel de Rendimentos e Extrato:**
  * Filtros de período: Botões **"Hoje"**, **"Esta Semana"**, **"Este Mês"**.
  * Card de Total Acumulado em Taxas (R$).
  * Quantidade de corridas realizadas no período selecionado.
* **Botão "Sair do Sistema" (`realizarLogout()`):** Desconecta o entregador e encerra a transmissão de GPS.

---

## 8. Aplicativo Android Nativo em Segundo Plano

Localizado na pasta `android/`, o projeto conta com uma implementação nativa em Java/Android SDK para contingência e rastreamento em segundo plano rigoroso:
* **Pacote:** `br.com.aoponto.motoboy`
* **Serviço em Segundo Plano (`LocationService.java`):** Serviço Android do tipo `ForegroundService` com notificação persistente obrigatória, impedindo que o gerenciador de bateria do Android (Doze Mode) feche o aplicativo quando o celular estiver no bolso ou com a tela desligada.
* **WebView Otimizada (`MainActivity.java`):** Carrega a interface PWA diretamente com aceleração de hardware e pontes de JavaScript nativas para captura de coordenadas GPS.

---

## 9. Integrações Externas (iFood, 99Food e Traccar)

### 9.1. Integração Oficial iFood v2
* **Conexão Direta via API:** Comunicação com os servidores oficiais do iFood via credenciais OAuth2 de Merchant.
* **Tratamento de Eventos em Tempo Real:**
  * `PLC` (Placed) / `COR` (Created): Pedido entra no sistema e calcula automaticamente o bairro e a taxa.
  * `CFM` (Confirmed): Cozinha confirma o preparo.
  * `DIS` (Dispatched): Pedido despachado para entrega.
  * `CAN` (Cancelled): Pedido cancelado é baixado do painel.
* **Anti-Duplicação Estrita:** A tabela `ifood_events` audita cada UUID de evento recebido, garantindo que o mesmo pedido nunca entre duplicado na cozinha.

### 9.2. Integração 99Food
* **Webhook Multi-Loja:** Suporta o recebimento de pedidos de múltiplas filiais da 99Food com badges de identificação da loja no card do pedido.
* **Captura de PIN de Entrega:** Extração automática do código localizador exigido pelo cliente no ato do recebimento.

### 9.3. Protocolo Traccar Client
* Suporta o envio padrão de telemetria compatível com o aplicativo mundial Traccar Client através da URL:
  `GET/POST https://sistrastreamento.app/api/traccar/location?id={DEVICE_ID}&lat={LAT}&lon={LON}&speed={SPEED}`

---

## 10. Instruções de Acesso e Download

Este documento está disponível em formato Markdown (`.md`) para leitura técnica, auditoria e download nos seguintes locais do projeto:

1. **Download Direto pelo Servidor Web:**
   * Acesse a rota pública: `https://[seu-dominio-ou-vercel]/DOCUMENTACAO_SISTRASTREAMENTO.md`
2. **Arquivo no Repositório Local:**
   * Raiz: `DOCUMENTACAO_SISTRASTREAMENTO.md`
   * Pasta Pública: `public/DOCUMENTACAO_SISTRASTREAMENTO.md`

---
*Documentação elaborada com base no código-fonte, arquitetura de banco de dados e testes de integração do projeto Sistrastreamento — Ao Ponto Carnes & Massas.*
