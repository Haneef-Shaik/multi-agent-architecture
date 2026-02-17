FROM ubuntu:22.04 AS base

ENV DEBIAN_FRONTEND=noninteractive

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl wget git jq vim htop unzip \
    build-essential gcc g++ make \
    python3 python3-venv python3-pip \
    ca-certificates gnupg \
    supervisor \
    inotify-tools \
    && rm -rf /var/lib/apt/lists/*

# Node.js 22 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# pnpm
RUN npm install -g pnpm

# Create sandbox user (non-root)
RUN useradd -m -s /bin/bash sandbox \
    && mkdir -p /workspace \
    && chown sandbox:sandbox /workspace \
    && mkdir -p /var/log/supervisor \
    && chown -R sandbox:sandbox /var/log/supervisor \
    && mkdir -p /var/run/supervisor \
    && chown -R sandbox:sandbox /var/run/supervisor \
    && chown -R sandbox:sandbox /etc/supervisor

# Fix supervisord paths so the sandbox user can write pid/socket files
RUN sed -i \
    -e 's|file=/var/run/supervisor.sock|file=/var/run/supervisor/supervisor.sock|g' \
    -e 's|pidfile=/var/run/supervisord.pid|pidfile=/var/run/supervisor/supervisord.pid|g' \
    -e 's|serverurl=unix:///var/run/supervisor.sock|serverurl=unix:///var/run/supervisor/supervisor.sock|g' \
    /etc/supervisor/supervisord.conf

# Copy Bun to sandbox user
RUN cp -r /root/.bun /home/sandbox/.bun \
    && chown -R sandbox:sandbox /home/sandbox/.bun
ENV PATH="/home/sandbox/.bun/bin:$PATH"

# Supervisor config
COPY supervisor.conf /etc/supervisor/conf.d/sandbox.conf

# Entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /workspace

# Expose port range for dev servers
EXPOSE 3000-3010 5173 8000-8010

ENTRYPOINT ["/entrypoint.sh"]
CMD ["supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
