/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * This module deals with the backend aspects of making, and managing calls, be it voice, or video
 */

import ChatEventsController from "../events/controller.mjs"
import ChatManagement from "../management/controller.mjs"
import CallManager from "./manager/manager.mjs"


const manager = Symbol()
const controllers = Symbol()

export default class ChatCallingController {

    /**
     * 
     * @param {object} _controllers
     * @param {ChatEventsController} _controllers.events
     * @param {ChatManagement} _controllers.management
     */
    constructor(_controllers) {

        /** @type {CallManager} */
        this[manager] = new CallManager(
            {
                events: _controllers.events
            }
        );

        this[controllers] = _controllers
    }

    async hello() {
        console.log(`The first hello has been called`)

        const dat = {
            hi: () => {
                console.log(`Wow, the client says Hi`)
            },
            names: 'Son of Binary'
        }

        return new JSONRPC.ActiveObject(dat)
    }

    /**
     * This method places a call
     * @param {object} param0 
     * @param {string} param0.userid
     * @param {string} param0.chat
     * @param {telep.chat.calling.CallType} param0.type
     * @returns {Promise<string>}
     */
    async placeCallFromChat({ userid, chat, type }) {
        const chatInfo = await this[controllers].management.getChatInfoSecure(
            {
                id: chat,
                userid
            }
        );

        await this[controllers].management.authenticateAction(
            {
                chat: chat,
                request: {
                    call: {
                        [type]: true,
                    },
                },
                userid,
                throwError: true
            }
        );

        const id = await this[manager].createCall({ caller: userid, type, chat: chatInfo })

        return id
    }

    /**
     * This method returns information about a call
     * @param {object} param0 
     * @param {string} param0.userid
     * @param {string} param0.id
     */
    async getCallData({ userid, id }) {
        return await this[manager].getCallInfo({ id, userid })
    }

    /**
     * This method updates the server what the client's latest SDP descriptor is, and 
     * @param {object} param0 
     * @param {string} param0.userid
     * @param {string} param0.call
     * @param {telep.chat.calling.SDPUpdateData} param0.data 
     */
    async updateSDPData({ userid, call, data }) {
        return await this[manager].updateSDPData({ id: call, member: userid, data })
    }

    /**
     * This method sends an ICE candidate to a member on a call
     * @param {object} param0 
     * @param {string} param0.userid
     * @param {string} param0.call
     * @param {string} param0.member
     * @param {string} param0.data
     */
    async sendIceCandidate({ userid, call, member, data }) {
        await this[manager].sendIceCandidate({ userid, id: call, member, data })
    }

    /**
     * This method indicates to everyone, that the user is part of the call
     * @param {object} param0 
     * @param {string} param0.id
     * @param {string} param0.userid
     * 
     * @returns {Promise<void>}
     */
    async connect({ userid, id }) {

        await this[manager].connect({ member: userid, id })

    }

    /**
     * This method is called by a user, when he's leaving a call
     * @param {object} param0 
     * @param {string} param0.userid
     * @param {string} param0.id
     */
    async leaveCall({ userid, id }) {
        await this[manager].leaveCall({ call: id, member: userid })
    }


    /**
     * This method returns the ongoing calls that the invoking user is invited to
     * @param {object} param0 
     * @param {string} param0.userid
     */
    async getMyOngoingCalls({ userid }) {
        return this[manager].getOngoingCallsFor({ correspondent: userid })
    }

}