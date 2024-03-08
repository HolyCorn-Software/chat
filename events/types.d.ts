/**
 * Copyright 2023 HolyCorn Software
 * The Chat Faculty
 * This module contains type definitions related to the propagation of events
 */



import ''

global {
    namespace telep.chat.events {
        interface AllEvents {
            'telep-chat-new-chat': {
                chat: telep.chat.ChatMetadata
            }
            'telep-chat-chat-ended': {
                id: string
            }
            'telep-chat-state-changed': {
                id: string
            }
            'telep-chat-new-message': undefined
        }
    }
}