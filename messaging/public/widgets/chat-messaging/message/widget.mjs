/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * This widget represents a single message within the chat
 */

import hcRpc from "/$/system/static/comm/rpc/aggregate-rpc.mjs";
import { handle } from "/$/system/static/errors/error.mjs";
import { Widget, hc } from "/$/system/static/html-hc/lib/widget/index.mjs";
import ActionButton from "/$/system/static/html-hc/widgets/action-button/button.mjs";
/**
 *  This widget represents a single message within a chat 
 * @extends Widget<ChatMessage>
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
                    <div class='main'>
                        <div class='content'>
                            <div class='content-main'>Bla bla bla</div>
                            

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

        /** @type {ActionButton} */ this.btnResend
        this.widgetProperty(
            {
                selector: ['', ...ActionButton.classList].join('.'),
                parentSelector: '.container >.main >.content >.bottom >.actions >.resend',
                property: 'btnResend',
                childType: 'widget',
            }
        );

        this.btnResend = new ActionButton(
            {
                content: 'Resend',
                onclick: () => {
                    // TODO: Implement resending
                    this.send().then(() => this.failed = false).catch(e => handle(e))
                },
                hoverAnimate: false
            }
        )


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

        this.waitTillDOMAttached().then(() => {
            // Wait till the message is visible, and see if it is one that requires sending
            if (this.data.isNew) {
                this.send().catch((e) => {
                    handle(e)
                })
            }
        });

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
            await this.loadWhilePromise(
                (async () => {
                    const id = await hcRpc.chat.messaging.sendMessage(
                        {
                            chat: this.data.chat,
                            data: this.data.data,
                            type: this.data.type
                        }
                    )
                    this.data.id = id
                    delete this.data.isNew
                })()
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