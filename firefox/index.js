var tabs = require("sdk/tabs");
var buttons = require('sdk/ui/button/action');
var utils = require('utils.js');

var button = buttons.ActionButton({
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

//    var worker = tabs.activeTab.attach({
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