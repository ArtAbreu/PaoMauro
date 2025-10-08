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

## Deploy na Render.com

O repositório inclui um arquivo [`render.yaml`](render.yaml) pronto para blueprint deployment na Render utilizando o ambiente **Python**. Para publicar:

1. Crie um novo Blueprint no painel da Render apontando para este repositório.
2. Confirme o serviço web sugerido (plano gratuito) e certifique-se de que a variável `PORT` fique gerenciada automaticamente pela Render.
3. O build executará `pip install -r requirements.txt` (não há dependências extras além da biblioteca padrão).
4. O comando de inicialização `python backend/app.py` já considera as variáveis de ambiente `HOST` e `PORT` fornecidas pela plataforma.

O backend grava o banco SQLite localmente (`backend/delivery.db`). Em planos gratuitos o disco é efêmero; faça backups ou migre para um banco gerenciado caso precise de persistência permanente.

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
| `GET` | `/api/driver/stops` | Lista alertas automáticos de parada pendentes ou confirmados. |
| `POST` | `/api/driver/stops/:id/ack` | Confirma ou descarta uma parada detectada (com quantidade entregue opcional). |
| `GET` | `/api/metrics/summary` | Resumo com métricas de clientes, entregas e pães. |

## Funcionalidades em destaque

- Planejamento de rota com base em coordenadas armazenadas para cada cliente.
- Mapa interativo com Leaflet mostrando todos os clientes e permitindo selecionar rapidamente quais paradas entram na rota (inclui os 5 supermercados Ideal já cadastrados com geolocalização).
- Registro de entregas com quantidade de pães e observações.
- Detecção automática de paradas próximas aos clientes cadastrados com sugestão imediata para registrar a entrega e quantidade de pães.
- Painel de métricas com gráfico simples (canvas) para visualizar pães entregues nos últimos dias.
- PWA com manifesto e service worker para uso offline básico e instalação no celular.
- Armazenamento seguro dos dados em banco SQLite local.

## Detecção automática de paradas

- Cada atualização de localização (`/api/driver/location`) é comparada com o ponto anterior. Se o motorista permanecer a menos de 50 metros por pelo menos 2 minutos, o sistema avalia os clientes em um raio de 250 metros.
- Ao encontrar o cliente mais próximo, o backend cria um `stop_event` pendente e o frontend exibe um alerta com ações rápidas.
- O administrador pode confirmar a entrega (informando quantidade de pães e observações) ou ignorar a parada. Confirmações automáticas atualizam/geram registros em `deliveries` e alimentam o painel de métricas.

## Próximos passos sugeridos

- Implementar autenticação por usuário/motorista (JWT ou sessão).
- Sincronização em tempo real (WebSockets) para localização do motorista e status das entregas.
- Exportação de relatórios em CSV/planilhas diretamente do backend.
- Integração com sistemas de pedidos e notificações automáticas aos clientes.
