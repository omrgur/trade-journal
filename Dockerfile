FROM python:3.11-slim
WORKDIR /app
COPY telegram_bot/requirements.txt .
RUN pip install -r requirements.txt
COPY telegram_bot/ .
CMD ["python", "bot.py"]
