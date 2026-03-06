# Stitch Messenger (MVP)

Легкий веб-мессенджер в стиле Telegram.

## Стек технологий
- **Backend**: Python 3.11+, FastAPI, SQLAlchemy, WebSockets
- **Frontend**: HTML5, CSS3 (Flexbox), Vanilla JS
- **Database**: PostgreSQL (для продакшена) / SQLite (для разработки)

## Установка и запуск (Локально)

1. **Создайте виртуальное окружение**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Mac/Linux
   venv\Scripts\activate     # Windows
   ```

2. **Установите зависимости**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Запустите сервер**:
   ```bash
   uvicorn app.main:app --reload
   ```

4. **Откройте в браузере**:
   Перейдите по адресу [http://127.0.0.1:8000](http://127.0.0.1:8000)

## Функционал
- Регистрация и авторизация (JWT).
- Список пользователей.
- Личные сообщения в реальном времени.
- История переписки.
- Отправка файлов (изображения, видео, аудио).

## Деплой на Render
Проект готов к деплою на Render.com через Blueprint.
1. Загрузите код в GitHub репозиторий.
2. В Render создайте новый Blueprint Instance.
3. Подключите репозиторий.
4. Render автоматически обнаружит `render.yaml` и создаст веб-сервис и базу данных PostgreSQL.
