/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * This module is an Audio Processor Node, responsible for getting raw audio out
 * of the audio system, and also for playing sound
 */

import DataAccumulator from "./data-accumulator.mjs"


const buffers = Symbol()



class CallAudioTransport extends AudioWorkletProcessor {


    constructor({ processorOptions }) {
        super()

        let chunk_size = processorOptions.bufferSize || 128

        this[buffers] = {
            mic: new DataAccumulator({ chunk_size }),
            speaker: new DataAccumulator({ chunk_size })
        }


        this.port.onmessage = (ev) => {
            // console.log(`message `, ev)
            this[buffers].speaker.write(ev.data)
        }

        this[buffers].mic.ondata = (buffer) => {
            this.port.postMessage(buffer)
        }

    }

    /**
     * This method is called by the audio system, when there's data available for processing
     * @param {Float32Array[][]} inputs 
     * @param {Float32Array[][]} outputs 
     * @returns {boolean}
     */
    process(inputs, outputs) {

        if (inputs[0][0]) {
            try {
                // this[buffers].mic.write(inputs[0][0])
                this.port.postMessage(inputs[0][0])
            } catch (e) {
                console.error(e, `\nbecause inputs was `, inputs)
                return false
            }
            for (let i = 0; i < inputs[0][0].length; i++) {
                if (inputs[0][0][i] > 1 || inputs[0][0][i] < -1) {
                    console.log(`Data may be corrupted ${inputs[0][0][i]}`)
                }
            }
        }

        const chunk = (this[buffers].speaker.read()) || [...' '.repeat(outputs[0][0].length)].map(() => 0)
        if (chunk) {
            outputs.forEach(channels => {
                channels.forEach(channel => {
                    for (let i = 0; i < channel.length; i++) {
                        channel[i] = chunk[i]
                    }
                })
            })
        }

        return true
    }


}


registerProcessor("call-audio-transport", CallAudioTransport)