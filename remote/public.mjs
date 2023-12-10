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

    }


    /**
     * This method gets metadata about the chats of the calling user, with extra info
     * @returns {Promise<telep.chat.ChatMetadata[]>}
     */
    async getMyChatsMetadata() {
        const userid = (await muser_common.getUser(arguments[0])).id

        const chats = await this[controller].management.getUserChats({ userid })
        const results = await Promise.allSettled(
            chats.map(async chat => {
                try {
                    /** @type {telep.chat.ChatMetadata} */
                    const meta = { ...chat }
                    const viewData = await this[controller].management.getChatViewData({ userid, id: chat.id })
                    meta.label = viewData.label
                    meta.icon = viewData.icon
                    /** @type {telep.chat.messaging.Message} */
                    const lastMessage = (await (await this[controller].messaging.getMessages({ chat: chat.id, userid, limit: 1 })).next()).value
                    // TODO: Improve captioning
                    meta.caption = lastMessage?.data.text || (lastMessage?.data.media && lastMessage?.data.media.caption || '')
                    meta.lastDirection = lastMessage?.sender == userid ? 'outgoing' : 'incoming'
                    // TODO: Get information about the count of unread messages
                    meta.lastTime = lastMessage?.time || chat.created?.time

                    return meta
                } catch (e) {
                    e.chat = chat
                    throw e
                }

            })
        );

        results.filter(x => x.status == 'rejected').forEach(result => {
            console.warn(`Error when getting chats for user ${userid}\n`, result.reason, '\n')
        })

        return results.filter(x => x.status == 'fulfilled').map(x => x.value)
    }



}