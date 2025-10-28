# pao-do-mauro — Sistema de Organização Empresarial

Sistema completo para gestão de padarias familiares cobrindo vendas, produção, estoque, financeiro e relatórios.

## Requisitos
- Node.js 20+
- PostgreSQL 14+

## Configuração
1. Copie `.env.example` para `.env` e ajuste as variáveis.
2. Instale dependências: `npm install`.
3. Gere o cliente Prisma: `npx prisma generate`.
4. Aplique migrações: `npm run prisma:migrate`.
5. Popule dados de exemplo: `npm run prisma:seed`.

A senha do usuário administrador (`admin@paodomauro.com`) será exibida no terminal ao rodar o seed. No primeiro login será solicitado o reset.

### Variáveis de ambiente
| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | URL de conexão PostgreSQL (produção e desenvolvimento). |
| `NEXTAUTH_URL` | URL pública da aplicação. |
| `NEXTAUTH_SECRET` | Segredo criptográfico para assinar JWTs. |
| `AUTH_EMAIL_FROM` | Remetente dos e-mails transacionais. |
| `AUTH_EMAIL_SERVER` | Configuração SMTP para envio de e-mails (recuperação de senha). |
| `RATE_LIMIT_WINDOW_MS` | Janela de tempo do rate limiter em ms. |
| `RATE_LIMIT_MAX_API` | Requisições permitidas por janela para rotas API. |
| `RATE_LIMIT_MAX_LOGIN` | Tentativas permitidas por janela na rota de login. |

## Desenvolvimento
```bash
npm run dev
```

Acesse `http://localhost:3000`.

## Testes
```bash
npm run test
```

Os testes cobrem cálculos de custos e limites de requisições críticos para as regras de negócio. Adicione `DATABASE_URL` apontando para um banco isolado antes de criar testes de integração.

## Build e produção local
```bash
npm run build
npm run start
```

## Deploy na Render
O repositório inclui `Dockerfile` e `render.yaml`. Faça push para o GitHub e crie um serviço web no Render apontando para o repositório. O banco é provisionado automaticamente com base na configuração do arquivo de manifesto.

### Passos adicionais de deploy
1. Configure as variáveis de ambiente conforme a tabela acima.
2. Execute `npm run prisma:migrate` no dashboard da Render após o primeiro deploy para aplicar migrações.
3. Rode `npm run prisma:seed` para gerar dados demo e senha temporária do administrador.
4. Atualize o DNS para apontar para a URL fornecida pela Render, se necessário.

## Power BI
Conecte-se diretamente ao banco Postgres usando um usuário somente leitura. Utilize as views `dim_date`, `v_fct_sales`, `v_fct_production`, `v_fct_inventory`, `v_fct_expenses` e `v_fct_cashbook` para montar relatórios analíticos.

## Autenticação e Segurança
- NextAuth com login por e-mail/senha, TOTP opcional e códigos de backup.
- Bloqueio progressivo após tentativas de login falhas.
- Proteções ativas: CSRF, CSP estrita, rate limit, cookies seguros, rotação de JWT.
- Headers de segurança aplicados via middleware e `next.config.mjs`.

### Habilitar TOTP
1. Acesse `/settings` autenticado como administrador.
2. Gere um segredo TOTP e escaneie o QR Code no aplicativo autenticador de sua preferência.
3. Armazene os códigos de backup exibidos; eles permitem acesso mesmo sem o app autenticador.
4. Confirme o token e salve as alterações.

### Recuperação de senha
- Usuários solicitam acesso em `/login` através do link "Esqueci minha senha".
- Um e-mail é enviado com link temporário para redefinir a senha.
- Após o primeiro login com senha temporária (seed), o sistema exige alteração imediata.

## Fluxos principais
- **Pedidos**: Cadastro completo com pipeline de status, integração WhatsApp e sincronização offline.
- **Produção**: Planejamento e encerramento de lotes com baixa automática de insumos e controle de perdas.
- **Estoque**: Controle de entradas, ajustes, alertas de estoque mínimo e sugestão de compras.
- **Financeiro**: Caixa diário, registro de despesas, fechamento e exportação de relatórios.
- **Relatórios**: Vendas e lucro mensal, mix de produtos, métodos de pagamento, clientes recorrentes e exportação CSV.
- **Configurações**: Gestão de usuários, parâmetros de overhead, dados da empresa e conexão Power BI.

## PWA
Aplicação é PWA com manifest e service worker que mantém formulários críticos offline (pedidos e fechamento de caixa). Ao reconectar, os dados são sincronizados automaticamente.

### Sincronização offline
- A criação de pedidos e fechamentos de caixa offline é armazenada via IndexedDB.
- Ao voltar para o modo online, o service worker envia mensagem para sincronização automática.

## Logs e auditoria
- Todas as ações sensíveis disparam registros em `AuditLog`.
- Eventos de login/logout são registrados automaticamente.
- Utilize um coletor compatível com JSON (ex.: Grafana Loki) para consumir os logs estruturados.

## Scripts úteis
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run prisma:seed`

## Licença
[MIT](./LICENSE)
