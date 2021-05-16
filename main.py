from aiohttp import web
import aiohttp
import os
import asyncio
import ssl
import time
import json




wsclients = set()
curVid = ""
vidStartTime = 0
curPos = 0
isPlaying = False
viddir = "./vid"


async def ytdl(url):
    process = await asyncio.create_subprocess_exec(
        'youtube-dl',
        '-f', 'bestvideo[ext=webm][height<=1080]+bestaudio[ext=webm]',
        '-o', os.path.join(viddir,"%(title)s-%(id)s.%(ext)s"),
        url)
    await process.wait()

async def sendtoAll(data):    
    return await asyncio.gather(*[cli.send_json(data) for cli in wsclients])
    

def getTime():
    return round(time.time() * 1000)
    


async def websocket_handler(request):
    global wsclients; global curVid; global vidStartTime; global curPos; global isPlaying
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    wsclients.add(ws)
    
    
    async for msg in ws:
        if msg.type == aiohttp.WSMsgType.TEXT:
            data = json.loads(msg.data)
            print(data)
            if data[0] == "timereq":
                await ws.send_json(["time", getTime()])
            elif data[0] == "seek":
                vidStartTime -= data[1]
                await sendtoAll(["seek", vidStartTime])
            elif data[0] == "play":
                vidStartTime = getTime()
                await sendtoAll([data[0], vidStartTime - curPos])
                isPlaying = True
            elif data[0] == "pause":
                await sendtoAll([data[0], getTime()])
                isPlaying = False
                curPos = getTime() - vidStartTime
            elif data[0] == "reqURL":
                await ytdl(data[1])
                await sendtoAll(["avalist", os.listdir(viddir)])
            elif data[0] == "getavalist":
                await ws.send_json(["avalist",os.listdir(viddir)])
            elif data[0] == "chngvid":
                curPos = 0
                curVid = data[1]
                isPlaying = False
                await sendtoAll(["chngvid", "/vid/"+ curVid])
            elif data[0] == "vidreq":
                if curVid:
                    await ws.send_json(["chngvid", "/vid/"+ curVid])
                if isPlaying:
                    await ws.send_json(["play", vidStartTime - curPos])
                else:
                    await ws.send_json([])
        elif msg.type == aiohttp.WSMsgType.ERROR:
            print('ws connection closed with exception %s' %
                    ws.exception())
    wsclients.remove(ws)
    return ws

async def hanetc(req):
    if req.path == "/":
        with open("web/index.html") as f:
            return web.Response(text=f.read(),content_type="text/html")
    
    if req.path in ["/vp", "/ctr"]:
        with open(f"web{req.path}.html") as f:
            return web.Response(text=f.read(),content_type="text/html")

    if req.path == "/favicon.ico":
        with open("web/favicon.ico","rb") as f:
            return web.Response(body=f.read(),content_type="image/x-icon")

    return web.Response(text="404 Not found",content_type="text/plain", status=404)
    

async def sendloop():
    while True:
        await asyncio.sleep(1)
        for ws in wsclients:
            await ws.send_str("Hi")
    
    

app = web.Application()
app.add_routes([
    web.get('/ws', websocket_handler),
    web.static("/vid", viddir),
    web.static("/static", "./web"),
    web.get('/{path:.*}', hanetc)
])


def main():
    dlist = os.listdir()
    if 'fullchain.pem' in dlist and 'privkey.pem' in dlist:
        ssl_context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
        ssl_context.load_cert_chain('fullchain.pem', 'privkey.pem')
        web.run_app(app, ssl_context=ssl_context, port=4443)
    else:
        web.run_app(app, port=8080)


if __name__ == '__main__':
    main()