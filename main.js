// ==UserScript==
// @name        Bonkio commands
// @description Improve your exirence in bonk.io
// @match        https://bonk.io/*
// ==/UserScript==

function ScriptInjector(closure) {
    if(window.location == window.parent.location) {
        if(document.readyState == "complete") {
            closure()
        } else { 
            document.addEventListener('readystatechange',function(){
                setTimeout(closure, 1500)
            })
        }
    }
}

ScriptInjector(
    function() {
        function clearDocument() {
            document.getElementById("bonkioheader").remove()
            document.getElementById("adboxverticalleftCurse").remove()
            document.getElementById("adboxverticalCurse").remove()
            document.getElementById("descriptioncontainer").remove()
            
            document.getElementById("maingameframe").removeAttribute("style")
        }

        const second = 1000
        const fps = 20
        const runInterval = fps / second

        let messaging = {
            processingMessages: new Array(),
            newMessages: new Array(),
            myID: undefined,
            wssClient: undefined,
            rateLimitMessageDate: undefined,
        }
        window.messaging = messaging

        messaging.send = function(message) {
            if (this.wssClient == undefined) {
                return
            }

            this.processingMessages.push(message)
            this.wssClient.send('42[10,{"message":'+JSON.stringify(message)+'}]')
        }

        messaging.onMessage = function(id, message) {
            let messageIdx = this.processingMessages.indexOf(message)
            if (messageIdx >= 0) {
                this.processingMessages.splice(messageIdx, 1)
            }
        }

        messaging.didChatRateLimit = function() {
            this.rateLimitMessageDate = new Date()
            this.newMessages = this.processingMessages.concat(this.newMessages)
            this.processingMessages = []
        }

        messaging.processing = function() {
            let now = new Date().getTime()
            let silentInterval = 3 * second

            if (typeof this.rateLimitMessageDate == 'undefined' && this.newMessages.length) {
                let message = this.newMessages.shift()
                this.send(message)
            } else if (typeof this.rateLimitMessageDate == 'object' && now - this.rateLimitMessageDate.getTime() >= silentInterval && this.newMessages.length) {
                let message = this.newMessages.shift()
                this.send(message)
            }
        }
        
        clearDocument()
        
        window.gameWindow = document.getElementById("maingameframe").contentWindow
        window.gameDocument = document.getElementById("maingameframe").contentDocument
        
        let inRoom = false
        
        if (typeof(window.runLoop)=='undefined') {
            clearInterval(window.runLoop)
        }
        
        if (typeof(window.originalSend)=='undefined') {
            window.originalSend = window.gameWindow.WebSocket.prototype.send
        }
        
        window.gameWindow.WebSocket.prototype.send = function(args) {
            const joinCommand = '42[13,'
            const getMessageCommand = '42[20,'
            const rateLimitCommand = '42[16,'
            if (this.url.includes("socket.io/?EIO=3&transport=websocket&sid=")) {
                messaging.wssClient = this

                var originalRecieve = this.onmessage
                this.onmessage = function (args) {
                    if (args.data.startsWith(rateLimitCommand)) {
                        messaging.didChatRateLimit()
                    } else if (args.data.startsWith(getMessageCommand)) {
                        let components = args.data.slice(getMessageCommand.length, -1).split(",")
                        let id = components[0]
                        let message = components[1].replace(/^"+|"+$/g, '');

                        messaging.onMessage(id, message)
                    }
                    return originalRecieve.call(this, args)
                }
                if (args.startsWith(joinCommand)) {
                    inRoom = true
                    let jsonText = args.slice(joinCommand.length, -1)
                    let obj = JSON.parse(jsonText)
                    messaging.myID = obj.dbid
                }

                var originalClose = this.onclose
                this.onclose = function () {
                    inRoom = false
                    return originalClose.call(this)
                }
            }
            
            return window.originalSend.call(this, args)
        }
        
        window.runLoop = setInterval(function() {
            if (!inRoom) {
                return
            }

            messaging.processing() 

        }, runInterval)
    }
)

