FROM python:3.12-slim

# Set WORKDIR to mirror local structure so ld_service.py path resolution works:
# parents[3] of /colony/backend/app/services/ld_service.py == /colony (project root)
WORKDIR /colony/backend

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

EXPOSE 8000

CMD ["uvicorn", "app.main:socket_app", "--host", "0.0.0.0", "--port", "8000"]
