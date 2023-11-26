/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * The Chat Faculty
 * This module contains type definitions related to management of chats
 */

import { Collection } from "mongodb"

global {

    namespace telep.chat.management {

        type ChatInit = Pick<Chat, "type" | "recipients" | "rules" | "disabled"> & {
            userid: string
        }

        interface Chat {
            /** A unique id for the chat */
            id: string
            /** The type of chat we're dealing with. A group, or private chat? */
            type: ChatType
            /** The individuals belonging to this chat */
            recipients: string[]
            /**
             * This field contains information of the creator, and the time, this chat
             * was created
             */
            created: {
                /** The Time this chat was created */
                time: number
                /** The creator of this chat */
                userid: string
            }
            /** Tells us if this chat is active */
            archived: boolean
            /** This field controls sensitive aspects of the chat, like 
             * who is allowed to make calls, and end the chat
             */
            rules: Rules
            /**
             * This field allows the chat to be disabled 
             */
            disabled: boolean
            /** If the chat is ended, this field tells us the time it was ended */
            ended: number
            /** This applies only to group chats, and is the name of the group */
            label: string
            /** The icon of the chat. Only applies to group chats */
            icon: string

        }

        type ChatType = "private" | "group"

        type RuleWhitelist = (string[] | ["any"])

        interface Rules {
            call: {
                [K in telep.chat.calling.CallType]: RuleWhitelist
            }
            end: RuleWhitelist
        }

        type RuleCheck<T = Rules> = T extends (any[] | symbol | string | number | boolean) ? true :
            {
                [K in keyof T]: RuleCheck<T[K]>
            }

        type ChatDataCollection = Collection<Chat>

    }

    namespace modernuser.permission {
        interface AllPermissions {
            'permissions.telep.chat.supervise': true
        }
    }
}