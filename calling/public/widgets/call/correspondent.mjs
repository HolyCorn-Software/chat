/**
 * Copyright 2024 HolyCorn software
 * The Tele-Epilepsy Project
 * This widget represents a single caller on the call widget
 */

import GlobalCallingManager from "../../call-manager/global-calling-manager.mjs";
import CallWidget from "./widget.mjs";
import InlineUserProfile from "/$/modernuser/static/widgets/inline-profile/widget.mjs";
import hcRpc from "/$/system/static/comm/rpc/aggregate-rpc.mjs";
import DelayedAction from "/$/system/static/html-hc/lib/util/delayed-action/action.mjs";
import { Widget, hc } from "/$/system/static/html-hc/lib/widget/index.mjs";
import { AnimatedTick } from "/$/system/static/html-hc/widgets/animated-tick/tick.js";
import Spinner from "/$/system/static/html-hc/widgets/infinite-spinner/widget.mjs";


const localStream = Symbol()
const localStreamRefs = Symbol()




export default class CallCorrespondent extends Widget {


    /**
     * 
     * @param {telep.chat.calling.ui.CallCorrespondent} correspondent 
     * @param {string} callId
     */
    constructor(correspondent, callId) {
        super();

        super.html = hc.spawn(
            {
                classes: CallCorrespondent.classList,
                innerHTML: `
                    <div class='container'>
                        <div class='main'>
                            <div class='top banner'>
                                <div class='profile'></div>
                                <div class='details'>
                                    <div class='connection-status'></div>
                                    <div class='padding'></div>
                                </div>
                            </div>

                            <div class='view'></div>

                            
                        </div>
                    </div>
                `
            }
        );

        this.callId = callId

        const bg = Symbol();

        this.defineImageProperty(
            {
                selector: '.container >.main >.view',
                mode: 'background',
                property: bg
            }
        )


        this.html.$('.container >.main >.top >.profile').appendChild(
            new InlineUserProfile(correspondent.profile).html
        );

        this[bg] = correspondent.profile?.icon

        this.blockWithAction(async () => {

            await this.joinCall()

        });

        /** @readonly @type {"connecting"|"connected"}  */ this.connectionStatus;


        let connectionStatus;
        const audioEffects = {
            /** @type {HTMLAudioElement} */
            connecting: undefined,
            /** @type {HTMLAudioElement} */
            connected: undefined
        }
        Reflect.defineProperty(this, 'connectionStatus', {
            /**
             * 
             * @param { CallCorrespondent['connectionStatus']} status 
             */
            set: (status) => {
                if (connectionStatus == status) {
                    return;
                }
                const target = this.html.$(':scope >.container >.main >.banner.top >.details >.connection-status')
                /** @type {Spinner} */
                const spinner = target.$(`.${Spinner.classList.join('.')}`)?.widgetObject;
                spinner?.detach()

                target.querySelectorAll(':scope >*').forEach(item => item.remove());

                switch (status) {
                    case 'connecting':
                        const spinner = new Spinner();
                        target.appendChild(spinner.html)
                        spinner.start()
                        audioEffects.connecting ||= new Audio(new URL('./res/connecting.mp3', import.meta.url).href);
                        audioEffects.connecting.loop = true
                        audioEffects.connecting.play()
                        this.destroySignal.addEventListener('abort', () => {
                            audioEffects.connecting.pause()
                            audioEffects.connecting.src = '#'
                            audioEffects.connecting.load()
                        })
                        break;
                    default:
                        const tick = new AnimatedTick({ activated: true })
                        target.appendChild(tick.html)
                        tick.animate().then(() => setTimeout(() => tick.destroy(), 2000))
                        audioEffects.connecting?.pause()
                        audioEffects.connected ||= new Audio(new URL('./res/connected.mp3', import.meta.url).href);
                        audioEffects.connected.currentTime = 0;
                        audioEffects.connected.play()
                        break;
                }
                connectionStatus = status
                this.dispatchEvent(new CustomEvent('connectionStatusChange'))
            },
            get: () => connectionStatus,
            configurable: true
        });

        /** @type {(event: "connectionStatusChange", cb: (event: Event)=> void, opts?: AddEventListenerOptions)=> void} */ this.addEventListener;

        this.correspondent = correspondent;

        /** @type {ReturnType<this['connection']['addTrack']>[]} */ this[localStreamRefs];


    }

    /**
     * @readonly
     * @returns {CallWidget}
     */
    get parent() {
        return this.html.closest(`.${CallWidget.classList.join('.')}`)?.widgetObject
    }

