from aiohttp import web
import aiohttp
import os
import asyncio
import ssl
import time
import json
import configparser



config = configparser.ConfigParser()

wsPclients = set()
wsCclients = set()
curVid = ""
vidStartTime = 0
curPos = 0
isPlaying = False


async def ytdl(url):
    global config
    process = await asyncio.create_subprocess_exec(
        'yt-dlp',
        '-f', config["files"]["dl_format"],
        '-o', os.path.join(config["files"]["video_dir"],"%(title)s-%(id)s.%(ext)s"),
        url)
    await process.wait()

async def sendtoAll(data, clientList):    
    return await asyncio.gather(*[cli.send_json(data) for cli in clientList])
    

def getTime():
    return round(time.time() * 1000)
    


async def websocket_handler(request):
    global wsPclients; global wsCclients; global curVid; global vidStartTime; global curPos; global isPlaying
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
                await ytdl(data[1])
                await sendtoAll(["avalist", os.listdir(config["files"]["video_dir"])], wsCclients)
            elif data[0] == "getavalist":
                await ws.send_json(["avalist",os.listdir(config["files"]["video_dir"])])
            elif data[0] == "chngvid":
                curPos = 0
                curVid = data[1]
                isPlaying = False
                await sendtoAll(["chngvid", "/vid/"+ curVid, bool(int(config["player"]["prefetch"]))], wsPclients)
            elif data[0] == "vidreq":
                if curVid:
                    await ws.send_json(["chngvid", "/vid/"+ curVid, bool(int(config["player"]["prefetch"]))])
                if isPlaying:
                    await ws.send_json(["play", vidStartTime - curPos])
                else:
                    await ws.send_json([])
            elif data[0] == "sub":
                if data[1] == "P":
                    if not (ws in wsPclients):
                        wsPclients.add(ws)
                elif data[1] == "C":
                    if not (ws in wsCclients):
                        wsCclients.add(ws)
            elif data[0] == "showUI" or data[0] == "hideUI":
                await sendtoAll([data[0]], wsPclients)
        elif msg.type == aiohttp.WSMsgType.ERROR:
            print('ws connection closed with exception %s' %
                    ws.exception())
    
    if ws in wsPclients:
        wsPclients.remove(ws)
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
            "video_dir" : "./vid"
        }
        config["player"] = {
            "prefetch" : "0",
        }
        with open('config.ini', 'w') as configfile:
            config.write(configfile)
    
    if not os.path.isdir(config["files"]["video_dir"]):
        os.mkdir(config["files"]["video_dir"])

    app = web.Application()
    app.add_routes([
        web.get('/ws', websocket_handler),
        web.static("/vid", config["files"]["video_dir"]),
        web.static("/static", "./web"),
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