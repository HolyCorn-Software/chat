/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * This widget represents a single message within the chat
 */

import hcRpc from "/$/system/static/comm/rpc/aggregate-rpc.mjs";
import { handle } from "/$/system/static/errors/error.mjs";
import { Widget, hc } from "/$/system/static/html-hc/lib/widget/index.mjs";
import EventBasedExtender from "/$/system/static/run/event-based-extender.mjs";
/**
 *  This widget represents a single message within a chat 
 */
export default class ChatMessage extends Widget {


    /**
     * 
     * @param {telep.chat.messaging.frontend.Message} message 
     */
    constructor(message) {

        super();

        super.html = hc.spawn({
            classes: ChatMessage.classList,
            innerHTML: `
                <div class='container'>

                    <div class='badge-area'></div>
                
                    <div class='main'>
                        <div class='content'>
                            <div class='content-main'></div>
                            

                            <div class='bottom'>
                               
                                <div class='actions'>
                                    <div class='resend'></div>
                                </div>
                                <div class='delivery-info'></div>
                                <div class='time'>10:00</div>
                                <div class='icons'>
                                    <div class='failed'></div>
                                </div>
                            </div>


                        </div>
                    </div>

                </div>
            `
        });


        if (message?.type === 'text') {
            this.html.$('.container >.main >.content >.content-main').innerHTML = message.data.text
        }
        /**
         * 
         * @param {Date} date 
         */
        const timeString = (date) => {
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`
        }
        this.html.$('.container >.main >.content >.bottom >.time').innerHTML = timeString(new Date(message?.time))
        this.data = message

        /** @type {boolean} */ this.isOwn
        this.htmlProperty(undefined, 'isOwn', 'class', undefined, 'rtl')
        this.isOwn = message.isOwn

        const extender = new EventBasedExtender(
            {
                runScope: 'telep-chat-messaging-extensions',
                eventName: 'telep-chat-messaging-create-custom-view',
            }
        )

        this.blockWithAction(async () => {
            // Wait till the message is visible, and see if it is one that requires sending
            if (this.data.isNew) {
                this.send().catch((e) => {
                    handle(e)
                })
            }

            if (this.data.type == 'meta') {
                // If this message is a meta message, let's fetch a provider, that can display it
                // Let's find a provider in such a way, that the first one to respond wins
                /** @type {soul.http.frontendManager.runManager.ui.event_based_extender.EventDataMap['telep-chat-messaging-create-custom-view']['output']['html']} */
                let htmlResults;
                await extender.fetch({
                    data: {
                        message: this.data
                    },
                    callback: async (result) => {
                        htmlResults ||= (await result).html
                    },
                    timeout: 1200
                });

                if (htmlResults) {
                    this.html.$('.container >.main >.content >.content-main').appendChild(htmlResults)
                }

            }

            if (!this.seen) {

                /** @type {(keyof HTMLElementEventMap)[]} */
                const events = ['mouseenter', 'mousedown', 'click', 'touchend']
                const abortControl = new AbortController()
                events.forEach(event => {
                    this.html.addEventListener(event, () => {
                        this.dispatchEvent(new CustomEvent('seen'));
                        this.seen = true;
                        abortControl.abort()
                    }, { once: true, signal: abortControl.signal })

                })
            }
        });

        /** @type {(event: "seen", cb: (event: CustomEvent)=> void, opts?:AddEventListenerOptions)=> void} */ this.addEventListener

        /** @type {HTMLElement & {destroy: ()=> void}} */ this.badgeContent
        this.widgetProperty(
            {
                selector: '*',
                parentSelector: '.container >.badge-area',
                childType: 'html',
                onchange: () => {
                    this.badgeContent.destroy = () => {
                        this.badgeContent.dispatchEvent(new CustomEvent('destroy'))
                        this.badgeContent.remove()
                    }
                }
            },
            'badgeContent'
        )

        /** @type {boolean} */ this.failed
        this.htmlProperty(undefined, 'failed', 'class')
        const failedIcon = Symbol()
        this.defineImageProperty(
            {
                selector: '.container >.main >.content >.bottom >.icons >.failed',
                property: failedIcon,
                mode: 'inline',
                cwd: import.meta.url
            }
        );
        this[failedIcon] = './res/exclamation-triangle.svg'
    }
    async send() {
        try {
            await this.blockWithAction(
                async () => {
                    const id = await hcRpc.chat.messaging.sendMessage(
                        {
                            chat: this.data.chat,
                            data: this.data.data,
                            type: this.data.type
                        }
                    )
                    this.data.id = id
                    delete this.data.isNew
                }
            )
        } catch (e) {
            // At this point, let's add a retry option
            this.failed = true
            throw e
        }
    }


    /**
     * @readonly
     */
    static get classList() {
        return ['hc-telep-chat-message'];
    }
}