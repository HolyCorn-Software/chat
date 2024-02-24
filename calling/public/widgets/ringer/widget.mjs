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

        this.content = new CallRingerContent({ call }).html

        this.content.widgetObject.destroySignal.addEventListener('abort', () => {
            this.destroy()
        }, { once: true })

        this.destroySignal.addEventListener('abort', () => {
            this.content?.widgetObject.destroy()
        }, { once: true })

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
import CallPopup from "../call/popup.mjs";
/**
 * This widget is the main content of the call ringer ui 
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

                    const me = await hcRpc.modernuser.authentication.whoami()

                    const callerProfile = data.profiles.find(x => x.id === data.members.invited.filter(x => x != me.id)[0])

                    this.html.$('.container >.main >.call-details >.call-label').innerHTML = callerProfile.label

                    this.html.$('.container >.main >.call-details >.call-type-label >.label-main').innerHTML = libCall.getCallTypeLabel(data.type)


                    this.html.$('.container >.main >.button.accept').addEventListener('click', () => {
                        new CallPopup({ id: this.call, type: data.type }).show()
                        this.destroy()
                    }, { signal: this.destroySignal })


                    this.html.$('.container >.main >.button.reject').addEventListener('click', () => {
                        this.destroy()
                        hcRpc.chat.calling.leaveCall({ id: this.call })
                    });

                    // TODO: Now, play the ringtone, and vibration, untill the call is picked up.
                    const audio = new Audio(new URL('./res/ring.mp3', import.meta.url).href)
                    // audio.muted = true;
                    audio.speed

                    audio.addEventListener('ended', () => {
                        setTimeout(() => {
                            if (this.destroySignal.aborted) {
                                return;
                            }
                            audio.currentTime = 0;
                            audio.play()
                        }, 1200)
                    }, { signal: this.destroySignal })

                    const startVibration = async () => {


                        const vibrationStartTime = 4345;


                        const doVibrate = async (pattern) => {
                            navigator.vibrate(pattern);
                            await Promise.race([
                                new Promise(x => setTimeout(x, pattern.reduce((accum, curr) => accum + curr))),
                                new Promise(x => setTimeout(x, (audio.duration - audio.currentTime) * 1000))
                            ])
                        }


                        const long = 250
                        const short = 165
                        const short_wait = 50;

                        const pattern = [

                            long, short_wait * 4.5,

                            short, short_wait,
                            short, short_wait,
                            short, short_wait,
                            short, short_wait,
                            short, short_wait,



                            0, short_wait * 4.75,
                            short, short_wait,
                            short, short_wait,
                            short, short_wait,


                            0, short_wait * 4.5,
                            short, short_wait,
                            short, short_wait,
                            short, short_wait,

                            0, short_wait * 6.5,

                        ]

                        while (!this.destroySignal.aborted && !audio.paused) {



                            while ((audio.currentTime * 1000) < vibrationStartTime) {

                                await new Promise(x => setTimeout(x, (vibrationStartTime - (audio.currentTime * 1000)) * 0.1))
                            }


                            await doVibrate(pattern);

                            if (audio.paused) {
                                break;
                            }



                        }
                    }

                    audio.addEventListener('play', startVibration, { signal: this.destroySignal })


                    audio.addEventListener('loadeddata', () => audio.play(), { signal: this.destroySignal })

                    this.destroySignal.addEventListener('abort', () => {
                        audio.pause()
                        audio.loop = false
                        audio.src = '#'
                        audio.load()
                    }, { once: true })

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