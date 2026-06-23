"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpStatus = void 0;
class HttpStatus {
    constructor(code, text) {
        this.code = code;
        this.text = text;
    }
    toString() {
        return `${this.code} ${this.text}`;
    }
}
exports.HttpStatus = HttpStatus;
