/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * The Chat Faculty
 * Part of the chat-messaging widget
 * This module contains type definitions needed by the widget
 */

import { Collection } from "mongodb";




global {
    namespace telep.chat.messaging.frontend {
        type Message = Omit<telep.chat.messaging.Message, "userid"> & {
            isOwn: boolean
            isNew: boolean
        }
    }
}