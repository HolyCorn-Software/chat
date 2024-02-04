/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * This piece of logic manages calls directly, and keeps their status information
 */

import shortUUID from "short-uuid";
import ChatEventsController from "../../events/controller.mjs";
import muser_common from "muser_common";


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
                if (data.ids.some(cl_id => cl_id === id)) {
                    // Now make the call ring

                    this[controllers].events.clients(
                        [
                            data.ids[0],
                        ],
                        {
                            retries: 5,
                            timeout: 10_000,
                            retryDelay: 500,
                            aggregation: {
                                sameData: true,
                                timeout: 5000
                            }
                        }
                    ).calling.ring({ id }).catch(e => {
                        console.error(`Failed to make call (${id}) ring!\n`, e)
                    })

                }
            }

        })

    }

    /**
     * This method creates a new call
     * @param {object} param0 
     * @param {telep.chat.calling.CallType} param0.type
     * @param {string} param0.caller
     * @param {telep.chat.management.Chat} param0.chat
     * @returns {Promise<string>}
     */
    async createCall({ type, caller, chat }) {

        const rec = [...new Set([...chat.recipients, caller])]

        const id = `${shortUUID.generate()}${shortUUID.generate()}`

        this[stats][id] = {
            id,
            chat: chat.id,
            members: {
                invited: rec,
                acknowledged: [],
                rejected: []
            },
            time: {
                created: Date.now(),
            },
            type: type === 'video' ? type : 'voice',
            rooms: [

            ]

        };

        // Since this is technically the first to connect to the call, let's create his details
        await this.connect({ member: caller, id })



        await this.ring({ call: id, ids: rec.filter(x => x !== caller) })


        return id
    }


    /**
     * This method is used to signal a client's involvement in a call.
     * @param {object} param0 
     * @param {string} param0.member
     * @param {string} param0.id
     */
    async connect({ member, id }) {
        await this.validateAccess({ id, userid: member })
        if (new Set([...this[stats][id].members.acknowledged]).has(member)) {
            // console.log(`Call ${id}, already has ${member}`)
            return; // In case we already know, that he connected
        }
        this[stats][id].members.acknowledged = [...new Set([...this[stats][id].members.acknowledged, member])];
        const roomMatesToBe = new Set([...this[stats][id].members.invited])
        roomMatesToBe.delete(member)


        // First add member to rooms where the member is already known
        this[stats][id].rooms.forEach(room => {
            if ((room.junior == member) || (room.superior == member)) {
                // And since we've succeeded to update the state of the member in this room, there's no need to remember
                // the room mate again. We'll use the remaining room mates to create the missing rooms
                roomMatesToBe.delete(room.junior)
                roomMatesToBe.delete(room.superior)

            }
        });

        roomMatesToBe.forEach(mate => {
            this[stats][id].rooms.push(
                {
                    superior: member,
                    junior: mate,
                }
            )
        });


        await this.propagateMemberListChanges({ id })

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
                id: call
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
     * This method removes a correspondent from a call
     * @param {object} param0 
     * @param {string} param0.call
     * @param {string} param0.member
     */
    async leaveCall({ call, member }) {
        const callData = this[stats][call]
        if (!callData) {
            return console.warn(`Trying to remove correspondent `, member, ` from call `, call, `, which doesn't exist.`);
        }

        callData.members.rejected.push(member)

        let changed = false;

        callData.rooms.forEach(room => {
            if (room[member]) {
                changed = true
                room[member].state = 'exited'
            }
        });

        if (changed) {
            // This could be a source of bugs
            this.propagateMemberListChanges({ id: call })
        }


        // TODO: Deal with call termination



    }

    /**
     * This method returns the ongoing calls that the correspondent is supposed to be a part of, that he isn't in.
     * @param {object} param0 
     * @param {string} param0.correspondent
     */
    getOngoingCallsFor({ correspondent }) {
        const calls = new Set()
        for (const callId in this[stats]) {
            if ((this[stats][callId].members.invited.findIndex(x => x == correspondent) != -1) && (this[stats][callId].members.rejected.findIndex(x => x == correspondent) == -1)) {
                calls.add(callId)
            }
        }
        return [...calls]
    }

    /**
     * This method returns information about a call
     * @param {object} param0 
     * @param {string} param0.id id of the call
     * @param {string} param0.userid if specified, then checks will be made to 
     * authenticate the user
     * @returns {Promise<telep.chat.calling.FrontendCallStatPlus>}
     */
    async getCallInfo({ id, userid }) {
        await this.validateAccess({ id, userid });
        /** @type {Awaited<ReturnType<this['getCallInfo']>>} */
        const data = {
            ...this[stats][id],
            profiles: (
                await (await FacultyPlatform.get().connectionManager.overload.modernuser()).profile.getProfiles(
                    [...this[stats][id].members.invited, ...this[stats][id].members.acknowledged]
                )
            ).map(corr => {
                return {
                    callerID: this[stats][id].members.invited.findIndex(x => x == corr.id),
                    ...corr
                }
            }),
        }
        return data
    }


    /**
     * This method checks if the calling user has access to the given call
     * @param {object} param0 
     * @param {string} param0.id
     * @param {string} param0.userid
     */
    async validateAccess({ id, userid }) {
        if (!this[stats][id]) {
            throw new Exception(`Call '${id}' not found.`);
        }
        await muser_common.whitelisted_permission_check(
            {
                whitelist: await this[stats][id]?.members?.invited || [],
                userid,
                permissions: ['permissions.telep.chat.supervise'],
                intent: { freedom: 'use' },
                throwError: true
            }
        );
    }

    /**
     * This method updates SDP data, with whom the client is in call with
     * @param {object} param0 
     * @param {string} param0.id
     * @param {string} param0.member
     * @param {telep.chat.calling.SDPUpdateData} param0.data
     * @returns {Promise<telep.chat.calling.SDPUpdateResults>}
     */
    async updateSDPData({ id, member, data }) {
        if (!data) return
        await this.validateAccess({ id, userid: member })
        await this.connect({ member, id })
        const membersToBeInformed = new Set() // This variable contains the ids of members who are to be notified about the changes in sdp data

        /** @type {Awaited<ReturnType<CallManager['updateSDPData']>>} */
        const results = {}

        for (const room of this[stats][id].rooms) {

            if ((room.junior == member) || (room.superior == member)) {
                const otherMember = room.junior == member ? room.superior : room.junior
                const dataType = room.junior == member ? 'answer' : 'offer';
                room[dataType] = data[otherMember]
                room[`${dataType}Time`] = Date.now()
                membersToBeInformed.add(otherMember)
                results[otherMember] = dataType

            }
        }


        membersToBeInformed.add(member)

        this.propagateSDPUpdates({ id, members: membersToBeInformed })


        return results


    }



    /**
     * This method sends an ICE candidate to a member on a call
     * @param {object} param0 
     * @param {string} param0.userid
     * @param {string} param0.id
     * @param {string} param0.member
     * @param {string} param0.data
     */
    async sendIceCandidate({ userid, id, member, data }) {
        await this.getCallInfo({ id, userid })
        await this[controllers].events.clients([member], { expectedClientLen: 1, retries: 5, timeout: 10_000, retryDelay: 250 }).calling.addIceCandidate({ id, member, data })
    }


    /**
     * This method reaches out to all clients, and informs them about the latest SDP data
     * @param {object} param0 
     * @param {string} param0.id
     * @param {Set<string>} param0.members
     */
    async propagateSDPUpdates({ id, members }) {
        for (const clientId of [...members]) {
            // For each client, we build a local SDP table, which he can understand, then send to him
            /** @type {telep.chat.calling.ui.LocalSDPTable} */
            let localSDPTable = {}
            for (const room of this[stats][id].rooms) {

                if (room.junior == clientId || room.superior) {
                    const otherMember = room.junior == clientId ? room.superior : room.junior
                    localSDPTable[otherMember] = {
                        offer: room.offer,
                        answer: room.answer,
                        isSuperior: room.superior == clientId,
                        answerTime: room.answerTime,
                        offerTime: room.offerTime,
                    }
                }

            }


            this[controllers].events.clients([clientId], { aggregation: { timeout: 500 }, expectedClientLen: 1, precallWait: 500 }).calling.updateSDPs(
                {
                    data: localSDPTable,
                    id
                }
            ).catch(e => console.warn(`Could not inform client ${clientId}`, e))
        }
    }


    /**
     * This method informs all clients that are part of a call, that the list of members has changed.
     * @param {object} param0 
     * @param {string} param0.id
     */
    async propagateMemberListChanges({ id }) {


        /** @type {Parameters<this[controllers]['events']['clients']>['1']} */
        const options = {
            aggregation: {
                timeout: 1000,
                sameData: false
            },
            expectedClientLen: this[stats][id].members.invited.length,
            precallWait: 5000,
        };
        const callData = this[stats][id];
        const invited = callData.members.invited;

        this[controllers].events.clients(invited, options).calling.updateCallMembers({
            id,
            members: this[stats][id].members
        }).catch(e => {
            console.warn(`Could not update list of members, on remote targets\n`, e)
        });

    }

}