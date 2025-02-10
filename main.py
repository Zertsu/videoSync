from aiohttp import web
import aiohttp
import os
import asyncio
import ssl
import time
import json
import configparser
from urllib.parse import quote as urlquote


config = configparser.ConfigParser()

wsPclients = list()
wsCclients = set()
curVid = ""
curPref = False
vidStartTime = 0
curPos = 0
isPlaying = False
dispConf = []


async def ytdl(url):
    global config
    process = await asyncio.create_subprocess_exec(
        'yt-dlp',
        '-f', config["files"]["dl_format"],
        '-o', os.path.join(config["files"]["video_dir"],"%(title)s-%(id)s.%(ext)s"),
        url)
    await process.wait()
    await sendtoAll(["avalist", getVidDir()], wsCclients)

async def sendtoAll(data, clientList):    
    return asyncio.gather(*[cli.send_json(data) for cli in clientList])
    

def getTime():
    return round(time.time() * 1000)
    
def getVidDir():
    return sorted(os.listdir(config["files"]["video_dir"]), key=lambda v: (v.upper(), v[0].islower()))

async def websocket_handler(request):
    global wsPclients; global wsCclients; global curVid; global vidStartTime; global curPos; global isPlaying; global dispConf; global curPref
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    async for msg in ws:
        if msg.type == aiohttp.WSMsgType.TEXT:
            data = json.loads(msg.data)
            print(data)
            if data[0] == "timereq":
                await ws.send_json(["time", getTime()])
            elif data[0] == "seek":
                vidStartTime -= data[1]
                await sendtoAll(["seek", vidStartTime], wsPclients)
            elif data[0] == "play":
                vidStartTime = getTime()
                await sendtoAll([data[0], vidStartTime - curPos], wsPclients)
                isPlaying = True
            elif data[0] == "pause":
                await sendtoAll([data[0], getTime()], wsPclients)
                isPlaying = False
                curPos = getTime() - vidStartTime
            elif data[0] == "reqURL":
                asyncio.create_task(ytdl(data[1]))
            elif data[0] == "getavalist":
                await ws.send_json(["avalist", getVidDir()])
            elif data[0] == "chngvid":
                curPos = 0
                curVid = data[1]
                curPref = data[2]
                isPlaying = False
                await sendtoAll(["chngvid", "/vid/"+ urlquote(curVid), curPref], wsPclients)
            elif data[0] == "vidreq":
                if curVid:
                    await ws.send_json(["chngvid", "/vid/"+ urlquote(curVid), curPref])
                if isPlaying:
                    await ws.send_json(["play", vidStartTime - curPos])
                else:
                    await ws.send_json([])
            elif data[0] == "sub":
                if data[1] == "P":
                    if not (ws in wsPclients):
                        wsPclients.append(ws)
                        dispConf.append([1, 1, 1])
                        await asyncio.gather(
                            sendtoAll(["dispConf", dispConf], wsCclients),
                            ws.send_json(["cindex", len(wsPclients) - 1]))
                elif data[1] == "C":
                    if not (ws in wsCclients):
                        wsCclients.add(ws)
                        await ws.send_json(["dispConf", dispConf])
            elif data[0] in ["showUI", "hideUI", "showID", "hideID"]:
                await sendtoAll([data[0]], wsPclients)
            elif data[0] == "dispConf":
                await asyncio.gather(
                    *[wsPclients[i].send_json(["cdispConf", e[1]]) for i, e in enumerate(zip(dispConf, data[1])) if e[0] != e[1]],
                    sendtoAll(["dispConf", data[1]], wsCclients))
                dispConf = data[1]
            elif data[0] == "cdispConf":
                ind = wsPclients.index(ws)
                dispConf[ind] = data[1]
                await sendtoAll(["dispConf", dispConf], wsCclients)
        elif msg.type == aiohttp.WSMsgType.ERROR:
            print('ws connection closed with exception %s' %
                    ws.exception())
    
    if ws in wsPclients:
        ind = wsPclients.index(ws)
        wsPclients.pop(ind)
        dispConf.pop(ind)
        await asyncio.gather(
            *[wsPclients[i].send_json(["cindex", i]) for i in range(ind, len(wsPclients))],
            sendtoAll(["dispConf", dispConf], wsCclients))
    if ws in wsCclients:
        wsCclients.remove(ws)
    return ws

async def hanetc(req):
    if req.path == "/":
        with open("web/index.html") as f:
            return web.Response(text=f.read(),content_type="text/html")
    
    if req.path in ["/vp", "/ctr"]:
        with open(f"web{req.path}.html") as f:
            return web.Response(text=f.read(),content_type="text/html")

    return web.Response(text="404 Not found",content_type="text/plain", status=404)


async def fileUpload(req):
    async for field in (await req.multipart()):
        if field.name == 'file':
            filename = field.filename.replace('/', '_').replace('\\', '_')
            size = 0
            with open(os.path.join(config["files"]["video_dir"], filename), 'wb') as f:
                while True:
                    chunk = await field.read_chunk()
                    if not chunk:
                        break
                    size += len(chunk)
                    f.write(chunk)
    asyncio.create_task(sendtoAll(["avalist", getVidDir()], wsCclients))
    return web.Response(text=f"Uploaded {filename}")

def main():
    if os.path.exists("config.ini"):
        config.read("config.ini")
    else:
        config["server"] = {
            "bind_address" : "0.0.0.0",
            "port" : "8080",
            "usessl" : "0",
            "certfile" : "None",
            "keyfile" : "None"
        }
        config["files"] = {
            "dl_format" : "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]",
            "video_dir" : "./vid",
            "max_upload_size": 1024 ** 3 * 4
        }
        with open('config.ini', 'w') as configfile:
            config.write(configfile)
    
    if not os.path.isdir(config["files"]["video_dir"]):
        os.mkdir(config["files"]["video_dir"])

    app = web.Application(client_max_size=int(config["files"]["max_upload_size"]))
    app.add_routes([
        web.get('/ws', websocket_handler),
        web.static("/vid", config["files"]["video_dir"]),
        web.static("/static", "./web"),
        web.post('/upload', fileUpload),
        web.get('/{path:.*}', hanetc)
    ])
    
    if config["server"]["usessl"] == "1":
        ssl_context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
        ssl_context.load_cert_chain(config["server"]["certfile"], config["server"]["keyfile"])
        web.run_app(app, ssl_context=ssl_context, host=config["server"]["bind_address"], port=int(config["server"]["port"]))
    else:
        web.run_app(app, host=config["server"]["bind_address"], port=int(config["server"]["port"]))


if __name__ == '__main__':
    main()
