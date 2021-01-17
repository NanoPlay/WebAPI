/*
    NanoPlay Web API

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://nanoplay.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.nanoplay.webapi.icon", function(exports) {
    // Based on https://stackoverflow.com/a/39736059/11359201
    function binaryToBase64(binary) {
        var decByteArray = [];

        for (var i = 0; i < Math.ceil(binary.length / 8); i++) {
            var binaryUnit = binary.substr(8 * i, (8 * i) + 8 > binary.length ? binary.length - (8 * i) : 8);

            decByteArray.push(parseInt(binaryUnit, 2).toString(10));
        }

        var decUint8ByteArray = new Uint8Array(decByteArray);
        var base64 = "";
        var digits = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        var bytes = new Uint8Array(decUint8ByteArray);
        var byteRemainder = bytes.byteLength % 3;
        var mainLength = bytes.byteLength - byteRemainder;

        var a, b, c, d;
        var chunk;

        for (var i = 0; i < mainLength; i += 3) {
            chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];

            a = (chunk & 0b111111000000000000000000) >> 18;
            b = (chunk & 0b000000111111000000000000) >> 12;
            c = (chunk & 0b000000000000111111000000) >> 6;
            d =  chunk & 0b000000000000000000111111;

            base64 += digits[a] + digits[b] + digits[c] + digits[d];
        }

        if (byteRemainder == 1) {
            chunk = bytes[mainLength];

            a = (chunk & 0b11111100) >> 2;
            b = (chunk & 0b00000011) << 4;
            
            base64 += digits[a] + digits[b] + "==";
        } else if (byteRemainder == 2) {
            chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];

            a = (chunk & 0b1111110000000000) >> 10;
            b = (chunk & 0b0000001111110000) >> 4;
            c = (chunk & 0b0000000000001111) << 2;

            base64 += digits[a] + digits[b] + digits[c] + "=";
        }

        return base64;
    }

    function base64ToBinary(base64) {
        var raw = atob(base64);
        var binary = "";

        for (var i = 0; i < raw.length; i++) {
            binary += raw.charCodeAt(i).toString(2).padStart(8, "0");
        }

        return binary;
    }

    exports.create = function(map) {
        // Icon is 44x17 pixels in size

        var binary = "";

        map = map.split("\n");
        
        if (map[0] == "") {
            map.shift();
        }

        for (var y = 0; y < Math.min(map.length, 17); y++) {
            for (var x = 0; x < Math.min(map[y].length, 44); x++) {
                if (map[y][x] == " ") {
                    binary += "0";
                } else {
                    binary += "1";
                }
            }

            binary += "0".repeat(44 - map[y].length);
        }

        for (var i = map.length; i < 17; i++) {
            binary += "0".repeat(44);
        }

        return binaryToBase64(binary);
    };

    exports.getPixelAt = function(base64, x, y) {
        return base64ToBinary(base64)[(y * 44) + x] == "1";
    };
});