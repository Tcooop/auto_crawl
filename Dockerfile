# 使用 Node.js 官方镜像
FROM bitnami/node:18.20.4

# 设置时区为 Asia/Shanghai
ENV TZ=Asia/Shanghai

# 安装 tzdata，并设置时区
RUN apt-get update && \
    apt-get install -y tzdata && \
    ln -fs /usr/share/zoneinfo/$TZ /etc/localtime && \
    dpkg-reconfigure --frontend noninteractive tzdata && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /playwright

# 依赖切换源
# RUN npm config set registry https://registry.npmmirror.com

# 安装Playwrigh
RUN npm init playwright@latest

# 复制应用代码
# COPY . .

# 暴露端口（假设你的应用在 3000 端口运行）
# EXPOSE 3000

# 指定容器启动时的命令
# CMD ["node", "index.js"]




