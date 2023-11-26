/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * The Chat Faculty
 * This module has the role of providing other faculties, with methods from this faculty
 */

import ChatController from "../controller.mjs";
import ChatManagementInternalMethods from "../management/remote/internal.mjs";



export default class ChatInternalMethods extends FacultyFacultyRemoteMethods {

    /**
     * @param {ChatController} controller
     */
    constructor(controller) {
        super()
        this.management = new ChatManagementInternalMethods(controller.management)
    }

}