var nanoplay = require("com.subnodal.nanoplay.webapi");
var np = new nanoplay.NanoPlay();

var testIcon = require("com.subnodal.nanoplay.webapi.icon").create(`

  #   #   #####  #####   ####  #####
  #   #     #    #      #        #
    #       #    ###     ###     #
 #     #    #    #          #    #
  #####     #    #####  ####     #
`);

function disable() {
    document.getElementById("uploadTestAppButton").disabled = true;
    document.getElementById("removeTestAppButton").disabled = true;
}

function enable() {
    document.getElementById("uploadTestAppButton").disabled = false;
    document.getElementById("removeTestAppButton").disabled = false;
}

function uploadTestApp() {
    document.getElementById("status").innerText = "Connecting...";
    disable();

    np.connect().then(function() {
        document.getElementById("status").innerText = `Connected to ${np.name}, V${np.version}! Uploading...`;

        np.uploadApp(`
            function loop() {
                text(20,10,"It works!");
                text(20,30,"Thanks for uploading");
                text(20,40,"me!")
            }
        `, {
            id: "test",
            name: {
                en_GB: "Test App",
                fr_FR: "Tester l'app"
            },
            icon: testIcon
        }).then(function() {
            document.getElementById("status").innerText = "Uploaded!";
            enable();
        });
    }).catch(function(error) {
        console.error(error);

        document.getElementById("status").innerText = "An error occurred! Try uploading again";
        enable();
    });
}

function removeTestApp() {
    document.getElementById("status").innerText = "Connecting...";
    disable();

    np.connect().then(function() {
        document.getElementById("status").innerText = `Connected to ${np.name}, V${np.version}! Removing...`;

        np.removeApp("test").then(function() {
            document.getElementById("status").innerText = "Removed!";
            enable();
        });
    }).catch(function(error) {
        console.error(error);

        document.getElementById("status").innerText = "An error occurred! Try removing again";
        enable();
    });
}