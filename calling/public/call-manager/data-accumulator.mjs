/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * This module allows us to accumulate sound data, prior to transmission.
 * 
 * NOTE, there would be memory leak, if the ondata method is set after a write,
 * or, changed during runtime, as accumulated data is never passed into the callback.
 */


const data = Symbol()
const chunkSize = Symbol()
const buffer = Symbol()



export default class DataAccumulator {

    /**
     * 
     * @param {object} param0 
     * @param {number} param0.chunk_size
     * @param {number} param0.maxBufferLength
     * @param {(buffer: Float32Array)=>void} param0.ondata An optional callback 
     * that would be invoked each time data is available
     * If there's no 
     */
    constructor({ chunk_size, maxBufferLength, ondata }) {
        this[chunkSize] = chunk_size

        this[data] = new Float32Array(chunk_size)
        this.ondata = ondata
        this[buffer] = []
        this.maxBufferLength = maxBufferLength || 1024

    }
    /**
     * @readonly
     */
    get chunkSize() {
        return this[chunkSize]
    }

    /**
     * This method is used to append data to the accumulator
     * @param {Float32Array} fl32Buff 
     * @returns {void}
     */
    write(fl32Buff) {

        const portionLength = Math.max(this[chunkSize] - this[data].length, 0);
        const portion = fl32Buff.slice(0, portionLength)

        if (!(this[data] instanceof Float32Array)) {
            console.log(`Reinitialized this[data]`)
            this[data] = new Float32Array(this[chunkSize])
        }

        this[data] = concat(this[data], portion)

        if (this[data].length >= this[chunkSize]) {
            (
                this.ondata || ((input) => {
                    this[buffer].push(input)
                    if (this[buffer].length > this.maxBufferLength) {
                        this[buffer].shift()
                    }
                })
            )(this[data])
            this[data] = fl32Buff.slice(portionLength, fl32Buff.length)
        }

    }

    /**
     * This method returns an unread chunk of data.
     * 
     * This method only works if there's no ondata() method on this object.
     * If the ondata() method exists, data would not be buffered in the first place.
     * It would have been sent to the ondata() method
     * @returns {Float32Array}
     */
    read() {
        return this[buffer].shift()
    }

}


/**
 * This method joins two TypedArrays into one
 * @param {Float32Array} a 
 * @param {Float32Array} b 
 * @returns {Float32Array}
 */
function concat(a, b) {
    if (!(a instanceof Float32Array) || !(b instanceof Float32Array)) {
        console.log(`Invalid arguments `, a, `and `, b)
        throw new Error(`Only Float32Arrays must be passed`)
    }
    const res = new Float32Array([...new Float32Array(a), ...new Float32Array(b)])
    return res

}