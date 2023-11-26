/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * The Chat Faculty
 * This module (call-manager) provides utilities for managing aspects of calls
 */

import rpcHandover from "../handover/handover.mjs";


export default class CallManager {

    constructor() {

    }

    /**
     * 
     * @param {MediaDeviceKind} kind 
     * @returns 
     */
    static async getMediaStream(kind) {
        return await navigator.mediaDevices.getUserMedia({ audio: { deviceId: (await navigator.mediaDevices.enumerateDevices()).find(x => x.kind === kind).deviceId } });
    }
    /**
     * This method plays RAW PCM audio data, supplied as numbers in an array
     * @param {ArrayBuffer} arrBuff 
     * @param {AudioContext} context
     * @returns {Promise<void>}
     */
    static async playAudio(arrBuff, context) {
        const bufferSource = new AudioBufferSourceNode(
            context,
            {
                buffer: new AudioBuffer({ length: arrBuff.byteLength, numberOfChannels: 1, sampleRate: 44_100 })
            }
        );

        bufferSource.buffer.getChannelData(0).set(new Float32Array(arrBuff))
        bufferSource.connect(context.destination)
        bufferSource.start()
    }

    /**
     * This method is used to join a call
     * @param {string} id 
     * @param {Promise<void>}
     */
    static async joinCall(id) {
        // We join with an audio stream, and then connect the stream to 
        const socket = await rpcHandover(async (rpc) => {
            await rpc.chat.calling.joinStream({ id });
            return rpc.chat.$jsonrpc
        });


        const context = new AudioContext({ sampleRate: 44_100 })

        await context.audioWorklet.addModule(new URL("./call-audio-transport.mjs", import.meta.url).href)

        const callNode = new AudioWorkletNode(context, "call-audio-transport", {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            processorOptions: {
                bufferSize: 128
            }

        });

        callNode.port.onmessage = async (event) => {
            /** @type {Float32Array} */
            let source = event.data
            socket.send(source)
        }


        socket.addEventListener('message', async (event) => {
            const buffer = new Float32Array(await event.data.arrayBuffer())
            callNode.port.postMessage(buffer)
        })

        context.createMediaStreamSource(await CallManager.getMediaStream('audioinput')).connect(callNode)
        callNode.connect(context.destination)

        context.resume()





    }


}
