/**
 * Copyright 2024 HolyCorn software
 * The Tele-Epilepsy Project
 * This widget represents a single caller on the call widget
 */

import GlobalCallingManager from "../../call-manager/global-calling-manager.mjs";
import InlineUserProfile from "/$/modernuser/static/widgets/inline-profile/widget.mjs";
import hcRpc from "/$/system/static/comm/rpc/aggregate-rpc.mjs";
import { handle as handleError } from "/$/system/static/errors/error.mjs";
import DelayedAction from "/$/system/static/html-hc/lib/util/delayed-action/action.mjs";
import { Widget, hc } from "/$/system/static/html-hc/lib/widget/index.mjs";





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
                            </div>

                            <div class='view'></div>

                            <div class='bottom banner'></div>
                            
                        </div>
                    </div>
                `
            }
        );

        this.callId = callId

        const bg = Symbol()
        this.defineImageProperty(
            {
                selector: '.container >.main >.view',
                mode: 'background',
                property: bg
            }
        )

        this.blockWithAction(async () => {


            this.html.$('.container >.main >.top >.profile').appendChild(
                new InlineUserProfile(correspondent.profile).html
            );

            this[bg] = correspondent.profile?.icon


            await this.joinCall()

        });

        this.correspondent = correspondent


    }


    async joinCall() {
        const handle = await GlobalCallingManager.get().getHandle({ id: this.callId })
        const me = await hcRpc.modernuser.authentication.whoami()
        const isMe = me.id == this.correspondent.profile.id;

        /** @type {HTMLVideoElement} */
        const videoHTML = hc.spawn({ tag: 'video', attributes: { autoplay: true } })
        this.html.$('.container >.main >.view').appendChild(videoHTML)

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

            const localStream = await GlobalCallingManager.getMediaStream({ audio: true, video: handle.type == 'video' }, aborter.signal)
            if (isMe) {
                videoHTML.muted = true
                videoHTML.srcObject = localStream
                return
            }

            aborter.signal.addEventListener('abort', () => {
                connection.close()
            }, { once: true })


            // Determine if we're the main peer at the call (Are we the ones to create offers?)

            const isMain = ((await handle.updateSDPData({ member: this.correspondent.profile.id, data: '' }))[this.correspondent.profile.id] == 'offer')

            const connection = new RTCPeerConnection({
                iceServers: [
                    // {
                    //     urls: [
                    //         'stun:stun.l.google.com:19302',
                    //         'stun:stun1.l.google.com:19302',
                    //         'stun:stun2.l.google.com:19302',
                    //         'stun:stun3.l.google.com:19302',
                    //         'stun:stun4.l.google.com:19302'
                    //     ],
                    // },
                    {
                        urls: [
                            `turn:${window.location.hostname}:3478`
                            `stun:${window.location.hostname}:3478`
                        ],
                        username: 'user',
                        credential: 'user',
                    }
                ]
            });


            localStream.getTracks().forEach(track => {
                connection.addTrack(track, localStream)
            })

            const remoteStream = new MediaStream()

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

                // console.log(`Just created an answer`)
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

                if ((connection.connectionState != 'connected') && (connection.connectionState != 'connecting') && (connection.connectionState != 'new')) {

                    if (handle.members.rejected.findIndex(x => x == this.correspondent.profile.id) != -1) {
                        // In this case, the correspondent left the call.
                        return console.log(`The correspondent left the call`)
                    }
                    console.log(`Connection failed. Taking everything from the start... call state is ${connection.connectionState}`)
                    aborter.abort()
                    setTimeout(() => {
                        setupStreaming()
                    }, 2000)
                    return
                }

            }, { signal: aborter.signal })


        }

        await setupStreaming()


    }


    /** @readonly */
    static get classList() {
        return ['hc-telep-chat-call-widget-correspondent']
    }

}