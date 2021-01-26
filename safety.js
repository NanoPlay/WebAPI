/*
    NanoPlay Web API

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://nanoplay.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.nanoplay.webapi.safety", function(exports) {
    // This codes checks over other code and ensures that that code cannot enter
    // an infinite loop, otherwise it'll freeze the NanoPlay

    // Manual minification of variable names:
    // __e = __escape
    // __i = __iterationsMade
    // __l = __lastIteration

    exports.makeSafe = function(code) {
        var codeToInject = `__e(__condition)`;

        code = `
            var __i = 0;
            var __l = new Date().getTime();
            function __e(c) {
                if (__i > 500 && new Date().getTime() - __l <= 3000) {
                    throw new Error("Too long without deferring");
                } else if (__i > 500) {
                    __i = 0;
                    __l = new Date().getTime();
                } else {
                    __i++;
                }
        
                return c;
            }
        ` + code;

        code = code
            .replace(/while\s*\((.*?)\)/g, `while (${codeToInject.replace("__condition", "$1")})`)
            .replace(/for\s*\((.*?);(.*?);(.*?)\)/g, `for ($1; ${codeToInject.replace("__condition", "$2")}; $3)`)
            .replace(/function\s*loop\s*\((.*?)\)\s*{/g, `function loop($1) {__i=0; __l=0;`)
            .replace(/var\s*loop\s*=\s*function\s*\((.*?)\)\s*{/g, `function loop($1) {__i=0; __l=0;`)
        ;

        return code;
    };
});