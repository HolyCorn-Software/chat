/**
 * Copyright 2024 HolyCorn Software
 * The Faculty of Chat
 * This module serves as a bridge between the faculty, and a likely android app running underneath
 * The idea is to listen for new messages, and then trigger system notifications
 * 
 */

import ChatMessaging from "../widgets/chat-messaging/widget.mjs";
import ChatEventClient from "/$/chat/static/event-client/client.mjs";
import hcRpc from "/$/system/static/comm/rpc/aggregate-rpc.mjs";
import DelayedAction from "/$/system/static/html-hc/lib/util/delayed-action/action.mjs";



if (globalThis.AppFrameAPI) {



    /**
     * This method determines if there's NO chat widget opened, and currently visible to the user, for the given chat id
     * @param {string} id
     */
    function noChatViewFor(id) {

        /** @type {ChatMessaging[]} */
        const chatWidgets = [...document.body.querySelectorAll(['', ...ChatMessaging.classList].join('.'))].map(x => x.widgetObject)

        return document.visibilityState == 'visible' && (
            chatWidgets.findIndex(x => (x.chat.id == id) && x.visible) != -1
        );
    }

    ChatEventClient.create().then(client => {

        /**
         * @type {{[chat: string]: {data: telep.chat.management.Chat, promise: Promise, action: ()=> Promise}}}
         */
        const tasks = {}

        client.events.addEventListener('$remote-event', (event) => {

            const chatMsgEventRegExp = /^chat-(.+)-message$/

            if (chatMsgEventRegExp.test(event.detail?.type)) {
                const [, id] = chatMsgEventRegExp.exec(event.detail.type);

                ((tasks[id] ||= {}).action ||= new DelayedAction(async () => {
                    const main = async () => {
                        if (
                            noChatViewFor(id)
                        ) {
                            return console.log(`User is seeing the messages `)// Then the user is currently facing a UI of this chat. No need to send notifications
                        }

                        const count = await hcRpc.chat.messaging.countUnread({ chat: id });

                        if (count < 1) {
                            return console.log(`Not enough new messages to alert.`);
                        }

                        const { label } = (
                            (tasks[id]).data ||= await hcRpc.chat.management.getChatViewData({ id })
                        );
                        // Now trigger a notification

                        console.log(`${label}, has ${count} unread messages.`);

                        (await AppFrameAPI.notification()).notify(
                            {
                                title: `New Messages from ${label}`,
                                content: `${count} unread messages from ${label}`,
                                groupId: 'group',
                                id: tasks[id].data.id,

                            }
                        )

                    }

                    (tasks[id].promise ||= main()).finally(() => {
                        delete tasks[id].promise
                    })



                    // Notification would be delayed 2s, and for a maximum of 10s, in order that many might be processed at once
                }, 2000, 10_000))()
            }



        })

        client.events.addEventListener('telep-chat-new-roled-chat', async ({ detail }) => {
            if (noChatViewFor(detail.id)) {
                return;
            }
            const chatView = await hcRpc.chat.management.getChatViewData({ id: detail.id });

            (await AppFrameAPI.notification()).notify(
                {
                    title: `Customer Service`,
                    content: `${chatView.label} just contact customer service, and there's no one (yet) to reply.`,
                    groupId: 'customerService',
                    id: detail.id,
                }
            )

        })

    })


}