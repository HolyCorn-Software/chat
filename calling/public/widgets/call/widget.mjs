/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * This widget allows users to place, and receive calls
 */


import GlobalCallingManager from "../../call-manager/global-calling-manager.mjs";
import CallCorrespondent from "./correspondent.mjs";
import hcRpc from "/$/system/static/comm/rpc/aggregate-rpc.mjs";
import { handle } from "/$/system/static/errors/error.mjs";
import { Widget, hc } from "/$/system/static/html-hc/lib/widget/index.mjs";


const interval = Symbol()
const init = Symbol()
const callHandle = Symbol()


/**
 * This widget allows users to place, and receive calls 
 */
export default class CallWidget extends Widget {


    /**
     * 
     * @param {object} param0
     * @param {string} param0.id The id of the call. This means we are simply answering a call
     * @param {telep.chat.management.Chat} param0.chat If there's no id for the call, use this parameter
     * so that a call can be placed for the members of the chat.
     * @param {telep.chat.calling.CallType} param0.type
     */
    constructor({ id, chat, type }) {

        super();

        super.html = hc.spawn({
            classes: CallWidget.classList,
            innerHTML: `
                <div class='container'>
                    <div class='top'>
                        <div class='correspondents'></div>
                    </div>

                    <div class='bottom'>
                        <div class='call-end'>
                        <div class='call-end-main'>
                            <div class='call-end-icon'></div>
                        </div>
                            <div class='call-info highlight'>
                                <div class='call-time'>00:00</div>
                            </div>
                        </div>
                    </div>
                    
                </div>
            `
        });

        /** @type {string} */ this.id
        /** @type {telep.chat.management.Chat} */ this.chat
        /** @type {telep.chat.calling.CallType} */ this.type


        Object.assign(this, arguments[0])

        /**@type {number} */ this.callTime
        this.widgetProperty(
            {
                selector: '.call-time',
                parentSelector: '.container >.bottom >.call-end >.call-info',
                transforms: {
                    set: (v) => {
                        const minutes = Math.floor(v / 60_000)
                        const seconds = Math.floor((v - (minutes * 60_000)) / 1000)
                        return hc.spawn(
                            {
                                classes: ['call-time'],
                                innerHTML: `${`${minutes}`.padStart(2, '0')}:${`${seconds}`.padStart(2, '0')}`
                            }
                        )
                    },
                    get: (html) => {
                        const [, minutes, seconds] = /([0-9]{1,})[^0-9]+([0-9]{1,})/.exec(html.innerText)
                        return (minutes * 60_000) + (seconds * 1000)
                    }
                }
            }, 'callTime'
        )



        this.blockWithAction(async () => {

            try {
                if (this.chat) {
                    await this.placeCall()
                } else {
                    if (this.id) {
                        await this.joinCall()
                    } else {
                        throw new Error(`Either specify the 'chat', or the call 'id'`)
                    }
                }
            } catch (e) {
                handle(e)
            }
        });

        const callEndImg = Symbol()
        this.defineImageProperty(
            {
                selector: '.container >.bottom >.call-end >.call-end-main >.call-end-icon',
                property: callEndImg,
                mode: 'inline',
            }
        );

        this[callEndImg] = './res/phone-slash.svg';


        /** @type {telep.chat.calling.ui.CallCorrespondent[]} */ this.correspondents
        this.pluralWidgetProperty(
            {
                selector: ['', ...CallCorrespondent.classList].join('.'),
                parentSelector: '.container >.top >.correspondents',
                transforms: {
                    set: (data) => new CallCorrespondent(data, this.id).html,
                    get: html => html.widgetObject.correspondent
                },
                sticky: true,
            }, 'correspondents'
        );


        this.html.$('.container >.bottom >.call-end').addEventListener('click', () => {
            if (this[callHandle]?.ended) {
                return this.destroy()
            }
            this[callHandle]?.exit()
        }, { signal: this.destroySignal })





    }

    async [init]() {
        const me = await hcRpc.modernuser.authentication.whoami()
        const onCorrespondentChange = () => {
            this.correspondents = [...new Set([me.id, ...this[callHandle].members.acknowledged].filter(x => !new Set(this[callHandle].members.rejected).has(x)))].map(ack => ({ profile: this[callHandle].profiles.find(usr => usr.id == ack) }))
        }

        this[callHandle].events.addEventListener('members-change', onCorrespondentChange, { signal: this.destroySignal });

        this.blockWithAction(async () => {
            await this[callHandle].connect()
            onCorrespondentChange()

        })

        this[callHandle].events.addEventListener('end', () => {
            setTimeout(() => this.destroy(), 10_000)
            stopCounting()
        }, { once: true, signal: this.destroySignal })

        const start = Date.now()

        const startCounting = () => {
            this[interval] = setInterval(() => {
                this.callTime = Date.now() - start;
            }, 1000);
        }

        const stopCounting = () => {
            clearInterval(this[interval]);
        }

        stopCounting()
        startCounting();

        this.destroySignal.addEventListener('abort', stopCounting, { once: true })


        // TODO: Handle call-ended, and show UI
    }

    async placeCall() {
        this[callHandle] = await GlobalCallingManager.get().getHandle(
            {
                id: this.id = await hcRpc.chat.calling.placeCallFromChat({ chat: this.chat.id, type: this.type })
            }
        )

        this[init]()


    }

    async joinCall() {
        this[callHandle] = await GlobalCallingManager.get().getHandle(
            {
                id: this.id
            }
        )

        this[init]()
    }

    /**
     * @readonly
     */
    static get classList() {
        return ['hc-telep-chat-call-widget'];
    }
}

/**
 * This widget represents a single action on the call UI 
 */
class CallAction extends Widget {


    constructor() {

        super();

        super.html = hc.spawn({
            classes: CallAction.classList,
            innerHTML: `
                <div class='container'>
                    <div class='main'></div>
                </div>
            `
        });

        /** @type {string} */ this.icon
        this.defineImageProperty(
            {
                selector: '.container >.main',
                property: 'icon',
                mode: 'inline',
                cwd: new URL('./res/', import.meta.url).href,
            }
        );

        Object.assign(this, arguments[0])

        /** @type {boolean} Writing to this property highlights, or reverts the UI*/ this.active
        this.htmlProperty(undefined, 'active', 'class')


    }

    set execute(fxn) {
        this.html.onclick = () => {
            this.blockWithAction(() => fxn?.(this))
        }
    }
    get data() {
        return {
            execute: this.execute,
            icon: this.icon
        }
    }


    /**
     * @readonly
     */
    static get classList() {
        return ['hc-telep-chat-call-widget-action'];
    }
}