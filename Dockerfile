# ############################################################
#  ⚠ DİSK KULLANIMI
#
#  Önce iki ayrı katmanda `node_modules` kopyalanıyordu:
#    deps katmanı  → ~500 MB
#    build katmanı → aynı 500 MB'ın KOPYASI
#  Dokploy sunucusunda disk dolunca şu hata alınıyordu:
#    failed to copy files: copy file range failed: no space left on device
#
#  Çözüm: `deps` katmanı kaldırıldı. Bağımlılıklar doğrudan
#  build katmanında kuruluyor — bir kopya yerine sıfır kopya.
#  Önbellek yine çalışıyor: `package*.json` değişmedikçe
#  `npm ci` adımı yeniden çalışmıyor.
# ############################################################

# ---- derleme ----
FROM node:22-alpine AS build
WORKDIR /app

# Önce yalnızca manifest: kaynak değişince npm ci tekrar çalışmasın
COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# `public` klasörü boşsa git onu taşımaz ve
# "COPY /app/public: not found" hatası alınır.
RUN mkdir -p public

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Derleme bitti; standalone çıktı zaten kendi node_modules'ünü
# taşıyor. Kalanı sil — katman boyutu düşsün.
RUN rm -rf node_modules

# ---- çalıştırma ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

USER node
EXPOSE 3000
CMD ["node", "server.js"]
