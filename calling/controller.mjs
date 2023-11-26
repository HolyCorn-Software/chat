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

        const id = await this[manager].createCall({ recipients: chatInfo.recipients, caller: userid, type })

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
     * This method joins the socket of the calling 
     * @param {object} param0 
     * @param {string} param0.userid
     * @param {string} param0.id
     * @param {FacultyPublicJSONRPC} param0.$client
     * @returns {Promise<void>}
     */
    async joinStream({ userid, id, $client }) {
        await this[manager].joinStream({ id, userid, socket: $client.socketClient })
        setTimeout(() => {
            $client.destroy()
        }, 500)

    }

}