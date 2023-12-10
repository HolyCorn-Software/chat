/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * The Chat Faculty
 * This module contains type definitions for the messaging module of the faculty
 */

import { Collection } from "mongodb"


global {
    namespace telep.chat.messaging {

        interface Message {

            /** The unique identifier for this message */
            id: string
            /** This field points to the id of the user who sent the message */
            sender: string
            /** The chat within which the message was sent */
            chat: string
            /** 
             * This tells us the type of message we are dealing with. 
             * Is it a text, media, or advanced message
             */
            type: Type
            /** Information of the message */
            data: {
                /** This field is set if the message is a text message */
                text: string
                /**
                 * This field is set if a message is a media message
                 */
                media: {
                    /** The type of data in the message */
                    mime: Mime
                    /** A URL link to the content of the message */
                    url: string
                    /** An optional string for describing the message */
                    caption: string

                }
                /**
                 * This field is set, if the message is an advanced (meta) message
                 */
                meta: {
                    contentType: keyof AllMessageMetaTypes
                    data: AllMessageMetaTypes
                }
            }
            /** This field contains the time the message was created */
            time: number
            /**
             * This field contains information on how the message was sent, delivered, and read
             */
            reports: {
                /** 
                 * This field contains information of all those within the chat,
                 * who have received the message so far.
                 * 
                 */
                delivered: ReportEntry[]
                /**
                 * This field contains information of all those within the chat,
                 * who have read the message so far.
                 */
                read: ReportEntry[]
            }
            /** 
             * This field contains information on if, and how the message was edited
             * 
             */
            edited: {
                /** This field refers to the time the message was last edited */
                time: number
            }
            /**
             * This field is present if a message has been deleted, and contains
             * information on the deletion
             */
            deleted: {
                time: number
            }

        }

        type MessageInit = Omit<Message, "edited" | "deleted" | "time" | "id" | "sender" | "reports"> & {
            userid: string
        }

        type Type = "text" | "media" | "meta"
        type Mime = "audio/*" | "video/*" | "image/*"
        interface AllMessageMetaTypes {
            'exampleType': {
                payment: string
            }
        }

        interface ReportEntry {
            /** The userid of the recipient. */
            recipient: string
            /** The time the message was delivered, or read. */
            time: number
        }
        type MessagesCollection = Collection<Message>

        interface Collections {
            messages: MessagesCollection
        }




    }
}