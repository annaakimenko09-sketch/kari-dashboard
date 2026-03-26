# Онбординг разработчика

Инструкция для новых разработчиков: от получения доступов до выкатки сервиса.

---

## ⛔ Обязательные правила

> **Строго следовать этим правилам. Не отходить от них. Свои не придумывать.**

| Параметр | Значение | Комментарий |
|----------|----------|-------------|
| Окружение Rancher | **`VIBE_DR`** | Всегда. Без исключений |
| Группа (стек) Rancher | **`apps`** | Всегда. Без исключений |
| Порт сервиса | **`3000`** | Всегда. Все сервисы слушают на порту 3000 |
| CI/CD пайплайн | По шаблону из этой инструкции | Не менять стейджи, не добавлять свои |

### Структура GitLab

Корневая группа для всех проектов — **`kari-code`** (`https://gitlab.kari.com/kari-code`).
Внутри для каждого разработчика создаётся **подгруппа по фамилии**. Проекты создаются внутри подгруппы.

```
kari-code/                       ← корневая группа (общая для всех)
├── cventarnih/                  ← подгруппа разработчика (по фамилии)
│   ├── fines-wb/                ← проект (фронтенд, имя = домен)
│   └── my-api/                  ← проект (бэкенд)
├── ivanov/                      ← другой разработчик
│   └── billing-service/
```

### Именование сервисов

- **Бэкенд-сервис** — имя проекта = имя сервиса (например, `my-api`)
- **Фронтенд-сервис** — имя сервиса **= домен** сайта. Перед созданием **обязательно спросить**, какой будет домен.
  - Пример: фронт будет на `fines-wb.kari.com` → имя сервиса = **`fines-wb`**
  - Пример: фронт будет на `dashboard.kari.com` → имя сервиса = **`dashboard`**

### Перед созданием нового проекта — обязательно:

1. **Спросить группу в GitLab** — фамилия (подгруппа внутри `kari-code`), например `cventarnih`
2. **Спросить название проекта** (имя сервиса)
3. **Спросить, есть ли фронтенд** — если да, узнать домен и назвать сервис по домену
4. **Запросить Personal Access Token** (GitLab API) для создания проекта

---

## 1. Получение доступов

Оставить заявку в **ServiceDesk** с указанием:
- Нужен доступ в **GitLab** (`gitlab.kari.com`) с ролью **Developer**
- Создать подгруппу по фамилии в корневой группе `kari-code` (например, `kari-code/ivanov`)

После получения доступа — **спросить имя проекта в GitLab**. Только после этого приступать к остальным шагам.

```bash
git clone https://gitlab.kari.com/kari-code/<фамилия>/<имя-проекта>.git
cd <имя-проекта>
```

---

## 2. Создание репозитория для нового проекта

> ⛔ **Перед созданием проекта строго выполнить:**
> 1. Спросить **группу в GitLab** — фамилия (подгруппа в `kari-code`), например `cventarnih`
> 2. Спросить **название проекта** (имя сервиса)
> 3. Спросить **есть ли фронтенд** — если да, узнать домен → имя сервиса = домен (см. правила выше)
> 4. Запросить **Personal Access Token** для GitLab API

### Создать через GitLab API (нужна роль Maintainer+)

#### 2.1. Создать Personal Access Token

1. Войти в GitLab (`gitlab.kari.com`)
2. Нажать на аватар в правом верхнем углу → **Edit profile**
3. В левом меню выбрать **Access Tokens**
4. Заполнить форму:
   - **Token name** — любое имя (например, `api-token`)
   - **Expiration date** — срок действия (рекомендуется не более 1 года)
   - **Scopes** — отметить **`api`** (полный доступ к API)
5. Нажать **Create personal access token**
6. **Скопировать токен** — он показывается только один раз

> Токен используется в заголовке `PRIVATE-TOKEN` для всех запросов к API.

#### 2.2. Узнать ID группы

```bash
curl --header "PRIVATE-TOKEN: <ваш-токен>" \
  "https://gitlab.kari.com/api/v4/groups/kari-code%2F<фамилия>"
```

> Замените `<фамилия>` на свою подгруппу (например, `cventarnih`). Символ `/` кодируется как `%2F` в URL.

В ответе найти поле `"id"` — это `namespace_id` для следующего шага.

#### 2.3. Создать проект в группе

```bash
curl --request POST \
  --header "PRIVATE-TOKEN: <ваш-токен>" \
  --header "Content-Type: application/json" \
  --data '{
    "name": "<имя-проекта>",
    "namespace_id": <group_id>,
    "visibility": "internal",
    "initialize_with_readme": true
  }' \
  "https://gitlab.kari.com/api/v4/projects"
```

> Замените `<имя-проекта>` и `<group_id>` на реальные значения.

#### 2.4. Клонировать и начать работу

