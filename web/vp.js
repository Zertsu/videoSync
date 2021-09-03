
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
function scaleC(val) {
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
    table.firstChild.firstChild.setAttribute("id","td-sel")
    document.getElementById("sqrPicker").replaceWith(table)
    document.documentElement.style.setProperty("--pos-x", 0)
    document.documentElement.style.setProperty("--pos-y", 0)
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
                ve.setAttribute("src", data[1])
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
    scaleC(1)
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

//Called from HTML
function togUI() {
    var st =  document.documentElement.style
    if (st.getPropertyValue("--dis-ui") == "none") {
        st.setProperty("--dis-ui", "block")
    } else {
        st.setProperty("--dis-ui", "none")
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