# Sistema Web de Rotas e Entregas da Fábrica de Pães

Este repositório contém uma aplicação web completa (backend em Python + frontend em HTML/CSS/JS) para organizar os clientes, planejar rotas e controlar entregas de pães em tempo real.

## Visão geral

- **Backend**: servidor HTTP em Python puro com SQLite para persistência (`backend/app.py`). Expõe endpoints REST para clientes, entregas, rotas, métricas e rastreamento de localização do motorista.
- **Frontend**: aplicação responsiva com Progressive Web App (PWA) em `frontend/`. Permite cadastrar clientes, planejar rotas diárias, registrar entregas e consultar indicadores de desempenho.
- **Banco de dados**: SQLite (arquivo `backend/delivery.db`, criado automaticamente).

## Como executar

1. **Criar ambiente** (opcional, mas recomendado)

   ```bash
   python -m venv .venv
   source .venv/bin/activate
   ```

2. **Instalar dependências**

   ```bash
   pip install -r requirements.txt
   ```

3. **Configurar a chave do Google Maps**

   A interface usa os serviços JavaScript, Places e Directions do Google Maps. Exporte a chave antes de iniciar o backend:

   ```bash
   export GOOGLE_MAPS_API_KEY="sua_chave_aqui"
   ```

4. **Iniciar o servidor**

   ```bash
   cd backend
   python app.py
   ```

   O servidor ficará disponível em `http://localhost:8000`.

5. **Acessar o frontend**

   Abra o navegador em `http://localhost:8000/`. A interface é responsiva e pode ser instalada como aplicativo (PWA) em celulares ou desktops.

## Endpoints principais

| Método | Rota | Descrição |
| ------ | ---- | --------- |
| `GET` | `/api/clients` | Lista clientes cadastrados. |
| `POST` | `/api/clients` | Cria um novo cliente. |
| `PUT` | `/api/clients/:id` | Atualiza dados de um cliente. |
| `DELETE` | `/api/clients/:id` | Remove um cliente. |
| `POST` | `/api/deliveries` | Agenda uma entrega. |
| `GET` | `/api/deliveries?date=AAAA-MM-DD` | Lista entregas (filtradas por data). |
| `POST` | `/api/deliveries/:id/complete` | Marca entrega como concluída e registra quantidade. |
| `POST` | `/api/routes` | Gera rota otimizada usando Google Directions (com fallback automático). |
| `POST` | `/api/driver/location` | Registra localização do motorista, detecta paradas e retorna progresso. |
| `GET` | `/api/driver/location` | Lista posições recentes do motorista e o status atual da rota. |
| `GET` | `/api/config` | Retorna parâmetros públicos do frontend (como a chave do Google Maps). |
| `GET` | `/api/metrics/summary` | Resumo com métricas de clientes, entregas e pães. |

## Funcionalidades em destaque

- Integração completa com Google Maps: autocomplete de endereços, seleção de ponto com marcador arrastável e visualização das rotas oficiais do Directions API.
- Planejamento inteligente de rota com otimização pelo Google Directions e fallback local por vizinho mais próximo.
- Rastreamento em tempo real do motorista: o mapa acompanha a posição atual, detecta paradas dentro do raio do cliente e solicita automaticamente o registro de pães entregues.
- Mapa interativo (Google Maps) com destaque para o próximo destino, status da rota e clientes que ainda precisam ser atendidos.
- Registro de entregas com quantidade de pães, observações e histórico de visitas detectadas.
- Painel de métricas com gráfico (canvas) para visualizar pães entregues nos últimos dias.
- PWA com manifesto e service worker para uso offline básico e instalação no celular.
- Armazenamento seguro dos dados em banco SQLite local.

## Próximos passos sugeridos

- Implementar autenticação por usuário/motorista (JWT ou sessão).
- Evoluir o canal de atualização em tempo real para WebSockets/SSE e enviar notificações push.
- Exportação de relatórios em CSV/planilhas diretamente do backend.
- Integração com sistemas de pedidos e notificações automáticas aos clientes.
