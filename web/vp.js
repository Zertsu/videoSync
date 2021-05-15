
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
        if(dif > 30) {
            ve.playbackRate = 1.1
        } else if (dif < -30) {
            ve.playbackRate = .9    
        } else {
            ve.playbackRate = 1
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
    websoc = new WebSocket("wss://"+window.location.host+"/ws")
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
    timesync = document.getElementById("timesync")
    setInterval(function() {
        if (debug) {
            timesync.innerText = String(getTime()).substr(-5,3)
        }
    }, 100)
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
    syncoffset -= parseInt(v);
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