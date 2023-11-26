/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * This piece of logic manages calls directly, and keeps their status information
 */

import shortUUID from "short-uuid";
import ChatEventsController from "../../events/controller.mjs";
import muser_common from "muser_common";
import CallTransportManager from "./transport.mjs";
import { WebSocketChannel } from "../../../../system/lib/nodeHC/http/websocket/websocket-channel.js";


const stats = Symbol()

const controllers = Symbol()

export default class CallManager {


    /**
     * 
     * @param {object} controllerS 
     * @param {ChatEventsController} controllerS.events
     */
    constructor(controllerS) {

        /** @type {telep.chat.calling.CallStats} */
        this[stats] = {};

        this[controllers] = controllerS;

        this[controllers].events.addEventListener('client-add', async ({ detail: data }) => {

            // Now that there's a new client, let's find calls worth ringing
            for (const id in this[stats]) {
                const call = this[stats][id].members
                if (data.ids.some(cl_id => cl_id === id)) {
                    // Now make the call ring

                    this[controllers].events.clients(
                        [
                            data.ids[0],
                        ],
                        {
                            precallWait: 5000,
                            retries: 5,
                            timeout: 10_000,
                            retryDelay: 500
                        }
                    ).calling.ring({ call }).catch(e => {
                        console.error(`Failed to make call (${id}) \n`, call, `\nring!\n`)
                    })

                }
            }

        })

    }

    /**
     * This method creates a new call
     * @param {object} param0 
     * @param {string[]} param0.recipients
     * @param {telep.chat.calling.CallType} param0.type
     * @param {string} param0.caller
     * @returns {Promise<string>}
     */
    async createCall({ recipients, type, caller }) {

        const rec = [...new Set([...recipients, caller])]

        const id = `${shortUUID.generate()}${shortUUID.generate()}`

        this[stats][id] = {
            members: {
                invited: rec,
                acknowledged: [caller],
            },
            time: {
                created: Date.now(),
            },
            type: type === 'video' ? type : 'voice',
            transportManager: new CallTransportManager(id)

        }

        await this.ring({ call: id, ids: rec.filter(x => x !== caller) })

        const callEnd = () => {
            this[stats][id].transportManager.removeEventListener('end', callEnd)
            delete this[stats][id]

        }
        this[stats][id].transportManager.addEventListener('end', callEnd)


        return id
    }

    /**
     * This method is used to ring the lines of correspondents to a call
     * @param {object} param0 
     * @param {string} param0.call
     * @param {string[]} param0.ids
     */
    async ring({ call, ids }) {
        const call_data = this[stats][call]
        if (!call_data) {
            throw new Exception(`The call ${call} doesn't exists.`)
        }

        // If there's no fixed list of people to ring, let's ring all invited members who haven't
        // acknowledged the call yet
        ids ||= call_data.members.invited.filter(inv => !call_data.members.acknowledged.some(ack => ack === inv))

        this[controllers].events.clients(ids, {
            precallWait: 5000,
            retries: 5,
            timeout: 10_000,
            retryDelay: 500
        }).calling.ring(
            {
                call
            }
        ).catch((e) => {
            // Nevermind if ringing times out
            if (/timeout/.test(`${e}`)) {
                return;
            }
            console.error(`Could not ring call ${call.red} `, e)

        })
    }

    /**
     * This method returns information about a call
     * @param {object} param0 
     * @param {string} param0.id id of the call
     * @param {string} param0.userid if specified, then checks will be made to 
     * authenticate the user
     */
    async getCallInfo({ id, userid }) {
        if (!this[stats][id]) {
            throw new Exception(`Call '${id}' not found.`)
        }
        await muser_common.whitelisted_permission_check(
            {
                whitelist: await this[stats][id]?.members?.invited || [],
                userid,
                permissions: ['permissions.telep.chat.supervise'],
                intent: { freedom: 'use' },
                throwError: true
            }
        )
        const data = {
            ...this[stats][id],
            profiles: (
                await (await FacultyPlatform.get().connectionManager.overload.modernuser()).profile.getProfiles(
                    [...this[stats][id].members.invited, ...this[stats][id].members.acknowledged]
                )
            )
        }
        delete data.transportManager
        return data
    }

    /**
     * This method joins a socket into a call, so that all in the call may 
     * reach each other
     * @param {object} param0 
     * @param {string} param0.userid
     * @param {string} param0.id
     * @param {WebSocketChannel} param0.socket
     * @returns {Promise<void>}
     */
    async joinStream({ id, userid, socket }) {
        await this.getCallInfo({ id, userid })
        // TODO: Remove this default voice
        this[stats][id].transportManager.add(socket, 'voice')
    }

}