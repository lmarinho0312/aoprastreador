# 📖 GUIA PRÁTICO OPERACIONAL — SISTEMA DE ENTREGAS AO PONTO
**Restaurante Ao Ponto Carnes • Loja Matriz Teresópolis/RJ**  
*Material de Treinamento e Operação Diária para Cozinha, Expedição e Entregadores*

---

## 📌 SUMÁRIO RÁPIDO PARA A EQUIPE

1. **[MÓDULO 1: MANUAL DA COZINHA E EXPEDIÇÃO (Despache e Gestão)](#módulo-1-manual-da-cozinha--expedição-despache-e-gestão)**
   - Perfil do Leitor & Acesso ao Painel
   - Fluxo Passo a Passo: da Chegada da Comanda ao Despacho
   - A Regra Vital: Direcionamento para Equipes VELOZ ou SPEED
   - Como Atribuir um Motoboy Manualmente
   - Gestão de Imprevistos: Cancelamento, Trocas e Atrasos
   - Fechamento de Caixa e Repasse aos Motoboys
   - As 5 Regras de Ouro da Cozinha & Expedição
2. **[MÓDULO 2: MANUAL DO ENTREGADOR (MOTOBOY)](#módulo-2-manual-do-entregador-motoboy)**
   - Perfil do Leitor & Acesso Rápido no Celular
   - Como Acessar e Manter o GPS Ativo
   - Como Visualizar e Retirar Pedidos no Balcão
   - Como Realizar a Rota com Google Maps ou Apple Maps
   - Como Contatar o Cliente ou Central (iFood / 99Food com PIN)
   - Como Finalizar a Entrega Corretamente
   - Procedimentos de Emergência na Rua
   - As 5 Regras de Ouro do Entregador
3. **[TABELA DE PAREDE: STATUS DO PEDIDO E CORES](#tabela-de-parede-o-que-significa-cada-cor-e-etapa)**

---

<div style="page-break-after: always;"></div>

# MÓDULO 1: MANUAL DA COZINHA / EXPEDIÇÃO (Despache e Gestão)

**Público-alvo:** Cozinheiros, Embaladores, Expedidores e Operadores de Caixa.  
**Objetivo:** Garantir que nenhum pedido fique esquecido, direcionar cada comanda para a equipe correta e acompanhar os motoboys no mapa em tempo real.

---

### 1. Como Acessar o Painel da Cozinha
1. No computador ou tablet da expedição, abra o navegador Google Chrome.
2. Acesse o endereço do sistema: `http://localhost:3000/admin.html` (ou o link web oficial da loja).
3. Na tela escura com o título **`[Painel da Cozinha]`**, digite:
   - **Usuário:** seu usuário de operador (ex: `admin` ou `cozinha`).
   - **Senha:** sua senha de acesso diária.
4. Clique no botão dourado **`[ENTRAR NO PAINEL]`**.
5. No rodapé da barra lateral esquerda, verifique se está escrito **`● Sistema Online`** em verde. Se estiver verde, a comunicação está ativa e funcionando.

💡 **DICA RÁPIDA:** O painel se atualiza sozinho a cada 5 segundos. Não é necessário ficar apertando F5 na página para ver novas comandas!

---

### 2. Identificação de Novos Pedidos (Chegada das Comandas)
Os pedidos entram no sistema de duas maneiras:

#### Modo A: Entrada Automática via Impressora (Spooler de Comandas)
- Assim que o pedido é impresso na impressora térmica Epson da comanda (seja vindo de **iFood**, **99Food**, **Cardápio Web** ou **PDV de Balcão**), o sistema captura a impressão automaticamente.
- O pedido surge imediatamente no topo da coluna **`Pedidos em andamento`** (na tela inicial) e na primeira coluna do **`[Pedidos]`** (Kanban).

#### Modo B: Lançamento Manual (Pedidos por WhatsApp ou Balcão Avulso)
1. No canto superior direito do painel, clique no botão dourado **`[+ Novo Pedido]`**.
2. No formulário que abrir, preencha:
   - **Origem:** escolha `WhatsApp`, `iFood`, `99Food` ou `Balcão / Telefone`.
   - **Nº Pedido:** digite o número da comanda (ex: `1042`).
   - **Grupo Destino:** selecione `VELOZ`, `SPEED` ou deixe em `Aguardar`.
   - **Nome do Cliente:** nome completo ou primeiro nome do cliente.
   - **Telefone / WhatsApp:** com DDD (ex: `21999998888`).
   - **Endereço de Entrega:** Rua, número e complemento.
   - **Bairro:** selecione ou digite o bairro correto (ex: `Alto`, `Várzea`, `Comary`).
   - **Taxa Entrega (R$):** valor oficial da taxa.
3. Clique em **`[Lançar Pedido]`**.

⚠️ **ATENÇÃO:** Sempre preencha o **Bairro** com precisão! O sistema utiliza o bairro para calcular o valor de repasse exato do motoboy conforme a tabela oficial de Teresópolis.

---

### 3. A Ação Mais Importante da Cozinha: Direcionar o Grupo (`VELOZ` ou `SPEED`)
O restaurante Ao Ponto trabalha com duas frentes de entrega: a equipe **VELOZ** (tabela padrão) e a equipe **SPEED** (tabela speed).

Quando uma comanda entra automaticamente, ela surge com uma etiqueta pulsante vermelha:  
`[DESTINAR: SPEED | VELOZ]` ou `[Pendente de Grupo]`.

1. Olhe para o pedido na tela ou no Kanban.
2. Identifique qual equipe deve fazer a entrega:
   - Clique no botão amarelo **`[SPEED]`** para mandar para os motoboys da equipe SPEED; ou
   - Clique no botão azul **`[VELOZ]`** para mandar para os motoboys da equipe VELOZ.
3. Se precisar transferir depois, basta clicar em cima da etiqueta `[SPEED ⇄]` ou `[VELOZ ⇄]` para alternar.

⚠️ **ATENÇÃO MÁXIMA:**  
**Enquanto a cozinha NÃO clicar em `[SPEED]` ou `[VELOZ]`, o pedido NÃO APARECE NO APLICATIVO DE NENHUM MOTOBOY!**  
Nunca deixe pedidos com a etiqueta vermelha "DESTINAR". Defina o grupo no mesmo instante em que a comanda for colocada na chapa/bancada.

---

### 4. Como Acompanhar o Preparo e Marcar "Pronto no Balcão"
1. No menu lateral esquerdo, clique em **`[Pedidos]`** para ver as 3 colunas de produção:
   - **Coluna 1 (Azul):** `No Balcão (Aguardando Retirada)`
   - **Coluna 2 (Dourada):** `Em Rota de Entrega`
   - **Coluna 3 (Verde):** `Entregues Hoje`
2. Enquanto o prato estiver sendo preparado e embalado, a comanda permanece na coluna **`No Balcão (Aguardando)`**.
3. Assim que o pacote estiver ensacado, grampeado e com o cupom fixado, coloque o pacote no balcão de saída.
4. O pedido já está visível para os motoboys daquele grupo no celular deles.

---

### 5. Como Atribuir um Motoboy Manualmente (Despacho pela Cozinha)
Geralmente o próprio motoboy clica em retirar no celular dele. Porém, se a cozinha quiser despachar o pedido diretamente para um motoboy específico:

1. Localize o card do pedido na tela inicial ou no Kanban.
2. Clique no botão **`[Atribuir Entregador]`** no próprio card (ou clique no pedido para abrir a gaveta lateral).
3. Na janela que se abrirá:
   - O sistema mostra o número do pedido, cliente, endereço e grupo.
   - No campo **`Selecione o Entregador Disponível`**, abra a lista e escolha o motoboy (o sistema prioriza os entregadores que pertencem ao mesmo grupo do pedido).
   - No campo **`Status Inicial`**, selecione:
     - `Em Rota (saiu para entrega)`: se o motoboy já pegou a bolsa e saiu;
     - `Pronto no Balcão`: se o pedido está reservado para ele, mas ele ainda não montou na moto.
4. Clique no botão dourado **`[Confirmar]`**.
5. O pedido mudará imediatamente para a cor dourada com status **`Em rota`**, e o motoboy passará a ser rastreado no mapa.

💡 **DICA RÁPIDA:** Para ver onde estão os motoboys no trânsito, clique na aba **`[Início]`** ou **`[Mapa & Rotas]`**. Os pinos mostram a localização de cada motoboy, a velocidade em km/h e quantos pedidos ele está carregando.

---

### 6. Como Proceder em Cancelamentos, Atrasos ou Alterações
1. **Se o cliente ligar cancelando:**
   - Clique sobre o pedido no painel para abrir a **Gaveta de Detalhes**.
   - No rodapé da gaveta, clique no botão vermelho **`[Cancelar Pedido]`**.
   - Confirme a mensagem. O pedido sairá das rotas ativas e não gerará taxa indevida para o entregador.
2. **Se precisar falar com o cliente com urgência:**
   - Abra a Gaveta de Detalhes do pedido.
   - Clique no botão verde **`[WhatsApp]`** no topo. O sistema abrirá uma conversa direta com o cliente com mensagem pronta referenciando o número do pedido.
3. **Se o motoboy tiver problemas mecânicos e precisar trocar de entregador:**
   - Abra a Gaveta de Detalhes do pedido em rota.
   - Clique no botão **`[Trocar Entregador]`**.
   - Escolha o novo motoboy e confirme. O sistema transfere a rota automaticamente.
4. **Se restaram comandas de dias anteriores na fila:**
   - No topo do cabeçalho, clique no botão **`[Limpar]`**. O sistema arquiva com segurança pedidos antigos pendentes sem afetar o faturamento.

---

### 7. Fechamento de Diária e Repasse aos Motoboys
Ao final do turno ou do dia:
1. No menu lateral esquerdo, clique em **`[Fechamento]`**.
2. Selecione o período desejado no topo: **`[Hoje]`**, **`[Ontem]`**, **`[Esta Semana]`** ou **`[Personalizado]`**.
3. Escolha se quer filtrar por **`[Todos Grupos]`**, apenas **`[VELOZ]`** ou apenas **`[SPEED]`**.
4. O painel exibirá:
   - **Total de Entregas Realizadas;**
   - **Total a Pagar em Taxas de Repasse (R$);**
   - **Cards individuais de cada motoboy**, mostrando quantas corridas ele fez e o valor exato a receber.
5. Para prestar contas com o motoboy, clique no botão verde **`[WhatsApp]`** no card dele. Uma mensagem detalhada com o total de entregas e o valor a pagar será enviada automaticamente para o celular dele!
6. Clique em **`[Imprimir]`** para emitir o relatório em papel para o operador de caixa.

---

### 🛑 AS 5 REGRAS DE OURO DA COZINHA E EXPEDIÇÃO

1. ⚠️ **NUNCA DEIXE PEDIDOS COM A ETIQUETA "DESTINAR":** Sem definir `[VELOZ]` ou `[SPEED]`, o motoboy não recebe a comanda na tela do celular e o pacote esfria no balcão.
2. ⚠️ **CONFERÊNCIA DUPLA DE PACOTE E COMANDA:** Antes de despachar, confira o número impresso na comanda com o número exibido na tela `#XXXX`.
3. ⚠️ **ATENÇÃO AO PIN / LOCALIZADOR (IFOOD E 99FOOD):** Se a comanda contiver código de confirmação ou PIN (ex: 4 dígitos), certifique-se de que ele esteja visível no pacote para o motoboy solicitar ao cliente.
4. ⚠️ **DESPACHO IMEDIATO:** Não marque o pedido como "Em Rota" 10 minutos antes de o motoboy sair. Marque apenas quando a bag estiver fechada e a moto arrancando.
5. ⚠️ **BAIRRO CORRETO = PAGAMENTO CORRETO:** Em pedidos manuais, jamais deixe o campo de bairro em branco ou genérico.

---

<div style="page-break-after: always;"></div>

# MÓDULO 2: MANUAL DO ENTREGADOR (MOTOBOY)

**Público-alvo:** Entregadores externos e mensageiros da casa (Ao Ponto Carnes).  
**Formato:** Otimizado para visualização rápida no celular (telas verticais, manuseio com luvas ou uma mão).

---

### 1. Como Abrir o Aplicativo e Fazer Login
1. No navegador do seu celular (Chrome ou Safari), abra o link fornecido pelo restaurante:  
   👉 **`http://.../motoboy.html`** (adicione o link aos seus *Favoritos* ou *Adicionar à Tela de Início* do celular).
2. Na tela inicial com o logotipo **Ao Ponto Carnes**:
   - **Telefone:** Digite seu DDD + número de celular cadastrado (somente números, ex: `21990378175`).
   - **Senha:** Digite sua senha de acesso.
   - Clique em **`[ENTRAR NO SISTEMA]`**.
3. **Primeira vez na equipe?** Clique na aba **`[Cadastrar]`**, digite seu Nome Completo, Telefone com DDD, escolha uma senha e clique em **`[CRIAR CADASTRO]`**. Informe à gerência para aprovar seu grupo (**VELOZ** ou **SPEED**).

💡 **DICA RÁPIDA (TELA NÃO APAGA):** O aplicativo do Ao Ponto conta com tecnologia inteligente que **mantém a tela do seu celular sempre acesa** durante a rota, para que você não precise ficar tocando na tela com as luvas enquanto pilota!

---

### 2. Identificação do Grupo e Status do GPS
Assim que entrar no app, olhe no topo da tela:
- Ao lado do seu nome, há uma etiqueta com o seu grupo: **`[VELOZ]`** (azul) ou **`[SPEED]`** (amarelo). Você só receberá pedidos destinados ao seu grupo.
- Abaixo do seu nome, certifique-se de que a bolinha verde está piscando com a mensagem **`● GPS Ativo`**.
- Se o navegador pedir permissão de localização, selecione **"Permitir durante o uso do app"** ou **"Permitir sempre"**. É esse GPS que mostra sua rota para a cozinha e agiliza a liberação dos próximos pedidos.

---

### 3. Como Visualizar e Retirar Pedidos no Balcão
Quando você chegar ao restaurante para retirar pedidos:

1. Na barra inferior preta do app, toque no ícone da caixinha **`[Balcão]`**.
2. O número em vermelho indica quantos pedidos prontos estão esperando saída.
3. Cada pedido no balcão exibe:
   - **Número do Pedido:** (ex: `#8830`);
   - **Plataforma:** (ex: `iFood`, `99 Food`, `WhatsApp`);
   - **Nome do Cliente e Endereço Completo com Bairro;**
   - **Taxa Oficial de Repasse:** em verde (ex: `R$ 10,00`);
   - **Localizador / PIN:** (quando exigido pela plataforma).
4. Localize a sacola física no balcão que tem o mesmo número da comanda.
5. Toque no botão dourado **`[RETIRAR PEDIDO]`**.
6. O sistema emitirá um aviso de sucesso e transferirá o pedido para a sua tela inicial de entrega ativa!

💡 **DICA RÁPIDA DE PESQUISA:** Tem muitos pedidos no balcão? Use o campo de busca no topo da aba Balcão e digite o número da comanda ou o nome do bairro para achar seu pacote em 1 segundo.

---

### 4. Fazendo a Corrida: Endereço, Rota e Contato
Toque na aba **`[Início]`** na barra inferior. Seu pedido dominante ativo aparecerá em destaque dentro de um card com bordas douradas.

#### A. Abrir Navegação GPS (Curva a Curva)
- No meio do card ativo, você verá o botão grande dourado:  
  **`[VER ROTA NO MAPA]`**.
- Ao tocar nele, seu celular abre diretamente o **Google Maps** (no Android) ou o **Apple Maps** (no iPhone) já com a rota traçada e navegação por voz pronta para iniciar!

#### B. Se For Pedido de Aplicativo (iFood / 99Food) com PIN / Código
- O card exibe uma caixa tracejada com o **`PIN / LOCALIZADOR`** em números gigantes (ex: `4892`).
- Ao chegar no cliente, peça para ele confirmar o código ou digite o código no teclado da central caso solicitado.
- Toque no botãozinho **`[Copiar]`** para colar o código rapidamente se necessário.

#### C. Se Precisar Ligar para a Central ou para o Cliente
- No próprio card, toque no botão verde grande:  
  **`[LIGAR: (XX) XXXXX-XXXX]`**
- O telefone disca automaticamente para a central do app ou para o cliente sem que você precise digitar número por número.

---

### 5. Como Finalizar a Entrega (Garantir seu Repasse)
Assim que entregar a sacola ao cliente e receber o pagamento (se for cobrança em dinheiro/máquina):

1. Abra o app Ao Ponto na aba **`[Início]`**.
2. No rodapé do card ativo, toque no botão vermelho:  
   **`[✓ FINALIZAR ENTREGA]`**.
3. Uma janela de confirmação perguntará: *"Confirmar conclusão do pedido #XXXX?"*.
4. Toque em **`[SIM, ENTREGUE]`**.
5. **Pronto!** O pedido sai da sua rota, a cozinha é notificada de que o cliente recebeu e a taxa é somada instantaneamente aos seus rendimentos do dia!
6. Se você estiver com mais de uma entrega na bag, o próximo pedido da fila assumirá automaticamente a tela principal.

---

### 6. Como Ver Seus Rendimentos e Ganhos do Dia
1. Na barra inferior, toque no ícone do usuário **`[Perfil]`**.
2. Toque nos botões **`[Hoje]`**, **`[Esta Semana]`** ou **`[Este Mês]`**.
3. O app mostrará na hora:
   - **Quantas entregas você finalizou;**
   - **O valor total acumulado que você tem a receber em reais (R$);**
   - Lista completa com o histórico de todos os endereços e taxas que você realizou.

---

### ⚠️ PROCEDIMENTOS DE EMERGÊNCIA NA RUA

| Situação de Problema | O que Fazer Imediatamente |
| :--- | :--- |
| **Endereço não encontrado ou sem número** | Pare a moto em local seguro. No card ativo, toque no botão verde **`[LIGAR]`** para falar com o cliente. Se não atender após 3 tentativas, acione a cozinha pelo WhatsApp. |
| **Cliente não atende o interfone / portaria** | Aguarde 5 minutos no local. Toque no botão de ligar. Notifique a expedição antes de retornar à loja com o pacote. |
| **Item avariado / vazamento na bag** | Não entregue pacote amassado ou derramado. Tire foto no celular, avise imediatamente a cozinha pelo WhatsApp para providenciar o refazimento do prato e aguarde instruções. |
| **Falta de troco ou maquininha sem sinal** | Peça para o cliente pagar via Pix da loja ou ligue para a cozinha para enviar a chave Pix ao cliente. Nunca deixe o produto sem confirmação de pagamento. |
| **Pane mecânica ou acidente** | Priorize sua integridade física! Avise a cozinha imediatamente no grupo para que outro motoboy assuma as entregas da sua fila pelo painel. |

---

### 🛑 AS 5 REGRAS DE OURO DO ENTREGADOR

1. ⚠️ **NÃO ESQUEÇA DE CLICAR EM `[RETIRAR PEDIDO]`:** Se você pegar o pacote no balcão e não clicar no app, a cozinha achará que o pedido está esquecido na loja e ninguém saberá quem levou.
2. ⚠️ **FINALIZE NO MOMENTO DA ENTREGA:** Clique em `[FINALIZAR ENTREGA]` na calçada do cliente. Deixar para finalizar horas depois bagunça o cálculo do fechamento diário da loja.
3. ⚠️ **MANTENHA A LOCALIZAÇÃO ATIVA:** Não desligue o GPS do celular. Ele garante a segurança da sua rota e agiliza a separação do próximo pedido enquanto você está voltando.
4. ⚠️ **CONFIRA O NÚMERO DO PACOTE:** Nunca retire uma sacola por intuição ou olhando apenas o nome do prato. Confira o **número impresso** na comanda com o número na tela do celular.
5. ⚠️ **CUIDADO COM O CÓDIGO/PIN:** Em pedidos iFood ou 99Food que exigem PIN, peça o código ao cliente **antes** de entregar o pacote na mão dele.

---

<div style="page-break-after: always;"></div>

# TABELA DE PAREDE: O QUE SIGNIFICA CADA COR E ETAPA?
*(Imprima esta folha e fixe na parede da cozinha ao lado da bancada de expedição)*

| Cor na Interface | Nome do Status | O que Significa na Prática? | Ação Necessária da Equipe |
| :---: | :---: | :--- | :--- |
| <span style="display:inline-block; width:16px; height:16px; background:#ef4444; border-radius:50%;"></span> **Vermelho Tracejado** | **DESTINAR GRUPO** (`Aguardando Grupo`) | O pedido foi impresso ou lançado, mas **ainda não tem equipe definida** (`VELOZ` ou `SPEED`). | **AÇÃO IMEDIATA DA COZINHA:** Clicar no botão `[SPEED]` ou `[VELOZ]` no card do pedido. Sem isso, o motoboy não vê a comanda! |
| <span style="display:inline-block; width:16px; height:16px; background:#3b82f6; border-radius:50%;"></span> **Azul Claro** | **NO BALCÃO** (`disponivel` / `aguardando_retirada`) | Comanda pronta e embalada no balcão, aguardando saída com o entregador. | O motoboy do grupo correspondente deve ir ao balcão, conferir o pacote e clicar em `[RETIRAR PEDIDO]` no celular. |
| <span style="display:inline-block; width:16px; height:16px; background:#f59e0b; border-radius:50%;"></span> **Amarelo / Dourado** | **EM ROTA** (`em_rota`) | O pedido saiu da loja e está a caminho do endereço do cliente na moto. | O motoboy segue pelo GPS. A cozinha acompanha o deslocamento pelo mapa ao vivo no painel do restaurante. |
| <span style="display:inline-block; width:16px; height:16px; background:#10b981; border-radius:50%;"></span> **Verde** | **ENTREGUE** (`entregue`) | A refeição foi entregue ao cliente com sucesso e a corrida foi concluída. | Nenhuma ação necessária. A taxa de repasse entra automaticamente no relatório de Fechamento do dia. |
| <span style="display:inline-block; width:16px; height:16px; background:#6b7280; border-radius:50%;"></span> **Vermelho / Cinza Escuro** | **CANCELADO / EXPIRADO** (`cancelado` / `expirado`) | O pedido foi cancelado pelo cliente/loja ou descartado na limpeza de pendências antigas. | O pedido é removido do mapa e das filas ativas sem gerar cobrança de repasse. |

---

### CONTATOS DE EMERGÊNCIA OPERACIONAL
- **Telefone / WhatsApp da Cozinha / Expedição:** `(21) 99037-8175`
- **Suporte ao Sistema Interno:** Plantão Operacional Ao Ponto Carnes
- **Endereço Loja Matriz:** Teresópolis / RJ
