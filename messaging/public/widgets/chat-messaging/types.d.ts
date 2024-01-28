/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * The Chat Faculty
 * Part of the chat-messaging widget
 * This module contains type definitions needed by the widget
 */

import { Collection } from "mongodb";
import ChatMessaging from "./widget.mjs";




global {
    namespace telep.chat.messaging.frontend {
        type Message = Omit<telep.chat.messaging.Message, "userid"> & {
            isOwn: boolean
            isNew: boolean
        }

        type TimePositionsTable = {
            [member: string]: telep.chat.messaging.TimePosition
        }
    }

    namespace soul.http.frontendManager.runManager.ui.event_based_extender {
        interface EventDataMap {
            'telep-chat-messaging-extend': {
                input: {
                    widget: ChatMessaging
                }
                output: {
                    html: HTMLElement
                }
                scope: 'telep-chat-messaging-extensions'
            }

            'telep-chat-messaging-create-custom-view': {
                input: {
                    message: telep.chat.messaging.Message
                }
                output: {
                    html: HTMLElement
                }
                scope: 'telep-chat-messaging-extensions'
            }
        }
    }
}