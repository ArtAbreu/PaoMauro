# Sistema Web de Rotas e Entregas da Fábrica de Pães

## 1. Visão geral
O sistema permitirá que o administrador cadastre clientes, organize rotas diárias e acompanhe, em tempo real, o deslocamento do entregador (pai do solicitante). O motorista utilizará uma aplicação PWA no celular para iniciar as rotas planejadas, registrar entregas e responder a perguntas automáticas quando chegar em um cliente. Os dados serão centralizados para geração de indicadores, relatórios e exportação para planilhas.

## 2. Stack tecnológica recomendada

| Camada | Tecnologia | Justificativa |
| --- | --- | --- |
| Frontend | **Next.js 14** com React, TypeScript e app router | SSR/SSG para telas administrativas, geração do PWA com suporte a offline e push notifications. |
| UI/UX | Tailwind CSS + Headless UI | Criação rápida de interfaces responsivas e componentes acessíveis. |
| Mapas | Google Maps JavaScript API + Places (cadastro) e Leaflet + OpenStreetMap (visualização de rotas) | Autocomplete confiável no cadastro de clientes com possibilidade de manter tiles abertos para o mapa operacional. |
| Backend | **NestJS** (Node.js + TypeScript) | Modular, fácil de integrar com WebSockets e filas. |
| Banco de dados | PostgreSQL 15 + Prisma ORM | Tipado, suporta consultas geoespaciais (extensão PostGIS) e integra bem com NestJS. |
| Armazenamento de rotas | Redis (opcional) | Cache de rotas otimizadas e sessões ativas do motorista. |
| Autenticação | JWT + Refresh Tokens | Permite logins diferenciados (admin/motorista). |
| Infraestrutura | Docker Compose em MVP. Futuro: deploy em Render/Fly.io/ Railway. |

## 3. Módulos principais

1. **Gestão de clientes**
   - CRUD completo.
   - Campos: nome, telefone, endereço, geolocalização (latitude/longitude), observações.
   - Geocodificação automática ao salvar endereço (Google Places integrado ao cadastro atual).

2. **Planejamento de rotas**
   - Tela para selecionar data, clientes e ordem sugerida.
   - Otimização via serviço externo (Open Source Route Planner, GraphHopper, OSRM) ou heurística local com algoritmo de vizinho mais próximo + 2-opt.
   - Exportação da rota para o app do motorista (lista ordenada + waypoints).

3. **Aplicativo do motorista (PWA)**
   - Login simples.
   - Tela inicial exibe rota do dia, com mapa e lista ordenada de paradas.
   - Botão “Iniciar rota”: envia localização contínua.
   - Detecção de chegada (geofence de 50m) → abre modal perguntando:
     - “Entregou pães?” (Sim/Não)
     - Quantidade entregue.
     - Observações (ex: pagamento realizado, problemas etc.).
   - Possibilidade de marcar cliente como “pular” e voltar depois.
   - Funcionamento offline com sincronização quando houver conexão.

4. **Acompanhamento em tempo real (admin)**
   - Mapa com posição atual do motorista e status de cada cliente (pendente, em atendimento, concluído).
   - Atualizações via WebSocket (Gateway do NestJS) a cada X segundos.
   - Contadores de entregas (realizadas, pendentes, total pães).

5. **Relatórios e métricas**
   - Dashboard diário/por período: quantidade entregue, clientes atendidos, tempo médio, km percorridos.
   - Ranking de clientes por frequência e volume.
   - Exportação para CSV/Excel usando biblioteca `exceljs`.
   - Base para futuras integrações (pedidos e finanças).

## 4. Estrutura de dados (PostgreSQL + Prisma)

### 4.1 Tabelas principais
- `users`
  - `id`, `name`, `phone`, `role` (ADMIN | DRIVER), `password_hash`, `created_at`.
- `clients`
  - `id`, `name`, `phone`, `address`, `latitude`, `longitude`, `notes`, `created_at`, `updated_at`.
- `routes`
  - `id`, `date`, `driver_id`, `status` (PLANNED | IN_PROGRESS | COMPLETED), `created_at`.
- `route_stops`
  - `id`, `route_id`, `client_id`, `sequence`, `planned_arrival`, `actual_arrival`, `status`, `delivered_quantity`, `skipped`, `notes`.
- `locations`
  - `id`, `route_id`, `timestamp`, `latitude`, `longitude`, `speed` (opcional), `battery_level` (opcional).
- `deliveries`
  - `id`, `route_stop_id`, `delivered_quantity`, `returned_quantity`, `confirmation_photo_url` (futuro), `created_at`.

