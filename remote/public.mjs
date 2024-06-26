/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * This module in the Chat Faculty, allows public clients access to some methods,
 * over RPC
 */

import muser_common from "muser_common";
import { CallingPublicMethods } from "../calling/remote/public.mjs";
import ChatController from "../controller.mjs";
import ChatEventsPublicMethods from "../events/remote/public.mjs";
import ChatManagementPublicMethods from "../management/remote/public.mjs";
import MessagingPublicMethods from "../messaging/remote/public.mjs";

const controller = Symbol()
const internal = Symbol()

export default class ChatPublicMethods extends FacultyPublicMethods {

    /**
     * 
     * @param {ChatController} controller_ 
     */
    constructor(controller_) {
        super()

        this.messaging = new MessagingPublicMethods(controller_.messaging)
        this.events = new ChatEventsPublicMethods(controller_.events)
        this.management = new ChatManagementPublicMethods(controller_.management)
        this.calling = new CallingPublicMethods(controller_.calling)
        this[controller] = controller_

        this[controller].management.events.addEventListener('new-chat', async (event) => {
            const data = event.detail
            if (!data.id) {
                return;
            }

            try {
                const chat = await this[controller].management.getChatInfoSecure({ id: data.id });
                await Promise.all(
                    chat.recipients.map(async recipient => {
                        await this[controller].events.inform([recipient], new CustomEvent('telep-chat-new-chat', { detail: { chat: await this[internal].getChatMetaData(chat, recipient) } }))
                    })
                )
            } catch (e) {
                console.warn(`Failed to route chat-changed event, because `, e)
            }



        })


        this[controller].management.events.addEventListener('chat-ended', async (event) => {
            const data = event.detail
            if (!data.id) {
                return;
            }

            try {
                this[controller].events.inform([data.id], new CustomEvent('telep-chat-chat-ended', { detail: { id: data.id } }))
            } catch (e) {
                console.warn(`Failed to route chat-ended event, because `, e)
            }



        })


        this[controller].management.events.addEventListener('chat-state-changed', async (event) => {
            const data = event.detail
            if (!data.id || !data.state) {
                return;
            }

            try {
                this[controller].events.inform([data.id], new CustomEvent('telep-chat-state-changed', { detail: { id: data.id, state: data.state } }))
            } catch (e) {
                console.warn(`Failed to route chat-state-changed event, because `, e)
            }



        })


    }

    [internal] = {
        /**
         * 
         * @param {telep.chat.management.Chat} chat 
         * @param {string} userid
         * @returns {telep.chat.ChatMetadata}
         */
        getChatMetaData: async (chat, userid) => {
            try {
                /** @type {telep.chat.ChatMetadata} */
                const meta = { ...chat }
                /** @type {telep.chat.messaging.Message} */
                const lastMessage = (await (await this[controller].messaging.getMessages({ chat: chat.id, userid, limit: 1 })).next()).value
                // TODO: Improve captioning
                meta.caption = lastMessage?.data.text || (lastMessage?.data.media && lastMessage?.data.media.caption || '')
                meta.lastDirection = lastMessage?.sender == userid ? 'outgoing' : 'incoming'
                meta.lastTime = lastMessage?.time || chat.created?.time
                meta.unreadCount = await this[controller].messaging.countUnread({ chat: chat.id, userid })
                return meta
            } catch (e) {
                e.chat = chat
                throw e
            }
        }
    }


    /**
     * This method gets metadata about the chats of the calling user, with extra info
     * @param {telep.chat.management.ChatType} param0.type
     * @returns {Promise<telep.chat.ChatMetadata[]>}
     */
    async getMyChatsMetadata(type) {
        const userid = (await muser_common.getUser(arguments[0])).id

        const chats = await this[controller].management.getUserChats({ userid, type: arguments[1] })
        const results = await Promise.allSettled(
            chats.map((item) => this[internal].getChatMetaData(item, userid))
        );

        results.filter(x => x.status == 'rejected').forEach(result => {
            console.warn(`Error when getting chats for user ${userid}\n`, result.reason, '\n')
        })

        return results.filter(x => x.status == 'fulfilled').map(x => x.value)
    }



}