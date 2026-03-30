FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        coreutils \
        curl \
        findutils \
        gawk \
        grep \
        iproute2 \
        net-tools \
        procps \
        proot \
        sed \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5100

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5100"]
