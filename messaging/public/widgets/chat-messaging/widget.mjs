/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * The Chat Faculty
 * This widget is embedded a chat, to allow the user to send messages within that chat
 */

import ChatMessagingCompose from "./compose/widget.mjs";
import ChatMessage from "./message/widget.mjs";
import ChatEventClient from "/$/chat/static/event-client/client.mjs";
import hcRpc from "/$/system/static/comm/rpc/aggregate-rpc.mjs";
import { handle } from "/$/system/static/errors/error.mjs";
import DelayedAction from "/$/system/static/html-hc/lib/util/delayed-action/action.mjs";
import { Widget, hc } from "/$/system/static/html-hc/lib/widget/index.mjs";

const load = Symbol()

const lastChatID = Symbol()
const onMessage = Symbol()


/**
 * @extends Widget<ChatMessaging>
 */
export default class ChatMessaging extends Widget {

    constructor({ chat } = {}) {

        super();

        super.html = hc.spawn(
            {
                classes: ChatMessaging.classList,
                innerHTML: `
                    <div class='container'>
                        <div class='messages'></div>
                        <div class='compose'></div>
                    </div>
                `
            }
        );

        this.widgetProperty(
            {
                selector: ['', ...ChatMessagingCompose.classList].join('.'),
                parentSelector: '.container >.compose',
                property: 'compose',
                childType: 'widget',
                onchange: () => {
                    let compose = this.compose
                    compose.addEventListener('composed', () => {
                        this.messages.push(
                            {
                                isOwn: true,
                                isNew: true,
                                chat: this.chat.id,
                                ...compose.value,
                                time: Date.now(),
                            }
                        );
                        compose.clear()
                        this.scrollToBottom()
                    })



                }
            }
        );
        /** @type {ChatMessagingCompose} */ this.compose = new ChatMessagingCompose(chat)

        hc.watchToCSS(
            {
                source: this.compose.html,
                apply: '--compose-height',
                target: this.html,
                watch: {
                    dimension: 'height'
                }
            }
        );

        hc.watchToCSS(
            {
                source: this.html,
                apply: '--messaging-height',
                target: this.html,
                watch: {
                    dimension: 'height'
                }
            }
        );



        /** @type {telep.chat.messaging.frontend.Message[]} */ this.messages
        this.pluralWidgetProperty(
            {
                selector: ['', ...ChatMessage.classList].join('.'),
                parentSelector: '.container >.messages',
                property: 'messages',
                transforms: {
                    /**
                     * 
                     * @param {telep.chat.messaging.frontend.Message} msg 
                     * @returns {ChatMessage['html']}
                     */
                    set: (msg) => {
                        const widget = new ChatMessage(msg);
                        return widget.html
                    },

                    get: (html) => {
                        return html.widgetObject.data
                    }
                }
            }
        );

        Object.assign(this, arguments[0])

        /** @type {telep.chat.management.Chat} */ this.chat


        this.waitTillDOMAttached().then(() => this.load())
    }
    async load() {
        await this.blockWithAction(
            async () => {

                await this[load]({
                    chatID: this.chat.id
                });
            }
        )
    }

    scrollToBottom = new DelayedAction(
        () => {
            let interval;

            const cleanup = () => {
                clearInterval(interval)
            }
            let speed = 1

            interval = setInterval(() => {
                const msgUI = this.html.$('.container >.messages');
                msgUI.scrollTop += (5 * speed)
                speed += 0.45
                const available = Math.round(msgUI.scrollHeight - msgUI.getBoundingClientRect().height);

                if (msgUI.scrollTop >= available) {
                    cleanup()
                }
            }, 20)
        }, 250
    )

    /**
     * This method is used to actually load messages, later than a given message
     * @param {object} param0
     * @param {string} param0.chatID 
     * @param {string} param0.lastMessage
     * @returns {Promise<void>}
     */
    async [load]({ chatID, lastMessage }) {
        // Load the last 100 messages, and then wait for the user
        // to request for earlier messages

        const userinfo = await hcRpc.modernuser.authentication.whoami();
        const currentMessages = [...this.messages]
        const uiList = [];

        const doUpate = () => {
            const uListFinal = [...new Set(uiList.map(x => x.id))].map(x => uiList.find(uL => uL.id === x))
            this.messages = [...currentMessages, ...uListFinal]

            this.scrollToBottom()

        }
        const cleanup = () => {
            clearInterval(interval)
            doUpate()
        }
        const interval = setInterval(doUpate, 100)
        try {
            for await (const message of await hcRpc.chat.messaging.getMessages({ chat: chatID, limit: 100, earliestMessage: lastMessage })/*randomMessages(chatID, userinfo.id)*/) {
                // Prepend the message
                message.isOwn = userinfo.id === message.sender
                // The reason for this change in order, is due to the fact that
                // when the last message is specified, the 
                uiList.unshift(message)
            }

            // Now that we're done, let's start listening for push
            // notifications concerning new messages to this chat
            await this.startListening()
        } catch (e) {
            cleanup()
            throw e
        }
        cleanup()


    }

    /**
     * This method will ensure that new messages will be received, and added to the UI
     */
    async startListening() {

        if (this[lastChatID] === this.chat.id) {
            return
        }

        const chatEventClient = await ChatEventClient.create()

        chatEventClient.events.addEventListener('init', () => {
            this[onMessage]?.()
        })

        await chatEventClient.init()

        const eventName = `chat-${this[lastChatID] = this.chat.id}-message`;

        if (this[onMessage]) {
            chatEventClient.events.removeEventListener(eventName, this[onMessage])
        }

        chatEventClient.events.addEventListener(eventName,
            this[onMessage] = new DelayedAction(
                () => {
                    const lastMessage = this.messages.at(-1)
                    // TODO: Place the error in the UI
                    this[load]({ chatID: this.chat.id, lastMessage: lastMessage.id }).catch(e => handle(e))
                },
                1000
            )
        )
    }


    static get classList() {
        return ['hc-telep-chat-messaging']
    }

}
