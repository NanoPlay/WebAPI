/*
    NanoPlay Web API

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://nanoplay.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.nanoplay.webapi.updates", function(exports) {
    exports.applyUpdateFiles = function(files, target, progressCallback = function() {}) {
        if (typeof(files) != "object") {
            throw new TypeError("Files must be an object");
        }

        if (typeof(target) != "object") {
            throw new TypeError("NanoPlay instance must be specified");
        }

        var thisScope = this;

        if (this.versionNumber != null && this.versionNumber < 2) {
            throw new NotSupportedError("Please manually update your NanoPlay to V0.2.2 or later");
        }

        return target.connection.communicate(";eval(\`" + [
            `clearTimeout(require("main").rootScreenLoop);`,
            `LED.write(require("config").properties.backlight);`,
            `Pixl.setLCDPower(true);`,
            `require("main").preventOpening();`,
            `require("display").clear();`,
            `require("display").drawCharsFromCell(require("l10n").translate("uploading"), 0, 1);`,
            `require("display").render();`,
            `Modules.removeAllCached();`
        ].join("") + "\`)\n").then(function() {
            var commandsToRun = [];

            for (var i = 0; i < Object.keys(files); i++) {
                commandsToRun.push(`require("Storage").erase(\`${Object.keys(files)[i]}\`);`);
            }

            commandsToRun.push(`require("Storage").compact();`);

            target.connection.evaluate(commandsToRun.join("")).catch(function(error) {
                throw error;
            });

            return new Promise(function(resolve, reject) {
                setTimeout(function() {
                    resolve();
                }, 5000);
            });
        }).then(function() {
            var promiseChain = Promise.resolve();
            var i = 0;

            for (var file in files) {
                (function(file, i) {
                    var commandToRun = "";

                    if (files[file] != null) {
                        commandToRun = `require("Storage").write(\`${file}\`, atob(\`${String(files[file])}\`));`;
                    }

                    promiseChain = promiseChain.then(function() {
                        progressCallback(i, Object.keys(files).length, file);

                        return target.connection.communicate(
                            `;g.clearRect(9, 43, 117, 53);` +
                            `g.drawRect(9, 43, 117, 53);` +
                            `g.fillRect(9, 43, ${Math.round((i / Object.keys(files).length) * 108) + 9}, 53);` +
                            `g.setPixel(9, 43, 0);g.setPixel(117, 43, 0);g.setPixel(9, 53, 0);g.setPixel(117, 53, 0);` +
                            `g.flip();\n` +
                            commandToRun + "\n"
                        );
                    });
                })(file, i);

                i++;
            }

            promiseChain = promiseChain.then(function() {
                return target.connection.evaluate(`reset();`);
            });

            return promiseChain;
        });
    };
});