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



if (globalThis.ChatMessagingAPI) {


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
                        /** @type {ChatMessaging[]} */
                        const chatWidgets = [...document.body.querySelectorAll(['', ...ChatMessaging.classList].join('.'))].map(x => x.widgetObject)
                        if (document.visibilityState == 'visible' && (chatWidgets.findIndex(x => (x.chat == id) && x.html.isConnected) != -1)) {
                            return // Then the user is currently facing a UI of this chat. No need to send notifications
                        }

                        const count = await hcRpc.chat.messaging.countUnread({ chat: id });

                        if (count < 1) {
                            return;
                        }

                        const { label } = (
                            (tasks[id]).data ||= await hcRpc.chat.management.getChatViewData({ id })
                        );
                        // Now trigger a notification

                        console.log(`${label}, has ${count} unread messages.`)

                        ChatMessagingAPI.notify(
                            label,
                            new Number(count).valueOf(),
                            tasks[id].data.id
                        )

                    }

                    (tasks[id].promise ||= main()).finally(() => {
                        delete tasks[id].promise
                    })



                    // Notification would be delayed 2s, and for a maximum of 10s, in order that many might be processed at once
                }, 2000, 10_000))()
            }


        })

    })


}