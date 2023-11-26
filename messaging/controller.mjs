/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * The Chat Faculty
 * This controller handles the aspects of the faculty related to messaging
 */

import shortUUID from "short-uuid"
import ChatManagement from "../management/controller.mjs"
import ChatEventsController from "../events/controller.mjs"


const collections = Symbol()
const controllers = Symbol()

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
            false && // TODO: Remove this test code
            (chatData.ended || chatData.archived)
        ) {
            throw new Exception(`You can't send messages, because this chat is not (yet) active`)
        }

        const id = shortUUID.generate()

        this[collections].messages.insertOne(
            {
                ...msg,
                sender: msg.userid,
                time: Date.now(),
                id,

            }
        );

        // Ensure that all active users are getting notifications

        // TODO: Make this process more efficient, by delaying notification (re-)initialization
        this[controllers].events.filterByActive(chatData.recipients).forEach(
            activeUser => {
                this[controllers].events.addIDs(activeUser, [chatData.id])
            }
        );

        // Now, inform recipients of the chat, of the new message
        this[controllers].events.inform([chatData.id], new CustomEvent(`chat-${chatData.id}-message`))


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


        while (await cursor.hasNext()) {
            yield await cursor.next()
        }

    }

}