/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * This widget allows users to place, and receive calls
 */


import CallManager from "../../call-manager/manager.mjs";
import hcRpc from "/$/system/static/comm/rpc/aggregate-rpc.mjs";
import { handle } from "/$/system/static/errors/error.mjs";
import { Widget, hc } from "/$/system/static/html-hc/lib/widget/index.mjs";
import PopupMenu from "/$/system/static/html-hc/widgets/popup-menu/popup.mjs";
/**
 * This widget allows users to place, and receive calls 
 * @extends Widget<CallWidget>
 */
export default class CallWidget extends Widget {


    /**
     * 
     * @param {object} param0
     * @param {string} param0.id The id of the call. This means we are simply answering a call
     * @param {string} param0.chat If there's no id for the call, use this parameter
     * so that a call can be placed for the members of the chat.
     * @param {telep.chat.calling.CallType} param0.type
     */
    constructor({ id, chat, type }) {

        super();

        super.html = hc.spawn({
            classes: CallWidget.classList,
            innerHTML: `
                <div class='container'>
                    <div class='top'></div>

                    <div class='bottom'>
                        <div class='correspondent-info'>
                            <div class='names'>Ambe Mary</div>
                        </div>
                        <div class='call-info'>
                            <div class='call-time'>03:52</div>
                        </div>
                        <div class='actions'></div>
                    </div>
                    
                </div>
            `
        });

        /** @type {{icon: string, execute: ()=>void}[]} */ this.actions
        this.pluralWidgetProperty(
            {
                selector: ['', ...CallAction.classList].join('.'),
                parentSelector: '.container >.bottom >.actions',
                property: 'actions',
                transforms: {
                    set: (data) => {
                        return new CallAction(data).html
                    },
                    get: (html) => {
                        /** @type {CallAction} */
                        const widget = html.widgetObject
                        return widget.data
                    }
                }
            }
        );

        this.actions = [
            {
                icon: './phone-slash.svg',
                execute: () => {

                }
            },
            {
                icon: 'microphone-slash.svg',
                execute: () => {

                }
            },
            {
                icon: 'sound-toggle.svg',
                execute: () => {

                }
            }
        ];

        this.id = id
        this.chat = chat
        this.type = type

        this.waitTillDOMAttached().then(() => {
            this.loadWhilePromise(
                (
                    async () => {
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
                    }
                )()
            )
        })

    }

    async placeCall() {
        const id = await hcRpc.chat.calling.placeCallFromChat({ chat: this.chat, type: this.type })
        await CallManager.joinCall(id)
    }

    async joinCall() {

        // TODO: Make call controls, like drop, and add person
        const control = await CallManager.joinCall(this.id)


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
 * @extends Widget<CallAction>
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


    }

    set execute(fxn) {
        this.html.onclick = fxn
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