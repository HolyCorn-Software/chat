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
import ListPopup from "/$/system/static/html-hc/widgets/list-popup/widget.mjs";


const interval = Symbol()
const init = Symbol()
const callHandle = Symbol()
const localStream = Symbol()
const localStreamPromise = Symbol()
const updateLocalStream = Symbol()


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

                        <div class='controls'>
                            <div class='actions'></div>
                        </div>
                    
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

        /** @type {boolean} */ this.compact
        this.htmlProperty(undefined, 'compact', 'class', () => {

            const doIt = () => {
                this.html.style.setProperty('position', this.compact ? 'fixed' : 'relative')
            }

            doIt()

            setTimeout(doIt, this.compact == true ? 0 : 500)
        });

        hc.watchToCSS(
            {
                source: this.html,
                target: this.html,
                watch: {
                    dimension: 'width'
                },
                apply: '--content-width',
                signal: this.destroySignal
            }
        )


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

        /** @type {(event: "localstream-changed"|"localstream-destroyed", cb: (event: CustomEvent)=> void, opts?:AddEventListenerOptions)=>void} */ this.addEventListener


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
                    set: (data) => new CallCorrespondent(data, this.id, this).html,
                    get: html => html.widgetObject.correspondent
                },
                sticky: true,
            }, 'correspondents'
        );

        /** @type {CallCorrespondent[]} */ this.correspondentWidgets;
        this.pluralWidgetProperty(
            {
                childType: 'widget',
                selector: ['', ...CallCorrespondent.classList].join('.'),
                parentSelector: '.container >.top >.correspondents',
            },
            'correspondentWidgets'
        )



        this.html.$('.container >.bottom >.call-end').addEventListener('click', () => {
            if (!(this[callHandle]?.ended ?? true)) {
                this[callHandle].exit()
            } else {
                this.destroy()
            }
        }, { signal: this.destroySignal })


        /** @type {(ConstructorParameters<(typeof Action)>['0'])[]} */ this.actions


        this.pluralWidgetProperty(
            {
                selector: ['', ...Action.classList].join('.'),
                parentSelector: '.container >.bottom >.controls >.actions',
                transforms: {
                    set: (input) => {
                        return new Action(input).html
                    },
                    get: html => {
                        return {
                            img: html.widgetObject?.img,
                            onclick: html.widgetObject?.onclick
                        }
                    }
                },
            },
            'actions'
        );

        this.actions = [
            {
                img: './mic-settings.svg',
                onclick: () => {

                }
            },
            {
                img: './microphone-slash.svg',
                onclick: (action) => {
                    this.getLocalStream().then((stream) => {
                        stream.getAudioTracks().forEach(track => track.enabled = !action.active)
                    })
                    action.active = !action.active;
                }
            },
            {
                img: './camera-rotate.svg',
                onclick: () => {
                    const sel = new CallMediaSourceSelect(
                        {
                            title: `Select Camera`,
                            type: 'videoinput',
                            caption: ``
                        }
                    );
                    sel.addEventListener('change', async () => {

                        this.dispatchEvent(new CustomEvent('localstream-destroyed'))

                        this[localStream].getTracks().forEach(track => {
                            track.stop()
                            this[localStream].removeTrack(track)
                        })

                        GlobalCallingManager.getMediaStream(
                            {

                                video: {
                                    deviceId: sel.value[0],
                                },
                                audio: true
                            },
                            this[callHandle].destroySignal
                        ).then(nwStream => this[updateLocalStream](nwStream))

                        sel.destroy()
                    }, { signal: sel.destroySignal })
                    sel.show()
                }
            }
        ]


    }

    /**
     * 
     * @param {MediaStream} stream 
     */
    async [updateLocalStream](stream) {
        const meStream = await this.getLocalStream()

        meStream.getTracks().forEach(track => {
            meStream.removeTrack(track)
            track?.stop()
        })

        this[localStream] = stream;
        delete this[localStreamPromise]

        this.dispatchEvent(new CustomEvent('localstream-changed'))
    }

    /**
     * 
     * @returns {ReturnType<(typeof GlobalCallingManager)['getMediaStream']>}
     */
    async getLocalStream() {
        if (this[localStream]) {
            return await this[localStream]
        }

        const main = async () => this[localStream] ||= await GlobalCallingManager.getMediaStream({ audio: true, video: this[callHandle].type == 'video' }, this[callHandle].destroySignal);

        return await (this[localStreamPromise] ||= main())
    }

    async [init]() {
        const me = await hcRpc.modernuser.authentication.whoami()
        const onCorrespondentChange = () => {
            this.correspondents = [...new Set([me.id, ...this[callHandle].members.acknowledged].filter(x => !new Set(this[callHandle].members.rejected).has(x)))].map(ack => ({ profile: this[callHandle].profiles.find(usr => usr.id == ack) }))
            this.correspondentWidgets.forEach((x, i) => {
                x.html.classList.toggle('main', i == 0)
            })
            refreshCounting()
            this.correspondentWidgets.filter(x => x.correspondent.profile.id != me.id).forEach(
                x => x.addEventListener('connectionStatusChange', refreshCounting)
            )
        }

        this[callHandle].events.addEventListener('members-change', onCorrespondentChange, { signal: this.destroySignal });

        this.blockWithAction(async () => {
            try {
                await this[callHandle].connect();
                onCorrespondentChange()
            } catch (e) {
                if (/call.*not.*found/gi.test(`${e}`)) {
                    setTimeout(() => this.destroy())
                }
                console.log(`${e}`)
                throw e
            }

        })

        this[callHandle].events.addEventListener('end', () => {
            setTimeout(() => this.destroy(), 10_000)
            stopCounting()
        }, { once: true, signal: this.destroySignal })

        let start = Date.now()

        const startCounting = () => {
            if (!start) {
                start = Date.now() - (this.callTime || 0)

            }
            this[interval] = setInterval(() => {
                this.callTime = Date.now() - start;
            }, 1000);
        }

        const stopCounting = () => {
            clearInterval(this[interval]);
            start = undefined;
        }

        stopCounting()

        const refreshCounting = () => {
            if (
                // If all correspondents
                this.correspondentWidgets.filter(
                    // that are not me
                    x => x.correspondent.profile.id != me.id
                ).filter(
                    // that are connected
                    x => x.connectionStatus == 'connected'
                )
                    // are more than zero in number
                    .length > 0
            ) {
                // Then the call officially started
                startCounting();
            } else {
                stopCounting()
            }
        }

        refreshCounting()

        this.destroySignal.addEventListener('abort', stopCounting, { once: true })


    }

    async placeCall() {
        /** @type {Awaited<ReturnType<GlobalCallingManager['getHandle']>} */
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


class Action extends Widget {

    /**
     * 
     * @param {object} param0 
     * @param {string} param0.img
     * @param {(action: Action)=> void} param0.onclick
     */
    constructor({ img, onclick } = {}) {
        super()

        super.html = hc.spawn(
            {
                classes: Action.classList,
                innerHTML: `
                    <div class='container'>
                        <div class='image'></div>
                    </div>
                `
            }
        );

        /** @type {string} */ this.img
        this.defineImageProperty(
            {
                selector: ':scope >.container >.image',
                property: 'img',
                cwd: new URL('./res/', import.meta.url).href,
                mode: 'inline'
            }
        );
        /** @type {boolean} */ this.active
        this.htmlProperty(undefined, 'active', 'class')

        Object.assign(this, arguments[0])


    }
    set onclick(onclick) {
        this.html.onclick = () => onclick?.(this)
    }
    get onclick() {
        return this.html.onclick
    }

    /**
     * @readonly
     */
    static get classList() {
        return ['hc-telep-chat-call-widget-action'];
    }

}



class CallMediaSourceSelect extends ListPopup {

    /**
     * 
     * @param {object} param0 
     * @param {string} param0.title
     * @param {string} param0.caption
     * @param {Awaited<ReturnType<navigator['mediaDevices']['enumerateDevices']>>['0']['kind']} param0.type
     */
    constructor({ title, caption, type } = {}) {
        super(
            {
                selectionSize: { min: 1, max: 1 },
                title,
                caption,
                actionText: `Done`,
                hideOnOutsideClick: true
            }
        );

        this.blockWithAction(
            async () => {
                let devices = (await navigator.mediaDevices.enumerateDevices()).filter(x => x.kind == type);
                if (devices.length > 1) {
                    devices = devices.filter(x => x.deviceId != 'default' && ! /infrared/gi.test(x.label))
                }
                console.log(`devices `, devices)
                this.options = devices.map(
                    dev => {
                        return {
                            label: type == 'videoinput' ? (/front/gi.test(dev.label) ? "Front Camera" : "Back Camera") : dev.label,
                            value: dev.deviceId,
                            caption: '',
                        }
                    }
                )
            }
        );
    }

}