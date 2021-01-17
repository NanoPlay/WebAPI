var nanoplay = require("com.subnodal.nanoplay.webapi");
var updates = require("com.subnodal.nanoplay.webapi.updates");
var np = new nanoplay.NanoPlay();

var updateFileData = "";

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
    document.getElementById("setSystemTimeButton").disabled = true;
    document.getElementById("updateButton").disabled = true;
}

function enable() {
    document.getElementById("uploadTestAppButton").disabled = false;
    document.getElementById("removeTestAppButton").disabled = false;
    document.getElementById("setSystemTimeButton").disabled = false;
    document.getElementById("updateButton").disabled = false;
}

function exportApp() {
    download($("#appId").val() + ".nano.js", $(".codeinput").val());
}

// FORMAT FOR NM.JS FILE: ID||EN_NAME||FR_NAME

function exportManifest() {
    download($("#appId").val() + ".nm.js", $("#appId").val() + "||" + $("#name").val() + "||" + $("#nameFrench").val());
}

function uploadViaBluetooth() {
    document.getElementById("bluetoothUploadText").innerText = "Connecting...";
    $('#bluetoothIcon').text('bluetooth');
    np.connect().then(function() {
        document.getElementById("bluetoothUploadText").innerText = `Connected to ${np.name}! Uploading...`;
        $('#bluetoothIcon').text('upload');
        np.uploadApp($('#code').val(), {
            id: $('#appId').val(),
            name: {
                en_GB: $('#name').val(),
                fr_FR: $('#nameFrench').val()
            },
            icon: testIcon
        }).then(function() {
            document.getElementById("bluetoothUploadText").innerText = "Uploaded!";
            $('#bluetoothIcon').text('done');
            setTimeout(
                function() 
                {
                    document.getElementById("bluetoothUploadText").innerText = "Upload via Bluetooth";
                    $('#bluetoothIcon').text('send');
                }, 2000);
            });
    }).catch(function(error) {
        console.error(error);
        document.getElementById("bluetoothUploadText").innerText = "Error uploading, Check console for more info";
        setTimeout(
            function() 
            {
                document.getElementById("bluetoothUploadText").innerText = "Upload via Bluetooth";
                $('#bluetoothIcon').text('send');
            }, 2000);
        });
    };

function download(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

$(document).ready(function(){
    $("#file").on('change',function(){
        var fileInfo = $(this).prop('files')[0];
        var fileName = fileInfo.name;
        if (fileName.indexOf(".nano.js") >= 0) {
            var fileReader = new FileReader();
            fileReader.onload = function () {
                var data = fileReader.result;
                var coreData = data.replace('data:text/javascript;base64,','');
                var codeOutput = window.atob(coreData);
                $('.codeinput').val(codeOutput)
                $('.importBackground').fadeOut();
            };
            fileReader.readAsDataURL($(this).prop('files')[0]);
        } else if (fileName.indexOf(".nm") >= 0) {
            var fileReader = new FileReader();
            fileReader.onload = function () {
                var data = fileReader.result;
                var coreData = data.replace('data:application/octet-stream;base64,','');
                var manifestOutput = window.atob(coreData);
                var fullManifest = manifestOutput.split("||");
                $("#name").val(fullManifest[1]);
                $("#appNameInput").val(fullManifest[1]);
                $("#nameFrench").val(fullManifest[2]);
                $("#appId").val(fullManifest[0]);
                $('.importBackground').fadeOut();
            };
            fileReader.readAsDataURL($(this).prop('files')[0]);
        }
    });
});

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

function updateProgress(i, total, file) {
    document.getElementById("status").innerHTML = `Updating (${Math.round((i / total) * 100)}%, uploading file <code>${file}</code>)...`;
}

function setSystemTime() {
    document.getElementById("status").innerText = "Connecting...";
    disable();

    np.connect().then(function() {
        document.getElementById("status").innerText = `Connected to ${np.name}, V${np.version}! Setting system time...`;

        np.setSystemDate().then(function() {
            document.getElementById("status").innerText = "Set system time!";
            enable();
        });
    }).catch(function(error) {
        console.error(error);

        document.getElementById("status").innerText = "An error occurred! Try setting again";
        enable();
    });
}

function updateSystem() {
    document.getElementById("status").innerText = "Connecting...";
    disable();

    np.connect().then(function() {
        document.getElementById("status").innerText = `Connected to ${np.name}, V${np.version}! Defragmenting to prepare for update...`;

        updates.applyUpdateFiles(JSON.parse(updateFileData), np, updateProgress).then(function() {
            document.getElementById("status").innerText = "Updated!";
            enable();
        });
    }).catch(function(error) {
        console.error(error);

        document.getElementById("status").innerText = "An error occurred! Try updating again";
        enable();
    });
}

addEventListener("load", function() {
    document.getElementById("updateInput").addEventListener("change", function() {
        if (this.files.length > 0) {
            var reader = new FileReader();

            reader.onload = function(event) {
                updateFileData = event.target.result;
            };

            reader.readAsText(this.files[0]);
        }
    });
});