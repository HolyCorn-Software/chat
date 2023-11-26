/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * The Chat Faculty
 * This module handover, allows for the possibility of joining streams, and handing
 * over the socket to caller
 */

import hcRpc, { AggregateRPCProxy } from "/$/system/static/comm/rpc/aggregate-rpc.mjs";
import ClientJSONRPC from "/$/system/static/comm/rpc/websocket-rpc.mjs";



/**
 * This function allows us to do a remote task, and return a reference to the socket that was
 * used to do the task
 * @param {(rpc: rpc.hcRPC) => Promise<ClientJSONRPC>} fxn  This function should return the appropriate rpc object e.g chat.$jsonrpc
 * @returns {Promise<WebSocket>}
 */
export default async function rpcHandover(fxn = () => undefined) {

    const rpc = new AggregateRPCProxy()
    const data = await fxn(rpc)
    if (!(data instanceof ClientJSONRPC)) {
        throw new Error(`The function passed into rpcHandover() doesn't return a ClientJSONRPC object.\nYou could, for example, return rpc.modernuser.$jsonrpc, which would be the ClientJSONRPC object used to make connections to modernuser.`)
    }
    return data.detachSocket()

}

