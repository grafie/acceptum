var sdkButtons = require('sdk/ui/button/action');
var sdkConfig = require('sdk/simple-prefs');
var sdkTabs = require("sdk/tabs");

var utils = require('utils.js');

var button = sdkButtons.ActionButton({
    id: "mozilla-link",
    label: "Visit Mozilla",
    icon: {
        "16": "./icon-16.png",
        "32": "./icon-32.png",
        "64": "./icon-64.png"
    },
    onClick: handleClick
});

function handleClick(state) {

    if (sdkConfig.prefs['pageCaptureSaveDirectory'] === undefined) {
        var defaultDirectoryPath = utils.directoryPicker("Select the default directory for page captures");

        if (defaultDirectoryPath === null) {
            defaultDirectoryPath = utils.getDesktopPath('acceptum');
        }
        sdkConfig.prefs['pageCaptureSaveDirectory'] = defaultDirectoryPath;
    }

//    var worker = sdkTabs.activeTab.attach({
//        contentScriptFile: './wrapper.js'
//    });
//
//    worker.port.emit('getHeight');
//    
//    worker.port.on('height', function(height) {
//        var canvas = utils.captureActiveTab(height);
//        utils.saveCanvas(canvas, '/home/rhiza/test.png.enc', 'secret', 16, 16);
//    });

//    utils.pickCapture();
}

//sdkConfig.prefs['somePreference']