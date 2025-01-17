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
import { SlideContainer } from "/$/system/static/html-hc/widgets/slide-container/container.mjs";

const load = Symbol()

const lastChatID = Symbol()
const onMessage = Symbol()

const timePositions = Symbol()
const setUnreadBadgeCount = Symbol()
const onUnreadCountChange = Symbol()
const drawUnreadCountBadge = Symbol()
const lastScrollTop = Symbol()


export default class ChatMessaging extends Widget {

    constructor({ chat } = {}) {

        super();

        super.html = hc.spawn(
            {
                classes: ChatMessaging.classList,
                innerHTML: `
                    <div class='container'>
                        <div class='read-check-area'></div>
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
                        this.myTimePosition.position.read = Date.now()
                    })



                }
            }
        );
        /** @type {ChatMessagingCompose} */ this.compose = new ChatMessagingCompose(this)

        hc.watchToCSS(
            {
                source: this.compose.html,
                apply: '--compose-height',
                target: this.html,
                watch: {
                    dimension: 'height'
                },
                signal: this.destroySignal
            }
        );

        hc.watchToCSS(
            {
                source: this.html,
                apply: '--messaging-height',
                target: this.html,
                watch: {
                    dimension: 'height'
                },
                signal: this.destroySignal
            }
        );

        const updateTimePosition = new DelayedAction(() => {

            if (!this.chat.recipients.includes(this.me.id)) {
                return; // In some chats the user is a "spy", e.g when a customer service agent is reading a chat, before responding.
            }

            return hcRpc.chat.messaging.updateUserTimePosition(
                {
                    chat: this.chat.id,
                    position: this.myTimePosition.position,
                }
            )
        }, 500, 2500)



        /** @type {telep.chat.messaging.frontend.Message[]} */ this.messages
        this.pluralWidgetProperty(
            {
                selector: ['', ...ChatMessage.classList].join('.'),
                parentSelector: '.container >.messages',
                transforms: {
                    /**
                     * 
                     * @param {telep.chat.messaging.frontend.Message} msg 
                     * @returns {ChatMessage['html']}
                     */
                    set: (msg) => {
                        const widget = new ChatMessage(msg);
                        widget.seen = this.myTimePosition?.position.read >= (msg.edited?.time || msg.time)
                        if (!widget.seen) {
                            widget.addEventListener('seen', () => {
                                const msgTime = (msg.edited?.time || msg.time)
                                if (msgTime > (this.myTimePosition?.position?.read || 0)) {
                                    this.myTimePosition.position.read = msgTime
                                    updateTimePosition()
                                    this.dispatchEvent(new CustomEvent('unread-count-change'))
                                }
                            }, { once: true })
                        }
                        return widget.html
                    },

                    get: (html) => {
                        return html.widgetObject.data
                    }
                },
                onchange: new DelayedAction(
                    () => {
                        this.dispatchEvent(new CustomEvent('last-message-change'))
                    }, 200, 1500)
            },
            'messages'
        );

        /** @type {(event: "unread-count-change"|"last-message-change", cb: (event: Event), opts?:AddEventListenerOptions)=> void} */ this.addEventListener


        // There's is this special static area of the UI, that's just responsible for intersecting with message view HTMLs
        // so that we can know that a message has been viewed.
        /** @type {HTMLElement} */ this.intersectionBox
        this.widgetProperty(
            {
                selector: '.read-check-area',
                parentSelector: ':scope >.container',
                childType: 'html',
            },
            'intersectionBox'
        );

        /** @type {ChatMessage[]} */ this.messageWidgets
        this.pluralWidgetProperty(
            {
                selector: ['', ...ChatMessage.classList].join('.'),
                parentSelector: '.container >.messages',
                childType: 'widget'
            },
            'messageWidgets'
        )


        this.addEventListener('unread-count-change', this[onUnreadCountChange])
        this.html.addEventListener('hc-connected-to-dom', new DelayedAction(() => {
            if (this.unreadCount > 0) {
                this[drawUnreadCountBadge]()
            } else {
                if (this[lastScrollTop]) {
                    this.scrollToBottom(this[lastScrollTop])
                } else {
                    this.scrollToBottom()
                }
            }
        }, 150, 200))

        this.html.addEventListener('hc-connected-to-dom', () => {
            console.log(`Just connected to DOM!!`)
            this.html.classList.add('new-born')
            setTimeout(() => this.html.classList.remove('new-born'), 1500)

            function checkTransition(element) {

                const transitions = []

                function check(element) {
                    const transition = window.getComputedStyle(element).transitionDuration
                    if (transition != '0s') {
                        transitions.push({
                            element,
                            value: window.getComputedStyle(element).getPropertyValue('transition')
                        })
                    }

                }

                while ((element = element.parentElement) != null) {
                    check(element)
                }

                console.log(transitions)
            }
        })

        // Now, the logic of remembering the last scroll position
        this.html.$('.container >.messages').addEventListener('scroll', new DelayedAction(() => {
            if (!this.visible) return;
            const visibleOnes = this.messageWidgets.filter(widget => {
                const rect = widget.html.getBoundingClientRect();
                return rect.top > (window.innerHeight / 4) && rect.bottom > (window.innerHeight / 4)
            })

            if (visibleOnes.length == 0) return;

            this[lastScrollTop] = this.html.$(':scope >.container >.messages').scrollTop
        }, 250, 2000), { signal: this.destroySignal })

        Object.assign(this, arguments[0])

        /** @type {telep.chat.management.Chat} */ this.chat

        /** @type {Omit<telep.chat.messaging.TimePosition, "chat">[]} */
        this[timePositions] = [];

        const watchParentLayout = async () => {
            await this.waitTillDOMAttached();


            const sliderParent = this.html.closest(['', ...SlideContainer.classList].join('.'))
            const viewContainerParent = this.html.closest('.hc-ehealthi-device-frame-view-container')

            if (viewContainerParent) {
                const observer = new MutationObserver(() => {
                    if (viewContainerParent.classList.contains('visible')) {
                        if (!this.visible) {
                            this.html.classList.add('new-born')
                            setTimeout(() => this.html.classList.remove('new-born'), 2000)
                        }
                    }
                });

                observer.observe(viewContainerParent, { attributes: true })
            }

            if (!sliderParent) return;

            const toggleVisibility = new DelayedAction(() => {
                if (!sliderParent.contains(this.html)) return;
                this.html.classList.toggle('pseudo-hide', sliderParent.classList.contains('is-sliding-to-pre'))
            }, 50, 50)

            const observer = new MutationObserver(() => {
                toggleVisibility()
                setTimeout(() => this.scrollToBottom(this[lastScrollTop]), 100)
            })

            observer.observe(sliderParent, { attributes: true })

            const resizeObserver = new ResizeObserver(() => {
                this.scrollToBottom(this[lastScrollTop])
            })
            resizeObserver.observe(this.html, { box: 'border-box' })

        }

        this.waitTillDOMAttached().then(() => this.load())

        watchParentLayout()
    }
    get myTimePosition() {
        return this[timePositions].find(x => x.member == this.me.id)
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

    get visible() {
        return document.visibilityState == 'visible' && this.html.isConnected && ((style) => {
            // To say that this view is visible
            return style.visibility == 'visible' // Must be visible
                && ((new Number(style.opacity).valueOf() > 0.1) || this.html.classList.contains('pseudo-hide') || this.html.classList.contains('new-born')) // Must be not be too transparent
                && new Number(style.fontSize.split(/[^0-9.]/)[0]).valueOf() > 4 // Must have at least 4px font size
        })(window.getComputedStyle(this.html))

    }

    scrollToBottom = new DelayedAction(
        /**
         * 
         * @param {number} top If this argument is passed, then we would not scroll to the bottom. We'll stop at position
         * @param {boolean} smooth
         */
        async (top, smooth) => {
            const slideParent = this.html.closest(['', ...SlideContainer.classList].join('.'))
            if (['is-sliding-to-pre', 'is-sliding-to-secondary'].some(x => slideParent.classList.contains(x))) {
                return setTimeout(() => this.scrollToBottom(top), 500)
            }
            const messagesView = this.html.$(':scope >.container >.messages');


            const y = top || messagesView.scrollHeight

            messagesView.scrollTo({
                top: y,
                behavior: (smooth ?? !top) ? 'smooth' : 'instant'
            })


        }, 10, 100
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

        const userinfo = this.me = await hcRpc.modernuser.authentication.whoami();
        this[timePositions] = (await hcRpc.chat.messaging.getMemberTimePositions({ chat: chatID, }))
        const currentMessages = [...this.messages]
        const uiList = [];

        const doUpate = () => {
            const uListFinal = [...new Set(uiList.map(x => x.id))].map(x => uiList.find(uL => uL.id === x))
            this.messages = [...currentMessages, ...uListFinal]

            setTimeout(() => {

                // We want to put a badge showing the count of unread 
                if (this.unreadCount > 0) {
                    this[drawUnreadCountBadge]();
                } else {
                    this.scrollToBottom()
                }

            }, 200)


            // Update the parent widget, that the last message changed



        }
        const cleanup = () => {
            clearInterval(interval)
            doUpate()
        }
        const interval = setInterval(doUpate, 2000)
        try {
            for await (const message of await hcRpc.chat.messaging.getMessages({ chat: chatID, limit: 100, earliestMessage: lastMessage })) {
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
     * This method directly writes the unread count to a target widget
     * @param {ChatMessage} target 
     */
    [setUnreadBadgeCount](target) {
        target.badgeContent = hc.spawn(
            {
                innerHTML: `<div class='unread-count' style='display:inline; padding-right: 1ex;'>${this.unreadCount}</div> unread messages`
            }
        );
    }

    /**
     * This method rightfully draws the unread count badge in the right position, with the right value.
     */
    [drawUnreadCountBadge]() {
        this.messageWidgets.forEach(x => x.badgeContent?.destroy()) // first, we remove the old badge
        if (this.unreadCount < 1) {
            // Let's not fall into the temptation of 0 unread messages
            return
        }
        const mainMsgWidget = this.messageWidgets[this.messageWidgets.length - this.unreadCount - 1];
        if (!mainMsgWidget) return;
        this[setUnreadBadgeCount](mainMsgWidget)
        if (this.visible) {
            mainMsgWidget.html.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    }

    get unreadCount() {
        return this.messages.filter(x => !x.isOwn && ((x.edited?.time || x.time) > (this.myTimePosition?.position.read || 0))).length
    }

    [onUnreadCountChange]() {
        // This method is called when the unread count changes
        // This method is not interested in re-calculating the right position of the unread count, but just updating the count
        // We only update the position, if the difference between the count, and the message widget badged, is more than 3


        const currBadgeWidget = this.messageWidgets.find(x => (typeof x.badgeContent) != 'undefined')

        if (!currBadgeWidget) {
            return this[drawUnreadCountBadge]()
        }


        const currBadgeIndex = this.messageWidgets.findIndex(x => x == currBadgeWidget);
        const expectedBadgeIndex = this.messageWidgets.length - this.unreadCount - 1
        // If the difference between ideal, and real, is too much (>3), then we draw all over
        if ((expectedBadgeIndex - currBadgeIndex) > 3) {
            return this[drawUnreadCountBadge]()
        }

        // And, for what we normally expect, that the difference is not so much, and we just want to update the count on the current badge
        // But wait... Let's not fall into the trap of zero unread messages
        if (this.unreadCount < 1) {
            return this[drawUnreadCountBadge]()
        }
        this[setUnreadBadgeCount](currBadgeWidget)
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

        const msgEventName = `chat-${this[lastChatID] = this.chat.id}-message`;

        if (this[onMessage]) {
            chatEventClient.events.removeEventListener(msgEventName, this[onMessage])
        }

        chatEventClient.events.addEventListener(msgEventName,
            this[onMessage] = new DelayedAction(
                () => {
                    const lastMessage = this.messages.at(-1)
                    if (!lastMessage) {
                        return;
                    }
                    // TODO: Place the error in the UI
                    this[load]({ chatID: this.chat.id, lastMessage: lastMessage.id }).catch(e => handle(e))
                },
                1000, 5000
            )
        );

        const timePositionEventName = `chat-${this[lastChatID]}-user-timeposition-change`
        chatEventClient.events.addEventListener(timePositionEventName, ({ detail }) => {
            /** @type {Omit<telep.chat.messaging.TimePosition, "chat">} */
            const data = detail
            const existing = this[timePositions].find(x => x.member == data.member) || { ...data }
            Object.assign(existing.position, data.position)
            this[timePositions] = [
                ...this[timePositions].filter(x => x.member != existing.member),
                existing
            ]
        })
    }


    static get classList() {
        return ['hc-telep-chat-messaging']
    }

}
