
var websoc = null
var ve;
var syncoffset = 0;
var ping = 0;
var vStart = 0;
var debug = false

function getTime() {
    return new Date().getTime() + syncoffset
}
function getAbsTime() {
    return new Date().getTime()
}
function seekajust() {
    if (!ve.paused) {
        var dif = (getTime() - vStart) - ve.currentTime * 1000
        if(Math.abs(dif) > 3000 && !ve.seeking) {
            ve.currentTime += dif / 1000
        } else {
            if(dif > 30) {
                ve.playbackRate = 1.1
            } else if (dif < -30) {
                ve.playbackRate = .9
            } else {
                ve.playbackRate = 1
            }
        }
        //console.log(dif, ve.playbackRate)
    }
}
function scaleC(val, dontSend = false, x = 1, y = 1) {
    document.documentElement.style.setProperty("--scale", val)
    var table = document.createElement("table")
    table.setAttribute("id","sqrPicker")
    for (let i = 0; i < val; i++) {
        var tr = document.createElement("tr")
        for (let j = 0; j < val; j++) {
            var td = document.createElement("td")
            td.setAttribute("onclick","sp(this)")
            td.innerText = `${i+1} - ${j+1}`
            tr.appendChild(td)
        }
        table.appendChild(tr)
    }
    table.children[x - 1].children[y - 1].setAttribute("id","td-sel")
    document.getElementById("sqrPicker").replaceWith(table)
    document.documentElement.style.setProperty("--pos-x", y - 1) // oops wrong order lol
    document.documentElement.style.setProperty("--pos-y", x - 1)
    if (!dontSend) {
        websoc.send(JSON.stringify(["cdispConf", [parseInt(val), 1, 1]]))
    }
}

window.onbeforeunload = function() {
    websoc.close()
}

function setupWS() {
    websoc = new WebSocket((window.location.protocol == "https:" ? "wss" : "ws")+"://"+window.location.host+"/ws")
    websoc.onmessage = function(mess) {
        var data = JSON.parse(mess.data)
        console.log(data)
        switch (data[0]) {
            case 'time':
                var timeNow = getAbsTime()
                var serverTime = data[1] + (timeNow - ping)/2
                syncoffset = serverTime - timeNow
                break
            case 'seek':
                vStart = data[1]
                console.log("SS", (getTime() - vStart) / 1000)
                ve.currentTime = (getTime() - vStart) / 1000
                break;
            case 'pause':
                ve.pause()
                break
            case 'play':
                    vStart = data[1]
                    ve.play()
                break
            case 'chngvid':
                setVideo(data[1], data[2])
                break;
            case 'hideUI':
                togUI(false)
                break
            case 'showUI':
                togUI(true)
                break
            case 'showID':
                togIndex(true)
                break
            case 'hideID':
                togIndex(false)
                break
            case 'cindex':
                indexEl.innerText = data[1]
                break
            case 'cdispConf':
                scaleC(data[1][0], true, data[1][1], data[1][2])
                document.getElementById("scale-slider").value = data[1][0]
                break
            default:
                break;
        }
    }
    websoc.onopen = function() {
        websoc.send(JSON.stringify(["timereq"]))
        ping = getAbsTime()
        window.onbeforeunload = function() {
            websoc.close()
        }
        setTimeout(function() {
            websoc.send(JSON.stringify(["sub","P"]))
            websoc.send(JSON.stringify(["vidreq"]))
        }, 3000)
    }
}

window.onload = function () {
    setupWS()
    setInterval(seekajust,100)
    setInterval(function() {
        if (websoc.readyState == 3) {
            setupWS()
        }
    },5000)
    ve = document.getElementById("video")
    scaleC(1, true)
    debugEl = document.getElementById("debug")
    setInterval(function() {
        if (debug) {
            debugEl.innerText = 
                ve.playbackRate + " " +
                String(getTime()).substr(-5,3) + " " +
                String(websoc.readyState)
        }
    }, 100)
    tickerEl = document.getElementsByClassName("syncer")[0]
    indexEl = document.getElementsByClassName("playerId")[0]
}

function ticketAnimate() {
    if(window.getComputedStyle(tickerEl).display != "none") {
        var time = getTime()/1000
        tickerEl.firstElementChild.children[Math.floor(time % 4)].style["filter"] = "opacity(" + Math.max(1 - time + Math.floor(time), 0.1).toString() + ")"
        window.requestAnimationFrame(ticketAnimate)
    } else {
        for (const el of tickerEl.firstElementChild.children) {
            el.style.filter = "opacity(0.1)"
        }; 
    }
}

function setVideo(url, preF) {
    if (ve.src.startsWith("blob:")) {
        URL.revokeObjectURL(ve.src)
    }
    if (preF) {
        ve.pause()
        var req = new XMLHttpRequest()
        req.open('GET', url, true)
        req.responseType = 'blob'
        statEl = document.getElementById("prefStatus")
        percent = 0
        function updateDownload() {
            if (percent == 100) {
                statEl.innerText = ""
            } else {
                statEl.innerText = `Downloading ${percent}%`
                window.requestAnimationFrame(updateDownload)
            }
        }
        req.onload = function() {
            if (this.status === 200) {
                percent = 100
                var videoBlob = this.response
                var vid = URL.createObjectURL(videoBlob)
                ve.src = vid
            }
        }
        req.onprogress = function(evn) {
            percent = (evn.loaded/evn.total*100).toFixed(0)
        }
        window.requestAnimationFrame(updateDownload)
        req.send()
    } else {
        ve.setAttribute("src", url)
    }
}

//Called from HTML
function togUI(show = null) {  
    var st =  document.documentElement.style
    if (show == null) {
        if (st.getPropertyValue("--dis-ui") == "none") {
            st.setProperty("--dis-ui", "block")
        } else {
            st.setProperty("--dis-ui", "none")
        }
    } else {
        st.setProperty("--dis-ui", show ? "block" : "none")
    }
}
function ajustOff(v) {
    syncoffset += parseInt(v.innerText);
}
function togFull() {
    if(!document.fullscreenElement) {
        document.documentElement.requestFullscreen()
    } else {
        document.exitFullscreen()
    }
}
function togMute(e) {
    ve.muted=!ve.muted
    if(ve.muted) {
        e.innerText = "Unmute"
    } else {
        e.innerText = "Mute"
    }
}
function sp(cor) {
    document.getElementById("td-sel").removeAttribute("id")
    cor.setAttribute("id", "td-sel")
    var arr = cor.innerText.split(" ")
    document.documentElement.style.setProperty("--pos-x", parseInt(arr[2]-1))
    document.documentElement.style.setProperty("--pos-y", parseInt(arr[0]-1))
    websoc.send(JSON.stringify(["cdispConf", [parseInt(document.documentElement.style.getPropertyValue('--scale')), parseInt(arr[0]), parseInt(arr[2])]]))
}
function togDebug() {
    debug = !debug
    document.getElementById("debug").style.display = (debug) ? "inline-block" : "none"
}
function togSync() {
    if (tickerEl.style.display == "block") {
        tickerEl.style.display = "none"
    } else {
        tickerEl.style.display = "block"
        ticketAnimate()
    }
}
function togIndex(show = null) {
    if (show == null) {
        indexEl.style.display = indexEl.style.display == "none" ? "block" : "none"
    } else {
        indexEl.style.display = show ? "block" : "none"
    }
}
