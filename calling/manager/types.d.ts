/**
 * Copyright 2024 HolyCorn Software
 * The Tele-Epilepsy Project
 * This module contains type definitions related to management of calls
 */


import ''


global {
    namespace telep.chat.calling {
        interface FrontendCallStatPlus extends CallStat {
            profiles: modernuser.profile.UserProfileData[]
        }


        interface CallStat {
            id: string
            chat?: string
            members: {
                invited: string[]
                acknowledged: string[]
                rejected: string[]
            }
            time: {
                created: number
                connected: number
                ended: number
            }
            type: CallType
            rooms: CallRoomState[]
        }

        type CallStats = {
            [id: string]: Omit<CallStat, "id">
        }

        type CallType = "voice" | "video"

        type CallDirection = "incoming" | "outgoing"

        /**
         * This data structure represents a pair of calling parties in a call, and data that governs their actions.
         */
        type CallRoomState = SDPTableEntry & {
            /** The id of the member in the room, who is allowed to make an offer */
            superior: string
            /** The id of the member in the room, who makes answers */
            junior: string
        }




        type SDPTableEntry = {
            /** The SDP answer from the junior member */
            answer: string
            /** The SDP offer from the senior member */
            offer: string
            offerTime?: number
            answerTime?: number
        }


        type SDPUpdateData = {
            [otherMember: string]: string
        }

        type SDPFields = keyof SDPDataType[]

        type SDPDataType = "offer" | "answer"

        /**
         * This is returned after a client has updated his SDP data on the server, for various other members.
         * The results tells us if we were setting to the offer, or answer fields
         */
        type SDPUpdateResults = {
            [member: string]: SDPDataType
        }

    }
}