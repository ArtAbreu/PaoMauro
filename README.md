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

2. **Iniciar o servidor**

   ```bash
   cd backend
   python app.py
   ```

   O servidor ficará disponível em `http://localhost:8000`.

3. **Acessar o frontend**

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
| `POST` | `/api/routes` | Gera rota otimizada para o dia usando heurística de vizinho mais próximo. |
| `POST` | `/api/driver/location` | Registra localização do motorista (GPS). |
| `GET` | `/api/metrics/summary` | Resumo com métricas de clientes, entregas e pães. |

## Funcionalidades em destaque

- Planejamento de rota com base em coordenadas armazenadas para cada cliente.
- Registro de entregas com quantidade de pães e observações.
- Painel de métricas com gráfico simples (canvas) para visualizar pães entregues nos últimos dias.
- PWA com manifesto e service worker para uso offline básico e instalação no celular.
- Armazenamento seguro dos dados em banco SQLite local.

## Próximos passos sugeridos

- Implementar autenticação por usuário/motorista (JWT ou sessão).
- Sincronização em tempo real (WebSockets) para localização do motorista e status das entregas.
- Exportação de relatórios em CSV/planilhas diretamente do backend.
- Integração com sistemas de pedidos e notificações automáticas aos clientes.