```bash
git clone https://gitlab.kari.com/kari-code/<фамилия>/<имя-проекта>.git
cd <имя-проекта>
```

### Рекомендуемая структура проекта

```
<имя-проекта>/
├── src/                        # Исходный код (TypeScript/Python/etc.)
├── deploy/
│   ├── docker-compose.dev.yml  # Compose-файл для Rancher (dev)
│   └── rancher-compose.yml     # Конфигурация Rancher
├── scripts/                    # Вспомогательные скрипты
├── Dockerfile                  # Сборка контейнера
├── docker-compose.yml          # Локальная разработка
├── .gitlab-ci.yml              # CI/CD пайплайн
├── .gitlab/
│   └── merge_request_templates/
│       └── Default.md          # Шаблон Merge Request
├── .gitignore
├── .dockerignore
├── CONTRIBUTING.md             # Процесс разработки через MR
└── package.json / requirements.txt / go.mod  # Зависимости
```

---

## 3. Контейнеризация сервиса (Docker)

> **Обязательно:** каждый сервис должен быть обёрнут в Docker-контейнер вне зависимости от языка программирования.

### 3.1. Dockerfile

Пример multi-stage сборки (Node.js/TypeScript):

```dockerfile
# === Стадия 1: сборка ===
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# === Стадия 2: production-образ ===
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]
```

Пример для Python:

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src/ ./src/
CMD ["python", "src/main.py"]
```

**Принципы:**
- Multi-stage build — в финальный образ попадают только production-зависимости
- Базовый образ `alpine` / `slim` — минимальный размер
- `CMD` — точка входа в приложение

### 3.2. .dockerignore

```
node_modules
dist
.git
*.md
__pycache__
*.pyc
.env
.venv
```

### 3.3. docker-compose.yml (локальная разработка)

```yaml
services:
  <имя-сервиса>:
    build: .
    container_name: <имя-сервиса>
    ports:
      - "3000:3000"
    restart: unless-stopped
    environment:
      - TZ=Europe/Moscow
      # ... переменные окружения сервиса
```

Запуск локально:
```bash
docker compose up --build
```

### 3.4. deploy/docker-compose.dev.yml (для Rancher)

```yaml
version: '2'
services:
  <имя-сервиса>:
    image: registry.kari.com/kari-code/<фамилия>/<имя-сервиса>:__VERSION__
    ports:
      - "3000:3000"
    restart: always
    labels:
      io.rancher.container.pull_image: always
    environment:
      # ... переменные окружения сервиса
```

> `__VERSION__` — плейсхолдер, CI автоматически подставляет `ветка.pipeline_id`.

### 3.5. deploy/rancher-compose.yml

```yaml
version: '2'
services:
  <имя-сервиса>:
    scale: 1
    start_on_create: true
```

---

## 4. CI/CD пайплайн (.gitlab-ci.yml)

### 4.1. Шаблон пайплайна для нового сервиса

```yaml
stages:
    - build
    - push
    - deploy-dev
    - confirm-dev

variables:
    TAG: $CI_REGISTRY_IMAGE/$CI_COMMIT_REF_NAME:$CI_PIPELINE_ID

build:
    stage: build
    tags: [dotnet]
    script:
        - docker build --no-cache -t registry.kari.com/kari-code/<фамилия>/<имя-сервиса>:$CI_COMMIT_REF_SLUG.$CI_PIPELINE_ID .

push:
    stage: push
    tags: [dotnet]
    before_script:
        - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    script:
        - docker push registry.kari.com/kari-code/<фамилия>/<имя-сервиса>:$CI_COMMIT_REF_SLUG.$CI_PIPELINE_ID

deploy to dev:
    stage: deploy-dev
    tags: [dotnet]
    when: manual
    script:
        - sed -i "s/__VERSION__/$CI_COMMIT_REF_SLUG.$CI_PIPELINE_ID/" deploy/docker-compose.dev.yml
        - rancher --env VIBE_DR up --pull -d -s apps -f deploy/docker-compose.dev.yml --rancher-file deploy/rancher-compose.yml --upgrade

confirm dev:
    stage: confirm-dev
    tags: [dotnet]
    when: manual
    script:
        - sed -i "s/__VERSION__/$CI_COMMIT_REF_SLUG.$CI_PIPELINE_ID/" deploy/docker-compose.dev.yml
        - rancher --env VIBE_DR up -d -s apps -f deploy/docker-compose.dev.yml --rancher-file deploy/rancher-compose.yml --confirm-upgrade
