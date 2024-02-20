/**
 * Copyright 2024 HolyCorn Software
 * The Chat Faculty
 * This module contains type definitions related to showing detail profile information about a chat.
 */



import ''


global {
    namespace soul.http.frontendManager.runManager.ui.event_based_extender {
        interface EventDataMap {
            'telep-chat-show-profile-detail': {
                input: {
                    chat: telep.chat.management.Chat
                },
                output: {
                    html: HTMLElement
                },
                scope: 'telep-chat-messaging-profile-addons'
            }
        }
    }
}