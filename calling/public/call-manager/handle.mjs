/**
 * Copyright 2024 HolyCorn Software
 * The Faculty of Chat
 * This module represents a handle to a supposedly ongoing call.
 * It allows a UI component to stay up to date with the call, as well as control it easily.
 */

import CallRingerUI from "../widgets/ringer/widget.mjs";
import hcRpc from "/$/system/static/comm/rpc/aggregate-rpc.mjs";



const aborter = Symbol()

export const internal = Symbol()

const ended = Symbol()

const ringer = Symbol()



/**
 * Anyone using the CallHandle for the purpose of conducting calls, up to the transport layer, should override the {@link onCreateAnswer} method
 */
export default class CallHandle {


    /**
     * 
     * @param {object} param0 
     * @param {telep.chat.calling.FrontendCallStatPlus} param0.data
     */
    constructor({ data }) {
        /** @type {telep.chat.calling.ui.CallEvents} */
        this.events = new EventTarget()
        this.data = data
        this.members = data.members;
        this.type = data.type

        /** @type {modernuser.profile.UserProfileData[]} */ this.profiles = data.profiles

        this[aborter] = new AbortController()

        /**
         * @type {{sdps: telep.chat.calling.ui.LocalSDPTable}}
         */
        this[internal] = {
            sdps: {}
        }

        this[aborter].signal.addEventListener('abort', () => {
            this.events.dispatchEvent(new CustomEvent('end'))
        }, { once: true })

    }

    /**
     * @return {this[internal]['sdps']}
     */
    get sdps() {
        return JSON.parse(JSON.stringify(this[internal].sdps))
    }

    get destroySignal() {
        return this[aborter].signal
    }

    /**
     * This method can be called to make the ringing UI display locally
     */
    localRing() {

        if ('chatCallRingOverride' in window) {
            try {
                window.chatCallRingOverride({ id: this.data.id });
                return;
            } catch (e) {
                hcRpc.system.error.report(`Could not ring using override method: ${e}`);
            }
        }


        if (this[ringer]) return

        this[ringer] = new CallRingerUI(this.data.id);

        this[ringer].destroySignal.addEventListener('abort', () => { this[ringer] = true }, { once: true })

        this[aborter].signal.addEventListener('abort', () => {
            this[ringer]?.dismiss?.(0)
        })

        this[ringer].show()
    }

    /**
     * This method makes the current user to be removed from the call
     */
    async exit() {
        this.destroy()
        this[ended] = true
        hcRpc.chat.calling.leaveCall({ id: this.data.id }).catch(() => undefined)
    }
    /**
     * @readonly
     */
    get ended() {
        return !!this[ended]
    }

    /**
     * This method signals that the user doesn't even want to be a part of this call, and would not like to reminded about it.
     */
    decline() {

    }

    /**
     * This method signals that the user has accepted to be part of the call
     */
    async connect() {
        await hcRpc.chat.calling.connect({
            id: this.data.id,
        })
    }

    /**
     * This method releases the call handle, and all data associated with id
     */
    destroy() {
        try {
            this[aborter].abort()
        } catch (e) { }
        this.events.dispatchEvent(new CustomEvent('end'))
    }



    /**
     * This method adds someone to the call
     * @param {object} param0 
     * @param {string} param0.id
     */
    async addMember({ id }) {

    }


    /**
     * This method is called from the remote source, when the server wants an SDP answer to an offer
     * @param {object} param0 
     * @param {string} param0.member
     * @param {string} param0.offer
     * @returns {Promise<string>}
     */
    async onCreateAnswer({ member, offer }) {
        throw new Error(`This method has not been overrided.`)
    }


    /**
     * This method updates SDP data for a participant we're on call with
     * @param {object} param0 
     * @param {string} param0.member
     * @param {string} param0.data
     * @param {boolean} param0.forced
     */
    async updateSDPData({ member, data, forced }) {
        try {
            const results = await hcRpc.chat.calling.updateSDPData({
                call: this.data.id,
                data: {
                    [member]: data
                },
                forced
            });

            this[internal].sdps[member] ||= {}

            this[internal].sdps[member][results[member]] = data
            return results
        } catch (e) {
            if (/not.*found/gi.test(`${e}`)) {
                // If in the course of updating SDP data, we discover that the this call is invalid, let's drop it.
                this.destroy()
            }
            throw e
        }
    }

    /**
     * This method sends an ICE candidate to the other member on the call
     */
    async sendIceCandidate({ member, candidate }) {
        await hcRpc.chat.calling.sendIceCandidate({ member, call: this.data.id, data: candidate })
    }

}