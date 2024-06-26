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
            role: keyof ChatRolesEnum
        }

        interface Chat {
            /** A unique id for the chat */
            id: string
            /** The type of chat we're dealing with. A group, or private chat? */
            type: ChatType
            /** If {@link type} is `roled`, this field contains the role the user is chatting with, as well as information about the role */
            role?: {
                data: ChatRole
                member: string
            }
            /** The individuals belonging to this chat */
            recipients: string[]
            /** The maximum number of participants that can who can be in this chat. */
            maxRecipients?: number
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

            /** Tells us the last time this chat was modified */
            modified: number

        }

        type ChatType = "private" | "group" | "roled"

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

        type ChatDataCollections = Collection<Chat>




        interface ChatRole {
            label: string
            name: keyof ChatRolesEnum
        }

        interface ChatRoleRecord extends ChatRole {
            created: number
        }

        type ChatRolesCollection = Collection<ChatRoleRecord>


        interface RoleMember {
            role: ChatRole['name']
            userid: string
        }

        interface RoleMemberRecord extends RoleMember {
            created: number
        }


        type RoleMembersCollection = Collection<RoleMemberRecord>

        interface ChatManagementCollections {
            data: ChatDataCollections
            role: {
                data: ChatRolesCollection
                members: RoleMembersCollection
            }
        }

        interface ChatRolesEnum {

            'exampleRole': true
        }

    }

    namespace modernuser.permission {
        interface AllPermissions {
            'permissions.telep.chat.supervise': true
        }
    }
}