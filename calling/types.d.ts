/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * This module contains type definitions for the calling feature of the Chat Faculty
 */

import { Collection } from "mongodb";



global {
    namespace telep.chat.calling {


        type CallState = "waiting" | "ringing" | "declined" | "connected" | "exited"

    }
}