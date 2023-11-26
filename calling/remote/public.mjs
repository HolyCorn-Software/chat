/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * This module provides public access to features related to calling
 */

import muser_common from "muser_common";
import ChatCallingController from "../controller.mjs";



export class CallingPublicMethods extends muser_common.UseridAuthProxy.createClass(ChatCallingController.prototype) {
    constructor(controller) {
        super(controller)
    }
}