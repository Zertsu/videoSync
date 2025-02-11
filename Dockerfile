FROM python:3-slim AS backend
COPY --from=mwader/static-ffmpeg /ffmpeg /usr/local/bin/
COPY requirements.txt /app/
WORKDIR /app
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py ./
COPY web ./web
RUN ln -s /vid /app/vid
CMD ["python", "./main.py"]

FROM nginx AS nginxproxy
COPY nginx.conf /etc/nginx/conf.d/default.conf
