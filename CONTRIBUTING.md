# Процесс разработки

## Общая схема

```
main (защищённая) ← merge request ← feature/fix-ветка
```

- **`main`** — основная ветка. Деплой происходит только из неё.
- Прямой push в `main` запрещён — все изменения через **Merge Request**.
- Каждый MR должен пройти **code review** и **CI build**.

---

## Пошаговый процесс

### 1. Подтянуть свежие изменения

```bash
git checkout main
git pull origin main
```

### 2. Создать feature-ветку

```bash
git checkout -b feature/описание-задачи
```

Примеры имён веток:
- `feature/add-budget-alerts`
- `fix/rate-limiter-timeout`
- `chore/update-dependencies`

### 3. Внести изменения и закоммитить

```bash
# работаем...
git add src/my-file.ts
git commit -m "feat: описание изменения"
```

Формат коммитов: `тип: описание`
- `feat:` — новая функциональность
- `fix:` — исправление бага
- `chore:` — обслуживание (CI, зависимости)
- `refactor:` — рефакторинг без изменения поведения

### 4. Запушить ветку и создать MR

```bash
git push -u origin feature/описание-задачи \
  -o merge_request.create \
  -o merge_request.target=main \
  -o merge_request.remove_source_branch \
  -o "merge_request.assign=cancel"
```

Эта команда:
- пушит ветку
- автоматически создаёт Merge Request в `main`
- назначает ревьювера
- удалит ветку после мерджа

> Также можно создать MR вручную в GitLab UI.

### 5. Code review

- Ревьювер проверяет код, оставляет комментарии
- Автор вносит правки, пушит в ту же ветку — MR обновится автоматически
- После аппрува — ревьювер или автор нажимает **Merge**

### 6. Деплой

После мерджа в `main` CI автоматически:
1. **build** — собирает Docker-образ
2. **push** — загружает образ в registry

Далее вручную в пайплайне GitLab:
3. **deploy to dev** — нажать кнопку ▶ — поднимает новый контейнер (старый остаётся для отката)
4. **confirm dev** — нажать кнопку ▶ — финиширует деплой, удаляет старый контейнер

> Если что-то пошло не так — **не нажимайте confirm**, откатите в Rancher.

---

## Быстрая шпаргалка

```bash
# Разово: клонировать репо
git clone https://gitlab.kari.com/ai-common/bidder-cpc.git
cd bidder-cpc

# Каждая задача:
git checkout main && git pull origin main
git checkout -b feature/my-task
# ... работа ...
git add . && git commit -m "feat: my change"
git push -u origin feature/my-task \
  -o merge_request.create \
  -o merge_request.target=main \
  -o merge_request.remove_source_branch \
  -o "merge_request.assign=cancel"

# Дождаться ревью → мердж → деплой из пайплайна main
```

---

## Настройки GitLab (для админа)

Чтобы защитить `main`, зайди в **Settings → Repository → Protected branches**:

1. Ветка: `main`
2. **Allowed to merge**: Maintainers (или Developers)
3. **Allowed to push and merge**: No one ← запретить прямой push
4. Включить **"Require approval"** если нужен обязательный аппрув

Для обязательного ревью: **Settings → Merge requests → Approval rules**:
- Добавить правило, минимум 1 одобрение
