/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * The Chat Faculty
 * This controller handles the aspects of the faculty related to messaging
 */

import shortUUID from "short-uuid"
import ChatManagement from "../management/controller.mjs"
import ChatEventsController from "../events/controller.mjs"
import DelayedAction from "../../../system/public/html-hc/lib/util/delayed-action/action.mjs"


const collections = Symbol()
const controllers = Symbol()

const modernuser = () => FacultyPlatform.get().connectionManager.overload.modernuser()

export default class MessagingController {


    /**
     * 
     * @param {object} data
     * @param {telep.chat.messaging.Collections} data.collections 
     * @param {object} data.controllers
     * @param {ChatManagement} data.controllers.management
     * @param {ChatEventsController} data.controllers.events
     */
    constructor(data) {

        this[collections] = data.collections

        this[controllers] = data.controllers

    }

    /**
     * This method is used to send a message to a chat
     * @param {telep.chat.messaging.MessageInit} msg 
     * @returns {Promise<string>}
     */
    async sendMessage(msg) {


        const chatData = await this[controllers].management.getChatInfoSecure(
            {
                id: msg.chat,
                userid: msg.userid,
            }
        )
        if (
            // If the chat is not active, let's prevent messaging
            ((chatData.ended || chatData.archived || chatData.disabled) && false) // TODO: Remove this test code (false)
        ) {
            throw new Exception(`You can't send messages, because this chat is not (yet) active`)
        }

        // And now, if the user is not part of the chat, and he's sending a message, let's automatically add him to the chat.
        // Of course, by now, we have already checked (via getChatInfoSecure();), that he's allowed to access to this chat.
        if (!chatData.recipients.includes(msg.userid)) {
            await this[controllers].management.addUserToChat({ userid: msg.userid, id: msg.chat })
        }

        const id = shortUUID.generate()

        this[collections].messages.insertOne(
            {
                ...msg,
                sender: msg.userid == chatData.role?.member ? 'role' : msg.userid,
                time: Date.now(),
                id,

            }
        );

        // Ensure that all active users are getting notifications

        this[controllers].events.filterByActive(chatData.recipients).forEach(
            activeUser => {
                this[controllers].events.addIDs(activeUser, [chatData.id])
            }
        );

        const roleMembers = []

        if (chatData.type == 'roled') {
            for await (const { userid } of await this[controllers].management.getRoleMembers({ role: chatData.role.data.name })) {
                roleMembers.push(userid)
            }

        }

        // Now, inform recipients of the chat, of the new message

        this[controllers].events.inform([chatData.id, ...roleMembers], new CustomEvent(`chat-${chatData.id}-message,telep-chat-new-message`), {
            aggregation: {
                timeout: 500,
            },
            expectedClientLen: chatData.recipients.length - 1,
            precallWait: 2000,

            exclude: [msg.userid],
            retries: 2,
            timeout: 2000,
            retryDelay: 350,
        });

        // Now, if the chat is a roled one, inform members of the role
        if (chatData.type == 'roled' && !chatData.role.member) {

            this[controllers].events.inform(
                roleMembers,
                new CustomEvent(`telep-chat-new-roled-chat`, { detail: { id: chatData.id } }),
                {
                    aggregation: {
                        timeout: 5000,
                    },
                    expectedClientLen: Math.min(roleMembers.length, 2),
                    exclude: [msg.userid],
                    retries: 5,
                    timeout: 2000,
                    retryDelay: 1000,
                    precallWait: 5000
                }
            )

        }


        return id
    }