    /**
     * @param {MediaStream} stream
     */
    set localStream(stream) {

        const removeOld = () => this[localStreamRefs]?.forEach(ref => {
            try { this.connection.removeTrack(ref) } catch { }
            ref.track?.stop()
            this[localStream].removeTrack(ref.track)
            delete this[localStream]
        });

        removeOld()

        this[localStreamRefs] = stream.getTracks().map(track => (this.connection.addTrack(track, stream)))

        this[localStream] = stream
    }
    get localStream() {
        return this[localStream]
    }


    async joinCall() {
        const handle = this.handle = await GlobalCallingManager.get().getHandle({ id: this.callId })
        const me = this.me = await hcRpc.modernuser.authentication.whoami()
        const isMe = me.id == this.correspondent.profile.id;

        /** @type {HTMLVideoElement} */
        const videoHTML = hc.spawn({ tag: 'video', attributes: { autoplay: true } })
        const target = this.html.$('.container >.main >.view');
        target.querySelectorAll('video').forEach(vid => vid.remove())
        target.appendChild(videoHTML)


        this.html.classList.toggle('voice-only', handle.type === 'voice')

        const lastValues = {
            offer: undefined,
            answer: undefined,
            offerTime: undefined,
            answerTime: undefined
        }




        const setupStreaming = async () => {

            const aborter = new AbortController()

            this.destroySignal.addEventListener('abort', () => { aborter.abort() }, { once: true, signal: aborter.signal })

            handle.events.addEventListener('end', () => {
                setTimeout(() => this.destroy(), 2000)
            }, { signal: aborter.signal })

            this.html.addEventListener('hc-connected-to-dom', () => {
                videoHTML.play()
                videoHTML.currentTime = Date.now()
            })

            if (isMe) {
                videoHTML.muted = true
                const setVideoStream = async () => {
                    videoHTML.srcObject = await this.parent.getLocalStream()
                    videoHTML.load()
                    videoHTML.play()
                }
                this.parent.addEventListener('localstream-changed', setVideoStream, { signal: aborter.signal })
                await setVideoStream()


                this.parent.addEventListener('localstream-destroyed', () => {
                    videoHTML.srcObject = null;
                    videoHTML.load()
                }, { signal: aborter.signal })

                return
            }

            this.connectionStatus = 'connecting'


            // Determine if we're the main peer at the call (Are we the ones to create offers?)

            const isMain = ((await handle.updateSDPData({ member: this.correspondent.profile.id, data: '' }))[this.correspondent.profile.id] == 'offer')

            const connection = this.connection = new RTCPeerConnection({
                iceServers: [
                    {
                        urls: [
                            `turn:${window.location.hostname}:3478`,
                            `stun:${window.location.hostname}:3478`
                        ],
                        username: 'user',
                        credential: 'user',
                    },
                    {
                        urls: [
                            'stun:stun.l.google.com:19302',
                            'stun:stun1.l.google.com:19302',
                            'stun:stun2.l.google.com:19302',
                            'stun:stun3.l.google.com:19302',
                            'stun:stun4.l.google.com:19302'
                        ],
                    },
                ]
            });


            aborter.signal.addEventListener('abort', () => {
                connection.close()
            }, { once: true })


            const setLocalStream = async () => {
                this.localStream = await this.parent.getLocalStream()
            }

            await setLocalStream()

            this.parent.addEventListener('localstream-changed', () => {
                setLocalStream()
                console.log(`localstream changed!`)
            }, { signal: aborter.signal })

            this.parent.addEventListener('localstream-destroyed', () => {
                this[localStreamRefs].forEach((ref) => connection.removeTrack(ref))
            }, { signal: aborter.signal })


            const remoteStream = this.remoteStream = new MediaStream()

            videoHTML.srcObject = remoteStream

            connection.addEventListener('track', (event) => {
                event.streams[0].getTracks().forEach((track) => remoteStream.addTrack(track))
            }, { signal: aborter.signal })



            const createOffer = async () => {
                if (connection.connectionState == 'connecting') {
                    return;
                }
                const offer = await connection.createOffer()
                await connection.setLocalDescription(offer)
                await handle.updateSDPData(
                    {
                        member: this.correspondent.profile.id,
                        data: offer.sdp
                    }
                );
                lastValues.offer = offer.sdp
                // console.log(`Just created a new offer`)
            }

            const reInitiate = () => {
                if ((connection.connectionState != 'connected' && connection.connectionState != 'connecting') || connection.signalingState != 'stable') {
                    createOffer().catch(e => {
                        if (/call.*not.*found/gi.test(e)) {
                            aborter.abort()
                        }
                    })
                }
            }

            const createAnswer = new DelayedAction(async () => {

                const sdpIn = handle.sdps[this.correspondent.profile.id];

                if (!sdpIn?.offer) {
                    return;
                }

                await connection.setRemoteDescription(
                    {
                        type: 'offer',
                        sdp: sdpIn.offer,

                    }
                );

                const answer = await connection.createAnswer()
                lastValues.answer = answer.sdp
                lastValues.offer = sdpIn.offer
                lastValues.offerTime = sdpIn.offerTime
                lastValues.answerTime = sdpIn.answerTime

                await connection.setLocalDescription(answer)

                await handle.updateSDPData(
                    {
                        member: this.correspondent.profile.id,
                        data: answer.sdp
                    }
                )

            }, 500)

            connection.addEventListener('icecandidate', (event) => {

                if (event.candidate) {
                    handle.sendIceCandidate({ member: this.correspondent.profile.id, candidate: event.candidate })
                }


            }, { signal: aborter.signal });

            handle.events.addEventListener('ice-candidate', async ({ detail: candidate }) => {

                if (connection.signalingState == 'closed') {
                    return;
                }

                // console.log(`The remotely-triggered Ice candidate: `, candidate)
                await new Promise((resolve) => {
                    const done = () => {
                        resolve();
                        clearInterval(interval)
                    }
                    const check = () => {
                        if (connection.remoteDescription || aborter.signal.aborted) {
                            done()
                            return true;
                        }
                    }
                    let interval;
                    if (!check()) {
                        interval = setInterval(check, 100)
                    }
                })
                connection.addIceCandidate(candidate).catch(() => undefined)
            }, { signal: aborter.signal })


            let createAnswerPromise;
            handle.events.addEventListener('sdp-change', new DelayedAction(async () => {

                if (connection.connectionState == 'connected' || connection.connectionState == 'failed' || connection.signalingState == 'closed') {
                    return;
                }

                if (isMain) {
                    const nwSDP = handle.sdps[this.correspondent.profile.id];
                    if (nwSDP?.answer && (nwSDP.answerTime > nwSDP.offerTime) && (nwSDP.answerTime > (lastValues.answerTime || 0))) {
                        lastValues.answerTime = nwSDP.answerTime
                        lastValues.answer = nwSDP.answer
                        await connection.setRemoteDescription({
                            type: 'answer',
                            sdp: nwSDP.answer
                        })
                        // console.log(`Just accepted answer`);
                    }
                } else {
                    const nwSDP = handle.sdps[this.correspondent.profile.id]
                    try {
                        await createAnswerPromise
                    } catch { }

                    if (nwSDP.offer && (nwSDP.offerTime > (lastValues.offerTime || 0)) && (nwSDP.offerTime > nwSDP.answerTime)) {

                        await (createAnswerPromise = createAnswer())
                    }

                }

            }, 250, 1500), { signal: aborter.signal })



            if (isMain) {
                let interval;
                createOffer()
                setTimeout(() => interval = setInterval(reInitiate, 5_000), 2000)
                aborter.signal.addEventListener('abort', () => clearInterval(interval), { once: true })
            }

            connection.addEventListener('connectionstatechange', () => {

                switch (connection.connectionState) {
                    case 'connected':
                        this.connectionStatus = 'connected'
                        break;
                    default:
                        this.connectionStatus = 'connecting'

                }

                if (connection.connectionState != 'connected' && connection.connectionState != 'connecting' && connection.connectionState != 'new') {

                    if (handle.members.rejected.findIndex(x => x == this.correspondent.profile.id) != -1) {
                        // In this case, the correspondent left the call.
                        return console.log(`The correspondent left the call`)
                    }

                    console.log(`Connection failed. Taking everything from the start... call state is ${connection.connectionState}`)
                    aborter.abort()
                    setTimeout(() => {
                        setupStreaming()
                    }, 1000)
                    return
                }

            }, { signal: aborter.signal })


        }

        try {
            await setupStreaming()
        } catch (e) {
            if (!/not.*found/gi.test(`${e}`)) {
                throw e
            }
        }


    }


    /** @readonly */
    static get classList() {
        return ['hc-telep-chat-call-widget-correspondent']
    }

}