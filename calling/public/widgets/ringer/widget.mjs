/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * This widget is shown when there's an incoming call 
 */

import SlideIn from "/$/system/static/html-hc/widgets/slidein/widget.mjs";


export default class CallRingerUI extends SlideIn {

    /**
     * 
     * @param {string} call 
     */
    constructor(call) {
        super();

        this.content = new CallRingerContent({ call })

        this.html.classList.add(CallRingerUI.classList)

    }

    static get classList() {
        return ['hc-telep-chat-call-ringer-ui']
    }

}


import { Widget, hc } from "/$/system/static/html-hc/lib/widget/index.mjs";
import hcRpc from "/$/system/static/comm/rpc/aggregate-rpc.mjs";
import libCall from "../../helper.mjs";
import { handle } from "/$/system/static/errors/error.mjs";
import CallWidget from "../call/widget.mjs";
import PopupMenu from "/$/system/static/html-hc/widgets/popup-menu/popup.mjs";
/**
 * This widget is the main content of the call ringer ui 
 * @extends Widget<CallRingerContent>
 */
class CallRingerContent extends Widget {


    /**
     * 
     * @param {object} param0 
     * @param {string} param0.call
     */
    constructor({ call } = {}) {

        super();

        super.html = hc.spawn({
            classes: CallRingerContent.classList,
            innerHTML: `
                <div class='container'>
                    <div class='main'>
                        <div class='button reject'></div>
                        <div class='call-details'>
                            <div class='call-label'>Some Caller</div>
                            <div class='call-type-label'><div class='label-main'>Voice</div> <div class='post-label'>Call</div></div>
                        </div>
                        <div class='button accept'></div>
                    </div>
                </div>
            `
        });

        const acceptIcon = Symbol()
        const rejectIcon = Symbol()

        /** @type {string} */ this[acceptIcon];
        /** @type {string} */ this[rejectIcon];
        const actions = [acceptIcon, rejectIcon]

        for (let i = 0; i < actions.length; i++) {

            this.defineImageProperty(
                {
                    selector: `.container >.main >.button.${['accept', 'reject'][i]}`,
                    property: actions[i],
                    cwd: new URL('./res/', import.meta.url).href,
                    mode: 'inline'
                }
            );


        }


        this[acceptIcon] = `voice-call.svg`
        this[rejectIcon] = 'phone-slash.svg'

        /** @type {string} */ this.call

        Object.assign(this, arguments[0])

        this.waitTillDOMAttached().then(() => this.load())



    }

    async load() {
        this.loadWhilePromise(
            (
                async () => {
                    const data = await hcRpc.chat.calling.getCallData(
                        {
                            id: this.call
                        }
                    );

                    const callerProfile = data.profiles.find(x => x.id === data.members.invited[0])

                    this.html.$('.container >.main >.call-details >.call-label').innerHTML = callerProfile.label

                    this.html.$('.container >.main >.call-details >.call-type-label >.label-main').innerHTML = libCall.getCallTypeLabel(data.type)

                    this.html.$('.container >.main >.button.accept').addEventListener('click', () => {
                        new PopupMenu(
                            {
                                content:
                                    new CallWidget({ id: this.call, type: data.type }).html,
                            }
                        ).show()
                    })

                }
            )()
        ).catch(e => handle(e))
    }


    /**
     * @readonly
     */
    static get classList() {
        return ['hc-telep-chat-call-ringer-content'];
    }
}