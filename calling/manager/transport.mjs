/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * This module is responsible for piping call data from one point to another.
 * This module is created for every 
 */

import { WebSocketChannel } from "../../../../system/lib/nodeHC/http/websocket/websocket-channel.js";

const channels = Symbol()

const cleanupTimeout = Symbol()

export default class CallTransportManager extends EventTarget {


    /**
     * 
     * @param {string} id The id of the call
     */
    constructor(id) {

        super()


        this[channels] = {
            /** @type {WebSocketChannel[]} */
            voice: [],
            /** @type {WebSocketChannel[]} */
            video: []
        }

        this.id = id

        /** @type {(event: "end", cb: (event: CustomEvent)=> void )=> void} */ this.addEventListener

    }

    /**
     * This method adds websocket to a particular channel
     * @param {WebSocketChannel} socket 
     * @param {"voice" | "video"} channel
     */
    add(socket, channel) {

        // TODO: Implement cleanup, in situations where all members have left the call
        // for too long

        const ondata = (msg) => {
            this[channels][channel]?.filter(x => x !== socket).forEach(client => {
                if (!client.socket.destroyed && !client.socket.writableEnded) {
                    client.send(msg.data, 'binary')
                }
            })
        }
        socket.addListener('data', ondata);

        const onend = () => {
            socket.removeAllListeners()
            this[channels][channel] = this[channels][channel]?.filter(x => x !== socket)
            if (this[channels][channel].length === 0) {
                this[channels][channel] = undefined
            }

            if (Reflect.ownKeys(this[channels]).every(
                type => (this[channels][type]?.length || 0) === 0
            )) {
                clearTimeout(this[cleanupTimeout])
                this[cleanupTimeout] = setTimeout(() => {
                    this.dispatchEvent(new CustomEvent('end'))
                }, 30_000)
            }
        };

        socket.once('end', onend)

        socket.once('remove', onend)

        if (this[channels][channel].findIndex(x => x === socket) == -1) {
            this[channels][channel].push(socket)
        }

        clearTimeout(this[cleanupTimeout])

    }

    /**
     * This method removes a socket from the routing logic. 
     * 
     * @param {WebSocketChannel} socket 
     * @returns {void}
     */
    remove(socket) {
        socket.emit('remove')
    }


}