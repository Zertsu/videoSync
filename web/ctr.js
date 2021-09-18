
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
        default:
            break;
    }
}

function chngVid(txt) {
    websoc.send(JSON.stringify(["chngvid", txt]))
}

function avalistHan(vals) {
    document.getElementById("loadingicon").style.display = "none"
    var ul = document.createElement("ul")
    ul.setAttribute("id","avalist")
    for (let i = 0; i < vals.length; i++) {
        var li = document.createElement("li")
        li.innerText = vals[i]
        li.setAttribute("onclick", "chngVid(this.innerText)")
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