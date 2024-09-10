# 使用 Node.js 官方镜像
FROM bitnami/node:18.20.4

# 设置时区为 Asia/Shanghai
# ENV TZ=Asia/Shanghai

#RUN apt update
# We don't need the standalone Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

# Install Google Chrome Stable and fonts
# Note: this installs the necessary libs to make the browser work with Puppeteer.
RUN apt-get update && apt-get install curl gnupg -y \
  && curl --location --silent https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && apt-get install google-chrome-stable -y --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# 设置工作目录
#WORKDIR /puppeteer

# 依赖切换源
# RUN npm config set registry https://registry.npmmirror.com

# 安装Playwrigh
#RUN npm i puppeteer

# 复制应用代码
# COPY . .

# 暴露端口（假设你的应用在 3000 端口运行）
# EXPOSE 3000

# 指定容器启动时的命令
# CMD ["node", "index.js"]




