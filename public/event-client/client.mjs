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
import GlobalCallingManager from "/$/chat/calling/static/call-manager/global-calling-manager.mjs";


/** @type {ChatEventClient} */
let instance;

/**
 * @extends EventChannelClient<telep.chat.events.AllEvents>
 */
export default class ChatEventClient extends EventChannelClient {

    static async create() {

        if (instance) {
            try {
                return await instance
            } catch { }
        }

        return await (instance = (async () => {


            let firstTime = true

            async function checkOngoingCalls() {
                const calls = await hcRpc.chat.calling.getMyOngoingCalls()
                for (const call of calls) {
                    GlobalCallingManager.get().remote.ring({ id: call })
                }
            }

            await checkOngoingCalls()

            return new this(hcRpc.chat.$jsonrpc, async function () {
                await hcRpc.chat.events.register()
                hcRpc.chat.$jsonrpc.stub = new ChatClientRemoteMethods()

                if (firstTime) {
                    return firstTime = false
                }
                // Get current calls, and put a ringer UI, for each.
                checkOngoingCalls()
            });

        })())
    }

}




setTimeout(async () => {
    try {
        await (await ChatEventClient.create()).init()
    } catch (e) {
        // TODO: Schedule a retry
    }
}, 2000)