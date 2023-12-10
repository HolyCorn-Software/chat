/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * The Chat Faculty
 * This module event-client offers a standardized interface for frontend components,
 * while offering remote methods to backend components
 */

import ChatClientRemoteMethods from "./remote/remote.mjs";
import hcRpc from "/$/system/static/comm/rpc/aggregate-rpc.mjs";
import EventChannelClient from "/$/system/static/comm/rpc/json-rpc/event-channel/client.mjs";


/** @type {ChatEventClient} */
let instance;

export default class ChatEventClient extends EventChannelClient {

    static async create() {

        if (instance) {
            return instance
        }

        await hcRpc.chat.events.register()
        let firstTime = true

        return instance = new this(hcRpc.chat.$jsonrpc, async () => {
            hcRpc.chat.$jsonrpc.stub = (this.remote ||= new ChatClientRemoteMethods())

            if (firstTime) {
                return firstTime = false
            }
            await hcRpc.chat.events.register()
        });
    }

}




window.addEventListener('load', async () => {
    try {
        await (await ChatEventClient.create()).init()
    } catch (e) {
        // TODO: Schedule a retry
    }
}, { once: true })