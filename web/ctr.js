
var websoc = new WebSocket((window.location.protocol == "https:" ? "wss" : "ws")+"://"+window.location.host+"/ws")
window.onbeforeunload = function() {
    websoc.close()
}
websoc.onopen = function() {
    websoc.send(JSON.stringify(["sub", "C"]))
    websoc.send(JSON.stringify(["getavalist"]))
}
websoc.onmessage = function(mess) {
    var data = JSON.parse(mess.data)
    console.log(data)
    switch (data[0]) {
        case 'avalist':
            avalistHan(data[1])
            break;
        case 'dispConf':
            updateLay(data[1])
            break;
        default:
            break;
    }
}
window.onload = function () {
    const layCont = document.getElementById("layoutCon")
    for (let i = 1; i <= 4; i++) {
        const table = document.createElement("table")
        table.setAttribute("class", "layTable")
        for (let j = 1; j <= i; j++) {
            const tr = document.createElement("tr")
            for (let k = 1; k <= i; k++) {
                const td = document.createElement("td")
                td.id = `p${i}-${j}-${k}`
                td.classList.add("layoutCell")
                tr.appendChild(td)
            }
            table.appendChild(tr)
        }
        layCont.appendChild(table)
    }
}

function updateLay(d) {
    const layCont = document.getElementById("layoutCon")
    const toDel = layCont.getElementsByTagName("span")
    while (toDel.length > 0) {
        toDel[0].parentElement.removeChild(toDel[0])
    }
    for (let i = 0; i < d.length; i++) {
        const e = d[i];
        const sel = document.createElement("span")
        sel.innerText = i
        sel.addEventListener('mousedown', dragHand)
        sel.addEventListener('touchstart', dragHand, {passive: false})
        const par = document.getElementById(`p${e[0]}-${e[1]}-${e[2]}`)
        par.appendChild(sel)
    }
}

var dragEl = null
function dragHand(e) {
    let x, y
    e.preventDefault()
    if (e instanceof TouchEvent) {
        document.addEventListener('touchmove', moveHand)
        document.addEventListener('touchend', upHand)
        x = e.touches[0].clientX; y = e.touches[0].clientY
    } else {
        document.addEventListener('mousemove', moveHand)
        document.addEventListener('mouseup', upHand)
        x = e.clientX; y = e.clientY
    }
    const el = e.srcElement
    el.style.position= 'fixed';
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    e.srcElement.style.position = "fixed"
    dragEl = el
}
lastXY = [null, null]
function moveHand(e) {
    let x, y;
    if (e instanceof TouchEvent) {
        x = e.touches[0].clientX; y = e.touches[0].clientY
    } else {
        x = e.clientX; y = e.clientY
    }
    dragEl.style.left = `${x}px`
    dragEl.style.top = `${y}px`
    lastXY = [x, y]
}
function upHand(e) {
    let tarEl = null
    if (e instanceof TouchEvent) {
        document.removeEventListener('touchmove', moveHand)
        document.removeEventListener('touchend', upHand)
        tarEl = document.elementFromPoint(lastXY[0], lastXY[1])
    } else {
        document.removeEventListener('mousemove', moveHand)
        document.removeEventListener('mouseup', upHand)
        tarEl = e.srcElement
    }
    dragEl.style.position = "static"
    if (tarEl.classList.contains("layoutCell")) {
        tarEl.appendChild(dragEl)
        sendLayout()
    } else if (tarEl.parentElement.classList.contains("layoutCell")) {
        tarEl.parentElement.appendChild(dragEl)
        sendLayout()
    }
    dragEl = null
}

function sendLayout() {
    const layCont = document.getElementById("layoutCon")
    const els = layCont.getElementsByTagName("span")
    o = []
    for (let i = 0; i < els.length; i++) {
        const e = els[i];
        const p = e.parentElement.id.substring(1).split('-')
        o[parseInt(e.innerText)] = [parseInt(p[0]), parseInt(p[1]), parseInt(p[2])]
    }
    websoc.send(JSON.stringify(["dispConf", o]))
}

function chngVid(txt, pref = false) {
    websoc.send(JSON.stringify(["chngvid", txt, pref]))
}

function avalistHan(vals) {
    document.getElementById("loadingicon").style.display = "none"
    const ul = document.createElement("ul")
    ul.setAttribute("id","avalist")
    for (let i = 0; i < vals.length; i++) {
        const li = document.createElement("li")
        const d1 = document.createElement("div")
        d1.innerText = vals[i]
        const d2 = document.createElement("div")
        d2.innerText = "Load"
        d2.addEventListener("click", () => chngVid(vals[i], false))
        const d3 = document.createElement("div")
        d3.innerText = "Prefetch"
        d3.addEventListener("click", () => chngVid(vals[i], true))
        li.appendChild(d1)
        li.appendChild(d2)
        li.appendChild(d3)
        ul.appendChild(li)
    }
    document.getElementById("avalist").replaceWith(ul)
}


function butHandle(a) {
    websoc.send(JSON.stringify([a]))
}

function sendURL() {
    document.getElementById("loadingicon").style.display = "inline-block"
    websoc.send(JSON.stringify(["reqURL", document.getElementById("reqURL").value]))
}

function seek(val) {
    websoc.send(JSON.stringify(["seek", parseInt(val) * 1000]))
}

function sendFile() {
    const formData = new FormData();
    formData.append("file", document.getElementById("file-upload").files[0])
    fetch("upload", {body: formData, method: "post"})
}
