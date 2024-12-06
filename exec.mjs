/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * The Chat Faculty
 * This faculty, allows users, the ability to send messages, and make calls
 */

import collections from "./collections.mjs"
import ChatController from "./controller.mjs"
import ChatInternalMethods from "./remote/internal.mjs"
import ChatPublicMethods from "./remote/public.mjs"



export default async function init() {

    await import("./plugin/model.mjs");

    const faculty = FacultyPlatform.get()

    const controller = new ChatController(collections)
    faculty.remote.internal = new ChatInternalMethods(controller)
    faculty.remote.public = new ChatPublicMethods(controller)

    global.chatController = controller;


    console.log(`${faculty.descriptor.label.yellow.bold} is running`)

}