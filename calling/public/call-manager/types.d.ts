/**
 * Copyright 2024 HolyCorn Software
 * The Tele-Epilepsy Project
 * This module contains type definitions related to managing calls on the frontend.
 */


import ''


global {
    namespace telep.chat.calling.ui {
        interface CallCorrespondent {
            profile: modernuser.profile.UserProfileData

        }

        interface CallCorrespondentMedia {
            src?: string
            mute: boolean
        }

        interface CallEvents extends EventTarget {
            addEventListener: (event: 'pause' | 'resume' | 'end' | 'members-change' | 'sdp-change' | 'profiles-change' | "states-change", callback: (Event) => void, opts?: AddEventListenerOptions) => void
        }


        type CallStatesTable = {
            [member: string]: CallState
        }

        type CallState = "ringing" | "connected" | "exited" | "declined"

        type LocalSDPTable = {
            [member: string]: SDPTableEntry & {
                isSuperior: boolean
            }
        }


    }
}