/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * The Chat Faculty
 * This module contains type definitions generally needed by the faculty
 */

// Importing something (sadly) is important for making vs code merge parallel definitions
// of this namespace found in other files
import { CursorFlag } from "mongodb"
import ChatPublicMethods from "./remote/public.mjs"
import ChatInternalMethods from "./remote/internal.mjs"





global {
    namespace telep.chat.management {
        interface Collections {
            chats: telep.chat.management.ChatManagementCollections
            messaging: telep.chat.messaging.Collections
        }
        interface ClientMethods {
            calling: ClientCallingMethods
        }
        interface ClientCallingMethods {
            ring: (param0: { call: string }) => Promise<void>
        }
    }
    namespace faculty {
        interface faculties {
            chat: {
                remote: {
                    public: ChatPublicMethods
                    internal: ChatInternalMethods
                }
            }
        }
    }

    namespace telep.chat {
        interface ChatMetadata extends telep.chat.management.Chat {
            caption: string
            unreadCount: number
            lastTime: number
            lastDirection: 'incoming' | 'outgoing'
        }
    }
}