    /**
     * This method gets messages of a chat, in order of recency. Newest messages first
     * @param {object} param0 
     * @param {string} param0.chat
     * @param {string} param0.userid
     * @param {number} param0.limit The max number of messages. The default limit is 100
     * @param {string} param0.earliestMessage If specified, only messages before, or after the said message will be fetched
     * @param {"normal"|"reverse"} param0.recency This can optionally tell the system to start with older messages
     */
    async * getMessages({ chat, userid, limit, earliestMessage, recency = 'normal' }) {
        // Just make sure the chat actually exists, and the user is allowed to participate in it
        await this[controllers].management.getChatInfoSecure(
            {
                id: chat,
                userid
            }
        );

        let lastMessage = earliestMessage ? await this[collections].messages.findOne({ id: earliestMessage }) : undefined

        let currDeliveryTimePosition = lastMessage ? lastMessage.edited?.time || lastMessage.time : (await this.getUserTimePosition({ chat, member: userid, userid }))?.position?.delivered || 0



        const cursor = this[collections].messages.find(
            {
                chat,
                time: {

                    [recency == 'normal' ? '$gte' : '$lte']: lastMessage?.time || 0
                },
                id: {
                    $ne: lastMessage ? lastMessage.id : undefined
                }
            }
        ).sort(
            {
                time: recency === 'normal' ? 'desc' : "asc"
            }
        ).limit(limit ?? 100)

        const update = new DelayedAction(
            () => this.updateUserTimePosition({ chat, member: userid, position: { delivered: currDeliveryTimePosition } }),
            200, 5000
        )


        while (await cursor.hasNext()) {
            const item = await cursor.next()
            const msgTime = item.edited?.time || item.time
            if (currDeliveryTimePosition < msgTime) { // If this message is ahead of the user's time position,
                // we update the user's position to a time, that shows he's received all messages after before this.
                currDeliveryTimePosition = msgTime
                update()
            }
            yield item
        }




    }


    /**
     * This method gets the time position of a user in a given chat.
     * @param {object} param0 
     * @param {string} param0.chat
     * @param {string} param0.member
     * @param {string} param0.userid
     */
    async getUserTimePosition({ chat, member, userid }) {
        if (userid) {
            await this[controllers].management.getChatInfoSecure({ id: chat, userid });
        }
        member = !member && userid ? userid : member;
        return await this[collections].timePositions.findOne({ member, chat })
    }

    /**
     * This method updates a user's time position in a chat.
     * @param {telep.chat.messaging.TimePosition & {userid: string}} param0
     */
    async updateUserTimePosition({ chat, userid, member, position }) {
        member = !member && userid ? userid : member;
        // This function removes the fields with non-numeric values
        const trim = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => typeof v == "number"))
        const chatData = await this[controllers].management.getChatInfoSecure({ id: chat, userid })


        position = trim({
            'position.delivered': position?.delivered,
            'position.read': position?.read,
        })
        await this[collections].timePositions.updateOne(
            {
                chat,
                member
            },
            {
                $set: {
                    ...position,
                    chat
                }
            },
            { upsert: true }
        );

        // Inform everyone, that the user's time position has changed
        this[controllers].events.inform(chatData.recipients,
            new CustomEvent(`chat-${chat}-user-timeposition-change`, {
                detail: {
                    position: {
                        delivered: position['position.delivered'],
                        read: position['position.read'],
                        userid: undefined,
                        member: userid
                    }
                }
            }),
            {
                aggregation: {
                    timeout: 2000,
                },
                exclude: [userid],
                expectedClientLen: chatData.recipients.length - 1,
                timeout: 5000,
                retries: 2,
                retryDelay: 500,
            }
        );
    }

    /**
     * This method gets a count of the unread messages of a user in a chat
     * @param {object} param0 
     * @param {string} param0.chat
     * @param {string} param0.member
     * @param {string} param0.userid
     */
    async countUnread({ chat, member, userid }) {
        member = !member && userid ? userid : member;
        const timeEntry = await this.getUserTimePosition({ chat, member, userid })
        if (!timeEntry) {
            this.updateUserTimePosition({ chat, member, position: { read: 0, delivered: 0 } })
        }
        const currTime = timeEntry?.position?.read || 0
        return await this[collections].messages.countDocuments({ chat, time: { $gt: currTime }, sender: { $ne: member }, $or: [{ edited: { $gt: currTime } }, { edited: { $exists: false } }] })
    }


    /**
     * This method returns the time positions of members of the chat
     * @param {object} param0 
     * @param {string} param0.chat
     * @param {string} param0.userid
     */
    async getMemberTimePositions({ chat, userid }) {
        await this[controllers].management.getChatInfoSecure({ id: chat, userid })
        return await this[collections].timePositions.find({ chat }, { projection: { _id: 0 } }).toArray()
    }

}