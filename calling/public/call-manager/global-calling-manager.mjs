/**
 * Copyright 2024 HolyCorn Software
 * The Faculty of Chat
 * This module, the global calling manager, is in charge of managing calls on the frontend, and providing an interface for the
 * server to create, and manage calls.
 */

import CallHandle, { internal } from "./handle.mjs"
import hcRpc from "/$/system/static/comm/rpc/aggregate-rpc.mjs";


const handles = Symbol()
const sdps = Symbol()
const instance = Symbol()
const members = Symbol()

export default class GlobalCallingManager {


    constructor() {

        if (GlobalCallingManager[instance]) {
            return GlobalCallingManager[instance]
        }

        /**
         * @type {{[call: string]: CallHandle}}
         */
        this[handles] = {};

        /**
         * @type {telep.chat.calling.ui.LocalSDPTable}
         */
        this[sdps] = {}

    }

    get sdps() {
        return this[sdps]
    }
    /**
     * This method gets a handle to call, that's either in progress, or yet to be picked up.
     * @param {object} param0 
     * @param {string} param0.id
     */
    async getHandle({ id }) {
        return this[handles][id] ||= await (
            async () => {
                const handle = new CallHandle({ data: await hcRpc.chat.calling.getCallData({ id }) })
                handle.destroySignal.addEventListener('abort', () => {
                    if (this[handles][id] == handle) {
                        delete this[handles][id]
                    }
                }, { once: true })
                return handle;
            }
        )()
    }

    /**
     * This field contains remote methods invoked by the server to make calling possible.
     */
    remote = {


        /**
         * 
         * @param {object} param0 
         * @param {string} param0.id
         * @param {telep.chat.calling.CallStat['members']} param0.members
         */
        async updateCallMembers({ id, members }) {

            function arraysEQ(a, b) {
                if (a?.length != b?.length) return;
                return JSON.stringify(a.sort()) == JSON.stringify(b.sort())
            }

            /** @type {(keyof members)[]} */
            const fields = ['acknowledged', 'invited', 'rejected']

            const mgr = GlobalCallingManager.get()

            const handle = await mgr.getHandle({ id })

            const knownMembers = mgr[handles][id].members;

            let shouldChange;
            for (const field of fields) {
                if (!arraysEQ(members[field], knownMembers[field])) {
                    shouldChange = true
                }
                knownMembers[field] = members[field]
            }
            if (!shouldChange) {
                return;
            }


            handle.events.dispatchEvent(new CustomEvent('members-change'))

        },

        async end({ id }) {
            const man = GlobalCallingManager.get();
            (await man.getHandle({ id })).exit()
            delete man[handles][id]
        },


        /**
         * This method is called by the remote server, to make a call ring
         * @param {object} param0 
         * @param {string} param0.id
         * @returns {Promise<void>}
         */
        async ring({ id }) {
            (await GlobalCallingManager.get().getHandle({ id })).localRing()
        },


        /**
         * @remote
         * This method is called remotely to inform the client of changes in other client's SDPs.
         * @param {object} param0
         * @param {string} param0.id
         * @param {telep.chat.calling.ui.LocalSDPTable} param0.data
         * 
         */
        async updateSDPs({ id, data }) {
            const handle = await GlobalCallingManager.get().getHandle({ id })
            for (const memberId in data) {
                handle[internal].sdps[memberId] = data[memberId]
            }
            handle.events.dispatchEvent(new CustomEvent('sdp-change',))
        },

        /**
         * This method is called remotely to update info about the rooms
         * @param {object} param0 
         * @param {string} param0.id
         * @param {telep.chat.calling.CallRoomState[]} param0.rooms
         */
        async updateRooms({ id, rooms }) {
            const handle = await GlobalCallingManager.get().getHandle({ id })

            handle.data.rooms = rooms

            handle.events.dispatchEvent(new CustomEvent('rooms-change'))
        },



        /**
         * This method sends an ICE candidate to a member on a call
         * @param {object} param0 
         * @param {string} param0.id
         * @param {string} param0.member
         * @param {string} param0.data
         */
        async addIceCandidate({ id, member, data }) {
            const handle = await GlobalCallingManager.get().getHandle({ id })
            handle.events.dispatchEvent(new CustomEvent('ice-candidate', { detail: data, member }))
        }

    }

    /**
     * 
     * Be careful!!
     * 
     * This is an internal method used everytime the client re-connects, in order to check list of ongoing calls,
     * so that we can remove local references to non-existent calls.
     */
    async checkStaleCalls() {

        const list = await hcRpc.chat.calling.getMyOngoingCalls()

        for (const id in this[handles]) {
            if (list.findIndex(x => x == this[handles][id].data.id) == -1) {
                this[handles][id].destroy()
            }
        }
    }

    /**
     * 
     * @returns {GlobalCallingManager}
     */
    static get() {
        return this[instance] ||= new GlobalCallingManager()
    }


    /**
     * 
     * @param {MediaStreamConstraints} constraints 
     * @param {AbortSignal} signal
     * @returns 
     */
    static async getMediaStream(constraints, signal) {
        const media = await navigator.mediaDevices.getUserMedia(constraints);
        signal?.addEventListener('abort', () => {
            media.getTracks().forEach(track => {
                track.stop()
                media.removeTrack(track)
            })
        }, { once: true })
        return media
    }


}