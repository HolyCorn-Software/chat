/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * This module contains type definitions for the calling feature of the Chat Faculty
 */

import { Collection } from "mongodb";
import CallTransportManager from "./manager/transport.mjs";



global {
    namespace telep.chat.calling {

        interface CallStat {
            id: string

            members: {
                invited: string[]
                acknowledged: string[]
            }
            time: {
                created: number
                connected: number
                ended: number
            }
            type: CallType
            transportManager: CallTransportManager
        }

        type CallStats = {
            [id: string]: Omit<CallStat, "id">
        }

        type CallType = "voice" | "video"

        type CallDirection = "incoming" | "outgoing"

    }
}