### 4.2 Índices e extensões
- Adicionar PostGIS para suportar tipos `geography(Point)` e cálculos de distância.
- Índices geoespaciais (`GIST`) em `clients` e `locations`.

## 5. Fluxo de operação diário

1. **Planejamento**
   - Administrador seleciona clientes que serão atendidos no dia seguinte.
   - Sistema sugere rota otimizada e permite ajustes manuais.
   - Ao confirmar, rota fica no status `PLANNED` e aparece no app do motorista.

2. **Execução**
   - Motorista faz login no PWA e inicia a rota.
   - App captura localização a cada 5-10 segundos, envia via WebSocket/REST.
   - Ao se aproximar de um cliente, app dispara modal de confirmação.
   - Entrega registrada muda status do `route_stop` para `COMPLETED` com quantidade.

3. **Acompanhamento**
   - Administrador acompanha mapa em tempo real.
   - Painel mostra métricas atualizadas (pães entregues, clientes restantes, tempo total).

4. **Fechamento**
   - Ao concluir todas as paradas, rota fica `COMPLETED`.
   - Relatório diário disponível para exportação.

## 6. APIs principais (NestJS)

- `POST /auth/login` → retorna access + refresh token.
- `POST /auth/refresh`
- `GET /clients`, `POST /clients`, `PUT /clients/:id`, `DELETE /clients/:id`
- `POST /routes` (gera rota), `GET /routes?date=`, `GET /routes/:id`
- `POST /routes/:id/start`, `POST /routes/:id/complete`
- `POST /routes/:id/locations` (stream de localização)
- `POST /routes/:id/stops/:stopId/arrive`
- `POST /routes/:id/stops/:stopId/deliver` (recebe quantidade, observação)
- `GET /reports/daily`, `GET /reports/export?type=csv`

## 7. Notificações e automações futuras

- **Push notifications** via Firebase Cloud Messaging quando rota for publicada ou entrega concluída.
- **Integração com pedidos**: tabela `orders` vinculada a clientes, com status e itens.
- **Alertas automáticos** para clientes: envio de WhatsApp (Twilio/Z-API) quando motorista sair para entrega ou quando estiver a X minutos do local.

## 8. Segurança e permissões

- Roles: `ADMIN` (todas as funcionalidades), `DRIVER` (visualizar rota, atualizar status, registrar entregas).
- Middleware JWT no backend, guards específicos por rota.
- Auditoria: logs de ações sensíveis (edição de clientes, exclusão de entregas).

## 9. Deploy inicial

- Criar `docker-compose.yml` com serviços: `frontend`, `backend`, `postgres`, `redis`.
- Configurar variáveis de ambiente em `.env` (chaves JWT, URL do banco, chave de geocoding).
- Utilizar migrations automáticas com Prisma.
- Pipeline GitHub Actions para lint/test/build e deploy (Render/Fly.io).

## 10. Roadmap sugerido

1. **MVP (Semana 1-3)**
   - Setup do repositório monorepo (Turborepo) com apps `web` (Next) e `api` (Nest).
   - Cadastro de clientes e geocodificação.
   - Criação manual de rotas e visualização no mapa.
   - App do motorista com login e check-in manual de entregas.

2. **Iteração 2 (Semana 4-5)**
   - Rastreamento em tempo real e dashboard administrativo.
   - Otimização de rotas integrada.
   - Exportação básica para CSV.

3. **Iteração 3 (Semana 6+)**
   - Automação de notificações.
   - Métricas avançadas e gráficos.
   - Integração com pedidos e pagamento.

## 11. Considerações de UX

- PWA com modo escuro e suporte offline (cache de rota, cadastro local).
- Botões grandes para uso com luvas e em movimento.
- Confirmações por voz (Web Speech API) como futura melhoria.

## 12. Próximos passos para implementação

1. Validar dados necessários com o entregador (campos, fluxo, frequência de atualização).
2. Definir orçamento para APIs de roteirização (gratuito vs pago).
3. Preparar ambiente de desenvolvimento com Docker.
4. Construir MVP incrementalmente, priorizando cadastro de clientes, rota manual e confirmação de entregas.

## 13. Configuração do Google Maps no MVP atual

- A tela de cadastro consome o **Google Maps JavaScript API** com a biblioteca **Places** para sugerir endereços e preencher latitude/longitude automaticamente.
- Defina a chave em `frontend/index.html` (substituir `YOUR_GOOGLE_MAPS_API_KEY`) antes de subir o ambiente de produção.
- Caso não seja possível utilizar o Google Maps em algum ambiente, os campos continuam editáveis manualmente; o status no formulário informa quando o SDK não pôde ser carregado.