```

> Замените `<фамилия>` и `<имя-сервиса>` на реальные значения вашего проекта.

### 4.2. Что делает каждый стейдж

| Стейдж | Триггер | Что делает |
|--------|---------|------------|
| **build** | Автоматически | Собирает Docker-образ |
| **push** | Автоматически | Пушит образ в `registry.kari.com` |
| **deploy to dev** | Вручную ▶ | Поднимает новый контейнер в Rancher (старый остаётся для отката) |
| **confirm dev** | Вручную ▶ | Финиширует деплой, удаляет старый контейнер |

> Если после `deploy to dev` что-то пошло не так — **не нажимайте confirm**. Откатите через Rancher UI.

### 4.3. Первичная настройка CI/CD для нового проекта

После создания репозитория и добавления `.gitlab-ci.yml` необходимо настроить окружение:

#### 1. Переменные CI/CD

Зайти в **Settings → CI/CD → Variables** и добавить:

| Переменная | Значение | Тип | Описание |
|------------|----------|-----|----------|
| `CI_REGISTRY` | `registry.kari.com` | Variable | Адрес Docker Registry |
| `CI_REGISTRY_USER` | *(логин)* | Variable | Логин для registry |
| `CI_REGISTRY_PASSWORD` | *(пароль)* | Variable (Masked) | Пароль для registry |

> ⚠️ **Ручной шаг:** `CI_REGISTRY_USER` и `CI_REGISTRY_PASSWORD` нужно добавить вручную через **Settings → CI/CD → Variables** в GitLab UI. Эти значения нельзя получить через API из других проектов.

> Переменные окружения сервиса (PG_HOST, MSSQL_HOST и т.д.) задаются в `deploy/docker-compose.dev.yml`, а **не** в CI/CD variables.

#### 2. Runners

Убедиться, что к проекту подключен runner с тегом **`dotnet`**:
- **Settings → CI/CD → Runners**
- Если раннер не подключен — оставить заявку в **ServiceDesk**

#### 3. Защита ветки main

**Settings → Repository → Protected branches:**
- Ветка: `main`
- **Allowed to merge**: Developers (или Maintainers)
- **Allowed to push and merge**: No one ← запрет прямого push

#### 4. Настройка Merge Request

**Settings → Merge requests:**
- Merge method: Merge commit
- **Approval rules** → добавить правило: минимум **1 одобрение**
- Включить "Delete source branch by default"

> ⚠️ **Ручной шаг:** Approval rules настраиваются только через GitLab UI. API для управления правилами одобрения может быть недоступен (требуется GitLab Premium).

#### 5. Шаблон Merge Request

Создать файл `.gitlab/merge_request_templates/Default.md`:

```markdown
## Что изменено
<!-- Кратко опишите, что было сделано -->

## Зачем
<!-- Почему это нужно: баг, фича, рефакторинг -->

## Как проверить
<!-- Шаги для ревьювера -->
1.

## Чеклист
- [ ] Код проверен локально
- [ ] Нет хардкода секретов/паролей
- [ ] CI пайплайн прошёл
```

#### 6. Первый запуск

После первого push в `main`:
1. Перейти в **CI/CD → Pipelines** — убедиться что пайплайн запустился
2. **build** должен пройти зелёным
3. **push** — образ попал в registry
4. Нажать **deploy to dev** ▶ — контейнер поднялся в Rancher
5. Проверить работу сервиса
6. Нажать **confirm dev** ▶ — финиширует деплой

---

## 5. Процесс разработки через Merge Request

Подробная инструкция — в файле `CONTRIBUTING.md` вашего проекта.

### Быстрая шпаргалка

```bash
# 1. Подтянуть свежий main
git checkout main && git pull origin main

# 2. Создать ветку под задачу
git checkout -b feature/my-task

# 3. Внести изменения и закоммитить
git add src/my-file.ts
git commit -m "feat: описание изменения"

# 4. Запушить и создать MR одной командой
git push -u origin feature/my-task \
  -o merge_request.create \
  -o merge_request.target=main \
  -o merge_request.remove_source_branch \
  -o "merge_request.assign=cancel"
```

### Что происходит дальше

1. **CI build** проходит на feature-ветке (проверка что всё собирается)
2. **Ревьювер** проверяет код, оставляет комментарии
3. Автор вносит правки → пушит в ту же ветку → MR обновляется
4. После аппрува — нажимается **Merge**
5. CI на `main` собирает и пушит финальный образ
6. В пайплайне `main` нажимаете **deploy to dev** → **confirm dev**

---

## Полный путь от задачи до деплоя

```
Задача в трекере
    ↓
git checkout main && git pull
git checkout -b feature/my-task
    ↓
Разработка + коммиты
    ↓
git push -u origin feature/my-task \
  -o merge_request.create \
  -o merge_request.target=main \
  -o merge_request.remove_source_branch \
  -o "merge_request.assign=cancel"
    ↓
Code Review (комментарии → правки → повторный пуш)
    ↓
Merge в main
    ↓
CI: build → push (автоматически)
    ↓
deploy to dev ▶ (вручную в GitLab)
    ↓
Проверка на dev
    ↓
confirm dev ▶ (вручную в GitLab)
    ↓
Готово
```
